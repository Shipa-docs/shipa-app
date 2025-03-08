import type { Probot } from "probot";
import type { Context } from "probot";

// Interfaces para los tipos
interface CommitFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export default (app: Probot) => {
  // Log all events received by the bot
  app.log.info("Starting the bot...");

  // Log webhooks in a simpler way
  app.onAny(async (context) => {
    app.log.info(`Received event: ${context.name}`);
    app.log.info(`Payload: ${JSON.stringify(context.payload)}`);
    app.log.info(`Repository: ${context}`);
  });

  // Helper function to get commit details
  async function getCommitDetails(context: Context, owner: string, repo: string, commitSha: string) {
    try {
      // Get detailed commit information including files changed
      const { data: commitDetails } = await context.octokit.repos.getCommit({
        owner,
        repo,
        ref: commitSha,
      });

      app.log.info(`Commit ${commitSha} details:`);
      app.log.info(`Total files changed: ${commitDetails.files?.length || 0}`);

      // Log details of each changed file
      commitDetails.files?.forEach((file: CommitFile, index: number) => {
        app.log.info(`File #${index + 1}: ${file.filename}`);
        app.log.info(`Status: ${file.status}`); // added, modified, removed
        app.log.info(`Changes: +${file.additions} -${file.deletions}`);

        // Log a sample of the patch if it exists
        if (file.patch) {
          app.log.info(`Patch preview: ${file.patch.substring(0, 200)}${file.patch.length > 200 ? '...' : ''}`);
        }
      });

      return commitDetails;
    } catch (error) {
      app.log.error(`Error fetching commit details: ${error}`);
      return null;
    }
  }

  app.on("pull_request.synchronize", async (context) => {
    app.log.info("Received pull_request.synchronize event");

    // Extract basic PR information
    const repo = context.payload.repository.full_name;
    const prNumber = context.payload.pull_request.number;
    const headSha = context.payload.pull_request.head.sha;
    const beforeSha = context.payload.before;
    const afterSha = context.payload.after;

    app.log.info(`PR #${prNumber} in ${repo} was synchronized`);
    app.log.info(`Head commit: ${headSha}`);
    app.log.info(`Changed from ${beforeSha} to ${afterSha}`);

    try {
      // Fetch commits in this PR
      const { data: commits } = await context.octokit.pulls.listCommits({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        pull_number: prNumber,
      });

      app.log.info(`Found ${commits.length} commits in this PR`);

      // Process each commit
      for (const commit of commits) {
        app.log.info(`Commit: ${commit.sha}`);
        app.log.info(`Author: ${commit.commit.author?.name || 'Unknown'} <${commit.commit.author?.email || 'No email'}>`);
        app.log.info(`Message: ${commit.commit.message || 'No message'}`);

        // Get detailed changes for this commit
        await getCommitDetails(
          context,
          context.payload.repository.owner.login,
          context.payload.repository.name,
          commit.sha
        );
      }

      // Get detailed difference between the base and head
      app.log.info(`Getting diff between ${beforeSha} and ${afterSha}`);
      const { data: comparison } = await context.octokit.repos.compareCommits({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        base: beforeSha,
        head: afterSha,
      });

      app.log.info(`Comparison status: ${comparison.status}`);
      app.log.info(`Total commits in diff: ${comparison.total_commits}`);
      app.log.info(`Files changed: ${comparison.files?.length || 0}`);

    } catch (error) {
      app.log.error(`Error fetching commit data: ${error}`);
    }
  });

  // Handle individual commit push events to get detailed changes
  app.on("push", async (context) => {
    const commits = context.payload.commits;
    const repository = context.payload.repository;

    app.log.info(`Received push with ${commits.length} commits`);

    for (const commit of commits) {
      app.log.info(`Processing commit: ${commit.id}`);
      app.log.info(`Commit message: ${commit.message}`);

      // Get owner login safely
      const ownerLogin = repository.owner.login || repository.owner.name || '';
      if (!ownerLogin) {
        app.log.error('Could not determine repository owner');
        continue;
      }

      // Get detailed changes for this commit
      await getCommitDetails(
        context,
        ownerLogin,
        repository.name,
        commit.id
      );
    }
  });
};

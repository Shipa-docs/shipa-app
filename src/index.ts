import type { Probot } from "probot";
import { getCommitDetails, getFileContent, getCommitsInPR, compareCommits } from "./services/github.js";
import { createDocumentationSuggestions } from "./ai/suggestions.js";
import type { CommitFile } from "./types/index.js";

/**
 * Main application entry point
 */
export default (app: Probot) => {
  app.log.info("Starting the bot...");

  // Simplified logging of events
  app.onAny(async (context) => {
    app.log.info(`Received event: ${context.name}`);
  });

  // Handle pull request synchronize events
  app.on("pull_request.synchronize", async (context) => {
    app.log.info("Received pull_request.synchronize event");

    // Extract basic PR information
    const repo = context.payload.repository;
    const prNumber = context.payload.pull_request.number;
    const beforeSha = context.payload.before;
    const afterSha = context.payload.after;
    const owner = repo.owner.login;

    app.log.info(`PR #${prNumber} in ${repo.full_name} was synchronized`);
    app.log.info(`Changed from ${beforeSha} to ${afterSha}`);

    try {
      // Fetch commits in this PR
      const commits = await getCommitsInPR(
        context,
        owner,
        repo.name,
        prNumber,
        app.log
      );

      // Process each commit
      for (const commit of commits) {
        app.log.info(`Processing commit: ${commit.sha}`);
        app.log.info(`Author: ${commit.commit.author?.name || 'Unknown'}`);
        app.log.info(`Message: ${commit.commit.message || 'No message'}`);

        // Get detailed changes for this commit
        const commitDetails = await getCommitDetails(
          context,
          owner,
          repo.name,
          commit.sha,
          app.log
        );

        // Create suggestions for each modified file
        if (commitDetails?.files) {
          for (const file of commitDetails.files as CommitFile[]) {
            if (file.patch) {
              await createDocumentationSuggestions(
                context,
                owner,
                repo.name,
                prNumber,
                commit.sha,
                file.filename,
                file.patch,
                app.log
              );
            }
          }
        }
      }

      // Compare base and head commits
      await compareCommits(
        context,
        owner,
        repo.name,
        beforeSha,
        afterSha,
        app.log
      );
    } catch (error) {
      app.log.error(`Error processing PR synchronize event: ${error}`);
    }
  });

  // Handle push events to get detailed changes
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
      const commitDetails = await getCommitDetails(
        context,
        ownerLogin,
        repository.name,
        commit.id,
        app.log
      );

      // Process files if available
      if (commitDetails?.files) {
        for (const file of commitDetails.files as CommitFile[]) {
          if (file.status !== 'removed' && file.filename) {
            await getFileContent(
              context,
              ownerLogin,
              repository.name,
              commit.id,
              file.filename,
              app.log
            );
          }
        }
      }
    }
  });
};

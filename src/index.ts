import type { Probot } from "probot";
import { getCommitDetails, getCommitsInPR, compareCommits } from "./services/github.js";
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

      // Process only the last commit instead of all commits
      if (commits.length > 0) {
        const lastCommit = commits[commits.length - 1];

        app.log.info(`Processing only the last commit: ${lastCommit.sha}`);
        app.log.info(`Author: ${lastCommit.commit.author?.name || 'Unknown'}`);
        app.log.info(`Message: ${lastCommit.commit.message || 'No message'}`);

        // Get detailed changes for this commit
        const commitDetails = await getCommitDetails(
          context,
          owner,
          repo.name,
          lastCommit.sha,
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
                lastCommit.sha,
                file.filename,
                file.patch,
                app.log
              );
            }
          }
        }
      } else {
        app.log.info("No commits found in this PR");
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
};

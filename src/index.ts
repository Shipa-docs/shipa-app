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
      // Solo obtenemos y procesamos el último commit
      app.log.info(`Processing only the last commit: ${afterSha}`);

      // Compare just the last commit
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

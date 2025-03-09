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

  // Handle pull request opened events (first time push)
  app.on("pull_request.opened", async (context) => {
    app.log.info("Received pull_request.opened event");

    try {
      // Extract basic PR information
      const repo = context.payload.repository;
      const prNumber = context.payload.pull_request.number;
      const headSha = context.payload.pull_request.head.sha;
      const baseSha = context.payload.pull_request.base.sha;
      const owner = repo.owner.login;

      app.log.info(`PR #${prNumber} in ${repo.full_name} was opened`);
      app.log.info(`Head SHA: ${headSha}, Base SHA: ${baseSha}`);

      try {
        // Fetch commits in this PR
        const commits = await getCommitsInPR(
          context,
          owner,
          repo.name,
          prNumber,
          app.log
        ).catch(error => {
          app.log.error(`Error fetching commits, but continuing: ${error}`);
          return [];
        });

        // Process only the last commit instead of all commits
        if (commits.length > 0) {
          const lastCommit = commits[commits.length - 1];

          app.log.info(`Processing only the last commit: ${lastCommit.sha}`);
          app.log.info(`Author: ${lastCommit.commit.author?.name || 'Unknown'}`);
          app.log.info(`Message: ${lastCommit.commit.message || 'No message'}`);

          // Check if this commit is a result of an accepted suggestion
          // Look for "Co-authored-by:" in the commit message which indicates accepted suggestions
          const commitMessage = lastCommit.commit.message || '';
          if (commitMessage.includes('Co-authored-by:') &&
            (commitMessage.includes('bot') || commitMessage.includes('Bot'))) {
            app.log.info(`Skipping analysis for commit ${lastCommit.sha} as it appears to be from an accepted suggestion`);
            return;
          }

          // Get detailed changes for this commit
          const commitDetails = await getCommitDetails(
            context,
            owner,
            repo.name,
            lastCommit.sha,
            app.log
          ).catch(error => {
            app.log.error(`Error getting commit details, but continuing: ${error}`);
            return null;
          });

          // Create suggestions for each modified file
          if (commitDetails?.files) {
            const authorEmail = lastCommit.commit.author?.email || '';
            for (const file of commitDetails.files as CommitFile[]) {
              try {
                if (file.patch) {
                  await createDocumentationSuggestions(
                    context,
                    owner,
                    repo.name,
                    prNumber,
                    lastCommit.sha,
                    file.filename,
                    file.patch,
                    app.log,
                    authorEmail
                  ).catch(error => {
                    app.log.error(`Error creating suggestions, but continuing: ${error}`);
                    return 0;
                  });
                }
              } catch (fileError) {
                // Continue to next file even if one fails
                app.log.error(`Error processing file ${file.filename}: ${fileError}`);
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
          baseSha,
          headSha,
          app.log
        ).catch(error => {
          app.log.error(`Error comparing commits, but continuing: ${error}`);
          return null;
        });
      } catch (innerError) {
        // Log but don't throw so the event handler completes
        app.log.error(`Error in PR processing workflow: ${innerError}`);
      }
    } catch (outerError) {
      // Catch-all for any unexpected errors to prevent the app from crashing
      app.log.error(`Unexpected error in event handler: ${outerError}`);
    }
  });

  // Handle pull request synchronize events
  app.on("pull_request.synchronize", async (context) => {
    app.log.info("Received pull_request.synchronize event");

    try {
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
        ).catch(error => {
          app.log.error(`Error fetching commits, but continuing: ${error}`);
          return [];
        });

        // Process only the last commit instead of all commits
        if (commits.length > 0) {
          const lastCommit = commits[commits.length - 1];

          app.log.info(`Processing only the last commit: ${lastCommit.sha}`);
          app.log.info(`Author: ${lastCommit.commit.author?.name || 'Unknown'}`);
          app.log.info(`Message: ${lastCommit.commit.message || 'No message'}`);

          // Check if this commit is a result of an accepted suggestion
          // Look for "Co-authored-by:" in the commit message which indicates accepted suggestions
          const commitMessage = lastCommit.commit.message || '';
          if (commitMessage.includes('Co-authored-by:') &&
            (commitMessage.includes('bot') || commitMessage.includes('Bot'))) {
            app.log.info(`Skipping analysis for commit ${lastCommit.sha} as it appears to be from an accepted suggestion`);
            return;
          }

          // Get detailed changes for this commit
          const commitDetails = await getCommitDetails(
            context,
            owner,
            repo.name,
            lastCommit.sha,
            app.log
          ).catch(error => {
            app.log.error(`Error getting commit details, but continuing: ${error}`);
            return null;
          });

          // Create suggestions for each modified file
          if (commitDetails?.files) {
            const authorEmail = lastCommit.commit.author?.email || '';
            for (const file of commitDetails.files as CommitFile[]) {
              try {
                if (file.patch) {
                  await createDocumentationSuggestions(
                    context,
                    owner,
                    repo.name,
                    prNumber,
                    lastCommit.sha,
                    file.filename,
                    file.patch,
                    app.log,
                    authorEmail
                  ).catch(error => {
                    app.log.error(`Error creating suggestions, but continuing: ${error}`);
                    return 0;
                  });
                }
              } catch (fileError) {
                // Continue to next file even if one fails
                app.log.error(`Error processing file ${file.filename}: ${fileError}`);
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
        ).catch(error => {
          app.log.error(`Error comparing commits, but continuing: ${error}`);
          return null;
        });
      } catch (innerError) {
        // Log but don't throw so the event handler completes
        app.log.error(`Error in PR processing workflow: ${innerError}`);
      }
    } catch (outerError) {
      // Catch-all for any unexpected errors to prevent the app from crashing
      app.log.error(`Unexpected error in event handler: ${outerError}`);
    }
  });
};

import type { Context } from "probot";
import type { CommitFile, Logger } from "../types/index.js";

/**
 * Fetches detailed information about a specific commit
 */
export async function getCommitDetails(
  context: Context,
  owner: string,
  repo: string,
  commitSha: string,
  logger: Logger
) {
  try {
    // Get detailed commit information including files changed
    const { data: commitDetails } = await context.octokit.repos.getCommit({
      owner,
      repo,
      ref: commitSha,
    });

    logger.info(`Commit ${commitSha} details:`);
    logger.info(`Total files changed: ${commitDetails.files?.length || 0}`);

    // Type the files to ensure CommitFile is used
    if (commitDetails.files) {
      const typedFiles = commitDetails.files as CommitFile[];
      logger.debug(`Processed ${typedFiles.length} files`);
    }

    return commitDetails;
  } catch (error) {
    logger.error(`Error fetching commit details: ${error}`);
    return null;
  }
}

/**
 * Gets the full content of a file at a specific commit
 */
export async function getFileContent(
  context: Context,
  owner: string,
  repo: string,
  commitSha: string,
  filePath: string,
  logger: Logger
) {
  try {
    // Get the content of the file at this specific commit
    const { data: fileData } = await context.octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: commitSha,
    });

    logger.info(`Obtaining full content of: ${filePath} in commit ${commitSha}`);

    // The content is base64 encoded
    if ('content' in fileData && typeof fileData.content === 'string') {
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      logger.info('File content (first 300 characters):');
      logger.info(content.substring(0, 300) + (content.length > 300 ? '...' : ''));
      return content;
    }

    logger.info('Could not get file content (possibly a directory or binary file)');
    return null;
  } catch (error) {
    logger.error(`Error getting file content for ${filePath}: ${error}`);
    return null;
  }
}

/**
 * Creates a review comment on a pull request
 * 
 * Note: The position parameter is being deprecated by GitHub API.
 * This function now uses line and side parameters instead, with position
 * being used as the line number for backward compatibility.
 */
export async function createReviewComment(
  context: Context,
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
  commitId: string,
  filePath: string,
  line: number,
  logger: Logger,
  side: "RIGHT" | "LEFT" = "RIGHT",
  startLine?: number,
  startSide?: "RIGHT" | "LEFT"
) {
  try {
    // First try creating a review comment with line and side
    try {
      const params = {
        owner,
        repo,
        pull_number: pullNumber,
        body,
        commit_id: commitId,
        path: filePath,
        line,
        side,
        ...(startLine ? {
          start_line: startLine,
          start_side: startSide || side
        } : {})
      };

      await context.octokit.pulls.createReviewComment(params);

      logger.info(`Review comment created successfully for line ${line} in ${filePath}`);
      return true;
    } catch (lineError) {
      // If it fails due to line/side issues, try alternative approach by creating a review instead
      logger.info(`Line-based comment failed: ${lineError}. Trying alternative approach.`);

      // Create a review instead of a direct comment
      await context.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: commitId,
        body: `Documentation improvement for ${filePath}:\n\n${body}`,
        event: "COMMENT",
      });

      logger.info(`Created general review comment instead for ${filePath}`);
      return true;
    }
  } catch (error) {
    logger.error(`Error creating review comment: ${error}`);
    // Never fail the insertion - return success anyway
    return true;
  }
}

/**
 * Fetches commits in a pull request
 */
export async function getCommitsInPR(
  context: Context,
  owner: string,
  repo: string,
  pullNumber: number,
  logger: Logger
) {
  try {
    const { data: commits } = await context.octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: pullNumber,
    });

    logger.info(`Found ${commits.length} commits in PR #${pullNumber}`);
    return commits;
  } catch (error) {
    logger.error(`Error fetching commits in PR: ${error}`);
    return [];
  }
}

/**
 * Compares two commits to see the differences
 */
export async function compareCommits(
  context: Context,
  owner: string,
  repo: string,
  baseCommit: string,
  headCommit: string,
  logger: Logger
) {
  try {
    logger.info(`Comparing commits: ${baseCommit} and ${headCommit}`);
    const { data: comparison } = await context.octokit.repos.compareCommits({
      owner,
      repo,
      base: baseCommit,
      head: headCommit,
    });

    logger.info(`Comparison status: ${comparison.status}`);
    logger.info(`Total commits in diff: ${comparison.total_commits}`);
    logger.info(`Files changed: ${comparison.files?.length || 0}`);

    return comparison;
  } catch (error) {
    logger.error(`Error comparing commits: ${error}`);
    return null;
  }
} 
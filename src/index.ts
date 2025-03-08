import type { Probot } from "probot";

export default (app: Probot) => {
  app.on("issues.opened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    await context.octokit.issues.createComment(issueComment);
  });

  app.on("pull_request.opened", async (context) => {
    const pr = context.payload.pull_request;
    const repo = context.repo();
    const { data: commits } = await context.octokit.pulls.listCommits({
      ...repo,
      pull_number: pr.number,
    });
    const latestCommit = commits[commits.length - 1];
    const comment = context.issue({
      body: `New commit detected!
**Commit:** ${latestCommit.sha.substring(0, 7)}
**Author:** ${latestCommit.commit.author?.name || 'Unknown'}
**Message:** ${latestCommit.commit.message}`
    });
    await context.octokit.issues.createComment(comment);
  });

  app.on("pull_request.synchronize", async (context) => {
    // Get the PR information
    const pr = context.payload.pull_request;
    const repo = context.repo();

    // Get the latest commit
    const { data: commits } = await context.octokit.pulls.listCommits({
      ...repo,
      pull_number: pr.number,
    });

    // The latest commit is the last one in the array
    const latestCommit = commits[commits.length - 1];

    // Create a comment with the commit information
    const comment = context.issue({
      body: `New commit detected!

**Commit:** ${latestCommit.sha.substring(0, 7)}
**Author:** ${latestCommit.commit.author?.name || 'Unknown'}
**Message:** ${latestCommit.commit.message}`
    });

    await context.octokit.issues.createComment(comment);
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};

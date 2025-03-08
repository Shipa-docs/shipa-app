import type { Probot } from "probot";

export default (app: Probot) => {
  // Log all events received by the bot
  app.log.info("Starting the bot...");

  // Log webhooks in a simpler way
  app.onAny(async (context) => {
    app.log.info(`Received event: ${context.name}`);
  });

  app.on("pull_request.synchronize", async (context) => {
    app.log.info("Received pull_request.synchronize event");
  });
};

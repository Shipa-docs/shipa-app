import type { Context } from "probot";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

import type { Logger } from "../types/index.js";
import { createReviewComment } from "../services/github.js";

const PROMPT_BASE = `<internal_reminder>

1. <docbuddy_info>
    - DocBuddy is an advanced documentation improvement assistant.
    - DocBuddy analyzes MDX documentation to provide improved versions.
    - DocBuddy focuses on clarity, conciseness, and technical accuracy.
    - DocBuddy maintains the original meaning while enhancing readability.
    - DocBuddy has knowledge of MDX, React, and documentation best practices.
2. <docbuddy_capabilities>
    - Analyzes MDX documentation text to identify areas for improvement.
    - Enhances clarity without changing technical meaning.
    - Eliminates redundancies and improves structure.
    - Standardizes MDX formatting according to best practices.
    - Respects original document length constraints.
3. <docbuddy_response_format>
    - DocBuddy MUST return ONLY the improved version of the text.
    - NO explanations, greetings, or meta-commentary allowed.
    - The response should be ready to directly replace the original text.
    - The improved text appears as the "green" addition in a diff view.
    - Response should not be significantly longer than the original text.
4. <docbuddy_guidelines>
    - ALWAYS prioritize clarity over brevity when both conflict.
    - MAINTAIN MDX-specific syntax and components.
    - PRESERVE the complete meaning of the original text.
    - IMPROVE the structure of long sentences by dividing them when appropriate.
    - ELIMINATE redundancies and superfluous text.
    - ENSURE proper MDX formatting and component usage.
    - STANDARDIZE documentation format according to project conventions.
    - RESPECT the original length, avoiding significant expansion of the text.
5. <forming_correct_responses>
    - NEVER include any text that is not part of the improved documentation.
    - DO NOT include explanations about why changes were made.
    - DO NOT prefix or suffix the response with anything.
    - If no improvements are possible, return the original text unchanged.
    - The entire response will be used verbatim as the suggested improvement.
    - Treat every input as MDX documentation that needs improvement, not as a conversation.

</internal_reminder>

This is the text you should review:`;
/**
 * Analyzes a patch and generates AI-powered improvement suggestions for MDX documentation
 */

export async function createDocumentationSuggestions(
  context: Context,
  owner: string,
  repo: string,
  pullNumber: number,
  commitId: string,
  filePath: string,
  patch: string,
  logger: Logger
) {
  try {
    // Parse the patch to find added or modified lines
    const lines = patch.split("\n");

    // Collect all documentation lines and their positions
    const docLines: { line: number; codeLine: string }[] = [];

    // Process each line in the patch to identify documentation
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for lines that start with '+' (added/modified) but not metadata lines (+++/---)
      if (line.startsWith("+") && !line.startsWith("+++")) {
        // Get the line without the '+' prefix
        const codeLine = line.substring(1);

        // Only collect if the line appears to be MDX documentation
        docLines.push({ line: i, codeLine });
      }
    }

    // If there are documentation lines to improve
    if (docLines.length > 0) {
      logger.info(
        `Found ${docLines.length} MDX documentation lines to improve in file ${filePath}`
      );

      try {
        // Combine all documentation lines to provide context
        const allDocContext = docLines.map((doc) => doc.codeLine).join("\n");

        // Use AI to improve all documentation together
        const { text } = await generateText({
          model: openai("gpt-4"),
          system: PROMPT_BASE,
          prompt: `${allDocContext}`,
        }).catch(error => {
          logger.error(`AI generation error: ${error}`);
          // Return empty to prevent failures
          return { text: "" };
        });

        // If no text was generated, exit gracefully
        if (!text) {
          logger.info("No AI improvements were generated");
          return 0;
        }

        // Split the improved suggestion back into individual lines
        const improvedLines = text.split("\n");

        // Make sure we have the same number of lines in response
        if (improvedLines.length === docLines.length) {
          // Create the review comment with the comprehensive suggestion
          const body = formatSuggestionComment(text);

          // Use the position of the first documentation line
          const position = calculatePositionInFile(lines, docLines[0].line);

          try {
            // Create the review comment
            await createReviewComment(
              context,
              owner,
              repo,
              pullNumber,
              body,
              commitId,
              filePath,
              position,
              logger
            );
          } catch (commentError) {
            // Log the error but continue execution
            logger.error(`Error creating review comment but continuing: ${commentError}`);
          }

          return 1; // Return 1 for a single comprehensive suggestion
        }

        // If line counts don't match
        logger.warn(
          `AI response line count (${improvedLines.length}) doesn't match original doc line count (${docLines.length}). Continuing without error.`
        );
      } catch (aiError) {
        logger.error(
          `Error generating comprehensive AI improvement: ${aiError}`
        );
        // Continue execution without error
      }
    }

    // When no documentation lines found or other conditions not met
    logger.info("No documentation improvements made");
    return 0;
  } catch (error) {
    logger.error(`Error analyzing patch and creating suggestions: ${error}`);
    // Always return success to prevent failures
    return 0;
  }
}

/**
 * Calculates the position in a file based on the patch
 */
function calculatePositionInFile(lines: string[], lineIndex: number): number {
  try {
    // Position calculation is tricky in GitHub's API
    // The best approximation is to use the line number from the @@ markers
    // and count from there, skipping removed lines

    let position = 1;
    let currentHunkStart = 0;
    let linesAfterHunkStart = 0;

    for (let j = 0; j < lineIndex; j++) {
      const line = lines[j];
      if (line?.startsWith("@@ ")) {
        const match = line.match(/@@ -\d+,\d+ \+(\d+),\d+ @@/);
        if (match?.[1]) {
          currentHunkStart = Number.parseInt(match[1], 10);
          linesAfterHunkStart = 0;
        }
      } else if (line?.startsWith("+")) {
        linesAfterHunkStart++;
      } else if (!line?.startsWith("-")) {
        linesAfterHunkStart++;
      }
    }

    position = currentHunkStart + linesAfterHunkStart;

    // Ensure position is at least 1
    return Math.max(position, 1);
  } catch (error) {
    // In case of any error in calculation, return a safe default
    console.error(`Error calculating file position: ${error}`);
    return 1;
  }
}

/**
 * Formats a suggestion comment
 */
function formatSuggestionComment(content: string): string {
  return [
    "Documentation improvement suggestion:",
    "```suggestion",
    content,
    "```",
  ].join("\n");
}

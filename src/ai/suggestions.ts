import type { Context } from "probot";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { DocSuggestion, Logger } from "../types/index.js";
import { createReviewComment } from "../services/github.js";

const PROMPT_BASE = `<internal_reminder>

1. <docbuddy_info>
    - DocBuddy is an advanced documentation improvement assistant.
    - DocBuddy analyzes code documentation to provide improved versions.
    - DocBuddy focuses on clarity, conciseness, and technical accuracy.
    - DocBuddy maintains the original meaning while enhancing readability.
    - DocBuddy has knowledge of various programming languages, frameworks, and documentation standards.
2. <docbuddy_capabilities>
    - Analyzes documentation text to identify areas for improvement.
    - Enhances clarity without changing technical meaning.
    - Eliminates redundancies and improves structure.
    - Standardizes formatting according to best practices.
    - Respects original document length constraints.
3. <docbuddy_response_format>
    - DocBuddy MUST return ONLY the improved version of the text.
    - NO explanations, greetings, or meta-commentary allowed.
    - The response should be ready to directly replace the original text.
    - The improved text appears as the "green" addition in a diff view.
    - Response should not be significantly longer than the original text.
4. <docbuddy_guidelines>
    - ALWAYS prioritize clarity over brevity when both conflict.
    - MAINTAIN domain-specific technical terminology.
    - PRESERVE the complete meaning of the original text.
    - IMPROVE the structure of long sentences by dividing them when appropriate.
    - ELIMINATE redundancies and superfluous text.
    - ENSURE parameters, return values, and exceptions are fully documented when present.
    - STANDARDIZE documentation format according to project conventions.
    - RESPECT the original length, avoiding significant expansion of the text.
5. <forming_correct_responses>
    - NEVER include any text that is not part of the improved documentation.
    - DO NOT include explanations about why changes were made.
    - DO NOT prefix or suffix the response with anything.
    - If no improvements are possible, return the original text unchanged.
    - The entire response will be used verbatim as the suggested improvement.
    - Treat every input as documentation that needs improvement, not as a conversation.

</internal_reminder>

This is the text you should review:`;
/**
 * Analyzes a patch and generates AI-powered improvement suggestions for documentation
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
    const suggestions: DocSuggestion[] = [];

    // Process each line in the patch
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for lines that start with '+' (added/modified) but not metadata lines (+++/---)
      if (line.startsWith("+") && !line.startsWith("+++")) {
        // Get the line without the '+' prefix
        const codeLine = line.substring(1);

        // Only process if the line appears to be documentation (comments or markdown)
        if (isDocumentation(codeLine)) {
          try {
            // Use AI to improve the documentation
            const { text } = await generateText({
              model: openai("gpt-4"),
              system: PROMPT_BASE,
              prompt: `${codeLine}`,
            });

            // Create the suggestion with the AI improvement
            suggestions.push({
              line: i,
              content: text,
              originalLine: codeLine,
            });
          } catch (aiError) {
            logger.error(`Error generating AI improvement: ${aiError}`);
          }
        }
      }
    }

    // If there are suggestions to make
    if (suggestions.length > 0) {
      logger.info(
        `Creating ${suggestions.length} documentation improvement suggestions for file ${filePath}`
      );

      // For each suggestion, create a comment in the PR review
      for (const suggestion of suggestions) {
        // Determine the position in the file
        const position = calculatePositionInFile(lines, suggestion.line);

        // Create the comment body with the suggestion
        const body = formatSuggestionComment(suggestion.content);

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
      }

      return suggestions.length;
    }

    return 0;
  } catch (error) {
    logger.error(`Error analyzing patch and creating suggestions: ${error}`);
    return 0;
  }
}

/**
 * Determines if a line is documentation
 */
function isDocumentation(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("#")
  );
}

/**
 * Calculates the position in a file based on the patch
 */
function calculatePositionInFile(lines: string[], lineIndex: number): number {
  let position = 1;

  for (let j = 0; j <= lineIndex; j++) {
    if (lines[j]?.startsWith("@@ ")) {
      const match = lines[j].match(/@@ -\d+,\d+ \+(\d+),\d+ @@/);
      if (match?.[1]) {
        position = Number.parseInt(match[1], 10) - 1;
      }
    } else if (!lines[j]?.startsWith("-")) {
      position++;
    }
  }

  return position;
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

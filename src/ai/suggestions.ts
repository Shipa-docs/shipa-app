import type { Context } from "probot";
import { generateText } from "ai";
//import {ollama} from "ollama-ai-provider";
import { openai } from "@ai-sdk/openai";

import type { DocSuggestion, Logger } from "../types/index.js";
import { createReviewComment } from "../services/github.js";

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
    const lines = patch.split('\n');
    const suggestions: DocSuggestion[] = [];
    console.log({
      lines,
      patch
    });
    return 0;
    // Process each line in the patch
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for lines that start with '+' (added/modified) but not metadata lines (+++/---)
      if (line.startsWith('+') && !line.startsWith('+++')) {
        // Get the line without the '+' prefix
        const codeLine = line.substring(1);

        // Only process if the line appears to be documentation (comments or markdown)
        if (isDocumentation(codeLine)) {
          try {
            // Use AI to improve the documentation
            const { text } = await generateText({
              model: openai("gpt-4o-mini"),
              
              prompt: `improve this docs changes: ${codeLine}`
            });

            // Create the suggestion with the AI improvement
            suggestions.push({
              line: i,
              content: text,
              originalLine: codeLine
            });
          } catch (aiError) {
            logger.error(`Error generating AI improvement: ${aiError}`);
          }
        }
      }
    }

    // If there are suggestions to make
    if (suggestions.length > 0) {
      logger.info(`Creating ${suggestions.length} documentation improvement suggestions for file ${filePath}`);

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
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('#')
  );
}

/**
 * Calculates the position in a file based on the patch
 */
function calculatePositionInFile(lines: string[], lineIndex: number): number {
  let position = 1;

  for (let j = 0; j <= lineIndex; j++) {
    if (lines[j]?.startsWith('@@ ')) {
      const match = lines[j].match(/@@ -\d+,\d+ \+(\d+),\d+ @@/);
      if (match?.[1]) {
        position = Number.parseInt(match[1], 10) - 1;
      }
    } else if (!lines[j]?.startsWith('-')) {
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
    'Documentation improvement suggestion:',
    '```suggestion',
    content,
    '```'
  ].join('\n');
} 
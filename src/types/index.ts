/**
 * Types and interfaces for the application
 */

/**
 * Represents a file changed in a commit
 */
export interface CommitFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

/**
 * Suggestion data for documentation improvements
 */
export interface DocSuggestion {
  line: number;
  content: string;
  originalLine: string;
}

/**
 * Type for the app logger
 */
export type Logger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
  debug: (message: string) => void;
} 
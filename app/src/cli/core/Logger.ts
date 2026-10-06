/**
 * Logger - Implementation of ILogger for CLI output
 *
 * Provides:
 * - ConsoleLogger: Standard console output, with ANSI colors where the stream supports them
 * - SilentLogger: No output (for testing)
 *
 * Colors match the existing MCT CLI styling. streamHasColors() decides where they're written, so
 * piped and captured output stays plain text.
 */

import { ILogger } from "./ICommandContext";

// ANSI color codes (matching existing index.ts style)
const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

/** The parts of an output stream that streamHasColors() reads. */
export interface IColorStream {
  isTTY?: boolean;
  hasColors?(): boolean;
}

/**
 * Whether the CLI may write ANSI color codes to `stream`. This is the policy Commander applies to
 * help output, so help and the rest of the CLI agree: NO_COLOR, FORCE_COLOR=0, or FORCE_COLOR=false
 * turns color off; FORCE_COLOR or CLICOLOR_FORCE turns it on; otherwise only a terminal that
 * supports color gets it. Pipes, files, and captured output get plain text.
 */
export function streamHasColors(stream: IColorStream, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NO_COLOR || env.FORCE_COLOR === "0" || env.FORCE_COLOR === "false") {
    return false;
  }

  if (env.FORCE_COLOR || env.CLICOLOR_FORCE !== undefined) {
    return true;
  }

  return stream.isTTY === true && stream.hasColors?.() === true;
}

/** Returns `codes` when the CLI may color `stream` (see streamHasColors), or the same keys set to "". */
export function colorCodesFor<T extends Record<string, string>>(stream: IColorStream, codes: T): T {
  if (streamHasColors(stream)) {
    return codes;
  }

  return Object.fromEntries(Object.keys(codes).map((name) => [name, ""])) as T;
}

/**
 * ConsoleLogger outputs to the console, with ANSI colors on streams that support them.
 */
export class ConsoleLogger implements ILogger {
  private verboseEnabled: boolean;
  private quietEnabled: boolean;
  private debugEnabled: boolean;
  private jsonMode: boolean;
  private stdoutColors: boolean;
  private stderrColors: boolean;

  constructor(verbose = false, quiet = false, debug = false, jsonMode = false) {
    this.verboseEnabled = verbose;
    this.quietEnabled = quiet;
    this.debugEnabled = debug;
    this.jsonMode = jsonMode;
    this.stdoutColors = streamHasColors(process.stdout);
    this.stderrColors = streamHasColors(process.stderr);
  }

  /** Wraps `message` in `color` when the stream it's written to supports color. */
  private paint(color: string, message: string, toStderr: boolean): string {
    return (toStderr ? this.stderrColors : this.stdoutColors) ? `${color}${message}${RESET}` : message;
  }

  info(message: string): void {
    if (!this.quietEnabled) {
      // In JSON mode, non-data output goes to stderr to keep stdout clean for JSON
      if (this.jsonMode) {
        console.error(message);
      } else {
        console.log(message);
      }
    }
  }

  warn(message: string): void {
    // In quiet mode, suppress warnings (important for --warn-only -q which
    // downgrades errors to warnings and expects them to be silenced).
    if (this.quietEnabled) return;
    // In JSON mode, non-data output goes to stderr to keep stdout clean for JSON
    if (this.jsonMode) {
      console.error(this.paint(YELLOW, `Warning: ${message}`, true));
    } else {
      console.log(this.paint(YELLOW, `Warning: ${message}`, false));
    }
  }

  error(message: string): void {
    // Errors always show, even in quiet mode
    console.error(this.paint(RED, `Error: ${message}`, true));
  }

  verbose(message: string): void {
    if (this.verboseEnabled) {
      // In JSON mode, non-data output goes to stderr to keep stdout clean for JSON
      if (this.jsonMode) {
        console.error(this.paint(DIM, message, true));
      } else {
        console.log(this.paint(DIM, message, false));
      }
    }
  }

  debug(message: string): void {
    if (this.debugEnabled) {
      // In JSON mode, non-data output goes to stderr to keep stdout clean for JSON
      if (this.jsonMode) {
        console.error(this.paint(MAGENTA, `[DEBUG] ${message}`, true));
      } else {
        console.log(this.paint(MAGENTA, `[DEBUG] ${message}`, false));
      }
    }
  }

  success(message: string): void {
    // In JSON mode, non-data output goes to stderr to keep stdout clean for JSON
    if (this.jsonMode) {
      console.error(this.paint(GREEN, message, true));
    } else {
      console.log(this.paint(GREEN, message, false));
    }
  }

  data(message: string): void {
    // Machine-readable output (e.g., JSON) always goes to stdout, even in quiet mode
    console.log(message);
  }

  progress(current: number, total: number, message?: string): void {
    if (this.quietEnabled || this.jsonMode) {
      return; // Suppress progress in quiet mode and JSON mode
    }
    const percent = Math.round((current / total) * 100);
    const bar = this.createProgressBar(percent);
    const msg = message ? ` ${message}` : "";
    process.stdout.write("\r" + this.paint(CYAN, `${bar} ${current}/${total} (${percent}%)${msg}`, false));

    if (current === total) {
      console.log(); // New line when complete
    }
  }

  private createProgressBar(percent: number): string {
    const width = 20;
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return `[${"=".repeat(filled)}${" ".repeat(empty)}]`;
  }
}

/**
 * SilentLogger produces no output.
 * Useful for testing or when output should be suppressed.
 */
export class SilentLogger implements ILogger {
  info(_message: string): void {}
  warn(_message: string): void {}
  error(_message: string): void {}
  verbose(_message: string): void {}
  debug(_message: string): void {}
  success(_message: string): void {}
  data(_message: string): void {}
  progress(_current: number, _total: number, _message?: string): void {}
}

/**
 * BufferedLogger stores all log messages for later retrieval.
 * Useful for testing or capturing output.
 */
export class BufferedLogger implements ILogger {
  readonly messages: Array<{ level: string; message: string }> = [];

  info(message: string): void {
    this.messages.push({ level: "info", message });
  }

  warn(message: string): void {
    this.messages.push({ level: "warn", message });
  }

  error(message: string): void {
    this.messages.push({ level: "error", message });
  }

  verbose(message: string): void {
    this.messages.push({ level: "verbose", message });
  }

  debug(message: string): void {
    this.messages.push({ level: "debug", message });
  }

  success(message: string): void {
    this.messages.push({ level: "success", message });
  }

  data(message: string): void {
    this.messages.push({ level: "data", message });
  }

  progress(current: number, total: number, message?: string): void {
    this.messages.push({
      level: "progress",
      message: `${current}/${total}${message ? ` ${message}` : ""}`,
    });
  }

  clear(): void {
    this.messages.length = 0;
  }

  getErrors(): string[] {
    return this.messages.filter((m) => m.level === "error").map((m) => m.message);
  }

  getWarnings(): string[] {
    return this.messages.filter((m) => m.level === "warn").map((m) => m.message);
  }
}

/**
 * Create a logger based on options.
 * @param verbose Enable verbose output
 * @param quiet Suppress non-essential output (errors and warnings still shown)
 * @param debug Enable debug output
 * @param silent Completely suppress all output (for testing)
 * @param jsonMode When true, route all non-data output to stderr so stdout contains only machine-readable JSON
 */
export function createLogger(verbose = false, quiet = false, debug = false, silent = false, jsonMode = false): ILogger {
  if (silent) {
    return new SilentLogger();
  }
  return new ConsoleLogger(verbose, quiet, debug, jsonMode);
}

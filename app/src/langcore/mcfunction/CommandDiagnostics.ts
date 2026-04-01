// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CommandDiagnostics - Diagnostics for mcfunction files
 */

import { DiagnosticSeverity, IDiagnostic } from "../json/JsonDiagnostics";
import { commandParser, MINECRAFT_COMMANDS, SELECTOR_TYPES } from "./CommandParser";

/**
 * Generate command diagnostics
 */
export class CommandDiagnosticGenerator {
  /**
   * Analyze a command file and generate diagnostics
   */
  public analyzeFile(content: string): IDiagnostic[] {
    const diagnostics: IDiagnostic[] = [];
    const lines = content.split("\n");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const lineDiagnostics = this.analyzeLine(line, lineNum + 1);
      diagnostics.push(...lineDiagnostics);
    }

    return diagnostics;
  }

  /**
   * Analyze a single command line
   */
  public analyzeLine(line: string, lineNumber: number): IDiagnostic[] {
    const diagnostics: IDiagnostic[] = [];
    const parsed = commandParser.parseLine(line, lineNumber);

    // Skip comments and empty lines
    if (parsed.isComment || parsed.command === "") {
      return diagnostics;
    }

    // Check for unknown command
    const commandInfo = commandParser.getCommandInfo(parsed.command);
    if (!commandInfo) {
      // Check if it might be a typo
      const suggestion = this.findSimilarCommand(parsed.command);

      diagnostics.push({
        startLine: lineNumber,
        startColumn: parsed.hasSlashPrefix ? 2 : 1,
        endLine: lineNumber,
        endColumn: parsed.command.length + (parsed.hasSlashPrefix ? 2 : 1),
        message: suggestion
          ? `Unknown command "${parsed.command}". Did you mean "${suggestion}"?`
          : `Unknown command "${parsed.command}"`,
        severity: DiagnosticSeverity.Error,
        source: "MCTools",
        code: "UNKNOWN_COMMAND",
      });
    }

    // Check selectors
    for (const arg of parsed.arguments) {
      if (arg.selector) {
        const selectorDiagnostics = this.validateSelector(arg.value, lineNumber, arg.start);
        diagnostics.push(...selectorDiagnostics);
      }
    }

    // Command-specific validation
    if (commandInfo) {
      const specificDiagnostics = this.validateCommandArguments(parsed, commandInfo, lineNumber);
      diagnostics.push(...specificDiagnostics);
    }

    return diagnostics;
  }

  /**
   * Validate a selector
   */
  private validateSelector(selectorText: string, lineNumber: number, offset: number): IDiagnostic[] {
    const diagnostics: IDiagnostic[] = [];
    const selector = commandParser.parseSelector(selectorText, offset);

    // Check selector type
    if (!SELECTOR_TYPES[selector.type] && selector.type !== "unknown") {
      diagnostics.push({
        startLine: lineNumber,
        startColumn: offset + 1,
        endLine: lineNumber,
        endColumn: offset + 2 + selector.type.length,
        message: `Unknown selector type "@${selector.type}"`,
        severity: DiagnosticSeverity.Error,
        source: "MCTools",
        code: "UNKNOWN_SELECTOR_TYPE",
      });
    }

    // Check for conflicting arguments
    if (selector.arguments.has("r") && selector.arguments.has("rm")) {
      const r = parseFloat(selector.arguments.get("r")!);
      const rm = parseFloat(selector.arguments.get("rm")!);
      if (!isNaN(r) && !isNaN(rm) && rm > r) {
        diagnostics.push({
          startLine: lineNumber,
          startColumn: offset + 1,
          endLine: lineNumber,
          endColumn: offset + selectorText.length + 1,
          message: `Minimum radius (rm=${rm}) is greater than maximum radius (r=${r})`,
          severity: DiagnosticSeverity.Warning,
          source: "MCTools",
          code: "SELECTOR_RADIUS_CONFLICT",
        });
      }
    }

    // Check for negative count
    if (selector.arguments.has("c")) {
      const c = parseInt(selector.arguments.get("c")!, 10);
      if (!isNaN(c) && c === 0) {
        diagnostics.push({
          startLine: lineNumber,
          startColumn: offset + 1,
          endLine: lineNumber,
          endColumn: offset + selectorText.length + 1,
          message: `Count of 0 will select no entities`,
          severity: DiagnosticSeverity.Warning,
          source: "MCTools",
          code: "SELECTOR_ZERO_COUNT",
        });
      }
    }

    return diagnostics;
  }

  /**
   * Validate command arguments
   */
  private validateCommandArguments(
    parsed: ReturnType<typeof commandParser.parseLine>,
    commandInfo: ReturnType<typeof commandParser.getCommandInfo>,
    lineNumber: number
  ): IDiagnostic[] {
    const diagnostics: IDiagnostic[] = [];

    if (!commandInfo) {
      return diagnostics;
    }

    // Check for minimum required arguments based on command
    switch (commandInfo.name) {
      case "give":
        if (parsed.arguments.length < 2) {
          diagnostics.push({
            startLine: lineNumber,
            startColumn: 1,
            endLine: lineNumber,
            endColumn: parsed.text.length + 1,
            message: `Command "give" requires at least player and item arguments`,
            severity: DiagnosticSeverity.Error,
            source: "MCTools",
            code: "MISSING_ARGUMENTS",
          });
        }
        break;

      case "setblock":
        if (parsed.arguments.length < 4) {
          diagnostics.push({
            startLine: lineNumber,
            startColumn: 1,
            endLine: lineNumber,
            endColumn: parsed.text.length + 1,
            message: `Command "setblock" requires position (x y z) and block arguments`,
            severity: DiagnosticSeverity.Error,
            source: "MCTools",
            code: "MISSING_ARGUMENTS",
          });
        }
        break;

      case "tp":
      case "teleport":
        if (parsed.arguments.length < 1) {
          diagnostics.push({
            startLine: lineNumber,
            startColumn: 1,
            endLine: lineNumber,
            endColumn: parsed.text.length + 1,
            message: `Command "${commandInfo.name}" requires at least a target or destination`,
            severity: DiagnosticSeverity.Error,
            source: "MCTools",
            code: "MISSING_ARGUMENTS",
          });
        }
        break;

      case "function":
        if (parsed.arguments.length < 1) {
          diagnostics.push({
            startLine: lineNumber,
            startColumn: 1,
            endLine: lineNumber,
            endColumn: parsed.text.length + 1,
            message: `Command "function" requires a function name`,
            severity: DiagnosticSeverity.Error,
            source: "MCTools",
            code: "MISSING_ARGUMENTS",
          });
        }
        break;

      case "execute":
        // Check for run subcommand
        if (!parsed.text.includes(" run ")) {
          diagnostics.push({
            startLine: lineNumber,
            startColumn: 1,
            endLine: lineNumber,
            endColumn: parsed.text.length + 1,
            message: `Execute command should end with "run <command>"`,
            severity: DiagnosticSeverity.Warning,
            source: "MCTools",
            code: "EXECUTE_NO_RUN",
          });
        }
        break;
    }

    return diagnostics;
  }

  /**
   * Find a similar command name (for typo suggestions)
   */
  private findSimilarCommand(input: string): string | null {
    const inputLower = input.toLowerCase();
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const cmd of MINECRAFT_COMMANDS) {
      const score = this.similarity(inputLower, cmd.name);
      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = cmd.name;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate string similarity (Dice coefficient)
   */
  private similarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const getBigrams = (s: string): Set<string> => {
      const bigrams = new Set<string>();
      for (let i = 0; i < s.length - 1; i++) {
        bigrams.add(s.substring(i, i + 2));
      }
      return bigrams;
    };

    const aBigrams = getBigrams(a);
    const bBigrams = getBigrams(b);
    let intersection = 0;

    for (const bigram of aBigrams) {
      if (bBigrams.has(bigram)) {
        intersection++;
      }
    }

    return (2.0 * intersection) / (aBigrams.size + bBigrams.size);
  }
}

// Singleton instance
export const commandDiagnosticGenerator = new CommandDiagnosticGenerator();

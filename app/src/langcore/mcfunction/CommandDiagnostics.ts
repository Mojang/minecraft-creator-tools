// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CommandDiagnostics - Diagnostics for mcfunction files
 */

import { DiagnosticSeverity, IDiagnostic } from "../json/JsonDiagnostics";
import { commandParser, MINECRAFT_COMMANDS, SELECTOR_TYPES } from "./CommandParser";
import {
  findExecuteRunTokenIndex,
  getLegacyExecuteCommandIndex,
  isLegacyExecuteSyntax,
  matchCommandOverloads,
  toMatchTokens,
} from "./CommandOverloadMatcher";
import { compareBedrockVersions, findCommand } from "../../knowledge/BedrockKnowledge";

/** First min_engine_version that uses the current "execute <subcommand> ... run" syntax. */
export const EXECUTE_SYNTAX_CHANGE_VERSION = "1.19.50";

/** How many commands deep execute nesting ("execute ... run execute ... run ...") is diagnosed. */
const MAX_NESTED_COMMAND_DEPTH = 16;

export interface ICommandDiagnosticOptions {
  /**
   * The owning pack's header.min_engine_version (e.g. "1.20.0"). When known, version-dependent
   * syntax such as legacy execute is validated precisely instead of reported as a hint.
   */
  minEngineVersion?: string;
}

function usesLegacyExecute(minEngineVersion: string | undefined): boolean | undefined {
  if (!minEngineVersion) return undefined;
  return compareBedrockVersions(minEngineVersion, EXECUTE_SYNTAX_CHANGE_VERSION) < 0;
}

/**
 * Generate command diagnostics
 */
export class CommandDiagnosticGenerator {
  /**
   * Analyze a command file and generate diagnostics
   */
  public analyzeFile(content: string, options: ICommandDiagnosticOptions = {}): IDiagnostic[] {
    const diagnostics: IDiagnostic[] = [];
    const lines = content.split("\n");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const lineDiagnostics = this.analyzeLine(line, lineNum + 1, options);
      diagnostics.push(...lineDiagnostics);
    }

    return diagnostics;
  }

  /**
   * Analyze a single command line
   */
  public analyzeLine(line: string, lineNumber: number, options: ICommandDiagnosticOptions = {}): IDiagnostic[] {
    return this.analyzeLineAtDepth(line, lineNumber, options, 0);
  }

  /** analyzeLine for a command nested `depth` levels deep in execute chains. */
  private analyzeLineAtDepth(
    line: string,
    lineNumber: number,
    options: ICommandDiagnosticOptions,
    depth: number
  ): IDiagnostic[] {
    const diagnostics: IDiagnostic[] = [];
    const parsed = commandParser.parseLine(line, lineNumber);

    // Skip comments and empty lines
    if (parsed.isComment || parsed.command === "") {
      return diagnostics;
    }

    const prefix = parsed.text.length - parsed.text.trimStart().length + (parsed.hasSlashPrefix ? 1 : 0);

    // Check for unknown command
    const commandInfo = commandParser.getCommandInfo(parsed.command);
    if (!commandInfo) {
      // Check if it might be a typo
      const suggestion = this.findSimilarCommand(parsed.command);

      diagnostics.push({
        startLine: lineNumber,
        startColumn: prefix + 1,
        endLine: lineNumber,
        endColumn: prefix + parsed.command.length + 1,
        message: suggestion
          ? `Unknown command "${parsed.command}". Did you mean "${suggestion}"?`
          : `Unknown command "${parsed.command}"`,
        severity: DiagnosticSeverity.Error,
        source: "MCTools",
        code: "UNKNOWN_COMMAND",
      });
    }

    // Check selectors
    // Arguments from the nested execute command on belong to it, and validateNestedCommand checks them.
    const nestedIndex = commandInfo ? this.getNestedCommandArgumentIndex(parsed, commandInfo, options) : -1;
    const ownArguments = nestedIndex >= 0 ? parsed.arguments.slice(0, nestedIndex) : parsed.arguments;
    for (const arg of ownArguments) {
      if (arg.selector) {
        const selectorDiagnostics = this.validateSelector(arg.value, lineNumber, prefix + arg.start);
        diagnostics.push(...selectorDiagnostics);
      }
    }

    // Command-specific validation
    if (commandInfo) {
      const specificDiagnostics = this.validateCommandArguments(parsed, commandInfo, lineNumber, options);
      diagnostics.push(...specificDiagnostics);
      diagnostics.push(...this.validateNestedCommand(parsed, commandInfo, lineNumber, options, depth));
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
    lineNumber: number,
    options: ICommandDiagnosticOptions
  ): IDiagnostic[] {
    const diagnostics: IDiagnostic[] = [];
    const packUsesLegacyExecute = usesLegacyExecute(options.minEngineVersion);

    if (!commandInfo) {
      return diagnostics;
    }

    // Validate arguments against the engine's overloads for this command
    const knowledgeCommand = findCommand(commandInfo.aliasOf ?? commandInfo.name);
    const matchTokens = toMatchTokens(parsed.arguments.map((a) => a.value));
    const argumentTokens = matchTokens.map((t) => t.value);
    const isLegacyExecute =
      !!knowledgeCommand &&
      isLegacyExecuteSyntax(
        knowledgeCommand,
        argumentTokens,
        this.prefersLegacyExecute(knowledgeCommand, argumentTokens, options)
      );

    if (isLegacyExecute) {
      // Legacy syntax is correct for packs that target an engine version before the change.
      if (packUsesLegacyExecute !== true) {
        diagnostics.push({
          startLine: lineNumber,
          startColumn: 1,
          endLine: lineNumber,
          endColumn: parsed.text.length + 1,
          message:
            packUsesLegacyExecute === false
              ? `Legacy execute syntax is not accepted because this pack's min_engine_version is ${options.minEngineVersion} (${EXECUTE_SYNTAX_CHANGE_VERSION} or later). Use "execute as <target> at @s run <command>" instead.`
              : `Legacy execute syntax is only accepted in packs with min_engine_version below ${EXECUTE_SYNTAX_CHANGE_VERSION}. Use "execute as <target> at @s run <command>" instead.`,
          severity: packUsesLegacyExecute === false ? DiagnosticSeverity.Error : DiagnosticSeverity.Information,
          source: "MCTools",
          code: "LEGACY_EXECUTE_SYNTAX",
        });
      }
    } else if (knowledgeCommand) {
      const match = matchCommandOverloads(knowledgeCommand, argumentTokens);
      if (match.problem) {
        const arg = parsed.arguments[matchTokens[match.problem.argumentIndex]?.argumentIndex ?? -1];
        const isMissing = match.problem.kind === "missing" || !arg;
        const prefix = parsed.text.length - parsed.text.trimStart().length + (parsed.hasSlashPrefix ? 1 : 0);
        diagnostics.push({
          startLine: lineNumber,
          startColumn: isMissing ? 1 : prefix + arg.start + 1,
          endLine: lineNumber,
          endColumn: isMissing ? parsed.text.length + 1 : prefix + arg.end + 1,
          message: match.problem.message,
          severity: isMissing ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
          source: "MCTools",
          code: isMissing ? "MISSING_ARGUMENTS" : "INVALID_ARGUMENT",
        });
      } else if (match.matched && knowledgeCommand.name === "execute" && packUsesLegacyExecute) {
        // Only a well-formed modern command gets the version hint; malformed ones keep the argument error.
        diagnostics.push({
          startLine: lineNumber,
          startColumn: 1,
          endLine: lineNumber,
          endColumn: parsed.text.length + 1,
          message: `This execute syntax requires min_engine_version ${EXECUTE_SYNTAX_CHANGE_VERSION} or later, but this pack targets ${options.minEngineVersion}. Raise min_engine_version in the pack manifest or use legacy "execute <target> <position> <command>" syntax.`,
          severity: DiagnosticSeverity.Warning,
          source: "MCTools",
          code: "EXECUTE_REQUIRES_NEWER_ENGINE",
        });
      }
    }

    switch (commandInfo.aliasOf ?? commandInfo.name) {
      case "execute":
        // Check for run subcommand
        // Without "run", an execute chain ending in an if/unless condition is a valid test command.
        if (!isLegacyExecute && !/ run /.test(parsed.text) && !/ (if|unless) /.test(parsed.text)) {
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
   * Validate the command nested in an execute (after "run", or after the position and optional
   * detect clause in legacy syntax), keeping its columns relative to the original line.
   */
  private validateNestedCommand(
    parsed: ReturnType<typeof commandParser.parseLine>,
    commandInfo: NonNullable<ReturnType<typeof commandParser.getCommandInfo>>,
    lineNumber: number,
    options: ICommandDiagnosticOptions,
    depth: number
  ): IDiagnostic[] {
    // Each level re-parses the line, so a generated "execute run execute run ..." chain stops here.
    if (depth >= MAX_NESTED_COMMAND_DEPTH) {
      return [];
    }
    const nestedIndex = this.getNestedCommandArgumentIndex(parsed, commandInfo, options);
    const next = nestedIndex >= 0 ? parsed.arguments[nestedIndex] : undefined;
    if (!next) {
      return [];
    }
    const prefix = parsed.text.length - parsed.text.trimStart().length + (parsed.hasSlashPrefix ? 1 : 0);
    const absoluteStart = prefix + next.start;
    const subLine = " ".repeat(absoluteStart) + parsed.text.substring(absoluteStart);
    return this.analyzeLineAtDepth(subLine, lineNumber, options, depth + 1);
  }

  /**
   * Index of the parsed argument where an execute's nested command starts, or -1. Found from the
   * execute grammar, so arguments whose value is "run" (a player, score holder, or objective)
   * before the delimiter aren't mistaken for it.
   */
  /**
   * Whether a target named like a subcommand ("execute as ~ ~ ~ say hi") should be read as legacy
   * syntax: only in packs before the syntax change, and only when the line isn't valid modern syntax
   * ("execute positioned ~ ~ ~ run say hi" is both shapes and stays modern). The modern "run" overload
   * accepts any text, so a modern match whose nested command isn't a command ("execute run ~ ~ ~ say
   * hi" targets a player named "run") doesn't count as valid modern syntax.
   */
  private prefersLegacyExecute(
    knowledgeCommand: NonNullable<ReturnType<typeof findCommand>>,
    tokens: string[],
    options: ICommandDiagnosticOptions
  ): boolean {
    if (usesLegacyExecute(options.minEngineVersion) !== true) {
      return false;
    }
    if (!matchCommandOverloads(knowledgeCommand, tokens).matched) {
      return true;
    }
    const runToken = findExecuteRunTokenIndex(knowledgeCommand, tokens);
    const nested = runToken >= 0 ? tokens[runToken + 1] : undefined;
    return nested !== undefined && !findCommand(nested.replace(/^\//, "").toLowerCase());
  }

  private getNestedCommandArgumentIndex(
    parsed: ReturnType<typeof commandParser.parseLine>,
    commandInfo: NonNullable<ReturnType<typeof commandParser.getCommandInfo>>,
    options: ICommandDiagnosticOptions
  ): number {
    const knowledgeCommand =
      (commandInfo.aliasOf ?? commandInfo.name) === "execute" ? findCommand("execute") : undefined;
    if (!knowledgeCommand) {
      return -1;
    }
    const matchTokens = toMatchTokens(parsed.arguments.map((a) => a.value));
    const tokens = matchTokens.map((t) => t.value);
    const preferLegacy = this.prefersLegacyExecute(knowledgeCommand, tokens, options);
    const legacyCommandToken = getLegacyExecuteCommandIndex(knowledgeCommand, tokens, preferLegacy);
    if (legacyCommandToken >= 0) {
      return matchTokens[legacyCommandToken].argumentIndex;
    }
    const runToken = findExecuteRunTokenIndex(knowledgeCommand, tokens);
    return runToken >= 0 ? matchTokens[runToken].argumentIndex + 1 : -1;
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

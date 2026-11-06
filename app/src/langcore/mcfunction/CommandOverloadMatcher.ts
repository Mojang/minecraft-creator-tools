// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CommandOverloadMatcher - matches parsed mcfunction arguments against engine-exported overloads.
 *
 * The matcher is deliberately conservative: it only reports problems it can be certain the engine
 * would also reject (missing required arguments, a value that is not in a closed enum, a non-integer
 * where only integers are accepted, or a non-coordinate where a position is required). Parameter types
 * it does not model are treated as wildcards, soft enums (user-defined objectives, tags, ...) accept
 * anything, and namespaced identifiers outside "minecraft:" are accepted wherever vanilla identifiers
 * are, so add-on content never produces false positives.
 *
 * Legacy "execute <target> <position> <command>" syntax is not described by the engine's current
 * overloads; callers should detect it with isLegacyExecuteSyntax() before matching.
 */

import { IKnowledgeCommand, IKnowledgeCommandParam } from "../../knowledge/IBedrockKnowledge";
import {
  getBedrockKnowledge,
  getCommandEnumValues,
  isCommandEnumEmpty,
  isCommandEnumValue,
} from "../../knowledge/BedrockKnowledge";
import { formatOverloadSignature } from "../../knowledge/BedrockKnowledgeDiff";

export type OverloadFailureKind = "missing" | "invalid" | "mismatch" | "extra";

export interface IOverloadFailure {
  kind: OverloadFailureKind;
  /** Number of argument tokens that were successfully consumed before the failure. */
  progress: number;
  /** The parameter that could not be satisfied (undefined for "extra"). */
  param?: IKnowledgeCommandParam;
  /** For "invalid": a human-readable description of what was expected. */
  expected?: string;
}

export interface ICommandMatchResult {
  matched: boolean;
  /**
   * When nothing matched and the failure is unambiguous, the problem to report. Undefined when
   * the arguments matched, or when the failure is not one we can report without risking a false positive.
   */
  problem?: {
    kind: "missing" | "invalid";
    /** Index of the offending argument token ("invalid") or the argument count ("missing"). */
    argumentIndex: number;
    message: string;
  };
}

const REST_CONSUMING_TYPES = new Set([
  "EXECUTECHAINEDOPTION_0",
  "MESSAGE_ROOT",
  "RAWTEXT",
  "CODEBUILDERARGS",
  "JSON_OBJECT",
]);
const POSITION_TYPES = new Set(["POSITION", "POSITION_FLOAT"]);
/**
 * Free-text parameters that the engine accepts empty even though the metadata marks them required,
 * by command name (e.g. "scriptevent ns:id"). Other messages, such as "say" or "tell @s", are required.
 */
const EMPTY_TEXT_PARAMS: Readonly<Record<string, readonly string[]>> = { scriptevent: ["message"] };

/** The overload's parameters, with the command's empty-text exceptions marked optional. */
function getMatchParams(command: IKnowledgeCommand, params: IKnowledgeCommandParam[]): IKnowledgeCommandParam[] {
  const emptyText = EMPTY_TEXT_PARAMS[command.name.toLowerCase()];
  return emptyText ? params.map((p) => (emptyText.includes(p.name) ? { ...p, optional: true } : p)) : params;
}
/**
 * Enums whose exported values are only the vanilla subset of what content can define, and whose
 * custom values are not namespaced (e.g. entity events like "become_hostile" defined by an add-on).
 */
const CONTENT_EXTENSIBLE_ENUMS = new Set(["EntityEvents"]);
/**
 * Soft enums whose values the world defines at runtime (tags, objectives, GameTest names). A snapshot
 * may list observed values, but any other value is still valid, e.g. "tag @s add fresh".
 */
const DYNAMIC_ENUMS = new Set(["TagValues", "ScoreboardObjectives", "GameTestName", "GameTestTag"]);
const INTEGER_PATTERN = /^[+-]?\d+$/;
const COORDINATE_COMPONENT_PATTERN = /[~^](?:[+-]?(?:\d+(?:\.\d*)?|\.\d+))?|[+-]?(?:\d+(?:\.\d*)?|\.\d+)/g;

/**
 * Coordinate components in a token such as "~1~-2~", or undefined when the token isn't made only of
 * components. Packed components must each start with "~" or "^", since that's what separates them
 * ("1-2-3" is one malformed number, not three). Matching components and comparing lengths keeps
 * this linear (a "(component)+" pattern backtracks).
 */
export function getCoordinateComponents(token: string): string[] | undefined {
  const components = token.match(COORDINATE_COMPONENT_PATTERN);
  if (!components || components.join("").length !== token.length) {
    return undefined;
  }
  if (components.length > 1 && components.some((c, i) => i > 0 && c[0] !== "~" && c[0] !== "^")) {
    return undefined;
  }
  return components;
}

type PositionRead = number | { kind: "invalid" | "mismatch" | "missing"; progress: number };

/**
 * Read a three-component position starting at token t, spaced ("~ ~1 ~") or packed ("~~1~").
 * Returns the index after it, or why it can't be read: local "^" components can't be mixed with
 * world or "~" components, and a position cut short by the end of the input is "missing".
 */
function readPosition(tokens: string[], t: number): PositionRead {
  const start = t;
  let components = 0;
  let localComponents = 0;
  while (components < 3 && t < tokens.length) {
    const tokenComponents = getCoordinateComponents(tokens[t]);
    if (!tokenComponents) {
      return { kind: t === start ? "invalid" : "mismatch", progress: t };
    }
    components += tokenComponents.length;
    localComponents += tokenComponents.filter((c) => c[0] === "^").length;
    t++;
  }
  if (components < 3) {
    return { kind: "missing", progress: t };
  }
  if (components > 3) {
    return { kind: "mismatch", progress: start };
  }
  if (localComponents !== 0 && localComponents !== 3) {
    return { kind: "invalid", progress: start };
  }
  return t;
}
const MAX_EXPECTED_VALUES = 12;

/** True when the enum is soft/dynamic (known dynamic, or no values exported), so any value is accepted. */
function isOpenEnum(enumName: string): boolean {
  return DYNAMIC_ENUMS.has(enumName) || CONTENT_EXTENSIBLE_ENUMS.has(enumName) || isCommandEnumEmpty(enumName);
}

/** Identifier enums (blocks, items, entities, ...) accept add-on content in other namespaces. */
function isIdentifierEnum(enumName: string): boolean {
  const e = getBedrockKnowledge().commandEnums[enumName];
  return !!e && e.values.some((v) => v.includes(":"));
}

function acceptsEnumValue(enumName: string, token: string): boolean {
  if (isOpenEnum(enumName) || isCommandEnumValue(enumName, token)) {
    return true;
  }
  const colon = token.indexOf(":");
  return colon > 0 && token.substring(0, colon).toLowerCase() !== "minecraft" && isIdentifierEnum(enumName);
}

function describeExpected(param: IKnowledgeCommandParam): string {
  if (param.enumName) {
    const values = getCommandEnumValues(param.enumName);
    const shown = values.slice(0, MAX_EXPECTED_VALUES).join(", ");
    return values.length > MAX_EXPECTED_VALUES ? `${shown}, ...` : shown;
  }
  if (param.type === "INT") return "an integer";
  if (POSITION_TYPES.has(param.type)) return "a position (x y z)";
  return param.type;
}

/**
 * Consume the tokens for one (non rest-consuming) parameter starting at token t. Returns the index
 * after the parameter, or why it can't be filled there. A position cut short by the end of the input
 * is "missing" with progress equal to the token count.
 */
function consumeParam(tokens: string[], t: number, param: IKnowledgeCommandParam): number | IOverloadFailure {
  if (param.enumName) {
    return acceptsEnumValue(param.enumName, tokens[t])
      ? t + 1
      : { kind: "invalid", progress: t, param, expected: describeExpected(param) };
  }

  if (param.type === "INT") {
    return INTEGER_PATTERN.test(tokens[t])
      ? t + 1
      : { kind: "invalid", progress: t, param, expected: describeExpected(param) };
  }

  if (POSITION_TYPES.has(param.type)) {
    const read = readPosition(tokens, t);
    if (typeof read === "number") {
      return read;
    }
    return read.kind === "invalid" ? { ...read, param, expected: describeExpected(param) } : { ...read, param };
  }

  // Any other parameter type is treated as a wildcard that consumes one token.
  return t + 1;
}

/**
 * Match tokens against an overload's parameters. An optional parameter may be skipped even when a
 * later parameter is required (e.g. "summon pig facing @s" skips the optional spawn position), so
 * the search branches over (parameter, token) states. Each state is visited once, which bounds the
 * work to parameters x tokens. Matching starts at token `start`; progress is relative to the whole
 * token list. `matchChain`, when given, validates an execute chain's tail from a token index;
 * without it the tail is accepted as opaque text.
 */
function matchOverload(
  tokens: string[],
  params: IKnowledgeCommandParam[],
  start = 0,
  matchChain?: (t: number) => IOverloadFailure | undefined
): IOverloadFailure | undefined {
  const memo = new Map<number, IOverloadFailure | null>();

  const visit = (p: number, t: number): IOverloadFailure | undefined => {
    const key = p * (tokens.length + 1) + t;
    if (!memo.has(key)) {
      memo.set(key, visitState(p, t) ?? null);
    }
    return memo.get(key) ?? undefined;
  };

  const visitState = (p: number, t: number): IOverloadFailure | undefined => {
    if (p >= params.length) {
      return t < tokens.length ? { kind: "extra", progress: t } : undefined;
    }
    const param = params[p];
    if (t >= tokens.length) {
      // Skip an empty optional parameter, then keep going: a later required parameter is still missing.
      return param.optional ? visit(p + 1, t) : { kind: "missing", progress: t, param };
    }
    if (param.type === "EXECUTECHAINEDOPTION_0" && matchChain) {
      return matchChain(t);
    }
    if (REST_CONSUMING_TYPES.has(param.type)) {
      return undefined;
    }

    const consumed = consumeParam(tokens, t, param);
    const consumeFailure = typeof consumed === "number" ? visit(p + 1, consumed) : consumed;
    if (!consumeFailure || !param.optional) {
      return consumeFailure;
    }
    const skipFailure = visit(p + 1, t);
    if (!skipFailure) {
      return undefined;
    }
    // Report the interpretation that got furthest; on a tie, the one that used the optional parameter.
    return skipFailure.progress > consumeFailure.progress ? skipFailure : consumeFailure;
  };

  return visit(0, start);
}

/**
 * Match every overload of a command from token `start`, returning undefined when one matches or the
 * failures of all of them (in overload order). Execute chain tails ("execute as @a at @s ...") are matched recursively
 * against the execute overloads, so a typo in a later subcommand is reported too.
 */
function matchAllOverloads(command: IKnowledgeCommand, tokens: string[]): IOverloadFailure[] | undefined {
  const chainMemo = new Map<number, IOverloadFailure | null>();
  let depth = 0;

  const matchChain = (t: number): IOverloadFailure | undefined => {
    if (!chainMemo.has(t)) {
      if (depth >= MAX_NESTING_DEPTH) {
        return undefined;
      }
      depth++;
      chainMemo.set(t, pickBestFailure(matchFrom(t)) ?? null);
      depth--;
    }
    return chainMemo.get(t) ?? undefined;
  };

  const matchFrom = (start: number): IOverloadFailure[] | undefined => {
    const failures: IOverloadFailure[] = [];
    for (const overload of command.overloads) {
      const failure = matchOverload(tokens, getMatchParams(command, overload.params), start, matchChain);
      if (!failure) {
        return undefined;
      }
      failures.push(failure);
    }
    return failures;
  };

  return matchFrom(0);
}

/** The failure that got furthest. Invalid failures at that point are merged so all expectations are listed. */
function pickBestFailure(failures: IOverloadFailure[] | undefined): IOverloadFailure | undefined {
  if (!failures) {
    return undefined;
  }
  const bestProgress = Math.max(...failures.map((f) => f.progress));
  const best = failures.filter((f) => f.progress === bestProgress);
  if (best.every((f) => f.kind === "invalid")) {
    return { ...best[0], expected: Array.from(new Set(best.map((f) => f.expected!))).join("; or ") };
  }
  return best[0];
}

interface IMatchFrontier {
  /** Index of the parameter the next token would fill (params.length when all are filled). */
  paramIndex: number;
  /** Token index where that parameter starts. Below the token count only for rest-consuming parameters. */
  tokenIndex: number;
}

/**
 * Where an overload can stand after the given tokens: every parameter the next token could fill
 * (following both the consume and skip paths of optional parameters), plus every rest-consuming
 * parameter that is reached before the tokens run out.
 */
function getMatchFrontier(tokens: string[], params: IKnowledgeCommandParam[]): IMatchFrontier[] {
  const frontier: IMatchFrontier[] = [];
  const seen = new Set<number>();

  const visit = (p: number, t: number) => {
    const key = p * (tokens.length + 1) + t;
    if (seen.has(key)) return;
    seen.add(key);

    if (p >= params.length) {
      if (t >= tokens.length) frontier.push({ paramIndex: p, tokenIndex: t });
      return;
    }
    const param = params[p];
    if (REST_CONSUMING_TYPES.has(param.type)) {
      frontier.push({ paramIndex: p, tokenIndex: t });
      return;
    }
    if (t >= tokens.length) {
      frontier.push({ paramIndex: p, tokenIndex: t });
    } else {
      const consumed = consumeParam(tokens, t, param);
      if (typeof consumed === "number") {
        visit(p + 1, consumed);
      } else if (consumed.kind === "missing" && consumed.progress >= tokens.length) {
        // A position whose remaining components haven't been typed yet.
        frontier.push({ paramIndex: p, tokenIndex: tokens.length });
      }
    }
    if (param.optional) {
      visit(p + 1, t);
    }
  };

  visit(0, 0);
  return frontier;
}

/**
 * Match argument tokens (excluding the command name) against every overload of a command.
 */
export function matchCommandOverloads(command: IKnowledgeCommand, tokens: string[]): ICommandMatchResult {
  if (command.overloads.length === 0) {
    return { matched: true };
  }

  const allFailures = matchAllOverloads(command, tokens);
  if (!allFailures) {
    return { matched: true };
  }

  const bestProgress = Math.max(...allFailures.map((f) => f.progress));
  const best = allFailures.filter((f) => f.progress === bestProgress);

  if (best.every((f) => f.kind === "missing")) {
    const usages = command.overloads
      .filter((_, i) => allFailures[i].progress === bestProgress && allFailures[i].kind === "missing")
      .slice(0, 3)
      .map((o) => formatOverloadSignature(command.name, o));
    const names = Array.from(new Set(best.map((f) => f.param!.name)));
    return {
      matched: false,
      problem: {
        kind: "missing",
        argumentIndex: tokens.length,
        message: `Missing required argument ${names.map((n) => `"${n}"`).join(" or ")} for /${command.name}. Usage: ${usages.join(" | ")}`,
      },
    };
  }

  if (best.every((f) => f.kind === "invalid")) {
    const expected = Array.from(new Set(best.map((f) => f.expected!)));
    return {
      matched: false,
      problem: {
        kind: "invalid",
        argumentIndex: bestProgress,
        message: `Unexpected value "${tokens[bestProgress]}" for /${command.name}. Expected ${expected.join("; or ")}`,
      },
    };
  }

  return { matched: false };
}

const EXECUTE_SUBCOMMAND_ENUM_PREFIX = "Option_";

/** Index after a valid position starting at token t, or -1; see readPosition. */
function skipPosition(tokens: string[], t: number): number {
  const read = readPosition(tokens, t);
  return typeof read === "number" ? read : -1;
}

/**
 * Token index of the nested command in pre-1.19.50 "execute <target> <x y z> [detect <x y z> <block>
 * <data>] <command>" syntax, which the engine still accepts for packs whose min_engine_version is
 * below 1.19.50; -1 when the tokens aren't that shape. The match is positive, so a misspelled
 * subcommand such as "execute ass @a run ..." is not legacy syntax and gets the normal argument
 * diagnostics. A target named like a modern subcommand ("execute as ~ ~ ~ say hi" targets a player
 * named "as") is read as legacy only with `preferLegacy`, which callers set for packs that target
 * an engine before the syntax change; otherwise the modern reading wins.
 */
export function getLegacyExecuteCommandIndex(
  command: IKnowledgeCommand,
  tokens: string[],
  preferLegacy = false
): number {
  if (command.name !== "execute" || tokens.length < 3) {
    return -1;
  }
  const first = tokens[0];
  const isSubcommand =
    !preferLegacy &&
    command.overloads.some((o) => {
      const p = o.params[0];
      return (
        !!p?.enumName && p.enumName.startsWith(EXECUTE_SUBCOMMAND_ENUM_PREFIX) && isCommandEnumValue(p.enumName, first)
      );
    });
  if (isSubcommand) {
    return -1;
  }
  let t = skipPosition(tokens, 1);
  if (t >= 0 && tokens[t]?.toLowerCase() === "detect") {
    t = skipPosition(tokens, t + 1);
    t = t >= 0 && t + 1 < tokens.length && INTEGER_PATTERN.test(tokens[t + 1]) ? t + 2 : -1;
  }
  return t >= 0 && t < tokens.length ? t : -1;
}

/** True for legacy "execute <target> <x y z> <command>" syntax; see getLegacyExecuteCommandIndex. */
export function isLegacyExecuteSyntax(command: IKnowledgeCommand, tokens: string[], preferLegacy = false): boolean {
  return getLegacyExecuteCommandIndex(command, tokens, preferLegacy) >= 0;
}

export interface IMatchToken {
  value: string;
  /** Index of the parsed argument this token came from. */
  argumentIndex: number;
}

/**
 * Split parsed arguments into the tokens the engine sees. The engine ends a selector at its closing
 * "]", so "@a[tag=x]-5" is a selector followed by "-5" even without a space. Brackets inside quoted
 * values (name="a]b", with backslash escapes) are text, not structure.
 */
export function toMatchTokens(argumentValues: string[]): IMatchToken[] {
  const tokens: IMatchToken[] = [];
  argumentValues.forEach((value, argumentIndex) => {
    if (value.startsWith("@") && value.includes("[")) {
      let depth = 0;
      let inString = false;
      for (let i = 0; i < value.length; i++) {
        if (inString) {
          if (value[i] === "\\") i++;
          else if (value[i] === '"') inString = false;
          continue;
        }
        if (value[i] === '"') inString = true;
        else if (value[i] === "[") depth++;
        else if (value[i] === "]" && --depth === 0) {
          if (i < value.length - 1) {
            tokens.push({ value: value.substring(0, i + 1), argumentIndex });
            tokens.push({ value: value.substring(i + 1), argumentIndex });
            return;
          }
          break;
        }
      }
    }
    tokens.push({ value, argumentIndex });
  });
  return tokens;
}

export interface INextParameterCandidates {
  /** Parameters that could accept the next token. */
  params: IKnowledgeCommandParam[];
  /** True when the next token is a command name (start of line, or after "execute ... run"). */
  expectsCommandName: boolean;
  /** The command whose parameters are listed (differs from the outer command after "run"). */
  commandName?: string;
}

const MAX_NESTING_DEPTH = 16;

/**
 * Given the complete tokens before the cursor (excluding the command name), list the parameters the
 * next token could fill, across every overload whose prefix matches. Follows execute chains and the
 * command after "execute ... run".
 */
export function getNextParameterCandidates(
  command: IKnowledgeCommand,
  tokens: string[],
  depth = 0
): INextParameterCandidates {
  const result: INextParameterCandidates = { params: [], expectsCommandName: false, commandName: command.name };
  if (depth > MAX_NESTING_DEPTH) {
    return result;
  }
  const seen = new Set<string>();
  const addParam = (param: IKnowledgeCommandParam) => {
    const key = `${param.name}|${param.type}|${param.enumName ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.params.push(param);
    }
  };
  const merge = (nested: INextParameterCandidates) => {
    nested.params.forEach(addParam);
    result.expectsCommandName = result.expectsCommandName || nested.expectsCommandName;
    if (nested.commandName !== command.name) {
      result.commandName = nested.commandName;
    }
  };

  for (const overload of command.overloads) {
    for (const { paramIndex, tokenIndex } of getMatchFrontier(tokens, overload.params)) {
      const param = overload.params[paramIndex];
      if (!param) {
        continue;
      }
      if (param.type === "EXECUTECHAINEDOPTION_0") {
        merge(getNextParameterCandidates(command, tokens.slice(tokenIndex), depth + 1));
      } else if (param.type === "CODEBUILDERARGS") {
        if (tokenIndex >= tokens.length) {
          result.expectsCommandName = true;
        } else {
          const nested = findNestedCommand(tokens[tokenIndex]);
          if (nested) {
            merge(getNextParameterCandidates(nested, tokens.slice(tokenIndex + 1), depth + 1));
          }
        }
      } else if (tokenIndex >= tokens.length) {
        addParam(param);
      }
    }
  }

  return result;
}

/**
 * For signature help: whether the overload can still match once more arguments are typed, and which
 * parameter the next token fills (-1 when every parameter is already filled).
 */
export function getOverloadProgress(
  params: IKnowledgeCommandParam[],
  tokens: string[]
): { compatible: boolean; activeParameter: number } {
  const failure = matchOverload(tokens, params);
  const compatible = !failure || (failure.kind === "missing" && failure.progress >= tokens.length);
  const active = getMatchFrontier(tokens, params)
    .map((f) => f.paramIndex)
    .filter((i) => i < params.length);
  return { compatible, activeParameter: active.length > 0 ? Math.min(...active) : -1 };
}

function findNestedCommand(token: string): IKnowledgeCommand | undefined {
  const name = token.replace(/^\//, "");
  return getBedrockKnowledge().commands.find((c) => c.name === name || c.aliases.includes(name));
}

/**
 * Index of the "run" token that starts the nested command in a modern execute chain, or -1 when
 * there is none or the chain doesn't match. Uses the execute overloads rather than the token text,
 * so a selector, score holder, or objective named "run" earlier in the chain isn't mistaken for it.
 */
export function findExecuteRunTokenIndex(command: IKnowledgeCommand, tokens: string[]): number {
  if (command.name !== "execute") {
    return -1;
  }
  const visited = new Set<number>();
  const search = (offset: number, depth: number): number => {
    if (depth > MAX_NESTING_DEPTH || visited.has(offset)) {
      return -1;
    }
    visited.add(offset);
    const rest = tokens.slice(offset);
    let best = -1;
    for (const overload of command.overloads) {
      for (const { paramIndex, tokenIndex } of getMatchFrontier(rest, overload.params)) {
        const type = overload.params[paramIndex]?.type;
        let found = -1;
        if (type === "CODEBUILDERARGS" && paramIndex > 0 && tokenIndex < rest.length) {
          found = offset + tokenIndex - 1;
        } else if (type === "EXECUTECHAINEDOPTION_0" && tokenIndex > 0 && tokenIndex < rest.length) {
          found = search(offset + tokenIndex, depth + 1);
        }
        if (found >= 0 && (best < 0 || found < best)) {
          best = found;
        }
      }
    }
    return best;
  };
  return search(0, 0);
}

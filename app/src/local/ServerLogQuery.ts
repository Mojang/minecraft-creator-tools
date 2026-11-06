// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Filters, groups, and redacts a Bedrock Dedicated Server's recent console output
 * so an agent can read a session's errors (script errors, JSON schema failures,
 * entity load failures) through MCP.
 *
 * Input is `DedicatedServer.outputLines`: raw console lines, oldest first, kept in
 * a ring that drops the oldest half at 10,000 lines. BDS writes the content log to
 * the console (`content-log-console-output=true`), so content errors land here too.
 *
 * - Scope: by default only output from the newest process stream (`streamId`),
 *   after its most recent "Starting Server" line. A restart attaches a new stream
 *   while the old process may still be draining, so lines from both runs can
 *   interleave; filtering by stream keeps a stale start or error out of the
 *   current run. Lines without a stream id (synthetic or older lines) are kept.
 *   If the start line has been trimmed out of the ring, all of the newest
 *   stream's buffered output is used and `startFoundInBuffer` is false.
 * - Grouping: a header-less line right after an error or warning (a stack frame or
 *   wrapped message) is folded into that entry. Identical entries are collapsed
 *   with a count.
 * - Bounded work: line length isn't bounded by the ring, so each entry inspects at
 *   most SERVER_LOG_MAX_INSPECTED_LENGTH characters. Redaction and search only see
 *   that prefix, and entries are deduplicated on the returned (capped) message, so
 *   entries that differ only beyond the cap are counted as repeats.
 * - Redaction: each local absolute path (including under caller-supplied roots,
 *   such as the home folder) is replaced as a whole with `<local path>/<file name>`,
 *   so folder names and user names aren't exposed.
 *
 * The result is untrusted server output; callers must present it as data.
 */

import { OutputLine } from "./DedicatedServer";
import ServerMessage, { ServerMessageCategory, ServerMessageType } from "./ServerMessage";
import { ABSOLUTE_PATH_TAIL, redactAbsolutePaths } from "../core/PathRedaction";

export type ServerLogLevel = "error" | "warning" | "info" | "other";

export const SERVER_LOG_LEVELS: ServerLogLevel[] = ["error", "warning", "info", "other"];
export const SERVER_LOG_DEFAULT_LIMIT = 50;
export const SERVER_LOG_MAX_LIMIT = 200;
export const SERVER_LOG_DEFAULT_MESSAGE_LENGTH = 1000;
export const SERVER_LOG_MAX_SEARCH_LENGTH = 200;
/** Characters of each entry (header line plus continuation lines) that are parsed, redacted, and searched. */
export const SERVER_LOG_MAX_INSPECTED_LENGTH = 4000;

/** Header-less lines folded into one entry; more are dropped. */
const MAX_CONTINUATION_LINES = 20;

export const REDACTED_PATH = "<local path>";

// Stands in for REDACTED_PATH while the path passes run, so a replacement is
// never matched again as the start of another path.
const PATH_SENTINEL = "\uE000";

export interface IServerLogQueryOptions {
  /** Levels to return. Defaults to errors and warnings. */
  levels?: ServerLogLevel[];
  /** Only read the newest process's output since its most recent start. Defaults to true. */
  sinceLatestStart?: boolean;
  /** Case-insensitive substring that entries must contain (matched after redaction). */
  search?: string;
  /** Maximum distinct entries to return. Defaults to 50, capped at 200. */
  limit?: number;
  /** Include internal lines such as querytarget polling output. Defaults to false. */
  includeInternal?: boolean;
  /** Maximum characters per message. Defaults to 1000, capped at SERVER_LOG_MAX_INSPECTED_LENGTH. */
  maxMessageLength?: number;
  /** Folder paths to redact in addition to generic absolute paths (for example, the home folder). */
  redactRoots?: string[];
}

export interface IServerLogEntry {
  level: ServerLogLevel;
  message: string;
  /** Timestamp from the BDS line header, when present. */
  time?: string;
  /** How many times this exact entry appeared in scope. */
  count: number;
}

export interface IServerLogQueryResult {
  /** Most recent distinct matching entries, in order of last occurrence. */
  entries: IServerLogEntry[];
  /** Entries in scope that match `search`, by level, before the level filter. Repeats are counted. */
  countsByLevel: { [level in ServerLogLevel]: number };
  /** Distinct entries that matched every filter. */
  distinctMatches: number;
  /** True when more distinct entries matched than `limit` allowed. */
  truncated: boolean;
  scope: "sinceLatestStart" | "entireBuffer";
  /** False when sinceLatestStart was asked for but the start line is no longer buffered. */
  startFoundInBuffer: boolean;
}

interface IPendingEntry {
  level: ServerLogLevel;
  time?: string;
  text: string;
  /** Characters not inspected because of the length budget or the continuation limit. */
  omitted: number;
  continuationLines: number;
}

const CONTENT_LOG_LEVEL_TAG = /^(?:\[[^\]]*\]\s*)*\[(error|warning|warn)\]/i;
const HEADER_TIME = /^\[(\d{4}-\d{2}-\d{2}[ T][\d:.]+)\s+[A-Z]+\]/;

export function classifyServerLogLevel(sm: ServerMessage): ServerLogLevel {
  if (sm.type === ServerMessageType.error) {
    return "error";
  }

  if (sm.type === ServerMessageType.warning) {
    return "warning";
  }

  const tag = CONTENT_LOG_LEVEL_TAG.exec(sm.message);
  if (tag) {
    return tag[1].toLowerCase() === "error" ? "error" : "warning";
  }

  if (
    sm.category === ServerMessageCategory.gameTestFailed ||
    sm.category === ServerMessageCategory.debuggerFailedToStart
  ) {
    return "error";
  }

  return sm.type === ServerMessageType.info ? "info" : "other";
}

function hasHeader(sm: ServerMessage) {
  return sm.message !== sm.fullMessage.trim() || sm.fullMessage.startsWith("[");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Placeholder for a whole path, keeping only its final segment (the file name). */
function redactKeepingFileName(path: string) {
  const segments = path.split(/[\\/]/).filter((segment) => segment.length > 0);
  const fileName = segments.length > 1 ? segments[segments.length - 1] : "";

  return fileName ? PATH_SENTINEL + "/" + fileName : PATH_SENTINEL;
}

/**
 * Replaces each local absolute path with `<local path>/<file name>`. A path under
 * one of `roots` is consumed completely even when the root has no drive letter
 * or contains spaces; other paths are found with the shared absolute-path rules.
 */
export function redactLocalPaths(text: string, roots?: string[]): string {
  let result = text.split(PATH_SENTINEL).join("");

  const sortedRoots = (roots ?? [])
    .map((root) => (root ?? "").replace(/[\\/]+$/, ""))
    .filter((root) => root.length > 3)
    .sort((a, b) => b.length - a.length);

  for (const root of sortedRoots) {
    const rootPattern = escapeRegExp(root).replace(/\\\\|\//g, "[\\\\/]");
    const pattern = new RegExp("(?<![A-Za-z0-9])" + rootPattern + "(?:[\\\\/]" + ABSOLUTE_PATH_TAIL + ")?", "gi");
    result = result.replace(pattern, redactKeepingFileName);
  }

  result = redactAbsolutePaths(result, redactKeepingFileName);

  return result.split(PATH_SENTINEL).join(REDACTED_PATH);
}

function findScopeStart(outputLines: OutputLine[], streamId: number | undefined) {
  for (let i = outputLines.length - 1; i >= 0; i--) {
    const line = outputLines[i];
    if (!isInStream(line, streamId)) {
      continue;
    }

    if (
      line.message.indexOf("Starting Server") >= 0 &&
      new ServerMessage(line.message.substring(0, SERVER_LOG_MAX_INSPECTED_LENGTH)).category ===
        ServerMessageCategory.serverStarting
    ) {
      return i;
    }
  }

  return -1;
}

function latestStreamId(outputLines: OutputLine[]) {
  let latest: number | undefined;

  for (const line of outputLines) {
    if (line.streamId !== undefined && (latest === undefined || line.streamId > latest)) {
      latest = line.streamId;
    }
  }

  return latest;
}

function isInStream(line: OutputLine, streamId: number | undefined) {
  return streamId === undefined || line.streamId === undefined || line.streamId === streamId;
}

function clampLimit(limit: number | undefined) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return SERVER_LOG_DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(SERVER_LOG_MAX_LIMIT, Math.floor(limit)));
}

function capMessage(text: string, omitted: number, maxLength: number) {
  const overflow = Math.max(0, text.length - maxLength) + omitted;

  if (overflow === 0) {
    return text;
  }

  return text.substring(0, maxLength) + `... (${overflow} more characters)`;
}

export function queryServerLog(outputLines: OutputLine[], options: IServerLogQueryOptions = {}): IServerLogQueryResult {
  const levels = new Set<ServerLogLevel>(
    options.levels && options.levels.length > 0 ? options.levels : ["error", "warning"]
  );
  const sinceLatestStart = options.sinceLatestStart !== false;
  const limit = clampLimit(options.limit);
  const maxMessageLength = Math.min(
    SERVER_LOG_MAX_INSPECTED_LENGTH,
    Math.max(80, options.maxMessageLength ?? SERVER_LOG_DEFAULT_MESSAGE_LENGTH)
  );
  const search = options.search ? options.search.substring(0, SERVER_LOG_MAX_SEARCH_LENGTH).toLowerCase() : undefined;

  const streamId = sinceLatestStart ? latestStreamId(outputLines) : undefined;
  let startIndex = 0;
  let startFoundInBuffer = false;

  if (sinceLatestStart) {
    const found = findScopeStart(outputLines, streamId);
    if (found >= 0) {
      startIndex = found;
      startFoundInBuffer = true;
    }
  }

  const countsByLevel = { error: 0, warning: 0, info: 0, other: 0 };
  const distinct = new Map<string, IServerLogEntry & { lastIndex: number }>();
  let entryIndex = 0;

  const flush = (entry: IPendingEntry | undefined) => {
    if (!entry) {
      return;
    }

    const index = entryIndex++;
    const redacted = redactLocalPaths(entry.text, options.redactRoots);

    if (search && redacted.toLowerCase().indexOf(search) < 0) {
      return;
    }

    countsByLevel[entry.level]++;

    if (!levels.has(entry.level)) {
      return;
    }

    const shown = redacted.substring(0, maxMessageLength);
    const message = capMessage(redacted, entry.omitted, maxMessageLength);
    // Keyed on the capped text so entries that differ only past the cap collapse.
    const key = entry.level + "\u0000" + shown + (message.length > shown.length ? "\u0000+" : "");
    const existing = distinct.get(key);

    if (existing) {
      existing.count++;
      existing.lastIndex = index;
      existing.message = message;
      existing.time = entry.time ?? existing.time;
    } else {
      distinct.set(key, { level: entry.level, message, time: entry.time, count: 1, lastIndex: index });
    }
  };

  let current: IPendingEntry | undefined;

  for (let i = startIndex; i < outputLines.length; i++) {
    const line = outputLines[i];

    if (!isInStream(line, streamId)) {
      continue;
    }

    if (line.isInternal && !options.includeInternal) {
      flush(current);
      current = undefined;
      continue;
    }

    const inspected =
      line.message.length > SERVER_LOG_MAX_INSPECTED_LENGTH
        ? line.message.substring(0, SERVER_LOG_MAX_INSPECTED_LENGTH)
        : line.message;
    const omittedFromLine = line.message.length - inspected.length;
    const sm = new ServerMessage(inspected);

    if (sm.category === ServerMessageCategory.empty) {
      continue;
    }

    if (!line.isInternal && sm.category === ServerMessageCategory.internalSystemMessage && !options.includeInternal) {
      flush(current);
      current = undefined;
      continue;
    }

    if (!hasHeader(sm) && current && (current.level === "error" || current.level === "warning")) {
      const available = SERVER_LOG_MAX_INSPECTED_LENGTH - current.text.length - 1;

      if (current.continuationLines >= MAX_CONTINUATION_LINES || available <= 0) {
        current.omitted += sm.message.length + omittedFromLine + 1;
      } else {
        const appended = sm.message.substring(0, available);
        current.text += "\n" + appended;
        current.omitted += sm.message.length - appended.length + omittedFromLine;
      }

      current.continuationLines++;
      continue;
    }

    flush(current);

    const timeMatch = HEADER_TIME.exec(inspected.replace(/^NO LOG FILE! - /, ""));

    current = {
      level: classifyServerLogLevel(sm),
      time: timeMatch ? timeMatch[1] : undefined,
      text: sm.message,
      omitted: omittedFromLine,
      continuationLines: 0,
    };
  }

  flush(current);

  const ordered = Array.from(distinct.values()).sort((a, b) => a.lastIndex - b.lastIndex);
  const kept = ordered.slice(Math.max(0, ordered.length - limit));

  return {
    entries: kept.map((entry) => {
      const result: IServerLogEntry = {
        level: entry.level,
        message: entry.message,
        count: entry.count,
      };
      if (entry.time) {
        result.time = entry.time;
      }
      return result;
    }),
    countsByLevel,
    distinctMatches: ordered.length,
    truncated: ordered.length > kept.length,
    scope: startFoundInBuffer ? "sinceLatestStart" : "entireBuffer",
    startFoundInBuffer: sinceLatestStart ? startFoundInBuffer : false,
  };
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Reads Minecraft's content log files (`ContentLog<date>_<n>.txt` in the client's `logs` folder).
 *
 * The client writes these files only when Settings > Creator > Content Log File is turned on. Each
 * entry starts with a line `HH:MM:SS[Category][level]-message`, where level is `error`, `warning`,
 * `inform` or `verbose`. Lines that follow without a timestamp continue that entry's message. Lines
 * end in `\r\n` and sometimes `\r\r\n`. Older builds named the files `contentlog__*`, which is still
 * accepted.
 *
 * - parseContentLogLine() parses one line.
 * - ContentLogLineSplitter turns appended chunks into whole lines, holding back a partial last line.
 * - ContentLogEntryAssembler turns lines into entries, folding continuation lines into the entry
 *   before them. It holds the last entry back until it knows no more continuations are coming.
 *   Both cut lines and messages at MAX_CONTENT_LOG_TEXT_LENGTH, so memory stays bounded.
 * - ContentLogTail follows a folder's files by byte offset, reading at most `maxReadBytes` per poll.
 *   It lists the folder once at its first poll (catching up on recently written files), then picks
 *   up files it hasn't seen, in the order their names say they were started, finishing each file
 *   (and waiting a poll for late writes) before starting the next. It goes by which files it has
 *   seen rather than modification times, so a late write to an old file can't hide a new one. It
 *   retries a file it can't read or check for about a minute, then skips it with a warning entry,
 *   and starts over when a file shrinks. Its file system and timer are injectable, so tests don't
 *   touch the disk or wait.
 *
 * When reading starts partway into a file, the first line can be cut off and the next lines can be
 * continuations of an entry that started earlier, so both are skipped up to the first timestamped
 * line.
 */

import * as fs from "fs";
import * as path from "path";
import { StringDecoder } from "string_decoder";

export type ContentLogLevel = "verbose" | "info" | "warning" | "error";

export interface IContentLogEntry {
  /** Local `HH:MM:SS` from the line, when it has one. */
  time?: string;
  category?: string;
  level: ContentLogLevel;
  /** The message, with any continuation lines joined by `\n`. */
  message: string;
}

const LEVEL_RANK: { [level in ContentLogLevel]: number } = { verbose: 0, info: 1, warning: 2, error: 3 };

const ENTRY_PATTERN = /^(\d{1,2}:\d{2}:\d{2})\[([^\]]*)\]\[([^\]]*)\]-?(.*)$/;

export function contentLogLevelRank(level: ContentLogLevel): number {
  return LEVEL_RANK[level];
}

/** Maps the level word in a content log line (or a user-supplied level) to a ContentLogLevel. */
export function normalizeContentLogLevel(raw: string | undefined): ContentLogLevel | undefined {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "error":
    case "fatal":
      return "error";
    case "warning":
    case "warn":
      return "warning";
    case "inform":
    case "info":
      return "info";
    case "verbose":
    case "debug":
      return "verbose";
    default:
      return undefined;
  }
}

export function isContentLogFileName(fileName: string) {
  const lower = fileName.toLowerCase();

  return lower.startsWith("contentlog__") || (lower.startsWith("contentlog") && lower.endsWith(".txt"));
}

/**
 * Parses one content log line. Returns undefined for a blank line. A line that doesn't start with a
 * timestamp has no `time` and takes its category and level from `previous` (or is `info` when there's
 * no previous entry); ContentLogEntryAssembler folds such lines into the entry before them.
 */
export function parseContentLogLine(line: string, previous?: IContentLogEntry): IContentLogEntry | undefined {
  if (line.trim().length === 0) {
    return undefined;
  }

  const match = ENTRY_PATTERN.exec(line);

  if (!match) {
    return {
      category: previous?.category,
      level: previous?.level ?? "info",
      message: line,
    };
  }

  return {
    time: match[1],
    category: match[2],
    level: normalizeContentLogLevel(match[3]) ?? "info",
    message: match[4],
  };
}

function isEntryStart(line: string) {
  return ENTRY_PATTERN.test(line);
}

/** Parses a whole block of content log text into entries. */
export function parseContentLogText(text: string): IContentLogEntry[] {
  const splitter = new ContentLogLineSplitter();
  const assembler = new ContentLogEntryAssembler();

  return [...assembler.push([...splitter.push(text), ...splitter.flush()]), ...assembler.flush()];
}

/** Longest line or entry message kept, in characters; the rest is dropped and marked with "…". */
export const MAX_CONTENT_LOG_TEXT_LENGTH = 64 * 1024;

/**
 * Splits appended text into whole lines. Any of `\n`, `\r\n` or `\r\r\n` ends a line. A line longer
 * than `maxLineLength` is cut there, and the rest of it is dropped as it arrives, so a file without
 * line breaks can't grow memory.
 */
export class ContentLogLineSplitter {
  #partial = "";
  #truncated = false;

  readonly maxLineLength: number;

  constructor(maxLineLength = MAX_CONTENT_LOG_TEXT_LENGTH) {
    this.maxLineLength = maxLineLength;
  }

  /** Whether part of a line is being held back. */
  get hasPartial() {
    return this.#partial.length > 0 || this.#truncated;
  }

  push(chunk: string): string[] {
    const parts = chunk.split(/\r*\n/);
    const lines: string[] = [];

    for (let i = 0; i < parts.length - 1; i++) {
      this.#append(parts[i]);
      lines.push(this.#takeLine());
    }

    this.#append(parts[parts.length - 1]);

    return lines;
  }

  /** Returns the held-back partial line, if any, and clears it. */
  flush(): string[] {
    if (!this.hasPartial) {
      return [];
    }

    const rest = this.#takeLine();

    return rest.length > 0 ? [rest] : [];
  }

  reset() {
    this.#partial = "";
    this.#truncated = false;
  }

  #append(text: string) {
    if (this.#truncated) {
      return;
    }

    const room = this.maxLineLength - this.#partial.length;

    if (text.length <= room) {
      this.#partial += text;
      return;
    }

    this.#partial += truncateText(text, room);
    this.#truncated = true;
  }

  #takeLine() {
    const line = this.#partial.replace(/\r+$/, "") + (this.#truncated ? "…" : "");
    this.reset();

    return line;
  }
}

/** The first `length` characters of `text`, without splitting a surrogate pair. */
function truncateText(text: string, length: number) {
  const cut = text.slice(0, Math.max(0, length));

  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

/**
 * Turns whole lines into entries. A timestamped line starts an entry; the lines after it without a
 * timestamp are added to its message, up to `maxMessageLength`. push() returns the entries known to
 * be finished, and the last one is held until the next timestamped line or flush(). A continuation
 * with no entry before it becomes its own entry, with the category and level of the last entry
 * returned.
 */
export class ContentLogEntryAssembler {
  #pending: IContentLogEntry | undefined;
  #pendingTruncated = false;
  #last: IContentLogEntry | undefined;

  readonly maxMessageLength: number;

  constructor(maxMessageLength = MAX_CONTENT_LOG_TEXT_LENGTH) {
    this.maxMessageLength = maxMessageLength;
  }

  get hasPending() {
    return this.#pending !== undefined;
  }

  push(lines: string[]): IContentLogEntry[] {
    const finished: IContentLogEntry[] = [];

    for (const line of lines) {
      const entry = parseContentLogLine(line, this.#last);

      if (!entry) {
        continue;
      }

      if (entry.time === undefined && this.#pending) {
        this.#addContinuation(this.#pending, entry.message);
        continue;
      }

      if (this.#pending) {
        finished.push(this.#pending);
      }

      this.#pending = entry;
      this.#pendingTruncated = false;
      this.#last = entry;
    }

    return finished;
  }

  /** Returns the held-back entry, if any. */
  flush(): IContentLogEntry[] {
    const pending = this.#pending;
    this.#pending = undefined;

    return pending ? [pending] : [];
  }

  #addContinuation(pending: IContentLogEntry, text: string) {
    if (this.#pendingTruncated) {
      return;
    }

    const room = this.maxMessageLength - pending.message.length - 1;

    if (text.length <= room) {
      pending.message += "\n" + text;
      return;
    }

    pending.message += "\n" + truncateText(text, room) + "…";
    this.#pendingTruncated = true;
  }
}

/** The file system calls ContentLogTail needs. */
export interface IContentLogFileSystem {
  /**
   * File names (not paths) in `folder`, or an empty list when it doesn't exist. Throws when it exists
   * but can't be listed right now.
   */
  list(folder: string): string[];
  /**
   * Size and modification time, or undefined when the file doesn't exist. Throws when it exists but
   * can't be checked right now (for example, it's locked).
   */
  stat(filePath: string): { size: number; mtimeMs: number } | undefined;
  /** Reads `length` bytes starting at `start`. Can throw when the file is locked or removed. */
  read(filePath: string, start: number, length: number): Uint8Array;
}

export const nodeContentLogFileSystem: IContentLogFileSystem = {
  list(folder: string) {
    try {
      return fs.readdirSync(folder);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;

      if (code === "ENOENT" || code === "ENOTDIR") {
        return [];
      }

      throw e;
    }
  },
  stat(filePath: string) {
    try {
      const stat = fs.statSync(filePath);

      return stat.isFile() ? { size: stat.size, mtimeMs: stat.mtimeMs } : undefined;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;

      if (code === "ENOENT" || code === "ENOTDIR") {
        return undefined;
      }

      throw e;
    }
  },
  read(filePath: string, start: number, length: number) {
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(filePath, "r");

    try {
      const bytesRead = fs.readSync(fd, buffer, 0, length, start);

      return buffer.subarray(0, bytesRead);
    } finally {
      fs.closeSync(fd);
    }
  },
};

/** Runs ContentLogTail's polls; injectable so tests can drive them without real timers. */
export interface IContentLogScheduler {
  setInterval(callback: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export const timerContentLogScheduler: IContentLogScheduler = {
  setInterval(callback: () => void, intervalMs: number) {
    const timer = setInterval(callback, intervalMs);
    timer.unref?.();

    return timer;
  },
  clearInterval(handle: unknown) {
    clearInterval(handle as ReturnType<typeof setInterval>);
  },
};

/** A content log file as one stat saw it. */
export interface IContentLogFileInfo {
  filePath: string;
  size: number;
  mtimeMs: number;
}

/**
 * The content log files in `folder`, oldest first (see sortContentLogFiles()). A file that can't
 * be checked right now is left out, and the list is empty when the folder can't be listed.
 */
export function listContentLogFiles(fileSystem: IContentLogFileSystem, folder: string): IContentLogFileInfo[] {
  try {
    return scanContentLogFiles(fileSystem, folder, () => false).files;
  } catch {
    return [];
  }
}

/**
 * Current file names record when the client session started and the file's number in it:
 * `ContentLog<yyyy-mm-dd>_<hh-mm-ss>_<n>.txt`.
 */
const CONTENT_LOG_GENERATION = /^ContentLog(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})_(\d+)\.txt$/i;

/**
 * Sorts files oldest first. Files whose names record when they were started go in that order,
 * because Minecraft can still write to an old file after starting a new one, which makes the old
 * file's modification time later. Files with other (legacy) names come from older builds, so they go
 * first, by modification time, then name.
 */
function sortContentLogFiles<T extends IContentLogFileInfo & { name: string }>(files: T[]) {
  const keyed = files.map((file) => {
    const match = CONTENT_LOG_GENERATION.exec(file.name);
    return { file, started: match?.[1], number: match ? Number(match[2]) : 0 };
  });

  keyed.sort((a, b) => {
    if (a.started === undefined || b.started === undefined) {
      if (a.started !== b.started) {
        return a.started === undefined ? -1 : 1;
      }

      return a.file.mtimeMs - b.file.mtimeMs || compareText(a.file.name, b.file.name);
    }

    return compareText(a.started, b.started) || a.number - b.number;
  });

  return keyed.map((entry) => entry.file);
}

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Like listContentLogFiles(), leaving out paths `skip` returns true for, and also returning the paths
 * of files that couldn't be checked.
 */
function scanContentLogFiles(fileSystem: IContentLogFileSystem, folder: string, skip: (filePath: string) => boolean) {
  const files: (IContentLogFileInfo & { name: string })[] = [];
  const unchecked: string[] = [];

  for (const name of fileSystem.list(folder)) {
    const filePath = path.join(folder, name);

    if (!isContentLogFileName(name) || skip(filePath)) {
      continue;
    }

    try {
      const stat = fileSystem.stat(filePath);

      if (stat) {
        files.push({ filePath, size: stat.size, mtimeMs: stat.mtimeMs, name });
      }
    } catch {
      unchecked.push(filePath);
    }
  }

  const sorted = sortContentLogFiles(files);

  return { files: sorted.map(({ filePath, size, mtimeMs }) => ({ filePath, size, mtimeMs })), unchecked };
}

/** Like stat(), but also returns undefined when the file can't be checked right now. */
function tryStat(fileSystem: IContentLogFileSystem, filePath: string) {
  try {
    return fileSystem.stat(filePath);
  } catch {
    return undefined;
  }
}

/** Reads one content log file forward from a byte offset, keeping decoder and line state across reads. */
class ContentLogFileReader {
  readonly filePath: string;
  offset: number;
  /** Set once finish() has been called. */
  finished = false;
  #fs: IContentLogFileSystem;
  #decoder = new StringDecoder("utf8");
  #splitter = new ContentLogLineSplitter();
  #assembler = new ContentLogEntryAssembler();
  #dropFirstLine = false;
  #skipToEntryStart = false;
  /**
   * Whether the first read still has to include the byte before `offset`, to tell whether reading
   * starts partway through a line. It's part of that read, so a failed read is retried like any other.
   */
  #checkLineStart = false;

  constructor(fileSystem: IContentLogFileSystem, filePath: string, offset: number) {
    this.#fs = fileSystem;
    this.filePath = filePath;
    this.offset = offset;

    if (offset > 0) {
      this.#checkLineStart = true;
      this.#skipToEntryStart = true;
    }
  }

  /**
   * Reads up to `maxBytes` more, stopping at `size`. Returns finished entries, or none when the read
   * fails; the offset only moves on a successful read, so the next call tries again.
   */
  read(size: number, maxBytes: number): IContentLogEntry[] {
    if (size <= this.offset) {
      return [];
    }

    const start = this.#checkLineStart ? this.offset - 1 : this.offset;
    let bytes: Uint8Array;

    try {
      bytes = this.#fs.read(this.filePath, start, Math.min(size - start, maxBytes));
    } catch {
      return [];
    }

    if (this.#checkLineStart) {
      if (bytes.length === 0) {
        return [];
      }

      this.#dropFirstLine = bytes[0] !== 0x0a;
      this.#checkLineStart = false;
      bytes = bytes.subarray(1);
    }

    this.offset += bytes.length;

    return this.#assemble(this.#splitter.push(this.#decoder.write(Buffer.from(bytes))));
  }

  /** Returns the held-back entry when no more of it can be waiting: the file is idle and no partial line is held. */
  flushIdle(): IContentLogEntry[] {
    return this.#splitter.hasPartial ? [] : this.#assembler.flush();
  }

  /** Returns everything still held back. Call once the file won't be read again. */
  finish(): IContentLogEntry[] {
    this.finished = true;
    const lines = [...this.#splitter.push(this.#decoder.end()), ...this.#splitter.flush()];

    return [...this.#assemble(lines), ...this.#assembler.flush()];
  }

  #assemble(lines: string[]): IContentLogEntry[] {
    if (this.#dropFirstLine && lines.length > 0) {
      lines = lines.slice(1);
      this.#dropFirstLine = false;
    }

    if (this.#skipToEntryStart) {
      const start = lines.findIndex(isEntryStart);

      if (start < 0) {
        return [];
      }

      lines = lines.slice(start);
      this.#skipToEntryStart = false;
    }

    return this.#assembler.push(lines);
  }
}

export interface IContentLogTailOptions {
  fileSystem?: IContentLogFileSystem;
  /**
   * Whether the newest file at the first poll is read from its end (only new entries) rather than
   * its start. Files that appear later are always read from the start. Defaults to true.
   */
  startAtEnd?: boolean;
  /**
   * With startAtEnd, files at the first poll modified at or after this time are read from up to
   * `catchUpBytes` before their end, oldest first, so recent entries are included.
   */
  catchUpSinceMs?: number;
  /** How far before the end catch-up starts. Defaults to 256 KB. */
  catchUpBytes?: number;
  /** Most bytes read in one poll, so a huge log can't stall the caller. Defaults to 1 MB. */
  maxReadBytes?: number;
}

/**
 * How many polls in a row (about a minute at the default 500 ms) ContentLogTail retries a file it
 * can't read or check before giving up on it.
 */
const MAX_STALLED_POLLS = 120;

/** A file ContentLogTail will read next, and where it starts. */
interface IQueuedContentLogFile {
  filePath: string;
  size: number;
  offset: number;
}

/**
 * Follows the content log files in a folder, oldest first. Call poll() to get entries written since
 * the last call, or start() to poll on a timer. An entry is returned once the next entry starts or a
 * poll finds nothing new, so its continuation lines are included.
 *
 * - The first poll lists the folder and queues the newest file (from its end, or with catch-up from
 *   up to `catchUpBytes` before it) and, with catch-up, older files modified since `catchUpSinceMs`.
 * - Later polls queue files not seen in an earlier listing, from their start, in the order their
 *   names say they were started (see sortContentLogFiles()). "Newer" means not seen before rather
 *   than a later modification time, because Minecraft can still write to an old file after starting
 *   a new one; that mustn't hide the new file or send the tail back to the old one.
 * - Each file is read to its end, and must stay that size for one more poll, before the next queued
 *   one starts, so a late write to it isn't lost; if it shrinks meanwhile, its new contents are read
 *   first.
 * - While a file can't be read, or a new file can't be checked (so its place in the order isn't
 *   known), later polls retry. After about a minute it's given up on with a warning entry, so newer
 *   logs aren't blocked forever.
 */
export class ContentLogTail {
  readonly folder: string;
  #fs: IContentLogFileSystem;
  #startAtEnd: boolean;
  #catchUpSinceMs: number | undefined;
  #catchUpBytes: number;
  #maxReadBytes: number;
  #reader: ContentLogFileReader | undefined;
  /** The current file's size at its last successful stat. */
  #readerSize = 0;
  #queue: IQueuedContentLogFile[] = [];
  #seen = new Set<string>();
  #listed = false;
  /** For each new file that can't be checked yet, how many polls in a row that's been so. */
  #stalledChecks = new Map<string, number>();
  #stalledReadPolls = 0;
  /** Polls in a row that found the current file at its end while a newer file was waiting. */
  #idleDrainPolls = 0;
  #scheduler: IContentLogScheduler | undefined;
  #timer: unknown;

  constructor(folder: string, options: IContentLogTailOptions = {}) {
    this.folder = folder;
    this.#fs = options.fileSystem ?? nodeContentLogFileSystem;
    this.#startAtEnd = options.startAtEnd ?? true;
    this.#catchUpSinceMs = options.catchUpSinceMs;
    this.#catchUpBytes = options.catchUpBytes ?? 256 * 1024;
    this.#maxReadBytes = options.maxReadBytes ?? 1024 * 1024;
  }

  /** Full path of the file being read, if one has been found. */
  get currentFile() {
    return this.#reader?.filePath;
  }

  /** The newest content log file in the folder, as one stat saw it, if there is one. */
  findNewestFile(): IContentLogFileInfo | undefined {
    return listContentLogFiles(this.#fs, this.folder).pop();
  }

  /** Reads entries written since the last poll. */
  poll(): IContentLogEntry[] {
    const entries: IContentLogEntry[] = [];

    if (this.#queue.length === 0) {
      this.#queueNewFiles(entries);
    }

    if (this.#queue.length > 0) {
      if (this.#reader && !this.#reader.finished) {
        const drained = this.#drainBeforeSwitch();
        entries.push(...drained.entries);

        // Return the old file's entries on their own, while currentFile still names it.
        if (!drained.done || entries.length > 0) {
          return entries;
        }
      }

      const next = this.#queue.shift() as IQueuedContentLogFile;
      this.#reader = new ContentLogFileReader(this.#fs, next.filePath, next.offset);
      this.#readerSize = next.size;
      this.#stalledReadPolls = 0;
      this.#idleDrainPolls = 0;
    }

    if (!this.#reader) {
      return entries;
    }

    const stat = tryStat(this.#fs, this.#reader.filePath);

    if (!stat) {
      return entries;
    }

    this.#readerSize = stat.size;

    if (stat.size < this.#reader.offset) {
      // The file was truncated or replaced; start over.
      entries.push(...this.#reader.finish());
      this.#reader = new ContentLogFileReader(this.#fs, this.#reader.filePath, 0);
    }

    if (stat.size > this.#reader.offset) {
      entries.push(...this.#reader.read(stat.size, this.#maxReadBytes));
    } else {
      entries.push(...this.#reader.flushIdle());
    }

    return entries;
  }

  /** Polls now and then every `intervalMs`, and passes non-empty results to `onEntries`. */
  start(
    onEntries: (entries: IContentLogEntry[]) => void,
    intervalMs = 500,
    scheduler: IContentLogScheduler = timerContentLogScheduler
  ) {
    this.stop();

    const tick = () => {
      try {
        const entries = this.poll();

        if (entries.length > 0) {
          onEntries(entries);
        }
      } catch {
        // A log folder can be removed or locked between calls; try again on the next tick.
      }
    };

    // Schedule before the first poll, so stop() called from onEntries cancels the timer.
    this.#scheduler = scheduler;
    this.#timer = scheduler.setInterval(tick, intervalMs);
    tick();
  }

  stop() {
    if (this.#timer !== undefined) {
      this.#scheduler?.clearInterval(this.#timer);
      this.#timer = undefined;
    }
  }

  /**
   * Queues the files not seen before, oldest first. While one can't be checked, nothing is queued,
   * so a file isn't read ahead of an older one; after about a minute, files that still can't be
   * checked are skipped with a warning entry added to `entries`.
   */
  #queueNewFiles(entries: IContentLogEntry[]) {
    let scan: ReturnType<typeof scanContentLogFiles>;

    try {
      scan = scanContentLogFiles(this.#fs, this.folder, (filePath) => this.#seen.has(filePath));
    } catch {
      // The folder can't be listed right now. Try again next poll, without counting this as the
      // first listing, so files already there still get the startup offsets rather than being read
      // from their start as new files.
      return;
    }

    const { files, unchecked } = scan;
    const stalledChecks = new Map<string, number>();

    for (const filePath of unchecked) {
      const polls = (this.#stalledChecks.get(filePath) ?? 0) + 1;

      if (polls < MAX_STALLED_POLLS) {
        stalledChecks.set(filePath, polls);
      } else {
        this.#seen.add(filePath);
        entries.push({ level: "warning", message: `Skipped ${path.basename(filePath)}: it couldn't be checked.` });
      }
    }

    this.#stalledChecks = stalledChecks;

    if (stalledChecks.size > 0) {
      return;
    }

    const firstListing = !this.#listed;
    this.#listed = true;

    files.forEach((file, index) => {
      this.#seen.add(file.filePath);

      if (!firstListing) {
        this.#queue.push({ ...file, offset: 0 });
      } else if (index === files.length - 1) {
        this.#queue.push({ ...file, offset: this.#startOffset(file) });
      } else if (this.#isCatchUp(file)) {
        this.#queue.push({ ...file, offset: Math.max(0, file.size - this.#catchUpBytes) });
      }
    });
  }

  /**
   * Reads the current file toward its end before switching to the next queued one, so entries a
   * bounded read hasn't reached yet aren't lost. `done` is set once it's finished: it was read to its
   * end, or it's gone. If it shrank, its new contents are read first. While it can't be read or
   * checked (it may be locked for a while), later polls retry; after about a minute of that, it's
   * given up on with a warning entry.
   */
  #drainBeforeSwitch(): { entries: IContentLogEntry[]; done: boolean } {
    const reader = this.#reader as ContentLogFileReader;
    let stat: { size: number } | undefined;
    let statFailed = false;

    try {
      stat = this.#fs.stat(reader.filePath);
    } catch {
      statFailed = true;
    }

    if (stat) {
      this.#readerSize = stat.size;
    }

    if (stat && stat.size < reader.offset) {
      const entries = reader.finish();
      this.#reader = new ContentLogFileReader(this.#fs, reader.filePath, 0);
      this.#stalledReadPolls = 0;
      this.#idleDrainPolls = 0;

      return { entries, done: false };
    }

    if (statFailed || (stat && stat.size > reader.offset)) {
      const before = reader.offset;
      const entries = stat ? reader.read(stat.size, this.#maxReadBytes) : [];

      if (reader.offset > before) {
        this.#stalledReadPolls = 0;
        this.#idleDrainPolls = 0;
        return { entries, done: false };
      }

      if (++this.#stalledReadPolls < MAX_STALLED_POLLS) {
        return { entries, done: false };
      }

      const unread = this.#readerSize - reader.offset;
      const name = path.basename(reader.filePath);
      const skipped: IContentLogEntry = {
        level: "warning",
        message:
          unread > 0
            ? `Stopped reading ${name}: ${unread} bytes couldn't be read.`
            : `Stopped reading ${name}: it couldn't be checked, so its last entries may be missing.`,
      };

      return { entries: [...reader.finish(), skipped], done: true };
    }

    // Minecraft may still be flushing the old file just after starting the new one, so it has to
    // stay the same size for one more poll before it's finished.
    this.#stalledReadPolls = 0;

    if (++this.#idleDrainPolls < 2) {
      return { entries: reader.flushIdle(), done: false };
    }

    return { entries: reader.finish(), done: true };
  }

  #isCatchUp(file: IContentLogFileInfo) {
    return this.#startAtEnd && this.#catchUpSinceMs !== undefined && file.mtimeMs >= this.#catchUpSinceMs;
  }

  #startOffset(file: IContentLogFileInfo) {
    if (!this.#startAtEnd) {
      return 0;
    }

    // Use the size from the same stat as the mtime, so bytes written since stay ahead of the reader.
    return this.#isCatchUp(file) ? Math.max(0, file.size - this.#catchUpBytes) : file.size;
  }
}

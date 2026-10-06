// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CliTranscriptHarness - runs `mct` commands in isolation and renders each run as a transcript: the
 * command, its exit code, stdout, stderr, the files it created, changed, or deleted, and the hosts it
 * tried to reach. Transcripts are normalized so the same run produces the same text on Windows,
 * macOS, and Linux, with or without a network. CliTranscriptTest.ts compares them with checked-in
 * snapshots; docs/CliTranscripts.md says when and how to update those.
 *
 * ISOLATION
 * - Each step runs against fresh copies of the fixture projects (shown as <work>) and an empty
 *   MCTOOLS_DATA_DIR (shown as <data-dir>), in a folder under the OS temp folder. Folders above the
 *   OS temp folder normally have no package.json, so the CLI's project-root discovery doesn't pick
 *   one of them, and the real Creator Tools profile is never read or written.
 * - Fixture text files are copied with LF line endings. Git checks them out with CRLF on Windows,
 *   which would change the file sizes that `info` reports.
 * - stdin is closed, and stdout and stderr are piped to separate buffers, so neither is a terminal.
 * - No request leaves the machine through axios, which the CLI uses for its version lookups. The
 *   CLI's proxy settings point at NetworkBlocker, a local proxy that refuses every request at once
 *   and records the host. Without it, a lookup the CLI makes without a timeout (registry.npmjs.org
 *   for @minecraft/* versions) would hang on a network that drops traffic, and its result would
 *   differ between machines. Node's fetch ignores proxy settings unless NODE_USE_ENV_PROXY is set,
 *   which prints a warning on Node 22; none of the recorded commands use fetch.
 * - The environment is the test process's, minus the variables in STRIPPED_ENV_VARS, plus the
 *   proxy settings, NODE_DISABLE_COLORS (see buildCliEnvironment), and the Minecraft version pin
 *   from TestVersionPin.ts. The pin keeps validate, info, and fix from looking up the latest
 *   version on raw.githubusercontent.com.
 *
 * NORMALIZATION (normalizeOutput), in this order:
 * 1. CRLF becomes LF.
 * 2. Absolute paths become placeholders (<work>, <data-dir>, <cli>, <repo>, <tmp>, <home>). Each
 *    root is matched in its native, forward-slash, and JSON-escaped forms, and Windows roots
 *    case-insensitively. Callers pass real paths too (macOS reports /var/... as /private/var/...).
 * 3. Backslashes become forward slashes: the recorded commands only print them as Windows path
 *    separators. Repeated slashes inside placeholder paths are collapsed.
 * 4. ISO timestamps become <timestamp>, durations <duration>, passcodes <passcode>, and the CLI
 *    version v<version>.
 * 5. Control characters are made visible: ESC as ␛, and a CR that doesn't end a line as ␍.
 *
 * OMITTED LINES (omitVolatileLines)
 * - Failed network lookups (NETWORK_LINE_PATTERNS). With every request refused, commands that load
 *   script module versions print a DEBUG line per failed lookup, which a user with a network doesn't
 *   see (a successful lookup prints nothing). Those lines are dropped so the transcript shows what
 *   most users see; the "network requests" section still lists the host.
 * - Validation worker lines (WORKER_CHECK_LINE, for steps with omitWorkerCheckLines). validate
 *   prints one line per check from a worker thread, and the CLI terminates the worker as soon as it
 *   returns its results. Lines the worker hasn't flushed by then are lost, so how many get through
 *   depends on timing: the first line on each stream, or all of them. The main thread's output,
 *   including the error list and the exit code, is kept.
 *
 * COMMON PITFALLS
 * - MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA must not reach these runs, or the EULA checks
 *   disappear from the transcripts. A developer's shell or another test in the same process can set
 *   it: TestDataDir removes an inherited value when it loads, and buildCliEnvironment strips it again
 *   for every run.
 * - Sort with plain string comparison, not localeCompare, so the order doesn't depend on the
 *   machine's locale.
 */

// tsconfig.test.json doesn't list Node's types, and ts-node may type-check this file on its own.
/// <reference types="node" />

import { spawn } from "child_process";
import { createHash } from "crypto";
import * as fs from "fs";
import * as http from "http";
import { AddressInfo, Socket } from "net";
import * as os from "os";
import * as path from "path";
import { Duplex } from "stream";
// This file starts processes, so it loads TestDataDir like every CLI test (CliTestIsolationTest
// checks for it). Each step still gets its own empty data folder from buildCliEnvironment.
import "./TestDataDir";
import { TEST_PINNED_MC_PREVIEW_VERSION, TEST_PINNED_MC_VERSION } from "./TestVersionPin";

/** One `mct` invocation to record. */
export interface ITranscriptStep {
  /** Snapshot file name, without the .txt extension. */
  id: string;

  /**
   * Arguments after `mct`. Use paths relative to <work>, so the transcript's command line is the same
   * on every machine.
   */
  args: string[];

  /** Folder to run in, relative to <work>. Defaults to <work>. */
  cwd?: string;

  /** Leave out the per-check lines that validate prints from its worker thread. See the file header. */
  omitWorkerCheckLines?: boolean;

  /** Shown at the top of the transcript, for context a reviewer needs. */
  note?: string;

  /** Defaults to DEFAULT_STEP_TIMEOUT_SEC. */
  timeoutSec?: number;
}

/** A project copied into <work> for every step. */
export interface ITranscriptFixture {
  /** Folder name under <work>. */
  name: string;

  /** Folder to copy. Leave undefined for an empty folder. */
  source?: string;
}

export type FileChangeKind = "created" | "changed" | "deleted";

export interface IFileChange {
  kind: FileChangeKind;

  /** Path relative to the root, with "/" separators. Folders end with "/". */
  path: string;
}

/** What one step did. */
export interface ITranscriptRun {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  durationMs: number;
  stdout: Buffer;
  stderr: Buffer;
  workChanges: IFileChange[];
  dataDirChanges: IFileChange[];

  /** Hosts the command tried to reach, as "host:port", sorted and without duplicates. */
  networkRequests: string[];
}

/** A root folder and the placeholder that replaces it in transcripts. */
export interface IPathRoot {
  placeholder: string;

  /** Every form of the path the CLI might print, such as the path as given and its real path. */
  paths: string[];
}

export interface INormalizeOptions {
  roots: IPathRoot[];

  /** The CLI version. "v" followed by it is shown as "v<version>". */
  version?: string;
}

export const DEFAULT_STEP_TIMEOUT_SEC = 60;

/**
 * Removed from the CLI's environment. Matched case-insensitively, because Windows environment
 * variable names are case-insensitive.
 */
export const STRIPPED_ENV_VARS = [
  // Would accept the EULA, so create and add would skip their EULA checks.
  "MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA",
  // Set to a fresh folder for each step.
  "MCTOOLS_DATA_DIR",
  // Set explicitly from TestVersionPin.ts.
  "MCT_TEST_PINNED_MC_VERSION",
  "MCT_TEST_PINNED_MC_PREVIEW_VERSION",
  // Replaced with NetworkBlocker's address. NO_PROXY could otherwise let a request through, and
  // NODE_USE_ENV_PROXY makes Node 22 print a warning.
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "NODE_USE_ENV_PROXY",
  // These change how libraries, the Node.js runtime, or logging behave.
  "NODE_ENV",
  "NODE_OPTIONS",
  "MCT_DEBUG",
  "DEBUG",
  // CI detection.
  "CI",
  "GITHUB_ACTIONS",
  "JENKINS",
  "TF_BUILD",
  // Terminal, width, and color settings read by the CLI or its prompt library. NODE_DISABLE_COLORS
  // is then set explicitly.
  "TERM",
  "TERM_PROGRAM",
  "TERMINAL_EMULATOR",
  "TERMINUS_SUBLIME",
  "COLORTERM",
  "COLUMNS",
  "LINES",
  "NO_COLOR",
  "FORCE_COLOR",
  "NODE_DISABLE_COLORS",
  "CLICOLOR",
  "CLICOLOR_FORCE",
  "WT_SESSION",
  "CONEMUTASK",
];

/** Lines about failed network lookups, which users with a network don't see. See the file header. */
export const NETWORK_LINE_PATTERNS: RegExp[] = [
  // registry.npmjs.org, for @minecraft/* script module versions.
  /Could not load registry for '/,
  // Status messages for script module and Minecraft version lookups when there's no network.
  /Could not connect to network to retrieve latest /,
  // raw.githubusercontent.com, for the latest Minecraft version. The version pin normally skips it.
  /Could not load version info from '/,
];

/** A check result printed by the validation worker, after normalization. See the file header. */
export const WORKER_CHECK_LINE = /^(?:␛\[[0-9;]*m)*\[<timestamp>\] \[[A-Z]+ *\] [A-Z]+: \[[A-Za-z0-9_]+\]/;

export const WORKER_CHECK_NOTE =
  "The per-check lines that validate prints from its worker thread are left out. The CLI stops the " +
  "worker as soon as it returns its results, so how many of those lines get through varies from run to run.";

const PATH_PLACEHOLDERS = ["<work>", "<data-dir>", "<cli>", "<repo>", "<tmp>", "<home>"];

/** Extensions copied byte for byte. Everything else that has no NUL byte is treated as text. */
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".tga",
  ".mcstructure",
  ".mcpack",
  ".mcaddon",
  ".mcworld",
  ".mctemplate",
  ".zip",
  ".ogg",
  ".wav",
  ".fsb",
]);

/** Generated folders that a fixture copy leaves out. */
const SKIPPED_FIXTURE_FOLDERS = new Set(["node_modules", "out"]);

/** Windows can briefly keep files busy after a process exits (antivirus scans, for example). */
const REMOVE_OPTIONS: fs.RmOptions = { recursive: true, force: true, maxRetries: 5, retryDelay: 200 };

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTrailingSeparators(value: string) {
  return value.replace(/[\\/]+$/, "");
}

/** The forms of an absolute path that the CLI may print: native, forward-slash, and JSON-escaped. */
export function getPathVariants(absolutePath: string): string[] {
  const variants = new Set<string>();
  const base = stripTrailingSeparators(absolutePath);

  if (base.length <= 1) {
    return [];
  }

  variants.add(base);
  variants.add(base.replace(/\\/g, "/"));

  if (base.includes("\\")) {
    variants.add(base.replace(/\\/g, "\\\\"));
  }

  return Array.from(variants);
}

function isWindowsPath(value: string) {
  return /^[A-Za-z]:[\\/]/.test(value) || value.includes("\\");
}

/**
 * Where an absolute path can start: the start of the text, after whitespace or punctuation that
 * comes before paths in messages, or right after an ANSI color code. Requiring this keeps a root
 * from matching in the middle of another path, such as /tmp inside /private/tmpfile or <repo>/tmp.
 */
const PATH_START = "(?<=^|[\\s'\"`([{=,;:]|\\x1b\\[[0-9;]*m)";

/** Replaces absolute paths, longest first, so a root inside another root wins. */
function replaceRoots(text: string, roots: IPathRoot[]) {
  const replacements: { variant: string; placeholder: string }[] = [];

  for (const root of roots) {
    for (const rootPath of root.paths) {
      for (const variant of getPathVariants(rootPath)) {
        replacements.push({ variant, placeholder: root.placeholder });
      }
    }
  }

  replacements.sort((a, b) => b.variant.length - a.variant.length);

  for (const { variant, placeholder } of replacements) {
    // The root must also end at a segment boundary: /tmp/work must not match /tmp/workspace.
    const pattern = new RegExp(
      PATH_START + escapeRegExp(variant) + "(?![A-Za-z0-9_-])",
      isWindowsPath(variant) ? "gim" : "gm"
    );
    text = text.replace(pattern, placeholder);
  }

  return text;
}

/** Makes CLI output comparable across machines and runs. See NORMALIZATION in the file header. */
export function normalizeOutput(text: string, options: INormalizeOptions): string {
  text = text.replace(/\r\n/g, "\n");
  text = replaceRoots(text, options.roots);
  text = text.replace(/\\/g, "/");

  const placeholderPath = new RegExp("(" + PATH_PLACEHOLDERS.map(escapeRegExp).join("|") + ")([^\\s'\"`]*)", "g");
  text = text.replace(placeholderPath, (_match, placeholder: string, rest: string) => {
    return placeholder + rest.replace(/\/{2,}/g, "/");
  });

  text = text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, "<timestamp>");

  text = text.replace(/\b\d+(?:\.\d+)?\s?ms\b/g, "<duration>");
  text = text.replace(/\b\d+\.\d+\s?s\b/g, "<duration>");
  text = text.replace(/\b\d+(?:\.\d+)?\s(?:seconds?|minutes?)\b/g, "<duration>");

  text = text.replace(/(passcode: )[A-Za-z0-9]{4}-[A-Za-z0-9]{4,}/gi, "$1<passcode>");

  if (options.version) {
    text = text.replace(new RegExp("(?<![0-9.])v" + escapeRegExp(options.version) + "(?![\\w.-])", "g"), "v<version>");
  }

  text = text.replace(/\x1b/g, "␛");
  text = text.replace(/\r/g, "␍");

  return text;
}

/**
 * Drops lines whose content depends on the network or on thread timing. Run it on normalized text,
 * since WORKER_CHECK_LINE expects the <timestamp> placeholder. See OMITTED LINES in the file header.
 */
export function omitVolatileLines(text: string, options: { omitWorkerCheckLines?: boolean }): string {
  return text
    .split("\n")
    .filter((line) => {
      if (NETWORK_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
        return false;
      }

      return !(options.omitWorkerCheckLines && WORKER_CHECK_LINE.test(line));
    })
    .join("\n");
}

interface ITreeEntry {
  isFolder: boolean;
  hash?: string;
}

/** Every file and folder under root, keyed by "/"-separated relative path. Folders end with "/". */
export function snapshotTree(root: string): Map<string, ITreeEntry> {
  const entries = new Map<string, ITreeEntry>();

  const walk = (folder: string, prefix: string) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const fullPath = path.join(folder, entry.name);

      if (entry.isDirectory()) {
        entries.set(prefix + entry.name + "/", { isFolder: true });
        walk(fullPath, prefix + entry.name + "/");
      } else {
        // A link is compared by its target rather than followed, so a link to a folder can't throw.
        const content = entry.isSymbolicLink() ? fs.readlinkSync(fullPath) : fs.readFileSync(fullPath);
        const hash = createHash("sha1").update(content).digest("hex");
        entries.set(prefix + entry.name, { isFolder: false, hash });
      }
    }
  };

  if (fs.existsSync(root)) {
    walk(root, "");
  }

  return entries;
}

function hasChildren(tree: Map<string, ITreeEntry>, folderPath: string) {
  for (const key of tree.keys()) {
    if (key !== folderPath && key.startsWith(folderPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Files created, changed, or deleted between two snapshots. A created or deleted folder is listed
 * only when it's empty, since its files already show where it is.
 */
export function diffTrees(before: Map<string, ITreeEntry>, after: Map<string, ITreeEntry>): IFileChange[] {
  const changes: IFileChange[] = [];

  for (const [entryPath, entry] of after) {
    const previous = before.get(entryPath);

    if (!previous) {
      if (!entry.isFolder || !hasChildren(after, entryPath)) {
        changes.push({ kind: "created", path: entryPath });
      }
    } else if (!entry.isFolder && entry.hash !== previous.hash) {
      changes.push({ kind: "changed", path: entryPath });
    }
  }

  for (const [entryPath, entry] of before) {
    if (!after.has(entryPath) && (!entry.isFolder || !hasChildren(before, entryPath))) {
      changes.push({ kind: "deleted", path: entryPath });
    }
  }

  return changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Copies a fixture with LF line endings in text files, leaving out generated and empty folders. */
export function copyFixture(source: string, destination: string) {
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      if (!SKIPPED_FIXTURE_FOLDERS.has(entry.name)) {
        copyFixture(sourcePath, destinationPath);

        // Git can't track empty folders, so a stray one is local state, not part of the fixture.
        if (fs.readdirSync(destinationPath).length === 0) {
          fs.rmdirSync(destinationPath);
        }
      }
    } else if (entry.isFile()) {
      let content = fs.readFileSync(sourcePath);

      if (!BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && !content.includes(0)) {
        content = Buffer.from(content.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
      }

      fs.writeFileSync(destinationPath, content);
    }
  }
}

/**
 * The environment for a CLI run. See ISOLATION in the file header. Proxy variables are set in
 * upper case only: axios reads either case, inherited ones of both cases are stripped, and Windows
 * treats the two spellings as one variable. NODE_USE_ENV_PROXY stays unset, because Node 22 then
 * prints an experimental-feature warning that would end up in every transcript.
 *
 * NODE_DISABLE_COLORS keeps output plain on every OS from code that asks Node whether the
 * environment supports color instead of whether the stream is a terminal: Node says yes on Windows
 * even for a pipe. The prompt library's colors worked that way. The CLI's own colors check for a
 * terminal, so they're off in these piped runs either way.
 */
export function buildCliEnvironment(
  dataDir: string,
  proxyUrl: string,
  baseEnv: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const stripped = new Set(STRIPPED_ENV_VARS.map((name) => name.toUpperCase()));
  const env: NodeJS.ProcessEnv = {};

  for (const [name, value] of Object.entries(baseEnv)) {
    if (!stripped.has(name.toUpperCase())) {
      env[name] = value;
    }
  }

  env.MCTOOLS_DATA_DIR = dataDir;
  env.MCT_TEST_PINNED_MC_VERSION = TEST_PINNED_MC_VERSION;
  env.MCT_TEST_PINNED_MC_PREVIEW_VERSION = TEST_PINNED_MC_PREVIEW_VERSION;
  env.HTTP_PROXY = proxyUrl;
  env.HTTPS_PROXY = proxyUrl;
  env.NODE_DISABLE_COLORS = "1";

  return env;
}

/**
 * A local HTTP proxy that refuses every request at once: CONNECT tunnels (HTTPS) and plain HTTP
 * requests both get a 403. With the CLI's proxy settings pointing here, no request leaves the
 * machine, and every lookup fails the same way and without waiting, on any network. It records the
 * host of each request, which transcripts list.
 */
export class NetworkBlocker {
  private readonly server: http.Server;
  private readonly sockets = new Set<Socket>();
  private requests: string[] = [];
  private address = "";

  constructor() {
    this.server = http.createServer((request, response) => {
      this.requests.push(NetworkBlocker.getHost(request.url ?? "", 80));
      response.writeHead(403, { Connection: "close" });
      response.end();
    });

    this.server.on("connect", (request: http.IncomingMessage, socket: Duplex) => {
      this.requests.push(NetworkBlocker.getHost(request.url ?? "", 443));
      socket.on("error", () => {});
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    });

    this.server.on("connection", (socket: Socket) => {
      this.sockets.add(socket);
      socket.on("close", () => this.sockets.delete(socket));
    });
  }

  /** The proxy URL to give the CLI. Throws until start() has finished. */
  get url(): string {
    if (!this.address) {
      throw new Error("NetworkBlocker hasn't started.");
    }

    return this.address;
  }

  async start() {
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", () => resolve());
    });

    this.address = "http://127.0.0.1:" + (this.server.address() as AddressInfo).port;
  }

  /** The hosts requested since the last call, as sorted, unique "host:port" values. */
  takeRequests(): string[] {
    const hosts = Array.from(new Set(this.requests)).sort();
    this.requests = [];

    return hosts;
  }

  async stop() {
    for (const socket of this.sockets) {
      socket.destroy();
    }

    if (this.server.listening) {
      await new Promise<void>((resolve) => this.server.close(() => resolve()));
    }
  }

  /** "host:port" from a CONNECT target ("host:443") or a proxied URL ("http://host/path"). */
  static getHost(target: string, defaultPort: number): string {
    if (/^[^/]+:\d+$/.test(target)) {
      return target.toLowerCase();
    }

    try {
      const url = new URL(target);

      return url.hostname.toLowerCase() + ":" + (url.port || defaultPort);
    } catch {
      return target;
    }
  }
}

function renderStream(name: string, text: string): string[] {
  if (text.length === 0) {
    return [name + ": (empty)"];
  }

  const endsWithNewline = text.endsWith("\n");
  const lines = [name + ":", ...(endsWithNewline ? text.slice(0, -1) : text).split("\n")];

  if (!endsWithNewline) {
    lines.push("(no newline at end of " + name + ")");
  }

  return lines;
}

function renderChanges(title: string, changes: IFileChange[]): string[] {
  if (changes.length === 0) {
    return [title + ": (none)"];
  }

  return [title + ":", ...changes.map((change) => "  " + change.kind + " " + change.path)];
}

function renderNetworkRequests(hosts: string[]): string[] {
  if (hosts.length === 0) {
    return ["network requests: (none)"];
  }

  return ["network requests (refused by the test):", ...hosts.map((host) => "  " + host)];
}

/** Shows an argument as typed in a shell; JSON quoting escapes backslashes and quotes. */
function quoteArgument(arg: string) {
  return /^[\w./:=@,+-]+$/.test(arg) ? arg : JSON.stringify(arg);
}

/** Renders a run as transcript text. stdout and stderr must already be normalized. */
export function renderTranscript(
  step: ITranscriptStep,
  run: Pick<ITranscriptRun, "exitCode" | "signal" | "workChanges" | "dataDirChanges" | "networkRequests">,
  stdout: string,
  stderr: string
): string {
  const lines = [
    "$ mct " + step.args.map(quoteArgument).join(" "),
    "cwd: " + (step.cwd ? "<work>/" + step.cwd : "<work>"),
    "exit code: " + (run.exitCode !== null ? run.exitCode : "none (signal " + run.signal + ")"),
  ];

  if (step.note) {
    lines.push("note: " + step.note);
  }

  if (step.omitWorkerCheckLines) {
    lines.push("note: " + WORKER_CHECK_NOTE);
  }

  lines.push(
    "",
    ...renderStream("stdout", stdout),
    "",
    ...renderStream("stderr", stderr),
    "",
    ...renderChanges("files under <work>", run.workChanges),
    "",
    ...renderChanges("files under <data-dir>", run.dataDirChanges),
    "",
    ...renderNetworkRequests(run.networkRequests)
  );

  return lines.join("\n") + "\n";
}

/**
 * Owns what a series of steps shares: a pristine copy of the fixtures, the <work> and <data-dir>
 * folders that are recreated for every step, and the NetworkBlocker. Create it with
 * CliTranscriptHarness.create(), and call dispose() when done.
 */
export default class CliTranscriptHarness {
  readonly cliPath: string;
  readonly cliRoot: string;
  readonly repoRoot: string;
  readonly version: string | undefined;

  private readonly tempRoot: string;
  private readonly pristineFolder: string;
  private readonly blocker = new NetworkBlocker();
  readonly workFolder: string;
  readonly dataDir: string;

  private constructor(options: { cliRoot: string; repoRoot: string; fixtures: ITranscriptFixture[] }) {
    this.cliRoot = path.resolve(options.cliRoot);
    this.cliPath = path.join(this.cliRoot, "cli", "index.mjs");
    this.repoRoot = path.resolve(options.repoRoot);

    const packageJsonPath = path.join(this.cliRoot, "package.json");
    this.version = fs.existsSync(packageJsonPath)
      ? JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).version
      : undefined;

    // A real path, so cwd matches what the CLI reports (macOS maps /var to /private/var).
    this.tempRoot = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "mct-transcripts-")));
    this.pristineFolder = path.join(this.tempRoot, "pristine");
    this.workFolder = path.join(this.tempRoot, "work");
    this.dataDir = path.join(this.tempRoot, "data");

    fs.mkdirSync(this.pristineFolder);

    for (const fixture of options.fixtures) {
      const destination = path.join(this.pristineFolder, fixture.name);

      if (fixture.source) {
        copyFixture(fixture.source, destination);
      } else {
        fs.mkdirSync(destination);
      }
    }
  }

  /** Copies the fixtures and starts the NetworkBlocker. */
  static async create(options: {
    cliRoot: string;
    repoRoot: string;
    fixtures: ITranscriptFixture[];
  }): Promise<CliTranscriptHarness> {
    const harness = new CliTranscriptHarness(options);

    try {
      await harness.blocker.start();
    } catch (err) {
      await harness.dispose();
      throw err;
    }

    return harness;
  }

  /** Placeholders for every absolute path that may show up in output. */
  get roots(): IPathRoot[] {
    const withRealPath = (folder: string) => {
      const paths = [folder];

      try {
        paths.push(fs.realpathSync.native(folder));
      } catch {
        // The folder doesn't exist (yet); the path as given is enough.
      }

      return paths;
    };

    return [
      { placeholder: "<work>", paths: withRealPath(this.workFolder) },
      { placeholder: "<data-dir>", paths: withRealPath(this.dataDir) },
      { placeholder: "<cli>", paths: withRealPath(this.cliRoot) },
      { placeholder: "<repo>", paths: withRealPath(this.repoRoot) },
      { placeholder: "<tmp>", paths: withRealPath(os.tmpdir()) },
      { placeholder: "<home>", paths: withRealPath(os.homedir()) },
    ];
  }

  /** Runs one step against fresh copies of the fixtures and an empty data folder. */
  async run(step: ITranscriptStep): Promise<ITranscriptRun> {
    fs.rmSync(this.workFolder, REMOVE_OPTIONS);
    fs.rmSync(this.dataDir, REMOVE_OPTIONS);
    fs.cpSync(this.pristineFolder, this.workFolder, { recursive: true });
    fs.mkdirSync(this.dataDir);

    const workBefore = snapshotTree(this.workFolder);
    const dataBefore = snapshotTree(this.dataDir);
    const timeoutMs = (step.timeoutSec ?? DEFAULT_STEP_TIMEOUT_SEC) * 1000;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const env = buildCliEnvironment(this.dataDir, this.blocker.url);
    const started = Date.now();

    this.blocker.takeRequests();

    const result = await new Promise<{ code: number | null; signal: string | null; timedOut: boolean }>(
      (resolve, reject) => {
        const child = spawn(process.execPath, [this.cliPath, ...step.args], {
          cwd: step.cwd ? path.join(this.workFolder, step.cwd) : this.workFolder,
          env,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });

        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill();
        }, timeoutMs);

        child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
        child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
        child.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
        child.on("close", (code, signal) => {
          clearTimeout(timer);
          resolve({ code, signal, timedOut });
        });
      }
    );

    return {
      exitCode: result.code,
      signal: result.signal,
      timedOut: result.timedOut,
      durationMs: Date.now() - started,
      stdout: Buffer.concat(stdoutChunks),
      stderr: Buffer.concat(stderrChunks),
      workChanges: diffTrees(workBefore, snapshotTree(this.workFolder)),
      dataDirChanges: diffTrees(dataBefore, snapshotTree(this.dataDir)),
      networkRequests: this.blocker.takeRequests(),
    };
  }

  /** The normalized transcript of a run. */
  render(step: ITranscriptStep, run: ITranscriptRun): string {
    const options: INormalizeOptions = { roots: this.roots, version: this.version };
    const clean = (output: Buffer) => omitVolatileLines(normalizeOutput(output.toString("utf8"), options), step);

    return renderTranscript(step, run, clean(run.stdout), clean(run.stderr));
  }

  /**
   * A machine-specific path that normalization missed, if any: one of the roots in any form, or an
   * absolute Windows path. Checked before a transcript is compared or saved, so a snapshot can't
   * pass on one machine and fail on every other.
   */
  findLeakedPath(transcript: string): string | undefined {
    const lowered = transcript.toLowerCase();

    for (const root of this.roots) {
      for (const rootPath of root.paths) {
        // Very short roots, such as /tmp, can appear in ordinary text.
        for (const variant of getPathVariants(rootPath).filter((value) => value.length >= 8)) {
          if (lowered.includes(variant.toLowerCase())) {
            return variant;
          }
        }
      }
    }

    return transcript.match(/(?:^|[\s'"`(])([A-Za-z]:[\\/][^\s'"`)]*)/m)?.[1];
  }

  async dispose() {
    await this.blocker.stop();
    fs.rmSync(this.tempRoot, REMOVE_OPTIONS);
  }
}

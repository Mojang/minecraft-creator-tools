// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CliTranscriptTest - Snapshot test for what the mct core workflow prints: validate, fix, create, add,
 * exportaddon, deploy, info, and help.
 *
 * Each step in TRANSCRIPT_STEPS runs the built CLI (toolbuild/jsn/cli/index.mjs) in isolation and
 * compares its normalized transcript (see CliTranscriptHarness.ts) with
 * app/test/scenarios/cliTranscripts/<id>.txt. The actual transcript is always written to
 * app/test/results/cliTranscripts/<id>.txt.
 *
 * When a change to this output is intended, rebuild the CLI, run `npm run update-cli-transcripts` in
 * app/, and commit the updated snapshots, so reviewers see exactly how the output changed. See
 * docs/CliTranscripts.md.
 *
 * Snapshots show what the output looks like; they don't prove it's right. Keep asserting counts,
 * paths, and next steps in the tests for the behavior itself.
 *
 * FIXTURES (copied into <work> for every step)
 * - simple: samplecontent/simple, a clean behavior pack with no script module dependencies.
 * - platform_version_errors: samplecontent/platform_version_errors, a behavior and resource pack
 *   with errors in two checks and no script module dependencies. It stands in for
 *   samplecontent/addon, whose @minecraft/* dependencies make validate and info look up versions on
 *   registry.npmjs.org, so their results depend on whether that lookup works.
 * - empty: an empty folder.
 *
 * Not covered: --json output (CliJsonContractTest checks it), and commands that start servers,
 * browsers, or Minecraft.
 */

// tsconfig.test.json doesn't list Node's types, and ts-node may type-check this file on its own.
/// <reference types="node" />

import { expect } from "chai";
import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";
import CliTranscriptHarness, {
  buildCliEnvironment,
  copyFixture,
  DEFAULT_STEP_TIMEOUT_SEC,
  diffTrees,
  IPathRoot,
  ITranscriptFixture,
  ITranscriptStep,
  NetworkBlocker,
  normalizeOutput,
  omitVolatileLines,
  renderTranscript,
  snapshotTree,
  WORKER_CHECK_NOTE,
} from "./CliTranscriptHarness";
import TestPaths from "./TestPaths";
import { TEST_PINNED_MC_PREVIEW_VERSION, TEST_PINNED_MC_VERSION } from "./TestVersionPin";

const UPDATE_SNAPSHOTS = process.env.UPDATE_CLI_TRANSCRIPTS === "1";

const CLI_ROOT = path.resolve(TestPaths.appRoot, "toolbuild", "jsn");
const SNAPSHOT_FOLDER = path.resolve(TestPaths.testRoot, "scenarios", "cliTranscripts");
const RESULTS_FOLDER = path.resolve(TestPaths.testRoot, "results", "cliTranscripts");

const FIXTURES: ITranscriptFixture[] = [
  { name: "simple", source: TestPaths.sampleContentPath("simple") },
  { name: "platform_version_errors", source: TestPaths.sampleContentPath("platform_version_errors") },
  { name: "empty" },
];

/**
 * The recorded commands. To add one, add a step, then run `npm run update-cli-transcripts` and check
 * that the new snapshot is stable (run the test a few times) and free of machine-specific values.
 */
const TRANSCRIPT_STEPS: ITranscriptStep[] = [
  { id: "validate-clean", args: ["validate", "-i", "simple"], omitWorkerCheckLines: true },
  { id: "validate-clean-quiet", args: ["validate", "-i", "simple", "-q"] },
  { id: "validate-errors", args: ["validate", "-i", "platform_version_errors"], omitWorkerCheckLines: true },
  { id: "validate-errors-quiet", args: ["validate", "-i", "platform_version_errors", "-q"] },
  { id: "validate-empty", args: ["validate", "-i", "empty"], omitWorkerCheckLines: true },

  { id: "fix-list", args: ["fix", "--list"], cwd: "simple" },
  { id: "fix-dry-run", args: ["fix", "setnewestminengineversion", "-i", "simple", "-n"] },
  { id: "fix-apply", args: ["fix", "setnewestminengineversion", "-i", "simple"] },

  { id: "create-no-arguments", args: ["create"] },
  { id: "create-yes-without-eula", args: ["create", "my-addon", "--yes"] },
  {
    id: "create-success",
    args: ["create", "testerName", "addonStarter", "testerCreatorName", "testerDescription", "-o", "created"],
    note:
      "testerName and testerCreatorName are test-only names that skip the EULA check without accepting it. " +
      "The DEBUG lines about the refused registry.npmjs.org lookups are left out.",
  },
  {
    id: "create-prompt-without-terminal",
    args: ["create", "testerName", "addonStarter", "testerCreatorName"],
    note: "The test-only names skip the EULA check, and the description is missing, so create needs to ask for it.",
  },

  { id: "add-list-types", args: ["add", "--list-types"], cwd: "simple" },

  { id: "exportaddon", args: ["exportaddon", "-i", "simple", "-o", "exported"] },

  { id: "deploy-folder", args: ["deploy", "folder", "-i", "simple", "-o", "deployed"] },
  { id: "deploy-server-without-path", args: ["deploy", "server", "-i", "simple"] },
  { id: "deploy-server-path", args: ["deploy", "server", "-i", "simple", "--server-path", "server"] },

  { id: "info-clean", args: ["info", "-i", "simple"] },
  { id: "info-errors", args: ["info", "-i", "platform_version_errors"] },

  { id: "help-root", args: ["--help"] },
  { id: "help-validate", args: ["help", "validate"] },
];

/** What the CLI needs from the full build. jsncorebuild alone leaves out res/, which changes the output. */
const REQUIRED_BUILD_PATHS = [
  path.join("cli", "index.mjs"),
  path.join("res", "samples", "microsoft", "samples", "addon_starter"),
  path.join("res", "latest", "schemas"),
];

describe("CLI transcripts", function () {
  let harness: CliTranscriptHarness | undefined;

  before(async function () {
    this.timeout(60000);

    const missing = REQUIRED_BUILD_PATHS.filter((buildPath) => !fs.existsSync(path.join(CLI_ROOT, buildPath)));

    if (missing.length > 0) {
      throw new Error(
        "The CLI transcript test needs the full CLI build in toolbuild/jsn/ (missing: " +
          missing.join(", ") +
          "). In app/, run `npm run jsnbuild`."
      );
    }

    harness = await CliTranscriptHarness.create({
      cliRoot: CLI_ROOT,
      repoRoot: TestPaths.repoRoot,
      fixtures: FIXTURES,
    });

    fs.rmSync(RESULTS_FOLDER, { recursive: true, force: true });
    fs.mkdirSync(RESULTS_FOLDER, { recursive: true });
    fs.mkdirSync(SNAPSHOT_FOLDER, { recursive: true });
  });

  after(async () => {
    await harness?.dispose();
  });

  for (const step of TRANSCRIPT_STEPS) {
    const command = "mct " + step.args.join(" ");

    it(`${step.id}: ${command}`, async function () {
      const timeoutSec = step.timeoutSec ?? DEFAULT_STEP_TIMEOUT_SEC;
      this.timeout((timeoutSec + 30) * 1000);

      const run = await harness!.run(step);
      expect(run.timedOut, `'${command}' didn't finish within ${timeoutSec} seconds`).to.equal(false);

      const transcript = harness!.render(step, run);
      fs.writeFileSync(path.join(RESULTS_FOLDER, step.id + ".txt"), transcript);

      const leakedPath = harness!.findLeakedPath(transcript);
      expect(
        leakedPath,
        `The transcript for '${command}' contains a machine-specific path. Extend the normalization in ` +
          "CliTranscriptHarness.ts to replace it."
      ).to.equal(undefined);

      const snapshotPath = path.join(SNAPSHOT_FOLDER, step.id + ".txt");

      if (UPDATE_SNAPSHOTS) {
        fs.writeFileSync(snapshotPath, transcript);
        return;
      }

      expect(
        fs.existsSync(snapshotPath),
        `There's no snapshot for '${step.id}'. Run \`npm run update-cli-transcripts\` in app/.`
      ).to.equal(true);

      const expected = fs.readFileSync(snapshotPath, "utf8").replace(/\r\n/g, "\n");

      expect(transcript).to.equal(
        expected,
        `The output of '${command}' changed. If that's intended, rebuild the CLI, run ` +
          "`npm run update-cli-transcripts` in app/, and review the snapshot diff. Actual transcript: " +
          `app/test/results/cliTranscripts/${step.id}.txt`
      );
    });
  }

  it("has one snapshot per step and none for removed steps", () => {
    const stepFiles = TRANSCRIPT_STEPS.map((step) => step.id + ".txt").sort();
    expect(new Set(stepFiles).size, "step ids must be unique").to.equal(stepFiles.length);

    if (UPDATE_SNAPSHOTS) {
      for (const file of fs.readdirSync(SNAPSHOT_FOLDER)) {
        if (!stepFiles.includes(file)) {
          fs.rmSync(path.join(SNAPSHOT_FOLDER, file));
        }
      }
    }

    expect(fs.readdirSync(SNAPSHOT_FOLDER).sort()).to.deep.equal(stepFiles);
  });
});

describe("CLI transcript harness", () => {
  const roots: IPathRoot[] = [
    { placeholder: "<work>", paths: ["/tmp/mct-transcripts-abc/work", "/private/tmp/mct-transcripts-abc/work"] },
    { placeholder: "<data-dir>", paths: ["C:\\Users\\Runner\\AppData\\Local\\Temp\\mct-transcripts-abc\\data"] },
    { placeholder: "<tmp>", paths: ["/tmp"] },
  ];

  describe("normalizeOutput", () => {
    const cases: { name: string; input: string; expected: string }[] = [
      {
        name: "replaces ISO timestamps",
        input: "[2026-09-30T03:14:32.421Z] [MESSAGE ] Done",
        expected: "[<timestamp>] [MESSAGE ] Done",
      },
      {
        name: "makes ESC and a lone CR visible and turns CRLF into LF",
        input: "\x1b[32mOK\x1b[0m\r\n\r[====] 1/1\n",
        expected: "␛[32mOK␛[0m\n␍[====] 1/1\n",
      },
      {
        name: "replaces a POSIX root and its real path",
        input: "in (-i): /private/tmp/mct-transcripts-abc/work/simple  out (-o): /tmp/mct-transcripts-abc/work/out",
        expected: "in (-i): <work>/simple  out (-o): <work>/out",
      },
      {
        name: "replaces roots right after an ANSI color code, in quotes, and at the start of a line",
        input: "\x1b[2m/tmp/mct-transcripts-abc/work/simple\x1b[0m to '/tmp/mct-transcripts-abc/work/out/'\n/tmp/x",
        expected: "␛[2m<work>/simple␛[0m to '<work>/out/'\n<tmp>/x",
      },
      {
        name: "replaces Windows roots in any case and with either separator",
        input:
          "c:\\users\\runner\\appdata\\local\\temp\\mct-transcripts-abc\\data\\cli\\ " +
          "C:/Users/Runner/AppData/Local/Temp/mct-transcripts-abc/data/server",
        expected: "<data-dir>/cli/ <data-dir>/server",
      },
      {
        name: "replaces JSON-escaped Windows roots",
        input: '{"path":"C:\\\\Users\\\\Runner\\\\AppData\\\\Local\\\\Temp\\\\mct-transcripts-abc\\\\data\\\\cli"}',
        expected: '{"path":"<data-dir>/cli"}',
      },
      {
        name: "replaces only whole path segments",
        input: "/tmp/mct-transcripts-abc/workspace /tmp2 /private/tmpfile",
        expected: "<tmp>/mct-transcripts-abc/workspace /tmp2 /private/tmpfile",
      },
      {
        name: "doesn't replace a root inside a path that another root already replaced",
        input: "/tmp/mct-transcripts-abc/work/tmp/a",
        expected: "<work>/tmp/a",
      },
      {
        name: "shows backslash separators in relative paths as slashes",
        input: "Deploying project 'simple' to 'server\\'...",
        expected: "Deploying project 'simple' to 'server/'...",
      },
      {
        name: "collapses repeated separators inside placeholder paths but not in URLs",
        input: "/tmp/mct-transcripts-abc/work\\\\created/ https://aka.ms/mctbugs",
        expected: "<work>/created/ https://aka.ms/mctbugs",
      },
      {
        name: "replaces durations",
        input: "Validated in 1234ms (1.2 s), then waited 3 seconds",
        expected: "Validated in <duration> (<duration>), then waited <duration>",
      },
      {
        name: "replaces passcodes",
        input: "  Admin/full developer passcode: AB12-CD34",
        expected: "  Admin/full developer passcode: <passcode>",
      },
      {
        name: "replaces the CLI version but not other versions",
        input: "mct \x1b[2mv0.0.1-dev\x1b[0m, format_version 0.0.1-dev, min_engine_version 1.26.20",
        expected: "mct ␛[2mv<version>␛[0m, format_version 0.0.1-dev, min_engine_version 1.26.20",
      },
    ];

    for (const testCase of cases) {
      it(testCase.name, () => {
        expect(normalizeOutput(testCase.input, { roots, version: "0.0.1-dev" })).to.equal(testCase.expected);
      });
    }
  });

  describe("omitVolatileLines", () => {
    const workerLines =
      "[<timestamp>] [MESSAGE ] UNKNOWN: [BASEGAMEVER002] No applicable items found\n" +
      "␛[31m[<timestamp>] [ERROR   ] TESTFAIL: [CHKMANIF000] Found 4 errors in Manifest Validation check␛[0m\n";
    const mainThreadLines =
      "[<timestamp>] [MESSAGE ] ␛[32m[##]␛[0m ␛[1mmct␛[0m\n" +
      "Processing project 1/1: simple\n" +
      "␛[31mError: Test Fail: Found 4 errors in Manifest Validation check␛[0m\n";

    const cases: { name: string; input: string; omitWorkerCheckLines: boolean; expected: string }[] = [
      {
        name: "drops failed registry lookups",
        input:
          "Creating project\n" +
          "[<timestamp>] [DEBUG   ] Could not load registry for '@minecraft/server': Error: read ENOTCONN\n" +
          "Project created\n",
        omitWorkerCheckLines: false,
        expected: "Creating project\nProject created\n",
      },
      {
        name: "drops worker check lines when asked, keeping main-thread lines",
        input: workerLines + mainThreadLines,
        omitWorkerCheckLines: true,
        expected: mainThreadLines,
      },
      {
        name: "keeps worker check lines otherwise",
        input: workerLines,
        omitWorkerCheckLines: false,
        expected: workerLines,
      },
    ];

    for (const testCase of cases) {
      it(testCase.name, () => {
        expect(omitVolatileLines(testCase.input, { omitWorkerCheckLines: testCase.omitWorkerCheckLines })).to.equal(
          testCase.expected
        );
      });
    }
  });

  describe("renderTranscript", () => {
    it("lays out the command, exit code, notes, streams, file changes, and network requests", () => {
      const transcript = renderTranscript(
        {
          id: "example",
          args: ["create", "My Add-on", 'C:\\Say "hi"'],
          cwd: "simple",
          note: "An example.",
          omitWorkerCheckLines: true,
        },
        {
          exitCode: 1,
          signal: null,
          workChanges: [{ kind: "created", path: "simple/out/" }],
          dataDirChanges: [],
          networkRequests: ["registry.npmjs.org:443"],
        },
        "? Name? ␛[59G",
        ""
      );

      expect(transcript).to.equal(
        [
          '$ mct create "My Add-on" "C:\\\\Say \\"hi\\""',
          "cwd: <work>/simple",
          "exit code: 1",
          "note: An example.",
          "note: " + WORKER_CHECK_NOTE,
          "",
          "stdout:",
          "? Name? ␛[59G",
          "(no newline at end of stdout)",
          "",
          "stderr: (empty)",
          "",
          "files under <work>:",
          "  created simple/out/",
          "",
          "files under <data-dir>: (none)",
          "",
          "network requests (refused by the test):",
          "  registry.npmjs.org:443",
          "",
        ].join("\n")
      );
    });
  });

  describe("file changes", () => {
    let folder: string;

    beforeEach(() => {
      folder = fs.mkdtempSync(path.join(os.tmpdir(), "mct-transcript-harness-"));
    });

    afterEach(() => {
      fs.rmSync(folder, { recursive: true, force: true });
    });

    it("lists created files, empty created folders, changed files, and deleted files", () => {
      fs.mkdirSync(path.join(folder, "project"));
      fs.writeFileSync(path.join(folder, "project", "manifest.json"), "{}");
      fs.writeFileSync(path.join(folder, "project", "old.json"), "{}");
      const before = snapshotTree(folder);

      fs.writeFileSync(path.join(folder, "project", "manifest.json"), '{"changed":true}');
      fs.rmSync(path.join(folder, "project", "old.json"));
      fs.mkdirSync(path.join(folder, "out", "reports"), { recursive: true });
      fs.writeFileSync(path.join(folder, "out", "reports", "project.csv"), "a,b");
      fs.mkdirSync(path.join(folder, "project", "textures", "empty"), { recursive: true });

      expect(diffTrees(before, snapshotTree(folder))).to.deep.equal([
        { kind: "created", path: "out/reports/project.csv" },
        { kind: "changed", path: "project/manifest.json" },
        { kind: "deleted", path: "project/old.json" },
        { kind: "created", path: "project/textures/empty/" },
      ]);
    });

    it("copies fixtures with LF line endings, leaving out binary content, generated folders, and empty folders", () => {
      const source = path.join(folder, "source");
      const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      fs.mkdirSync(path.join(source, "node_modules", "dep"), { recursive: true });
      fs.mkdirSync(path.join(source, "empty", "nested"), { recursive: true });
      fs.writeFileSync(path.join(source, "manifest.json"), '{\r\n  "a": 1\r\n}\r\n');
      fs.writeFileSync(path.join(source, "pack_icon.png"), binary);
      fs.writeFileSync(path.join(source, "node_modules", "dep", "index.js"), "x");

      const destination = path.join(folder, "destination");
      copyFixture(source, destination);

      expect(fs.readdirSync(destination).sort()).to.deep.equal(["manifest.json", "pack_icon.png"]);
      expect(fs.readFileSync(path.join(destination, "manifest.json"), "utf8")).to.equal('{\n  "a": 1\n}\n');
      expect(fs.readFileSync(path.join(destination, "pack_icon.png")).equals(binary)).to.equal(true);
    });
  });

  describe("buildCliEnvironment", () => {
    it("removes variables that change the CLI's behavior, in any case, and sets the data folder, version pin, and proxy", () => {
      const env = buildCliEnvironment("/tmp/data", "http://127.0.0.1:5555", {
        PATH: "/usr/bin",
        Mctools_I_Accept_Eula_At_MinecraftDotNetSlashEula: "true",
        NODE_ENV: "test",
        FORCE_COLOR: "1",
        MCTOOLS_DATA_DIR: "/home/user/.mctools",
        MCT_TEST_PINNED_MC_VERSION: "9.9.9",
        https_proxy: "http://corporate-proxy:8080",
        HTTP_PROXY: "http://corporate-proxy:8080",
        no_proxy: "registry.npmjs.org",
        NODE_USE_ENV_PROXY: "1",
      });

      expect(env).to.deep.equal({
        PATH: "/usr/bin",
        MCTOOLS_DATA_DIR: "/tmp/data",
        MCT_TEST_PINNED_MC_VERSION: TEST_PINNED_MC_VERSION,
        MCT_TEST_PINNED_MC_PREVIEW_VERSION: TEST_PINNED_MC_PREVIEW_VERSION,
        HTTP_PROXY: "http://127.0.0.1:5555",
        HTTPS_PROXY: "http://127.0.0.1:5555",
        NODE_DISABLE_COLORS: "1",
      });
    });
  });

  describe("NetworkBlocker", () => {
    let blocker: NetworkBlocker;

    /**
     * Sends a request through the blocker and returns the status code it answers with. A fresh
     * agent ignores proxy variables in this process's environment, and the timeout keeps a
     * misrouted request from holding the test run open.
     */
    function requestThrough(options: http.RequestOptions): Promise<number | undefined> {
      const port = Number(new URL(blocker.url).port);

      return new Promise((resolve, reject) => {
        const request = http.request({ host: "127.0.0.1", port, agent: false, ...options });
        request.setTimeout(5000, () => request.destroy(new Error("No answer from NetworkBlocker")));
        request.on("connect", (response, socket) => {
          socket.destroy();
          resolve(response.statusCode);
        });
        request.on("response", (response) => {
          response.resume();
          resolve(response.statusCode);
        });
        request.on("error", reject);
        request.end();
      });
    }

    beforeEach(async () => {
      blocker = new NetworkBlocker();
      await blocker.start();
    });

    afterEach(async () => {
      await blocker.stop();
    });

    it("refuses HTTPS tunnels and plain HTTP requests, and records each host once", async () => {
      expect(await requestThrough({ method: "CONNECT", path: "registry.npmjs.org:443" })).to.equal(403);
      expect(await requestThrough({ method: "CONNECT", path: "registry.npmjs.org:443" })).to.equal(403);
      expect(await requestThrough({ method: "GET", path: "http://Example.com/version.json" })).to.equal(403);

      expect(blocker.takeRequests()).to.deep.equal(["example.com:80", "registry.npmjs.org:443"]);
      expect(blocker.takeRequests()).to.deep.equal([]);
    });
  });
});

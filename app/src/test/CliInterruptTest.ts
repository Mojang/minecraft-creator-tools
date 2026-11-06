// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CliInterruptTest - How `mct` exits when a signal, such as Ctrl+C (SIGINT) or SIGTERM, stops it.
 *
 * An interrupted one-shot command, such as `validate`, didn't finish, so it exits 128 plus the signal's number: 130
 * for SIGINT and 143 for SIGTERM. It doesn't print "Graceful shutdown complete.". A server command (`serve`,
 * `dedicatedserve`, `view`, `edit`, `mcp`) ends when it's stopped, so it exits 0. Either way the process exits only
 * after ServerManager's shutdown, which stops any Bedrock Dedicated Server, has finished.
 *
 * - "ServerManager.shutdownForSignal" runs the handler with a stand-in for process.exit, on every platform. It
 *   replaces the Bedrock Dedicated Server's stopServer(), because a real server needs a download and the EULA, and
 *   doesn't run on macOS.
 * - "Interrupted commands in the built CLI" starts the CLI with a preload (SIGNAL_PRELOAD) that reports when the CLI
 *   has registered its signal handlers.
 *   - "with the signal emitted in the process" has the preload emit the signal then. That runs the listeners a real
 *     signal runs, even on Windows, where ChildProcess.kill() ends a process without running them, so CI checks the
 *     kind cli/index.ts gives each command.
 *   - "with real signals" runs only on POSIX. It sends SIGINT and SIGTERM with kill(), and Ctrl+C as SIGINT to a
 *     shell's process group, after the preload's report, so the test never sees Node's default handling, which
 *     applies until then.
 *
 * CLI runs use a disposable HOME and data folder, and a local proxy that refuses every network request.
 */

import { assert } from "chai";
import { ChildProcess, spawn } from "child_process";
import * as fs from "fs";
import * as http from "http";
import { AddressInfo } from "net";
import * as path from "path";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import "../app/CreatorToolsHost";
import CreatorTools from "../app/CreatorTools";
import ClUtils from "../cli/ClUtils";
import { getAllCommands } from "../cli/commands/index";
import Log from "../core/Log";
import { DedicatedServerStatus } from "../local/DedicatedServer";
import LocalEnvironment from "../local/LocalEnvironment";
import ServerManager, { CommandKind, getSignalExitCode, ShutdownSignal } from "../local/ServerManager";
import { buildCliEnvironment, NetworkBlocker, snapshotTree } from "./CliTranscriptHarness";
import { cliEnv, createTestDataDir, DATA_DIR_ENV } from "./TestDataDir";
import TestPaths from "./TestPaths";

const CLI_PATH = path.join(TestPaths.appRoot, "toolbuild", "jsn", "cli", "index.mjs");

/** Validating it takes many seconds, so a run is still going when the test signals it. */
const SLOW_PROJECT = path.join(TestPaths.publicRoot, "res", "latest", "van", "release");

const SERVER_COMMANDS = ["dedicatedserve", "edit", "mcp", "serve", "view"];
const COMPLETE_MESSAGE = "Graceful shutdown complete.";
const READY_MARKER = "TEST: signal handlers registered";
const RUN_TIMEOUT_MS = 45000;

/**
 * Loaded with --require. Prints READY_MARKER on stderr as soon as the CLI has registered SIGINT and SIGTERM handlers,
 * then emits MCT_TEST_EMIT_SIGNAL if it's set. Emitting it in a microtask runs the handlers before the CLI's next I/O,
 * so even a command that would fail right away, such as `dedicatedserve` without the EULA, gets the signal first.
 * Worker threads load it too, so it does nothing there.
 */
const SIGNAL_PRELOAD = `const { isMainThread } = require("worker_threads");
if (isMainThread) {
  const on = process.on;
  let reported = false;
  process.on = process.addListener = function (...args) {
    const result = on.apply(this, args);
    if (!reported && process.listenerCount("SIGINT") > 0 && process.listenerCount("SIGTERM") > 0) {
      reported = true;
      process.stderr.write(${JSON.stringify(READY_MARKER + "\n")});
      const signal = process.env.MCT_TEST_EMIT_SIGNAL;
      if (signal) {
        queueMicrotask(() => process.emit(signal, signal));
      }
    }
    return result;
  };
}
`;

interface ISignalCase {
  signal: ShutdownSignal;
  oneShotExitCode: number;
}

/** The signals the CLI tests send. SIGBREAK (Ctrl+Break) exists only on Windows, so only the unit tests use it. */
const SIGNAL_CASES: ISignalCase[] = [
  { signal: "SIGINT", oneShotExitCode: 130 },
  { signal: "SIGTERM", oneShotExitCode: 143 },
];

const ALL_SIGNAL_CASES: ISignalCase[] = [...SIGNAL_CASES, { signal: "SIGBREAK", oneShotExitCode: 149 }];

describe("Interrupted commands' exit codes", function () {
  for (const { signal, oneShotExitCode } of ALL_SIGNAL_CASES) {
    it(`exits ${oneShotExitCode} for a one-shot command and 0 for a server after ${signal}`, function () {
      assert.equal(getSignalExitCode(signal, CommandKind.oneShot), oneShotExitCode);
      assert.equal(getSignalExitCode(signal, CommandKind.server), 0);
    });
  }

  it("treats only the commands that run until they're stopped as servers", function () {
    const servers = getAllCommands()
      .filter((command) => ClUtils.getIsServerCommand(command.metadata.taskType))
      .map((command) => command.metadata.name)
      .sort();

    assert.deepEqual(servers, SERVER_COMMANDS);
  });
});

describe("ServerManager.shutdownForSignal", function () {
  const defaultKind = ServerManager.commandKind;
  let manager: ServerManager;
  let messages: string[];
  let stopCapturingLog: () => void;
  let restoreProcessListeners: () => void;

  beforeEach(function () {
    // The constructor adds process listeners, including an uncaughtException handler that exits. Remove them after.
    const signals = ["SIGINT", "SIGTERM", "SIGBREAK"] as const;
    const priorListeners = signals.map((signal) => new Set(process.listeners(signal)));
    const priorExceptionListeners = new Set(process.listeners("uncaughtException"));
    manager = new ServerManager(new LocalEnvironment(false), {} as CreatorTools);
    restoreProcessListeners = () => {
      signals.forEach((signal, index) => {
        for (const listener of process.listeners(signal)) {
          if (!priorListeners[index].has(listener)) {
            process.removeListener(signal, listener);
          }
        }
      });
      for (const listener of process.listeners("uncaughtException")) {
        if (!priorExceptionListeners.has(listener)) {
          process.removeListener("uncaughtException", listener);
        }
      }
    };

    messages = [];
    stopCapturingLog = Log.onItemAdded.subscribe((_log, item) => messages.push(item.message));
  });

  afterEach(function () {
    ServerManager.commandKind = defaultKind;
    stopCapturingLog();
    restoreProcessListeners();
  });

  /** Adds a Bedrock Dedicated Server that reports it's running and replaces how it stops. */
  function addRunningServer(stopServer: () => Promise<void>) {
    const server = manager.ensureDedicatedServerForPath(
      "interrupt-test",
      path.join(createTestDataDir("interrupt-bds"), "server")
    );
    Object.defineProperty(server, "status", { get: () => DedicatedServerStatus.started });
    server.stopServer = stopServer;
  }

  for (const kind of [CommandKind.oneShot, CommandKind.server]) {
    for (const { signal, oneShotExitCode } of SIGNAL_CASES) {
      const exitCode = kind === CommandKind.server ? 0 : oneShotExitCode;

      it(`stops Bedrock Dedicated Server, then exits ${exitCode} for a ${kind} command after ${signal}`, async function () {
        ServerManager.commandKind = kind;
        const events: string[] = [];
        let finishStopping!: () => void;
        const stopping = new Promise<void>((resolve) => (finishStopping = resolve));
        addRunningServer(async () => {
          events.push("stopping server");
          await stopping;
          events.push("server stopped");
        });

        const shutdown = manager.shutdownForSignal(signal, (code) => events.push(`exit ${code}`));
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.deepEqual(events, ["stopping server"], "The process must not exit while the server is stopping");

        finishStopping();
        await shutdown;
        assert.deepEqual(events, ["stopping server", "server stopped", `exit ${exitCode}`]);
        assert.include(messages, `Received ${signal} signal - initiating graceful shutdown...`);
        assert.equal(
          messages.includes(COMPLETE_MESSAGE),
          kind === CommandKind.server,
          "Only a server that was stopped reports a clean shutdown"
        );
      });
    }

    it(`exits 1 for a ${kind} command when shutdown fails`, async function () {
      ServerManager.commandKind = kind;
      const exitCodes: number[] = [];
      addRunningServer(async () => {
        throw new Error("controlled stop failure");
      });

      await manager.shutdownForSignal("SIGINT", (code) => exitCodes.push(code));

      assert.deepEqual(exitCodes, [1]);
      assert.include(messages, "Error during graceful shutdown: controlled stop failure");
      assert.notInclude(messages, COMPLETE_MESSAGE);
    });
  }
});

interface ICliRun {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

interface IRunOptions {
  env: NodeJS.ProcessEnv;
  /** Starts the run in its own process group, which `interrupt` can signal as a whole, as Ctrl+C does. */
  detached?: boolean;
  /** Written to stdin, which stays open. Without it, stdin is closed. */
  stdinText?: string;
  /** Whether the run is ready to signal, once the preload's marker is on stderr. Defaults to yes. */
  isReady?: (stdout: string) => boolean;
  /** Called once when the run is ready, to signal it. */
  interrupt?: (child: ChildProcess) => void;
}

/** Ends a run that doesn't settle, along with its process group when it has one. */
function forceKill(child: ChildProcess, detached: boolean | undefined) {
  try {
    if (detached && child.pid) {
      process.kill(-child.pid, "SIGKILL");
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    // Already exited.
  }
}

async function getFreePort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));

  return port;
}

/** The JSON-RPC messages among the complete lines of an MCP server's stdout. */
function jsonMessages(stdout: string): { id?: number }[] {
  const messages: { id?: number }[] = [];

  for (const line of stdout.split("\n").slice(0, -1)) {
    try {
      messages.push(JSON.parse(line));
    } catch {
      // Not JSON.
    }
  }

  return messages;
}

describe("Interrupted commands in the built CLI", function () {
  this.timeout(RUN_TIMEOUT_MS + 15000);

  const blocker = new NetworkBlocker();
  let root: string;
  let home: string;
  let data: string;
  let preload: string;

  before(async function () {
    assert(fs.existsSync(CLI_PATH), "Build the CLI first: npm run jsncorebuild");
    assert(fs.existsSync(SLOW_PROJECT), "Download the vanilla content first: npm run preparedevenv");
    await blocker.start();
  });

  after(async function () {
    await blocker.stop();
  });

  beforeEach(function () {
    root = createTestDataDir("cli-interrupt");
    home = path.join(root, "home");
    data = path.join(root, "data");
    preload = path.join(root, "signal-preload.cjs");
    fs.mkdirSync(home);
    fs.mkdirSync(path.join(root, "cwd"));
    fs.writeFileSync(preload, SIGNAL_PRELOAD);
  });

  afterEach(function () {
    assert.isEmpty(snapshotTree(home), "The disposable HOME must not change");
  });

  function environment(emitSignal?: ShutdownSignal): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
      ...buildCliEnvironment(data, blocker.url, cliEnv({ dataDir: data })),
      [DATA_DIR_ENV]: data,
      HOME: home,
      USERPROFILE: home,
      MCT_NO_OPEN_BROWSER: "1",
    };

    if (emitSignal) {
      env.MCT_TEST_EMIT_SIGNAL = emitSignal;
    }

    return env;
  }

  /** `node --require <preload> <cli> ...args` */
  function cliArgs(args: string[]): string[] {
    return ["--require", preload, CLI_PATH, ...args];
  }

  /** Runs `file` with `args` in the test's working folder until it exits. */
  function run(file: string, args: string[], options: IRunOptions): Promise<ICliRun> {
    return new Promise((resolve, reject) => {
      const child = spawn(file, args, {
        cwd: path.join(root, "cwd"),
        env: options.env,
        detached: options.detached,
        stdio: [options.stdinText === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let interrupted = false;
      let failure: string | undefined;
      const timer = setTimeout(() => {
        failure = "The run didn't exit in time.";
        forceKill(child, options.detached);
      }, RUN_TIMEOUT_MS);

      const interruptWhenReady = () => {
        if (!interrupted && stderr.includes(READY_MARKER) && (options.isReady?.(stdout) ?? true)) {
          interrupted = true;
          options.interrupt?.(child);
        }
      };

      if (options.stdinText !== undefined && child.stdin) {
        // A run that has already exited makes this write fail with EPIPE; the exit code says why.
        child.stdin.on("error", () => {});
        child.stdin.write(options.stdinText);
      }

      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
        interruptWhenReady();
      });
      child.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
        interruptWhenReady();
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        forceKill(child, options.detached);
        reject(error);
      });
      child.once("close", (exitCode, signal) => {
        clearTimeout(timer);
        const result: ICliRun = { exitCode, signal, stdout, stderr };

        if (failure || !stderr.includes(READY_MARKER)) {
          reject(new Error(`${failure ?? "The CLI never registered its signal handlers."}\n${JSON.stringify(result)}`));
        } else {
          resolve(result);
        }
      });
    });
  }

  function assertExit(result: ICliRun, exitCode: number) {
    assert.deepEqual(
      { exitCode: result.exitCode, signal: result.signal },
      { exitCode, signal: null },
      JSON.stringify(result)
    );
  }

  function assertInterruptedOneShot(result: ICliRun, signal: ShutdownSignal, exitCode: number) {
    const output = result.stdout + result.stderr;

    assertExit(result, exitCode);
    assert.include(output, `Received ${signal} signal`, "The handler ran");
    assert.notInclude(output, COMPLETE_MESSAGE, "An interrupted run didn't complete");
  }

  describe("with the signal emitted in the process (every platform)", function () {
    for (const { signal, oneShotExitCode } of SIGNAL_CASES) {
      it(`exits ${oneShotExitCode} when ${signal} interrupts validate`, async function () {
        const result = await run(process.execPath, cliArgs(["validate", "-i", SLOW_PROJECT, "--isolated"]), {
          env: environment(signal),
        });

        assertInterruptedOneShot(result, signal, oneShotExitCode);
      });

      for (const command of SERVER_COMMANDS) {
        it(`exits 0 when ${signal} stops ${command}`, async function () {
          const args = command === "serve" ? [command, "--port", String(await getFreePort())] : [command];
          const result = await run(process.execPath, cliArgs([...args, "--isolated"]), {
            env: environment(signal),
          });

          assertExit(result, 0);
        });
      }
    }
  });

  describe("with real signals (POSIX)", function () {
    before(function () {
      if (process.platform === "win32") {
        // ChildProcess.kill() ends a process on Windows without running its handlers; the blocks above cover them.
        this.skip();
      }
    });

    for (const { signal, oneShotExitCode } of SIGNAL_CASES) {
      it(`exits ${oneShotExitCode} when ${signal} interrupts validate`, async function () {
        const result = await run(process.execPath, cliArgs(["validate", "-i", SLOW_PROJECT, "--isolated"]), {
          env: environment(),
          interrupt: (child) => child.kill(signal),
        });

        assertInterruptedOneShot(result, signal, oneShotExitCode);
      });

      it(`exits 0 when ${signal} stops serve`, async function () {
        const port = await getFreePort();
        const result = await run(process.execPath, cliArgs(["serve", "--port", String(port), "--isolated"]), {
          env: environment(),
          isReady: (stdout) => /Web UI available at:/.test(stdout),
          interrupt: (child) => child.kill(signal),
        });

        assertExit(result, 0);
        assert.include(result.stdout, COMPLETE_MESSAGE);
      });

      it(`exits 0 when ${signal} stops mcp`, async function () {
        const initialize = {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: "mct-interrupt-test", version: "1.0.0" },
          },
        };
        const result = await run(process.execPath, cliArgs(["mcp", "--isolated"]), {
          env: environment(),
          stdinText: JSON.stringify(initialize) + "\n",
          isReady: (stdout) => jsonMessages(stdout).some((message) => message.id === 1),
          interrupt: (child) => child.kill(signal),
        });

        assertExit(result, 0);
      });
    }

    it("stops `mct validate ... && next` after Ctrl+C", async function () {
      // Ctrl+C sends SIGINT to the terminal's foreground process group: here, the shell and the CLI. The paths reach
      // the shell through its environment, so the script stays a constant that never has a path in it.
      const result = await run(
        "bash",
        [
          "-c",
          '"$MCT_TEST_NODE" --require "$MCT_TEST_PRELOAD" "$MCT_TEST_CLI" validate -i "$MCT_TEST_PROJECT" --isolated' +
            " && echo NEXT",
        ],
        {
          env: {
            ...environment(),
            MCT_TEST_NODE: process.execPath,
            MCT_TEST_PRELOAD: preload,
            MCT_TEST_CLI: CLI_PATH,
            MCT_TEST_PROJECT: SLOW_PROJECT,
          },
          detached: true,
          interrupt: (child) => process.kill(-(child.pid as number), "SIGINT"),
        }
      );

      assertInterruptedOneShot(result, "SIGINT", 130);
      assert.notMatch(result.stdout, /^NEXT$/m, "The command after && must not run");
    });
  });
});

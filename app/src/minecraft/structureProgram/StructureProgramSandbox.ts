// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Runs untrusted `build(api)` programs off the main thread.
 *
 * Threat model: programs come from agents (MCP, which `mct serve` can also
 * expose over HTTP) or from files a user passes to the CLI. We must not let
 * them reach the host (`process`, `require`, the file system, the network) or
 * hang it.
 *
 * Two layers handle that:
 *   - Security: QuickJS. `StructureProgramSandboxCore` runs each program in a
 *     fresh QuickJS WebAssembly runtime with memory, stack, and time limits.
 *     Guest code gets no host objects, and the host validates everything the
 *     guest returns before using it.
 *   - Availability: a worker thread. QuickJS evaluation is synchronous, so in
 *     process it would block the event loop for the whole run. We run it in a
 *     `worker_threads` Worker instead, so the MCP server and CLI keep answering.
 *     If the run outlives its deadline plus `hostGraceMs` (say QuickJS never
 *     reached an interrupt check), we terminate the worker.
 *
 * Where the worker code comes from:
 *   1. The bundled CLI: `StructureSandboxWorker.mjs`, next to the bundle
 *      (built by esbuild.jsn.config.mjs).
 *   2. Running from TypeScript sources under ts-node (unit tests): an eval
 *      worker that registers ts-node and loads `src/cli/StructureSandboxWorker.ts`.
 *   3. Otherwise, or if the worker cannot start: run in process. QuickJS still
 *      enforces every limit; only the main-thread responsiveness is lost.
 *
 * We keep at most `MAX_IDLE_WORKERS` idle workers so later runs skip startup.
 * Idle workers are unref'd, so they never keep the process alive.
 */

import * as fs from "fs";
import * as path from "path";
import { Worker } from "worker_threads";
import Log from "../../core/Log";
import StructureProgramSandboxCore, {
  IStructureSandboxRequest,
  STRUCTURE_TIMEOUT_DETAIL,
} from "./StructureProgramSandboxCore";
import { STRUCTURE_PROGRAM_DEFAULTS, StructureSandboxResult } from "./StructureProgramTypes";

export type { IStructureSandboxRequest } from "./StructureProgramSandboxCore";

const MAX_IDLE_WORKERS = 2;
/** How long a new worker may take to pick up its first request. */
const WORKER_STARTUP_TIMEOUT_MS = 60_000;

type WorkerFactory = () => Worker;

interface IWorkerMessage {
  type: "started" | "result";
  result?: StructureSandboxResult;
}

let workerFactory: WorkerFactory | null | undefined;
const idleWorkers: Worker[] = [];
const activeWorkers = new Set<Worker>();

export default class StructureProgramSandbox {
  /**
   * Extra time past the program's own deadline before the host terminates the
   * worker. QuickJS normally stops the program at the deadline, so this only
   * matters when it doesn't.
   */
  static hostGraceMs = 1000;

  /** Set to false to always run in process (the QuickJS limits still apply). */
  static useWorker = true;

  static async run(request: IStructureSandboxRequest): Promise<StructureSandboxResult> {
    const factory = StructureProgramSandbox.useWorker ? StructureProgramSandbox._getWorkerFactory() : null;
    if (!factory) {
      return StructureProgramSandboxCore.run(request);
    }

    let worker: Worker | undefined;
    try {
      while (!worker && idleWorkers.length > 0) {
        const candidate = idleWorkers.pop() as Worker;
        if (candidate.threadId >= 0) {
          worker = candidate;
        }
      }
      worker = worker || factory();
    } catch (e: unknown) {
      Log.debug(
        "Could not start the structure sandbox worker; running in process: " + (e instanceof Error ? e.message : e)
      );
      workerFactory = null;
      return StructureProgramSandboxCore.run(request);
    }

    return StructureProgramSandbox._runInWorker(worker, request);
  }

  /**
   * Terminates idle and running workers. A run whose worker is terminated
   * resolves with an "internal" failure. Workers are unref'd when idle, so this
   * is optional at process exit.
   */
  static async shutdown(): Promise<void> {
    const workers = [...idleWorkers.splice(0, idleWorkers.length), ...activeWorkers];
    activeWorkers.clear();
    await Promise.all(workers.map((w) => w.terminate()));
  }

  /** Number of workers currently running a program (for tests). */
  static get activeWorkerCount(): number {
    return activeWorkers.size;
  }

  private static _runInWorker(worker: Worker, request: IStructureSandboxRequest): Promise<StructureSandboxResult> {
    const timeoutMs = request.limits?.timeoutMs ?? STRUCTURE_PROGRAM_DEFAULTS.timeoutMs;

    return new Promise<StructureSandboxResult>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
        worker.off("message", onMessage);
        worker.off("error", onError);
        worker.off("exit", onExit);
      };

      const finish = (result: StructureSandboxResult, reusable: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        const stillOwned = activeWorkers.delete(worker);
        if (reusable && stillOwned && idleWorkers.length < MAX_IDLE_WORKERS) {
          worker.unref();
          idleWorkers.push(worker);
        } else {
          void worker.terminate();
        }
        resolve(result);
      };

      const arm = (ms: number, onFire: () => StructureSandboxResult) => {
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => finish(onFire(), false), Math.max(0, ms));
      };

      const onMessage = (message: IWorkerMessage) => {
        if (message.type === "started") {
          arm(timeoutMs + StructureProgramSandbox.hostGraceMs, () => ({
            ok: false,
            reason: "timeout",
            detail: STRUCTURE_TIMEOUT_DETAIL,
            logs: [],
          }));
        } else if (message.type === "result" && message.result) {
          finish(message.result, true);
        }
      };

      const onError = (e: Error) => {
        const message = e && e.message ? e.message : String(e);
        const outOfMemory = (e as { code?: string }).code === "ERR_WORKER_OUT_OF_MEMORY";
        finish(
          {
            ok: false,
            reason: outOfMemory ? "memory" : "internal",
            detail: outOfMemory
              ? "The build program ran out of memory. Reduce the structure size or avoid large arrays."
              : "The structure sandbox worker failed: " + message,
            logs: [],
          },
          false
        );
      };

      const onExit = (code: number) => {
        finish(
          {
            ok: false,
            reason: "internal",
            detail: `The structure sandbox worker exited unexpectedly (code ${code}).`,
            logs: [],
          },
          false
        );
      };

      worker.on("message", onMessage);
      worker.on("error", onError);
      worker.on("exit", onExit);
      worker.ref();
      activeWorkers.add(worker);

      arm(WORKER_STARTUP_TIMEOUT_MS, () => ({
        ok: false,
        reason: "internal",
        detail: "The structure sandbox worker did not start in time.",
        logs: [],
      }));

      try {
        worker.postMessage(request);
      } catch (e: unknown) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  /** Finds a way to start the worker, or returns null to run in process. */
  private static _getWorkerFactory(): WorkerFactory | null {
    if (workerFactory !== undefined) {
      return workerFactory;
    }
    workerFactory = null;

    try {
      if (typeof __dirname !== "string") {
        return null;
      }

      const bundled = path.resolve(__dirname, "StructureSandboxWorker.mjs");
      if (fs.existsSync(bundled)) {
        workerFactory = () => new Worker(bundled);
        return workerFactory;
      }

      if (typeof __filename === "string" && __filename.endsWith(".ts")) {
        const source = path.resolve(__dirname, "../../cli/StructureSandboxWorker.ts");
        if (fs.existsSync(source)) {
          const tsNode = require.resolve("ts-node");
          const register: { [key: string]: unknown } = { transpileOnly: true };
          if (process.env.TS_NODE_PROJECT) {
            register.project = process.env.TS_NODE_PROJECT;
          }
          const code =
            `require(${JSON.stringify(tsNode)}).register(${JSON.stringify(register)});\n` +
            `require(${JSON.stringify(source)});\n`;
          workerFactory = () => new Worker(code, { eval: true });
          return workerFactory;
        }
      }
    } catch (e: unknown) {
      Log.debug("No structure sandbox worker is available: " + (e instanceof Error ? e.message : e));
      workerFactory = null;
    }

    return workerFactory;
  }
}

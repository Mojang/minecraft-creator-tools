/// <reference types="node" />

/**
 * Real workers run inside disposable children so backpressure never changes the test runner's
 * stdout/stderr. IPC observes results independently of those pipes; shared-memory barriers force
 * result/error/exit races without timing sleeps. Deadlines bound only the test harness.
 */

import { assert } from "chai";
import { spawn } from "child_process";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { createWorkerPool, SingleThreadPool, ThreadWorkerPool } from "../cli/core/WorkerPool";
import { IWorkerResult } from "../cli/core/ICommandContext";
import { TaskType } from "../cli/ClUtils";
import TestPaths from "./TestPaths";
import { cliEnv, DATA_DIR_ENV } from "./TestDataDir";
import { workerTaskFailures } from "./CliWorkerTestCases";

const fixtures = path.resolve(TestPaths.testRoot, "scenarios", "workerPool");

interface IWorkerState {
  threadId: number;
  stdoutEnded: boolean;
  stderrEnded: boolean;
  messageListeners: number;
  errorListeners: number;
  exitListeners: number;
}

interface ICompletion {
  type: "complete";
  result?: IWorkerResult;
  results?: IWorkerResult<{ value: number }>[];
  settlements: number;
  atSettlement: IWorkerState[];
  afterShutdown: IWorkerResult;
  workers: IWorkerState[];
  progress: number[][];
  batches: number[];
  exitOrder: number[];
}

interface IRun {
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  completion?: ICompletion;
  events: unknown[];
}

function runPool(threads: number, mode: string): Promise<IRun> {
  return new Promise((resolve, reject) => {
    const env = cliEnv();
    const outputFolder = path.resolve(TestPaths.testRoot, "results", "workerPool", String(threads), mode);
    fs.mkdirSync(outputFolder, { recursive: true });
    const child = spawn(
      process.execPath,
      [
        "--require",
        require.resolve("ts-node/register/transpile-only"),
        ...(mode.startsWith("producer-") ? ["--require", path.join(fixtures, "injectTaskFault.cjs")] : []),
        path.join(fixtures, "runPool.cjs"),
        path.resolve(TestPaths.appRoot, "src/cli/core/WorkerPool.ts"),
        mode.startsWith("producer-")
          ? path.resolve(TestPaths.appRoot, "toolbuild/jsn/cli/TaskWorker.mjs")
          : path.join(fixtures, "task.cjs"),
        String(threads),
        mode,
        String(TaskType.validate),
        path.resolve(TestPaths.sampleContentPath("simple")),
        outputFolder,
      ],
      {
        cwd: outputFolder,
        env: {
          ...cliEnv(),
          HOME: env[DATA_DIR_ENV],
          USERPROFILE: env[DATA_DIR_ENV],
          TS_NODE_PROJECT: path.resolve(TestPaths.appRoot, "tsconfig.test.json"),
          MCT_TEST_WORKER_FAULT: mode,
        },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      }
    );
    const run: IRun = { exitCode: null, timedOut: false, stdout: "", stderr: "", events: [] };
    const timer = setTimeout(() => {
      run.timedOut = true;
      child.stdout?.resume();
      child.stderr?.resume();
      child.kill("SIGKILL");
    }, 10000);
    const stdout = child.stdout!;
    const stderr = child.stderr!;
    stdout.setEncoding("utf8").on("data", (chunk: string) => (run.stdout += chunk));
    stderr.setEncoding("utf8").on("data", (chunk: string) => (run.stderr += chunk));
    if (mode === "output") {
      // Hold both OS pipes until the result arrives: the worker's queued writes cannot all fit.
      stdout.pause();
      stderr.pause();
    }
    child.on("message", (message: ICompletion | { type: string }) => {
      run.events.push(message);
      if (message.type === "result-seen") {
        stdout.resume();
        stderr.resume();
      } else if (message.type === "complete") {
        run.completion = message as ICompletion;
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      run.exitCode = code;
      resolve(run);
    });
  });
}

function completed(run: IRun): ICompletion {
  assert.isFalse(run.timedOut, `Worker execution stayed pending: ${JSON.stringify(run.events)}`);
  assert.equal(run.exitCode, 0, run.stderr);
  assert.exists(run.completion, JSON.stringify(run.events));
  const completion = run.completion!;
  assert.equal(completion.settlements, 1);
  for (const worker of completion.atSettlement) {
    assert.equal(worker.threadId, -1, "Settlement must wait for worker exit");
    assert.isTrue(worker.stdoutEnded, "Settlement must wait for forwarded stdout");
    assert.isTrue(worker.stderrEnded, "Settlement must wait for forwarded stderr");
  }
  for (const worker of completion.workers) {
    assert.equal(worker.threadId, -1, "shutdown must not leave active workers");
    assert.equal(worker.messageListeners, 0);
    assert.equal(worker.errorListeners, 0);
    assert.equal(worker.exitListeners, 0);
  }
  assert.deepEqual(completion.afterShutdown, { success: false, error: "Worker pool has been shutdown" });
  return completion;
}

function completedResult(run: IRun): IWorkerResult {
  const completion = completed(run);
  assert.exists(completion.result);
  return completion.result!;
}

function expectedOutput(stream: "stdout" | "stderr"): string {
  const fill = stream === "stdout" ? "x" : "y";
  return (
    Array.from({ length: 128 }, (_, index) => `${stream}:${index}:${fill.repeat(4096)}\n`).join("") +
    `${stream}:tail\n`
  );
}

describe("CLI worker pool lifecycle", function () {
  this.timeout(15000);

  it("keeps factory selection and configured concurrency", async () => {
    const single = createWorkerPool(1);
    const parallel = createWorkerPool(3);
    const capped = createWorkerPool(20);
    assert.instanceOf(single, SingleThreadPool);
    assert.instanceOf(parallel, ThreadWorkerPool);
    assert.equal(single.concurrency, 1);
    assert.equal(parallel.concurrency, 3);
    assert.equal(capped.concurrency, 8);
    await Promise.all([single.shutdown(), parallel.shutdown(), capped.shutdown()]);
  });

  for (const threads of [1, 3]) {
    describe(`threads=${threads}`, () => {
      for (const mode of ["output", "tail-after-result"]) {
        it(`drains complete stdout and stderr (${mode})`, async () => {
          const run = await runPool(threads, mode);
          for (const stream of ["stdout", "stderr"] as const) {
            const expected = expectedOutput(stream);
            assert.equal(Buffer.byteLength(run[stream]), Buffer.byteLength(expected), `${stream} byte count`);
            assert.equal(
              createHash("sha256").update(run[stream]).digest("hex"),
              createHash("sha256").update(expected).digest("hex"),
              `${stream} must contain every byte in order, including its tail`
            );
          }
          assert.deepEqual(completedResult(run), { success: true, result: { value: 0 } });
        });
      }

      for (const { mode, error } of [
        { mode: "exit-zero", error: "Worker exited with code 0 without returning a result" },
        { mode: "exit-nonzero", error: "Worker exited with code 7" },
        { mode: "throw", error: "Worker fixture threw" },
        { mode: "result-then-throw", error: "Worker fixture threw after its result" },
        { mode: "result-then-exit", error: "Worker exited with code 7" },
        { mode: "error-result", error: "Error: Worker fixture task failed" },
      ]) {
        it(`reports one failure for ${mode}`, async () => {
          const result = completedResult(await runPool(threads, mode));
          assert.isFalse(result.success);
          assert.equal(result.error, error);
          assert.notProperty(result, "result");
          if (mode.includes("throw")) {
            assert.include(result.stack, error);
          }
        });
      }

      for (const fault of workerTaskFailures) {
        it(`reports caught task/no-result failure (${fault.mode})`, async () => {
          const run = await runPool(threads, fault.mode);
          const result = completedResult(run);
          assert.isFalse(result.success, JSON.stringify(result));
          assert.equal(result.error, fault.error);
          assert.notProperty(result, "result");
          if (fault.mode.includes("-inner-") || fault.mode.includes("-outer-")) {
            assert.include(run.stderr, `Injected read reached: ${fault.mode}`);
          }
          if (fault.mode.endsWith("-error")) {
            assert.include(result.stack, fault.error);
          }
        });
      }

      for (const { mode, value } of [
        { mode: "success-string", value: "TypeError: legitimate task output" },
        { mode: "success-error-prefix", value: "Error: legitimate task output" },
        { mode: "success-empty-string", value: "" },
        { mode: "success-zero", value: 0 },
        { mode: "success-false", value: false },
      ]) {
        it(`preserves legitimate string/falsy results (${mode})`, async () => {
          assert.deepEqual(completedResult(await runPool(threads, mode)), { success: true, result: value });
        });
      }

      for (const { mode, error } of [
        { mode: "undefined-success", error: "Worker exited with code 0 without returning a result" },
        { mode: "undefined-then-success", error: "Worker exited with code 0 without returning a result" },
        { mode: "failure-then-success", error: "Task failed before a duplicate" },
        ...["missing-success-payload", "malformed-error", "malformed-stack", "untagged-result", "untagged-error-text"].map(
          (mode) => ({ mode, error: "Worker returned an invalid task result" })
        ),
      ]) {
        it(`rejects invalid or missing task result envelopes (${mode})`, async () => {
          const result = completedResult(await runPool(threads, mode));
          assert.isFalse(result.success);
          assert.equal(result.error, error);
          assert.notProperty(result, "result");
        });
      }

      it("keeps the first actual result when a worker sends duplicates", async () => {
        assert.deepEqual(completedResult(await runPool(threads, "duplicate-result")), {
          success: true,
          result: { value: 0 },
        });
      });

      for (const mode of ["blocked", "result-then-block"]) {
        it(`settles active work when shutdown is called (${mode})`, async () => {
          const result = completedResult(await runPool(threads, mode));
          assert.isFalse(result.success);
          assert.isString(result.error);
          assert.notProperty(result, "result");
        });
      }

      for (const { mode, error } of [
        { mode: "constructor-error", error: /extension|unsupported/i },
        { mode: "post-error", error: /could not be cloned/i },
      ]) {
        it(`reports setup errors without leaking a worker (${mode})`, async () => {
          const result = completedResult(await runPool(threads, mode));
          assert.isFalse(result.success);
          assert.match(result.error!, error);
        });
      }

      it("preserves batch concurrency, input ordering, and one progress update per task", async () => {
        const completion = completed(await runPool(threads, "batch"));
        assert.deepEqual(
          completion.results,
          Array.from({ length: 5 }, (_, value) => ({ success: true, result: { value } }))
        );
        assert.deepEqual(completion.progress, Array.from({ length: 5 }, (_, index) => [index + 1, 5]));
        assert.deepEqual(completion.batches, threads === 1 ? [1, 1, 1, 1, 1] : [3, 2]);
        assert.deepEqual(completion.exitOrder, threads === 1 ? [0, 1, 2, 3, 4] : [2, 1, 0, 4, 3]);
      });

      it("settles active and queued batch tasks when shutdown is called", async () => {
        const completion = completed(await runPool(threads, "batch-shutdown"));
        assert.lengthOf(completion.results!, 5);
        for (const result of completion.results!) {
          assert.isFalse(result.success);
          assert.isString(result.error);
          assert.notProperty(result, "result");
        }
        assert.lengthOf(completion.workers, threads);
        assert.deepEqual(completion.progress, Array.from({ length: 5 }, (_, index) => [index + 1, 5]));
      });
    });
  }
});

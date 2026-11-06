const workerThreads = require("node:worker_threads");
const { Worker } = workerThreads;
const assert = require("node:assert/strict");
const workers = [];
const [poolModule, workerPath, threads, mode, taskType = "0", projectPath, outputFolder] = process.argv.slice(2);
const taskCount = mode.startsWith("batch") ? 5 : 1;
const control = new SharedArrayBuffer(taskCount * 2 * Int32Array.BYTES_PER_ELEMENT);
const state = new Int32Array(control);
const exitOrder = [];
let notifyResult;
const resultSeen = new Promise((resolve) => (notifyResult = resolve));

// Observe real workers in this disposable process without changing the production factory.
workerThreads.Worker = class extends Worker {
  constructor(filename, options) {
    super(filename, options);
    workers.push(this);
    this.on("message", (message) => {
      process.send({ type: "result-seen", message, wasUndefined: message === undefined });
      notifyResult();
      if (mode !== "result-then-block" && !mode.startsWith("batch")) {
        Atomics.store(state, 1, 1);
        Atomics.notify(state, 1);
      }
    });
    this.on("exit", (code) => {
      exitOrder.push(workers.indexOf(this));
      process.send?.({ type: "worker-exit", code });
    });
  }
};

const { createWorkerPool } = require(poolModule);
const pool = createWorkerPool(
  Number(threads),
  mode === "constructor-error" ? workerPath + ".unsupported" : workerPath
);

function workerState() {
  return workers.map((worker) => ({
    threadId: worker.threadId,
    stdoutEnded: worker.stdout.readableEnded,
    stderrEnded: worker.stderr.readableEnded,
    messageListeners: worker.listenerCount("message"),
    errorListeners: worker.listenerCount("error"),
    exitListeners: worker.listenerCount("exit"),
  }));
}

async function run() {
  let settlements = 0;
  const progress = [];
  const batches = [];
  const tasks = Array.from({ length: taskCount }, (_, index) => ({
    taskType: Number(taskType),
    args: {
      mode: mode.startsWith("batch") ? "batch" : mode,
      control,
      index,
      uncloneable: mode === "post-error" ? () => {} : undefined,
      ...(mode.startsWith("producer-")
        ? {
            project: { ctorProjectName: "worker-task", localFolderPath: projectPath },
            outputFolder,
            force: true,
            arguments: { suite: "main" },
            displayInfo: false,
            displayVerbose: false,
            logToStdError: true,
          }
        : {}),
    },
  }));
  const execution = mode.startsWith("batch")
    ? pool.executeBatch(tasks, (completed, total) => progress.push([completed, total]))
    : pool.execute(tasks[0]);
  const pending = execution.then((result) => {
    settlements++;
    return {
      ...(mode.startsWith("batch") ? { results: result } : { result }),
      atSettlement: workerState(),
    };
  });

  if (mode === "blocked" || mode === "result-then-block") {
    await waitForStart(0);
    if (mode === "result-then-block") {
      await resultSeen;
    }
    await Promise.all([pool.shutdown(), pool.shutdown()]);
  } else if (mode.startsWith("batch")) {
    for (let first = 0; first < taskCount; first += pool.concurrency) {
      const end = Math.min(first + pool.concurrency, taskCount);
      await Promise.all(Array.from({ length: end - first }, (_, offset) => waitForStart(first + offset)));
      assert.equal(workers.length, end, "No queued task may start before this batch finishes");
      batches.push(workers.filter((worker) => worker.threadId !== -1).length);
      if (mode === "batch-shutdown") {
        await pool.shutdown();
        break;
      }
      // Force reverse completion within each batch, independent of worker startup timing.
      for (let index = end - 1; index >= first; index--) {
        const exited = new Promise((resolve) => workers[index].once("exit", resolve));
        Atomics.store(state, index * 2 + 1, 1);
        Atomics.notify(state, index * 2 + 1);
        await exited;
      }
    }
  }

  const outcome = await pending;
  await pool.shutdown();
  const afterShutdown = await pool.execute({ taskType: 0, args: { mode: "duplicate-result", control } });
  process.send({
    type: "complete",
    ...outcome,
    settlements,
    afterShutdown,
    workers: workerState(),
    progress,
    batches,
    exitOrder,
  });
  process.disconnect();
}

async function waitForStart(index) {
  while (Atomics.load(state, index * 2) === 0) {
    await Atomics.waitAsync(state, index * 2, 0).value;
  }
}

run().catch((error) => {
  process.send({ type: "harness-error", message: error.message, stack: error.stack });
  process.exitCode = 1;
  process.disconnect();
});

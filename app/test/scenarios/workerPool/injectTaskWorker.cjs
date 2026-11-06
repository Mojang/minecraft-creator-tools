const workerThreads = require("node:worker_threads");
const { syncBuiltinESMExports } = require("node:module");
const path = require("node:path");

if (workerThreads.isMainThread) {
  const { Worker } = workerThreads;
  workerThreads.Worker = class extends Worker {
    constructor(filename, options) {
      if (path.basename(String(filename)) === "TaskWorker.mjs") {
        super(path.join(__dirname, "task.cjs"), {
          ...options,
          workerData: {
            mode: process.env.MCT_TEST_WORKER_MODE,
            control: new SharedArrayBuffer(2 * Int32Array.BYTES_PER_ELEMENT),
          },
        });
      } else {
        super(filename, options);
      }
    }
  };
  syncBuiltinESMExports();
}

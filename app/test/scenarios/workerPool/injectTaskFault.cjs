const { isMainThread, parentPort } = require("node:worker_threads");
const { syncBuiltinESMExports } = require("node:module");

// Keep the real TaskWorker entry point and its catches. Inject only the failing read.
if (!isMainThread && parentPort) {
  const mode = process.env.MCT_TEST_WORKER_FAULT;
  if (mode === "producer-report-failure") {
    const fs = require("node:fs");
    const write = fs.writeFileSync;
    fs.writeFileSync = function (filename, ...args) {
      if (String(filename).endsWith(".report.html")) {
        throw new Error("Task report write failed");
      }
      return write.call(this, filename, ...args);
    };
    syncBuiltinESMExports();
  } else if (mode === "producer-snapshot-failure") {
    require("node:v8").writeHeapSnapshot = () => {
      throw new Error("Task snapshot write failed");
    };
  }
  parentPort.once("message", (task) => {
    if (mode === "producer-missing-project") {
      delete task.project;
    } else if (mode === "producer-unsupported-task") {
      task.task = -1;
    } else if (mode === "producer-snapshot-failure") {
      task.profileMode = "all";
    } else if (mode?.startsWith("producer-inner-") || mode?.startsWith("producer-outer-")) {
      const inner = mode.startsWith("producer-inner-");
      Object.defineProperty(inner ? task.arguments : task, inner ? "suite" : "outputFolder", {
        get() {
          process.stderr.write(`Injected read reached: ${mode}\n`);
          if (mode.endsWith("type-error")) {
            throw new TypeError("Caught task failure");
          }
          if (mode.endsWith("range-error")) {
            throw new RangeError("Caught task failure");
          }
          throw "Caught task failure";
        },
      });
    }
  });
}

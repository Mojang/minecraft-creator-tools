const { parentPort, workerData } = require("node:worker_threads");

parentPort.once("message", (task) => {
  const { mode, control, index = 0 } = workerData || task;
  const state = new Int32Array(control);
  const result = { type: "task-result", success: true, result: { value: index } };
  const offset = mode === "batch" ? index * 2 : 0;

  function waitForParent() {
    Atomics.store(state, offset, 1);
    Atomics.notify(state, offset);
    Atomics.wait(state, offset + 1, 0);
  }

  function writeOutput() {
    for (let i = 0; i < 128; i++) {
      process.stdout.write(`stdout:${i}:${"x".repeat(4096)}\n`);
      process.stderr.write(`stderr:${i}:${"y".repeat(4096)}\n`);
    }
  }

  switch (mode) {
    case "output":
      writeOutput();
      process.stdout.write("stdout:tail\n");
      process.stderr.write("stderr:tail\n");
      parentPort.postMessage(result);
      break;
    case "tail-after-result":
      parentPort.postMessage(result);
      waitForParent();
      writeOutput();
      process.stdout.write("stdout:tail\n");
      process.stderr.write("stderr:tail\n");
      break;
    case "exit-zero":
      process.exit(0);
      break;
    case "exit-nonzero":
      process.exit(7);
      break;
    case "throw":
      throw new Error("Worker fixture threw");
    case "result-then-throw":
      parentPort.postMessage(result);
      waitForParent();
      throw new Error("Worker fixture threw after its result");
    case "result-then-exit":
      parentPort.postMessage(result);
      waitForParent();
      process.exit(7);
      break;
    case "error-result":
      parentPort.postMessage({ type: "task-result", success: false, error: "Error: Worker fixture task failed" });
      break;
    case "undefined-result":
      parentPort.postMessage(undefined);
      break;
    case "undefined-success":
      parentPort.postMessage({ type: "task-result", success: true, result: undefined });
      break;
    case "missing-success-payload":
      parentPort.postMessage({ type: "task-result", success: true });
      break;
    case "malformed-error":
      parentPort.postMessage({ type: "task-result", success: false, error: 42 });
      break;
    case "malformed-stack":
      parentPort.postMessage({ type: "task-result", success: false, error: "Task failed", stack: 42 });
      break;
    case "untagged-result":
      parentPort.postMessage({ value: index });
      break;
    case "untagged-error-text":
      parentPort.postMessage("TypeError: untagged task output");
      break;
    case "undefined-then-success":
      parentPort.postMessage(undefined);
      parentPort.postMessage(result);
      break;
    case "failure-then-success":
      parentPort.postMessage({ type: "task-result", success: false, error: "Task failed before a duplicate" });
      parentPort.postMessage(result);
      break;
    case "success-string":
      parentPort.postMessage({ type: "task-result", success: true, result: "TypeError: legitimate task output" });
      break;
    case "success-error-prefix":
      parentPort.postMessage({ type: "task-result", success: true, result: "Error: legitimate task output" });
      break;
    case "success-empty-string":
      parentPort.postMessage({ type: "task-result", success: true, result: "" });
      break;
    case "success-zero":
      parentPort.postMessage({ type: "task-result", success: true, result: 0 });
      break;
    case "success-false":
      parentPort.postMessage({ type: "task-result", success: true, result: false });
      break;
    case "duplicate-result":
      parentPort.postMessage(result);
      parentPort.postMessage({ type: "task-result", success: true, result: { value: "duplicate" } });
      break;
    case "blocked":
    case "batch":
      waitForParent();
      parentPort.postMessage(result);
      break;
    case "result-then-block":
      parentPort.postMessage(result);
      waitForParent();
      break;
    default:
      throw new Error(`Unknown worker fixture mode: ${mode}`);
  }

  parentPort.close();
});

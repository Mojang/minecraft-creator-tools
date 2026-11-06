/**
 * Internal TaskWorker wire result, distinct from public IWorkerResult and CLI JSON.
 * Payload text never determines success: strings, including "Error: ...", can be data.
 */
export type TaskWorkerResult<TResult = unknown> =
  | { type: "task-result"; success: true; result: TResult }
  | { type: "task-result"; success: false; error: string; stack?: string };

export function isTaskWorkerResult(message: unknown): message is TaskWorkerResult {
  if (
    message === null ||
    typeof message !== "object" ||
    !("type" in message) ||
    message.type !== "task-result" ||
    !("success" in message)
  ) {
    return false;
  }

  if (message.success === true) {
    return "result" in message;
  }

  return (
    message.success === false &&
    "error" in message &&
    typeof message.error === "string" &&
    (!("stack" in message) || message.stack === undefined || typeof message.stack === "string")
  );
}

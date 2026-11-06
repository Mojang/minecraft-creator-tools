/** Shared fault matrix; producer cases run the real built TaskWorker, not a replacement worker. */
export const workerTaskFailures = [
  ...["inner", "outer"].flatMap((location) =>
    [
      { kind: "type-error", error: "TypeError: Caught task failure" },
      { kind: "range-error", error: "RangeError: Caught task failure" },
      { kind: "string", error: "Caught task failure" },
    ].map(({ kind, error }) => ({ mode: `producer-${location}-${kind}`, error, producer: true }))
  ),
  {
    mode: "producer-missing-project",
    error: "Error: Could not find an associated project for the associated task.",
    producer: true,
  },
  {
    mode: "producer-unsupported-task",
    error: "Error: Unsupported worker task.",
    producer: true,
  },
  { mode: "producer-report-failure", error: "Error: Task report write failed", producer: true },
  { mode: "producer-snapshot-failure", error: "Error: Task snapshot write failed", producer: true },
  {
    mode: "undefined-result",
    error: "Worker exited with code 0 without returning a result",
    producer: false,
  },
  {
    mode: "undefined-success",
    error: "Worker exited with code 0 without returning a result",
    producer: false,
  },
  {
    mode: "missing-success-payload",
    error: "Worker returned an invalid task result",
    producer: false,
  },
];

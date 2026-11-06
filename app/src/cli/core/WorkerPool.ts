/**
 * WorkerPool - Abstraction for parallel task execution
 *
 * This module provides:
 * - IWorkerPool interface (from ICommandContext)
 * - ThreadWorkerPool: Node.js worker_threads implementation
 * - SingleThreadPool: Executes tasks via worker but one at a time
 *
 * Both pools share the same per-task lifecycle and TaskWorker.mjs entry point.
 * A result message is only a candidate result: completion also waits for the
 * worker's exit and for stdout/stderr to end. Node forwards those streams over
 * a separate channel, so terminating on "message" discards queued output.
 * TaskWorker closes its one-task parent port to allow a natural, drained exit.
 * TaskWorkerResult tags success/failure explicitly; payload text is never parsed
 * as an error. Errors and nonzero exits override a candidate success; exit 0
 * without a defined result is a failure. There is no total task deadline.
 * Boolean discriminants need explicit comparisons: the library also imports
 * this module with strictNullChecks disabled, unlike the strict CLI graph.
 *
 * shutdown() stops admission, terminates active workers, and waits for their
 * terminal results and stream cleanup. Cancellation is not a successful result.
 *
 * The factory function createWorkerPool() selects the appropriate
 * implementation based on thread count.
 */

import { Worker as NodeWorker } from "worker_threads";
import { Readable } from "stream";
import { finished } from "stream/promises";
import * as path from "path";
import { IWorkerPool, IWorkerTask, IWorkerResult } from "./ICommandContext";
import { isTaskWorkerResult } from "./TaskWorkerResult";

/**
 * Get the path to the TaskWorker.mjs script.
 * The TaskWorker.mjs is in the same directory as the main CLI bundle.
 */
function getWorkerPath(): string {
  return path.resolve(__dirname, "TaskWorker.mjs");
}

/**
 * ThreadWorkerPool uses Node.js worker_threads for parallel execution.
 */
export class ThreadWorkerPool implements IWorkerPool {
  readonly concurrency: number;

  private workerPath: string;
  private memoryLimitMb: number;
  private activeWorkers = new Map<NodeWorker, Promise<IWorkerResult>>();
  private isShutdown = false;

  /**
   * Create a thread worker pool.
   * @param concurrency Maximum concurrent workers
   * @param workerPath Path to the worker script (TaskWorker.mjs)
   * @param memoryLimitMb Memory limit per worker in MB
   */
  constructor(concurrency: number, workerPath?: string, memoryLimitMb = 16384) {
    this.concurrency = Math.max(1, Math.min(concurrency, 8));
    this.workerPath = workerPath || getWorkerPath();
    this.memoryLimitMb = memoryLimitMb;
  }

  async execute<TArgs, TResult>(task: IWorkerTask<TArgs, TResult>): Promise<IWorkerResult<TResult>> {
    if (this.isShutdown) {
      return {
        success: false,
        error: "Worker pool has been shutdown",
      };
    }

    let worker: NodeWorker;
    try {
      worker = new NodeWorker(this.workerPath, {
        resourceLimits: {
          maxOldGenerationSizeMb: this.memoryLimitMb,
        },
      });
    } catch (error) {
      return workerFailure(error);
    }

    const completion = executeInWorker(task, worker);
    this.activeWorkers.set(worker, completion);
    try {
      return await completion;
    } finally {
      this.activeWorkers.delete(worker);
    }
  }

  async executeBatch<TArgs, TResult>(
    tasks: IWorkerTask<TArgs, TResult>[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<IWorkerResult<TResult>[]> {
    if (this.isShutdown) {
      return tasks.map(() => ({
        success: false,
        error: "Worker pool has been shutdown",
      }));
    }

    const results: IWorkerResult<TResult>[] = new Array(tasks.length);
    let currentIndex = 0;
    let completedCount = 0;

    const processNextBatch = async (): Promise<void> => {
      const batchPromises: Promise<void>[] = [];

      // Start up to concurrency tasks
      for (let i = 0; i < this.concurrency && currentIndex < tasks.length; i++) {
        const taskIndex = currentIndex++;

        const promise = this.execute(tasks[taskIndex]).then((result) => {
          results[taskIndex] = result;
          completedCount++;
          if (onProgress) {
            onProgress(completedCount, tasks.length);
          }
        });

        batchPromises.push(promise);
      }

      await Promise.all(batchPromises);
    };

    // Process all tasks in batches
    while (currentIndex < tasks.length) {
      await processNextBatch();
    }

    return results;
  }

  async shutdown(): Promise<void> {
    this.isShutdown = true;

    await Promise.all(
      Array.from(this.activeWorkers, async ([worker, completion]) => {
        await worker.terminate();
        await completion;
      })
    );
  }
}

/**
 * Uses the same lifecycle and batch ordering as ThreadWorkerPool, one task at a time.
 */
export class SingleThreadPool extends ThreadWorkerPool {
  constructor(workerPath?: string, memoryLimitMb = 16384) {
    super(1, workerPath, memoryLimitMb);
  }
}

function workerFailure(error: unknown): IWorkerResult<never> {
  return {
    success: false,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
}

/**
 * Retain the actual result while both the worker and its forwarded streams finish.
 * The CLI's exitAfterFlush handles the destination process streams after this handoff.
 */
async function executeInWorker<TArgs, TResult>(
  task: IWorkerTask<TArgs, TResult>,
  worker: NodeWorker
): Promise<IWorkerResult<TResult>> {
  let result: IWorkerResult<TResult> | undefined;
  let failure: IWorkerResult<never> | undefined;
  let receivedMessage = false;

  const onMessage = (message: unknown) => {
    if (receivedMessage) {
      return;
    }
    receivedMessage = true;
    if (message === undefined) {
      return;
    }
    if (!isTaskWorkerResult(message)) {
      result = { success: false, error: "Worker returned an invalid task result" };
    } else if (message.success === false) {
      result = { success: false, error: message.error, stack: message.stack };
    } else if (message.result !== undefined) {
      result = { success: true, result: message.result as TResult };
    }
  };
  const onError = (error: Error) => {
    failure = workerFailure(error);
  };
  const drain = async (stream: Readable) => {
    try {
      await finished(stream, { cleanup: true });
    } catch (error) {
      failure ??= workerFailure(error);
    }
  };

  worker.on("message", onMessage);
  worker.on("error", onError);
  const exited = new Promise<number>((resolve) => worker.once("exit", resolve));
  const drained = Promise.all([drain(worker.stdout), drain(worker.stderr)]);

  try {
    try {
      worker.postMessage({ task: task.taskType, ...task.args });
    } catch (error) {
      failure = workerFailure(error);
      await worker.terminate();
    }

    const [code] = await Promise.all([exited, drained]);
    if (failure) {
      return failure;
    }
    if (code !== 0) {
      return result?.success === false ? result : { success: false, error: `Worker exited with code ${code}` };
    }
    return result ?? { success: false, error: "Worker exited with code 0 without returning a result" };
  } finally {
    worker.off("message", onMessage);
    worker.off("error", onError);
  }
}

/**
 * Factory function to create the appropriate worker pool.
 * @param threads Number of threads (1 = single-threaded, >1 = multi-threaded)
 * @param workerPath Optional path to worker script (defaults to TaskWorker.mjs)
 */
export function createWorkerPool(threads: number, workerPath?: string): IWorkerPool {
  if (threads <= 1) {
    return new SingleThreadPool(workerPath);
  }

  return new ThreadWorkerPool(threads, workerPath);
}

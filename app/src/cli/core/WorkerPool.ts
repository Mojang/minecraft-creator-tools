/**
 * WorkerPool - Abstraction for parallel task execution
 *
 * This module provides:
 * - IWorkerPool interface (from ICommandContext)
 * - ThreadWorkerPool: Node.js worker_threads implementation
 * - SingleThreadPool: Executes tasks via worker but one at a time
 *
 * Both pools use the same TaskWorker.js script for execution,
 * ensuring consistent behavior between single and multi-threaded modes.
 *
 * The factory function createWorkerPool() selects the appropriate
 * implementation based on thread count.
 */

import { Worker as NodeWorker } from "worker_threads";
import * as path from "path";
import { IWorkerPool, IWorkerTask, IWorkerResult } from "./ICommandContext";

/**
 * Get the path to the TaskWorker.mjs script.
 * The TaskWorker.mjs is in the same directory as the main CLI bundle.
 */
function getWorkerPath(): string {
  return path.resolve(__dirname, "TaskWorker.mjs");
}

/**
 * SingleThreadPool executes tasks one at a time using a single worker.
 * This provides consistent behavior with ThreadWorkerPool but without parallelism.
 */
export class SingleThreadPool implements IWorkerPool {
  readonly concurrency = 1;

  private workerPath: string;
  private memoryLimitMb: number;

  constructor(workerPath?: string, memoryLimitMb = 16384) {
    this.workerPath = workerPath || getWorkerPath();
    this.memoryLimitMb = memoryLimitMb;
  }

  async execute<TArgs, TResult>(task: IWorkerTask<TArgs, TResult>): Promise<IWorkerResult<TResult>> {
    return executeInWorker<TArgs, TResult>(task, this.workerPath, this.memoryLimitMb);
  }

  async executeBatch<TArgs, TResult>(
    tasks: IWorkerTask<TArgs, TResult>[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<IWorkerResult<TResult>[]> {
    const results: IWorkerResult<TResult>[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const result = await this.execute(tasks[i]);
      results.push(result);

      if (onProgress) {
        onProgress(i + 1, tasks.length);
      }
    }

    return results;
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up - workers are created per-task
  }
}

/**
 * ThreadWorkerPool uses Node.js worker_threads for parallel execution.
 */
export class ThreadWorkerPool implements IWorkerPool {
  readonly concurrency: number;

  private workerPath: string;
  private memoryLimitMb: number;
  private activeWorkers: Set<NodeWorker> = new Set();
  private isShutdown = false;

  /**
   * Create a thread worker pool.
   * @param concurrency Maximum concurrent workers
   * @param workerPath Path to the worker script (TaskWorker.js)
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

    return new Promise((resolve) => {
      const worker = new NodeWorker(this.workerPath, {
        resourceLimits: {
          maxOldGenerationSizeMb: this.memoryLimitMb,
        },
      });

      this.activeWorkers.add(worker);

      const cleanup = () => {
        worker.removeAllListeners();
        this.activeWorkers.delete(worker);
        worker.terminate();
      };

      const onMessage = (result: unknown) => {
        cleanup();
        // Handle error strings returned from worker
        if (typeof result === "string" && result.startsWith("Error")) {
          resolve({
            success: false,
            error: result,
          });
        } else {
          resolve({
            success: true,
            result: result as TResult,
          });
        }
      };

      const onError = (error: Error) => {
        cleanup();
        resolve({
          success: false,
          error: error.message,
          stack: error.stack,
        });
      };

      const onExit = (code: number) => {
        cleanup();
        if (code !== 0) {
          resolve({
            success: false,
            error: `Worker exited with code ${code}`,
          });
        }
      };

      worker.on("message", onMessage);
      worker.on("error", onError);
      worker.on("exit", onExit);

      // Post the task data to the worker
      worker.postMessage({
        task: task.taskType,
        ...task.args,
      });
    });
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
      const batchIndices: number[] = [];

      // Start up to concurrency tasks
      for (let i = 0; i < this.concurrency && currentIndex < tasks.length; i++) {
        const taskIndex = currentIndex++;
        batchIndices.push(taskIndex);

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

    const terminatePromises: Promise<number>[] = [];
    for (const worker of this.activeWorkers) {
      terminatePromises.push(worker.terminate());
    }

    await Promise.all(terminatePromises);
    this.activeWorkers.clear();
  }
}

/**
 * Execute a single task in a worker and return the result.
 * This is a helper used by both SingleThreadPool and ThreadWorkerPool.
 */
async function executeInWorker<TArgs, TResult>(
  task: IWorkerTask<TArgs, TResult>,
  workerPath: string,
  memoryLimitMb: number
): Promise<IWorkerResult<TResult>> {
  return new Promise((resolve) => {
    const worker = new NodeWorker(workerPath, {
      resourceLimits: {
        maxOldGenerationSizeMb: memoryLimitMb,
      },
    });

    const cleanup = () => {
      worker.removeAllListeners();
      worker.terminate();
    };

    const onMessage = (result: unknown) => {
      cleanup();
      // Handle error strings returned from worker
      if (typeof result === "string" && result.startsWith("Error")) {
        resolve({
          success: false,
          error: result,
        });
      } else {
        resolve({
          success: true,
          result: result as TResult,
        });
      }
    };

    const onError = (error: Error) => {
      cleanup();
      resolve({
        success: false,
        error: error.message,
        stack: error.stack,
      });
    };

    const onExit = (code: number) => {
      cleanup();
      if (code !== 0) {
        resolve({
          success: false,
          error: `Worker exited with code ${code}`,
        });
      }
    };

    worker.on("message", onMessage);
    worker.on("error", onError);
    worker.on("exit", onExit);

    // Post the task data to the worker
    // Convert IWorkerTask to the format expected by TaskWorker
    worker.postMessage({
      task: task.taskType,
      ...task.args,
    });
  });
}

/**
 * Factory function to create the appropriate worker pool.
 * @param threads Number of threads (1 = single-threaded, >1 = multi-threaded)
 * @param workerPath Optional path to worker script (defaults to TaskWorker.js)
 */
export function createWorkerPool(threads: number, workerPath?: string): IWorkerPool {
  if (threads <= 1) {
    return new SingleThreadPool(workerPath);
  }

  return new ThreadWorkerPool(threads, workerPath);
}

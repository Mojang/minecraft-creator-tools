// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../info/ProjectInfoItem";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import { IRelationsResultData, ISerializableInfoItem } from "../workers/IProjectWorkerMessage";

/**
 * Result of combined relations + info set processing in worker.
 */
export interface IProcessRelationsAndInfoSetWorkerResult {
  relationsApplied: boolean;
  infoItems?: ProjectInfoItem[];
  thumbnails?: { [projectPath: string]: string };
  thumbnailLinks?: { [projectPath: string]: string };
}

/**
 * Progress callback type for worker operations.
 */
export type WorkerProgressCallback = (message: string, percent?: number) => void;

/**
 * Callback when relations calculation completes (streaming).
 */
export type RelationsCompleteCallback = (relationsData: IRelationsResultData) => void;

/**
 * Callback when validation completes (streaming).
 * Can be async to allow processing like preloading forms.
 */
export type ValidationCompleteCallback = (infoItems: ISerializableInfoItem[]) => void | Promise<void>;

/**
 * Callback when a batch of thumbnails completes (streaming).
 */
export type ThumbnailBatchCallback = (
  thumbnails: { [projectPath: string]: string },
  thumbnailLinks: { [projectPath: string]: string } | undefined,
  completed: number,
  total: number
) => void;

/**
 * Callback when all thumbnails are finished (streaming).
 */
export type ThumbnailsFinishedCallback = (cancelled: boolean, totalGenerated: number) => void;

/**
 * Streaming callbacks for combined worker operations.
 * Results are delivered via these callbacks as they complete,
 * rather than waiting for all operations to finish.
 */
export interface IStreamingCallbacks {
  /**
   * Called when relations calculation completes.
   * This is the first callback to fire - allows UI to unblock early.
   */
  onRelationsComplete?: RelationsCompleteCallback;

  /**
   * Called when validation completes.
   * Contains all info items (errors, warnings, recommendations).
   */
  onValidationComplete?: ValidationCompleteCallback;

  /**
   * Called when a batch of thumbnails completes.
   * Thumbnails are generated in batches (default 20 at a time) to avoid blocking.
   * This callback is for internal tracking only - NOT shown in user-visible progress.
   */
  onThumbnailBatch?: ThumbnailBatchCallback;

  /**
   * Called when all thumbnails have finished (or were cancelled).
   */
  onThumbnailsFinished?: ThumbnailsFinishedCallback;
}

/**
 * Minimal project interface for worker manager operations.
 * This avoids circular dependencies with the full Project class.
 */
export interface IProjectForWorker {
  readonly name: string;
  readonly projectFolder: import("../storage/IFolder").default | null;
  getItemsCopy(): import("./ProjectItem").default[];
}

/**
 * Interface for project worker manager implementations.
 * This abstracts the web worker functionality so that Project.ts doesn't
 * have a direct dependency on the workers folder.
 *
 * Architecture notes:
 * - Single persistent worker instance per app
 * - Worker caches the project to avoid re-hydration on subsequent requests
 * - Results are streamed back: relations -> validation -> thumbnails (low-priority)
 * - Project is disposed on switch (new project) or after idle timeout (5 min)
 */
export interface IProjectWorkerManager {
  /**
   * Whether web workers are supported in the current environment
   */
  readonly isSupported: boolean;

  /**
   * Generate info set in a web worker.
   * @returns Array of ProjectInfoItem if successful, undefined to fall back to main thread
   */
  generateInfoSetInWorker(
    project: IProjectForWorker,
    suite: ProjectInfoSuite,
    onProgress?: WorkerProgressCallback
  ): Promise<ProjectInfoItem[] | undefined>;

  /**
   * Process item relations AND generate info set in a single worker operation.
   * Uses streaming architecture - results are delivered via callbacks as they complete:
   * 1. onRelationsComplete - called as soon as relations are calculated (unblocks waiters)
   * 2. onValidationComplete - called after validation finishes
   * 3. onThumbnailBatch - called as thumbnail batches complete (silently in background)
   * 4. onThumbnailsFinished - called when all thumbnails are done
   *
   * @param project The project to process
   * @param suite The validation suite to run
   * @param callbacks Streaming callbacks for receiving results as they complete
   * @param onProgress Optional progress callback (for user-visible progress)
   * @returns Promise that resolves when validation is complete (thumbnails may still be generating)
   */
  processRelationsAndGenerateInfoSetInWorker(
    project: IProjectForWorker,
    suite: ProjectInfoSuite,
    callbacks?: IStreamingCallbacks,
    onProgress?: WorkerProgressCallback
  ): Promise<IProcessRelationsAndInfoSetWorkerResult | undefined>;

  /**
   * Cancel pending thumbnail generation in the worker.
   * Called when switching projects to stop background thumbnail work.
   */
  cancelPendingThumbnails(): void;

  /**
   * Dispose the cached project in the worker to free memory.
   * Called when switching projects or on idle timeout.
   */
  disposeWorkerProject(): void;

  /**
   * Terminate the worker.
   */
  terminate(): void;
}

/**
 * Singleton holder for the project worker manager instance.
 * This allows ProjectWorkerManager to register itself when loaded,
 * without Project.ts needing to import it directly.
 */
let _registeredWorkerManager: IProjectWorkerManager | undefined;

/**
 * Register a project worker manager implementation.
 * Called by ProjectWorkerManager when it's loaded.
 */
export function registerProjectWorkerManager(manager: IProjectWorkerManager): void {
  _registeredWorkerManager = manager;
}

/**
 * Get the registered project worker manager, if available.
 * Returns undefined if no worker manager has been registered or workers aren't supported.
 */
export function getProjectWorkerManager(): IProjectWorkerManager | undefined {
  return _registeredWorkerManager;
}

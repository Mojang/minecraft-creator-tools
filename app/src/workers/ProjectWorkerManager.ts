// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import ProjectInfoItem from "../info/ProjectInfoItem";
import CreatorToolsHost from "../app/CreatorToolsHost";
import {
  IProjectWorkerManager,
  IProjectForWorker,
  IProcessRelationsAndInfoSetWorkerResult,
  WorkerProgressCallback,
  IStreamingCallbacks,
  registerProjectWorkerManager,
} from "../app/IProjectWorkerManager";
import {
  StorageTransferMode,
  ISerializedStorage,
  ISerializedFolder,
  ISerializedFile,
  StorageTransferData,
  ISerializableInfoItem,
  IRelationsResultData,
  ProjectWorkerMessageType,
  IGenerateInfoSetResult,
  IGenerateInfoSetRequest,
  IProcessRelationsAndGenerateInfoSetRequest,
  IRelationsCompleteResponse,
  IValidationCompleteResponse,
  IThumbnailBatchCompleteResponse,
  IThumbnailsFinishedResponse,
  ICancelThumbnailsRequest,
  IDisposeProjectRequest,
  ProjectWorkerResponse,
  IWorkerProgressMessage,
  IBrowserStoragePointer,
} from "./IProjectWorkerMessage";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import Log from "../core/Log";
import Utilities from "../core/Utilities";
import IFolder from "../storage/IFolder";
import IFile from "../storage/IFile";
import StorageUtilities from "../storage/StorageUtilities";
import BrowserFolder from "../storage/BrowserFolder";

// Import the worker using Vite's ?worker suffix - this bundles the worker properly
// @ts-ignore - Vite-specific import syntax
import ProjectWorkerConstructor from "./project.worker.ts?worker";

// Maximum size for binary files to include (skip larger ones for performance)
const MAX_BINARY_SIZE = 100 * 1024; // 100KB

/**
 * Get the content root URL to pass to the worker.
 * If CreatorToolsHost.contentWebRoot is empty, derive it from window.location.
 * This ensures the worker can make absolute requests to data files.
 */
function getContentRootForWorker(): string {
  if (CreatorToolsHost.contentWebRoot && CreatorToolsHost.contentWebRoot.length > 0) {
    return CreatorToolsHost.contentWebRoot;
  }

  // Derive from window.location - use origin + pathname up to last slash
  // @ts-ignore
  if (typeof window !== "undefined" && window.location) {
    // @ts-ignore
    const origin = window.location.origin; // e.g., "http://localhost:3000"
    // @ts-ignore
    const pathname = window.location.pathname; // e.g., "/index.html" or "/"
    const lastSlash = pathname.lastIndexOf("/");
    const basePath = lastSlash > 0 ? pathname.substring(0, lastSlash + 1) : "/";
    return origin + basePath; // e.g., "http://localhost:3000/"
  }

  return "/"; // Fallback
}

/**
 * Manages a Web Worker for offloading project processing tasks.
 * This helps keep the main thread responsive during intensive operations
 * like processing item relations and validation.
 *
 * Architecture notes:
 * - Single persistent worker instance per app
 * - Worker caches the project to avoid re-hydration on subsequent requests
 * - Results are streamed back: relations -> validation -> thumbnails (low-priority)
 * - Project is disposed on switch (new project) or after idle timeout (5 min)
 */
export default class ProjectWorkerManager implements IProjectWorkerManager {
  private static _instance: ProjectWorkerManager | undefined;
  private _worker: Worker | undefined;
  private _currentProjectName: string | undefined;
  private _pendingRequests: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      onProgress?: (message: string, percent?: number) => void;
      // Streaming callbacks for combined operations
      streaming?: IStreamingCallbacks;
      // Set to true for requests that use streaming (don't resolve on single response)
      isStreaming?: boolean;
      // Track if validation is complete (for cleanup after thumbnails)
      validationComplete?: boolean;
    }
  > = new Map();
  private _isSupported: boolean;

  private constructor() {
    // Check if Web Workers are supported
    const hasWorkerApi = typeof Worker !== "undefined";
    // @ts-ignore
    const hasWindow = typeof window !== "undefined";
    // @ts-ignore - Check if running in Electron
    const isElectron = typeof process !== "undefined" && process.versions && process.versions.electron;

    // With Vite's ?worker import, workers are properly bundled and should work
    // in both dev and production, including Electron with file:// protocol
    this._isSupported = hasWorkerApi && hasWindow;

    if (!this._isSupported) {
      Log.verbose(
        `ProjectWorkerManager: Workers not supported. hasWorkerApi=${hasWorkerApi}, hasWindow=${hasWindow}, isElectron=${isElectron}`
      );
    } else {
      Log.verbose(`ProjectWorkerManager: Workers supported. isElectron=${isElectron}`);
    }
  }

  static get instance(): ProjectWorkerManager {
    if (!ProjectWorkerManager._instance) {
      ProjectWorkerManager._instance = new ProjectWorkerManager();
    }
    return ProjectWorkerManager._instance;
  }

  /**
   * Whether web workers are supported in the current environment
   */
  get isSupported(): boolean {
    return this._isSupported;
  }

  /**
   * Initialize the worker if not already initialized
   */
  private _ensureWorker(): Worker | undefined {
    if (!this._isSupported) {
      return undefined;
    }

    if (!this._worker) {
      try {
        // Use the Vite-bundled worker constructor (imported with ?worker suffix)
        // This properly bundles the worker for both dev and production builds
        Log.verbose("Creating project worker using Vite bundled constructor");

        // @ts-ignore - ProjectWorkerConstructor is a Worker constructor from Vite's ?worker import
        this._worker = new ProjectWorkerConstructor();

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const worker = this._worker!;
        worker.onmessage = this._handleWorkerMessage.bind(this);
        worker.onerror = this._handleWorkerError.bind(this);
        Log.verbose("Project worker created successfully");
      } catch (e) {
        // Don't show an alert - just log and fall back to main thread
        Log.verbose("Failed to create project worker: " + e);
        this._isSupported = false;
        return undefined;
      }
    }

    return this._worker;
  }

  private async _handleWorkerMessage(event: MessageEvent<ProjectWorkerResponse>) {
    const response = event.data;

    // Handle the "ready" message sent when the worker initializes
    if ((response as any).type === "ready") {
      Log.verbose("Project worker ready");
      return;
    }

    if (response.type === ProjectWorkerMessageType.progress) {
      const progressMsg = response as IWorkerProgressMessage;
      const pending = this._pendingRequests.get(progressMsg.requestId);
      if (pending?.onProgress) {
        pending.onProgress(progressMsg.message, progressMsg.percentComplete);
      }
      return;
    }

    // Handle streaming responses for combined operations
    if (response.type === ProjectWorkerMessageType.relationsComplete) {
      const relationsResp = response as IRelationsCompleteResponse;
      const pending = this._pendingRequests.get(relationsResp.requestId);
      if (pending?.streaming?.onRelationsComplete) {
        const relationsData: IRelationsResultData = {
          childRelations: relationsResp.childRelations,
          unfulfilledRelations: relationsResp.unfulfilledRelations,
        };
        pending.streaming.onRelationsComplete(relationsData);
      }
      // Don't resolve - wait for more messages
      return;
    }

    if (response.type === ProjectWorkerMessageType.validationComplete) {
      const validationResp = response as IValidationCompleteResponse;
      const pending = this._pendingRequests.get(validationResp.requestId);
      if (pending?.streaming?.onValidationComplete) {
        // Await the callback in case it's async (e.g., preloading forms)
        await pending.streaming.onValidationComplete(validationResp.infoItems);
      }
      // Mark validation complete and resolve the promise so the caller can continue.
      // IMPORTANT: Do NOT delete the pending request from the map yet — thumbnail
      // batches arrive AFTER validation and need the streaming callbacks. The request
      // is cleaned up in the thumbnailsFinished handler instead.
      if (pending?.isStreaming) {
        pending.validationComplete = true;
        pending.resolve({ validationComplete: true });
      }
      return;
    }

    if (response.type === ProjectWorkerMessageType.thumbnailBatchComplete) {
      const batchResp = response as IThumbnailBatchCompleteResponse;
      const pending = this._pendingRequests.get(batchResp.requestId);
      if (pending?.streaming?.onThumbnailBatch) {
        pending.streaming.onThumbnailBatch(
          batchResp.thumbnails,
          batchResp.thumbnailLinks,
          batchResp.completed,
          batchResp.total
        );
      }
      // Don't resolve - thumbnails continue in background
      return;
    }

    if (response.type === ProjectWorkerMessageType.thumbnailsFinished) {
      const finishedResp = response as IThumbnailsFinishedResponse;
      const pending = this._pendingRequests.get(finishedResp.requestId);
      if (pending?.streaming?.onThumbnailsFinished) {
        pending.streaming.onThumbnailsFinished(finishedResp.cancelled, finishedResp.totalGenerated);
      }
      // Clean up the request entry if it still exists (might already be cleaned up after validation)
      this._pendingRequests.delete(finishedResp.requestId);
      return;
    }

    // Handle non-streaming responses
    const pending = this._pendingRequests.get(response.requestId);
    if (!pending) {
      Log.verbose("Received worker response for unknown request: " + response.requestId);
      return;
    }

    this._pendingRequests.delete(response.requestId);

    if (response.type === ProjectWorkerMessageType.error) {
      pending.reject(new Error(response.error));
    } else {
      pending.resolve(response);
    }
  }

  private _handleWorkerError(event: ErrorEvent) {
    // Don't use Log.debugAlert here as it might show a dialog to the user
    // Worker errors are expected in some environments and should be handled gracefully
    console.warn("Project worker error:", event.message);

    // Reject all pending requests
    for (const pending of this._pendingRequests.values()) {
      pending.reject(new Error("Worker error: " + event.message));
    }
    this._pendingRequests.clear();

    // Terminate and recreate worker on next use
    this._worker?.terminate();
    this._worker = undefined;

    // Mark workers as unsupported so we fall back to main thread
    this._isSupported = false;
  }

  /**
   * Create storage transfer data for the worker.
   *
   * Uses BrowserStorage pointer mode when the project folder is backed by BrowserStorage,
   * which allows the worker to access IndexedDB directly (faster for large projects).
   * Falls back to serialized storage mode for other storage types.
   *
   * @param project The project to create transfer data for
   * @param forceSerialized If true, always use serialized mode (for testing or compatibility)
   */
  static async createStorageTransferData(
    project: IProjectForWorker,
    forceSerialized: boolean = false
  ): Promise<StorageTransferData | undefined> {
    const projectFolder = project.projectFolder;
    if (!projectFolder) {
      return undefined;
    }

    // Try to use BrowserStorage pointer mode if the folder is backed by BrowserStorage
    if (!forceSerialized && projectFolder instanceof BrowserFolder) {
      const browserFolder = projectFolder as BrowserFolder;
      const browserStorage = browserFolder.storage;

      // Use the storageName property directly from BrowserStorage
      const storageName = browserStorage.storageName;

      // Get the relative path from storage root to project folder
      const projectFolderPath = browserFolder.storageRelativePath;

      const pointer: IBrowserStoragePointer = {
        mode: StorageTransferMode.browserStoragePointer,
        storageName,
        projectFolderPath,
      };

      Log.verbose(
        `Using BrowserStorage pointer mode for worker (storageName: ${storageName}, path: ${projectFolderPath})`
      );
      return pointer;
    }

    // Fall back to serialized storage mode
    Log.verbose("Using serialized storage mode for worker");
    return await ProjectWorkerManager.serializeFolderToTransferData(project.name, projectFolder);
  }

  /**
   * Serialize a folder structure to JSON for transfer to worker.
   */
  static async serializeFolderToTransferData(projectName: string, folder: IFolder): Promise<ISerializedStorage> {
    const rootFolder = await ProjectWorkerManager.serializeFolder(folder);

    return {
      mode: StorageTransferMode.serializedStorage,
      projectName,
      rootFolder,
    };
  }

  /**
   * Recursively serialize a folder and its contents.
   */
  static async serializeFolder(folder: IFolder): Promise<ISerializedFolder> {
    if (!folder.isLoaded) {
      await folder.load();
    }

    const serialized: ISerializedFolder = {
      name: folder.name,
      files: {},
      folders: {},
    };

    // Serialize files
    for (const fileName in folder.files) {
      const file = folder.files[fileName];
      if (file) {
        const serializedFile = await ProjectWorkerManager.serializeFile(file);
        if (serializedFile) {
          serialized.files[fileName] = serializedFile;
        }
      }
    }

    // Serialize subfolders
    for (const folderName in folder.folders) {
      const subFolder = folder.folders[folderName];
      if (subFolder && !StorageUtilities.isIgnorableFolder(folderName)) {
        serialized.folders[folderName] = await ProjectWorkerManager.serializeFolder(subFolder);
      }
    }

    return serialized;
  }

  /**
   * Serialize a file for transfer.
   */
  static async serializeFile(file: IFile): Promise<ISerializedFile | undefined> {
    if (!file.isContentLoaded) {
      try {
        await file.loadContent();
      } catch (e) {
        // Skip files that can't be loaded
        return undefined;
      }
    }

    const serialized: ISerializedFile = {
      name: file.name,
      modifiedAtMs: file.modified ? file.modified.getTime() : undefined,
    };

    const content = file.content;
    if (typeof content === "string") {
      serialized.textContent = content;
    } else if (content instanceof Uint8Array) {
      // Only include small binary files
      if (content.length <= MAX_BINARY_SIZE) {
        serialized.binaryContentBase64 = Utilities.uint8ArrayToBase64(content);
      } else {
        serialized.binarySkipped = true;
      }
    }

    return serialized;
  }

  /**
   * Apply relations result from worker to actual project items.
   * Accepts any result type that includes childRelations and unfulfilledRelations.
   */
  private _applyRelationsResult(project: IProjectForWorker, result: IRelationsResultData): void {
    const items = project.getItemsCopy();
    const itemsByPath = new Map<string, ProjectItem>();

    // Build lookup map
    for (const item of items) {
      if (item.projectPath) {
        itemsByPath.set(item.projectPath, item);
      }
    }

    // Clear existing relations
    for (const item of items) {
      item.childItems = undefined;
      item.parentItems = undefined;
      item.unfulfilledRelationships = undefined;
    }

    // Apply child relations
    for (const parentPath of Object.keys(result.childRelations)) {
      const parentItem = itemsByPath.get(parentPath);
      if (!parentItem) continue;

      const relations = result.childRelations[parentPath];
      if (!relations || relations.length === 0) continue;

      parentItem.childItems = [];

      for (const rel of relations) {
        const childItem = itemsByPath.get(rel.childStoragePath);
        if (childItem) {
          parentItem.childItems.push({
            parentItem,
            childItem,
          });

          // Also add to child's parent list
          if (!childItem.parentItems) {
            childItem.parentItems = [];
          }
          childItem.parentItems.push({
            parentItem,
            childItem,
          });
        }
      }
    }

    // Apply unfulfilled relations
    for (const parentPath of Object.keys(result.unfulfilledRelations)) {
      const parentItem = itemsByPath.get(parentPath);
      if (!parentItem) continue;

      const unfulfilled = result.unfulfilledRelations[parentPath];
      if (!unfulfilled || unfulfilled.length === 0) continue;

      parentItem.unfulfilledRelationships = unfulfilled.map((u) => ({
        parentItem,
        itemType: u.itemType,
        path: u.path,
        isVanillaDependent: u.isVanillaDependent,
      }));
    }
  }

  /**
   * Generate info set in a web worker.
   */
  async generateInfoSetInWorker(
    project: IProjectForWorker,
    suite: ProjectInfoSuite,
    onProgress?: WorkerProgressCallback
  ): Promise<ProjectInfoItem[] | undefined> {
    const worker = this._ensureWorker();

    if (!worker) {
      Log.verbose("Web Workers not supported, falling back to main thread");
      return undefined;
    }

    const storageData = await ProjectWorkerManager.createStorageTransferData(project);
    if (!storageData) {
      Log.verbose("Could not create storage transfer data, falling back to main thread");
      return undefined;
    }

    const requestId = Utilities.createUuid();

    const request: IGenerateInfoSetRequest = {
      type: ProjectWorkerMessageType.generateInfoSet,
      requestId,
      storageData,
      suite,
      contentRoot: getContentRootForWorker(),
    };

    try {
      const result = await this._sendRequest<IGenerateInfoSetResult>(request, onProgress);
      return this._deserializeInfoItems(result.infoItems, project);
    } catch (e) {
      // Don't show an alert - just log and fall back to main thread processing
      console.warn("Worker info set generation failed, falling back to main thread:", e);
      return undefined;
    }
  }

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
   * @param onProgress Optional progress callback
   * @returns Promise that resolves when validation is complete (thumbnails may still be generating)
   */
  async processRelationsAndGenerateInfoSetInWorker(
    project: IProjectForWorker,
    suite: ProjectInfoSuite,
    callbacks?: IStreamingCallbacks,
    onProgress?: WorkerProgressCallback
  ): Promise<IProcessRelationsAndInfoSetWorkerResult | undefined> {
    const worker = this._ensureWorker();

    if (!worker) {
      Log.verbose("Web Workers not supported, falling back to main thread");
      return undefined;
    }

    // Check if project changed - if so, cancel pending thumbnails and dispose old project
    const projectName = project.name;
    if (this._currentProjectName && this._currentProjectName !== projectName) {
      Log.verbose(`Project changed from ${this._currentProjectName} to ${projectName}, cancelling pending thumbnails`);
      this.cancelPendingThumbnails();
      this.disposeWorkerProject();
    }
    this._currentProjectName = projectName;

    const storageData = await ProjectWorkerManager.createStorageTransferData(project);
    if (!storageData) {
      Log.verbose("Could not create storage transfer data, falling back to main thread");
      return undefined;
    }

    const requestId = Utilities.createUuid();

    const request: IProcessRelationsAndGenerateInfoSetRequest = {
      type: ProjectWorkerMessageType.processRelationsAndGenerateInfoSet,
      requestId,
      storageData,
      suite,
      contentRoot: getContentRootForWorker(),
    };

    // Create streaming callbacks that apply results to the project
    const streamingCallbacks: IStreamingCallbacks = {
      onRelationsComplete: (relationsData) => {
        // Apply relations to project items immediately
        this._applyRelationsResult(project, relationsData);
        // Forward to caller's callback
        callbacks?.onRelationsComplete?.(relationsData);
      },
      onValidationComplete: async (infoItems) => {
        // Forward to caller's callback and await it (it may be async)
        await callbacks?.onValidationComplete?.(infoItems);
      },
      onThumbnailBatch: (thumbnails, thumbnailLinks, completed, total) => {
        // Apply thumbnails to project items
        this._applyThumbnailsResult(project, thumbnails);
        // Apply thumbnail links (item shows another item's thumbnail)
        if (thumbnailLinks) {
          this._applyThumbnailLinks(project, thumbnailLinks);
        }
        // Forward to caller's callback
        callbacks?.onThumbnailBatch?.(thumbnails, thumbnailLinks, completed, total);
      },
      onThumbnailsFinished: (cancelled, totalGenerated) => {
        Log.verbose(`Thumbnails finished: ${totalGenerated} generated, cancelled=${cancelled}`);
        callbacks?.onThumbnailsFinished?.(cancelled, totalGenerated);
      },
    };

    try {
      // Send streaming request
      await this._sendStreamingRequest(requestId, request, streamingCallbacks, onProgress);

      // Return success - relations and validation have been applied via callbacks
      return {
        relationsApplied: true,
        infoItems: [], // Info items are delivered via callback, not returned
        thumbnails: undefined, // Thumbnails are delivered via callback batches
        thumbnailLinks: undefined,
      };
    } catch (e) {
      // Don't show an alert - just log and fall back to main thread processing
      Log.verbose("Worker combined processing failed, falling back to main thread: " + e);
      return undefined;
    }
  }

  /**
   * Apply thumbnail links from worker result to project items.
   * Links indicate that an item should show another item's thumbnail.
   */
  private _applyThumbnailLinks(project: IProjectForWorker, thumbnailLinks: { [projectPath: string]: string }): void {
    const items = project.getItemsCopy();
    const itemsByPath = new Map<string, ProjectItem>();

    for (const item of items) {
      if (item.projectPath) {
        itemsByPath.set(item.projectPath, item);
      }
    }

    for (const [itemPath, linkedItemPath] of Object.entries(thumbnailLinks)) {
      const item = itemsByPath.get(itemPath);
      const linkedItem = itemsByPath.get(linkedItemPath);
      if (item) {
        // Set the thumbnailLink so the sidebar can follow it as a fallback
        item.thumbnailLink = linkedItemPath;
        // Also eagerly copy the thumbnail if it's already available
        if (linkedItem?.cachedThumbnail) {
          item.cachedThumbnail = linkedItem.cachedThumbnail;
        }
      }
    }
  }

  /**
   * Deserialize info items from worker result.
   */
  private _deserializeInfoItems(serialized: ISerializableInfoItem[], project: IProjectForWorker): ProjectInfoItem[] {
    const items = project.getItemsCopy();
    const itemsByPath = new Map<string, ProjectItem>();

    for (const item of items) {
      if (item.projectPath) {
        itemsByPath.set(item.projectPath, item);
      }
    }

    return serialized.map((s) => {
      const infoItem = new ProjectInfoItem(
        s.itemType,
        s.generatorId,
        s.generatorIndex,
        s.message,
        s.projectItemStoragePath ? itemsByPath.get(s.projectItemStoragePath) : undefined,
        s.data,
        s.content
      );

      // Restore featureSets from worker result
      if (s.featureSets) {
        infoItem.featureSets = s.featureSets;
      }

      return infoItem;
    });
  }

  /**
   * Send a request to the worker and wait for response.
   */
  private _sendRequest<T>(request: any, onProgress?: (message: string, percent?: number) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = this._worker;
      if (!worker) {
        reject(new Error("Worker not initialized"));
        return;
      }

      this._pendingRequests.set(request.requestId, { resolve, reject, onProgress });
      worker.postMessage(request);
    });
  }

  /**
   * Send a streaming request that delivers results via callbacks.
   * Resolves when validation is complete (thumbnails may still be generating).
   */
  private _sendStreamingRequest(
    requestId: string,
    request: any,
    streaming: IStreamingCallbacks,
    onProgress?: (message: string, percent?: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = this._worker;
      if (!worker) {
        reject(new Error("Worker not initialized"));
        return;
      }

      this._pendingRequests.set(requestId, {
        resolve,
        reject,
        onProgress,
        streaming,
        isStreaming: true,
      });
      worker.postMessage(request);
    });
  }

  /**
   * Apply thumbnail results from worker to actual project items.
   * After setting thumbnails on geometry/block items, propagates them UP the
   * parent chain so entity types, entity resources, and item types also get thumbnails.
   */
  private _applyThumbnailsResult(project: IProjectForWorker, thumbnails: { [projectPath: string]: string }): void {
    const items = project.getItemsCopy();
    const itemsByPath = new Map<string, ProjectItem>();

    for (const item of items) {
      if (item.projectPath) {
        itemsByPath.set(item.projectPath, item);
      }
    }

    // Item types that should inherit thumbnails from their child geometry/block items
    const inheritableTypes = new Set([
      ProjectItemType.entityTypeBehavior,
      ProjectItemType.entityTypeResource,
      ProjectItemType.itemTypeBehavior,
    ]);

    for (const [projectPath, thumbnail] of Object.entries(thumbnails)) {
      const item = itemsByPath.get(projectPath);
      if (item) {
        item.cachedThumbnail = thumbnail;

        // Propagate thumbnail UP to parent items (e.g., geometry → entityResource → entityBehavior)
        if (item.parentItems) {
          for (const parentRel of item.parentItems) {
            const parent = parentRel.parentItem;
            if (parent && inheritableTypes.has(parent.itemType) && !parent.cachedThumbnail) {
              parent.cachedThumbnail = thumbnail;
              parent.thumbnailLink = projectPath;

              // Also propagate to grandparents (entityResource → entityBehavior)
              if (parent.parentItems) {
                for (const grandparentRel of parent.parentItems) {
                  const grandparent = grandparentRel.parentItem;
                  if (grandparent && inheritableTypes.has(grandparent.itemType) && !grandparent.cachedThumbnail) {
                    grandparent.cachedThumbnail = thumbnail;
                    grandparent.thumbnailLink = projectPath;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Cancel pending thumbnail generation in the worker.
   */
  cancelPendingThumbnails(): void {
    const worker = this._worker;
    if (!worker) {
      return;
    }

    const requestId = Utilities.createUuid();
    const request: ICancelThumbnailsRequest = {
      type: ProjectWorkerMessageType.cancelThumbnails,
      requestId,
    };
    worker.postMessage(request);
  }

  /**
   * Dispose the cached project in the worker to free memory.
   */
  disposeWorkerProject(): void {
    const worker = this._worker;
    if (!worker) {
      return;
    }

    const requestId = Utilities.createUuid();
    const request: IDisposeProjectRequest = {
      type: ProjectWorkerMessageType.disposeProject,
      requestId,
    };
    worker.postMessage(request);
    this._currentProjectName = undefined;
  }

  /**
   * Terminate the worker.
   */
  terminate(): void {
    if (this._worker) {
      this._worker.terminate();
      this._worker = undefined;
    }

    this._currentProjectName = undefined;

    // Reject all pending requests
    for (const [, pending] of this._pendingRequests) {
      pending.reject(new Error("Worker terminated"));
    }
    this._pendingRequests.clear();
  }
}

// Auto-register the worker manager when this module is loaded in a browser environment
// @ts-ignore
if (typeof window !== "undefined") {
  registerProjectWorkerManager(ProjectWorkerManager.instance);
}

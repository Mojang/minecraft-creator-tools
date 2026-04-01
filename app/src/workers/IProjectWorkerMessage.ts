// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "../info/IInfoItemData";
import { ProjectInfoSuite } from "../info/IProjectInfoData";

/**
 * Describes how storage is transferred to the worker.
 */
export enum StorageTransferMode {
  /** Use BrowserStorage pointer - worker hydrates from same IndexedDB */
  browserStoragePointer = "browserStoragePointer",
  /** Use serialized in-memory storage as JSON */
  serializedStorage = "serializedStorage",
}

/**
 * Pointer to BrowserStorage for worker to hydrate from same IndexedDB.
 */
export interface IBrowserStoragePointer {
  mode: StorageTransferMode.browserStoragePointer;
  /** Storage name for BrowserStorage (null for default) */
  storageName: string | null;
  /** Path to the project folder within storage */
  projectFolderPath: string;
}

/**
 * Serialized file for transfer to worker.
 */
export interface ISerializedFile {
  name: string;
  /** Text content for text files */
  textContent?: string;
  /** Base64-encoded binary content (only for small binaries if needed) */
  binaryContentBase64?: string;
  /** If true, binary content was skipped for performance */
  binarySkipped?: boolean;
  /** Last modified time */
  modifiedAtMs?: number;
}

/**
 * Serialized folder for transfer to worker.
 */
export interface ISerializedFolder {
  name: string;
  files: { [name: string]: ISerializedFile };
  folders: { [name: string]: ISerializedFolder };
}

/**
 * Serialized in-memory storage for transfer to worker.
 */
export interface ISerializedStorage {
  mode: StorageTransferMode.serializedStorage;
  projectName: string;
  rootFolder: ISerializedFolder;
}

/**
 * Union type for storage transfer data.
 */
export type StorageTransferData = IBrowserStoragePointer | ISerializedStorage;

/**
 * Serializable representation of an item relationship.
 */
export interface ISerializableRelationship {
  parentStoragePath: string;
  childStoragePath: string;
}

/**
 * Serializable representation of an unfulfilled relationship.
 */
export interface ISerializableUnfulfilledRelationship {
  itemType: ProjectItemType;
  path: string;
  isVanillaDependent: boolean;
}

/**
 * Feature set data - mapping from set names to measure names to values.
 */
export type FeatureSetsData = { [setName: string]: { [measureName: string]: number | undefined } | undefined };

/**
 * Serializable representation of a project info item.
 */
export interface ISerializableInfoItem {
  itemType: InfoItemType;
  generatorId: string;
  generatorIndex: number;
  message?: string;
  data?: string | boolean | number | number[];
  projectItemStoragePath?: string;
  content?: string;
  featureSets?: FeatureSetsData;
}

/**
 * Message types for worker communication.
 *
 * The new streaming architecture uses a persistent worker with cached project state:
 * - hydrateProject: Preload and cache a project in the worker
 * - disposeProject: Clean up cached project (called on project switch or idle timeout)
 * - processRelationsAndGenerateInfoSet: Main entry point - streams results as they complete:
 *   1. relationsComplete - sent immediately after relations calculated (unblocks waiters)
 *   2. validationComplete - sent after validation finishes
 *   3. Thumbnails are enqueued to low-priority queue (silent, no progress to user)
 * - cancelThumbnails: Stop pending thumbnail generation (e.g., on project switch)
 */
export enum ProjectWorkerMessageType {
  // Main thread -> Worker
  hydrateProject = "hydrateProject",
  disposeProject = "disposeProject",
  generateInfoSet = "generateInfoSet",
  processRelationsAndGenerateInfoSet = "processRelationsAndGenerateInfoSet",
  cancelThumbnails = "cancelThumbnails",
  cancel = "cancel",

  // Worker -> Main thread (streamed responses)
  hydrateComplete = "hydrateComplete",
  projectDisposed = "projectDisposed",
  relationsComplete = "relationsComplete",
  validationComplete = "validationComplete",
  thumbnailBatchComplete = "thumbnailBatchComplete",
  thumbnailsFinished = "thumbnailsFinished",

  // Legacy combined result (deprecated - kept for backward compatibility during transition)
  generateInfoSetResult = "generateInfoSetResult",
  processRelationsAndGenerateInfoSetResult = "processRelationsAndGenerateInfoSetResult",

  progress = "progress",
  error = "error",
}

/**
 * Request to hydrate and cache a project in the worker.
 * Subsequent requests for the same project will reuse the cached project.
 */
export interface IHydrateProjectRequest {
  type: ProjectWorkerMessageType.hydrateProject;
  requestId: string;
  storageData: StorageTransferData;
  projectName: string;
  /** Content root URL for loading data files (e.g., mccat.json, typedefs) */
  contentRoot: string;
}

/**
 * Result of hydrating a project.
 */
export interface IHydrateCompleteResponse {
  type: ProjectWorkerMessageType.hydrateComplete;
  requestId: string;
  projectName: string;
  itemCount: number;
}

/**
 * Request to dispose cached project and free memory.
 */
export interface IDisposeProjectRequest {
  type: ProjectWorkerMessageType.disposeProject;
  requestId: string;
}

/**
 * Acknowledgment that project was disposed.
 */
export interface IProjectDisposedResponse {
  type: ProjectWorkerMessageType.projectDisposed;
  requestId: string;
}

/**
 * Common structure for relations results (used by both single and combined operations).
 */
export interface IRelationsResultData {
  childRelations: { [parentPath: string]: ISerializableRelationship[] };
  unfulfilledRelations: { [parentPath: string]: ISerializableUnfulfilledRelationship[] };
}

/**
 * Streamed response: relations calculation complete.
 * Sent immediately after relations are calculated, before validation starts.
 */
export interface IRelationsCompleteResponse extends IRelationsResultData {
  type: ProjectWorkerMessageType.relationsComplete;
  requestId: string;
}

/**
 * Request to generate project info set.
 */
export interface IGenerateInfoSetRequest {
  type: ProjectWorkerMessageType.generateInfoSet;
  requestId: string;
  storageData: StorageTransferData;
  suite: ProjectInfoSuite;
  /** Content root URL for loading data files (e.g., mccat.json, typedefs) */
  contentRoot: string;
}

/**
 * Result of generating project info set.
 */
export interface IGenerateInfoSetResult {
  type: ProjectWorkerMessageType.generateInfoSetResult;
  requestId: string;
  infoItems: ISerializableInfoItem[];
}

/**
 * Request to process relations AND generate info set in one operation.
 * This avoids serializing/hydrating the project twice.
 * Results are streamed back as separate messages:
 * - relationsComplete: sent immediately after relations calculated
 * - validationComplete: sent after validation finishes
 * - thumbnails enqueued to low-priority queue (streamed via thumbnailBatchComplete)
 */
export interface IProcessRelationsAndGenerateInfoSetRequest {
  type: ProjectWorkerMessageType.processRelationsAndGenerateInfoSet;
  requestId: string;
  storageData: StorageTransferData;
  suite: ProjectInfoSuite;
  /** Content root URL for loading data files (e.g., mccat.json, typedefs) */
  contentRoot: string;
}

/**
 * Streamed response: validation complete.
 * Sent after info set generation finishes.
 */
export interface IValidationCompleteResponse {
  type: ProjectWorkerMessageType.validationComplete;
  requestId: string;
  infoItems: ISerializableInfoItem[];
}

/**
 * Combined result of processing relations and generating info set.
 * @deprecated Use streamed responses (relationsComplete, validationComplete) instead.
 * Kept for backward compatibility during transition.
 */
export interface IProcessRelationsAndGenerateInfoSetResult extends IRelationsResultData {
  type: ProjectWorkerMessageType.processRelationsAndGenerateInfoSetResult;
  requestId: string;
  infoItems: ISerializableInfoItem[];
  /** Thumbnails generated for geometry items (projectPath -> data URL) */
  thumbnails?: { [projectPath: string]: string };
  /** Thumbnail links for items that should show another item's thumbnail (itemPath -> linkedItemPath) */
  thumbnailLinks?: { [projectPath: string]: string };
}

/**
 * Progress update from worker.
 */
export interface IWorkerProgressMessage {
  type: ProjectWorkerMessageType.progress;
  requestId: string;
  message: string;
  percentComplete?: number;
}

/**
 * Error message from worker.
 */
export interface IWorkerErrorMessage {
  type: ProjectWorkerMessageType.error;
  requestId: string;
  error: string;
}

/**
 * Cancel request.
 */
export interface ICancelRequest {
  type: ProjectWorkerMessageType.cancel;
  requestId: string;
}

/**
 * Request to cancel pending thumbnail generation.
 * Thumbnails currently being processed will finish, but no new batches will start.
 */
export interface ICancelThumbnailsRequest {
  type: ProjectWorkerMessageType.cancelThumbnails;
  requestId: string;
}

/**
 * Streamed response: a batch of thumbnails completed.
 * Sent periodically as thumbnails are generated in the background.
 * This is for internal tracking only - NOT forwarded to user-visible progress.
 */
export interface IThumbnailBatchCompleteResponse {
  type: ProjectWorkerMessageType.thumbnailBatchComplete;
  requestId: string;
  /** Map of projectPath -> thumbnail data URL for this batch */
  thumbnails: { [projectPath: string]: string };
  /** Thumbnail links for items that should show another item's thumbnail */
  thumbnailLinks?: { [projectPath: string]: string };
  /** Number of thumbnails completed so far */
  completed: number;
  /** Total number of thumbnails to generate */
  total: number;
}

/**
 * Streamed response: all thumbnails finished (or cancelled).
 */
export interface IThumbnailsFinishedResponse {
  type: ProjectWorkerMessageType.thumbnailsFinished;
  requestId: string;
  /** Whether thumbnail generation was cancelled before completion */
  cancelled: boolean;
  /** Total thumbnails successfully generated */
  totalGenerated: number;
}

export type ProjectWorkerRequest =
  | IHydrateProjectRequest
  | IDisposeProjectRequest
  | IGenerateInfoSetRequest
  | IProcessRelationsAndGenerateInfoSetRequest
  | ICancelThumbnailsRequest
  | ICancelRequest;

export type ProjectWorkerResponse =
  | IHydrateCompleteResponse
  | IProjectDisposedResponse
  | IRelationsCompleteResponse
  | IValidationCompleteResponse
  | IGenerateInfoSetResult
  | IProcessRelationsAndGenerateInfoSetResult
  | IThumbnailBatchCompleteResponse
  | IThumbnailsFinishedResponse
  | IWorkerProgressMessage
  | IWorkerErrorMessage;

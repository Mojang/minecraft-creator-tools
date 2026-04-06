// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// This web worker handles CPU-intensive project operations like:
// - Processing item relations (dependencies between project items)
// - Running validation/info generation
//
// It receives serialized storage data, hydrates a Project, runs the existing
// logic, and returns serialized results.
//
// Storage modes:
// - serializedStorage: Full project content serialized as JSON (works everywhere)
// - browserStoragePointer: Points to BrowserStorage in IndexedDB (faster for large projects)
//
// NOTE: BrowserStorage pointer mode requires localforage which CAN work in web workers
// when using the IndexedDB driver. We configure it to use IndexedDB only.

// CRITICAL: Import worker polyfills FIRST - this adds window shim before other imports run.
// The polyfill module has no imports, so its code executes immediately.
import { generateCryptoRandomNumber } from "./worker-polyfills";

// IMPORTANT: Set up worker-safe alert function BEFORE importing any modules
// that might use Log.debugAlert, since workers don't have window/alert/prompt
import { LogItem } from "../core/Log";
import { ResourceConsumptionConstraint } from "../info/ProjectInfoSet";

// Override the alert function to use Log.debug in worker context
LogItem.alertFunction = (message: string) => {
  Log.debug("[Worker Alert] " + message);
};

import {
  StorageTransferMode,
  IBrowserStoragePointer,
  ISerializedStorage,
  ISerializedFolder,
  StorageTransferData,
  ISerializableRelationship,
  ISerializableUnfulfilledRelationship,
  ISerializableInfoItem,
  ProjectWorkerMessageType,
  IHydrateProjectRequest,
  IDisposeProjectRequest,
  IGenerateInfoSetRequest,
  IGenerateInfoSetResult,
  IProcessRelationsAndGenerateInfoSetRequest,
  ICancelThumbnailsRequest,
  IRelationsCompleteResponse,
  IValidationCompleteResponse,
  IThumbnailBatchCompleteResponse,
  IThumbnailsFinishedResponse,
  IWorkerProgressMessage,
  ProjectWorkerRequest,
} from "./IProjectWorkerMessage";
import Storage from "../storage/Storage";
import Folder from "../storage/Folder";
import BrowserStorage from "../storage/BrowserStorage";
import CreatorTools from "../app/CreatorTools";
import CreatorToolsHost from "../app/CreatorToolsHost";
import Project from "../app/Project";
import ProjectItemRelations from "../app/ProjectItemRelations";
import ProjectInfoSet from "../info/ProjectInfoSet";
import IStorage from "../storage/IStorage";
import IFolder from "../storage/IFolder";
import Utilities from "../core/Utilities";
import Log from "../core/Log";
import { ProjectItemType } from "../app/IProjectItemData";
import Model2DRenderer from "../minecraft/Model2DRenderer";
import IModelGeometry, { IGeometry } from "../minecraft/IModelGeometry";
import ImageCodec from "../core/ImageCodec";
import StorageUtilities from "../storage/StorageUtilities";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";

// Set up CreatorToolsHost.generateCryptoRandomNumber for worker context
// This is needed because CreatorToolsHost.init() doesn't run in workers
CreatorToolsHost.generateCryptoRandomNumber = generateCryptoRandomNumber;

// Worker context
const ctx: Worker = self as any;

// ============================================================================
// PERSISTENT WORKER STATE
// ============================================================================

/**
 * Cached project state to avoid re-hydrating on every request.
 * Disposed on project switch or after idle timeout.
 */
let cachedProject: Project | undefined;
let cachedProjectName: string | undefined;
let cachedProjectFolder: IFolder | undefined;

/**
 * Idle timeout to auto-dispose cached project after inactivity.
 * Helps prevent memory leaks when user switches away from the app.
 */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
let idleTimeoutId: ReturnType<typeof setTimeout> | undefined;

/**
 * Reset the idle timeout. Called after any activity with the cached project.
 */
function resetIdleTimeout(): void {
  if (idleTimeoutId !== undefined) {
    clearTimeout(idleTimeoutId);
  }
  idleTimeoutId = setTimeout(() => {
    Log.debug("[Worker] Idle timeout reached, disposing cached project");
    disposeCurrentProject();
  }, IDLE_TIMEOUT_MS);
}

/**
 * Dispose the currently cached project to free memory.
 */
function disposeCurrentProject(): void {
  if (idleTimeoutId !== undefined) {
    clearTimeout(idleTimeoutId);
    idleTimeoutId = undefined;
  }

  if (cachedProject) {
    cleanupProject(cachedProject);
    cachedProject = undefined;
    cachedProjectName = undefined;
    cachedProjectFolder = undefined;
  }

  // Cancel any pending thumbnail work
  thumbnailsCancelled = true;
}

// ============================================================================
// LOW-PRIORITY THUMBNAIL QUEUE
// ============================================================================

/**
 * Queue of project paths to generate thumbnails for.
 * Processed in batches with yields between to allow higher-priority work.
 */
let thumbnailQueue: string[] = [];
let thumbnailQueueProject: Project | undefined;
let thumbnailQueueRequestId: string | undefined;
let isThumbnailProcessing = false;
let thumbnailsCancelled = false;
let thumbnailsGenerated: { [projectPath: string]: string } = {};
let thumbnailsCompletedCount = 0;
let thumbnailsTotalCount = 0;

const THUMBNAIL_BATCH_SIZE = 20;

/**
 * Decode PNG data to RGBA pixels in a web worker.
 * Delegates to ImageCodec which uses OffscreenCanvas in browser/worker environments.
 */
async function decodePngInWorker(
  pngData: Uint8Array
): Promise<{ width: number; height: number; pixels: Uint8Array } | undefined> {
  return ImageCodec.decodePngBrowser(pngData);
}

/**
 * Decode TGA data to RGBA pixels in a web worker.
 * Delegates to ImageCodec.
 */
async function decodeTgaInWorker(
  tgaData: Uint8Array
): Promise<{ width: number; height: number; pixels: Uint8Array } | undefined> {
  return ImageCodec.decodeTga(tgaData);
}

/**
 * Decode image data (PNG or TGA) to RGBA pixels in a web worker.
 * Delegates to ImageCodec.
 */
async function decodeImageInWorker(
  imageData: Uint8Array,
  fileType: string
): Promise<{ width: number; height: number; pixels: Uint8Array } | undefined> {
  return ImageCodec.decode(imageData, fileType);
}

/**
 * Hydrate an in-memory Storage from a serialized folder structure.
 */
function hydrateStorageFromSerialized(serialized: ISerializedStorage): Storage {
  const storage = new Storage();

  hydrateFolder(storage.rootFolder, serialized.rootFolder);

  return storage;
}

/**
 * Recursively hydrate a folder from serialized data.
 */
function hydrateFolder(folder: Folder, serialized: ISerializedFolder): void {
  // Hydrate files
  for (const fileName of Object.keys(serialized.files)) {
    const serializedFile = serialized.files[fileName];
    if (!serializedFile) continue;

    const file = folder.ensureFile(serializedFile.name);

    if (serializedFile.textContent !== undefined) {
      file.setContent(serializedFile.textContent);
    } else if (serializedFile.binaryContentBase64 !== undefined) {
      const binaryContent = Utilities.base64ToUint8Array(serializedFile.binaryContentBase64);
      file.setContent(binaryContent);
    }

    // Set modified time if available
    if (serializedFile.modifiedAtMs !== undefined && file.modified) {
      file.modified = new Date(serializedFile.modifiedAtMs);
    }
  }

  // Hydrate subfolders
  for (const folderName of Object.keys(serialized.folders)) {
    const serializedSubFolder = serialized.folders[folderName];
    if (!serializedSubFolder) continue;

    const subFolder = folder.ensureFolder(serializedSubFolder.name);
    hydrateFolder(subFolder, serializedSubFolder);
  }

  folder.updateLastLoadedOrSaved();
}

/**
 * Hydrate storage from a BrowserStorage pointer.
 * This accesses the same IndexedDB data that the main thread uses,
 * avoiding the need to serialize and transfer all file content.
 *
 * BrowserStorage.ensureConfigured() will set up localforage to use IndexedDB,
 * which works correctly in web workers.
 */
async function hydrateStorageFromBrowserPointer(
  pointer: IBrowserStoragePointer
): Promise<{ storage: IStorage; projectFolder: IFolder }> {
  // Create BrowserStorage with the same name used on the main thread
  // The BrowserStorage constructor will configure localforage to use IndexedDB
  const storage = new BrowserStorage(pointer.storageName);

  // Load the project folder from the specified path
  let projectFolder: IFolder = storage.rootFolder;

  if (pointer.projectFolderPath && pointer.projectFolderPath.length > 0) {
    projectFolder = await storage.rootFolder.ensureFolderFromRelativePath(pointer.projectFolderPath);
  }

  // Load the folder structure
  await projectFolder.load();

  return { storage, projectFolder };
}

/**
 * Create a minimal CreatorTools instance for the worker.
 * This only creates the bare minimum needed for Project to function.
 */
function createWorkerCreatorTools(projectStorage: IStorage): CreatorTools {
  // Create minimal in-memory storage instances for required params
  const dummyStorage = new Storage();

  return new CreatorTools(
    dummyStorage, // settingsStorage
    projectStorage, // projectsStorage
    [], // deploymentsStorage
    null, // worldStorage
    null, // packStorage
    null, // workingStorage
    null // contentRoot
  );
}

/**
 * Hydrate a Project from storage transfer data.
 */
async function hydrateProject(
  storageData: StorageTransferData,
  projectName: string
): Promise<{ project: Project; projectFolder: IFolder }> {
  let storage: IStorage;
  let projectFolder: IFolder;

  if (storageData.mode === StorageTransferMode.browserStoragePointer) {
    // BrowserStorage pointer mode - access IndexedDB directly
    const pointer = storageData as IBrowserStoragePointer;
    const result = await hydrateStorageFromBrowserPointer(pointer);
    storage = result.storage;
    projectFolder = result.projectFolder;
  } else {
    // Serialized storage mode - hydrate from JSON
    const serialized = storageData as ISerializedStorage;
    storage = hydrateStorageFromSerialized(serialized);
    projectFolder = storage.rootFolder;
    projectName = serialized.projectName || projectName;
  }

  const creatorTools = createWorkerCreatorTools(storage);
  const project = new Project(creatorTools, projectName, null);

  // Set project folder and load
  project.setProjectFolder(projectFolder);
  await project.inferProjectItemsFromFilesRootFolder();

  return { project, projectFolder };
}

/**
 * Send progress message to main thread.
 */
function sendProgress(requestId: string, message: string, percentComplete?: number): void {
  const progressMsg: IWorkerProgressMessage = {
    type: ProjectWorkerMessageType.progress,
    requestId,
    message,
    percentComplete,
  };
  ctx.postMessage(progressMsg);
}

/**
 * Explicitly clear project data to help garbage collection.
 * This is especially important for large projects to avoid memory buildup
 * between worker tasks.
 */
function cleanupProject(project: Project | undefined): void {
  if (!project) {
    return;
  }

  // Clear all project items and their references
  const items = project.getItemsCopy();
  for (const item of items) {
    // Clear item relationships to break reference cycles
    if (item.childItems) {
      item.childItems.length = 0;
    }
    if (item.unfulfilledRelationships) {
      item.unfulfilledRelationships.length = 0;
    }
  }

  // Clear the project's internal arrays
  project.items.length = 0;
}

// ============================================================================
// THUMBNAIL QUEUE PROCESSING (Low Priority)
// ============================================================================

/**
 * Enqueue thumbnail generation for a project.
 * Thumbnails are processed in batches with yields between to allow higher-priority work.
 * Progress is NOT sent to user-visible progress bar - thumbnails are silent background work.
 */
function enqueueThumbnails(project: Project, requestId: string, items: import("../app/ProjectItem").default[]): void {
  // Get all items that need thumbnails
  const geometryItems = items.filter((item) => item.itemType === ProjectItemType.modelGeometryJson);
  const blockItems = items.filter((item) => item.itemType === ProjectItemType.blockTypeBehavior);

  // Collect project paths
  const projectPaths: string[] = [];
  for (const item of geometryItems) {
    if (item.projectPath) {
      projectPaths.push(item.projectPath);
    }
  }
  for (const item of blockItems) {
    if (item.projectPath) {
      projectPaths.push(item.projectPath);
    }
  }

  if (projectPaths.length === 0) {
    // No thumbnails to generate, send finished immediately
    const finishedMsg: IThumbnailsFinishedResponse = {
      type: ProjectWorkerMessageType.thumbnailsFinished,
      requestId,
      cancelled: false,
      totalGenerated: 0,
    };
    ctx.postMessage(finishedMsg);
    return;
  }

  // Reset queue state
  thumbnailQueue = projectPaths;
  thumbnailQueueProject = project;
  thumbnailQueueRequestId = requestId;
  thumbnailsCancelled = false;
  thumbnailsGenerated = {};
  thumbnailsCompletedCount = 0;
  thumbnailsTotalCount = projectPaths.length;
  isThumbnailProcessing = false;

  // Start processing (async, non-blocking)
  processThumbnailQueue();
}

/**
 * Process the thumbnail queue in batches.
 * Uses setTimeout to yield between batches, allowing higher-priority messages to be processed.
 */
async function processThumbnailQueue(): Promise<void> {
  if (isThumbnailProcessing) {
    return; // Already processing
  }

  if (thumbnailsCancelled || thumbnailQueue.length === 0 || !thumbnailQueueProject || !thumbnailQueueRequestId) {
    // Cancelled or done - send finished message
    const finishedMsg: IThumbnailsFinishedResponse = {
      type: ProjectWorkerMessageType.thumbnailsFinished,
      requestId: thumbnailQueueRequestId || "unknown",
      cancelled: thumbnailsCancelled,
      totalGenerated: thumbnailsCompletedCount,
    };
    ctx.postMessage(finishedMsg);

    // Reset state
    isThumbnailProcessing = false;
    thumbnailQueueProject = undefined;
    thumbnailQueueRequestId = undefined;
    return;
  }

  isThumbnailProcessing = true;
  const requestId = thumbnailQueueRequestId;
  const project = thumbnailQueueProject;

  // Process a batch
  const batch = thumbnailQueue.splice(0, THUMBNAIL_BATCH_SIZE);
  const batchThumbnails: { [projectPath: string]: string } = {};
  const batchLinks: { [projectPath: string]: string } = {};

  for (const projectPath of batch) {
    if (thumbnailsCancelled) {
      break;
    }

    try {
      const thumbnail = await generateSingleThumbnail(project, projectPath);
      if (thumbnail) {
        batchThumbnails[projectPath] = thumbnail;
        thumbnailsGenerated[projectPath] = thumbnail;
        thumbnailsCompletedCount++;
      }
    } catch (e) {
      // Log and continue - don't interrupt thumbnail generation for individual failures
      Log.debug(`Failed to generate thumbnail for ${projectPath}: ${e}`);
    }
  }

  // Compute thumbnail links for items whose thumbnails should come from other items
  // (e.g., entity behavior -> geometry model). Only include links where the target
  // thumbnail has already been generated.
  const items = project.getItemsCopy();
  const allLinks = computeThumbnailLinks(items);
  for (const [itemPath, linkedItemPath] of Object.entries(allLinks)) {
    if (thumbnailsGenerated[linkedItemPath]) {
      batchLinks[itemPath] = linkedItemPath;
    }
  }

  // Send batch complete (for internal tracking, NOT user-visible progress)
  if (Object.keys(batchThumbnails).length > 0 || Object.keys(batchLinks).length > 0) {
    const batchMsg: IThumbnailBatchCompleteResponse = {
      type: ProjectWorkerMessageType.thumbnailBatchComplete,
      requestId,
      thumbnails: batchThumbnails,
      thumbnailLinks: batchLinks,
      completed: thumbnailsCompletedCount,
      total: thumbnailsTotalCount,
    };
    ctx.postMessage(batchMsg);
  }

  isThumbnailProcessing = false;

  // Check if done or cancelled
  if (thumbnailsCancelled || thumbnailQueue.length === 0) {
    const finishedMsg: IThumbnailsFinishedResponse = {
      type: ProjectWorkerMessageType.thumbnailsFinished,
      requestId,
      cancelled: thumbnailsCancelled,
      totalGenerated: thumbnailsCompletedCount,
    };
    ctx.postMessage(finishedMsg);

    thumbnailQueueProject = undefined;
    thumbnailQueueRequestId = undefined;
    return;
  }

  // Yield to allow higher-priority messages, then continue
  setTimeout(() => {
    processThumbnailQueue();
  }, 0);
}

/**
 * Generate a single thumbnail for a project item.
 * Returns the thumbnail data URL or undefined if generation failed.
 */
async function generateSingleThumbnail(project: Project, projectPath: string): Promise<string | undefined> {
  const items = project.getItemsCopy();
  const item = items.find((i) => i.projectPath === projectPath);
  if (!item) {
    return undefined;
  }

  const thumbnailWidth = 128;
  const thumbnailHeight = 128;

  if (item.itemType === ProjectItemType.modelGeometryJson) {
    return await generateGeometryThumbnail(project, item, thumbnailWidth, thumbnailHeight);
  } else if (item.itemType === ProjectItemType.blockTypeBehavior) {
    return await generateBlockThumbnail(project, item, thumbnailWidth, thumbnailHeight);
  }

  return undefined;
}

/**
 * Generate thumbnail for a geometry model item.
 */
async function generateGeometryThumbnail(
  project: Project,
  item: import("../app/ProjectItem").default,
  thumbnailWidth: number,
  thumbnailHeight: number
): Promise<string | undefined> {
  try {
    await item.ensureFileStorage();
    const file = item.getFile();
    if (!file) return undefined;

    await file.loadContent();
    if (!file.content) return undefined;

    const content = typeof file.content === "string" ? file.content : new TextDecoder().decode(file.content);
    const geoData = JSON.parse(content) as IModelGeometry;

    let geometry: IGeometry | undefined;
    if (geoData["minecraft:geometry"] && geoData["minecraft:geometry"].length > 0) {
      geometry = geoData["minecraft:geometry"][0];
    } else {
      for (const key of Object.keys(geoData)) {
        if (key.startsWith("geometry.")) {
          geometry = (geoData as any)[key] as IGeometry;
          break;
        }
      }
    }

    if (!geometry) return undefined;

    // Find texture through relationships
    let texturePixels: { width: number; height: number; pixels: Uint8Array } | undefined;
    let textureWidth = geometry.description?.texture_width || geometry.texturewidth || 64;
    let textureHeight = geometry.description?.texture_height || geometry.textureheight || 64;

    // Try to find texture through parent items
    if (item.parentItems) {
      for (const parentRel of item.parentItems) {
        const parent = parentRel.parentItem;
        if (parent.childItems) {
          for (const childRel of parent.childItems) {
            if (childRel.childItem.itemType === ProjectItemType.texture) {
              const texItem = childRel.childItem;
              try {
                await texItem.ensureFileStorage();
                const texFile = texItem.getFile();
                if (texFile) {
                  await texFile.loadContent();
                  if (texFile.content instanceof Uint8Array && texFile.content.length > 200) {
                    const fileType = StorageUtilities.getTypeFromName(texFile.name);
                    const decoded = await decodeImageInWorker(texFile.content, fileType);
                    if (decoded) {
                      texturePixels = decoded;
                      break;
                    }
                  }
                }
              } catch {
                // Continue
              }
            }
          }
        }
        if (texturePixels) break;
      }
    }

    const svg = Model2DRenderer.renderToSvg(geometry, {
      viewDirection: "iso-front-left",
      outputWidth: thumbnailWidth,
      outputHeight: thumbnailHeight,
      depthShading: true,
      depthShadingIntensity: 0.25,
      perspectiveStrength: 0,
      focalLength: 80,
      fallbackColor: "#888888",
      padding: 2,
      texturePixels: texturePixels,
      textureWidth: texturePixels?.width || textureWidth,
      textureHeight: texturePixels?.height || textureHeight,
      textureSampleResolution: 4,
    });

    return `data:image/svg+xml;base64,${btoa(svg)}`;
  } catch {
    return undefined;
  }
}

/**
 * Generate thumbnail for a block type item.
 */
async function generateBlockThumbnail(
  project: Project,
  item: import("../app/ProjectItem").default,
  thumbnailWidth: number,
  thumbnailHeight: number
): Promise<string | undefined> {
  try {
    await item.ensureFileStorage();
    const file = item.getFile();
    if (!file) return undefined;

    await file.loadContent();
    const blockTypeDef = await BlockTypeDefinition.ensureOnFile(file);
    if (!blockTypeDef) return undefined;

    // Get texture
    let texturePixels: { width: number; height: number; pixels: Uint8Array } | undefined;
    const textureItems = await blockTypeDef.getTextureItems(item, project);
    if (textureItems) {
      for (const texKey of Object.keys(textureItems)) {
        const texItem = textureItems[texKey];
        try {
          await texItem.ensureFileStorage();
          const texFile = texItem.getFile();
          if (texFile) {
            await texFile.loadContent();
            if (texFile.content instanceof Uint8Array && texFile.content.length > 200) {
              const fileType = StorageUtilities.getTypeFromName(texFile.name);
              const decoded = await decodeImageInWorker(texFile.content, fileType);
              if (decoded) {
                texturePixels = decoded;
                break;
              }
            }
          }
        } catch {
          // Continue
        }
      }
    }

    // Use unit cube or custom geometry
    let geometryToRender: IGeometry = Model2DRenderer.UNIT_CUBE_GEOMETRY;
    let textureWidth = texturePixels?.width || 16;
    let textureHeight = texturePixels?.height || 16;

    // Check for custom geometry
    const geometryChildRel = item.childItems?.find(
      (rel) => rel.childItem.itemType === ProjectItemType.modelGeometryJson
    );
    if (geometryChildRel) {
      try {
        const geoItem = geometryChildRel.childItem;
        await geoItem.ensureFileStorage();
        const geoFile = geoItem.getFile();
        if (geoFile) {
          await geoFile.loadContent();
          if (geoFile.content) {
            const content =
              typeof geoFile.content === "string" ? geoFile.content : new TextDecoder().decode(geoFile.content);
            const geoData = JSON.parse(content) as IModelGeometry;

            let geometry: IGeometry | undefined;
            if (geoData["minecraft:geometry"] && geoData["minecraft:geometry"].length > 0) {
              geometry = geoData["minecraft:geometry"][0];
            } else {
              for (const key of Object.keys(geoData)) {
                if (key.startsWith("geometry.")) {
                  geometry = (geoData as any)[key] as IGeometry;
                  break;
                }
              }
            }

            if (geometry) {
              geometryToRender = geometry;
              textureWidth = geometry.description?.texture_width || geometry.texturewidth || 64;
              textureHeight = geometry.description?.texture_height || geometry.textureheight || 64;
            }
          }
        }
      } catch {
        // Use unit cube
      }
    }

    // Use the block's map_color for fallback if no texture is available
    let blockColor: string | undefined;
    const mapColorComp = blockTypeDef.getComponent("minecraft:map_color");
    if (mapColorComp && mapColorComp.getData()) {
      blockColor = typeof mapColorComp.getData() === "string" ? (mapColorComp.getData() as string) : undefined;
    }
    if (!blockColor) {
      blockColor = blockTypeDef.mapColor;
    }

    const svg = Model2DRenderer.renderToSvg(geometryToRender, {
      viewDirection: "iso-front-left",
      outputWidth: thumbnailWidth,
      outputHeight: thumbnailHeight,
      depthShading: true,
      depthShadingIntensity: 0.25,
      perspectiveStrength: 0,
      focalLength: 80,
      fallbackColor: blockColor || (texturePixels ? "#888888" : "#6a6a6a"),
      padding: 2,
      texturePixels: texturePixels,
      textureWidth: textureWidth,
      textureHeight: textureHeight,
      textureSampleResolution: 4,
    });

    return `data:image/svg+xml;base64,${btoa(svg)}`;
  } catch {
    return undefined;
  }
}

// ============================================================================
// CACHED PROJECT HELPERS
// ============================================================================

/**
 * Get or create a cached project from storage data.
 * If the same project is already cached, reuses it.
 * If a different project is cached, disposes it first.
 */
async function getOrCreateCachedProject(
  storageData: StorageTransferData,
  projectName: string,
  requestId: string
): Promise<Project> {
  // Check if we already have this project cached
  if (cachedProject && cachedProjectName === projectName) {
    resetIdleTimeout();
    return cachedProject;
  }

  // Dispose existing project if different
  if (cachedProject) {
    disposeCurrentProject();
  }

  sendProgress(requestId, "Loading project...", 5);

  const { project, projectFolder } = await hydrateProject(storageData, projectName);

  // Cache the project
  cachedProject = project;
  cachedProjectName = projectName;
  cachedProjectFolder = projectFolder;
  resetIdleTimeout();

  return project;
}

/**
 * Serialize relations from project items.
 */
function serializeRelations(items: import("../app/ProjectItem").default[]): {
  childRelations: { [parentPath: string]: ISerializableRelationship[] };
  unfulfilledRelations: { [parentPath: string]: ISerializableUnfulfilledRelationship[] };
} {
  const childRelations: { [parentPath: string]: ISerializableRelationship[] } = {};
  const unfulfilledRelations: { [parentPath: string]: ISerializableUnfulfilledRelationship[] } = {};

  for (const item of items) {
    const itemPath = item.projectPath;
    if (!itemPath) continue;

    if (item.childItems && item.childItems.length > 0) {
      childRelations[itemPath] = item.childItems
        .filter((rel) => rel.childItem?.projectPath)
        .map((rel) => ({
          parentStoragePath: itemPath,
          childStoragePath: rel.childItem!.projectPath!,
        }));
    }

    if (item.unfulfilledRelationships && item.unfulfilledRelationships.length > 0) {
      unfulfilledRelations[itemPath] = item.unfulfilledRelationships.map((rel) => ({
        itemType: rel.itemType,
        path: rel.path,
        isVanillaDependent: rel.isVanillaDependent,
      }));
    }
  }

  return { childRelations, unfulfilledRelations };
}

/**
 * Generate info set and return serializable results.
 * Uses cached project if available.
 */
async function generateInfoSet(request: IGenerateInfoSetRequest): Promise<IGenerateInfoSetResult> {
  // Set contentRoot so Database can load data files
  if (request.contentRoot) {
    CreatorToolsHost.contentWebRoot = request.contentRoot;
  }

  // Get or create cached project
  const project = await getOrCreateCachedProject(request.storageData, "worker-project", request.requestId);

  sendProgress(request.requestId, "Running validation...", 10);

  // Create info set with the specified suite
  const infoSet = new ProjectInfoSet(project, request.suite);
  infoSet.performAggressiveCleanup = true; // Worker context, can be aggressive
  infoSet.constrainResourceConsumption = ResourceConsumptionConstraint.medium;

  // Create progress callback to forward to main thread (10-90% range for validation)
  const onProgress = (message: string, percent?: number) => {
    // Scale percent from validation's 0-100 to our 10-90 range
    const scaledPercent = percent !== undefined ? 10 + percent * 0.8 : undefined;
    sendProgress(request.requestId, message, scaledPercent);
  };

  // Use the existing ProjectInfoSet logic with progress callback
  await infoSet.generateForProject(false, false, onProgress);

  sendProgress(request.requestId, "Serializing results...", 95);

  // Serialize info items
  const serializedItems: ISerializableInfoItem[] = infoSet.items.map((item) => ({
    itemType: item.itemType,
    generatorId: item.generatorId,
    generatorIndex: item.generatorIndex,
    message: item.message,
    projectItemStoragePath: item.projectItem?.projectPath ?? undefined,
    data: item.data,
    content: item.content,
    featureSets: item.featureSets,
  }));

  sendProgress(request.requestId, "Complete", 100);

  // Note: Don't cleanup - project is cached for reuse

  return {
    type: ProjectWorkerMessageType.generateInfoSetResult,
    requestId: request.requestId,
    infoItems: serializedItems,
  };
}

/**
 * Process item relations AND generate info set with STREAMING results.
 *
 * This is the main entry point for background project processing.
 * Results are streamed back as separate messages:
 * 1. relationsComplete - sent immediately after relations are calculated (unblocks UI)
 * 2. validationComplete - sent after validation finishes
 * 3. Thumbnails are enqueued to low-priority queue (streamed via thumbnailBatchComplete)
 *
 * User-visible progress only covers relations (0-30%) and validation (30-100%).
 * Thumbnails are silent background work.
 */
async function processRelationsAndGenerateInfoSetStreaming(
  request: IProcessRelationsAndGenerateInfoSetRequest
): Promise<void> {
  // Set contentRoot so Database can load data files
  if (request.contentRoot) {
    CreatorToolsHost.contentWebRoot = request.contentRoot;
  }

  // Get or create cached project
  const project = await getOrCreateCachedProject(request.storageData, "worker-project", request.requestId);

  const items = project.getItemsCopy();

  // -------------------------------------------------------------------------
  // STEP 1: Calculate relations (0-30% of user-visible progress)
  // -------------------------------------------------------------------------
  try {
    sendProgress(request.requestId, "Calculating item relations...", 10);

    // Create progress callback for relations (10-30% range)
    const onRelationsProgress = (message: string, percent?: number) => {
      // Scale percent from 0-100 to 10-30 range
      const scaledPercent = percent !== undefined ? 10 + percent * 0.2 : undefined;
      sendProgress(request.requestId, message, scaledPercent);
    };

    await ProjectItemRelations.calculate(project, onRelationsProgress);

    // Immediately stream relations result (unblocks main thread waiters)
    const { childRelations, unfulfilledRelations } = serializeRelations(project.getItemsCopy());
    const relationsMsg: IRelationsCompleteResponse = {
      type: ProjectWorkerMessageType.relationsComplete,
      requestId: request.requestId,
      childRelations,
      unfulfilledRelations,
    };
    ctx.postMessage(relationsMsg);

    sendProgress(request.requestId, "Relations calculated", 30);
  } catch (e: any) {
    // Send error for relations phase but continue to validation
    ctx.postMessage({
      type: ProjectWorkerMessageType.error,
      requestId: request.requestId,
      error: "Relations calculation failed: " + (e.message || String(e)),
    });
    // Don't return - try validation anyway
  }

  // -------------------------------------------------------------------------
  // STEP 2: Generate validation info set (30-100% of user-visible progress)
  // -------------------------------------------------------------------------
  try {
    sendProgress(request.requestId, "Running validation...", 35);

    const infoSet = new ProjectInfoSet(project, request.suite);
    infoSet.performAggressiveCleanup = true;
    infoSet.constrainResourceConsumption = ResourceConsumptionConstraint.medium;

    // Create progress callback (30-95% range for validation)
    const onProgress = (message: string, percent?: number) => {
      const scaledPercent = percent !== undefined ? 30 + percent * 0.65 : undefined;
      sendProgress(request.requestId, message, scaledPercent);
    };

    // Skip relations processing since we already did it
    await infoSet.generateForProject(false, true, onProgress);

    // Serialize info items
    const serializedItems: ISerializableInfoItem[] = infoSet.items.map((item) => ({
      itemType: item.itemType,
      generatorId: item.generatorId,
      generatorIndex: item.generatorIndex,
      message: item.message,
      projectItemStoragePath: item.projectItem?.projectPath ?? undefined,
      data: item.data,
      content: item.content,
      featureSets: item.featureSets,
    }));

    // Stream validation result
    const validationMsg: IValidationCompleteResponse = {
      type: ProjectWorkerMessageType.validationComplete,
      requestId: request.requestId,
      infoItems: serializedItems,
    };
    ctx.postMessage(validationMsg);

    sendProgress(request.requestId, "Validation complete", 100);
  } catch (e: any) {
    ctx.postMessage({
      type: ProjectWorkerMessageType.error,
      requestId: request.requestId,
      error: "Validation failed: " + (e.message || String(e)),
    });
  }

  // -------------------------------------------------------------------------
  // STEP 3: Enqueue thumbnail generation (silent, low-priority)
  // -------------------------------------------------------------------------
  // Note: No progress messages for thumbnails - they're silent background work
  enqueueThumbnails(project, request.requestId, items);

  // Note: Don't cleanup project - it's cached for reuse and thumbnail queue needs it
}

/**
 * Compute thumbnail links for items that should show another item's thumbnail.
 * For example, entity behavior/resource files link to their geometry model's thumbnail.
 *
 * The relationship chain is: entityResource -> geometryModel (as parent->child)
 * So geometry models have parentItems pointing to entity resources.
 * We iterate from geometry models and trace UP to find parent entities.
 *
 * @param items All project items (with relations already calculated)
 * @returns Map of itemPath -> linkedItemPath for items that should use another item's thumbnail
 */
function computeThumbnailLinks(items: import("../app/ProjectItem").default[]): { [projectPath: string]: string } {
  const links: { [projectPath: string]: string } = {};

  // Item types that should get thumbnail links from geometry models
  // NOTE: blockTypeBehavior is NOT included here because block thumbnails are now generated
  // directly on each block item (in generateThumbnailsForProject second pass) to ensure
  // each block gets its own thumbnail with its specific textures, even when multiple blocks
  // share the same geometry file.
  const linkableTypes = new Set([
    ProjectItemType.entityTypeBehavior,
    ProjectItemType.entityTypeResource,
    ProjectItemType.itemTypeBehavior,
  ]);

  // Find all geometry models and trace up to their parent entities
  for (const item of items) {
    if (item.itemType !== ProjectItemType.modelGeometryJson) continue;

    const geometryPath = item.projectPath;
    if (!geometryPath) continue;

    // Look at parent items to find entity resources/behaviors
    if (item.parentItems) {
      for (const parentRel of item.parentItems) {
        const parent = parentRel.parentItem;
        const parentPath = parent.projectPath;

        if (parentPath && linkableTypes.has(parent.itemType)) {
          links[parentPath] = geometryPath;

          // Also check grandparents (entityResource's parent might be entityBehavior)
          if (parent.parentItems) {
            for (const grandparentRel of parent.parentItems) {
              const grandparent = grandparentRel.parentItem;
              const grandparentPath = grandparent.projectPath;

              if (grandparentPath && linkableTypes.has(grandparent.itemType)) {
                links[grandparentPath] = geometryPath;
              }
            }
          }
        }
      }
    }
  }

  return links;
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

/**
 * Handle hydrateProject request.
 */
async function handleHydrateProject(request: IHydrateProjectRequest): Promise<void> {
  if (request.contentRoot) {
    CreatorToolsHost.contentWebRoot = request.contentRoot;
  }

  const project = await getOrCreateCachedProject(request.storageData, request.projectName, request.requestId);

  ctx.postMessage({
    type: ProjectWorkerMessageType.hydrateComplete,
    requestId: request.requestId,
    projectName: request.projectName,
    itemCount: project.getItemsCopy().length,
  });
}

/**
 * Handle disposeProject request.
 */
function handleDisposeProject(request: IDisposeProjectRequest): void {
  disposeCurrentProject();

  ctx.postMessage({
    type: ProjectWorkerMessageType.projectDisposed,
    requestId: request.requestId,
  });
}

/**
 * Handle cancelThumbnails request.
 */
function handleCancelThumbnails(request: ICancelThumbnailsRequest): void {
  thumbnailsCancelled = true;
  // The thumbnail queue will detect this and stop after current batch
}

/**
 * Handle incoming messages from main thread.
 */
ctx.onmessage = async (event: MessageEvent<ProjectWorkerRequest>) => {
  const request = event.data;

  try {
    switch (request.type) {
      case ProjectWorkerMessageType.hydrateProject: {
        await handleHydrateProject(request as IHydrateProjectRequest);
        break;
      }

      case ProjectWorkerMessageType.disposeProject: {
        handleDisposeProject(request as IDisposeProjectRequest);
        break;
      }

      case ProjectWorkerMessageType.generateInfoSet: {
        const result = await generateInfoSet(request);
        ctx.postMessage(result);
        break;
      }

      case ProjectWorkerMessageType.processRelationsAndGenerateInfoSet: {
        // This is now streaming - it sends multiple messages and doesn't return a single result
        await processRelationsAndGenerateInfoSetStreaming(request);
        break;
      }

      case ProjectWorkerMessageType.cancelThumbnails: {
        handleCancelThumbnails(request as ICancelThumbnailsRequest);
        break;
      }

      default:
        ctx.postMessage({
          type: ProjectWorkerMessageType.error,
          requestId: (request as any).requestId || "unknown",
          error: "Unknown message type: " + (request as any).type,
        });
    }
  } catch (e: any) {
    ctx.postMessage({
      type: ProjectWorkerMessageType.error,
      requestId: (request as any).requestId || "unknown",
      error: e.message || String(e),
    });
  }
};

// Signal that the worker is ready
ctx.postMessage({ type: "ready" });

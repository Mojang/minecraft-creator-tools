// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Deterministic package-reload interleavings. Main-thread readers use explicit barriers; worker tests
 * execute the real worker manager with a controlled transport, including its result application and cache
 * handoff. The manager is bundled as CJS for these Node tests because its browser entry uses import.meta.
 */

import { strict as assert } from "assert";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { createRequire } from "module";
import { build } from "esbuild";
import JSZip from "jszip";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import { ProjectItemType } from "../app/IProjectItemData";
import ProjectItemRelations from "../app/ProjectItemRelations";
import { AnnotationCategory } from "../core/ContentIndex";
import InfoGeneratorTopicUtilities from "../info/InfoGeneratorTopicUtilities";
import {
  IProjectWorkerManager,
  IStreamingCallbacks,
  ProjectOperationCancelledError,
} from "../app/IProjectWorkerManager";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import { InfoItemType } from "../info/IInfoItemData";
import NodeStorage from "../local/NodeStorage";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import ModelGeometryDefinition from "../minecraft/ModelGeometryDefinition";
import FileBase from "../storage/FileBase";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import ClUtils from "../cli/ClUtils";
import {
  IProcessRelationsAndGenerateInfoSetRequest,
  ProjectWorkerMessageType,
  ProjectWorkerRequest,
  ProjectWorkerResponse,
  StorageTransferData,
  StorageTransferMode,
} from "../workers/IProjectWorkerMessage";
import { createTestDataDir } from "./TestDataDir";
import TestPaths, { ITestEnvironment } from "./TestPaths";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function observe<T>(promise: Promise<T>) {
  return promise.then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason: unknown) => ({ status: "rejected" as const, reason })
  );
}

class ControlledWorker {
  static created = deferred<ControlledWorker>();
  onmessage?: (event: MessageEvent<ProjectWorkerResponse>) => void | Promise<void>;
  onerror?: (event: ErrorEvent) => void;
  messages: ProjectWorkerRequest[] = [];
  private requests: IProcessRelationsAndGenerateInfoSetRequest[] = [];
  private waiters: ((request: IProcessRelationsAndGenerateInfoSetRequest) => void)[] = [];
  private cachedStorage: StorageTransferData | undefined;
  private requestStorage = new Map<string, StorageTransferData>();

  constructor() {
    ControlledWorker.created.resolve(this);
  }

  postMessage(request: ProjectWorkerRequest) {
    this.messages.push(request);
    if (request.type === ProjectWorkerMessageType.disposeProject) {
      this.cachedStorage = undefined;
    } else if (request.type === ProjectWorkerMessageType.processRelationsAndGenerateInfoSet) {
      // The real worker caches its project under a fixed name until explicitly disposed.
      this.cachedStorage ??= request.storageData;
      this.requestStorage.set(request.requestId, this.cachedStorage);
      const waiter = this.waiters.shift();
      if (waiter) waiter(request);
      else this.requests.push(request);
    }
  }

  nextRequest(): Promise<IProcessRelationsAndGenerateInfoSetRequest> {
    const request = this.requests.shift();
    return request ? Promise.resolve(request) : new Promise((resolve) => this.waiters.push(resolve));
  }

  async emit(response: ProjectWorkerResponse) {
    await this.onmessage?.(new MessageEvent("message", { data: response }));
  }

  async finish(request: IProcessRelationsAndGenerateInfoSetRequest) {
    const storage = this.requestStorage.get(request.requestId);
    assert(storage?.mode === StorageTransferMode.serializedStorage);
    const marker = storage.rootFolder.files["marker.txt"].textContent;
    assert(typeof marker === "string");
    await this.emit({
      type: ProjectWorkerMessageType.relationsComplete,
      requestId: request.requestId,
      childRelations: {},
      unfulfilledRelations: {},
    });
    await this.emit({
      type: ProjectWorkerMessageType.validationComplete,
      requestId: request.requestId,
      infoItems: [
        { itemType: InfoItemType.info, generatorId: "PACKMETADATA", generatorIndex: 141, data: marker },
      ],
    });
    await this.emit({
      type: ProjectWorkerMessageType.thumbnailsFinished,
      requestId: request.requestId,
      cancelled: false,
      totalGenerated: 0,
    });
  }

  terminate() {}
}

describe("package work isolation", function () {
  this.timeout(30000);
  let env: ITestEnvironment;
  let root: string;
  let restoreEnvironment: () => void;
  let manager: IProjectWorkerManager;
  const requireForTest = createRequire(path.resolve(TestPaths.appRoot, "package.json"));
  const registry: typeof import("../app/IProjectWorkerManager") = requireForTest(
    path.resolve(TestPaths.appRoot, "src/app/IProjectWorkerManager.ts")
  );

  before(async () => {
    env = await TestPaths.createTestEnvironment({ contentWebRoot: "" });
    const output = path.join(createTestDataDir("package-worker-bundle"), "manager.cjs");
    await build({
      entryPoints: [path.resolve(TestPaths.appRoot, "src/workers/ProjectWorkerManager.ts")],
      outfile: output,
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "node22",
      define: { "import.meta.url": JSON.stringify("file:///controlled-worker/manager.js") },
      plugins: [
        {
          name: "use-test-host",
          setup(builder) {
            builder.onResolve({ filter: /CreatorToolsHost(?:\.[jt]s)?$/ }, () => ({
              path: path.resolve(TestPaths.appRoot, "src/app/CreatorToolsHost.ts"),
              external: true,
            }));
          },
        },
      ],
      logLevel: "silent",
    });
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    const workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");
    Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
    Object.defineProperty(globalThis, "Worker", { value: ControlledWorker, configurable: true });
    try {
      const compiled: { default: { instance: IProjectWorkerManager } } = requireForTest(output);
      manager = compiled.default.instance;
      expect(manager.isSupported, "controlled Worker support").to.equal(true);
    } finally {
      if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
      else Reflect.deleteProperty(globalThis, "window");
      if (workerDescriptor) Object.defineProperty(globalThis, "Worker", workerDescriptor);
      else Reflect.deleteProperty(globalThis, "Worker");
    }
  });

  beforeEach(() => {
    root = createTestDataDir("package-work");
    const { creatorTools } = env;
    const previousFolder = creatorTools.ensureLocalFolder;
    const previousExists = creatorTools.localFileExists;
    const storage = new NodeStorage(root, "");
    creatorTools.ensureLocalFolder = () => storage.rootFolder;
    creatorTools.localFileExists = ClUtils.localFileExists;
    const workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");
    Object.defineProperty(globalThis, "Worker", { value: ControlledWorker, configurable: true });
    ControlledWorker.created = deferred<ControlledWorker>();
    restoreEnvironment = () => {
      creatorTools.ensureLocalFolder = previousFolder;
      creatorTools.localFileExists = previousExists;
      if (workerDescriptor) Object.defineProperty(globalThis, "Worker", workerDescriptor);
      else Reflect.deleteProperty(globalThis, "Worker");
    };
  });

  afterEach(() => {
    manager.terminate();
    restoreEnvironment();
  });

  async function writePackage(filePath: string, marker: string, indexed = false) {
    const zip = new JSZip()
      .file("marker.txt", marker)
      .file(
        "behavior_packs/pack/manifest.json",
        JSON.stringify({
          format_version: 2,
          header: {
            name: marker,
            description: marker,
            uuid: "0b0639a4-3bca-4ca5-b5a3-a8f89740432d",
            version: [1, 0, 0],
            min_engine_version: [1, 21, 0],
          },
          modules: [{ type: "data", uuid: "3dcd7dd0-f769-47ee-9d24-f43f3e467233", version: [1, 0, 0] }],
        })
      );
    if (indexed) {
      zip.file(
        "behavior_packs/pack/entities/example.json",
        JSON.stringify({
          format_version: "1.21.0",
          "minecraft:entity": {
            description: { identifier: `test:${marker}`, is_spawnable: true, is_summonable: true },
            components: {},
          },
        })
      );
      zip.file(
        "resource_packs/pack/manifest.json",
        JSON.stringify({
          format_version: 2,
          header: {
            name: marker,
            description: marker,
            uuid: "6a6fd5c0-6be8-40a6-a7b5-148d738b88d5",
            version: [1, 0, 0],
            min_engine_version: [1, 21, 0],
          },
          modules: [{ type: "resources", uuid: "33305dfe-8c7e-457b-a042-55f72a4ea463", version: [1, 0, 0] }],
        })
      );
      zip.file(
        "resource_packs/pack/models/entity/example.geo.json",
        JSON.stringify({
          format_version: "1.12.0",
          "minecraft:geometry": [
            {
              description: {
                identifier: `geometry.test.${marker}`,
                texture_width: 16,
                texture_height: 16,
              },
              bones: [{ name: "root", pivot: [0, 0, 0] }],
            },
          ],
        })
      );
    }
    fs.writeFileSync(filePath, await zip.generateAsync({ type: "nodebuffer" }));
  }

  async function createProject(fileName = "input.mcaddon", marker = "original", indexed = false) {
    const project = new Project(env.creatorTools, "shared name", null);
    project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
    await project.ensureInflated();
    project.localFilePath = path.join(root, fileName);
    await writePackage(project.localFilePath, marker, indexed);
    await project.inferProjectItemsFromFiles();
    return project;
  }

  it("rejects forced reload while a main-thread validation reader is active, then permits retry", async () => {
    const project = await createProject();
    const originalRoot = project.projectFolder!;
    const originalItems = project.getItemsCopy();
    const entered = deferred<void>();
    const release = deferred<void>();
    const info = project.indevInfoSet;
    info.generateForProject = async () => {
      entered.resolve();
      await release.promise;
      expect(project.projectFolder).to.equal(originalRoot);
      await originalRoot.ensureFile("marker.txt").loadContent();
    };
    const validation = observe(project.ensureIndevInfoSetGenerated());
    await entered.promise;
    await writePackage(project.localFilePath!, "replacement");
    try {
      await assert.rejects(project.ensureProjectFolder(true), /read|busy|retry/i);
      expect(project.projectFolder).to.equal(originalRoot);
      expect(project.getItemsCopy()).to.deep.equal(originalItems);
      expect(project.indevInfoSet).to.equal(info);
    } finally {
      release.resolve();
      await validation;
    }
    expect((await validation).status).to.equal("fulfilled");
    const replacement = await project.ensureProjectFolder(true);
    expect(replacement).not.to.equal(originalRoot);
  });

  it("rejects a reentrant forced reload during relation reads without deadlocking", async () => {
    const project = await createProject();
    const originalRoot = project.projectFolder;
    const calculate = ProjectItemRelations.calculateForItems;
    let refusal: unknown;
    ProjectItemRelations.calculateForItems = async () => {
      await project.inferProjectItemsFromFiles();
      await project.ensureProjectFolder();
      try {
        await project.ensureProjectFolder(true);
      } catch (error) {
        refusal = error;
      }
      expect(project.projectFolder).to.equal(originalRoot);
    };
    try {
      await project.processRelations();
      expect(refusal).to.be.instanceOf(Error);
      expect(project.isRelationsProcessed).to.equal(true);
    } finally {
      ProjectItemRelations.calculateForItems = calculate;
    }
    await project.ensureProjectFolder(true);
    expect(project.isRelationsProcessed).to.equal(false);
  });

  it("does not apply stale worker relations or thumbnails to replacement items", async () => {
    const project = await createProject();
    const originalRoot = project.projectFolder;
    const callbacks: IStreamingCallbacks & { isCurrent: () => boolean } = {
      isCurrent: () => project.projectFolder === originalRoot,
      onRelationsComplete: () => {},
    };
    const operation = observe(
      manager.processRelationsAndGenerateInfoSetInWorker(project, ProjectInfoSuite.defaultInDevelopment, callbacks)
    );
    const worker = await Promise.race([
      ControlledWorker.created.promise,
      operation.then((outcome) => {
        throw new Error(`Worker operation completed before transport creation: ${JSON.stringify(outcome)}`);
      }),
    ]);
    const request = await worker.nextRequest();
    await writePackage(project.localFilePath!, "replacement");
    await project.ensureProjectFolder(true);
    await project.inferProjectItemsFromFiles();
    const item = project.getItemsCopy().find((candidate) => candidate.primaryFile?.name === "manifest.json");
    assert(item?.projectPath);
    try {
      await worker.emit({
        type: ProjectWorkerMessageType.thumbnailBatchComplete,
        requestId: request.requestId,
        thumbnails: { [item.projectPath]: "data:image/png;base64,obsolete" },
        completed: 1,
        total: 1,
      });
      await worker.emit({
        type: ProjectWorkerMessageType.relationsComplete,
        requestId: request.requestId,
        childRelations: {},
        unfulfilledRelations: {
          [item.projectPath]: [{ itemType: item.itemType, path: "obsolete", isVanillaDependent: false }],
        },
      });
      expect(item.cachedThumbnail).to.equal(undefined);
      expect(item.unfulfilledRelationships ?? []).to.be.empty;
    } finally {
      await worker.finish(request);
      await operation;
    }
    expect((await operation).status).to.equal("rejected");
  });

  it("refreshes a primed worker cache after replacing a same-name package", async () => {
    const project = await createProject();
    const oldRoot = project.projectFolder;
    let originalMarker: unknown;
    const originalCallbacks: IStreamingCallbacks & { isCurrent: () => boolean } = {
      isCurrent: () => project.projectFolder === oldRoot,
      onValidationComplete: (items) => {
        originalMarker = items[0]?.data;
      },
    };
    const first = manager.processRelationsAndGenerateInfoSetInWorker(
      project,
      ProjectInfoSuite.defaultInDevelopment,
      originalCallbacks
    );
    const worker = await Promise.race([
      ControlledWorker.created.promise,
      first.then((result) => {
        throw new Error(`Worker operation completed before transport creation: ${JSON.stringify(result)}`);
      }),
    ]);
    const firstRequest = await Promise.race([
      worker.nextRequest(),
      first.then(() => {
        throw new Error("Worker operation completed before sending a request");
      }),
    ]);
    await worker.finish(firstRequest);
    await first;
    expect(originalMarker).to.equal("original");
    await writePackage(project.localFilePath!, "replacement");
    await project.ensureProjectFolder(true);
    await project.inferProjectItemsFromFiles();
    const newRoot = project.projectFolder;
    let replacementMarker: unknown;
    const replacementCallbacks: IStreamingCallbacks & { isCurrent: () => boolean } = {
      isCurrent: () => project.projectFolder === newRoot,
      onValidationComplete: (items) => {
        replacementMarker = items[0]?.data;
      },
    };
    const second = manager.processRelationsAndGenerateInfoSetInWorker(
      project,
      ProjectInfoSuite.defaultInDevelopment,
      replacementCallbacks
    );
    await worker.finish(await worker.nextRequest());
    await second;
    expect(replacementMarker).to.equal("replacement");
    expect(worker.messages.some((message) => message.type === ProjectWorkerMessageType.disposeProject)).to.equal(true);
  });

  it("refuses reload during actual worker serialization without changing or disposing the reader's input", async () => {
    const project = await createProject();
    const originalRoot = project.projectFolder!;
    const markerFile = originalRoot.ensureFile("marker.txt");
    const load = markerFile.loadContent.bind(markerFile);
    const entered = deferred<void>();
    const release = deferred<void>();
    markerFile.unload();
    markerFile.modified = null;
    markerFile.loadContent = async (force) => {
      entered.resolve();
      await release.promise;
      return load(force);
    };
    const operation = observe(
      manager.processRelationsAndGenerateInfoSetInWorker(project, ProjectInfoSuite.defaultInDevelopment)
    );
    const worker = await ControlledWorker.created.promise;
    try {
      await entered.promise;
      await writePackage(project.localFilePath!, "replacement");
      await assert.rejects(project.ensureProjectFolder(true), /being read|retry/i);
      expect(project.projectFolder).to.equal(originalRoot);
      release.resolve();
      const request = await worker.nextRequest();
      await worker.finish(request);
      expect((await operation).status).to.equal("fulfilled");
      expect(markerFile.content).to.equal("original");
    } finally {
      release.resolve();
      markerFile.loadContent = load;
      manager.terminate();
      await operation;
    }
    expect(await project.ensureProjectFolder(true)).not.to.equal(originalRoot);
  });

  it("refuses new readers while a package reload is suspended, then admits them after completion", async () => {
    const project = await createProject();
    const file = project.projectCabinetFile;
    assert(file);
    const load = file.loadContent.bind(file);
    const entered = deferred<void>();
    const release = deferred<void>();
    file.loadContent = async (force) => {
      entered.resolve();
      await release.promise;
      return load(force);
    };
    await writePackage(project.localFilePath!, "replacement");
    const reload = observe(project.ensureProjectFolder(true));
    try {
      await entered.promise;
      await assert.rejects(project.ensureProjectFolder(), /reload.*progress|retry/i);
      await assert.rejects(project.inferProjectItemsFromFiles(), /reload.*progress|retry/i);
      await assert.rejects(project.ensureInflated(), /reload.*progress|retry/i);
      await assert.rejects(project.processRelations(), /reload.*progress|retry/i);
      await assert.rejects(project.ensureIndevInfoSetGenerated(), /reload.*progress|retry/i);
    } finally {
      release.resolve();
      file.loadContent = load;
      await reload;
    }
    expect((await reload).status).to.equal("fulfilled");
    await project.inferProjectItemsFromFiles();
    const marker = project.projectFolder!.ensureFile("marker.txt");
    await marker.loadContent();
    expect(marker.content).to.equal("replacement");
  });

  it("does not cancel or reuse a second project's active worker work when the first project reloads", async () => {
    const firstProject = await createProject("first.mcaddon", "first");
    const secondProject = await createProject("second.mcaddon", "second");
    const secondRoot = secondProject.projectFolder;
    let secondMarker: unknown;
    const secondCallbacks: IStreamingCallbacks & { isCurrent: () => boolean } = {
      isCurrent: () => secondProject.projectFolder === secondRoot,
      onValidationComplete: (items) => {
        secondMarker = items[0]?.data;
      },
    };
    const active = observe(
      manager.processRelationsAndGenerateInfoSetInWorker(
        secondProject,
        ProjectInfoSuite.defaultInDevelopment,
        secondCallbacks
      )
    );
    const worker = await ControlledWorker.created.promise;
    const secondRequest = await worker.nextRequest();
    await writePackage(firstProject.localFilePath!, "first-replacement");
    await firstProject.ensureProjectFolder(true);
    await firstProject.inferProjectItemsFromFiles();
    let firstMarker: unknown;
    const firstCallbacks: IStreamingCallbacks = {
      onValidationComplete: (items) => {
        firstMarker = items[0]?.data;
      },
    };
    const queued = observe(
      manager.processRelationsAndGenerateInfoSetInWorker(
        firstProject,
        ProjectInfoSuite.defaultInDevelopment,
        firstCallbacks
      )
    );
    try {
      await worker.finish(secondRequest);
      expect((await active).status).to.equal("fulfilled");
      expect(secondMarker).to.equal("second");
      await worker.finish(await worker.nextRequest());
      expect((await queued).status).to.equal("fulfilled");
      expect(firstMarker).to.equal("first-replacement");
      expect(worker.messages.some((message) => message.type === ProjectWorkerMessageType.cancelThumbnails)).to.equal(
        false
      );
    } finally {
      manager.terminate();
      await active;
      await queued;
    }
  });

  it("holds worker cache ownership until an awaited validation callback and thumbnails both finish", async () => {
    const firstProject = await createProject("first.mcaddon", "first");
    const secondProject = await createProject("second.mcaddon", "second");
    const callbackEntered = deferred<void>();
    const releaseCallback = deferred<void>();
    const first = observe(
      manager.processRelationsAndGenerateInfoSetInWorker(
        firstProject,
        ProjectInfoSuite.defaultInDevelopment,
        {
          onValidationComplete: async () => {
            callbackEntered.resolve();
            await releaseCallback.promise;
          },
        }
      )
    );
    const worker = await ControlledWorker.created.promise;
    const firstRequest = await worker.nextRequest();
    const validating = worker.emit({
      type: ProjectWorkerMessageType.validationComplete,
      requestId: firstRequest.requestId,
      infoItems: [],
    });
    await callbackEntered.promise;
    await worker.emit({
      type: ProjectWorkerMessageType.thumbnailsFinished,
      requestId: firstRequest.requestId,
      cancelled: false,
      totalGenerated: 0,
    });
    const second = observe(
      manager.processRelationsAndGenerateInfoSetInWorker(secondProject, ProjectInfoSuite.defaultInDevelopment)
    );
    try {
      expect(worker.messages.filter((message) => message.type === ProjectWorkerMessageType.disposeProject)).to.be
        .empty;
      releaseCallback.resolve();
      await validating;
      expect((await first).status).to.equal("fulfilled");
      await worker.finish(await worker.nextRequest());
      expect((await second).status).to.equal("fulfilled");
    } finally {
      releaseCallback.resolve();
      await validating;
      manager.terminate();
      await first;
      await second;
    }
  });

  it("retains a failed streaming turn until the worker's continuation finishes, without applying later results", async () => {
    const firstProject = await createProject("first.mcaddon", "first");
    const secondProject = await createProject("second.mcaddon", "second");
    const first = observe(
      manager.processRelationsAndGenerateInfoSetInWorker(firstProject, ProjectInfoSuite.defaultInDevelopment)
    );
    const worker = await ControlledWorker.created.promise;
    const firstRequest = await worker.nextRequest();
    await worker.emit({
      type: ProjectWorkerMessageType.error,
      requestId: firstRequest.requestId,
      error: "controlled relation failure",
      willContinue: true,
    });
    await first;
    const second = observe(
      manager.processRelationsAndGenerateInfoSetInWorker(secondProject, ProjectInfoSuite.defaultInDevelopment)
    );
    const item = firstProject.items.find((candidate) => candidate.primaryFile?.name === "manifest.json");
    assert(item?.projectPath);
    try {
      expect(worker.messages.filter((message) => message.type === ProjectWorkerMessageType.disposeProject)).to.be
        .empty;
      await worker.emit({
        type: ProjectWorkerMessageType.thumbnailBatchComplete,
        requestId: firstRequest.requestId,
        thumbnails: { [item.projectPath]: "data:image/png;base64,failed-turn" },
        completed: 1,
        total: 1,
      });
      expect(item.cachedThumbnail).to.equal(undefined);
      await worker.finish(firstRequest);
      await worker.finish(await worker.nextRequest());
      expect((await second).status).to.equal("fulfilled");
    } finally {
      manager.terminate();
      await first;
      await second;
    }
  });

  it("keeps a replacement validation single-flight when the obsolete operation settles", async () => {
    const project = await createProject();
    const calls: { callbacks: IStreamingCallbacks; resolve: () => void }[] = [];
    const started = [deferred<void>(), deferred<void>()];
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    const registryDescriptor = Object.getOwnPropertyDescriptor(registry, "getProjectWorkerManager");
    assert(registryDescriptor);
    const fake: IProjectWorkerManager = {
      isSupported: true,
      generateInfoSetInWorker: async () => undefined,
      processRelationsAndGenerateInfoSetInWorker: async (_project, _suite, callbacks) => {
        assert(callbacks);
        const completion = deferred<void>();
        calls.push({ callbacks, resolve: () => completion.resolve() });
        started[calls.length - 1]?.resolve();
        await completion.promise;
        return { relationsApplied: true };
      },
      cancelPendingThumbnails() {},
      disposeWorkerProject() {},
      terminate() {},
    };
    Object.defineProperty(registry, "getProjectWorkerManager", { value: () => fake, configurable: true });
    Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
    const oldResult = observe(project.ensureIndevInfoSetGenerated());
    let replacementResult: ReturnType<typeof observe<typeof project.indevInfoSet>> | undefined;
    let duplicateResult: ReturnType<typeof observe<typeof project.indevInfoSet>> | undefined;
    try {
      await started[0].promise;
      await writePackage(project.localFilePath!, "replacement");
      await project.ensureProjectFolder(true);
      await project.inferProjectItemsFromFiles();
      replacementResult = observe(project.ensureIndevInfoSetGenerated());
      await started[1].promise;
      calls[0].callbacks.onRelationsComplete?.({ childRelations: {}, unfulfilledRelations: {} });
      await calls[0].callbacks.onValidationComplete?.([]);
      calls[0].resolve();
      expect((await oldResult).status).to.equal("rejected");
      expect(project.isRelationsProcessed).to.equal(false);
      expect(project.isInfoSetGenerationInProgress).to.equal(true);
      duplicateResult = observe(project.ensureIndevInfoSetGenerated());
    } finally {
      for (const call of calls) {
        call.callbacks.onRelationsComplete?.({ childRelations: {}, unfulfilledRelations: {} });
        await call.callbacks.onValidationComplete?.([]);
        call.resolve();
      }
      await oldResult;
      await replacementResult;
      await duplicateResult;
      Object.defineProperty(registry, "getProjectWorkerManager", registryDescriptor);
      if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
      else Reflect.deleteProperty(globalThis, "window");
    }
    expect((await replacementResult)?.status).to.equal("fulfilled");
    expect((await duplicateResult)?.status).to.equal("fulfilled");
    expect(calls).to.have.lengthOf(2);
    expect(project.isInfoSetGenerationInProgress).to.equal(false);
  });

  it("ignores a validation callback invalidated while topic forms are loading", async () => {
    const project = await createProject();
    const callbacksReady = deferred<IStreamingCallbacks>();
    const complete = deferred<void>();
    const formsEntered = deferred<void>();
    const releaseForms = deferred<void>();
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    const registryDescriptor = Object.getOwnPropertyDescriptor(registry, "getProjectWorkerManager");
    assert(registryDescriptor);
    const preload = InfoGeneratorTopicUtilities.preloadAllForms;
    InfoGeneratorTopicUtilities.preloadAllForms = async () => {
      formsEntered.resolve();
      await releaseForms.promise;
    };
    const fake: IProjectWorkerManager = {
      isSupported: true,
      generateInfoSetInWorker: async () => undefined,
      processRelationsAndGenerateInfoSetInWorker: async (_project, _suite, callbacks) => {
        assert(callbacks);
        callbacksReady.resolve(callbacks);
        await complete.promise;
        return { relationsApplied: true };
      },
      cancelPendingThumbnails() {},
      disposeWorkerProject() {},
      terminate() {},
    };
    Object.defineProperty(registry, "getProjectWorkerManager", { value: () => fake, configurable: true });
    Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
    const oldInfo = project.indevInfoSet;
    const operation = observe(project.ensureIndevInfoSetGenerated());
    const callbacks = await callbacksReady.promise;
    callbacks.onRelationsComplete?.({ childRelations: {}, unfulfilledRelations: {} });
    const validation = callbacks.onValidationComplete?.([
      {
        itemType: InfoItemType.info,
        generatorId: "PACKMETADATA",
        generatorIndex: 141,
        message: "obsolete finding",
        projectItemStoragePath: "/behavior_packs/pack/manifest.json",
      },
    ]);
    try {
      await formsEntered.promise;
      await writePackage(project.localFilePath!, "replacement");
      await project.ensureProjectFolder(true);
      await project.inferProjectItemsFromFiles();
      releaseForms.resolve();
      await validation;
      complete.resolve();
      expect((await operation).status).to.equal("rejected");
      expect(oldInfo.items).to.be.empty;
      expect(project.indevInfoSet.items).to.be.empty;
      expect(project.isRelationsProcessed).to.equal(false);
    } finally {
      releaseForms.resolve();
      await validation;
      complete.resolve();
      await operation;
      InfoGeneratorTopicUtilities.preloadAllForms = preload;
      Object.defineProperty(registry, "getProjectWorkerManager", registryDescriptor);
      if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  for (const itemType of [ProjectItemType.modelGeometryJson, ProjectItemType.entityTypeBehavior]) {
    it(`protects the actual annotation definition read for item type ${itemType}`, async () => {
      const project = await createProject("indexed.mcaddon", "original", true);
      const originalRoot = project.projectFolder!;
      const originalStorage = originalRoot.storage;
      const originalItems = project.getItemsCopy();
      const item = project.getItemsByType(itemType)[0];
      const file = item?.primaryFile;
      assert(file instanceof FileBase);
      const entered = deferred<void>();
      const release = deferred<void>();
      const callbacksReady = deferred<IStreamingCallbacks>();
      const complete = deferred<void>();
      const ensureGeometry = ModelGeometryDefinition.ensureOnFile;
      const ensureEntity = EntityTypeDefinition.ensureOnFile;
      const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
      const registryDescriptor = Object.getOwnPropertyDescriptor(registry, "getProjectWorkerManager");
      assert(registryDescriptor);
      const gateRead = async <T>(candidate: IFile, read: () => Promise<T>): Promise<T> => {
        if (candidate === file) {
          entered.resolve();
          await release.promise;
          expect(file.isDisposed, "the annotation must never read disposed package storage").to.equal(false);
        }
        return read();
      };
      ModelGeometryDefinition.ensureOnFile = (...args) => gateRead(args[0], () => ensureGeometry(...args));
      EntityTypeDefinition.ensureOnFile = (...args) => gateRead(args[0], () => ensureEntity(...args));
      const fake: IProjectWorkerManager = {
        isSupported: true,
        generateInfoSetInWorker: async () => undefined,
        processRelationsAndGenerateInfoSetInWorker: async (_project, _suite, callbacks) => {
          assert(callbacks);
          callbacksReady.resolve(callbacks);
          await complete.promise;
          return { relationsApplied: true };
        },
        cancelPendingThumbnails() {},
        disposeWorkerProject() {},
        terminate() {},
      };
      Object.defineProperty(registry, "getProjectWorkerManager", { value: () => fake, configurable: true });
      Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
      const info = project.indevInfoSet;
      const operation = observe(project.ensureIndevInfoSetGenerated());
      const callbacks = await callbacksReady.promise;
      callbacks.onRelationsComplete?.({ childRelations: {}, unfulfilledRelations: {} });
      const annotations = observe(Promise.resolve(callbacks.onValidationComplete?.([])));
      let coalesced: ReturnType<typeof observe<typeof project.indevInfoSet>> | undefined;
      try {
        await entered.promise;
        expect(info.completedGeneration).to.equal(true);
        expect(callbacks.isCurrent?.()).to.equal(true);
        coalesced = observe(
          project.ensureIndevInfoSetGenerated().then((result) => {
            expect(result.contentIndex?.getAll([AnnotationCategory.geometrySource])).to.have.property(
              "geometry.test.original"
            );
            expect(result.contentIndex?.getAll([AnnotationCategory.entityTypeSource])).to.have.property(
              "test:original"
            );
            return result;
          })
        );
        await writePackage(project.localFilePath!, "replacement", true);
        await assert.rejects(project.ensureProjectFolder(true), /being read|retry/i);
        expect(callbacks.isCurrent?.(), "busy refusal must not change the generation").to.equal(true);
        expect(project.projectFolder).to.equal(originalRoot);
        expect(project.projectFolder?.storage).to.equal(originalStorage);
        const currentItems = project.getItemsCopy();
        expect(currentItems).to.have.lengthOf(originalItems.length);
        originalItems.forEach((originalItem, index) => expect(currentItems[index]).to.equal(originalItem));
        expect(project.indevInfoSet).to.equal(info);
        expect(item.primaryFile).to.equal(file);
        expect(file.isDisposed).to.equal(false);
        release.resolve();
        expect((await annotations).status).to.equal("fulfilled");
        complete.resolve();
        expect((await operation).status).to.equal("fulfilled");
        expect((await coalesced).status).to.equal("fulfilled");
        expect(info.contentIndex?.getAll([AnnotationCategory.geometrySource])).to.have.property(
          "geometry.test.original"
        );
        expect(info.contentIndex?.getAll([AnnotationCategory.entityTypeSource])).to.have.property("test:original");
      } finally {
        release.resolve();
        await annotations;
        complete.resolve();
        await operation;
        await coalesced;
        ModelGeometryDefinition.ensureOnFile = ensureGeometry;
        EntityTypeDefinition.ensureOnFile = ensureEntity;
        Object.defineProperty(registry, "getProjectWorkerManager", registryDescriptor);
        if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
        else Reflect.deleteProperty(globalThis, "window");
      }
      expect(await project.ensureProjectFolder(true)).not.to.equal(originalRoot);
      expect(file.isDisposed).to.equal(true);
    });
  }

  it("cancels every coalesced caller when operation completion starts a package reload", async () => {
    const project = await createProject();
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    const registryDescriptor = Object.getOwnPropertyDescriptor(registry, "getProjectWorkerManager");
    assert(registryDescriptor);
    Object.defineProperty(registry, "getProjectWorkerManager", { value: () => manager, configurable: true });
    Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
    const first = observe(project.ensureIndevInfoSetGenerated());
    const worker = await ControlledWorker.created.promise;
    const request = await worker.nextRequest();
    const second = observe(project.ensureIndevInfoSetGenerated());
    const active = env.creatorTools.activeOperations.find(
      (operation) => operation.message === `Validating '${project.simplifiedName}' (0%)`
    );
    assert(active?.operationId !== undefined);
    const operationId = active.operationId;
    let reload: ReturnType<typeof observe<IFolder>> | undefined;
    let late: ReturnType<typeof observe<typeof project.indevInfoSet>> | undefined;
    const reloadOnComplete = (_creator: ITestEnvironment["creatorTools"], completedId: number) => {
      if (completedId === operationId && !reload) {
        expect(project.indevInfoSet.completedGeneration).to.equal(true);
        late = observe(project.ensureIndevInfoSetGenerated());
        reload = observe(project.ensureProjectFolder(true));
      }
    };
    env.creatorTools.onOperationCompleted.subscribe(reloadOnComplete);
    try {
      await writePackage(project.localFilePath!, "replacement");
      await worker.finish(request);
      const [firstResult, secondResult] = await Promise.all([first, second]);
      expect(reload, "the real completion event must request reload").not.to.equal(undefined);
      expect((await reload)?.status).to.equal("fulfilled");
      assert(late, "the real completion event must create a late waiter");
      const lateResult = await late;
      assert(firstResult.status === "rejected");
      assert(secondResult.status === "rejected", "coalesced callers must not fulfill obsolete validation");
      assert(lateResult.status === "rejected", "late callers must not bypass pending shared completion");
      expect(firstResult.reason).to.be.instanceOf(ProjectOperationCancelledError);
      expect(secondResult.reason).to.equal(firstResult.reason);
      expect(lateResult.reason).to.equal(firstResult.reason);
    } finally {
      env.creatorTools.onOperationCompleted.unsubscribe(reloadOnComplete);
      await first;
      await second;
      await late;
      await reload;
      Object.defineProperty(registry, "getProjectWorkerManager", registryDescriptor);
      if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });
});

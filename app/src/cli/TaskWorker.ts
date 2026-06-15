import ITask from "./ITask";
import IProjectStartInfo from "./IProjectStartInfo";
import Log from "../core/Log";
import ClUtils, { OutputType, TaskType } from "./ClUtils";
import CreatorTools from "../app/CreatorTools";
import NodeFile from "../local/NodeFile";
import StorageUtilities from "../storage/StorageUtilities";
import NodeStorage from "../local/NodeStorage";
import IProjectInfoData, { ProjectInfoSuite } from "../info/IProjectInfoData";
import Project from "../app/Project";
import IProjectMetaState from "../info/IProjectMetaState";
import { parentPort, isMainThread } from "worker_threads";
import CreatorToolsHost, { HostType } from "../app/CreatorToolsHost";
import ProjectInfoSet, { ResourceConsumptionConstraint } from "../info/ProjectInfoSet";
import { InfoItemType } from "../info/IInfoItemData";
import LocalEnvironment from "../local/LocalEnvironment";
import ProjectUtilities from "../app/ProjectUtilities";
import ZipStorage from "../storage/ZipStorage";
import ImageCodecNode from "../local/ImageCodecNode";
import ProfilerWrapper from "./ProfilerWrapper";
import { ProjectItemType } from "../app/IProjectItemData";

let creatorTools: CreatorTools | undefined;
let localEnv: LocalEnvironment | undefined;
let outputStorage: NodeStorage | undefined;
let outputStoragePath: string | undefined;

export async function executeTask(task: ITask) {
  if (!task.project) {
    Log.error("Could not find an associated project for the associated task.");
    return undefined;
  }

  if (localEnv === undefined) {
    localEnv = new LocalEnvironment(true);
  }

  localEnv.displayInfo = task.displayInfo;
  localEnv.displayVerbose = task.displayVerbose;

  if (creatorTools === undefined) {
    CreatorToolsHost.hostType = HostType.toolsNodejs;

    // Set up Node.js-specific image codec functions
    CreatorToolsHost.decodePng = ImageCodecNode.decodePng;
    CreatorToolsHost.encodeToPng = ImageCodecNode.encodeToPng;

    creatorTools = ClUtils.getCreatorTools(localEnv);

    if (creatorTools) {
      creatorTools.onStatusAdded.subscribe(ClUtils.handleStatusAdded);
    }
  }

  if (!localEnv || !creatorTools) {
    Log.error("Could not instantiate a local environment for the associated task.");
    return undefined;
  }

  if (!task.outputFolder) {
    outputStorage = undefined;
  } else if (task.outputFolder !== outputStoragePath) {
    outputStoragePath = task.outputFolder;
    outputStorage = new NodeStorage(task.outputFolder, "");
  }

  try {
    switch (task.task) {
      case TaskType.validate:
        return validate(
          creatorTools,
          task.project,
          task.arguments["suite"] as string | undefined,
          task.arguments["exclusionList"] as string | undefined,
          task.arguments["outputMci"] === true,
          task.arguments["outputType"] as number | undefined,
          task.displayInfo,
          task.force
        );
    }
  } catch (e: any) {
    return e.toString();
  }

  return undefined;
}

if (!isMainThread) {
  if (parentPort) {
    // Native Node.js worker_threads
    parentPort.on("message", async (task: ITask) => {
      try {
        const result = await runTaskWithOptionalProfile(task);
        parentPort!.postMessage(result);
      } catch (error: any) {
        parentPort!.postMessage(error.toString());
      }
    });
  }
}

/**
 * Wrap `executeTask` in V8 inspector profiling when the incoming task
 * requests it. All profile output lands in `<cwd>/debugoutput/`.
 *
 * The wrapping happens here (inside the worker) intentionally — validation
 * runs on a worker_thread, so a profile taken on the main thread would
 * miss the actual work.
 */
async function runTaskWithOptionalProfile(task: ITask) {
  const mode = task.profileMode;
  if (!mode) {
    return await executeTask(task);
  }

  const profileName =
    task.profileName ||
    (task.project?.ctorProjectName
      ? task.project.ctorProjectName.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 60)
      : "task");
  const traceBase = `worker-${TaskType[task.task] ?? task.task}-${profileName}`;

  let result: unknown;
  if (mode === "cpu") {
    await ProfilerWrapper.generateCpuTrace(traceBase, async () => {
      result = await executeTask(task);
    });
  } else if (mode === "memory") {
    await ProfilerWrapper.generateMemoryProfile(traceBase, async () => {
      result = await executeTask(task);
    });
  } else if (mode === "all") {
    // Run the work once under the heap sampler (which also collects mem stats),
    // then write a final heap snapshot for retention analysis. We can't run two
    // inspector samplers concurrently reliably, so we don't also start a CPU
    // trace here — for combined CPU+memory analysis use a second `cpu` run.
    await ProfilerWrapper.generateMemoryProfile(traceBase, async () => {
      result = await executeTask(task);
    });
    try {
      ProfilerWrapper.generateHeapSnapshot(traceBase + "-final");
    } catch (e) {
      console.warn("Failed to write final heap snapshot:", e);
    }
  } else {
    result = await executeTask(task);
  }

  return result;
}

async function validate(
  creatorTools: CreatorTools,
  projectStart: IProjectStartInfo,
  suite?: string,
  exclusionList?: string,
  outputMci?: boolean,
  outputType?: OutputType,
  displayInfo?: boolean,
  force?: boolean
) {
  const project = ClUtils.createProject(creatorTools, projectStart);

  project.readOnlySafety = true;

  let jsonFile: NodeFile | undefined;
  let jsonFileExists = false;

  if (outputStorage && outputType !== OutputType.noReports) {
    jsonFile = outputStorage.rootFolder.ensureFile(
      StorageUtilities.ensureFileNameIsSafe(StorageUtilities.getBaseFromName(project.containerName)) + ".mcr.json"
    );

    jsonFileExists = await jsonFile.exists();

    if (jsonFileExists && !force && !displayInfo) {
      if (!jsonFile.isContentLoaded) {
        await jsonFile.loadContent(false);
      }

      let projectInfoData = StorageUtilities.getJsonObject(jsonFile) as IProjectInfoData | undefined;

      if (projectInfoData === undefined) {
        jsonFileExists = false;
      } else {
        let metaState = {
          projectContainerName: project.containerName,
          projectPath: project.projectFolder?.storageRelativePath,
          projectName: project.name,
          projectTitle: project.title,
          infoSetData: projectInfoData,
        };

        project.dispose();

        return [metaState];
      }
    }
  }

  if (!jsonFileExists || force || displayInfo || outputType === OutputType.noReports) {
    return await validateAndDisposeProject(
      project,
      outputStorage,
      jsonFile,
      suite,
      exclusionList,
      outputMci,
      outputType
    );
  } else {
    Log.message("'" + project.name + "' has already been validated; skipping. Use --force to re-validate.");
  }

  return undefined;
}

async function validateAndDisposeProject(
  project: Project,
  outputStorage: NodeStorage | undefined,
  mcrJsonFile: NodeFile | undefined,
  suite?: string,
  exclusionList?: string,
  outputMci?: boolean,
  outputType?: OutputType
): Promise<IProjectMetaState[]> {
  Log.verbose("Validating '" + project.name + "'" + (suite ? " with suite '" + suite + "'" : "") + ".");

  await project.inferProjectItemsFromFiles();

  let pis: ProjectInfoSet | undefined;

  let suiteInst: ProjectInfoSuite | undefined;

  if (!suite && !exclusionList) {
    pis = project.indevInfoSet;
    // CLI context: enable aggressive cleanup for memory efficiency
    pis.performAggressiveCleanup = true;
    pis.constrainResourceConsumption = ResourceConsumptionConstraint.medium;
  } else {
    suiteInst = ProjectInfoSet.getSuiteFromString(suite ? suite : "default");
    // CLI context: enable aggressive cleanup for memory efficiency
    pis = new ProjectInfoSet(
      project,
      suiteInst,
      exclusionList ? [exclusionList] : undefined,
      undefined,
      undefined,
      undefined,
      true
    );
  }

  await pis.generateForProject();

  const pisData = pis.getDataObject();

  const resultStates: IProjectMetaState[] = [];

  const projectSet = {
    projectContainerName: project.containerName,
    projectPath: project.projectFolder?.storageRelativePath,
    projectName: project.name,
    projectTitle: project.title,
    infoSetData: pisData,
    suite: suiteInst,
  };

  resultStates.push(projectSet);

  pis.disconnectFromProject();

  if (localEnv?.displayInfo || localEnv?.displayVerbose) {
    let lastMessage: string | undefined;

    for (let k = 0; k < pis.items.length; k++) {
      const item = pis.items[k];

      const message = pis.itemToString(item);

      if (message !== lastMessage) {
        if (
          (localEnv.displayInfo || localEnv.displayVerbose) &&
          item.itemType !== InfoItemType.info &&
          item.itemType !== InfoItemType.featureAggregate
        ) {
          if (item.itemType === InfoItemType.error || item.itemType === InfoItemType.testCompleteFail) {
            Log.error(message);
            lastMessage = message;
          } else {
            Log.message(message);
            lastMessage = message;
          }
        } else if (localEnv.displayVerbose) {
          Log.verbose(message);
          lastMessage = message;
        }
      }
    }
  }

  try {
    await outputResults(projectSet, pis, "", outputStorage, mcrJsonFile, outputMci, outputType);
  } catch (e: any) {
    Log.error(e);
  }

  // run derivative suites if no specific suite specified
  if (!suite || suite === "all") {
    const isAddon = await ProjectUtilities.getIsAddon(project);

    if (isAddon) {
      // CLI context: enable aggressive cleanup for memory efficiency
      pis = new ProjectInfoSet(
        project,
        ProjectInfoSuite.cooperativeAddOn,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );

      await pis.generateForProject();

      const projectSet = {
        projectContainerName: project.containerName,
        projectPath: project.projectFolder?.storageRelativePath,
        projectName: project.name,
        projectTitle: project.title,
        infoSetData: pis.getDataObject(),
        suite: ProjectInfoSuite.cooperativeAddOn,
      };

      resultStates.push(projectSet);

      await outputResults(projectSet, pis, "addon", outputStorage, undefined);
    }

    // CLI context: enable aggressive cleanup for memory efficiency
    pis = new ProjectInfoSet(project, ProjectInfoSuite.sharing, undefined, undefined, undefined, undefined, true);

    await pis.generateForProject();

    const projectSet = {
      projectContainerName: project.containerName,
      projectPath: project.projectFolder?.storageRelativePath,
      projectName: project.name,
      projectTitle: project.title,
      infoSetData: pis.getDataObject(),
      suite: ProjectInfoSuite.sharing,
    };

    resultStates.push(projectSet);

    await outputResults(projectSet, pis, "sharing", outputStorage, undefined);

    const shouldRunPlatformVersion = (pisData.info as any)["CWave"] !== undefined;

    if (shouldRunPlatformVersion) {
      // CLI context: enable aggressive cleanup for memory efficiency
      pis = new ProjectInfoSet(
        project,
        ProjectInfoSuite.currentPlatformVersions,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );

      await pis.generateForProject();

      const projectSet = {
        projectContainerName: project.containerName,
        projectPath: project.projectFolder?.storageRelativePath,
        projectName: project.name,
        projectTitle: project.title,
        infoSetData: pis.getDataObject(),
        suite: ProjectInfoSuite.currentPlatformVersions,
      };

      resultStates.push(projectSet);

      await outputResults(projectSet, pis, "currentplatform", outputStorage, undefined);
    }
  }

  // MEMORY: Belt-and-suspenders cleanup. Even though WorldDataInfoGenerator
  // calls `mcworld.clearAllData()` in aggressive-cleanup mode, walk every
  // world-type ProjectItem here and clear any MCWorld manager that's still
  // holding data. Catches cases where a generator threw, an item was missed,
  // or a new generator forgot to opt in. Also drops MCStructure managers
  // (same memory class).
  releaseHeavyItemManagers(project);

  project.dispose();

  return resultStates;
}

/**
 * Walk world-type project items and release the heavy parsed data hanging off
 * their managers. After this returns, the per-item references on `project`
 * are still intact (so `project.dispose()` can do its own cleanup), but the
 * LevelDB keys, decompressed block buffers, chunk caches, and any inner
 * ZipStorage payloads they reference are gone.
 *
 * Memory profiling of a 179 MB world template showed that without this:
 *  - ~3 GB of "external" memory remained at the end of validation, held by
 *    JSZip instances inside per-pack `ZipStorage`s (each caching the
 *    decompressed bytes of every entry that had been read).
 *  - The original world `.zip` (179 MB compressed) stayed pinned via the
 *    project's containerFile -> fileContainerStorage edge.
 *
 * Project.dispose() walks the project folder tree and disposes every file;
 * FileBase.dispose() now cascades into `fileContainerStorage?.dispose()`,
 * which (for ZipStorage) nulls out the JSZip instance and breaks the
 * container/file reference cycle. This helper handles the in-memory parsed
 * structures that hang off project items (MCWorld chunk maps, LevelDb keys)
 * which Project.dispose() doesn't know about.
 *
 * Safe to call multiple times — `clearAllData()` is idempotent.
 */
function releaseHeavyItemManagers(project: Project) {
  for (const item of project.items) {
    if (
      item.itemType !== ProjectItemType.MCWorld &&
      item.itemType !== ProjectItemType.MCTemplate &&
      item.itemType !== ProjectItemType.worldFolder
    ) {
      continue;
    }

    const file = item.primaryFile;
    const folder = item.defaultFolder;

    // 1. Drop parsed world data (chunks, LevelDb keys, etc.).
    const manager = (folder && folder.manager) || (file && file.manager);
    if (manager && typeof (manager as { clearAllData?: () => void }).clearAllData === "function") {
      try {
        (manager as { clearAllData: () => void }).clearAllData();
      } catch (e) {
        Log.debug("releaseHeavyItemManagers: clearAllData failed: " + (e as Error).message);
      }
    }

    // 2. If the world's primary file is a container (e.g., a .mcworld /
    //    .mctemplate is a zip), drop the JSZip instance + cached
    //    decompressed entries. The file-level dispose hooks in
    //    Project.dispose() will catch the project's outer cabinet file,
    //    but per-item container files have to be released here because
    //    Project.dispose() doesn't walk individual items' primaryFile.
    if (file) {
      const fileWithContainer = file as { fileContainerStorage?: { dispose?: () => void } | null };
      const inner = fileWithContainer.fileContainerStorage;
      if (inner && typeof inner.dispose === "function") {
        try {
          inner.dispose();
        } catch (e) {
          Log.debug("releaseHeavyItemManagers: inner storage dispose failed: " + (e as Error).message);
        }
        fileWithContainer.fileContainerStorage = null;
      }
    }
  }
}

async function outputResults(
  projectSet: IProjectMetaState,
  pis: ProjectInfoSet,
  fileNameModifier: string,
  outputStorage: NodeStorage | undefined,
  mcrJsonFile: NodeFile | undefined,
  outputMci?: boolean,
  outputType?: OutputType
) {
  if (outputStorage) {
    if (outputType !== OutputType.noReports) {
      const reportHtmlFile = outputStorage.rootFolder.ensureFile(
        StorageUtilities.ensureFileNameIsSafe(StorageUtilities.getBaseFromName(projectSet.projectContainerName)) +
          fileNameModifier +
          ".report.html"
      );

      const reportContent = pis.getReportHtml(projectSet.projectName, projectSet.projectPath, undefined);

      reportHtmlFile.setContent(reportContent);

      await reportHtmlFile.saveContent();
    }

    if (outputMci) {
      const indexFolder = outputStorage.rootFolder.ensureFolder("mci");
      const hashCatalogFolder = outputStorage.rootFolder.ensureFolder("mch");

      await indexFolder.ensureExists();
      await hashCatalogFolder.ensureExists();

      const mciContentFile = indexFolder.ensureFile(
        StorageUtilities.ensureFileNameIsSafe(StorageUtilities.getBaseFromName(projectSet.projectContainerName)) +
          fileNameModifier +
          ".mci.json"
      );
      const mchContentFile = hashCatalogFolder.ensureFile(
        StorageUtilities.ensureFileNameIsSafe(StorageUtilities.getBaseFromName(projectSet.projectContainerName)) +
          fileNameModifier +
          ".mch.json"
      );

      if (outputType === OutputType.noReports) {
        mciContentFile.setContent(pis.getStrictIndexJson(projectSet.projectName, projectSet.projectPath, undefined));
      } else {
        mciContentFile.setContent(pis.getIndexJson(projectSet.projectName, projectSet.projectPath, undefined));
      }

      await mciContentFile.saveContent();

      const hashCatalogContent = pis.getHashCatalogJson();

      mchContentFile.setContent(hashCatalogContent);

      await mchContentFile.saveContent();

      const mciContentFileZip = indexFolder.ensureFile(
        StorageUtilities.ensureFileNameIsSafe(StorageUtilities.getBaseFromName(projectSet.projectContainerName)) +
          fileNameModifier +
          ".mci.json.zip"
      );

      let contentStr = "";

      if (outputType === OutputType.noReports) {
        contentStr = pis.getStrictIndexJson(projectSet.projectName, projectSet.projectPath, undefined);
      } else {
        contentStr = pis.getIndexJson(projectSet.projectName, projectSet.projectPath, undefined);
      }
      mciContentFile.setContent(contentStr);

      await mciContentFile.saveContent();

      const zs = ZipStorage.fromJsonString(contentStr);

      const contentBytes = await zs.generateUint8ArrayAsync();

      mciContentFileZip.setContent(contentBytes);

      await mciContentFileZip.saveContent();
    }

    if (outputType !== OutputType.noReports) {
      const csvFile = outputStorage.rootFolder.ensureFile(
        StorageUtilities.ensureFileNameIsSafe(StorageUtilities.getBaseFromName(projectSet.projectContainerName)) +
          fileNameModifier +
          ".csv"
      );

      const pisLines = pis.getItemCsvLines();

      const csvContent = ProjectInfoSet.CommonCsvHeader + "\n" + pisLines.join("\n");

      csvFile.setContent(csvContent);

      await csvFile.saveContent();
    }

    if (mcrJsonFile) {
      if (projectSet.infoSetData.index) {
        projectSet.infoSetData.index = undefined;
      }

      const mcrContent = JSON.stringify(projectSet.infoSetData, null, 2);

      mcrJsonFile.setContent(mcrContent);

      await mcrJsonFile.saveContent();
    }
  }
}

import ITask from "./ITask";
import IProjectStartInfo from "./IProjectStartInfo";
import Log from "../core/Log";
import ClUtils, { OutputType, TaskType } from "./ClUtils";
import Carto from "../app/Carto";
import NodeFile from "../local/NodeFile";
import StorageUtilities from "../storage/StorageUtilities";
import NodeStorage from "../local/NodeStorage";
import IProjectInfoData, { ProjectInfoSuite } from "../info/IProjectInfoData";
import Project from "../app/Project";
import IProjectMetaState from "../info/IProjectMetaState";
import { expose } from "threads/worker";
import CartoApp, { HostType } from "../app/CartoApp";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { InfoItemType } from "../info/IInfoItemData";
import LocalEnvironment from "../local/LocalEnvironment";
import ProjectUtilities from "../app/ProjectUtilities";
import ZipStorage from "../storage/ZipStorage";

let carto: Carto | undefined;
let localEnv: LocalEnvironment | undefined;
let outputStorage: NodeStorage | undefined;
let outputStoragePath: string | undefined;

let activeContext: string | undefined;

async function executeTask(task: ITask) {
  if (!task.project) {
    Log.error("Could not find an associated project for the associated task.");
    return undefined;
  }

  activeContext = task.project?.ctorProjectName;

  if (localEnv === undefined) {
    localEnv = new LocalEnvironment(true);
  }

  localEnv.displayInfo = task.displayInfo;
  localEnv.displayVerbose = task.displayVerbose;

  if (carto === undefined) {
    CartoApp.hostType = HostType.toolsNodejs;

    carto = ClUtils.getCarto(localEnv);

    if (carto) {
      carto.onStatusAdded.subscribe(ClUtils.handleStatusAdded);
    }
  }

  if (!localEnv || !carto) {
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
          carto,
          task.project,
          task.arguments["suite"] as string | undefined,
          task.arguments["exclusionList"] as string | undefined,
          task.arguments["outputMci"] === true,
          task.arguments["outputType"] as number | undefined,
          task.displayInfo,
          task.force
        );
    }
  } catch (e) {
    return e.toString();
  }

  return undefined;
}

expose(executeTask);

async function validate(
  carto: Carto,
  projectStart: IProjectStartInfo,
  suite?: string,
  exclusionList?: string,
  outputMci?: boolean,
  outputType?: OutputType,
  displayInfo?: boolean,
  force?: boolean
) {
  const project = ClUtils.createProject(carto, projectStart);

  project.readOnlySafety = true;

  let jsonFile: NodeFile | undefined;
  let jsonFileExists = false;

  if (outputStorage && outputType !== OutputType.noReports) {
    jsonFile = outputStorage.rootFolder.ensureFile(
      StorageUtilities.ensureFileNameIsSafe(StorageUtilities.getBaseFromName(project.containerName)) + ".mcr.json"
    );

    jsonFileExists = await jsonFile.exists();

    if (jsonFileExists && !force && !displayInfo) {
      await jsonFile.loadContent(false);

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
    pis = project.infoSet;
  } else {
    suiteInst = ProjectInfoSet.getSuiteFromString(suite ? suite : "default");
    pis = new ProjectInfoSet(project, suiteInst, exclusionList ? [exclusionList] : undefined);
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
  } catch (e) {
    Log.error(e);
  }

  // run derivative suites if no specific suite specified
  if (!suite || suite === "all") {
    const isAddon = await ProjectUtilities.getIsAddon(project);

    if (isAddon) {
      pis = new ProjectInfoSet(project, ProjectInfoSuite.cooperativeAddOn);

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

    const shouldRunPlatformVersion = (pisData.info as any)["CWave"] !== undefined;

    if (shouldRunPlatformVersion) {
      pis = new ProjectInfoSet(project, ProjectInfoSuite.currentPlatformVersions);

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

  project.dispose();

  return resultStates;
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

      reportHtmlFile.saveContent();
    }

    if (outputMci) {
      const indexFolder = outputStorage.rootFolder.ensureFolder("mci");

      await indexFolder.ensureExists();

      const mciContentFile = indexFolder.ensureFile(
        StorageUtilities.ensureFileNameIsSafe(StorageUtilities.getBaseFromName(projectSet.projectContainerName)) +
          fileNameModifier +
          ".mci.json"
      );

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

      mciContentFile.saveContent();

      const zs = ZipStorage.fromJsonString(contentStr);

      const contentBytes = await zs.generateUint8ArrayAsync();

      mciContentFileZip.setContent(contentBytes);

      mciContentFileZip.saveContent();
    }

    if (outputType !== OutputType.noReports) {
      const csvFile = outputStorage.rootFolder.ensureFile(
        StorageUtilities.ensureFileNameIsSafe(StorageUtilities.getBaseFromName(projectSet.projectContainerName)) +
          fileNameModifier +
          ".csv"
      );

      const pisLines = pis.getItemCsvLines();

      const csvContent = ProjectInfoSet.CommonCsvHeader + "\r\n" + pisLines.join("\n");

      csvFile.setContent(csvContent);

      csvFile.saveContent();
    }

    if (mcrJsonFile) {
      if (projectSet.infoSetData.index) {
        projectSet.infoSetData.index = undefined;
      }

      const mcrContent = JSON.stringify(projectSet.infoSetData, null, 2);

      mcrJsonFile.setContent(mcrContent);

      mcrJsonFile.saveContent();
    }
  }
}

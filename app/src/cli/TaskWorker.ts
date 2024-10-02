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
import IProjectMetaState from "./IProjectMetaState";
import { expose } from "threads/worker";
import CartoApp, { HostType } from "../app/CartoApp";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { InfoItemType } from "../info/IInfoItemData";
import LocalEnvironment from "../local/LocalEnvironment";
import ProjectUtilities from "../app/ProjectUtilities";

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
    return await validateAndDisposeProject(project, outputStorage, jsonFile, suite, outputMci, outputType);
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
  outputMci?: boolean,
  outputType?: OutputType
): Promise<IProjectMetaState[]> {
  Log.verbose("Validating '" + project.name + "'" + (suite ? " with suite '" + suite + "'" : "") + ".");

  await project.inferProjectItemsFromFiles();

  let pis: ProjectInfoSet | undefined;

  let suiteInst: ProjectInfoSuite | undefined;

  if (!suite) {
    pis = project.infoSet;
  } else {
    suiteInst = ProjectInfoSet.getSuiteFromString(suite);
    pis = new ProjectInfoSet(project, suiteInst);
  }

  await pis.generateForProject();

  const pisData = pis.getDataObject();

  const metaStates: IProjectMetaState[] = [];

  const projectSet = {
    projectContainerName: project.containerName,
    projectPath: project.projectFolder?.storageRelativePath,
    projectName: project.name,
    projectTitle: project.title,
    infoSetData: pisData,
    suite: suiteInst,
  };

  metaStates.push(projectSet);

  pis.disconnectFromProject();

  if (localEnv?.displayInfo || localEnv?.displayVerbose) {
    for (let k = 0; k < pis.items.length; k++) {
      const item = pis.items[k];

      if (
        (localEnv.displayInfo || localEnv.displayVerbose) &&
        item.itemType !== InfoItemType.info &&
        item.itemType !== InfoItemType.featureAggregate
      ) {
        if (item.itemType === InfoItemType.error || item.itemType === InfoItemType.testCompleteFail) {
          Log.error(pis.itemToString(item));
        } else {
          Log.message(pis.itemToString(item));
        }
      } else if (localEnv.displayVerbose) {
        Log.verbose(pis.itemToString(item));
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
      pis = new ProjectInfoSet(project, ProjectInfoSuite.addOn);

      await pis.generateForProject();

      const projectSet = {
        projectContainerName: project.containerName,
        projectPath: project.projectFolder?.storageRelativePath,
        projectName: project.name,
        projectTitle: project.title,
        infoSetData: pis.getDataObject(),
        suite: ProjectInfoSuite.addOn,
      };

      metaStates.push(projectSet);

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

      metaStates.push(projectSet);

      await outputResults(projectSet, pis, "currentplatform", outputStorage, undefined);
    }
  }

  project.dispose();

  return metaStates;
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

      if (outputType === OutputType.noReports) {
        mciContentFile.setContent(pis.getStrictIndexJson(projectSet.projectName, projectSet.projectPath, undefined));
      } else {
        mciContentFile.setContent(pis.getIndexJson(projectSet.projectName, projectSet.projectPath, undefined));
      }

      mciContentFile.saveContent();
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

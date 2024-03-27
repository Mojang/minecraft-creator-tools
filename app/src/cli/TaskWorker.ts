import ITask from "./ITask";
import IProjectStartInfo from "./IProjectStartInfo";
import Log from "../core/Log";
import ClUtils, { TaskType } from "./ClUtils";
import Carto from "../app/Carto";
import NodeFile from "../local/NodeFile";
import StorageUtilities from "../storage/StorageUtilities";
import NodeStorage from "../local/NodeStorage";
import IProjectInfoData from "../info/IProjectInfoData";
import Project from "../app/Project";
import IProjectMetaState from "./IProjectMetaState";
import { expose } from "threads/worker";
import CartoApp, { HostType } from "../app/CartoApp";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { InfoItemType } from "../info/IInfoItemData";
import LocalEnvironment from "../local/LocalEnvironment";

let carto: Carto | undefined = undefined;
let localEnv: LocalEnvironment | undefined = undefined;
let outputStorage: NodeStorage | undefined = undefined;
let outputStoragePath: string | undefined = undefined;

let activeContext: string | undefined = undefined;

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
          task.arguments["suite"],
          task.arguments["outputMci"] === "true",
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
  displayInfo?: boolean,
  force?: boolean
) {
  const project = ClUtils.createProject(carto, projectStart);

  project.readOnlySafety = true;

  let jsonFile: NodeFile | undefined = undefined;
  let jsonFileExists = false;

  if (outputStorage) {
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

        return metaState;
      }
    }
  }

  if (!jsonFileExists || force || displayInfo) {
    return await validateAndDisposeProject(project, outputStorage, jsonFile, suite, outputMci);
  } else {
    Log.message("'" + project.name + "' has already been validated; skipping. Use --force to re-validate.");
  }

  return undefined;
}

async function validateAndDisposeProject(
  project: Project,
  outputStorage: NodeStorage | undefined,
  jsonFile: NodeFile | undefined,
  suite?: string,
  outputMci?: boolean
): Promise<IProjectMetaState> {
  Log.verbose("Validating '" + project.name + "'" + (suite ? " with suite '" + suite + "'" : "") + ".");

  const csvHeader = ProjectInfoSet.CommonCsvHeader;

  await project.inferProjectItemsFromFiles();

  let pis: ProjectInfoSet | undefined = undefined;

  if (!suite) {
    pis = project.infoSet;
  } else {
    pis = new ProjectInfoSet(project, ProjectInfoSet.getSuiteFromString(suite));
  }

  await pis.generateForProject();

  const pisData = pis.getDataObject();
  const content = JSON.stringify(pisData, null, 2);

  const projectSet = {
    projectContainerName: project.containerName,
    projectPath: project.projectFolder?.storageRelativePath,
    projectName: project.name,
    projectTitle: project.title,
    infoSetData: pisData,
  };

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

  if (outputStorage) {
    const reportHtmlFile = outputStorage.rootFolder.ensureFile(
      StorageUtilities.ensureFileNameIsSafe(StorageUtilities.getBaseFromName(projectSet.projectContainerName)) +
        ".report.html"
    );

    const reportContent = pis.getReportHtml(projectSet.projectName, projectSet.projectPath, undefined);

    reportHtmlFile.setContent(reportContent);

    reportHtmlFile.saveContent();

    if (outputMci) {
      const indexFolder = outputStorage.rootFolder.ensureFolder("mci");

      await indexFolder.ensureExists();

      const mciContentFile = indexFolder.ensureFile(
        StorageUtilities.ensureFileNameIsSafe(StorageUtilities.getBaseFromName(projectSet.projectContainerName)) +
          ".mci.json"
      );

      const mciContent = pis.getIndexJson(projectSet.projectName, projectSet.projectPath, undefined);

      mciContentFile.setContent(mciContent);

      mciContentFile.saveContent();
    }

    const csvFile = outputStorage.rootFolder.ensureFile(
      StorageUtilities.ensureFileNameIsSafe(StorageUtilities.getBaseFromName(projectSet.projectContainerName)) + ".csv"
    );

    const pisLines = pis.getItemCsvLines();

    const csvContent = csvHeader + "\r\n" + pisLines.join("\n");

    csvFile.setContent(csvContent);

    csvFile.saveContent();

    if (jsonFile) {
      jsonFile.setContent(content);

      jsonFile.saveContent();
    }
  }

  project.dispose();

  return projectSet;
}

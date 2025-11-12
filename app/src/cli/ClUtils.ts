import CreatorTools from "../app/CreatorTools";
import CreatorToolsHost from "../app/CreatorToolsHost";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import IStatus, { StatusType } from "../app/Status";
import Log from "../core/Log";
import LocalEnvironment, { OperationColors, consoleText_reset } from "../local/LocalEnvironment";
import LocalUtilities from "../local/LocalUtilities";
import NodeStorage from "../local/NodeStorage";
import Database from "../minecraft/Database";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import IProjectStartInfo from "./IProjectStartInfo";

export enum TaskType {
  noCommand = 0,
  deploy = 5,
  info = 7,
  add = 8,
  create = 9,
  validate = 10,
  serve = 11,
  version = 12,
  passcodes = 13,
  setPasscode = 14,
  setServerProperties = 15,
  minecraftEulaAndPrivacyStatement = 16,
  deployTestWorld = 17,
  world = 18,
  fix = 19,
  setProjectProperty = 20,
  aggregateReports = 22,
  docsUpdateFormSource = 23,
  docsGenerateFormJson = 24,
  docsGenerateMarkdown = 25,
  docsGenerateTypes = 27,
  profileValidation = 28,
}

export enum OutputType {
  normal = 0,
  noReports = 1,
}

export default class ClUtils {
  static createProject(creatorTools: CreatorTools, startInfo: IProjectStartInfo) {
    const proj = new Project(creatorTools, startInfo.ctorProjectName, null);

    if (startInfo.localFilePath) {
      proj.localFilePath = startInfo.localFilePath;
    }

    if (startInfo.localFolderPath) {
      proj.localFolderPath = startInfo.localFolderPath;
    }

    if (startInfo.accessoryFiles) {
      proj.accessoryFilePaths = startInfo.accessoryFiles;
    }

    proj.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;

    return proj;
  }

  static handleStatusAdded(creatorTools: CreatorTools, status: IStatus) {
    let message = status.message;

    if (status.type === StatusType.operationStarted) {
      message =
        OperationColors[(status.operationId ? status.operationId : 0) % OperationColors.length] +
        "[[ START: " +
        message +
        consoleText_reset;
    } else if (status.type === StatusType.operationEndedComplete) {
      message =
        OperationColors[(status.operationId ? status.operationId : 0) % OperationColors.length] +
        "          " +
        message +
        " :END ]]" +
        consoleText_reset;
    } else if (status.type === StatusType.operationEndedErrors) {
      message =
        OperationColors[(status.operationId ? status.operationId : 0) % OperationColors.length] +
        "          " +
        message +
        " :END - ERRORS ]]" +
        consoleText_reset;
    }

    Log.verbose(message);
  }

  static async localFolderExists(path: string) {
    const ls = new NodeStorage(path, "");

    return await ls.rootFolder.exists();
  }

  static async localFileExists(path: string) {
    const folderPath = StorageUtilities.getFolderPath(path);
    const fileName = StorageUtilities.getLeafName(path);

    if (!fileName || fileName.length < 2 || !folderPath || folderPath.length < 2) {
      throw new Error("Could not process file with path: `" + path + "`");
    }

    const ls = new NodeStorage(folderPath, "");

    const file = ls.rootFolder.ensureFile(fileName);

    return await file.exists();
  }

  static ensureLocalFolder(path: string) {
    const ls = new NodeStorage(path, "");

    return ls.rootFolder;
  }

  static getIsWriteCommand(taskType: TaskType) {
    return taskType === TaskType.world || taskType === TaskType.create || taskType === TaskType.add;
  }

  static async getMainWorkFolder(taskType: TaskType, inputFolder?: string, outputFolder?: string) {
    // console.log("Using local path: '" + inputFolder + "' from '" + __dirname + "'");
    let workFolder: IFolder | undefined;

    if (!inputFolder && outputFolder && ClUtils.getIsWriteCommand(taskType)) {
      const outputStorage = new NodeStorage(outputFolder, "");
      workFolder = outputStorage.rootFolder;
      await workFolder.ensureExists();
    }

    if (!workFolder) {
      if (!inputFolder) {
        inputFolder = process.cwd();
      }

      const inputStorage = new NodeStorage(inputFolder, "");
      inputStorage.readOnly = true;
      workFolder = inputStorage.rootFolder;
    }

    const exists = await workFolder.exists();

    if (!exists) {
      throw new Error("Specified folder path '" + workFolder.fullPath + "' does not exist within '" + __dirname + "'.");
    }

    await workFolder.load();

    return workFolder;
  }

  static getCreatorTools(localEnv: LocalEnvironment, basePath?: string) {
    CreatorToolsHost.localFolderExists = ClUtils.localFolderExists;
    CreatorToolsHost.localFileExists = ClUtils.localFileExists;
    CreatorToolsHost.ensureLocalFolder = ClUtils.ensureLocalFolder;

    CreatorToolsHost.prefsStorage = new NodeStorage(
      localEnv.utilities.cliWorkingPath + "prefs" + NodeStorage.platformFolderDelimiter,
      ""
    );

    CreatorToolsHost.projectsStorage = new NodeStorage(
      localEnv.utilities.cliWorkingPath + "projects" + NodeStorage.platformFolderDelimiter,
      ""
    );

    CreatorToolsHost.packStorage = new NodeStorage(
      localEnv.utilities.cliWorkingPath + "packs" + NodeStorage.platformFolderDelimiter,
      ""
    );

    CreatorToolsHost.deploymentStorage = new NodeStorage(
      localEnv.utilities.cliWorkingPath + "deployment" + NodeStorage.platformFolderDelimiter,
      ""
    );

    CreatorToolsHost.workingStorage = new NodeStorage(
      localEnv.utilities.cliWorkingPath + "working" + NodeStorage.platformFolderDelimiter,
      ""
    );

    if (localEnv.utilities && basePath) {
      (localEnv.utilities as LocalUtilities).basePathAdjust = basePath;
      CreatorToolsHost.fullLocalStorage = true;
    }

    const coreStorage = new NodeStorage(__dirname + "/../data/content/", "");
    Database.contentFolder = coreStorage.rootFolder;

    Database.local = localEnv.utilities;

    CreatorToolsHost.init();

    if (CreatorToolsHost.creatorTools) {
      CreatorToolsHost.creatorTools.local = localEnv.utilities;
    }

    return CreatorToolsHost.creatorTools;
  }
}

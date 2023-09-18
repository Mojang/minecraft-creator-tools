import Project from "./Project";
import ITool, { ToolType, ToolScope } from "./ITool";
import { ProjectItemType } from "./IProjectItemData";
import Carto from "./Carto";
import IStorage from "../storage/IStorage";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import Log from "../core/Log";

export default class ProjectTools {
  /*  static async getFlatGameTestWorldWithPacks(carto: Carto, project: Project, name: string) {
    carto.notifyStatusUpdate("Loading DB content ");

    return undefined;
  }
*/
  static async addGlobalTools(tools: ITool[]) {
    tools.push({
      title: "Reload",
      type: ToolType.reload,
      scope: ToolScope.global,
    });

    tools.push({
      title: "Hello World",
      type: ToolType.say,
      parameter1: "Hello from Minecraft Creator Tools.",
      scope: ToolScope.global,
    });
  }

  static async generateTools(project: Project) {
    const tools: ITool[] = [];

    ProjectTools.addGlobalTools(tools);

    for (let i = 0; i < project.items.length; i++) {
      const pi = project.items[i];

      if (pi.itemType === ProjectItemType.structure && pi.storagePath !== null) {
        let structureName = pi.name;

        structureName = structureName.replace(".mcstructure", "");

        const tool: ITool = {
          title: "Push " + structureName + " to Minecraft",
          type: ToolType.pushStructure,
          scope: ToolScope.project,
          parameter1: pi.storagePath,
        };

        tools.push(tool);
      }
    }

    return tools;
  }

  static async executeTool(tool: ITool, carto: Carto, project?: Project) {
    switch (tool.type) {
      case ToolType.reload:
        ProjectTools.reload(carto);
        break;
      case ToolType.say:
        if (tool.parameter1 && tool.parameter1.length > 0) {
          ProjectTools.say(carto, tool.parameter1);
        }
        break;
    }
  }

  static async deployProject(
    carto: Carto,
    project: Project,
    deploymentStorage: IStorage,
    deployBehaviorPacksFolder: IFolder
  ) {
    const deployFolderExists = await deployBehaviorPacksFolder.exists();

    if (deployFolderExists) {
      await ProjectTools.deployToBehaviorPackFolder(project, deployBehaviorPacksFolder);
    }
  }

  static async deployToBehaviorPackFolder(project: Project, deployBP: IFolder) {
    await project.ensureProjectFolder();

    const bpi = await project.ensureDefaultBehaviorPackFolder();

    const deployProjectFolder = deployBP.ensureFolder(project.name);

    await deployProjectFolder.ensureExists();

    await StorageUtilities.syncFolderTo(bpi, deployProjectFolder, true, true, true, ["/mcworlds", "/minecraftWorlds"]);

    const scriptsFolder = await project.ensureScriptsFolder();

    if (
      !scriptsFolder.storageRelativePath.startsWith(bpi.storageRelativePath) &&
      scriptsFolder.storageRelativePath !== "/"
    ) {
      await StorageUtilities.syncFolderTo(
        scriptsFolder,
        deployProjectFolder.ensureFolder("scripts"),
        true,
        true,
        true,
        [".ts"],
        async (message: string) => {
          Log.verbose(message);
        }
      );
    }

    await deployProjectFolder.saveAll();
  }

  static async reload(carto: Carto) {
    await carto.runMinecraftCommand("reload");
  }

  static async say(carto: Carto, message: string) {
    await carto.runMinecraftCommand("say " + message);
  }
}

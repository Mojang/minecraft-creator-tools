import ProjectExporter from "../app/ProjectExporter";
import Carto from "../app/Carto";
import Project from "../app/Project";
import IFolder from "../storage/IFolder";
import * as fs from "fs";
import * as open from "open";
import ProjectTools from "../app/ProjectTools";

export default class LocalTools {
  static async exportWorld(carto: Carto, project: Project, path: string) {
    carto.notifyStatusUpdate("Starting export");

    const name = project.name + " World";
    const fileName = project.name + ".mcworld";

    carto.notifyStatusUpdate("Packing " + fileName);
    const newBytes = await ProjectExporter.getFlatBetaApisWorldWithPacksZip(carto, project, name);

    carto.notifyStatusUpdate("Now saving " + fileName);

    if (newBytes !== undefined) {
      fs.writeFileSync(path, newBytes);
    }
  }

  static async launchWorld(carto: Carto, worldFolderName: string) {
    const commandLine = "minecraft://mode/?load=" + worldFolderName;
    console.log("Running " + commandLine);
    await open(commandLine);
  }

  static async ensureFlatPackRefWorldTo(carto: Carto, project: Project, rootFolder: IFolder, name: string) {
    const childFolder = rootFolder.ensureFolder(name);

    await childFolder.ensureExists();

    await ProjectExporter.syncFlatPackRefWorldTo(carto, project, childFolder, name);

    await childFolder.saveAll();
  }

  static async deploy(carto: Carto, project: Project, rootFolder: IFolder, name: string) {
    await ProjectTools.deployToBehaviorPackFolder(project, rootFolder);

    await rootFolder.saveAll();
  }
}

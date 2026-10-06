// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectExporter from "../app/ProjectExporter";
import creatorTools from "../app/CreatorTools";
import Project from "../app/Project";
import IFolder from "../storage/IFolder";
import * as fs from "fs";
import open from "open";
import IStorage from "../storage/IStorage";
import IFile from "../storage/IFile";

export default class LocalTools {
  static async exportWorld(creatorTools: creatorTools, project: Project, path: string): Promise<boolean> {
    creatorTools.notifyStatusUpdate("Starting export");

    const name = project.name + " World";
    const fileName = project.name + ".mcworld";

    creatorTools.notifyStatusUpdate("Packing " + fileName);
    const newBytes = await ProjectExporter.generateFlatBetaApisWorldWithPacksZipBytes(creatorTools, project, name);

    creatorTools.notifyStatusUpdate("Now saving " + fileName);

    if (newBytes !== undefined) {
      fs.writeFileSync(path, newBytes);
      return true;
    }

    return false;
  }

  static async convertFromJavaWorld(creatorTools: creatorTools, javaWorldFile: IFile) {}

  /** CLI callers supply their logger; other hosts keep the existing launch notice. */
  static async launchWorld(
    creatorTools: creatorTools,
    worldFolderName: string,
    log: (message: string) => void = console.log
  ): Promise<void> {
    const commandLine = "minecraft://mode/?load=" + worldFolderName;
    log("Running " + commandLine);
    await open(commandLine);
  }

  static async ensureFlatPackRefWorldTo(
    creatorTools: creatorTools,
    project: Project,
    rootFolder: IFolder,
    name: string
  ) {
    const childFolder = rootFolder.ensureFolder(name);

    await childFolder.ensureExists();

    await ProjectExporter.syncFlatPackRefWorldTo(creatorTools, project, childFolder, name);

    await childFolder.saveAll();
  }

  static async deploy(
    creatorTools: creatorTools,
    project: Project,
    storage: IStorage,
    rootFolder: IFolder,
    name: string
  ) {
    await ProjectExporter.deployProject(creatorTools, project, rootFolder);

    await rootFolder.saveAll();
  }
}

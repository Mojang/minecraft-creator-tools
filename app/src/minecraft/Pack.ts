// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Project from "../app/Project";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import ProjectItem from "../app/ProjectItem";
import BehaviorManifestDefinition from "./BehaviorManifestDefinition";
import ResourceManifestDefinition from "./ResourceManifestDefinition";
import SkinManifestDefinition from "./SkinManifestDefinition";
import PersonaManifestDefinition from "./PersonaManifestDefinition";
import DesignManifestDefinition from "./DesignManifestDefinition";

export enum PackType {
  resource = 0,
  behavior = 1,
  skin = 2,
  persona = 3,
  design = 4,
}

export default class Pack {
  type: PackType;
  manifestFile?: IFile;
  folder: IFolder;
  project: Project;
  projectItem: ProjectItem;
  manifest?:
    | BehaviorManifestDefinition
    | ResourceManifestDefinition
    | SkinManifestDefinition
    | PersonaManifestDefinition
    | DesignManifestDefinition
    | undefined;

  constructor(folderIn: IFolder, packTypeIn: PackType, project: Project, projectItem: ProjectItem) {
    this.project = project;
    this.projectItem = projectItem;
    this.folder = folderIn;
    this.type = packTypeIn;
  }

  ensureManifestFile() {
    if (this.manifestFile === undefined) {
      this.manifestFile = this.folder.ensureFile("manifest.json");
    }

    return this.manifestFile;
  }

  async ensureManifest() {
    if (this.manifest) {
      return this.manifest;
    }

    this.manifestFile = this.ensureManifestFile();

    if (this.type === PackType.behavior) {
      this.manifest = await BehaviorManifestDefinition.ensureOnFile(this.manifestFile);
    } else if (this.type === PackType.skin) {
      this.manifest = await SkinManifestDefinition.ensureOnFile(this.manifestFile);
    } else if (this.type === PackType.persona) {
      this.manifest = await PersonaManifestDefinition.ensureOnFile(this.manifestFile);
    } else if (this.type === PackType.design) {
      this.manifest = await PersonaManifestDefinition.ensureOnFile(this.manifestFile);
    } else {
      this.manifest = await ResourceManifestDefinition.ensureOnFile(this.manifestFile);
    }

    return this.manifest;
  }

  getPackItems(): ProjectItem[] {
    const folderPath = this.projectItem.projectPath;

    if (!folderPath) {
      throw new Error("Pack.getPackItems called without a project path");
    }

    return this.project.items.filter((item) => item.projectPath?.startsWith(folderPath));
  }

  static ensureOnFolder(folder: IFolder, packType: PackType, project: Project, projectItem: ProjectItem) {
    if (folder.manager === undefined) {
      const pack = new Pack(folder, packType, project, projectItem);

      pack.project = project;
      pack.type = packType;

      return pack;
    } else {
      return folder.manager as Pack;
    }
  }

  get name(): string {
    return this.projectItem?.name || "Unnamed pack";
  }

  async getFiles(predicate?: (file: IFile) => boolean): Promise<IFile[]> {
    const result = [];
    for await (const file of this.folder.allFiles) {
      await file.loadContent();

      if (file.content && (!predicate || predicate(file))) {
        result.push(file);
      }
    }

    return result;
  }
}

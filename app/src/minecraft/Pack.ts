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

export enum PackType {
  resource = 0,
  behavior = 1,
  skin = 2,
  persona = 3,
}

export default class Pack {
  type: PackType;
  manifestFile?: IFile;
  folder: IFolder;
  project?: Project;
  projectItem?: ProjectItem;
  manifest?:
    | BehaviorManifestDefinition
    | ResourceManifestDefinition
    | SkinManifestDefinition
    | PersonaManifestDefinition
    | undefined;

  constructor(folderIn: IFolder, packTypeIn: PackType) {
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
    } else {
      this.manifest = await ResourceManifestDefinition.ensureOnFile(this.manifestFile);
    }

    return this.manifest;
  }

  static ensureOnFolder(folder: IFolder, packType: PackType, project: Project) {
    if (folder.manager === undefined) {
      const pack = new Pack(folder, packType);

      pack.project = project;
      pack.type = packType;

      return pack;
    } else {
      return folder.manager as Pack;
    }
  }
}

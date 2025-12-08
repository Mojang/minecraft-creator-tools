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
import Log from "../core/Log";

export enum PackType {
  resource = 0,
  behavior = 1,
  skin = 2,
  persona = 3,
  design = 4,
}

export default class Pack {
  packType: PackType;
  manifestFile?: IFile;
  folder: IFolder;
  project: Project;
  projectItem: ProjectItem;
  isInWorld: boolean = false;
  manifest?:
    | BehaviorManifestDefinition
    | ResourceManifestDefinition
    | SkinManifestDefinition
    | PersonaManifestDefinition
    | DesignManifestDefinition
    | undefined;

  private _items: ProjectItem[] | undefined;

  //stubbing in for use later
  get isEDUOffer() {
    return false;
  }

  constructor(folderIn: IFolder, packTypeIn: PackType, project: Project, projectItem: ProjectItem) {
    this.project = project;
    this.projectItem = projectItem;
    this.folder = folderIn;
    this.packType = packTypeIn;
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

    if (this.packType === PackType.behavior) {
      this.manifest = await BehaviorManifestDefinition.ensureOnFile(this.manifestFile);
    } else if (this.packType === PackType.skin) {
      this.manifest = await SkinManifestDefinition.ensureOnFile(this.manifestFile);
    } else if (this.packType === PackType.persona) {
      this.manifest = await PersonaManifestDefinition.ensureOnFile(this.manifestFile);
    } else if (this.packType === PackType.design) {
      this.manifest = await DesignManifestDefinition.ensureOnFile(this.manifestFile);
    } else {
      this.manifest = await ResourceManifestDefinition.ensureOnFile(this.manifestFile);
    }

    if (this.manifest && !this.manifest.isLoaded) {
      this.manifest.load();
    }

    // If the manifest file was newly created or is empty, populate it with default content
    if (this.manifest && !this.manifest.definition) {
      this.manifest.ensureHeaderForProject(this.project);
      this.manifest.persist();
    }

    return this.manifest;
  }

  getManifest(): ProjectItem {
    const manifest = this.getPackItems().find((item) => item.name === "manifest.json");
    Log.assert(!!manifest, "Pack should always have a manifest item");
    return manifest;
  }

  getPackItems(): readonly ProjectItem[] {
    if (!!this._items) {
      return this._items;
    }
    const folderPath = this.projectItem.projectPath;

    if (!folderPath) {
      throw new Error("Pack.getPackItems called without a project path");
    }

    this._items = this.project.items.filter((item) => item.projectPath?.startsWith(folderPath));
    return this._items;
  }

  static ensureOnFolder(folder: IFolder, packType: PackType, project: Project, projectItem: ProjectItem) {
    if (folder.manager === undefined) {
      const pack = new Pack(folder, packType, project, projectItem);

      if (projectItem.isInWorld) {
        pack.isInWorld = true;
      }
      pack.project = project;
      pack.packType = packType;

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
      if (!file.isContentLoaded) {
        await file.loadContent();
      }

      if (file.content && (!predicate || predicate(file))) {
        result.push(file);
      }
    }

    return result;
  }
}

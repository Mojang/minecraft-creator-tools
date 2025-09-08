// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import IDefinition from "./IDefinition";
import StorageUtilities from "../storage/StorageUtilities";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import JigsawTemplatePoolDefinition from "./JigsawTemplatePoolDefinition";

export interface IJigsawStructureDefinition {
  format_version: string;
  "minecraft:jigsaw": {
    description: {
      identifier: string;
    };
    step: string;
    terrain_adaptation: string;
    start_pool: string;
    max_depth: number;
    start_height: number;
    heightmap_projection: string;
  };
}

export default class JigsawStructureDefinition implements IDefinition {
  private _file?: IFile;
  private _data?: IJigsawStructureDefinition;
  private _isLoaded: boolean = false;

  public get data() {
    return this._data;
  }

  public get file() {
    return this._file;
  }

  public set file(newFile: IFile | undefined) {
    this._file = newFile;
  }

  public get isLoaded() {
    return this._isLoaded;
  }

  public get id() {
    if (this._data?.["minecraft:jigsaw"]?.description?.identifier) {
      return this._data["minecraft:jigsaw"].description.identifier;
    }
    return "";
  }

  public get startPool() {
    if (this._data?.["minecraft:jigsaw"]?.start_pool) {
      return this._data["minecraft:jigsaw"].start_pool;
    }
    return undefined;
  }

  public async getFormatVersionIsCurrent() {
    // For now, assume format version is current
    return true;
  }

  async addChildItems(project: Project, item: ProjectItem) {
    if (!this.startPool) {
      return;
    }

    const itemsCopy = project.getItemsCopy();

    // Find template pool referenced by start_pool
    for (const candItem of itemsCopy) {
      if (candItem.itemType === ProjectItemType.jigsawTemplatePool) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile) {
          const templatePool = await JigsawTemplatePoolDefinition.ensureOnFile(candItem.primaryFile);

          if (templatePool && templatePool.id === this.startPool) {
            item.addChildItem(candItem);
          }
        }
      }
    }
  }

  static async ensureOnFile(file: IFile): Promise<JigsawStructureDefinition | undefined> {
    let jigsawStructure: JigsawStructureDefinition | undefined;

    if (file.manager === undefined) {
      jigsawStructure = new JigsawStructureDefinition();
      jigsawStructure.file = file;
      file.manager = jigsawStructure;
    }

    if (file.manager !== undefined && file.manager instanceof JigsawStructureDefinition) {
      jigsawStructure = file.manager as JigsawStructureDefinition;
      if (!jigsawStructure.isLoaded) {
        await jigsawStructure.load();
      }
    }

    return jigsawStructure;
  }

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (!this._file.content || this._file.content instanceof Uint8Array) {
      return;
    }

    const result = StorageUtilities.getJsonObject(this._file);

    if (result) {
      this._data = result;
    }

    this._isLoaded = true;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const dataString = JSON.stringify(this._data, null, 2);
    this._file.setContent(dataString);
  }
}

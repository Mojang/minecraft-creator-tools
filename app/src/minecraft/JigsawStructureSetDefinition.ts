// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import IDefinition from "./IDefinition";
import StorageUtilities from "../storage/StorageUtilities";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import JigsawStructureDefinition from "./JigsawStructureDefinition";

export interface IJigsawStructureSetDefinition {
  format_version: string;
  "minecraft:structure_set": {
    description: {
      identifier: string;
    };
    placement: {
      type: string;
      salt: number;
      separation: number;
      spacing: number;
      spread_type: string;
    };
    structures: Array<{
      structure: string;
      weight: number;
    }>;
  };
}

export default class JigsawStructureSetDefinition implements IDefinition {
  private _file?: IFile;
  private _data?: IJigsawStructureSetDefinition;
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
    if (this._data?.["minecraft:structure_set"]?.description?.identifier) {
      return this._data["minecraft:structure_set"].description.identifier;
    }
    return "";
  }

  public get structures() {
    if (this._data?.["minecraft:structure_set"]?.structures) {
      return this._data["minecraft:structure_set"].structures;
    }
    return [];
  }

  public async getFormatVersionIsCurrent() {
    // For now, assume format version is current
    return true;
  }

  async addChildItems(project: Project, item: ProjectItem) {
    const structures = this.structures;
    if (!structures || structures.length === 0) {
      return;
    }

    const itemsCopy = project.getItemsCopy();

    // Find jigsaw structures referenced by this structure set
    for (const structureRef of structures) {
      for (const candItem of itemsCopy) {
        if (candItem.itemType === ProjectItemType.jigsawStructure) {
          await candItem.ensureStorage();

          if (candItem.primaryFile) {
            const jigsawStructure = await JigsawStructureDefinition.ensureOnFile(candItem.primaryFile);

            if (jigsawStructure && jigsawStructure.id === structureRef.structure) {
              item.addChildItem(candItem);
            }
          }
        }
      }
    }
  }

  static async ensureOnFile(file: IFile): Promise<JigsawStructureSetDefinition | undefined> {
    let jigsawStructureSet: JigsawStructureSetDefinition | undefined;

    if (file.manager === undefined) {
      jigsawStructureSet = new JigsawStructureSetDefinition();
      jigsawStructureSet.file = file;
      file.manager = jigsawStructureSet;
    }

    if (file.manager !== undefined && file.manager instanceof JigsawStructureSetDefinition) {
      jigsawStructureSet = file.manager as JigsawStructureSetDefinition;
      await jigsawStructureSet.load();
    }

    return jigsawStructureSet;
  }

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      return;
    }

    await this._file.loadContent();

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
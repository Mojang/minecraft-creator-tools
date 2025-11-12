// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import IDefinition from "./IDefinition";
import StorageUtilities from "../storage/StorageUtilities";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import JigsawProcessorListDefinition from "./JigsawProcessorListDefinition";
import Log from "../core/Log";

export interface IJigsawTemplatePoolElement {
  element: {
    element_type: string;
    location: string;
    processors?: string;
  };
  weight: number;
}

export interface IJigsawTemplatePoolDefinition {
  format_version: string;
  "minecraft:template_pool": {
    description: {
      identifier: string;
    };
    elements: IJigsawTemplatePoolElement[];
  };
}

export default class JigsawTemplatePoolDefinition implements IDefinition {
  private _file?: IFile;
  private _data?: IJigsawTemplatePoolDefinition;
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
    if (this._data?.["minecraft:template_pool"]?.description?.identifier) {
      return this._data["minecraft:template_pool"].description.identifier;
    }
    return "";
  }

  public get elements() {
    if (this._data?.["minecraft:template_pool"]?.elements) {
      return this._data["minecraft:template_pool"].elements;
    }
    return [];
  }

  public async getFormatVersionIsCurrent() {
    // For now, assume format version is current
    return true;
  }

  async addChildItems(project: Project, item: ProjectItem) {
    const elements = this.elements;
    if (!elements || elements.length === 0) {
      return;
    }

    const jigsawProcessorListItems = project.getItemsByType(ProjectItemType.jigsawProcessorList);

    // Find structure files and processors referenced by this template pool
    for (const element of elements) {
      // Find structure files referenced by location
      if (element.element.location) {
        const structurePath = element.element.location + ".mcstructure";

        for (const candItem of jigsawProcessorListItems) {
          if (candItem.itemType === ProjectItemType.structure) {
            if (
              candItem.projectPath?.endsWith(structurePath) ||
              candItem.projectPath?.includes(element.element.location)
            ) {
              item.addChildItem(candItem);
            }
          }
        }
      }

      // Find processors referenced by processors field
      if (element.element.processors) {
        for (const candItem of jigsawProcessorListItems) {
          if (!candItem.isContentLoaded) {
            await candItem.loadContent();
          }

          if (candItem.primaryFile) {
            const processorList = await JigsawProcessorListDefinition.ensureOnFile(candItem.primaryFile);

            if (processorList && processorList.id === element.element.processors) {
              item.addChildItem(candItem);
            }
          }
        }
      }
    }
  }

  static async ensureOnFile(file: IFile): Promise<JigsawTemplatePoolDefinition | undefined> {
    let jigsawTemplatePool: JigsawTemplatePoolDefinition | undefined;

    if (file.manager === undefined) {
      jigsawTemplatePool = new JigsawTemplatePoolDefinition();
      jigsawTemplatePool.file = file;
      file.manager = jigsawTemplatePool;
    }

    if (file.manager !== undefined && file.manager instanceof JigsawTemplatePoolDefinition) {
      jigsawTemplatePool = file.manager as JigsawTemplatePoolDefinition;
      if (!jigsawTemplatePool.isLoaded) {
        await jigsawTemplatePool.load();
      }
    }

    return jigsawTemplatePool;
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

  persist(): boolean {
    if (this._file === undefined) {
      return false;
    }

    if (!this._data) {
      Log.unexpectedUndefined("ITRDP");
      return false;
    }

    return this._file.setObjectContentIfSemanticallyDifferent(this._data);
  }
}

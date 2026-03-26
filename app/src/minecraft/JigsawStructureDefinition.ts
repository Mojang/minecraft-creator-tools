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
  private _loadedWithComments: boolean = false;

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

    const templatePoolItems = project.getItemsByType(ProjectItemType.jigsawTemplatePool);

    // Find template pool referenced by start_pool
    for (const candItem of templatePoolItems) {
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

  /**
   * Loads the definition from the file.
   * @param preserveComments If true, uses comment-preserving JSON parsing for edit/save cycles.
   *                         If false (default), uses efficient standard JSON parsing.
   *                         Can be called again with true to "upgrade" a read-only load to read/write.
   */
  async load(preserveComments: boolean = false) {
    // If already loaded with comments, we have the "best" version - nothing more to do
    if (this._isLoaded && this._loadedWithComments) {
      return;
    }

    // If already loaded without comments and caller doesn't need comments, we're done
    if (this._isLoaded && !preserveComments) {
      return;
    }

    if (this._file === undefined) {
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (!this._file.content || this._file.content instanceof Uint8Array) {
      this._isLoaded = true;
      this._loadedWithComments = preserveComments;
      return;
    }

    // Use comment-preserving parser only when needed for editing
    const result = preserveComments
      ? StorageUtilities.getJsonObjectWithComments(this._file)
      : StorageUtilities.getJsonObject(this._file);

    if (result) {
      this._data = result;
    }

    this._isLoaded = true;
    this._loadedWithComments = preserveComments;
  }

  persist(): boolean {
    if (this._file === undefined) {
      return false;
    }

    if (!this._data) {
      return false;
    }

    return this._file.setObjectContentIfSemanticallyDifferent(this._data);
  }
}

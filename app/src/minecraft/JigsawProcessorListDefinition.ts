// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import IDefinition from "./IDefinition";
import StorageUtilities from "../storage/StorageUtilities";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import Log from "../core/Log";

export interface IJigsawProcessorRule {
  input_predicate: {
    predicate_type: string;
    block?: string;
    probability?: number;
  };
  output_state: {
    name: string;
  };
}

export interface IJigsawProcessor {
  processor_type: string;
  rules: IJigsawProcessorRule[];
}

export interface IJigsawProcessorListDefinition {
  format_version: string;
  "minecraft:processor_list": {
    description: {
      identifier: string;
    };
    processors: IJigsawProcessor[];
  };
}

export default class JigsawProcessorListDefinition implements IDefinition {
  private _file?: IFile;
  private _data?: IJigsawProcessorListDefinition;
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
    if (this._data?.["minecraft:processor_list"]?.description?.identifier) {
      return this._data["minecraft:processor_list"].description.identifier;
    }
    return "";
  }

  public get processors() {
    if (this._data?.["minecraft:processor_list"]?.processors) {
      return this._data["minecraft:processor_list"].processors;
    }
    return [];
  }

  public async getFormatVersionIsCurrent() {
    // For now, assume format version is current
    return true;
  }

  async addChildItems(project: Project, item: ProjectItem) {
    // Processor lists don't typically reference other jigsaw files directly
    // but they could reference block types, items, etc. in the future
    // For now, we'll leave this empty as processors mainly reference
    // built-in Minecraft blocks
  }

  static async ensureOnFile(file: IFile): Promise<JigsawProcessorListDefinition | undefined> {
    let jigsawProcessorList: JigsawProcessorListDefinition | undefined;

    if (file.manager === undefined) {
      jigsawProcessorList = new JigsawProcessorListDefinition();
      jigsawProcessorList.file = file;
      file.manager = jigsawProcessorList;
    }

    if (file.manager !== undefined && file.manager instanceof JigsawProcessorListDefinition) {
      jigsawProcessorList = file.manager as JigsawProcessorListDefinition;
      if (!jigsawProcessorList.isLoaded) {
        await jigsawProcessorList.load();
      }
    }

    return jigsawProcessorList;
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
      Log.unexpectedUndefined("JPLDP");
      return false;
    }

    return this._file.setObjectContentIfSemanticallyDifferent(this._data);
  }
}

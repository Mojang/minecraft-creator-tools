// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import Utilities from "../core/Utilities";
import Project from "../app/Project";
import StorageUtilities from "../storage/StorageUtilities";
import IWorldManifest, { IWorldManifestHeader } from "./IWorldManifest";
import Log from "../core/Log";

export default class WorldTemplateManifestDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;
  private _loadedWithComments: boolean = false;

  public definition?: IWorldManifest;

  private _onLoaded = new EventDispatcher<WorldTemplateManifestDefinition, WorldTemplateManifestDefinition>();

  public get isLoaded() {
    return this._isLoaded;
  }

  public get file() {
    return this._file;
  }

  public set file(newFile: IFile | undefined) {
    this._file = newFile;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public get description() {
    if (!this.definition || !this.definition.header) {
      return undefined;
    }

    return this.definition.header.description;
  }

  public set description(newDescription: string | undefined) {
    if (this.definition && this.definition.header && newDescription) {
      this.definition.header.description = newDescription;
    }
  }

  public get name() {
    if (this.definition && this.definition.header) {
      return this.definition.header.name;
    }

    return undefined;
  }

  public set name(newName: string | undefined) {
    if (this.definition && this.definition.header && newName) {
      this.definition.header.name = newName;
    }
  }

  public get uuid() {
    if (this.definition && this.definition.header) {
      return this.definition.header.uuid;
    }

    return this._id;
  }

  public set uuid(newId: string | undefined) {
    if (this.definition && this.definition.header && newId) {
      this.definition.header.uuid = newId;
    }

    this._id = newId;
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<WorldTemplateManifestDefinition, WorldTemplateManifestDefinition>
  ) {
    let bmj: WorldTemplateManifestDefinition | undefined;

    if (file.manager === undefined) {
      bmj = new WorldTemplateManifestDefinition();

      bmj.file = file;

      file.manager = bmj;
    }

    if (file.manager !== undefined && file.manager instanceof WorldTemplateManifestDefinition) {
      bmj = file.manager as WorldTemplateManifestDefinition;

      if (!bmj.isLoaded) {
        if (loadHandler) {
          bmj.onLoaded.subscribe(loadHandler);
        }

        await bmj.load();
      }
    }

    return bmj;
  }

  get baseGameVersion() {
    if (!this.definition || !this.definition.header || !this.definition.header.base_game_version) {
      return undefined;
    }

    return this.definition.header.base_game_version;
  }

  setBaseGameVersion(versionArray: number[], project: Project) {
    const header = this.ensureHeaderForProject(project);

    header.base_game_version = versionArray;
  }

  persist(): boolean {
    if (this._file === undefined) {
      return false;
    }

    if (!this.definition) {
      Log.unexpectedUndefined("WTMDF");
      return false;
    }

    return this._file.setObjectContentIfSemanticallyDifferent(this.definition);
  }

  public ensureDefinition(name: string, description: string) {
    if (!this.definition) {
      this.definition = {
        format_version: 2,

        header: {
          name: name,
          description: description,
          version: [0, 0, 1],
          base_game_version: [1, 20, 10],
          uuid: Utilities.createUuid(),
        },
        modules: [],
      };
    }
  }

  public ensureHeaderForProject(project: Project): IWorldManifestHeader {
    return this.ensureHeader(project.title, project.description);
  }

  public ensureHeader(name: string, description: string): IWorldManifestHeader {
    this.ensureDefinition(name, description);

    if (!this.definition) {
      throw new Error();
    }

    if (!this.definition.header) {
      this.definition.header = this.getDefaultHeader(name, description);
    }

    return this.definition.header;
  }

  public getDefaultHeader(name: string, description: string) {
    return {
      name: name,
      description: description,
      version: [0, 0, 1],
      min_engine_version: [1, 20, 10],
      uuid: Utilities.createUuid(),
      base_game_version: [1, 20, 10],
    };
  }

  async save() {
    if (this._file === undefined) {
      return;
    }

    if (this.persist()) {
      await this._file.saveContent(false);
    }
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

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      this._isLoaded = true;
      this._loadedWithComments = preserveComments;
      this._onLoaded.dispatch(this, this);
      return;
    }

    this.uuid = this._file.name;

    // Use comment-preserving parser only when needed for editing
    this.definition = preserveComments
      ? StorageUtilities.getJsonObjectWithComments(this._file)
      : StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
    this._loadedWithComments = preserveComments;
    this._onLoaded.dispatch(this, this);
  }
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import IDefinition from "./IDefinition";
import ProjectItemManager from "../app/ProjectItemManager";
import Project from "../app/Project";

export default class AudioFileDefinition implements IDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<AudioFileDefinition, AudioFileDefinition>();

  public get isLoaded() {
    return this._isLoaded;
  }

  public get file() {
    return this._file;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public set file(newFile: IFile | undefined) {
    this._file = newFile;
  }

  public get id() {
    if (this._file) {
      return this._file.name;
    }

    return this._id;
  }

  public set id(newId: string | undefined) {
    this._id = newId;
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<AudioFileDefinition, AudioFileDefinition>) {
    let afd: AudioFileDefinition | undefined;

    if (file.manager === undefined) {
      afd = new AudioFileDefinition();

      afd.file = file;

      file.manager = afd;
    }

    if (file.manager !== undefined && file.manager instanceof AudioFileDefinition) {
      afd = file.manager as AudioFileDefinition;

      if (!afd.isLoaded && loadHandler) {
        afd.onLoaded.subscribe(loadHandler);
      }

      await afd.load();
    }

    return afd;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }
  }

  async ensureSoundDefinitionsForFile(project: Project) {
    if (!this._file) {
      return;
    }

    let soundDefinitionCat = await ProjectItemManager.ensureSoundDefinitionCatalogDefinition(project);

    if (this._file && soundDefinitionCat) {
      let matches = soundDefinitionCat.getSoundDefinitionMatchesByPath(this._file);

      if (matches) {
        let keyCount = 0;

        for (const key in matches) {
          if (key) {
            keyCount++;
          }
        }

        if (keyCount === 0) {
          soundDefinitionCat.ensureDefintionForFile(project, this._file);
        }
      }

      soundDefinitionCat.persist();
    }
  }

  async load() {
    if (this._file === undefined || this._isLoaded) {
      return;
    }

    await this._file.loadContent();

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this._isLoaded = true;
  }
}

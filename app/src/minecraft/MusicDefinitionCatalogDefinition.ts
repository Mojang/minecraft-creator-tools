// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IMusicDefinitionCatalog } from "./IMusicDefinitionCatalog";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import SoundDefinitionCatalogDefinition from "./SoundDefinitionCatalogDefinition";
import Database from "./Database";
import IDefinition from "./IDefinition";

export default class MusicDefinitionCatalogDefinition implements IDefinition {
  private _data?: IMusicDefinitionCatalog;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<MusicDefinitionCatalogDefinition, MusicDefinitionCatalogDefinition>();

  public id: string | undefined;

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

  public get musicDefinitionNameList() {
    if (!this._data) {
      return undefined;
    }

    const musicDefNameList = [];

    for (const key in this._data) {
      musicDefNameList.push(key);
    }

    return musicDefNameList;
  }

  public get musicDefinitionEventNameList() {
    if (!this._data) {
      return undefined;
    }

    const musicDefNameList: string[] = [];

    for (const key in this._data) {
      const def = this._data[key];

      if (def && def.event_name) {
        if (!musicDefNameList.includes(def.event_name)) {
          musicDefNameList.push(def.event_name);
        }
      }
    }

    return musicDefNameList;
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<MusicDefinitionCatalogDefinition, MusicDefinitionCatalogDefinition>
  ) {
    let et: MusicDefinitionCatalogDefinition | undefined;

    if (file.manager === undefined) {
      et = new MusicDefinitionCatalogDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof MusicDefinitionCatalogDefinition) {
      et = file.manager as MusicDefinitionCatalogDefinition;

      if (!et.isLoaded && loadHandler) {
        et.onLoaded.subscribe(loadHandler);
      }

      await et.load();
    }

    return et;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    if (!this._data) {
      Log.unexpectedUndefined("MUSP");
      return;
    }

    const defString = JSON.stringify(this._data, null, 2);

    this._file.setContent(defString);
  }

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      Log.unexpectedUndefined("TTCDF");
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (!this._file.content || this._file.content instanceof Uint8Array) {
      return;
    }

    let data: any = {};

    let result = StorageUtilities.getJsonObject(this._file);

    if (result) {
      data = result;
    }

    this._data = data;

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }

  async addChildItems(project: Project, item: ProjectItem) {
    const itemsCopy = project.getItemsCopy();

    let musicDefList = this.musicDefinitionEventNameList;

    for (const candItem of itemsCopy) {
      if (candItem.itemType === ProjectItemType.soundDefinitionCatalog && musicDefList) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile) {
          const soundDef = await SoundDefinitionCatalogDefinition.ensureOnFile(candItem.primaryFile);

          const soundSetNames = soundDef?.getSoundDefinitionSetNameList();
          if (soundSetNames) {
            for (const musicDefName of musicDefList) {
              if (soundSetNames.includes(musicDefName)) {
                item.addChildItem(candItem);

                const nextMusicDefNames: string[] = [];

                for (const texturePath of musicDefList) {
                  if (texturePath !== musicDefName) {
                    nextMusicDefNames.push(texturePath);
                  }
                }

                musicDefList = nextMusicDefNames;
              }
            }
          }
        }
      }
    }

    if (musicDefList) {
      for (const musicDef of musicDefList) {
        item.addUnfulfilledRelationship(
          musicDef,
          ProjectItemType.soundDefinitionCatalog,
          await Database.isVanillaToken(musicDef)
        );
      }
    }
  }
}

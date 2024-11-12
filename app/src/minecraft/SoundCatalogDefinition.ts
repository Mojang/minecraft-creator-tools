// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { ISoundCatalog } from "./ISoundCatalog";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import SoundDefinitionCatalogDefinition from "./SoundDefinitionCatalogDefinition";
import Database from "./Database";
import EntityTypeResourceDefinition from "./EntityTypeResourceDefinition";
import Utilities from "../core/Utilities";
import MinecraftDefinitions from "./MinecraftDefinitions";
import EntityTypeDefinition from "./EntityTypeDefinition";

export default class SoundCatalogDefinition {
  private _data?: ISoundCatalog;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<SoundCatalogDefinition, SoundCatalogDefinition>();

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

  public get entityIdList() {
    if (!this._data) {
      return undefined;
    }

    const entityIdList: string[] = [];

    if (this._data.entity_sounds && this._data.entity_sounds.entities) {
      for (const key in this._data.entity_sounds.entities) {
        if (!entityIdList.includes(key)) {
          entityIdList.push(key);
        }
      }
    }

    return entityIdList;
  }

  public get soundEventNameList() {
    if (!this._data) {
      return undefined;
    }

    const soundEventNameList: string[] = [];

    if (this._data.entity_sounds && this._data.entity_sounds.entities) {
      for (const key in this._data.entity_sounds.entities) {
        const def = this._data.entity_sounds.entities[key];

        if (def && def.events) {
          for (const eventKey in def.events) {
            const event = def.events[eventKey];

            if (event) {
              for (const eventInstanceKey in def.events) {
                const eventInstance = def.events[eventInstanceKey];

                if (typeof eventInstance === "string") {
                  if (!soundEventNameList.includes(eventInstance)) {
                    soundEventNameList.push(eventInstance);
                  }
                } else if (eventInstance.sound) {
                  if (!soundEventNameList.includes(eventInstance.sound)) {
                    soundEventNameList.push(eventInstance.sound);
                  }
                }
              }
            }
          }
        }
      }
    }

    if (this._data.entity_sounds && this._data.entity_sounds.defaults && this._data.entity_sounds.defaults.events) {
      for (const eventKey in this._data.entity_sounds.defaults.events) {
        const eventInstance = this._data.entity_sounds.defaults.events[eventKey];

        if (typeof eventInstance === "string") {
          if (!soundEventNameList.includes(eventInstance)) {
            soundEventNameList.push(eventInstance);
          }
        } else if (eventInstance.sound) {
          if (!soundEventNameList.includes(eventInstance.sound)) {
            soundEventNameList.push(eventInstance.sound);
          }
        }
      }
    }

    if (this._data.block_sounds) {
      for (const key in this._data.block_sounds) {
        const def = this._data.block_sounds[key];

        if (def && def.events) {
          for (const eventKey in def.events) {
            const event = def.events[eventKey];

            if (event) {
              for (const eventInstanceKey in def.events) {
                const eventInstance = def.events[eventInstanceKey];

                if (typeof eventInstance === "string") {
                  if (!soundEventNameList.includes(eventInstance)) {
                    soundEventNameList.push(eventInstance);
                  }
                } else if (eventInstance.sound) {
                  if (!soundEventNameList.includes(eventInstance.sound)) {
                    soundEventNameList.push(eventInstance.sound);
                  }
                }
              }
            }
          }
        }
      }
    }

    if (this._data.individual_event_sounds && this._data.individual_event_sounds.events) {
      for (const key in this._data.individual_event_sounds.events) {
        const eventInstance = this._data.individual_event_sounds.events[key];

        if (typeof eventInstance === "string") {
          if (!soundEventNameList.includes(eventInstance)) {
            soundEventNameList.push(eventInstance);
          }
        } else if (eventInstance.sound) {
          if (!soundEventNameList.includes(eventInstance.sound)) {
            soundEventNameList.push(eventInstance.sound);
          }
        }
      }
    }

    return soundEventNameList;
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<SoundCatalogDefinition, SoundCatalogDefinition>) {
    let et: SoundCatalogDefinition | undefined;

    if (file.manager === undefined) {
      et = new SoundCatalogDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof SoundCatalogDefinition) {
      et = file.manager as SoundCatalogDefinition;

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

    await this._file.loadContent();

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

    let soundEventList = this.soundEventNameList;
    let entityIdList = this.entityIdList;

    for (const candItem of itemsCopy) {
      if (
        (candItem.itemType === ProjectItemType.entityTypeResource ||
          candItem.itemType === ProjectItemType.entityTypeBehavior) &&
        entityIdList
      ) {
        const entityDef = (await MinecraftDefinitions.get(candItem)) as
          | undefined
          | EntityTypeResourceDefinition
          | EntityTypeDefinition;

        if (entityDef && entityDef.id && entityIdList?.includes(entityDef?.id)) {
          item.addChildItem(candItem);

          entityIdList = Utilities.removeItemInArray(entityDef.id, entityIdList);
        }
      } else if (candItem.itemType === ProjectItemType.soundDefinitionCatalog && soundEventList) {
        await candItem.ensureStorage();

        if (candItem.file) {
          const soundDef = await SoundDefinitionCatalogDefinition.ensureOnFile(candItem.file);

          const soundSetNames = soundDef?.soundDefinitionSetNameList;
          if (soundSetNames) {
            for (const soundEventName of soundEventList) {
              if (soundSetNames.includes(soundEventName)) {
                item.addChildItem(candItem);

                soundEventList = Utilities.removeItemInArray(soundEventName, soundEventList);
              }
            }
          }
        }
      }
    }

    if (soundEventList) {
      for (const soundEvent of soundEventList) {
        item.addUnfulfilledRelationship(
          soundEvent,
          ProjectItemType.soundDefinitionCatalog,
          await Database.isVanillaToken(soundEvent)
        );
      }
    }

    if (entityIdList) {
      for (const entityId of entityIdList) {
        item.addUnfulfilledRelationship(
          entityId,
          ProjectItemType.entityTypeBehavior,
          await Database.isVanillaToken(entityId)
        );
      }
    }
  }
}

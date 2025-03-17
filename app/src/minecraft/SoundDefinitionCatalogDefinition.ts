// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { ISoundReference, ISoundDefinitionCatalog, ISoundDefinition } from "./ISoundDefinitionCatalog";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import Database from "./Database";
import IFolder from "../storage/IFolder";
import Utilities from "../core/Utilities";
import AudioDefinition from "./AudioDefinition";

export default class SoundDefinitionCatalogDefinition {
  public _data?: ISoundDefinitionCatalog;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  public id: string | undefined;

  private _onLoaded = new EventDispatcher<SoundDefinitionCatalogDefinition, SoundDefinitionCatalogDefinition>();

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

  public getSoundDefinitionSoundInstanceList() {
    if (!this._data) {
      return undefined;
    }

    const soundList = [];

    if (this._data.sound_definitions) {
      for (const key in this._data.sound_definitions) {
        const soundDefSet = this._data.sound_definitions[key];

        for (const sound of soundDefSet.sounds) {
          soundList.push(sound);
        }
      }
    } else {
      for (const key in this._data) {
        if (key !== "format_version" && key !== "sound_definitions") {
          const soundDefSet = (this._data as any)[key] as ISoundDefinition;

          if (soundDefSet && soundDefSet.sounds && Array.isArray(soundDefSet.sounds)) {
            for (const sound of soundDefSet.sounds) {
              soundList.push(sound);
            }
          }
        }
      }
    }

    return soundList;
  }

  public getCanonincalizedSoundPathList() {
    if (!this._data) {
      return undefined;
    }

    const soundList: string[] = [];

    if (this._data.sound_definitions) {
      for (const key in this._data.sound_definitions) {
        const soundDefSet = this._data.sound_definitions[key];

        for (const sound of soundDefSet.sounds) {
          if (typeof sound === "string") {
            let path = AudioDefinition.canonicalizeAudioPath(sound);

            if (path) {
              soundList.push(path);
            }
          } else if (typeof sound.name === "string") {
            let path = AudioDefinition.canonicalizeAudioPath(sound.name);

            if (path) {
              soundList.push(path);
            }
          }
        }
      }
    } else {
      for (const key in this._data) {
        if (key !== "format_version" && key !== "sound_definitions") {
          const soundDefSet = (this._data as any)[key] as ISoundDefinition;

          if (soundDefSet && soundDefSet.sounds && Array.isArray(soundDefSet.sounds)) {
            for (const sound of soundDefSet.sounds) {
              if (typeof sound === "string") {
                let path = AudioDefinition.canonicalizeAudioPath(sound);

                if (path) {
                  soundList.push(path);
                }
              } else if (typeof sound.name === "string") {
                let path = AudioDefinition.canonicalizeAudioPath(sound.name);

                if (path) {
                  soundList.push(path);
                }
              }
            }
          }
        }
      }
    }

    return soundList;
  }

  public get soundDefinitionPathList() {
    if (!this._data || !this._data.sound_definitions) {
      return undefined;
    }

    const soundDefPathList = [];

    for (const key in this._data.sound_definitions) {
      const soundDefSet = this._data.sound_definitions[key];

      for (const sound of soundDefSet.sounds) {
        if (typeof sound === "string") {
          soundDefPathList.push(sound);
        } else {
          soundDefPathList.push(sound.name);
        }
      }
    }

    return soundDefPathList;
  }

  public getSoundDefinitionSetNameList() {
    if (!this._data || !this._data.sound_definitions) {
      return undefined;
    }

    const soundDefSetNameList = [];

    for (const key in this._data.sound_definitions) {
      soundDefSetNameList.push(key);
    }

    // this seems like a legacy mode?
    for (const key in this._data) {
      if (key !== "sound_definitions" && key !== "format_version") {
        soundDefSetNameList.push(key);
      }
    }

    return soundDefSetNameList;
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<SoundDefinitionCatalogDefinition, SoundDefinitionCatalogDefinition>
  ) {
    let et: SoundDefinitionCatalogDefinition | undefined;

    if (file.manager === undefined) {
      et = new SoundDefinitionCatalogDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof SoundDefinitionCatalogDefinition) {
      et = file.manager as SoundDefinitionCatalogDefinition;

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

  async deleteLinkToChild(childItem: ProjectItem) {
    let packRootFolder = this.getPackRootFolder();

    if (this._data === undefined) {
      await this.load();
    }

    if (childItem.itemType === ProjectItemType.texture && this._data && this._data.sound_definitions) {
      await childItem.ensureStorage();

      if (childItem.file && packRootFolder) {
        let relativePath = this.getRelativePath(childItem.file, packRootFolder);

        if (relativePath) {
          for (const key in this._data.sound_definitions) {
            const soundDef = this._data.sound_definitions[key];

            for (const sound of soundDef.sounds) {
              if (typeof sound === "string") {
                if (sound === relativePath) {
                  soundDef.sounds = Utilities.removeItemInArray(sound, soundDef.sounds);
                }
              } else if (sound.name === relativePath) {
                soundDef.sounds = Utilities.removeItemInArray(sound, soundDef.sounds);
              }
            }
          }
        }
      }
    }

    this.persist();
  }

  getPackRootFolder() {
    let packRootFolder = undefined;
    if (this.file && this.file.parentFolder) {
      let parentFolder = this.file.parentFolder;

      packRootFolder = StorageUtilities.getParentOfParentFolderNamed("sounds", parentFolder);
    }

    return packRootFolder;
  }

  getRelativePath(file: IFile, packRootFolder: IFolder) {
    let relativePath = file.getFolderRelativePath(packRootFolder);

    if (relativePath) {
      relativePath = StorageUtilities.ensureNotStartsWithDelimiter(relativePath);
    }

    relativePath = AudioDefinition.canonicalizeAudioPath(relativePath);

    return relativePath;
  }

  ensureDefintionForFile(project: Project, file: IFile) {
    let packRootFolder = this.getPackRootFolder();

    if (!packRootFolder || !this._data) {
      return;
    }

    let relativePath = this.getRelativePath(file, packRootFolder);

    if (!relativePath) {
      return;
    }

    const soundDefName = StorageUtilities.getBaseFromName(file.name).toLowerCase();

    let soundDef: ISoundDefinition | undefined = this._data.sound_definitions[soundDefName];

    if (!soundDef) {
      soundDef = {
        category: "neutral",
        sounds: [],
      };

      this._data.sound_definitions[soundDefName] = soundDef;
    }

    if (soundDef && !this.hasSoundByPath(soundDef, relativePath)) {
      soundDef.sounds.push({
        is3D: false,
        name: relativePath,
        volume: 1,
        weight: 10,
      });
    }
  }

  hasSoundByPath(soundDefSet: ISoundDefinition, path: string) {
    for (const sound of soundDefSet.sounds) {
      if (typeof sound === "string" && sound === path) {
        return sound;
      } else if (typeof sound !== "string" && sound.name === path) {
        return sound;
      }
    }

    return undefined;
  }

  getSoundReferenceMatchesByPath(file: IFile) {
    let packRootFolder = this.getPackRootFolder();
    if (!packRootFolder) {
      return;
    }

    let relativePath = this.getRelativePath(file, packRootFolder);

    const retSoundRefs: { [name: string]: ISoundReference[] } = {};

    if (relativePath && this._data) {
      const keys = this.getSoundDefinitionSetNameList();

      for (const key in keys) {
        let soundDefSet = this._data.sound_definitions[key];

        if (!soundDefSet) {
          soundDefSet = (this._data as any)[key];
        }

        if (soundDefSet && soundDefSet.sounds) {
          for (const soundInstance of soundDefSet.sounds) {
            if (typeof soundInstance === "string") {
              if (StorageUtilities.isPathEqual(soundInstance, relativePath)) {
                if (!retSoundRefs[key]) {
                  retSoundRefs[key] = [];
                }
                retSoundRefs[key].push({ name: soundInstance });
              }
            } else if (StorageUtilities.isPathEqual(soundInstance.name, relativePath)) {
              if (!retSoundRefs[key]) {
                retSoundRefs[key] = [];
              }
              retSoundRefs[key].push(soundInstance);
            }
          }
        }
      }
    }

    return retSoundRefs;
  }

  getSoundDefinitionMatchesByPath(file: IFile) {
    let packRootFolder = this.getPackRootFolder();
    if (!packRootFolder) {
      return;
    }

    let relativePath = this.getRelativePath(file, packRootFolder);

    const retSoundDefs: { [name: string]: ISoundDefinition } = {};

    if (relativePath && this._data) {
      for (const key in this._data.sound_definitions) {
        const soundDefSet = this._data.sound_definitions[key];

        if (soundDefSet && soundDefSet.sounds) {
          for (const soundInstance of soundDefSet.sounds) {
            if (typeof soundInstance === "string") {
              if (StorageUtilities.isPathEqual(soundInstance, relativePath)) {
                retSoundDefs[key] = soundDefSet;
              }
            } else if (StorageUtilities.isPathEqual(soundInstance.name, relativePath)) {
              retSoundDefs[key] = soundDefSet;
            }
          }
        }
      }
    }

    return retSoundDefs;
  }

  async addChildItems(project: Project, item: ProjectItem) {
    const itemsCopy = project.getItemsCopy();

    let packRootFolder = this.getPackRootFolder();

    let soundPathList = this.getCanonincalizedSoundPathList();

    for (const candItem of itemsCopy) {
      if (candItem.itemType === ProjectItemType.audio && packRootFolder && soundPathList) {
        await candItem.ensureStorage();

        if (candItem.file) {
          let relativePath = this.getRelativePath(candItem.file, packRootFolder);

          if (relativePath) {
            if (soundPathList.includes(relativePath)) {
              item.addChildItem(candItem);

              const nextSound: string[] = [];

              for (const sound of soundPathList) {
                if (sound !== relativePath) {
                  nextSound.push(sound);
                }
              }

              soundPathList = nextSound;
            }
          }
        }
      }
    }

    if (soundPathList) {
      for (const soundDef of soundPathList) {
        const isVanilla = await Database.isVanillaToken(soundDef);
        item.addUnfulfilledRelationship(soundDef, ProjectItemType.audio, isVanilla);
      }
    }
  }
}

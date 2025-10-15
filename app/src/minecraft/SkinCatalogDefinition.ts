// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import Utilities from "../core/Utilities";
import TextureDefinition from "./TextureDefinition";
import ISkinCatalog from "./ISkinCatalog";

export default class SkinCatalogDefinition {
  private _file?: IFile;
  private _isLoaded: boolean = false;
  private _data?: ISkinCatalog;

  private _onLoaded = new EventDispatcher<SkinCatalogDefinition, SkinCatalogDefinition>();

  public get isLoaded() {
    return this._isLoaded;
  }

  public get data() {
    return this._data;
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
    if (!this._data) {
      return undefined;
    }

    return this._data.serialize_name;
  }

  public get skins() {
    if (!this._data) {
      return undefined;
    }

    if (this._data.skins === undefined) {
      this._data.skins = [];
    }

    return this._data.skins;
  }

  public getCanonicalizedTexturesList() {
    if (!this._data || !this._data.skins || !Array.isArray(this._data.skins)) {
      return undefined;
    }

    const textureList = [];

    for (const skin of this._data.skins) {
      if (skin.texture) {
        const texturePath = TextureDefinition.canonicalizeTexturePath(skin.texture);

        if (texturePath) {
          textureList.push(texturePath);
        }
      }
    }

    return textureList;
  }

  public get skinNameList() {
    if (!this._data || !this._data.skins || !Array.isArray(this._data.skins)) {
      return undefined;
    }

    const skinNameList = [];

    for (const skin of this._data.skins) {
      if (skin.localization_name) {
        skinNameList.push(skin.localization_name);
      }
    }

    return skinNameList;
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<SkinCatalogDefinition, SkinCatalogDefinition>) {
    let et: SkinCatalogDefinition | undefined;

    if (file.manager === undefined) {
      et = new SkinCatalogDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof SkinCatalogDefinition) {
      et = file.manager as SkinCatalogDefinition;

      if (!et.isLoaded) {
        if (loadHandler) {
          et.onLoaded.subscribe(loadHandler);
        }

        await et.load();
      }
    }

    return et;
  }

  ensureData() {
    if (this._data) {
      return this._data;
    }

    this._data = {
      skins: [],
    };

    return this._data;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    if (!this._data) {
      Log.unexpectedUndefined("SKCDP");
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
      Log.unexpectedUndefined("SSDL");
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

    const pack = await item.getPack();

    if (!pack) {
      return;
    }

    let packRootFolder = pack.folder;

    let textureList = this.getCanonicalizedTexturesList();

    for (const candItem of itemsCopy) {
      if (candItem.itemType === ProjectItemType.texture && packRootFolder && textureList) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile) {
          let relativePath = TextureDefinition.canonicalizeTexturePath(
            StorageUtilities.getBaseRelativePath(candItem.primaryFile, packRootFolder)
          );

          if (relativePath) {
            if (textureList && textureList.includes(relativePath)) {
              item.addChildItem(candItem);

              textureList = Utilities.removeItemInArray(relativePath, textureList);
            }
          }
        }
      }
    }

    if (textureList) {
      for (const texturePath of textureList) {
        item.addUnfulfilledRelationship(texturePath, ProjectItemType.texture, false);
      }
    }
  }
}

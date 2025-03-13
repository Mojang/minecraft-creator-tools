// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IItemTexture } from "./IItemTexture";
import IFolder from "../storage/IFolder";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import Utilities from "../core/Utilities";
import Database from "./Database";
import TextureDefinition from "./TextureDefinition";

export default class ItemTextureCatalogDefinition {
  private _data?: IItemTexture;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<ItemTextureCatalogDefinition, ItemTextureCatalogDefinition>();

  public get isLoaded() {
    return this._isLoaded;
  }

  public get file() {
    return this._file;
  }

  public get data() {
    return this._data;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public set file(newFile: IFile | undefined) {
    this._file = newFile;
  }

  public get textureData() {
    if (!this._data) {
      return undefined;
    }

    if (this._data.texture_data === undefined) {
      this._data.texture_data = {};
    }

    return this._data.texture_data;
  }

  public getCanonicalizedTexturePathList() {
    if (!this._data || !this._data.texture_data) {
      return undefined;
    }

    const textureList = [];

    for (const key in this._data.texture_data) {
      const texturePathArr = this._data.texture_data[key];

      if (texturePathArr && texturePathArr.textures) {
        if (typeof texturePathArr.textures === "string") {
          const path = TextureDefinition.canonicalizeTexturePath(texturePathArr.textures);
          if (path) {
            textureList.push(path);
          }
        } else if (Array.isArray(texturePathArr)) {
          for (const texturePath of texturePathArr.textures) {
            const path = TextureDefinition.canonicalizeTexturePath(texturePath);
            if (path) {
              textureList.push(path);
            }
          }
        }
      }
    }

    return textureList;
  }

  public getTexturePathList() {
    if (!this._data || !this._data.texture_data) {
      return undefined;
    }

    const textureList = [];

    for (const key in this._data.texture_data) {
      const texturePathArr = this._data.texture_data[key];

      if (texturePathArr && texturePathArr.textures) {
        if (typeof texturePathArr.textures === "string") {
          textureList.push(texturePathArr.textures);
        } else if (Array.isArray(texturePathArr)) {
          for (const texturePath of texturePathArr.textures) {
            textureList.push(texturePath);
          }
        }
      }
    }

    return textureList;
  }

  public get texturesIdList() {
    if (!this._data || !this._data.texture_data) {
      return undefined;
    }

    const textureIdList = [];

    for (const key in this._data.texture_data) {
      textureIdList.push(key);
    }

    return textureIdList;
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<ItemTextureCatalogDefinition, ItemTextureCatalogDefinition>
  ) {
    let et: ItemTextureCatalogDefinition | undefined;

    if (file.manager === undefined) {
      et = new ItemTextureCatalogDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof ItemTextureCatalogDefinition) {
      et = file.manager as ItemTextureCatalogDefinition;

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

  getPackRootFolder() {
    let packRootFolder = undefined;
    if (this.file && this.file.parentFolder) {
      let parentFolder = this.file.parentFolder;

      packRootFolder = StorageUtilities.getParentOfParentFolderNamed("textures", parentFolder);
    }

    return packRootFolder;
  }

  getTextureReferences() {
    const textureRefs: string[] = [];
    if (this.data?.texture_data) {
      for (const resourceId in this.data.texture_data) {
        const resource = this.data.texture_data[resourceId];

        if (resource && resource.textures) {
          if (!textureRefs.includes(resourceId)) {
            textureRefs.push(resourceId);
          }
        }
      }
    }

    return textureRefs;
  }

  getRelativePath(file: IFile, packRootFolder: IFolder) {
    let relativePath = file.getFolderRelativePath(packRootFolder);

    if (relativePath) {
      const lastPeriod = relativePath?.lastIndexOf(".");
      if (lastPeriod >= 0) {
        relativePath = relativePath?.substring(0, lastPeriod).toLowerCase();
      }

      relativePath = StorageUtilities.ensureNotStartsWithDelimiter(relativePath);
    }

    return relativePath;
  }

  async addChildItems(project: Project, item: ProjectItem) {
    const itemsCopy = project.getItemsCopy();

    let packRootFolder = this.getPackRootFolder();

    let texturePathList = this.getCanonicalizedTexturePathList();

    for (const candItem of itemsCopy) {
      if (candItem.itemType === ProjectItemType.texture && packRootFolder && texturePathList) {
        await candItem.ensureStorage();

        if (candItem.file) {
          let relativePath = TextureDefinition.canonicalizeTexturePath(
            this.getRelativePath(candItem.file, packRootFolder)
          );

          if (relativePath) {
            if (texturePathList && texturePathList.includes(relativePath)) {
              item.addChildItem(candItem);

              texturePathList = Utilities.removeItemInArray(relativePath, texturePathList);
            }
          }
        }
      }
    }

    if (texturePathList) {
      for (const texturePath of texturePathList) {
        item.addUnfulfilledRelationship(
          texturePath,
          ProjectItemType.texture,
          await Database.isVanillaToken(texturePath)
        );
      }
    }
  }

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      Log.unexpectedUndefined("ITCDF");
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
}

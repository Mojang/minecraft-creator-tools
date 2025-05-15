// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { ITerrainTextureCatalog } from "./ITerrainTextureCatalog";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import Utilities from "../core/Utilities";
import Database from "./Database";
import IFolder from "../storage/IFolder";
import IDefinition from "./IDefinition";

export default class TerrainTextureCatalogDefinition implements IDefinition {
  private _data?: ITerrainTextureCatalog;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  public id: string | undefined;

  private _onLoaded = new EventDispatcher<TerrainTextureCatalogDefinition, TerrainTextureCatalogDefinition>();

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

  public get textureData() {
    if (!this._data) {
      return undefined;
    }

    if (this._data.texture_data === undefined) {
      this._data.texture_data = {};
    }

    return this._data.texture_data;
  }

  public get texturePathList() {
    if (!this._data || !this._data.texture_data) {
      return undefined;
    }

    const textureList = [];

    for (const key in this._data.texture_data) {
      const texturePathArr = this._data.texture_data[key];

      if (texturePathArr && texturePathArr.textures) {
        if (typeof texturePathArr.textures === "string") {
          textureList.push(texturePathArr.textures.toLowerCase());
        } else if (Array.isArray(texturePathArr)) {
          for (const texturePath of texturePathArr.textures) {
            if (typeof texturePath === "string") {
              textureList.push(texturePath.toLowerCase());
            } else if (texturePath.path) {
              textureList.push(texturePath.path.toLowerCase());
            }
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
    loadHandler?: IEventHandler<TerrainTextureCatalogDefinition, TerrainTextureCatalogDefinition>
  ) {
    let et: TerrainTextureCatalogDefinition | undefined;

    if (file.manager === undefined) {
      et = new TerrainTextureCatalogDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof TerrainTextureCatalogDefinition) {
      et = file.manager as TerrainTextureCatalogDefinition;

      if (!et.isLoaded && loadHandler) {
        et.onLoaded.subscribe(loadHandler);
      }

      await et.load();
    }

    return et;
  }

  getAllTexturePaths(textureId: string) {
    if (!this.data || !this.data.texture_data) {
      return undefined;
    }

    const elt = this.data.texture_data[textureId];

    if (!elt) {
      return undefined;
    }

    if (typeof elt.textures === "string") {
      return [elt.textures];
    } else if (Array.isArray(elt.textures) && elt.textures.length > 0) {
      const texturePaths: string[] = [];

      for (const tex of elt.textures) {
        if (typeof tex === "string") {
          texturePaths.push(tex);
        } else if (tex.path) {
          texturePaths.push(tex.path);
        }
      }

      return texturePaths;
    }

    return undefined;
  }

  getTexture(textureId: string) {
    if (!this.data || !this.data.texture_data) {
      return undefined;
    }

    return this.data.texture_data[textureId];
  }

  getDefaultTexturePath(textureId: string) {
    if (!this.data || !this.data.texture_data) {
      return undefined;
    }

    const elt = this.data.texture_data[textureId];

    if (!elt) {
      return undefined;
    }

    if (typeof elt.textures === "string") {
      return elt.textures;
    } else if (Array.isArray(elt.textures) && elt.textures.length > 0) {
      if (typeof elt.textures[0] === "string") {
        return elt.textures[0];
      } else if (elt.textures[0].path) {
        return elt.textures[0].path;
      }
    }

    return undefined;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const defString = JSON.stringify(this._data, null, 2);

    this._file.setContent(defString);
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

  getPackRootFolder() {
    let packRootFolder = undefined;
    if (this.file && this.file.parentFolder) {
      let parentFolder = this.file.parentFolder;

      packRootFolder = StorageUtilities.getParentOfParentFolderNamed("textures", parentFolder);
    }

    return packRootFolder;
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

    let texturePathList = this.texturePathList;

    for (const candItem of itemsCopy) {
      if (candItem.itemType === ProjectItemType.texture && packRootFolder && texturePathList) {
        await candItem.ensureStorage();

        if (candItem.primaryFile) {
          let relativePath = this.getRelativePath(candItem.primaryFile, packRootFolder);

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
}

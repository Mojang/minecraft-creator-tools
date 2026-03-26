// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IItemTexture, IItemTextureNode } from "./IItemTexture";
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
  private _loadedWithComments: boolean = false;

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
        } else if (Array.isArray(texturePathArr.textures)) {
          for (const texturePath of texturePathArr.textures) {
            if (typeof texturePath === "string") {
              const path = TextureDefinition.canonicalizeTexturePath(texturePath);
              if (path) {
                textureList.push(path);
              }
            } else if (texturePath) {
              let tpath: string | undefined = (texturePath as IItemTextureNode).path;
              if (typeof tpath === "string") {
                tpath = TextureDefinition.canonicalizeTexturePath(tpath);
                if (tpath) {
                  textureList.push(tpath);
                }
              }
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
        } else if (Array.isArray(texturePathArr.textures)) {
          for (const texturePath of texturePathArr.textures) {
            if (typeof texturePath === "string") {
              const path = TextureDefinition.canonicalizeTexturePath(texturePath);
              if (path) {
                textureList.push(path);
              }
            } else if (texturePath) {
              let tpath: string | undefined = (texturePath as IItemTextureNode).path;
              if (typeof tpath === "string") {
                tpath = TextureDefinition.canonicalizeTexturePath(tpath);
                if (tpath) {
                  textureList.push(tpath);
                }
              }
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

      if (!et.isLoaded) {
        if (loadHandler) {
          et.onLoaded.subscribe(loadHandler);
        }

        await et.load();
      }
    }

    return et;
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

  async addChildItems(project: Project, item: ProjectItem) {
    const textureItems = project.getItemsByType(ProjectItemType.texture);

    let packRootFolder = this.getPackRootFolder();

    let texturePathList = this.getCanonicalizedTexturePathList();

    for (const candItem of textureItems) {
      if (packRootFolder && texturePathList) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile) {
          let relativePath = TextureDefinition.canonicalizeTexturePath(
            StorageUtilities.getBaseRelativePath(candItem.primaryFile, packRootFolder)
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
      Log.unexpectedUndefined("ITCDF");
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (!this._file.content || this._file.content instanceof Uint8Array) {
      this._isLoaded = true;
      this._loadedWithComments = preserveComments;
      this._onLoaded.dispatch(this, this);
      return;
    }

    let data: any = {};

    // Use comment-preserving parser only when needed for editing
    let result = preserveComments
      ? StorageUtilities.getJsonObjectWithComments(this._file)
      : StorageUtilities.getJsonObject(this._file);

    if (result) {
      data = result;
    }

    this._data = data;

    this._isLoaded = true;
    this._loadedWithComments = preserveComments;

    this._onLoaded.dispatch(this, this);
  }
}

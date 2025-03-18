// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IFlipbookTexture } from "./IFlipbookTexture";
import { ProjectItemType } from "../app/IProjectItemData";
import Utilities from "../core/Utilities";
import Database from "./Database";
import IProjectItemRelationship from "../app/IProjectItemRelationship";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import IFolder from "../storage/IFolder";
import IDefinition from "./IDefinition";

export default class FlipbookTextureCatalogDefinition implements IDefinition {
  private _data?: IFlipbookTexture[];
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<FlipbookTextureCatalogDefinition, FlipbookTextureCatalogDefinition>();

  public id: string | undefined;

  public get data() {
    return this._data;
  }

  public get texturesList() {
    if (!this._data) {
      return undefined;
    }

    const textureList = [];

    for (const flipbookTexture of this._data) {
      const texturePath = flipbookTexture.flipbook_texture;

      if (texturePath) {
        textureList.push(texturePath.toLowerCase());
      }
    }

    return textureList;
  }

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

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<FlipbookTextureCatalogDefinition, FlipbookTextureCatalogDefinition>
  ) {
    let et: FlipbookTextureCatalogDefinition | undefined;

    if (file.manager === undefined) {
      et = new FlipbookTextureCatalogDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof FlipbookTextureCatalogDefinition) {
      et = file.manager as FlipbookTextureCatalogDefinition;

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
      Log.unexpectedUndefined("FBTCDF");
      return;
    }

    await this._file.loadContent();

    if (!this._file.content || this._file.content instanceof Uint8Array) {
      return;
    }

    let data: any = [];

    let result = StorageUtilities.getJsonObject(this._file);

    if (result) {
      data = result;
    }

    this._data = data;

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }

  async deleteLinkToChild(rel: IProjectItemRelationship) {
    let packRootFolder = this.getPackRootFolder();

    if (this._data === undefined) {
      await this.load();
    }

    if (!this._data) {
      return;
    }
    if (rel.childItem.itemType === ProjectItemType.texture) {
      await rel.childItem.ensureStorage();

      if (rel.childItem.file && packRootFolder) {
        let relativePath = this.getRelativePath(rel.childItem.file, packRootFolder);

        if (relativePath) {
          let newFlipbookTextures: IFlipbookTexture[] = [];

          for (const flipbookTexture of this._data) {
            if (flipbookTexture.flipbook_texture !== relativePath) {
              newFlipbookTextures.push(flipbookTexture);
            }
          }

          this._data = newFlipbookTextures;
        }
      }
    }

    this.persist();
  }

  getTexturePaths() {
    const texturePaths: string[] = [];
    if (this.data) {
      for (const flipbookResource of this.data) {
        const resource = flipbookResource.flipbook_texture;

        if (!texturePaths.includes(resource)) {
          texturePaths.push(resource);
        }
      }
    }

    return texturePaths;
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

    let textureList = this.texturesList;

    for (const candItem of itemsCopy) {
      if (candItem.itemType === ProjectItemType.texture && packRootFolder && textureList) {
        await candItem.ensureStorage();

        if (candItem.file) {
          let relativePath = this.getRelativePath(candItem.file, packRootFolder);

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
        item.addUnfulfilledRelationship(
          texturePath,
          ProjectItemType.texture,
          await Database.matchesVanillaPath(texturePath)
        );
      }
    }
  }
}

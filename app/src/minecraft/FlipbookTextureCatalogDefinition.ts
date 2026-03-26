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
import IDefinition from "./IDefinition";

export default class FlipbookTextureCatalogDefinition implements IDefinition {
  private _data?: IFlipbookTexture[];
  private _file?: IFile;
  private _isLoaded: boolean = false;
  private _loadedWithComments: boolean = false;

  private _onLoaded = new EventDispatcher<FlipbookTextureCatalogDefinition, FlipbookTextureCatalogDefinition>();

  public id: string | undefined;

  public get data() {
    return this._data;
  }

  public get texturesList() {
    if (!this._data || !Array.isArray(this._data)) {
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

    return this._file.setObjectContentIfSemanticallyDifferent(this._data);
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
      Log.unexpectedUndefined("FBTCDF");
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

    let data: any = [];

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

  async deleteLinkToChild(rel: IProjectItemRelationship) {
    let packRootFolder = this.getPackRootFolder();

    if (this._data === undefined) {
      if (!this.isLoaded) {
        await this.load();
      }
    }

    if (!this._data || !Array.isArray(this._data)) {
      return;
    }
    if (rel.childItem.itemType === ProjectItemType.texture) {
      if (!rel.childItem.isContentLoaded) {
        await rel.childItem.loadContent();
      }

      if (rel.childItem.primaryFile && packRootFolder) {
        let relativePath = StorageUtilities.getBaseRelativePath(rel.childItem.primaryFile, packRootFolder);

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
    if (this.data && Array.isArray(this.data)) {
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

  async addChildItems(project: Project, item: ProjectItem) {
    const textureItems = project.getItemsByType(ProjectItemType.texture);

    let packRootFolder = this.getPackRootFolder();

    let textureList = this.texturesList;

    for (const candItem of textureItems) {
      if (packRootFolder && textureList) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile) {
          let relativePath = StorageUtilities.getBaseRelativePath(candItem.primaryFile, packRootFolder);

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

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { ProjectItemType } from "../app/IProjectItemData";
import Utilities from "../core/Utilities";
import Database from "./Database";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import IDefinition from "./IDefinition";
import TextureSet from "@minecraft/bedrock-schemas/types/rp/visuals/TextureSet";

export default class TextureSetDefinition implements IDefinition {
  private _data?: TextureSet;
  private _file?: IFile;
  private _isLoaded: boolean = false;
  private _loadedWithComments: boolean = false;

  private _onLoaded = new EventDispatcher<TextureSetDefinition, TextureSetDefinition>();

  public id: string | undefined;

  public get data() {
    return this._data;
  }

  public get texturesList() {
    if (!this._data || !this._data["minecraft:texture_set"]) {
      return undefined;
    }

    const textureList = [];

    const textureSet = this._data["minecraft:texture_set"];

    if (textureSet.metalness_emissive_roughness && typeof textureSet.metalness_emissive_roughness === "string") {
      textureList.push(this.adaptTexturePath(textureSet.metalness_emissive_roughness));
    }

    if (
      textureSet.metalness_emissive_roughness_subsurface &&
      typeof textureSet.metalness_emissive_roughness_subsurface === "string"
    ) {
      textureList.push(this.adaptTexturePath(textureSet.metalness_emissive_roughness_subsurface));
    }

    if (textureSet.heightmap && typeof textureSet.heightmap === "string") {
      textureList.push(this.adaptTexturePath(textureSet.heightmap));
    }

    if (textureSet.normal && typeof textureSet.normal === "string") {
      textureList.push(this.adaptTexturePath(textureSet.normal));
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

  private adaptTexturePath(path: string) {
    path = path.toLowerCase();

    if (path.indexOf("/") >= 0) {
      return path;
    }

    if (this._file) {
      return this._file.parentFolder.fullPath + "/" + path;
    }

    return path;
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<TextureSetDefinition, TextureSetDefinition>) {
    let tsd: TextureSetDefinition | undefined;

    if (file.manager === undefined) {
      tsd = new TextureSetDefinition();

      tsd.file = file;

      file.manager = tsd;
    }

    if (file.manager !== undefined && file.manager instanceof TextureSetDefinition) {
      tsd = file.manager as TextureSetDefinition;

      if (!tsd.isLoaded) {
        if (loadHandler) {
          tsd.onLoaded.subscribe(loadHandler);
        }

        await tsd.load();
      }
    }

    return tsd;
  }

  persist(): boolean {
    if (this._file === undefined) {
      return false;
    }

    if (!this._data) {
      Log.unexpectedUndefined("TSTDF");
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
      Log.unexpectedUndefined("TSTCDF");
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

    let textureListInitial = this.texturesList;
    let textureList: string[] = [];

    if (!packRootFolder || !textureListInitial) {
      return;
    }

    for (let texturePath of textureListInitial) {
      texturePath = StorageUtilities.canonicalizePath(texturePath).toLowerCase();
      const basePath = StorageUtilities.canonicalizePath(packRootFolder.fullPath).toLowerCase();

      if (texturePath.startsWith(basePath)) {
        textureList.push(texturePath.substring(basePath.length + 1).toLowerCase());
      } else {
        textureList.push(texturePath.toLowerCase());
      }
    }

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

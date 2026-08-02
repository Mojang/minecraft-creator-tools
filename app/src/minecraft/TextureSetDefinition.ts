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

  /**
   * The raw (un-adapted) texture references this texture set declares as its
   * metalness/emissive/roughness (MER) and MER+subsurface (MERS) material layers.
   *
   * These are the authoritative definition of which textures actually behave as
   * MER/MERS maps — unlike the historical "_mer"/"_mers" filename convention, a texture
   * is a MER map because a texture_set.json points at it here, regardless of its name.
   */
  public get merTextureReferences() {
    if (!this._data || !this._data["minecraft:texture_set"]) {
      return undefined;
    }

    const textureSet = this._data["minecraft:texture_set"];
    const references: string[] = [];

    if (typeof textureSet.metalness_emissive_roughness === "string") {
      references.push(textureSet.metalness_emissive_roughness);
    }

    if (typeof textureSet.metalness_emissive_roughness_subsurface === "string") {
      references.push(textureSet.metalness_emissive_roughness_subsurface);
    }

    return references;
  }

  /**
   * Builds the union of every MER/MERS texture path declared by the texture_set.json
   * files in a project, as the canonical way to identify MER textures (rather than
   * relying on the "_mer"/"_mers" filename convention).
   *
   * Returned paths are normalized to match {@link ProjectItem.getPackRelativePath}
   * output for texture images: pack-relative, no leading delimiter, extension stripped,
   * and lower-cased — so callers can test a texture's pack-relative path for membership.
   *
   * A reference containing a slash is resolved relative to the pack root; a bare name is
   * resolved relative to the folder the texture_set.json sits in.
   */
  static async getProjectMerTexturePaths(project: Project): Promise<Set<string>> {
    const merPaths = new Set<string>();

    for (const item of project.getItemsByType(ProjectItemType.textureSetJson)) {
      if (!item.isContentLoaded) {
        await item.loadContent();
      }

      const file = item.primaryFile;

      if (!file) {
        continue;
      }

      const tsd = await TextureSetDefinition.ensureOnFile(file);
      const references = tsd?.merTextureReferences;

      if (!references || references.length === 0) {
        continue;
      }

      const packRelativePath = await item.getPackRelativePath();

      if (!packRelativePath) {
        continue;
      }

      // Pack-relative folder the texture_set.json lives in, e.g. "textures/aop/moremobs/".
      const packRelativePathNoLeading = StorageUtilities.ensureNotStartsWithDelimiter(packRelativePath);
      const folder = StorageUtilities.hasPathSeparator(packRelativePathNoLeading)
        ? StorageUtilities.getFolderPath(packRelativePathNoLeading)
        : "";

      for (let reference of references) {
        reference = reference.trim().replace(/\\/g, "/");

        const resolved = reference.indexOf("/") >= 0 ? reference : folder + reference;

        merPaths.add(
          StorageUtilities.getBaseFromName(StorageUtilities.ensureNotStartsWithDelimiter(resolved)).toLowerCase()
        );
      }
    }

    return merPaths;
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

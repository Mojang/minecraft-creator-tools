// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IParticleEffectWrapper } from "./IParticleEffect";
import MinecraftUtilities from "./MinecraftUtilities";
import { ProjectItemType } from "../app/IProjectItemData";
import ProjectItem from "../app/ProjectItem";
import Project from "../app/Project";
import Database from "./Database";
import Utilities from "../core/Utilities";
import IProjectItemRelationship from "../app/IProjectItemRelationship";
import TextureDefinition from "./TextureDefinition";

export default class ParticleEffectResourceDefinition {
  private _data?: IParticleEffectWrapper;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<ParticleEffectResourceDefinition, ParticleEffectResourceDefinition>();

  public get data() {
    return this._data;
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

  public get id() {
    if (!this._data || !this._data.particle_effect || !this._data.particle_effect.description) {
      return undefined;
    }

    return this._data.particle_effect.description.identifier;
  }

  public get description() {
    if (!this._data || !this._data.particle_effect || !this._data.particle_effect.description) {
      return undefined;
    }

    return this._data.particle_effect.description;
  }

  public getCanonicalizedTexturesList() {
    if (
      !this.description ||
      !this.description.basic_render_parameters ||
      !this.description.basic_render_parameters.texture
    ) {
      return undefined;
    }

    const result = TextureDefinition.canonicalizeTexturePath(this.description.basic_render_parameters.texture);

    return result ? [result] : [];
  }

  public async getFormatVersionIsCurrent() {
    const fv = this.getFormatVersion();

    if (fv === undefined || fv.length !== 3) {
      return false;
    }

    return fv[0] > 1 || fv[1] >= 10;
  }

  public getFormatVersion(): number[] | undefined {
    if (!this._data) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this._data.format_version);
  }

  get formatVersion() {
    if (!this._data || !this._data.format_version) {
      return undefined;
    }

    return this._data.format_version;
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<ParticleEffectResourceDefinition, ParticleEffectResourceDefinition>
  ) {
    let et: ParticleEffectResourceDefinition | undefined;

    if (file.manager === undefined) {
      et = new ParticleEffectResourceDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof ParticleEffectResourceDefinition) {
      et = file.manager as ParticleEffectResourceDefinition;

      if (!et.isLoaded) {
        if (loadHandler) {
          et.onLoaded.subscribe(loadHandler);
        }

        await et.load();
      }
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
      Log.unexpectedUndefined("PERPF");
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

  async deleteLinkToChild(rel: IProjectItemRelationship) {
    let packRootFolder = this.getPackRootFolder();

    if (this._data === undefined) {
      await this.load();
    }

    if (
      !this.description ||
      !this.description.basic_render_parameters ||
      !this.description.basic_render_parameters.texture
    ) {
      return;
    }

    const basicTexture = this.description.basic_render_parameters.texture;

    if (rel.childItem.itemType === ProjectItemType.texture) {
      if (!rel.childItem.isContentLoaded) {
        await rel.childItem.loadContent();
      }

      if (rel.childItem.primaryFile && packRootFolder) {
        let relativePath = StorageUtilities.getBaseRelativePath(rel.childItem.primaryFile, packRootFolder);

        if (relativePath) {
          if (basicTexture === relativePath) {
            this.description.basic_render_parameters.texture = undefined;
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

      packRootFolder = StorageUtilities.getParentOfParentFolderNamed("particles", parentFolder);
    }

    return packRootFolder;
  }

  async addChildItems(project: Project, item: ProjectItem) {
    const itemsCopy = project.getItemsCopy();

    let packRootFolder = this.getPackRootFolder();

    let textureList = this.getCanonicalizedTexturesList();

    for (const candItem of itemsCopy) {
      if (candItem.itemType === ProjectItemType.texture && packRootFolder && textureList) {
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
        const isVanillaToken = await Database.isVanillaToken(texturePath);

        item.addUnfulfilledRelationship(texturePath, ProjectItemType.texture, isVanillaToken);
      }
    }
  }
}

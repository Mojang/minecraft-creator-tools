// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";
import IResourceAnimationWrapper, { IAnimationResource } from "./IAnimationResource";
import IDefinition from "./IDefinition";
import Utilities from "../core/Utilities";

export default class AnimationResourceDefinition implements IDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  private _data?: IResourceAnimationWrapper;

  private _onLoaded = new EventDispatcher<AnimationResourceDefinition, AnimationResourceDefinition>();

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
    return this._id;
  }

  public set id(newId: string | undefined) {
    this._id = newId;
  }

  public get shortId() {
    if (this._id !== undefined) {
      if (this._id.startsWith("minecraft:")) {
        return this._id.substring(10, this._id.length);
      }

      return this._id;
    }

    return undefined;
  }

  public get idList() {
    if (!this._data || !this._data.animations) {
      return undefined;
    }

    const idList = new Set<string>();

    for (const key in this._data.animations) {
      const animation = this._data.animations[key];

      if (key && animation) {
        idList.add(key);
      }
    }

    return idList;
  }

  public get animations() {
    if (this._data && this._data.animations) {
      return this._data.animations;
    }

    return undefined;
  }
  public async getFormatVersionIsCurrent() {
    const fv = this.getFormatVersion();

    if (fv === undefined || fv.length !== 3) {
      return false;
    }

    return await Database.isRecentVersionFromVersionArray(fv);
  }

  public getFormatVersion(): number[] | undefined {
    if (!this._data || !this._data.format_version) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this._data.format_version);
  }

  setResourcePackFormatVersion(versionStr: string) {
    this.ensureDefault();

    if (this._data) {
      this._data.format_version = versionStr;
    }
  }

  ensureDefault() {
    if (this._data === undefined) {
      this._data = {
        format_version: "1.12.0",
        animations: {},
      };
    }

    return this._data;
  }

  ensureAnimation(animationName: string): IAnimationResource {
    this.ensureDefault();

    if (!this._data || !this._data.animations || !Utilities.isUsableAsObjectKey(animationName)) {
      throw new Error();
    }

    if (!this._data.animations[animationName]) {
      this._data.animations[animationName] = { bones: {} };
    }

    return this._data.animations[animationName];
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<AnimationResourceDefinition, AnimationResourceDefinition>
  ) {
    let rbd: AnimationResourceDefinition | undefined;

    if (file.manager === undefined) {
      rbd = new AnimationResourceDefinition();

      rbd.file = file;

      file.manager = rbd;
    }

    if (file.manager !== undefined && file.manager instanceof AnimationResourceDefinition) {
      rbd = file.manager as AnimationResourceDefinition;

      if (!rbd.isLoaded) {
        if (loadHandler) {
          rbd.onLoaded.subscribe(loadHandler);
        }

        await rbd.load();
      }
    }

    return rbd;
  }

  persist(): boolean {
    if (this._file === undefined) {
      return false;
    }

    return this._file.setObjectContentIfSemanticallyDifferent(this._data);
  }

  async load() {
    if (this._file === undefined || this._isLoaded) {
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this._data = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}

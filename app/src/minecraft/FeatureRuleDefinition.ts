// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";
import IDefinition from "./IDefinition";
import { MinecraftFeatureBase } from "./jsoncommon";

export default class FeatureRuleDefinition implements IDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  private _data?: MinecraftFeatureBase;

  private _onLoaded = new EventDispatcher<FeatureRuleDefinition, FeatureRuleDefinition>();

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

  public async getFormatVersionIsCurrent() {
    const fv = this.getFormatVersion();

    if (fv === undefined || fv.length !== 3) {
      return false;
    }

    return await Database.isRecentVersionFromVersionArray(fv);
  }

  public getFormatVersion(): number[] | undefined {
    if (!this._data || !(this._data as MinecraftFeatureBase).format_version) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom((this._data as MinecraftFeatureBase).format_version);
  }

  setResourcePackFormatVersion(versionStr: string) {
    this._ensureDataInitialized();

    if (this._data) {
      (this._data as MinecraftFeatureBase).format_version = versionStr;
    }
  }

  _ensureDataInitialized() {
    if (this._data === undefined) {
      this._data = {
        format_version: "1.21.0",
      };
    }
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<FeatureRuleDefinition, FeatureRuleDefinition>) {
    let fd: FeatureRuleDefinition | undefined;

    if (file.manager === undefined) {
      fd = new FeatureRuleDefinition();

      fd.file = file;

      file.manager = fd;
    }

    if (file.manager !== undefined && file.manager instanceof FeatureRuleDefinition) {
      fd = file.manager as FeatureRuleDefinition;

      if (!fd.isLoaded) {
        if (loadHandler) {
          fd.onLoaded.subscribe(loadHandler);
        }

        await fd.load();
      }
    }

    return fd;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const bpString = JSON.stringify(this._data, null, 2);

    this._file.setContent(bpString);
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

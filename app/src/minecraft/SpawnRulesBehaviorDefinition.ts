// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";
import ISpawnRulesBehavior from "./ISpawnRulesBehavior";

export default class SpawnRulesBehaviorDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public data?: ISpawnRulesBehavior;

  private _onLoaded = new EventDispatcher<SpawnRulesBehaviorDefinition, SpawnRulesBehaviorDefinition>();

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
    if (!this.data || !this.data.format_version) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this.data.format_version);
  }

  setFormatVersion(versionStr: string) {
    this._ensureDataInitialized();

    if (this.data) {
      this.data.format_version = versionStr;
    }
  }

  _ensureDataInitialized() {
    if (this.data === undefined) {
      this.data = {};
    }
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<SpawnRulesBehaviorDefinition, SpawnRulesBehaviorDefinition>
  ) {
    let rbd: SpawnRulesBehaviorDefinition | undefined;

    if (file.manager === undefined) {
      rbd = new SpawnRulesBehaviorDefinition();

      rbd.file = file;

      file.manager = rbd;
    }

    if (file.manager !== undefined && file.manager instanceof SpawnRulesBehaviorDefinition) {
      rbd = file.manager as SpawnRulesBehaviorDefinition;

      if (!rbd.isLoaded && loadHandler) {
        rbd.onLoaded.subscribe(loadHandler);
      }

      await rbd.load();
    }

    return rbd;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const bpString = JSON.stringify(this.data, null, 2);

    this._file.setContent(bpString);
  }

  async load() {
    if (this._file === undefined || this._isLoaded) {
      return;
    }

    await this._file.loadContent();

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this.data = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}

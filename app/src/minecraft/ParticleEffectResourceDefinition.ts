// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IParticleEffectWrapper } from "./IParticleEffect";
import MinecraftUtilities from "./MinecraftUtilities";

export default class ParticleEffectResourceDefinition {
  public wrapper?: IParticleEffectWrapper;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<ParticleEffectResourceDefinition, ParticleEffectResourceDefinition>();

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
    if (!this.wrapper || !this.wrapper.particle_effect || !this.wrapper.particle_effect.description) {
      return undefined;
    }

    return this.wrapper.particle_effect.description.identifier;
  }

  public async getFormatVersionIsCurrent() {
    const fv = this.getFormatVersion();

    if (fv === undefined || fv.length !== 3) {
      return false;
    }

    return fv[0] > 1 || fv[1] >= 10;
  }

  public getFormatVersion(): number[] | undefined {
    if (!this.wrapper) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this.wrapper.format_version);
  }

  get formatVersion() {
    if (!this.wrapper || !this.wrapper.format_version) {
      return undefined;
    }

    return this.wrapper.format_version;
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<ParticleEffectResourceDefinition, ParticleEffectResourceDefinition>
  ) {
    let et: ParticleEffectResourceDefinition | undefined = undefined;

    if (file.manager === undefined) {
      et = new ParticleEffectResourceDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof ParticleEffectResourceDefinition) {
      et = file.manager as ParticleEffectResourceDefinition;

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

    const defString = JSON.stringify(this.wrapper, null, 2);

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

    await this._file.loadContent();

    if (!this._file.content || this._file.content instanceof Uint8Array) {
      return;
    }

    let data: any = {};

    let result = StorageUtilities.getJsonObject(this._file);

    if (result) {
      data = result;
    }

    this.wrapper = data;

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IParticleEffectWrapper } from "./IParticleEffect";

export default class ParticleEffectResourceDefinition {
  public particleEffectWrapper?: IParticleEffectWrapper;
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
    if (
      !this.particleEffectWrapper ||
      !this.particleEffectWrapper.particle_effect ||
      !this.particleEffectWrapper.particle_effect.description
    ) {
      return undefined;
    }

    return this.particleEffectWrapper.particle_effect.description.identifier;
  }

  public getFormatVersion(): number[] | undefined {
    if (!this.particleEffectWrapper) {
      return undefined;
    }

    const fv = this.particleEffectWrapper.format_version;

    if (typeof fv === "number") {
      return [fv];
    }

    if (typeof fv === "string") {
      let fvarr = this.particleEffectWrapper.format_version.split(".");

      let fvarrInt: number[] = [];
      for (let i = 0; i < fvarr.length; i++) {
        try {
          fvarrInt.push(parseInt(fvarr[i]));
        } catch (e) {}
      }

      return fvarrInt;
    }

    return undefined;
  }

  get formatVersion() {
    if (!this.particleEffectWrapper || !this.particleEffectWrapper.format_version) {
      return undefined;
    }

    return this.particleEffectWrapper.format_version;
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

    const defString = JSON.stringify(this.particleEffectWrapper, null, 2);

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

    this.particleEffectWrapper = data;

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}

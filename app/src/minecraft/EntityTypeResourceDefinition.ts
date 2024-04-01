// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IClientEntityTypeWrapper } from "./IClientEntityType";

export default class EntityTypeResourceDefinition {
  public clientEntityTypeWrapper?: IClientEntityTypeWrapper;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<EntityTypeResourceDefinition, EntityTypeResourceDefinition>();

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
      !this.clientEntityTypeWrapper ||
      !this.clientEntityTypeWrapper["minecraft:client_entity"] ||
      !this.clientEntityTypeWrapper["minecraft:client_entity"].description
    ) {
      return undefined;
    }

    return this.clientEntityTypeWrapper["minecraft:client_entity"].description.identifier;
  }

  public getFormatVersion(): number[] | undefined {
    if (!this.clientEntityTypeWrapper) {
      return undefined;
    }

    const fv = this.clientEntityTypeWrapper.format_version;

    if (typeof fv === "number") {
      return [fv];
    }

    if (typeof fv === "string") {
      let fvarr = this.clientEntityTypeWrapper.format_version.split(".");

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
    if (!this.clientEntityTypeWrapper || !this.clientEntityTypeWrapper.format_version) {
      return undefined;
    }

    return this.clientEntityTypeWrapper.format_version;
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<EntityTypeResourceDefinition, EntityTypeResourceDefinition>
  ) {
    let et: EntityTypeResourceDefinition | undefined;

    if (file.manager === undefined) {
      et = new EntityTypeResourceDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof EntityTypeResourceDefinition) {
      et = file.manager as EntityTypeResourceDefinition;

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

    const defString = JSON.stringify(this.clientEntityTypeWrapper, null, 2);

    this._file.setContent(defString);
  }

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      Log.unexpectedUndefined("ETRPF");
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

    this.clientEntityTypeWrapper = data;

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IClientAttachableWrapper } from "./IClientAttachable";

export default class AttachableResourceDefinition {
  public attachableWrapper?: IClientAttachableWrapper;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<AttachableResourceDefinition, AttachableResourceDefinition>();

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
      !this.attachableWrapper ||
      !this.attachableWrapper["minecraft:attachable"] ||
      !this.attachableWrapper["minecraft:attachable"].description
    ) {
      return undefined;
    }

    return this.attachableWrapper["minecraft:attachable"].description.identifier;
  }

  public getFormatVersion(): number[] | undefined {
    if (!this.attachableWrapper) {
      return undefined;
    }

    const fv = this.attachableWrapper.format_version;

    if (typeof fv === "number") {
      return [fv];
    }

    if (typeof fv === "string") {
      let fvarr = this.attachableWrapper.format_version.split(".");

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
    if (!this.attachableWrapper || !this.attachableWrapper.format_version) {
      return undefined;
    }

    return this.attachableWrapper.format_version;
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<AttachableResourceDefinition, AttachableResourceDefinition>
  ) {
    let attachable: AttachableResourceDefinition | undefined;

    if (file.manager === undefined) {
      attachable = new AttachableResourceDefinition();

      attachable.file = file;

      file.manager = attachable;
    }

    if (file.manager !== undefined && file.manager instanceof AttachableResourceDefinition) {
      attachable = file.manager as AttachableResourceDefinition;

      if (!attachable.isLoaded && loadHandler) {
        attachable.onLoaded.subscribe(loadHandler);
      }

      await attachable.load();
    }

    return attachable;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const defString = JSON.stringify(this.attachableWrapper, null, 2);

    this._file.setContent(defString);
  }

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      Log.unexpectedUndefined("ATTRPF");
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

    this.attachableWrapper = data;

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IMaterialWrapper } from "./IMaterial";
import Log from "../core/Log";

export default class Material {
  private _file?: IFile;
  private _isLoaded: boolean = false;

  public definition?: IMaterialWrapper;

  private _onLoaded = new EventDispatcher<Material, Material>();

  public get isLoaded() {
    return this._isLoaded;
  }

  public get file() {
    return this._file;
  }

  public set file(newFile: IFile | undefined) {
    this._file = newFile;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public get version(): string | undefined {
    if (!this.definition || !this.definition.materials) {
      return undefined;
    }

    return this.definition.materials["version"] as string;
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<Material, Material>) {
    let rc: Material | undefined;

    if (file.manager === undefined) {
      rc = new Material();

      rc.file = file;

      file.manager = rc;
    }

    if (file.manager !== undefined && file.manager instanceof Material) {
      rc = file.manager as Material;

      if (!rc.isLoaded) {
        if (loadHandler) {
          rc.onLoaded.subscribe(loadHandler);
        }

        await rc.load();
      }
    }

    return rc;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    if (!this.definition) {
      Log.unexpectedUndefined("MATP");
      return;
    }

    const pjString = JSON.stringify(this.definition, null, 2);

    this._file.setContent(pjString);
  }

  async save() {
    if (this._file === undefined) {
      return;
    }

    this.persist();

    await this._file.saveContent(false);
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

    this.definition = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}

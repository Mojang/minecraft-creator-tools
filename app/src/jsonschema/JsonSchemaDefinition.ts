// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import IDefinition from "./../minecraft/IDefinition";
import * as jsonschema from "json-schema";
import Log from "../core/Log";

export default class JsonSchemaDefinition implements IDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public data?: jsonschema.JSONSchema7;

  private _onLoaded = new EventDispatcher<JsonSchemaDefinition, JsonSchemaDefinition>();

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

  _ensureDataInitialized() {
    if (this.data === undefined) {
      this.data = {};
    }
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<JsonSchemaDefinition, JsonSchemaDefinition>) {
    let rbd: JsonSchemaDefinition | undefined;

    if (file.manager === undefined) {
      rbd = new JsonSchemaDefinition();

      rbd.file = file;

      file.manager = rbd;
    }

    if (file.manager !== undefined && file.manager instanceof JsonSchemaDefinition) {
      rbd = file.manager as JsonSchemaDefinition;

      if (!rbd.isLoaded && loadHandler) {
        rbd.onLoaded.subscribe(loadHandler);
      }

      await rbd.load();
    }

    return rbd;
  }

  persist(): boolean {
    if (this._file === undefined) {
      return false;
    }

    Log.assert(this.data !== null, "JSDP");

    if (this.data) {
      return this._file.setObjectContentIfSemanticallyDifferent(this.data);
    }

    return false;
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

    this.data = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IJsonUIScreen } from "./IJsonUIScreen";

export default class JsonUIResourceDefinition {
  public jsonUIScreen?: IJsonUIScreen;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<JsonUIResourceDefinition, JsonUIResourceDefinition>();

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

  public get namespaceId() {
    if (!this.jsonUIScreen || !this.jsonUIScreen["namespace"]) {
      return undefined;
    }

    return this.jsonUIScreen["namespace"];
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<JsonUIResourceDefinition, JsonUIResourceDefinition>
  ) {
    let et: JsonUIResourceDefinition | undefined;

    if (file.manager === undefined) {
      et = new JsonUIResourceDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof JsonUIResourceDefinition) {
      et = file.manager as JsonUIResourceDefinition;

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

    const defString = JSON.stringify(this.jsonUIScreen, null, 2);

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

    this.jsonUIScreen = data;

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}

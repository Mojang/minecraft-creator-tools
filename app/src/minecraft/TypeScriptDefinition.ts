// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import IDefinition from "./IDefinition";

export default class TypeScriptDefinition implements IDefinition {
  private _data?: string;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<TypeScriptDefinition, TypeScriptDefinition>();

  public id: string | undefined;

  public get data() {
    if (!this._file || !this._file.content || typeof this._file.content != "string") {
      return undefined;
    }

    return this._file.content;
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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<TypeScriptDefinition, TypeScriptDefinition>) {
    let tsd: TypeScriptDefinition | undefined;

    if (file.manager === undefined) {
      tsd = new TypeScriptDefinition();

      tsd.file = file;

      file.manager = tsd;
    }

    if (file.manager !== undefined && file.manager instanceof TypeScriptDefinition) {
      tsd = file.manager as TypeScriptDefinition;

      if (!tsd.isLoaded) {
        if (loadHandler) {
          tsd.onLoaded.subscribe(loadHandler);
        }

        await tsd.load();
      }
    }

    return tsd;
  }

  persist() {}

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      Log.unexpectedUndefined("TSCDF");
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (!this._file.content || this._file.content instanceof Uint8Array) {
      return;
    }

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}

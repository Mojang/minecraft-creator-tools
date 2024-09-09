// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import ILootTableBehavior from "./ILootTableBehavior";

export default class LootTableBehaviorDefinition {
  private _file?: IFile;
  private _isLoaded: boolean = false;

  public data?: ILootTableBehavior;

  private _onLoaded = new EventDispatcher<LootTableBehaviorDefinition, LootTableBehaviorDefinition>();

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

  _ensureDataInitialized() {
    if (this.data === undefined) {
      this.data = { pools: [] };
    }
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<LootTableBehaviorDefinition, LootTableBehaviorDefinition>
  ) {
    let ltb: LootTableBehaviorDefinition | undefined;

    if (file.manager === undefined) {
      ltb = new LootTableBehaviorDefinition();

      ltb.file = file;

      file.manager = ltb;
    }

    if (file.manager !== undefined && file.manager instanceof LootTableBehaviorDefinition) {
      ltb = file.manager as LootTableBehaviorDefinition;

      if (!ltb.isLoaded && loadHandler) {
        ltb.onLoaded.subscribe(loadHandler);
      }

      await ltb.load();
    }

    return ltb;
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

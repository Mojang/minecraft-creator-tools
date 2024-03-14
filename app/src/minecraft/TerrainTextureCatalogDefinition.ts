// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { ITerrainTexture } from "./ITerrainTexture";

export default class TerrainTextureCatalogDefinition {
  public terrainTexture?: ITerrainTexture;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<TerrainTextureCatalogDefinition, TerrainTextureCatalogDefinition>();

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

  static async ensureTerrainTextureCatalogDefinitionOnFile(
    file: IFile,
    loadHandler?: IEventHandler<TerrainTextureCatalogDefinition, TerrainTextureCatalogDefinition>
  ) {
    let et: TerrainTextureCatalogDefinition | undefined = undefined;

    if (file.manager === undefined) {
      et = new TerrainTextureCatalogDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof TerrainTextureCatalogDefinition) {
      et = file.manager as TerrainTextureCatalogDefinition;

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

    const defString = JSON.stringify(this.terrainTexture, null, 2);

    this._file.setContent(defString);
  }

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      Log.unexpectedUndefined("TTCDF");
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

    this.terrainTexture = data;

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}

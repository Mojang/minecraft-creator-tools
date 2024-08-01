// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import IModelGeometry from "./IModelGeometry";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";

export default class ModelGeometryDefinition {
  private _file?: IFile;
  private _isLoaded: boolean = false;

  public definition?: IModelGeometry;

  private _onLoaded = new EventDispatcher<ModelGeometryDefinition, ModelGeometryDefinition>();

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

  public get identifier(): string | undefined {
    if (
      !this.definition ||
      !this.definition["minecraft:geometry"] ||
      this.definition["minecraft:geometry"].length !== 1 ||
      !this.definition["minecraft:geometry"][0].description
    ) {
      return undefined;
    }

    return this.definition["minecraft:geometry"][0].description.identifier;
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<ModelGeometryDefinition, ModelGeometryDefinition>
  ) {
    let rc: ModelGeometryDefinition | undefined;

    if (file.manager === undefined) {
      rc = new ModelGeometryDefinition();

      rc.file = file;

      file.manager = rc;
    }

    if (file.manager !== undefined && file.manager instanceof ModelGeometryDefinition) {
      rc = file.manager as ModelGeometryDefinition;

      if (!rc.isLoaded && loadHandler) {
        rc.onLoaded.subscribe(loadHandler);
      }

      await rc.load();
    }

    return rc;
  }

  public async getFormatVersionIsCurrent() {
    const fv = this.getFormatVersion();

    if (fv === undefined || fv.length !== 3) {
      return false;
    }

    return await Database.isRecentVersionFromVersionArray(fv);
  }

  public getFormatVersion(): number[] | undefined {
    if (!this.definition || !this.definition.format_version) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this.definition.format_version);
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const pjString = JSON.stringify(this.definition, null, 2);

    this._file.setContent(pjString);
  }

  public ensureDefinition(name: string) {
    if (!this.definition) {
      this.definition = {
        format_version: "1.12.0",
        "minecraft:geometry": [
          {
            description: {
              identifier: name,
              texture_width: 32,
              texture_height: 32,
              visible_bounds_width: 2,
              visible_bounds_height: 2,
              visible_bounds_offset: [0, 0, 0],
            },
            bones: [],
          },
        ],
      };
    }
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

    await this._file.loadContent();

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this.definition = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}

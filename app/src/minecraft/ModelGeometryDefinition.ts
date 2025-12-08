// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import IModelGeometry, { IGeometry } from "./IModelGeometry";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";
import Log from "../core/Log";

export default class ModelGeometryDefinition {
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _data?: IModelGeometry;
  public definitions: IGeometry[] = [];

  private _identifiers: string[] = [];

  private _onLoaded = new EventDispatcher<ModelGeometryDefinition, ModelGeometryDefinition>();

  public get data() {
    return this._data;
  }

  public get formatVersion() {
    return this._data?.format_version;
  }

  public get isLoaded() {
    return this._isLoaded;
  }

  public get defaultGeometry() {
    if (this.definitions && this.definitions.length > 0) {
      return this.definitions[0];
    }

    return undefined;
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

  public get identifiers(): string[] {
    if (this._identifiers) {
      return this._identifiers;
    }

    if (
      !this._data ||
      !this._data["minecraft:geometry"] ||
      this._data["minecraft:geometry"].length !== 1 ||
      !this._data["minecraft:geometry"][0].description
    ) {
      return [];
    }

    const ids: string[] = [];

    for (const def of this.definitions) {
      if (def.description && def.description.identifier) {
        ids.push(def.description.identifier);
      }
    }

    return ids;
  }

  public getById(id: string): IGeometry | undefined {
    Log.assert(id !== "minecraft:geometry");

    let model = (this._data as any)[id];

    if (model) {
      return model as IGeometry;
    }

    for (const def of this.definitions) {
      if (def.description && def.description.identifier === id) {
        return def;
      }
    }

    return undefined;
  }

  public getVisibleBoundsWidth(defIndex: number): number | undefined {
    if (defIndex < 0 || defIndex >= this.definitions.length) {
      return;
    }

    if (!this.definitions[defIndex]) {
      return undefined;
    }

    if (this.definitions[defIndex].description) {
      return this.definitions[defIndex].description.visible_bounds_width;
    }

    return this.definitions[defIndex].visible_bounds_width;
  }

  public getVisibleBoundsHeight(defIndex: number): number | undefined {
    if (defIndex < 0 || defIndex >= this.definitions.length) {
      return;
    }

    if (!this.definitions[defIndex]) {
      return undefined;
    }

    if (this.definitions[defIndex].description) {
      return this.definitions[defIndex].description.visible_bounds_height;
    }

    return this.definitions[defIndex].visible_bounds_height;
  }

  public getVisibleBoundsOffset(defIndex: number): number[] | undefined {
    if (defIndex < 0 || defIndex >= this.definitions.length) {
      return;
    }

    if (!this.definitions[defIndex]) {
      return undefined;
    }

    if (this.definitions[defIndex].description) {
      return this.definitions[defIndex].description.visible_bounds_offset;
    }

    return this.definitions[defIndex].visible_bounds_offset;
  }

  public getTextureWidth(defIndex: number): number | undefined {
    if (defIndex < 0 || defIndex >= this.definitions.length) {
      return;
    }

    if (!this.definitions[defIndex]) {
      return undefined;
    }

    if (this.definitions[defIndex].description) {
      return this.definitions[defIndex].description.texture_width;
    }

    return this.definitions[defIndex].texturewidth;
  }

  public ensureDefault(id: string) {
    if (!this._data) {
      this._data = {
        format_version: "1.12.0",
        "minecraft:geometry": [
          {
            description: {
              identifier: id,
              texture_width: 128,
              texture_height: 64,
              visible_bounds_width: 4,
              visible_bounds_height: 3.5,
              visible_bounds_offset: [0, 1.25, 0],
            },
            bones: [],
          },
        ],
      };

      this.persist();
      this.populateDefsAndIds();
      this._isLoaded = true;
    }
  }

  public getTextureHeight(defIndex: number): number | undefined {
    if (defIndex < 0 || defIndex >= this.definitions.length) {
      return;
    }

    if (!this.definitions[defIndex]) {
      return undefined;
    }

    if (this.definitions[defIndex].description) {
      return this.definitions[defIndex].description.texture_height;
    }

    return this.definitions[defIndex].textureheight;
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

      if (!rc.isLoaded) {
        if (loadHandler) {
          rc.onLoaded.subscribe(loadHandler);
        }

        await rc.load();
      }
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

  public getFormatVersion(): number[] {
    if (!this._data || !this._data.format_version) {
      return [0, 0, 0];
    }

    return MinecraftUtilities.getVersionArrayFrom(this._data.format_version);
  }

  persist(): boolean {
    if (this._file === undefined) {
      return false;
    }

    if (!this._data) {
      Log.unexpectedUndefined("MGDP");
      return false;
    }

    return this._file.setObjectContentIfSemanticallyDifferent(this._data);
  }

  public ensureDefinition(name: string) {
    if (!this._data) {
      this._data = {
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

    if (this.persist()) {
      await this._file.saveContent(false);
    }
  }

  populateDefsAndIds() {
    this.definitions = [];
    this._identifiers = [];

    if (this._data && this._data["minecraft:geometry"]) {
      for (const def of this._data["minecraft:geometry"]) {
        if (def.description && def.description.identifier) {
          this._identifiers.push(def.description.identifier);
        }

        this.definitions.push(def);
      }
    } else if (this._data) {
      // look for 1.8.0 style geometries:
      // {
      //   "format_version": ...
      //   "geometry.foobar": {}
      // }

      for (const elt in this._data) {
        if (elt !== "format_version" && elt.startsWith("geometry.") && (this._data as any)[elt]) {
          this._identifiers.push(elt);

          this.definitions.push((this._data as any)[elt]);
        }
      }
    }
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

    this._data = StorageUtilities.getJsonObject(this._file);

    this.populateDefsAndIds();

    this._isLoaded = true;
  }
}

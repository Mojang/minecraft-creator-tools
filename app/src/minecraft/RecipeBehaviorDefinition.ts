// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";
import IRecipeBehavior, { IRecipeShaped, IRecipeShapeless } from "./IRecipeBehavior";
import IDefinition from "./IDefinition";

export default class RecipeBehaviorDefinition implements IDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  private _data?: IRecipeBehavior;
  private _interior?: IRecipeShaped | IRecipeShapeless;

  private _onLoaded = new EventDispatcher<RecipeBehaviorDefinition, RecipeBehaviorDefinition>();

  public get data() {
    return this._data;
  }

  public set data(newData: IRecipeBehavior | undefined) {
    this._data = newData;

    if (this._data && this._data["minecraft:recipe_shaped"]) {
      this._interior = this._data["minecraft:recipe_shaped"];
    } else if (this._data && this._data["minecraft:recipe_shapeless"]) {
      this._interior = this._data["minecraft:recipe_shapeless"];
    } else {
      this._interior = undefined;
    }
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

  public get id() {
    if (this._interior && this._interior.description && this._interior.description.identifier) {
      return this._interior.description.identifier;
    }

    return this._id;
  }

  public set id(newId: string | undefined) {
    if (this._interior && this._interior.description) {
      this._interior.description.identifier = newId;
    }

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

  public async getFormatVersionIsCurrent() {
    const fv = this.getFormatVersion();

    if (fv === undefined || fv.length !== 3) {
      return false;
    }

    return await Database.isRecentVersionFromVersionArray(fv);
  }

  public getFormatVersion(): number[] | undefined {
    if (!this._data || !this._data.format_version) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this._data.format_version);
  }

  setBehaviorPackFormatVersion(versionStr: string) {
    this._ensureDataInitialized();

    if (this._data) {
      this._data.format_version = versionStr;
    }
  }

  _ensureDataInitialized() {
    if (this._data === undefined) {
      this._data = {};
    }
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<RecipeBehaviorDefinition, RecipeBehaviorDefinition>
  ) {
    let rbd: RecipeBehaviorDefinition | undefined;

    if (file.manager === undefined) {
      rbd = new RecipeBehaviorDefinition();

      rbd.file = file;

      file.manager = rbd;
    }

    if (file.manager !== undefined && file.manager instanceof RecipeBehaviorDefinition) {
      rbd = file.manager as RecipeBehaviorDefinition;

      if (!rbd.isLoaded && loadHandler) {
        rbd.onLoaded.subscribe(loadHandler);
      }

      await rbd.load();
    }

    return rbd;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const bpString = JSON.stringify(this._data, null, 2);

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

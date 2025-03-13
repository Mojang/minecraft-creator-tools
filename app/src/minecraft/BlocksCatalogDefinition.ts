// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IBlocksCatalogResource } from "./IBlocksCatalog";

export default class BlocksCatalogDefinition {
  public blocksCatalog?: IBlocksCatalogResource;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<BlocksCatalogDefinition, BlocksCatalogDefinition>();

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

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<BlocksCatalogDefinition, BlocksCatalogDefinition>
  ) {
    let et: BlocksCatalogDefinition | undefined;

    if (file.manager === undefined) {
      et = new BlocksCatalogDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof BlocksCatalogDefinition) {
      et = file.manager as BlocksCatalogDefinition;

      if (!et.isLoaded && loadHandler) {
        et.onLoaded.subscribe(loadHandler);
      }

      await et.load();
    }

    return et;
  }

  getBlockDefinition(id: string) {
    if (!this.blocksCatalog) {
      return undefined;
    }

    if (this.blocksCatalog[id]) {
      return this.blocksCatalog[id];
    }

    const colon = id.indexOf(":");

    if (colon >= 0) {
      id = id.substring(colon + 1);
    }

    return this.blocksCatalog[id];
  }

  getDefaultTextureId(id: string) {
    const ref = this.getBlockDefinition(id);

    if (ref && ref.textures) {
      if (typeof ref.textures === "string") {
        return ref.textures;
      }

      if (ref.textures["side"]) {
        return ref.textures["side"];
      } else if (ref.textures["up"]) {
        return ref.textures["up"];
      } else {
        for (const key in ref.textures) {
          return ref.textures[key];
        }
      }
    }

    return undefined;
  }

  getTextureReferences() {
    const textureRefs: string[] = [];
    if (this.blocksCatalog) {
      for (const resourceId in this.blocksCatalog) {
        const resource = this.blocksCatalog[resourceId];

        if (resource && resource.textures) {
          if (!textureRefs.includes(resourceId)) {
            textureRefs.push(resourceId);
          }
        }
      }
    }

    return textureRefs;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const defString = JSON.stringify(this.blocksCatalog, null, 2);

    this._file.setContent(defString);
  }

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      Log.unexpectedUndefined("BCRDF");
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

    this.blocksCatalog = data;

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}

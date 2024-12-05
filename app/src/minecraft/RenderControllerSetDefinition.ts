// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import IRenderControllerSetDefinition from "./IRenderControllerSet";
import DataFormProcessor, { ProcessorFixupLevel } from "../dataform/DataFormProcessor";
import IDefinition from "./IDefinition";

export default class RenderControllerSetDefinition implements IDefinition {
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _data?: IRenderControllerSetDefinition;

  private _onLoaded = new EventDispatcher<RenderControllerSetDefinition, RenderControllerSetDefinition>();

  public id: string | undefined;

  public get data() {
    return this._data;
  }

  public get idList() {
    if (!this._data || !this._data.render_controllers) {
      return undefined;
    }

    const idList = [];

    for (const key in this._data.render_controllers) {
      const rc = this._data.render_controllers[key];

      if (key && rc) {
        idList.push(key);
      }
    }

    return idList;
  }

  public get renderControllers() {
    if (!this._data || !this._data.render_controllers) {
      return undefined;
    }

    const rcList = [];

    for (const key in this._data.render_controllers) {
      const rc = this._data.render_controllers[key];

      if (key && rc) {
        rcList.push(rc);
      }
    }

    return rcList;
  }

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

  public async removeTexture(textureId: string) {
    await this.load();

    const rcs = this._data?.render_controllers;

    if (!rcs) {
      return;
    }

    for (const rcKey in rcs) {
      const rc = rcs[rcKey];

      if (rc) {
        if (rc.arrays.textures) {
          for (const textureListName in rc.arrays.textures) {
            const textureList = rc.arrays.textures[textureListName];

            let newTextureList: string[] | undefined = [];

            if (textureList) {
              for (const textureStr of textureList) {
                if (textureStr !== textureId && textureStr !== "Texture." + textureId) {
                  newTextureList.push(textureStr);
                }
              }
            }

            if (newTextureList.length === 0) {
              newTextureList = undefined;
            }

            rc.arrays.textures[textureListName] = newTextureList;
          }
        }
      }
    }
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<RenderControllerSetDefinition, RenderControllerSetDefinition>
  ) {
    let rc: RenderControllerSetDefinition | undefined;

    if (file.manager === undefined) {
      rc = new RenderControllerSetDefinition();

      rc.file = file;

      file.manager = rc;
    }

    if (file.manager !== undefined && file.manager instanceof RenderControllerSetDefinition) {
      rc = file.manager as RenderControllerSetDefinition;

      if (!rc.isLoaded && loadHandler) {
        rc.onLoaded.subscribe(loadHandler);
      }

      await rc.load();
    }

    return rc;
  }

  async persist() {
    if (this._file === undefined) {
      return;
    }

    if (this._data) {
      await DataFormProcessor.process(this._data, "render_controller_set", ProcessorFixupLevel.perField);
    }

    const pjString = JSON.stringify(this._data, null, 2);

    this._file.setContent(pjString);
  }

  public ensureDefinition(name: string, description: string) {
    if (!this._data) {
      this._data = {
        format_version: "1.12.0",
        render_controllers: {},
      };
    }
  }

  async save() {
    if (this._file === undefined) {
      return;
    }

    await this.persist();

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

    this._data = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}

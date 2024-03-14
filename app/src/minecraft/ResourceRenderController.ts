// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import IResourceRenderControllerDefinition from "./IResourceRenderController";

export default class ResourceRenderController {
  private _file?: IFile;
  private _isLoaded: boolean = false;

  public definition?: IResourceRenderControllerDefinition;

  private _onLoaded = new EventDispatcher<ResourceRenderController, ResourceRenderController>();

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

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<ResourceRenderController, ResourceRenderController>
  ) {
    let rc: ResourceRenderController | undefined = undefined;

    if (file.manager === undefined) {
      rc = new ResourceRenderController();

      rc.file = file;

      file.manager = rc;
    }

    if (file.manager !== undefined && file.manager instanceof ResourceRenderController) {
      rc = file.manager as ResourceRenderController;

      if (!rc.isLoaded && loadHandler) {
        rc.onLoaded.subscribe(loadHandler);
      }

      await rc.load();
    }

    return rc;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const pjString = JSON.stringify(this.definition, null, 2);

    this._file.setContent(pjString);
  }

  public ensureDefinition(name: string, description: string) {
    if (!this.definition) {
      this.definition = {
        format_version: "1.12.0",
        render_controllers: {},
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

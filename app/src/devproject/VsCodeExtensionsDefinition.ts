// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import { IVsCodeExtensions } from "./IVsCodeExtensions";

export const VsCodeRecommendations = [
  "esbenp.prettier-vscode",
  "blockceptionltd.blockceptionvscodeminecraftbedrockdevelopmentextension",
  "mojang-studios.minecraft-debugger",
];

export default class VsCodeExtensionsDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public definition?: IVsCodeExtensions;

  private _onLoaded = new EventDispatcher<VsCodeExtensionsDefinition, VsCodeExtensionsDefinition>();

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

  public get id() {
    return this._id;
  }

  public set id(newId: string | undefined) {
    this._id = newId;
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<VsCodeExtensionsDefinition, VsCodeExtensionsDefinition>
  ) {
    let dt: VsCodeExtensionsDefinition | undefined;

    if (file.manager === undefined) {
      dt = new VsCodeExtensionsDefinition();

      dt.file = file;

      file.manager = dt;
    }

    if (file.manager !== undefined && file.manager instanceof VsCodeExtensionsDefinition) {
      dt = file.manager as VsCodeExtensionsDefinition;

      if (!dt.isLoaded && loadHandler) {
        dt.onLoaded.subscribe(loadHandler);
      }

      await dt.load();

      return dt;
    }

    return dt;
  }

  async persist() {
    if (this._file === undefined) {
      return;
    }

    const extensionsJsonString = JSON.stringify(this.definition, null, 2);

    this._file.setContent(extensionsJsonString);
  }

  async save() {
    if (this._file === undefined) {
      return;
    }

    this.persist();

    await this._file.saveContent(false);
  }

  async hasMinContent() {
    await this.load();

    if (!this.definition || !this.definition.recommendations) {
      return false;
    }

    for (const reco of VsCodeRecommendations) {
      if (!this.definition.recommendations.includes(reco)) {
        return false;
      }
    }

    return true;
  }

  async ensureMinContent() {
    const hasRecos = await this.hasMinContent();

    if (hasRecos) {
      return true;
    }

    if (!this.definition) {
      this.definition = { recommendations: [] };
    }

    if (!this.definition.recommendations) {
      this.definition.recommendations = [];
    }

    for (const reco of VsCodeRecommendations) {
      if (!this.definition.recommendations.includes(reco)) {
        this.definition.recommendations.push(reco);
      }
    }

    return this.definition;
  }

  async load() {
    if (this._file === undefined || this._isLoaded) {
      return;
    }

    await this._file.loadContent();

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this.id = this._file.name;

    try {
      const data: any = JSON.parse(this._file.content);

      this.definition = data;
    } catch (e) {
      Log.fail("Could not parse vscode launch JSON " + e);
    }

    this._isLoaded = true;
  }
}

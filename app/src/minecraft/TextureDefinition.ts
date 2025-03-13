// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import IDefinition from "./IDefinition";
import { AllowedExtensions } from "../storage/StorageUtilities";

export default class TextureDefinition implements IDefinition {
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<TextureDefinition, TextureDefinition>();

  public id: string | undefined;

  public get data() {
    if (!this._file || !this._file.content || typeof this._file.content === "string") {
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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<TextureDefinition, TextureDefinition>) {
    let texd: TextureDefinition | undefined;

    if (file.manager === undefined) {
      texd = new TextureDefinition();

      texd.file = file;

      file.manager = texd;
    }

    if (file.manager !== undefined && file.manager instanceof TextureDefinition) {
      texd = file.manager as TextureDefinition;

      if (!texd.isLoaded && loadHandler) {
        texd.onLoaded.subscribe(loadHandler);
      }

      await texd.load();
    }

    return texd;
  }

  getReferencePath() {
    if (!this._file) {
      return undefined;
    }

    let projectPath = this._file.storageRelativePath;

    return TextureDefinition.getTexturePath(projectPath);
  }

  static canonicalizeTexturePath(projectPath: string | undefined) {
    if (projectPath === undefined) {
      return undefined;
    }

    projectPath = projectPath.toLowerCase();

    const lastPeriod = projectPath.lastIndexOf(".");

    if (lastPeriod >= 0) {
      const removedPart = projectPath.substring(lastPeriod + 1);

      if (AllowedExtensions.includes(removedPart)) {
        projectPath = projectPath.substring(0, lastPeriod);
      }
    }

    // particles has atlas.terrain in bedrock
    // JsonUI has # and $ as variabbles
    /*Log.assert(
      projectPath.startsWith("textures/") ||
        projectPath.startsWith("images/") ||
        projectPath.startsWith("#") ||
        projectPath.startsWith("$") ||
        projectPath.startsWith("atlas"),
      "Unexpected texture path: " + projectPath
    );*/

    return projectPath;
  }

  static getTexturePath(projectPath: string) {
    const lastPeriod = projectPath.lastIndexOf(".");

    if (lastPeriod >= 0) {
      projectPath = projectPath.substring(0, lastPeriod);
    }

    const ppLower = projectPath.toLowerCase();

    const texturesIndex = ppLower.indexOf("/textures/");

    if (texturesIndex < 0) {
      return undefined;
    }

    return projectPath.substring(texturesIndex + 1);
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

    await this._file.loadContent();

    if (!this._file.content || typeof this._file.content === "string") {
      return;
    }

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}

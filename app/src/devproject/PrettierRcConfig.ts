// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";

export const PrettierRcDefaultSettings: { [name: string]: any } = {
  trailingComma: "es5",
  tabWidth: 2,
  semi: true,
  singleQuote: false,
  bracketSpacing: true,
  arrowParens: "always",
  printWidth: 120,
  endOfLine: "auto",
};

export default class PrettierRcConfig {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public definition?: { [name: string]: any };

  private _onLoaded = new EventDispatcher<PrettierRcConfig, PrettierRcConfig>();

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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<PrettierRcConfig, PrettierRcConfig>) {
    let dt: PrettierRcConfig | undefined;

    if (file.manager === undefined) {
      dt = new PrettierRcConfig();

      dt.file = file;

      file.manager = dt;
    }

    if (file.manager !== undefined && file.manager instanceof PrettierRcConfig) {
      dt = file.manager as PrettierRcConfig;

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

    const prettierRcJsonString = JSON.stringify(this.definition, null, 2);

    this._file.setContent(prettierRcJsonString);
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

    if (!this.definition) {
      return false;
    }

    for (const settingName in PrettierRcDefaultSettings) {
      if (!this.definition[settingName]) {
        return false;
      }
    }

    return true;
  }

  async ensureMinContent() {
    const hasSettings = await this.hasMinContent();

    if (hasSettings) {
      return true;
    }

    if (!this.definition) {
      this.definition = PrettierRcDefaultSettings;
    }

    for (const settingName in PrettierRcDefaultSettings) {
      if (!this.definition[settingName]) {
        this.definition[settingName] = PrettierRcDefaultSettings[settingName];
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

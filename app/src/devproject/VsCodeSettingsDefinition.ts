// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";

export const VsCodeDefaultSettings: { [name: string]: any } = {
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
  },
  "git.ignoreLimitWarning": true,
  "editor.formatOnSave": true,
  "search.exclude": {
    "**/.git": true,
    "**/node_modules": true,
    "**/dist": true,
    "**/lib": true,
  },
  "files.exclude": {
    "**/.git": true,
    "**/.DS_Store": true,
    "**/node_modules": true,
  },
  "cSpell.words": ["gametest", "gametests", "mcaddon"],
  "editor.tabSize": 2,
  "eslint.experimental.useFlatConfig": true,
};

export default class VsCodeSettingsDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public definition?: { [name: string]: any };

  private _onLoaded = new EventDispatcher<VsCodeSettingsDefinition, VsCodeSettingsDefinition>();

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
    loadHandler?: IEventHandler<VsCodeSettingsDefinition, VsCodeSettingsDefinition>
  ) {
    let dt: VsCodeSettingsDefinition | undefined;

    if (file.manager === undefined) {
      dt = new VsCodeSettingsDefinition();

      dt.file = file;

      file.manager = dt;
    }

    if (file.manager !== undefined && file.manager instanceof VsCodeSettingsDefinition) {
      dt = file.manager as VsCodeSettingsDefinition;

      if (!dt.isLoaded && loadHandler) {
        dt.onLoaded.subscribe(loadHandler);
      }

      await dt.load();

      return dt;
    }

    return dt;
  }

  async persist(): Promise<boolean> {
    if (this._file === undefined) {
      return false;
    }

    Log.assert(this.definition !== null, "VCSP");

    if (!this.definition) {
      return false;
    }

    return this._file.setObjectContentIfSemanticallyDifferent(this.definition);
  }

  async save() {
    if (this._file === undefined) {
      return;
    }

    if (await this.persist()) {
      await this._file.saveContent(false);
    }
  }

  async hasMinContent() {
    await this.load();

    if (!this.definition) {
      return false;
    }

    for (const settingName in VsCodeDefaultSettings) {
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
      this.definition = VsCodeDefaultSettings;
    }

    for (const settingName in VsCodeDefaultSettings) {
      if (!this.definition[settingName]) {
        this.definition[settingName] = VsCodeDefaultSettings[settingName];
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

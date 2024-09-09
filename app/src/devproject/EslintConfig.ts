// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import Project from "../app/Project";

const EslintDefaultConfig = [
  "import minecraftLinting from 'eslint-plugin-minecraft-linting';",
  "import tsParser from '@typescript-eslint/parser';",
  "import ts from '@typescript-eslint/eslint-plugin';",
  "export default [",
  "  {",
  "    files: ['scripts/**/*.ts'],",
  "    languageOptions: {",
  "      parser: tsParser,",
  "      ecmaVersion: 'latest',",
  "    },",
  "    plugins: {",
  "      ts,",
  "      'minecraft-linting': minecraftLinting,",
  "    },",
  "    rules: {",
  "      'minecraft-linting/avoid-unnecessary-command': 'error',",
  "    },",
  "  },",
  "];",
];

export default class EslintConfig {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<EslintConfig, EslintConfig>();

  public project: Project | undefined = undefined;

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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<EslintConfig, EslintConfig>) {
    let justf: EslintConfig | undefined;

    if (file.manager === undefined) {
      justf = new EslintConfig();

      justf.file = file;

      file.manager = justf;
    }

    if (file.manager !== undefined && file.manager instanceof EslintConfig) {
      justf = file.manager as EslintConfig;

      if (!justf.isLoaded && loadHandler) {
        justf.onLoaded.subscribe(loadHandler);
      }

      await justf.load();

      return justf;
    }

    return justf;
  }

  async ensureDefault() {
    if (this._file === undefined) {
      return;
    }

    await this.load();

    this._file.setContent(EslintConfig.getDefaultContent());
  }

  async ensureMin() {
    if (this._file === undefined) {
      return;
    }

    await this.load();

    if (!this._file.content || typeof this._file.content !== "string") {
      this._file.setContent(EslintConfig.getDefaultContent());
    }
  }

  async persist() {}

  async save() {
    if (this._file === undefined) {
      return;
    }

    await this._file.saveContent(false);
  }

  async load() {
    if (this._file === undefined || this._isLoaded) {
      return;
    }

    await this._file.loadContent(true);

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this._isLoaded = true;
  }

  static getDefaultContent() {
    return EslintDefaultConfig.join("\r\n").replace(/'/gi, '"');
  }
}

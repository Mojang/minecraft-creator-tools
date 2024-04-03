// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";

import LocToken from "./LocToken";
import StorageUtilities from "../storage/StorageUtilities";
import ZipStorage from "../storage/ZipStorage";

export default class Lang {
  private _file?: IFile;
  private _containerName?: string;
  private _language?: string;
  private _isLoaded: boolean = false;

  public tokens: { [name: string]: LocToken } = {};

  private _onLoaded = new EventDispatcher<Lang, Lang>();

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

  public get containerName() {
    return this._containerName;
  }

  public get language() {
    return this._language;
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<Lang, Lang>) {
    let lang: Lang | undefined;

    if (file.manager === undefined) {
      lang = new Lang();

      lang.file = file;

      file.manager = lang;
    }

    if (file.manager !== undefined && file.manager instanceof Lang) {
      lang = file.manager as Lang;

      if (!lang.isLoaded && loadHandler) {
        lang.onLoaded.subscribe(loadHandler);
      }

      await lang.load();
    }

    return lang;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    let content = this._file.content;

    if (content === undefined || content === null || content instanceof Uint8Array) {
      content = "";
    }

    for (const tokName in this.tokens) {
      const tok = this.tokens[tokName];

      if (tok && tok.isModified) {
        const tokStart: number = content.indexOf(tokName + "=");

        if (tokStart >= 0) {
          const tokEndR = content.indexOf("\r", tokStart + tokName.length + 1);
          let tokEnd = content.indexOf("\n", tokStart + tokName.length + 1);

          if (tokEndR > tokStart && tokEndR === tokEnd - 1) {
            tokEnd = tokEndR;
          }

          if (tokEnd < 0) {
            tokEnd = content.length;
          }

          content = content.substring(0, tokStart + tokName.length + 1) + tok.value + content.substring(tokEnd);
        } else {
          // Try to insert a new token into areas that are similarly named.
          const periodInName = tokName.lastIndexOf(".");
          let wasInserted = false;

          if (periodInName >= 0) {
            const findSimilar: number = content.lastIndexOf("\n" + tokName.substring(0, periodInName + 1));

            if (findSimilar >= 0) {
              content =
                content.substring(0, findSimilar + 1) +
                tokName +
                "=" +
                tok.value +
                "\r\n" +
                content.substring(findSimilar + 1);
              wasInserted = true;
            }
          }

          if (!wasInserted) {
            content += "\r\n" + tokName + "=" + tok.value;
          }
        }

        tok.isModified = false;
      }
    }

    this._file.setContent(content);
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

    const content = this._file.content;

    this._language = StorageUtilities.getBaseFromName(this._file.name);
    let dir = this._file.parentFolder;

    if (dir) {
      if (dir.name === "texts" && dir.parentFolder) {
        dir = dir.parentFolder;
      }

      if (dir.name === "" && !dir.parentFolder && (dir.storage as ZipStorage).name) {
        this._containerName = (dir.storage as ZipStorage).name;
      } else {
        this._containerName = dir.name;
      }
    }

    const lines = content.split("\n");

    for (let line of lines) {
      line = line.trim();
      const lastEqual = line.indexOf("=");

      if (lastEqual > 0 && lastEqual < line.length - 1) {
        const tokenName = line.substring(0, lastEqual);
        const tokenVal = line.substring(lastEqual + 1);
        this.tokens[tokenName] = {
          value: tokenVal,
          isModified: false,
        };
      }
    }

    this._isLoaded = true;
  }
}

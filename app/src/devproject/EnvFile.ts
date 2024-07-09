// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import Project from "../app/Project";

export default class EnvFile {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<EnvFile, EnvFile>();

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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<EnvFile, EnvFile>) {
    let envf: EnvFile | undefined;

    if (file.manager === undefined) {
      envf = new EnvFile();

      envf.file = file;

      file.manager = envf;
    }

    if (file.manager !== undefined && file.manager instanceof EnvFile) {
      envf = file.manager as EnvFile;

      if (!envf.isLoaded && loadHandler) {
        envf.onLoaded.subscribe(loadHandler);
      }

      await envf.load();

      return envf;
    }

    return envf;
  }

  async ensureEnvFile(project: Project) {
    if (this._file === undefined) {
      return;
    }

    await this.load();

    let content = this._file?.content;

    if (content === null) {
      content = "";
    }

    const folder = await project.getDefaultBehaviorPackFolder();

    if (folder) {
      if (content && typeof content === "string") {
        let projectNameIndex = content.indexOf('PROJECT_NAME="');

        if (projectNameIndex >= 0) {
          let projectNameNewQuote = content.indexOf('"', 14);

          if (projectNameNewQuote > projectNameIndex) {
          }
        } else {
          if (!content.endsWith("\n")) {
            content += "\r\n";
          }

          content = content + 'PROJECT_NAME="' + folder.name + '"\r\n';
        }

        let minecraftProductIndex = content.indexOf('MINECRAFT_PRODUCT="');

        if (minecraftProductIndex < 0) {
          if (!content.endsWith("\n")) {
            content += "\r\n";
          }

          content = content + 'MINECRAFT_PRODUCT="BedrockUWP"\r\n';
        }
      }
    }
  }

  async persist() {
    if (this._file === undefined) {
      return;
    }
  }

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
}

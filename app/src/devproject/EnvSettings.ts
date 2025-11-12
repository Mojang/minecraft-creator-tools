// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile, { FileUpdateType } from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import Project from "../app/Project";
import { MinecraftTrack } from "../app/ICreatorToolsData";

export default class EnvSettings {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<EnvSettings, EnvSettings>();

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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<EnvSettings, EnvSettings>) {
    let envf: EnvSettings | undefined;

    if (file.manager === undefined) {
      envf = new EnvSettings();

      envf.file = file;

      file.manager = envf;
    }

    if (file.manager !== undefined && file.manager instanceof EnvSettings) {
      envf = file.manager as EnvSettings;

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

    if (content && typeof content === "string") {
    }
  }

  async persist(): Promise<boolean> {
    if (this._file === undefined) {
      return false;
    }

    return false;
  }

  async save() {
    if (this._file === undefined) {
      return;
    }

    if (this._file.isContentLoaded && this.project && this._file.content && typeof this._file.content === "string") {
      this._file.setContent(
        await EnvSettings.getContent(this.project, this._file.content),
        FileUpdateType.versionlessEdit
      );
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

  static async getContent(project: Project, content?: string) {
    if (content === undefined) {
      content = 'PROJECT_NAME=""\nMINECRAFT_PRODUCT="BedrockGDK"\nCUSTOM_DEPLOYMENT_PATH=""\n';
    }

    const folder = await project.getDefaultBehaviorPackFolder();

    if (folder) {
      let projectNameIndex = content.indexOf('PROJECT_NAME="');

      if (projectNameIndex >= 0) {
        let projectNameNewQuote = content.indexOf('"', projectNameIndex + 14);

        if (projectNameNewQuote > projectNameIndex) {
          content =
            content.substring(0, projectNameIndex) +
            'PROJECT_NAME="' +
            folder.name +
            "" +
            content.substring(projectNameNewQuote);
        }
      } else {
        if (!content.endsWith("\n")) {
          content += "\n";
        }

        content = content + 'PROJECT_NAME="' + folder.name + '"\n';
      }
    }

    let minecraftProductIndex = content.indexOf('MINECRAFT_PRODUCT="');
    const trackStr = project.track === MinecraftTrack.preview ? "PreviewGDK" : "BedrockGDK";

    if (minecraftProductIndex >= 0) {
      let minecraftProductIndexNextQuote = content.indexOf('"', minecraftProductIndex + 19);

      if (minecraftProductIndexNextQuote > minecraftProductIndex) {
        content =
          content.substring(0, minecraftProductIndex) +
          'MINECRAFT_PRODUCT="' +
          trackStr +
          content.substring(minecraftProductIndexNextQuote);
      }
    } else {
      if (!content.endsWith("\n")) {
        content += "\n";
      }

      content = content + 'MINECRAFT_PRODUCT="' + trackStr + '"\n';
    }

    return content;
  }
}

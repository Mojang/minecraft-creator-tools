// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import IDebugSettings from "./IDebugSettings";
import IVsCodeLaunch, { IVsCodeConfiguration } from "./IVsCodeLaunch";
import StorageUtilities from "../storage/StorageUtilities";

export default class VsCodeLaunchJson {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public definition?: IVsCodeLaunch;

  private _onLoaded = new EventDispatcher<VsCodeLaunchJson, VsCodeLaunchJson>();

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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<VsCodeLaunchJson, VsCodeLaunchJson>) {
    let dt: VsCodeLaunchJson | undefined = undefined;

    if (file.manager === undefined) {
      dt = new VsCodeLaunchJson();

      dt.file = file;

      file.manager = dt;
    }

    if (file.manager !== undefined && file.manager instanceof VsCodeLaunchJson) {
      dt = file.manager as VsCodeLaunchJson;

      if (!dt.isLoaded && loadHandler) {
        dt.onLoaded.subscribe(loadHandler);
      }

      await dt.load();

      return dt;
    }

    return dt;
  }

  async hasMinecraftDebugLaunch(debugSettings: IDebugSettings) {
    await this.load();

    if (!this.definition || !this.definition.configurations) {
      return false;
    }

    for (const config of this.definition.configurations) {
      if (config.type && config.type === "minecraft-js") {
        if (debugSettings.isServer && config.mode === "listen") {
          return false;
        }

        if (!debugSettings.isServer && config.mode !== "listen") {
          return false;
        }

        if (debugSettings.port && config.port !== debugSettings.port) {
          return false;
        }

        return true;
      }
    }

    return false;
  }

  async ensureMinecraftDebugLaunch(debugSettings: IDebugSettings) {
    const hasDebug = await this.hasMinecraftDebugLaunch(debugSettings);

    if (hasDebug) {
      return true;
    }

    if (!this.definition) {
      this.definition = {};
    }

    if (!this.definition.version || this.definition.version === "0.2.0") {
      this.definition.version = "0.3.0";
    }

    if (!this.definition.configurations) {
      this.definition.configurations = [];
    }

    let hasMinecraftConfig = false;
    for (const config of this.definition.configurations) {
      if (config.type === "minecraft-js") {
        this.applyDebugSettingsToConfig(config, debugSettings);
        hasMinecraftConfig = true;
      }
    }

    if (!hasMinecraftConfig) {
      const minecraftConfig = {
        type: "minecraft-js",
        port: debugSettings.port ? debugSettings.port : 19144,
      };

      this.applyDebugSettingsToConfig(minecraftConfig, debugSettings);

      this.definition.configurations.push(minecraftConfig);

      return true;
    }

    return hasMinecraftConfig;
  }

  private applyDebugSettingsToConfig(config: IVsCodeConfiguration, debugSettings: IDebugSettings) {
    if (debugSettings.isServer) {
      config.mode = undefined;
    } else {
      config.mode = "listen";
    }

    if (config.name === undefined) {
      config.name = "Debug with Minecraft";
    }

    if (config.preLaunchTask === undefined) {
      config.preLaunchTask = "build";
    }

    let bpName = debugSettings.behaviorPackFolderName;

    if (bpName === undefined) {
      bpName = "starterbp";
    }
    if (config.sourceMapRoot === undefined) {
      // eslint-disable-next-line no-template-curly-in-string
      config.sourceMapRoot = "${workspaceFolder}/build/behavior_packs/_" + bpName + "Debug/";
    }

    if (config.generatedSourceRoot === undefined) {
      // eslint-disable-next-line no-template-curly-in-string
      config.generatedSourceRoot = "${workspaceFolder}/build/behavior_packs/" + bpName + "/scripts/";
    }

    if (debugSettings.port) {
      config.port = debugSettings.port;
    }
  }

  async persist() {
    if (this._file === undefined) {
      return;
    }

    const launchJsonString = JSON.stringify(this.definition, null, 2);

    this._file.setContent(launchJsonString);
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

    this.id = this._file.name;

    this.definition = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}

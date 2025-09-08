// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import IDebugSettings from "./IDebugSettings";
import IVsCodeLaunch, { IVsCodeConfiguration } from "./IVsCodeLaunch";
import StorageUtilities from "../storage/StorageUtilities";
import Project from "../app/Project";
import BehaviorManifestDefinition from "../minecraft/BehaviorManifestDefinition";
import Log from "../core/Log";

export default class VsCodeLaunchDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public definition?: IVsCodeLaunch;

  private _onLoaded = new EventDispatcher<VsCodeLaunchDefinition, VsCodeLaunchDefinition>();

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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<VsCodeLaunchDefinition, VsCodeLaunchDefinition>) {
    let dt: VsCodeLaunchDefinition | undefined;

    if (file.manager === undefined) {
      dt = new VsCodeLaunchDefinition();

      dt.file = file;

      file.manager = dt;
    }

    if (file.manager !== undefined && file.manager instanceof VsCodeLaunchDefinition) {
      dt = file.manager as VsCodeLaunchDefinition;

      if (!dt.isLoaded && loadHandler) {
        dt.onLoaded.subscribe(loadHandler);
      }

      await dt.load();

      return dt;
    }

    return dt;
  }

  async hasMinContent(debugSettings?: IDebugSettings) {
    if (!debugSettings) {
      debugSettings = { isServer: false };
    }

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

  async ensureMinContent(debugSettings?: IDebugSettings) {
    if (!debugSettings) {
      debugSettings = { isServer: false };
    }

    const hasDebug = await this.hasMinContent(debugSettings);

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
        await this.applyDebugSettingsToConfig(config, debugSettings);
        hasMinecraftConfig = true;
      }
    }

    if (!hasMinecraftConfig) {
      const minecraftConfig = {
        type: "minecraft-js",
        port: debugSettings.port ? debugSettings.port : 19144,
      };

      await this.applyDebugSettingsToConfig(minecraftConfig, debugSettings);

      this.definition.configurations.push(minecraftConfig);

      return true;
    }

    return hasMinecraftConfig;
  }

  private async applyDebugSettingsToConfig(config: IVsCodeConfiguration, debugSettings: IDebugSettings) {
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

    if (!config.targetedModuleUuid && this.project) {
      const pack = await this.project.getDefaultBehaviorPack();
      if (pack) {
        if (pack.manifest instanceof BehaviorManifestDefinition) {
          const module = pack.manifest.getScriptModule();

          if (module) {
            config.targetedModuleUuid = module.uuid;
          }
        }
      }
    }

    if (!config.sourceMapRoot) {
      // eslint-disable-next-line no-template-curly-in-string
      config.sourceMapRoot = "${workspaceFolder}/dist/debug/";
    }

    if (!config.generatedSourceRoot) {
      // eslint-disable-next-line no-template-curly-in-string
      config.generatedSourceRoot = "${workspaceFolder}/dist/scripts/";
    }

    if (debugSettings.port) {
      config.port = debugSettings.port;
    }
  }

  async persist() {
    if (this._file === undefined) {
      return;
    }

    Log.assert(this.definition !== null, "VSLP");

    if (this.definition) {
      const launchJsonString = JSON.stringify(this.definition, null, 2);

      this._file.setContent(launchJsonString);
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

    this.id = this._file.name;

    this.definition = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}

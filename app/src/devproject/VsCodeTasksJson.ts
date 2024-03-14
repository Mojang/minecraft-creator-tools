// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import IVsCodeTasks from "./IVsCodeTasks";
import Utilities from "../core/Utilities";

export default class VsCodeTasksJson {
  private _file?: IFile;
  private _id?: string;
  private _version?: string;
  private _isLoaded: boolean = false;

  public definition?: IVsCodeTasks;

  private _onLoaded = new EventDispatcher<VsCodeTasksJson, VsCodeTasksJson>();

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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<VsCodeTasksJson, VsCodeTasksJson>) {
    let dt: VsCodeTasksJson | undefined = undefined;

    if (file.manager === undefined) {
      dt = new VsCodeTasksJson();

      dt.file = file;

      file.manager = dt;
    }

    if (file.manager !== undefined && file.manager instanceof VsCodeTasksJson) {
      dt = file.manager as VsCodeTasksJson;

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

  async hasMinecraftTasks() {
    await this.load();

    if (!this.definition || !this.definition.tasks) {
      return false;
    }

    for (const task of this.definition.tasks) {
      if (task.dependsOn && task.label === "build") {
        for (const dependsOn of task.dependsOn) {
          const strTask = Utilities.replaceAll(dependsOn.toLowerCase(), " ", "");

          if (strTask === "minecraft:deploy") {
            return true;
          }
        }
      }
    }

    return false;
  }

  async ensureMinecraftTasks() {
    const hasTasks = await this.hasMinecraftTasks();

    if (hasTasks) {
      return true;
    }

    if (!this.definition) {
      this.definition = {};
    }

    if (!this.definition.version) {
      this.definition.version = "2.0.0";
    }

    if (!this.definition.tasks) {
      this.definition.tasks = [];
    }

    let hasBuildDependsOn = false;
    for (const task of this.definition.tasks) {
      if (task.label === "build") {
        if (!task.dependsOn) {
          task.dependsOn = [];
        }

        for (const dependsOn of task.dependsOn) {
          const strTask = Utilities.replaceAll(dependsOn.toLowerCase(), " ", "");

          if (strTask === "minecraft:deploy") {
            hasBuildDependsOn = true;
          }
        }

        if (!hasBuildDependsOn) {
          task.dependsOn.push("minecraft: deploy");
          hasBuildDependsOn = true;
        }
      }
    }

    if (!hasBuildDependsOn) {
      this.definition.tasks.push({
        label: "build",
        dependsOrder: "sequence",
        dependsOn: ["minecraft: deploy"],
      });

      return true;
    }

    return hasBuildDependsOn;
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

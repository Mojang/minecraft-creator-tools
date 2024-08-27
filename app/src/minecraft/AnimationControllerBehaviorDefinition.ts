// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";
import IAnimationControllerBehaviorWrapper, {
  IAnimationControllerBehaviorStateWrapper,
} from "./IAnimationControllerBehavior";

export default class AnimationControllerBehaviorDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public data?: IAnimationControllerBehaviorWrapper;

  private _onLoaded = new EventDispatcher<
    AnimationControllerBehaviorDefinition,
    AnimationControllerBehaviorDefinition
  >();

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

  public get id() {
    return this._id;
  }

  public set id(newId: string | undefined) {
    this._id = newId;
  }

  public get shortId() {
    if (this._id !== undefined) {
      if (this._id.startsWith("minecraft:")) {
        return this._id.substring(10, this._id.length);
      }

      return this._id;
    }

    return undefined;
  }

  public async getFormatVersionIsCurrent() {
    const fv = this.getFormatVersion();

    if (fv === undefined || fv.length !== 3) {
      return false;
    }

    return await Database.isRecentVersionFromVersionArray(fv);
  }

  getAllStates() {
    const states: IAnimationControllerBehaviorStateWrapper[] = [];

    if (this.data && this.data.animation_controllers) {
      for (const acName in this.data.animation_controllers) {
        const ac = this.data.animation_controllers[acName];

        if (ac && ac.states) {
          for (const stateName in ac.states) {
            const state = ac.states[stateName];

            if (state) {
              states.push({
                id: stateName,
                animationControllerId: acName,
                state: state,
              });
            }
          }
        }
      }
    }

    return states;
  }
  public getFormatVersion(): number[] | undefined {
    if (!this.data || !this.data.format_version) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this.data.format_version);
  }

  setBehaviorPackFormatVersion(versionStr: string) {
    this._ensureDataInitialized();

    if (this.data) {
      this.data.format_version = versionStr;
    }
  }

  _ensureDataInitialized() {
    if (this.data === undefined) {
      this.data = {
        format_version: "1.12.0",
        animation_controllers: {},
      };
    }
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<AnimationControllerBehaviorDefinition, AnimationControllerBehaviorDefinition>
  ) {
    let rbd: AnimationControllerBehaviorDefinition | undefined;

    if (file.manager === undefined) {
      rbd = new AnimationControllerBehaviorDefinition();

      rbd.file = file;

      file.manager = rbd;
    }

    if (file.manager !== undefined && file.manager instanceof AnimationControllerBehaviorDefinition) {
      rbd = file.manager as AnimationControllerBehaviorDefinition;

      if (!rbd.isLoaded && loadHandler) {
        rbd.onLoaded.subscribe(loadHandler);
      }

      await rbd.load();
    }

    return rbd;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const bpString = JSON.stringify(this.data, null, 2);

    this._file.setContent(bpString);
  }

  async load() {
    if (this._file === undefined || this._isLoaded) {
      return;
    }

    await this._file.loadContent();

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this.data = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}

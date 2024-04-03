// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import IBehaviorAnimationControllerWrapper, {
  IBehaviorAnimationControllerStateWrapper,
} from "./IBehaviorAnimationController";
import MinecraftUtilities from "./MinecraftUtilities";

export default class BehaviorAnimationController {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public wrapper?: IBehaviorAnimationControllerWrapper;

  private _onLoaded = new EventDispatcher<BehaviorAnimationController, BehaviorAnimationController>();

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

  public async getFormatVersionIsCurrent() {
    const fv = this.getFormatVersion();

    if (fv === undefined || fv.length !== 3) {
      return false;
    }

    return fv[0] > 1 || fv[1] >= 10;
  }

  public getFormatVersion(): number[] | undefined {
    if (!this.wrapper) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this.wrapper.format_version);
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<BehaviorAnimationController, BehaviorAnimationController>
  ) {
    let ac: BehaviorAnimationController | undefined;

    if (file.manager === undefined) {
      ac = new BehaviorAnimationController();

      ac.file = file;

      file.manager = ac;
    }

    if (file.manager !== undefined && file.manager instanceof BehaviorAnimationController) {
      ac = file.manager as BehaviorAnimationController;

      if (!ac.isLoaded && loadHandler) {
        ac.onLoaded.subscribe(loadHandler);
      }

      await ac.load();
    }

    return ac;
  }

  getAllStates() {
    const states: IBehaviorAnimationControllerStateWrapper[] = [];

    if (this.wrapper && this.wrapper.animation_controllers) {
      for (const acName in this.wrapper.animation_controllers) {
        const ac = this.wrapper.animation_controllers[acName];

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

  persist() {
    if (this._file === undefined) {
      return;
    }

    const pjString = JSON.stringify(this.wrapper, null, 2);

    this._file.setContent(pjString);
  }

  public ensureDefinition(name: string, description: string) {
    if (!this.wrapper) {
      this.wrapper = {
        format_version: "1.12.0",
        animation_controllers: {},
      };
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

    this.wrapper = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}

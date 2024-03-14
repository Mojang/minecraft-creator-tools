// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import IBehaviorAnimationControllerDefinition, {
  IBehaviorAnimationControllerStateWrapper,
} from "./IBehaviorAnimationController";

export default class BehaviorAnimationController {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public definition?: IBehaviorAnimationControllerDefinition;

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

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<BehaviorAnimationController, BehaviorAnimationController>
  ) {
    let ac: BehaviorAnimationController | undefined = undefined;

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

    if (this.definition && this.definition.animation_controllers) {
      for (const acName in this.definition.animation_controllers) {
        const ac = this.definition.animation_controllers[acName];

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

    const pjString = JSON.stringify(this.definition, null, 2);

    this._file.setContent(pjString);
  }

  public ensureDefinition(name: string, description: string) {
    if (!this.definition) {
      this.definition = {
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

    this.definition = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}

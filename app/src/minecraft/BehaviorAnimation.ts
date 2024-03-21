// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import IBehaviorAnimationWrapper, { IBehaviorAnimationTimelineWrapper } from "./IBehaviorAnimation";
import MinecraftUtilities from "./MinecraftUtilities";

export default class BehaviorAnimation {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public wrapper?: IBehaviorAnimationWrapper;

  private _onLoaded = new EventDispatcher<BehaviorAnimation, BehaviorAnimation>();

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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<BehaviorAnimation, BehaviorAnimation>) {
    let ac: BehaviorAnimation | undefined = undefined;

    if (file.manager === undefined) {
      ac = new BehaviorAnimation();

      ac.file = file;

      file.manager = ac;
    }

    if (file.manager !== undefined && file.manager instanceof BehaviorAnimation) {
      ac = file.manager as BehaviorAnimation;

      if (!ac.isLoaded && loadHandler) {
        ac.onLoaded.subscribe(loadHandler);
      }

      await ac.load();
    }

    return ac;
  }

  getAllTimeline() {
    const timelines: IBehaviorAnimationTimelineWrapper[] = [];

    if (this.wrapper && this.wrapper.animations) {
      for (const aName in this.wrapper.animations) {
        const anim = this.wrapper.animations[aName];

        if (anim && anim.timeline) {
          for (const timestamp in anim.timeline) {
            const timeline = anim.timeline[timestamp];
            if (timeline) {
              timelines.push({
                animationId: aName,
                timestamp: timestamp,
                timeline: timeline,
              });
            }
          }
        }
      }
    }

    return timelines;
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
        animations: {},
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

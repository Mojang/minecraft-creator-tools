// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import IDialogueWrapper, { IDialogueSceneButton } from "./IDialogue";
import Log from "../core/Log";

export default class Dialogue {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public definition?: IDialogueWrapper;

  private _onLoaded = new EventDispatcher<Dialogue, Dialogue>();

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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<Dialogue, Dialogue>) {
    let dia: Dialogue | undefined;

    if (file.manager === undefined) {
      dia = new Dialogue();

      dia.file = file;

      file.manager = dia;
    }

    if (file.manager !== undefined && file.manager instanceof Dialogue) {
      dia = file.manager as Dialogue;

      if (!dia.isLoaded) {
        if (loadHandler) {
          dia.onLoaded.subscribe(loadHandler);
        }

        await dia.load();
      }
    }

    return dia;
  }

  getAllButtons() {
    const buttons: IDialogueSceneButton[] = [];

    if (
      this.definition &&
      this.definition["minecraft:npc_dialogue"] &&
      Array.isArray(this.definition["minecraft:npc_dialogue"].scenes)
    ) {
      for (const scene of this.definition["minecraft:npc_dialogue"].scenes) {
        if (scene && scene.buttons && Array.isArray(scene.buttons)) {
          for (const button of scene.buttons) {
            buttons.push(button);
          }
        }
      }
    }

    return buttons;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    Log.assert(this.definition !== null, "DGUEP");

    if (this.definition) {
      const pjString = JSON.stringify(this.definition, null, 2);

      this._file.setContent(pjString);
    }
  }

  public ensureDefinition(name: string, description: string) {
    if (!this.definition) {
      this.definition = {
        format_version: "1.12.0",
        "minecraft:npc_dialogue": {
          scenes: [],
        },
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

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this.definition = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}

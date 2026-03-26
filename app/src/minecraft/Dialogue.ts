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
  private _loadedWithComments: boolean = false;

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

  persist(): boolean {
    if (this._file === undefined) {
      return false;
    }

    Log.assert(this.definition !== null, "DGUEP");

    if (!this.definition) {
      return false;
    }

    return this._file.setObjectContentIfSemanticallyDifferent(this.definition);
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

    if (this.persist()) {
      await this._file.saveContent(false);
    }
  }

  /**
   * Loads the definition from the file.
   * @param preserveComments If true, uses comment-preserving JSON parsing for edit/save cycles.
   *                         If false (default), uses efficient standard JSON parsing.
   *                         Can be called again with true to "upgrade" a read-only load to read/write.
   */
  async load(preserveComments: boolean = false) {
    // If already loaded with comments, we have the "best" version - nothing more to do
    if (this._isLoaded && this._loadedWithComments) {
      return;
    }

    // If already loaded without comments and caller doesn't need comments, we're done
    if (this._isLoaded && !preserveComments) {
      return;
    }

    if (this._file === undefined) {
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      this._isLoaded = true;
      this._loadedWithComments = preserveComments;
      this._onLoaded.dispatch(this, this);
      return;
    }

    // Use comment-preserving parser only when needed for editing
    this.definition = preserveComments
      ? StorageUtilities.getJsonObjectWithComments(this._file)
      : StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
    this._loadedWithComments = preserveComments;
    this._onLoaded.dispatch(this, this);
  }
}

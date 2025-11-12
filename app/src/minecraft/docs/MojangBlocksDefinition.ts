// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../../storage/IFile";
import Log from "../../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../../storage/StorageUtilities";
import Database from "../Database";
import IFolder from "../../storage/IFolder";
import IMojangBlocks from "./IMojangBlocks";

export default class MojangBlocksDefinition {
  private _data?: IMojangBlocks;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<MojangBlocksDefinition, MojangBlocksDefinition>();

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

  static async load(isPreview?: boolean) {
    let metadataFolder: IFolder | undefined | null = undefined;

    if (isPreview) {
      metadataFolder = await Database.loadPreviewMetadataFolder();
    } else {
      metadataFolder = await Database.loadReleaseMetadataFolder();
    }

    if (!metadataFolder) {
      return undefined;
    }

    const blocksFile = await metadataFolder.ensureFileFromRelativePath("/vanilladata_modules/mojang_blocks.json");

    if (!blocksFile) {
      return undefined;
    }

    if (!(await blocksFile.exists())) {
      return undefined;
    }

    const mojangBlocksDef = await MojangBlocksDefinition.ensureOnFile(blocksFile);

    return mojangBlocksDef;
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<MojangBlocksDefinition, MojangBlocksDefinition>) {
    let mbd: MojangBlocksDefinition | undefined;

    if (file.manager === undefined) {
      mbd = new MojangBlocksDefinition();

      mbd.file = file;

      file.manager = mbd;
    }

    if (file.manager !== undefined && file.manager instanceof MojangBlocksDefinition) {
      mbd = file.manager as MojangBlocksDefinition;
      if (!mbd.isLoaded) {
        if (loadHandler) {
          mbd.onLoaded.subscribe(loadHandler);
        }

        await mbd.loadBlocks();
      }
    }

    return mbd;
  }

  async loadBlocks() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      Log.unexpectedUndefined("LDDF");
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (!this._file.content || this._file.content instanceof Uint8Array) {
      return;
    }

    let data: any = {};

    let result = StorageUtilities.getJsonObject(this._file);

    if (result) {
      data = result;
    }

    this._data = data;

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}

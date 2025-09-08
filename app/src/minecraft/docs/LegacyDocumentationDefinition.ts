// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../../storage/IFile";
import Log from "../../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../../storage/StorageUtilities";
import ILegacyDocumentationNode from "./ILegacyDocumentation";
import Database from "../Database";
import IFolder from "../../storage/IFolder";

export default class LegacyDocumentationDefinition {
  private _data?: ILegacyDocumentationNode;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<LegacyDocumentationDefinition, LegacyDocumentationDefinition>();

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

  static async loadNode(catalog: string, nodePath: string, isPreview?: boolean) {
    let metadataFolder: IFolder | undefined | null = undefined;

    if (isPreview) {
      metadataFolder = await Database.loadPreviewMetadataFolder();
    } else {
      metadataFolder = await Database.loadReleaseMetadataFolder();
    }

    if (!metadataFolder) {
      return undefined;
    }

    const docFile = await metadataFolder.ensureFileFromRelativePath("/doc_modules/" + catalog + ".json");

    if (!docFile) {
      return undefined;
    }

    if (!(await docFile.exists())) {
      return undefined;
    }

    const legacyDocDef = await LegacyDocumentationDefinition.ensureOnFile(docFile);

    if (!legacyDocDef) {
      return undefined;
    }

    return legacyDocDef.getNode(nodePath);
  }

  getNode(nodePath: string) {
    if (!this._data) {
      return;
    }

    const nodeEntries = nodePath.split("/");
    let curNode = this._data;

    for (let nodeEntry of nodeEntries) {
      if (nodeEntry.length > 0) {
        nodeEntry = nodeEntry.toLowerCase();

        if (!curNode.nodes || curNode.nodes.length === 0) {
          return undefined;
        }

        let foundNextNode = false;

        for (const node of curNode.nodes) {
          if (
            !foundNextNode &&
            ((node.name && node.name.toLowerCase() === nodeEntry) ||
              (node.examples_title && node.examples_title.toLowerCase() === nodeEntry))
          ) {
            curNode = node;
            foundNextNode = true;
          }
        }

        if (!foundNextNode) {
          return undefined;
        }
      }
    }

    return curNode;
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<LegacyDocumentationDefinition, LegacyDocumentationDefinition>
  ) {
    let ldd: LegacyDocumentationDefinition | undefined;

    if (file.manager === undefined) {
      ldd = new LegacyDocumentationDefinition();

      ldd.file = file;

      file.manager = ldd;
    }

    if (file.manager !== undefined && file.manager instanceof LegacyDocumentationDefinition) {
      ldd = file.manager as LegacyDocumentationDefinition;

      if (!ldd.isLoaded) {
        if (loadHandler) {
          ldd.onLoaded.subscribe(loadHandler);
        }

        await ldd.load();
      }
    }

    return ldd;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const defString = JSON.stringify(this._data, null, 2);

    this._file.setContent(defString);
  }

  async load() {
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

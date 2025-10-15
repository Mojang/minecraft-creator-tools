// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IJsonUIControl, IJsonUIScreen } from "./IJsonUIScreen";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import Utilities from "../core/Utilities";
import Database from "./Database";
import TextureDefinition from "./TextureDefinition";

export default class JsonUIResourceDefinition {
  public jsonUIScreen?: IJsonUIScreen;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<JsonUIResourceDefinition, JsonUIResourceDefinition>();

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

  public get namespaceId() {
    if (!this.jsonUIScreen || !this.jsonUIScreen["namespace"]) {
      return undefined;
    }

    return this.jsonUIScreen["namespace"];
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<JsonUIResourceDefinition, JsonUIResourceDefinition>
  ) {
    let et: JsonUIResourceDefinition | undefined;

    if (file.manager === undefined) {
      et = new JsonUIResourceDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof JsonUIResourceDefinition) {
      et = file.manager as JsonUIResourceDefinition;

      if (!et.isLoaded) {
        if (loadHandler) {
          et.onLoaded.subscribe(loadHandler);
        }

        await et.load();
      }
    }

    return et;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    if (!this.jsonUIScreen) {
      Log.unexpectedUndefined("ITRDP");
      return;
    }

    const defString = JSON.stringify(this.jsonUIScreen, null, 2);

    this._file.setContent(defString);
  }

  getControlRefs() {
    const namespaceId = this.namespaceId;
    const jsonUITextureRefs: string[] = [];

    if (namespaceId && this.jsonUIScreen) {
      for (const jsonControlId in this.jsonUIScreen) {
        const jsonControl = this.jsonUIScreen[jsonControlId] as IJsonUIControl;

        if (jsonControlId !== "namespace" && jsonControl && jsonControl.texture) {
          if (!jsonUITextureRefs.includes(jsonControlId)) {
            jsonUITextureRefs.push(jsonControlId);
          }
        }
      }
    }

    return jsonUITextureRefs;
  }

  getTexturePaths() {
    const texturePaths: string[] = [];

    if (this.jsonUIScreen) {
      this.addTexturesFromArrayOfKeyPaths([this.jsonUIScreen], texturePaths);
    }

    return texturePaths;
  }

  addTexturesFromArrayOfKeyPaths(controlSets: { [name: string]: IJsonUIControl | string }[], texturePaths: string[]) {
    if (!Array.isArray(controlSets)) {
      return;
    }

    for (const controlSet of controlSets) {
      for (const key in controlSet) {
        const control = controlSet[key];

        if (key !== "namespace" && key !== "controls") {
          if (typeof control === "string") {
            texturePaths.push(control);
          } else {
            if (control.texture) {
              const tex = TextureDefinition.canonicalizeTexturePath(control.texture);

              if (tex) {
                texturePaths.push(tex);
              }
            }
            if (control.controls) {
              this.addTexturesFromArrayOfKeyPaths(control.controls, texturePaths);
            }
          }
        }
      }
    }
  }

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      Log.unexpectedUndefined("PERPF");
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

    this.jsonUIScreen = data;

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }

  getPackRootFolder() {
    let packRootFolder = undefined;
    if (this.file && this.file.parentFolder) {
      let parentFolder = this.file.parentFolder;

      packRootFolder = StorageUtilities.getParentOfParentFolderNamed("ui", parentFolder);
    }

    return packRootFolder;
  }

  async addChildItems(project: Project, item: ProjectItem) {
    const itemsCopy = project.getItemsCopy();

    let packRootFolder = this.getPackRootFolder();

    let textureList = this.getTexturePaths();

    if (textureList.length > 0) {
      for (const candItem of itemsCopy) {
        if (
          (candItem.itemType === ProjectItemType.texture || candItem.itemType === ProjectItemType.uiTexture) &&
          packRootFolder &&
          textureList
        ) {
          if (!candItem.isContentLoaded) {
            await candItem.loadContent();
          }

          if (candItem.primaryFile) {
            let relativePath = TextureDefinition.canonicalizeTexturePath(
              StorageUtilities.getBaseRelativePath(candItem.primaryFile, packRootFolder)
            );

            if (relativePath) {
              if (textureList && textureList.includes(relativePath)) {
                item.addChildItem(candItem);

                textureList = Utilities.removeItemInArray(relativePath, textureList);
              }
            }
          }
        }
      }

      if (textureList) {
        for (const texturePath of textureList) {
          if (!texturePath.startsWith("$")) {
            const isVanilla = await Database.isVanillaToken(texturePath);
            item.addUnfulfilledRelationship(texturePath, ProjectItemType.texture, isVanilla);
          }
        }
      }
    }
  }
}

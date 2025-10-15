// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IClientAttachableDescription, IClientAttachableWrapper } from "./IClientAttachable";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import AnimationResourceDefinition from "./AnimationResourceDefinition";
import RenderControllerSetDefinition from "./RenderControllerSetDefinition";
import Utilities from "../core/Utilities";
import ModelGeometryDefinition from "./ModelGeometryDefinition";
import Database from "./Database";
import IProjectItemRelationship from "../app/IProjectItemRelationship";
import MinecraftDefinitions from "./MinecraftDefinitions";
import TextureDefinition from "./TextureDefinition";

export default class AttachableResourceDefinition {
  private _dataWrapper?: IClientAttachableWrapper;
  private _data?: IClientAttachableDescription;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<AttachableResourceDefinition, AttachableResourceDefinition>();

  public get isLoaded() {
    return this._isLoaded;
  }

  public get file() {
    return this._file;
  }

  public get data() {
    return this._data;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public set file(newFile: IFile | undefined) {
    this._file = newFile;
  }

  public get id() {
    if (!this._data) {
      return undefined;
    }

    return this._data.identifier;
  }

  public get textures() {
    if (!this._data) {
      return undefined;
    }

    if (this._data.textures === undefined) {
      this._data.textures = {};
    }

    return this._data.textures;
  }

  public getCanonicalizedTexturesList() {
    if (!this._data || !this._data.textures) {
      return undefined;
    }

    const textureList = [];

    for (const key in this._data.textures) {
      const texturePath = TextureDefinition.canonicalizeTexturePath(this._data.textures[key]);

      if (texturePath) {
        textureList.push(texturePath);
      }
    }

    return textureList;
  }

  public get texturesIdList() {
    if (!this._data || !this._data.textures) {
      return undefined;
    }

    const textureIdList = [];

    for (const key in this._data.textures) {
      textureIdList.push(key);
    }

    return textureIdList;
  }

  public get renderControllerIdList(): string[] | undefined {
    if (!this._data || !this._data.render_controllers) {
      return undefined;
    }

    return this._data.render_controllers;
  }

  public get animationIdList(): string[] | undefined {
    if (!this._data || !this._data.animations) {
      return undefined;
    }

    const animationIdList = [];

    for (const key in this._data.animations) {
      animationIdList.push(key);
    }

    return animationIdList;
  }

  public get animationList(): string[] | undefined {
    if (!this._data || !this._data.animations) {
      return undefined;
    }

    const animationList = [];

    for (const key in this._data.animations) {
      const val = this._data.animations[key];

      if (val) {
        animationList.push(val);
      }
    }

    return animationList;
  }

  public get geometry() {
    if (!this._data) {
      return undefined;
    }

    return this._data.geometry;
  }

  public get geometryList() {
    if (!this._data || !this._data.geometry) {
      return undefined;
    }

    const geometryList = [];

    for (const key in this._data.geometry) {
      const geometryPath = this._data.geometry[key];

      if (geometryPath) {
        geometryList.push(geometryPath);
      }
    }

    return geometryList;
  }

  public getTextureItems(entityTypeResourceProjectItem: ProjectItem): { [name: string]: ProjectItem } | undefined {
    if (!this._data || !this._data.geometry || !entityTypeResourceProjectItem.childItems) {
      return undefined;
    }

    const results: { [name: string]: ProjectItem } = {};

    for (const key in this._data.textures) {
      let texturePath = this._data.textures[key];

      if (texturePath) {
        texturePath = StorageUtilities.canonicalizePath(texturePath);

        for (const projectItemRel of entityTypeResourceProjectItem.childItems) {
          if (projectItemRel.childItem.itemType === ProjectItemType.texture && projectItemRel.childItem.projectPath) {
            let texturePathCand = StorageUtilities.canonicalizePath(projectItemRel.childItem.projectPath);
            const lastPeriod = texturePathCand.lastIndexOf(".");

            if (lastPeriod >= 0) {
              texturePathCand = texturePathCand.substring(0, lastPeriod).toLowerCase();
            }

            if (texturePathCand.endsWith(texturePath)) {
              results[key] = projectItemRel.childItem;
            }
          }
        }
      }
    }

    return results;
  }
  public getFormatVersion(): number[] | undefined {
    if (!this._dataWrapper) {
      return undefined;
    }

    const fv = this._dataWrapper.format_version;

    if (typeof fv === "number") {
      return [fv];
    }

    if (typeof fv === "string") {
      let fvarr = this._dataWrapper.format_version.split(".");

      let fvarrInt: number[] = [];
      for (let i = 0; i < fvarr.length; i++) {
        try {
          fvarrInt.push(parseInt(fvarr[i]));
        } catch (e) {}
      }

      return fvarrInt;
    }

    return undefined;
  }

  get formatVersion() {
    if (!this._dataWrapper || !this._dataWrapper.format_version) {
      return undefined;
    }

    return this._dataWrapper.format_version;
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<AttachableResourceDefinition, AttachableResourceDefinition>
  ) {
    let attachable: AttachableResourceDefinition | undefined;

    if (file.manager === undefined) {
      attachable = new AttachableResourceDefinition();

      attachable.file = file;

      file.manager = attachable;
    }

    if (file.manager !== undefined && file.manager instanceof AttachableResourceDefinition) {
      attachable = file.manager as AttachableResourceDefinition;

      if (!attachable.isLoaded) {
        if (loadHandler) {
          attachable.onLoaded.subscribe(loadHandler);
        }

        await attachable.load();
      }
    }

    return attachable;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const defString = JSON.stringify(this._dataWrapper, null, 2);

    this._file.setContent(defString);
  }

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      Log.unexpectedUndefined("ATTRPF");
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

    this._dataWrapper = data;

    if (this._dataWrapper && this._dataWrapper["minecraft:attachable"]) {
      this._data = this._dataWrapper["minecraft:attachable"].description;
    }

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
  ensureData() {
    if (this._data) {
      return this._data;
    }

    const newDef: IClientAttachableDescription = {
      identifier: "",
      materials: {},
      textures: {},
      geometry: {},
      particle_effects: {},
      animations: {},
      render_controllers: [],
      scripts: {},
    };

    if (!this._dataWrapper) {
      this._dataWrapper = { format_version: "1.10.0", "minecraft:attachable": { description: newDef } };
      this._data = this._dataWrapper["minecraft:attachable"].description;
      return this._data;
    }

    if (
      this._dataWrapper["minecraft:attachable"] === undefined ||
      this._dataWrapper["minecraft:attachable"].description === undefined
    ) {
      this._dataWrapper["minecraft:attachable"] = { description: newDef };
    }

    this._data = this._dataWrapper["minecraft:attachable"].description;

    return this._data;
  }

  async deleteLinkToChild(rel: IProjectItemRelationship) {
    let packRootFolder = this.getPackRootFolder();

    if (this._data === undefined) {
      await this.load();
    }

    const etrChildItems = rel.parentItem.childItems;

    if (rel.childItem.itemType === ProjectItemType.texture && this._data && this._data.textures) {
      if (!rel.childItem.isContentLoaded) {
        await rel.childItem.loadContent();
      }

      if (rel.childItem.primaryFile && packRootFolder) {
        let relativePath = StorageUtilities.getBaseRelativePath(rel.childItem.primaryFile, packRootFolder);

        if (relativePath) {
          for (const key in this._data.textures) {
            if (Utilities.isUsableAsObjectKey(key)) {
              const texturePath = this._data.textures[key];

              if (texturePath === relativePath) {
                this._data.textures[key] = undefined;

                if (etrChildItems) {
                  for (const otherChild of etrChildItems) {
                    if (otherChild.childItem.itemType === ProjectItemType.renderControllerJson) {
                      const renderController = (await MinecraftDefinitions.get(
                        otherChild.childItem
                      )) as RenderControllerSetDefinition;

                      renderController.removeTexture(key);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    this.persist();
  }

  getPackRootFolder() {
    let packRootFolder = undefined;

    if (this.file && this.file.parentFolder) {
      let parentFolder = this.file.parentFolder;

      packRootFolder = StorageUtilities.getParentOfParentFolderNamed("attachables", parentFolder);
    }

    return packRootFolder;
  }

  async addChildItems(project: Project, item: ProjectItem) {
    const itemsCopy = project.getItemsCopy();

    let packRootFolder = this.getPackRootFolder();

    let textureList = this.getCanonicalizedTexturesList();
    let geometryList = this.geometryList;
    let renderControllerIdList = this.renderControllerIdList;
    let animationIdList = this.animationIdList;

    for (const candItem of itemsCopy) {
      if (candItem.itemType === ProjectItemType.animationResourceJson && animationIdList) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile) {
          const animationDef = await AnimationResourceDefinition.ensureOnFile(candItem.primaryFile);

          const animIds = animationDef?.idList;

          if (animIds) {
            for (const animId of animationIdList) {
              if (animIds.has(animId)) {
                item.addChildItem(candItem);
                continue;
              }
            }
          }
        }
      } else if (candItem.itemType === ProjectItemType.renderControllerJson && renderControllerIdList) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile) {
          const renderControllerDef = await RenderControllerSetDefinition.ensureOnFile(candItem.primaryFile);

          const renderIds = renderControllerDef?.idList;

          if (renderIds) {
            for (const rcId of renderControllerIdList) {
              if (renderIds.has(rcId)) {
                item.addChildItem(candItem);
                continue;
              }
            }
          }
        }
      } else if (candItem.itemType === ProjectItemType.texture && packRootFolder && textureList) {
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
      } else if (candItem.itemType === ProjectItemType.modelGeometryJson && geometryList) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile) {
          const model = await ModelGeometryDefinition.ensureOnFile(candItem.primaryFile);

          if (model) {
            let doAddModel = false;
            for (const modelId of model.identifiers) {
              if (geometryList && geometryList.includes(modelId)) {
                doAddModel = true;

                geometryList = Utilities.removeItemInArray(modelId, geometryList);
              }
            }

            if (doAddModel) {
              item.addChildItem(candItem);
            }
          }
        }
      }
    }

    if (textureList) {
      for (const texturePath of textureList) {
        const isVanilla = await Database.isVanillaToken(texturePath);

        item.addUnfulfilledRelationship(texturePath, ProjectItemType.texture, isVanilla);
      }
    }

    if (geometryList) {
      for (const geoId of geometryList) {
        item.addUnfulfilledRelationship(geoId, ProjectItemType.modelGeometryJson, await Database.isVanillaToken(geoId));
      }
    }
  }
}

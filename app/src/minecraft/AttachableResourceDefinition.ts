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
import IFolder from "../storage/IFolder";
import AnimationResourceDefinition from "./AnimationResourceDefinition";
import RenderControllerSetDefinition from "./RenderControllerSetDefinition";
import Utilities from "../core/Utilities";
import ModelGeometryDefinition from "./ModelGeometryDefinition";
import Database from "./Database";
import IProjectItemRelationship from "../app/IProjectItemRelationship";
import MinecraftDefinitions from "./MinecraftDefinitions";

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

  public get texturesList() {
    if (!this._data || !this._data.textures) {
      return undefined;
    }

    const textureList = [];

    for (const key in this._data.textures) {
      const texturePath = this._data.textures[key];

      if (texturePath) {
        textureList.push(texturePath.toLowerCase());
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

      if (!attachable.isLoaded && loadHandler) {
        attachable.onLoaded.subscribe(loadHandler);
      }

      await attachable.load();
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

    await this._file.loadContent();

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

  async deleteLink(rel: IProjectItemRelationship) {
    let packRootFolder = this.getPackRootFolder();

    if (this._data === undefined) {
      await this.load();
    }

    const etrChildItems = rel.parentItem.childItems;

    if (rel.childItem.itemType === ProjectItemType.texture && this._data && this._data.textures) {
      await rel.childItem.ensureStorage();

      if (rel.childItem.file && packRootFolder) {
        let relativePath = this.getRelativePath(rel.childItem.file, packRootFolder);

        if (relativePath) {
          for (const key in this._data.textures) {
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

    this.persist();
  }

  getPackRootFolder() {
    let packRootFolder = undefined;
    if (this.file && this.file.parentFolder) {
      let parentFolder = this.file.parentFolder;

      while (parentFolder.name !== "attachables" && parentFolder.parentFolder) {
        parentFolder = parentFolder.parentFolder;
      }

      if (parentFolder.parentFolder) {
        packRootFolder = parentFolder.parentFolder;
      }
    }

    return packRootFolder;
  }

  getRelativePath(file: IFile, packRootFolder: IFolder) {
    let relativePath = file.getFolderRelativePath(packRootFolder);

    if (relativePath) {
      const lastPeriod = relativePath?.lastIndexOf(".");
      if (lastPeriod >= 0) {
        relativePath = relativePath?.substring(0, lastPeriod).toLowerCase();
      }

      relativePath = StorageUtilities.ensureNotStartsWithDelimiter(relativePath);
    }

    return relativePath;
  }

  async addChildItems(project: Project, item: ProjectItem) {
    const itemsCopy = project.getItemsCopy();

    let packRootFolder = this.getPackRootFolder();

    let textureList = this.texturesList;
    let geometryList = this.geometryList;
    let renderControllerIdList = this.renderControllerIdList;
    let animationIdList = this.animationIdList;

    for (const candItem of itemsCopy) {
      if (candItem.itemType === ProjectItemType.animationResourceJson && animationIdList) {
        await candItem.ensureStorage();

        if (candItem.file) {
          const animationDef = await AnimationResourceDefinition.ensureOnFile(candItem.file);

          const animIds = animationDef?.idList;

          if (animIds) {
            for (const animId of animationIdList) {
              if (animIds.includes(animId)) {
                item.addChildItem(candItem);
                continue;
              }
            }
          }
        }
      } else if (candItem.itemType === ProjectItemType.renderControllerJson && renderControllerIdList) {
        await candItem.ensureStorage();

        if (candItem.file) {
          const renderControllerDef = await RenderControllerSetDefinition.ensureOnFile(candItem.file);

          const renderIds = renderControllerDef?.idList;

          if (renderIds) {
            for (const rcId of renderControllerIdList) {
              if (renderIds.includes(rcId)) {
                item.addChildItem(candItem);
                continue;
              }
            }
          }
        }
      } else if (candItem.itemType === ProjectItemType.texture && packRootFolder && textureList) {
        await candItem.ensureStorage();

        if (candItem.file) {
          let relativePath = this.getRelativePath(candItem.file, packRootFolder);

          if (relativePath) {
            if (textureList && textureList.includes(relativePath)) {
              item.addChildItem(candItem);

              textureList = Utilities.removeItemInArray(relativePath, textureList);
            }
          }
        }
      } else if (candItem.itemType === ProjectItemType.modelGeometryJson && geometryList) {
        await candItem.ensureStorage();

        if (candItem.file) {
          const model = await ModelGeometryDefinition.ensureOnFile(candItem.file);

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
        item.addUnfulfilledRelationship(
          texturePath,
          ProjectItemType.texture,
          await Database.isVanillaToken(texturePath)
        );
      }
    }

    if (geometryList) {
      for (const geoId of geometryList) {
        item.addUnfulfilledRelationship(geoId, ProjectItemType.modelGeometryJson, await Database.isVanillaToken(geoId));
      }
    }
  }
}

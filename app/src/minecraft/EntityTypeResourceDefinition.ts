// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IEntityTypeResource, IEntityTypeResourceDescription, IEntityTypeResourceWrapper } from "./IEntityTypeResource";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import RelationsIndex from "../app/RelationsIndex";
import ModelGeometryDefinition from "./ModelGeometryDefinition";
import Database from "./Database";
import Utilities from "../core/Utilities";
import RenderControllerSetDefinition from "./RenderControllerSetDefinition";
import AnimationControllerResourceDefinition from "./AnimationControllerResourceDefinition";
import AnimationResourceDefinition from "./AnimationResourceDefinition";
import IProjectItemRelationship from "../app/IProjectItemRelationship";
import MinecraftDefinitions from "./MinecraftDefinitions";
import TextureDefinition from "./TextureDefinition";
import MinecraftUtilities from "./MinecraftUtilities";

export default class EntityTypeResourceDefinition {
  private _dataWrapper?: IEntityTypeResourceWrapper;
  private _file?: IFile;
  private _isLoaded: boolean = false;
  private _loadedWithComments: boolean = false;
  private _data?: IEntityTypeResourceDescription;

  private _onLoaded = new EventDispatcher<EntityTypeResourceDefinition, EntityTypeResourceDefinition>();

  public get isLoaded() {
    return this._isLoaded;
  }

  public get dataWrapper() {
    return this._data;
  }

  public get data() {
    return this._data;
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

  public get id() {
    if (!this._data) {
      return undefined;
    }

    return this._data.identifier;
  }

  public set id(newId: string | undefined) {
    if (this._data && newId !== undefined) {
      this._data.identifier = newId;
    }
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

  public get animationControllerIdList(): string[] | undefined {
    if (!this._data || !this._data.animation_controllers) {
      return undefined;
    }

    const animationControllerIdList = [];

    for (const key in this._data.animation_controllers) {
      animationControllerIdList.push(key);
    }

    return animationControllerIdList;
  }

  public get animationControllerList(): string[] | undefined {
    if (!this._data || !this._data.animation_controllers) {
      return undefined;
    }

    const animationControllerList = [];

    for (const key in this._data.animation_controllers) {
      const val = this._data.animation_controllers[key];

      if (val) {
        animationControllerList.push(val);
      }
    }

    return animationControllerList;
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

  /**
   * Get a list of all geometry/texture variant keys (e.g., "default", "warm", "cold")
   */
  public get variantKeys(): string[] {
    const keys = new Set<string>();

    if (this._data?.geometry) {
      for (const key in this._data.geometry) {
        keys.add(key);
      }
    }

    if (this._data?.textures) {
      for (const key in this._data.textures) {
        keys.add(key);
      }
    }

    return Array.from(keys);
  }

  /**
   * Get the geometry ID for a specific variant key (e.g., "default")
   * Falls back to first available geometry if key not found
   */
  public getGeometryByKey(key: string): string | undefined {
    if (!this._data?.geometry) {
      return undefined;
    }

    // Try exact key first
    if (this._data.geometry[key]) {
      return this._data.geometry[key];
    }

    // Fall back to "default" if available
    if (key !== "default" && this._data.geometry["default"]) {
      return this._data.geometry["default"];
    }

    // Fall back to first available
    const keys = Object.keys(this._data.geometry);
    if (keys.length > 0) {
      return this._data.geometry[keys[0]];
    }

    return undefined;
  }

  /**
   * Get the texture path for a specific variant key (e.g., "default")
   * Falls back to first available texture if key not found
   */
  public getTextureByKey(key: string): string | undefined {
    if (!this._data?.textures) {
      return undefined;
    }

    // Try exact key first
    if (this._data.textures[key]) {
      return this._data.textures[key];
    }

    // Fall back to "default" if available
    if (key !== "default" && this._data.textures["default"]) {
      return this._data.textures["default"];
    }

    // Fall back to first available
    const keys = Object.keys(this._data.textures);
    if (keys.length > 0) {
      return this._data.textures[keys[0]];
    }

    return undefined;
  }

  /**
   * Get matched geometry and texture for a specific variant key
   * This ensures the geometry and texture are paired correctly
   */
  public getMatchedGeometryAndTexture(key: string = "default"): { geometryId?: string; texturePath?: string } {
    return {
      geometryId: this.getGeometryByKey(key),
      texturePath: this.getTextureByKey(key),
    };
  }

  public ensureAnimationAndGetShortName(animationFullName: string): string | undefined {
    if (!this._data || !this._data.animations) {
      return undefined;
    }

    let hasAnimation = false;
    let animationShortName = animationFullName;

    for (const key in this._data.animations) {
      const val = this._data.animations[key];

      if (val === animationFullName) {
        animationShortName = key;
        hasAnimation = true;
      }
    }

    if (!hasAnimation) {
      const lastPeriod = animationFullName.lastIndexOf(".");

      if (lastPeriod > 0) {
        animationShortName = animationFullName.substring(lastPeriod + 1).toLowerCase();
      }

      if (Utilities.isUsableAsObjectKey(animationShortName)) {
        this._data.animations[animationShortName] = animationFullName;
      }
    }

    return animationShortName;
  }

  public ensureAnimationAndScript(animationFullName: string) {
    if (!this._data) {
      return;
    }

    const animationShortName = this.ensureAnimationAndGetShortName(animationFullName);

    if (!animationShortName) {
      return;
    }

    if (this.getIsVersion1_10_0OrHigher()) {
      if (!this._data.scripts) {
        this._data.scripts = {};
      }

      if (!this._data.scripts["animate"]) {
        this._data.scripts["animate"] = [];
      }

      const animationList = this._data.scripts["animate"];

      let hasScript = false;

      if (animationList && Array.isArray(animationList)) {
        for (const val of animationList) {
          if (typeof val === "string" && val === animationShortName) {
            hasScript = true;
          } else if (typeof val === "object" && val[animationShortName]) {
            hasScript = true;
          }
        }
      }

      if (!hasScript) {
        animationList.push(animationShortName);
      }
    }
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

            if (texturePathCand.endsWith(texturePath) && Utilities.isUsableAsObjectKey(key)) {
              results[key] = projectItemRel.childItem;
            }
          }
        }
      }
    }

    return results;
  }

  public getIsVersion1_8_0OrLower() {
    let fv = this.getFormatVersion();

    return fv[0] <= 1 && fv[1] <= 8;
  }

  public getIsVersion1_10_0OrHigher() {
    let fv = this.getFormatVersion();

    return fv[0] >= 1 && fv[1] >= 10;
  }

  public getFormatVersion(): number[] {
    if (!this._dataWrapper || !this._dataWrapper.format_version) {
      return [0, 0, 0];
    }

    return MinecraftUtilities.getVersionArrayFrom(this._dataWrapper.format_version);
  }

  get formatVersion() {
    if (!this._dataWrapper || !this._dataWrapper.format_version) {
      return undefined;
    }

    return this._dataWrapper.format_version;
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<EntityTypeResourceDefinition, EntityTypeResourceDefinition>
  ) {
    let et: EntityTypeResourceDefinition | undefined;

    if (file.manager === undefined) {
      et = new EntityTypeResourceDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof EntityTypeResourceDefinition) {
      et = file.manager as EntityTypeResourceDefinition;

      if (!et.isLoaded) {
        if (loadHandler) {
          et.onLoaded.subscribe(loadHandler);
        }

        await et.load();
      }
    }

    return et;
  }

  ensureData() {
    if (this._data) {
      return this._data;
    }

    const newDef: IEntityTypeResource = {
      description: {
        identifier: "",
        materials: {},
        textures: {},
        geometry: {},
        animation_controllers: {},
        particle_effects: {},
        animations: {},
        render_controllers: [],
        scripts: {},
      },
    };

    if (!this._dataWrapper) {
      this._dataWrapper = { format_version: "1.10.0", "minecraft:client_entity": newDef };
      this._data = this._dataWrapper["minecraft:client_entity"].description;
      return this._data;
    }

    if (
      this._dataWrapper["minecraft:client_entity"] === undefined ||
      this._dataWrapper["minecraft:client_entity"].description === undefined
    ) {
      this._dataWrapper["minecraft:client_entity"] = newDef;
    }

    this._data = this._dataWrapper["minecraft:client_entity"].description;
    return this._data;
  }

  persist(): boolean {
    if (this._file === undefined) {
      return false;
    }

    Log.assert(this._dataWrapper !== null, "ETRDP");

    if (!this._dataWrapper) {
      return false;
    }

    return this._file.setObjectContentIfSemanticallyDifferent(this._dataWrapper);
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
      Log.unexpectedUndefined("ETRPF");
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (!this._file.content || this._file.content instanceof Uint8Array) {
      this._isLoaded = true;
      this._loadedWithComments = preserveComments;
      this._onLoaded.dispatch(this, this);
      return;
    }

    let data: any = {};

    // Use comment-preserving parser only when needed for editing
    let result = preserveComments
      ? StorageUtilities.getJsonObjectWithComments(this._file)
      : StorageUtilities.getJsonObject(this._file);

    if (result) {
      data = result;
    }

    this._dataWrapper = data;

    if (this._dataWrapper && this._dataWrapper["minecraft:client_entity"]) {
      this._data = this._dataWrapper["minecraft:client_entity"].description;
    }

    this._isLoaded = true;
    this._loadedWithComments = preserveComments;

    this._onLoaded.dispatch(this, this);
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

      packRootFolder = StorageUtilities.getParentOfParentFolderNamed("entity", parentFolder);
    }

    return packRootFolder;
  }

  async addChildItems(project: Project, item: ProjectItem, index?: RelationsIndex) {
    let packRootFolder = this.getPackRootFolder();

    let textureList = this.getCanonicalizedTexturesList();
    let geometryList = this.geometryList;
    let renderControllerIdList = this.renderControllerIdList;
    let animationControllerIdList = this.animationControllerIdList;
    let animationValList = this.animationList;

    if (index) {
      // Use pre-built index for O(1) lookups

      // Animations: look up each animation ID in the index
      if (animationValList && animationValList.length > 0) {
        index.addUniqueChildItems(item, index.animationsById, animationValList);
      }

      // Animation controllers
      if (animationControllerIdList && animationControllerIdList.length > 0) {
        index.addUniqueChildItems(item, index.animationControllersById, animationControllerIdList);
      }

      // Render controllers
      if (renderControllerIdList && renderControllerIdList.length > 0) {
        index.addUniqueChildItems(item, index.renderControllersById, renderControllerIdList);
      }

      // Models / geometry
      if (geometryList && geometryList.length > 0) {
        const matchedGeoIds = index.addUniqueChildItems(item, index.modelsById, geometryList);
        geometryList = geometryList.filter((id) => !matchedGeoIds.has(id));
      }

      // Textures — still need path-based matching since paths depend on pack root
      if (packRootFolder && textureList && textureList.length > 0) {
        const textureItems = project.getItemsByType(ProjectItemType.texture);
        for (const candItem of textureItems) {
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
    } else {
      // Fallback: original scanning behavior when index is not available

      // Check animation resources
      if (animationValList && animationValList.length > 0) {
        const animItems = project.getItemsByType(ProjectItemType.animationResourceJson);
        for (const candItem of animItems) {
          if (!candItem.isContentLoaded) {
            await candItem.loadContent();
          }

          if (candItem.primaryFile) {
            const animationDef = await AnimationResourceDefinition.ensureOnFile(candItem.primaryFile);
            const animIds = animationDef?.idList;

            if (animIds) {
              for (const animId of animationValList) {
                if (animIds.has(animId)) {
                  item.addChildItem(candItem);
                  continue;
                }
              }
            }
          }
        }
      }

      // Check animation controller resources
      if (animationControllerIdList && animationControllerIdList.length > 0) {
        const acItems = project.getItemsByType(ProjectItemType.animationControllerResourceJson);
        for (const candItem of acItems) {
          if (!candItem.isContentLoaded) {
            await candItem.loadContent();
          }

          if (candItem.primaryFile) {
            const animationControllerDef = await AnimationControllerResourceDefinition.ensureOnFile(
              candItem.primaryFile
            );
            const acIds = animationControllerDef?.idList;

            if (acIds) {
              for (const acId of animationControllerIdList) {
                if (acIds.has(acId)) {
                  item.addChildItem(candItem);
                  continue;
                }
              }
            }
          }
        }
      }

      // Check render controllers
      if (renderControllerIdList && renderControllerIdList.length > 0) {
        const rcItems = project.getItemsByType(ProjectItemType.renderControllerJson);
        for (const candItem of rcItems) {
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
        }
      }

      // Check textures
      if (packRootFolder && textureList && textureList.length > 0) {
        const textureItems = project.getItemsByType(ProjectItemType.texture);
        for (const candItem of textureItems) {
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

      // Check model geometries
      if (geometryList && geometryList.length > 0) {
        const modelItems = project.getItemsByType(ProjectItemType.modelGeometryJson);
        for (const candItem of modelItems) {
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

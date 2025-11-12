// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BlockBaseType from "./BlockBaseType";
import { BlockRenderType } from "./BlockRenderType";
import IBlockTypeData from "./IBlockTypeData";
import MinecraftUtilities from "./MinecraftUtilities";
import Database from "./Database";
import Utilities from "../core/Utilities";
import { EventDispatcher, IEventHandler } from "ste-events";
import IFile from "../storage/IFile";
import Log from "../core/Log";
import IComponent from "./IComponent";
import IBlockTypeBehaviorPack from "./IBlockTypeBehaviorPack";
import IBlockTypeWrapper from "./IBlockTypeWrapper";
import IManagedComponentSetItem from "./IManagedComponentSetItem";
import IManagedComponent from "./IManagedComponent";
import { ManagedComponent } from "./ManagedComponent";
import StorageUtilities from "../storage/StorageUtilities";
import IDefinition from "./IDefinition";
import ManagedPermutation from "./ManagedPermutation";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import ModelGeometryDefinition from "./ModelGeometryDefinition";
import BlocksCatalogDefinition from "./BlocksCatalogDefinition";
import TerrainTextureCatalogDefinition from "./TerrainTextureCatalogDefinition";
import TypeScriptDefinition from "./TypeScriptDefinition";
import { IBlockTypeCreationData } from "./IBlockTypeCreationData";
import { ITerrainTextureDataItem } from "./ITerrainTextureCatalog";
import ProjectUtilities from "../app/ProjectUtilities";

export enum BlockStateType {
  string = 0,
  boolean = 1,
  number = 2,
}

export default class BlockTypeDefinition implements IManagedComponentSetItem, IDefinition {
  private _typeId = "";

  private _typeData: IBlockTypeData;

  private _baseType?: BlockBaseType;
  private _baseTypeId = "";

  private _material = "";
  private _isCustom = false;
  private _wrapper: IBlockTypeWrapper | null = null;
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public _data?: IBlockTypeBehaviorPack;
  private _managed: { [id: string]: IManagedComponent | undefined } = {};
  private _onLoaded = new EventDispatcher<BlockTypeDefinition, BlockTypeDefinition>();

  private _onComponentAdded = new EventDispatcher<BlockTypeDefinition, IManagedComponent>();
  private _onComponentRemoved = new EventDispatcher<BlockTypeDefinition, string>();
  private _onComponentChanged = new EventDispatcher<BlockTypeDefinition, IManagedComponent>();

  public get data() {
    return this._data;
  }

  public get numericId() {
    return this._typeData.id;
  }

  public get baseTypeId() {
    return this._baseTypeId;
  }

  public get mapColor() {
    return this._typeData.mc;
  }

  public get isCustom() {
    return this._isCustom;
  }

  public get baseType() {
    if (this._baseType !== undefined) {
      return this._baseType;
    }

    return Database.defaultBlockBaseType;
  }

  public get geometryIdentifier() {
    const geoComponent = this.getComponent("minecraft:geometry");

    if (!geoComponent) {
      return undefined;
    }

    return geoComponent.getProperty("identifier");
  }

  public async setBlockCatalogTexture(
    project: Project,
    sideId: "north" | "east" | "west" | "south" | "up" | "down",
    textureId: string
  ) {
    if (this.geometryIdentifier === "minecraft:geometry.full_block") {
      const blockCatalog = await BlocksCatalogDefinition.ensureBlockCatalog(project);

      if (blockCatalog) {
        const blockResource = blockCatalog?.ensureBlockDefinition(this.id);

        if (blockResource.textures && typeof blockResource.textures !== "string") {
          blockResource.textures[sideId] = textureId;
        }

        blockCatalog.persist();
      }
    }
  }

  public async setTerrainTexture(project: Project, terrainTextureId: string, textureData: ITerrainTextureDataItem) {
    if (this.geometryIdentifier === "minecraft:geometry.full_block") {
      const terrainTextureCatalog = await TerrainTextureCatalogDefinition.ensureTerrainTextureCatalog(project);

      if (terrainTextureCatalog) {
        terrainTextureCatalog.setTexture(terrainTextureId, textureData);
        terrainTextureCatalog.persist();
      }
    }
  }

  public async ensureBlockAndTerrainLinks(project: Project, creationData: IBlockTypeCreationData) {
    if (this.geometryIdentifier === "minecraft:geometry.full_block") {
      const blockCatalog = await BlocksCatalogDefinition.ensureBlockCatalog(project);
      const terrainTextureCatalog = await TerrainTextureCatalogDefinition.ensureTerrainTextureCatalog(project);

      if (creationData && creationData.resource && blockCatalog) {
        blockCatalog?.setBlockDefinition(this.id, creationData.resource);
      }
      if (creationData && creationData.texture_data && terrainTextureCatalog) {
        for (const textureId in creationData.texture_data) {
          const textureData = creationData.texture_data[textureId];
          terrainTextureCatalog.setTexture(textureId, textureData);
        }

        const carriedTexturesId = creationData.resource.carried_textures;

        if (carriedTexturesId) {
          const textureData = creationData.texture_data[carriedTexturesId];
          terrainTextureCatalog.setTexture(carriedTexturesId, textureData);
        }
      }
    }
  }

  public async getFormatVersionIsCurrent() {
    const fv = this.getFormatVersion();

    if (fv === undefined || fv.length !== 3) {
      return false;
    }

    return await Database.isRecentVersionFromVersionArray(fv);
  }

  public getMissingPermutations() {
    this.ensurePermutations();

    const unspecifiedConditions: string[] = [];

    for (const state of this.getExpandedStateList()) {
      let isUsedInConditionalExpression = false;
      for (const perm of this.getPermutations()) {
        if (
          perm.condition.indexOf(state) >= 0 &&
          (perm.condition.indexOf("!=") >= 0 || perm.condition.indexOf(">=") >= 0 || perm.condition.indexOf("<=") >= 0)
        ) {
          isUsedInConditionalExpression = true;
          break;
        }
      }

      if (!isUsedInConditionalExpression) {
        unspecifiedConditions.push(state);
      }
    }

    const stateIds: string[] = [];

    const vals: (string | number | boolean)[][] = [];

    for (const state of unspecifiedConditions) {
      const stateValues = this.getStateValues(state);

      if (stateValues) {
        vals.push(stateValues);
        stateIds.push(state);
      }
    }

    let stateList: string[] = [];

    let idx = 0;

    for (const valArrs of vals) {
      let newStateList: string[] = [];

      for (let i = 0; i < valArrs.length; i++) {
        let strVal = valArrs[i];

        if (typeof strVal === "string") {
          strVal = "'" + strVal + "'";
        }

        if (stateList.length === 0) {
          let condition = "q.block_state('" + stateIds[idx] + "') == " + strVal;

          if (!this.getPermutationByCondition(condition)) {
            newStateList.push(condition);
          }
        } else {
          for (let j = 0; j < stateList.length; j++) {
            let condition = stateList[j] && " && q.block_state('" + stateIds[idx] + "') == " + strVal;

            if (!this.getPermutationByCondition(condition)) {
              newStateList.push(stateList[j] && " && q.block_state('" + stateIds[idx] + "') == " + strVal);
            }
          }
        }
      }

      idx++;
      stateList = newStateList;
    }

    return stateList;
  }

  public addNextPermutation() {
    this.ensurePermutations();

    let missingConditions = this.getMissingPermutations();

    const cond = missingConditions.length > 0 ? missingConditions[0] : "q.block_state() == ''";

    this.addPermutation(cond);
  }

  public addPermutation(condition: string) {
    this.ensurePermutations();

    if (!this._data || !this._data.permutations) {
      return;
    }

    this._data.permutations.push({
      condition: condition,
      components: {},
    });
  }

  public ensurePermutations() {
    if (!this._data) {
      this._data = {
        description: {
          identifier: this._typeId,
        },
        components: {},
        permutations: [],
        events: {},
      };
    }

    if (!this._data.description) {
      this._data.description = {
        identifier: this._typeId,
      };
    }

    if (!this._data.permutations) {
      this._data.permutations = [];
    }
  }

  public hasCustomPermutationConditions() {
    if (!this._data || !this._data.permutations || !Array.isArray(this._data.permutations)) {
      return false;
    }

    for (const perm of this._data.permutations) {
      if (
        perm.condition &&
        (perm.condition.indexOf(">=") >= 0 || perm.condition.indexOf("<=") >= 0 || perm.condition.indexOf("!=") >= 0)
      ) {
        return true;
      }
    }

    return false;
  }

  public ensureDescription() {
    if (!this._data) {
      this._data = {
        description: {
          identifier: this._typeId,
        },
        components: {},
        events: {},
      };
    }

    if (!this._data.description) {
      this._data.description = {
        identifier: this._typeId,
      };
    }
  }

  getManagedPermutations() {
    const permData = this.getPermutations();

    if (!permData || !Array.isArray(permData)) {
      return undefined;
    }

    const managedPerms: ManagedPermutation[] = [];

    for (const permDataItem of permData) {
      managedPerms.push(new ManagedPermutation(permDataItem));
    }

    return managedPerms;
  }

  getPermutations() {
    if (!this._data || !this.data?.permutations) {
      return [];
    }

    return this.data.permutations;
  }

  getPlacementDirectionTrait() {
    if (!this._data || !this._data.description || !this._data.description.traits) {
      return undefined;
    }

    const traits = this._data?.description.traits;

    return traits["minecraft:placement_direction"];
  }

  getPlacementPositionTrait() {
    if (!this._data || !this._data.description || !this._data.description.traits) {
      return undefined;
    }

    const traits = this._data?.description.traits;

    return traits["minecraft:placement_position"];
  }

  ensurePlacementDirectionTrait() {
    this.ensureBlockTraits();

    const traits = this._data?.description.traits;

    if (traits) {
      if (!traits["minecraft:placement_direction"]) {
        traits["minecraft:placement_direction"] = {
          enabled_states: ["minecraft:cardinal_direction", "minecraft:facing_direction"],
        };
      }
    }
  }

  removePlacementDirectionTrait() {
    const traits = this._data?.description.traits;

    if (traits) {
      if (traits["minecraft:placement_direction"]) {
        traits["minecraft:placement_direction"] = undefined;
      }
    }
  }

  ensurePlacementPositionTrait() {
    this.ensureBlockTraits();

    const traits = this._data?.description.traits;

    if (traits) {
      if (!traits["minecraft:placement_position"]) {
        traits["minecraft:placement_position"] = {
          enabled_states: ["minecraft:block_face", "minecraft:vertical_half"],
        };
      }
    }
  }

  removePlacementPositionTrait() {
    const traits = this._data?.description.traits;

    if (traits) {
      if (traits["minecraft:placement_position"]) {
        traits["minecraft:placement_position"] = undefined;
      }
    }
  }

  public ensureBlockTraits() {
    this.ensureDescription();

    if (this._data?.description && !this._data?.description.traits) {
      this._data.description.traits = {};
    }
  }

  public removeState(stateName: string) {
    if (this._data?.description?.states) {
      this._data.description.states[stateName] = undefined;
    }
    if (this._data?.description?.properties) {
      this._data.description.properties[stateName] = undefined;
    }
  }

  public getFormatVersion(): number[] | undefined {
    if (!this._wrapper) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this._wrapper.format_version);
  }

  public getStateValues(stateId: string) {
    if (stateId === "minecraft:block_face" || stateId === "minecraft:facing_direction") {
      return ["north", "south", "east", "west", "up", "down"];
    } else if (stateId === "minecraft:vertical_half") {
      return ["bottom", "top"];
    } else if (stateId === "minecraft:cardinal_direction") {
      return ["north", "south", "east", "west"];
    }

    const states = this.getStates();

    if (!states || !states[stateId]) {
      return undefined;
    }

    return states[stateId];
  }

  public getStates() {
    if (!this._wrapper || !this._data || !this._data?.description) {
      return undefined;
    }

    if (!this._data.description.states && this._data.description.properties) {
      return this._data.description.properties;
    }

    return this._data.description.states;
  }

  public addState(stateName: string, stateType: BlockStateType) {
    if (!this._data || !this._data.description) {
      return;
    }
    if (!Utilities.isUsableAsObjectKey(stateName)) {
      Log.unsupportedToken(stateName);
      throw new Error();
    }
    let dataArr: string[] | number[] | boolean[] = [];

    if (stateType === BlockStateType.boolean) {
      dataArr = [false, true];
    } else if (stateType === BlockStateType.number) {
      dataArr = [0, 1, 2];
    } else if (stateType === BlockStateType.string) {
      dataArr = ["value1", "value2"];
    }

    if (!this._data.description.states) {
      this._data.description.states = {};
    }

    this._data.description.states[stateName] = dataArr;
  }

  public getExpandedStateList() {
    const stateList = this.getStateList();

    let placementDir = this.getPlacementDirectionTrait();

    if (placementDir) {
      if (placementDir.enabled_states) {
        stateList.push(...placementDir.enabled_states);
      }
    }

    let placementPos = this.getPlacementPositionTrait();

    if (placementPos) {
      if (placementPos.enabled_states) {
        stateList.push(...placementPos.enabled_states);
      }
    }

    return stateList;
  }

  public getStateList() {
    const states = this.getStates();

    if (!states) {
      return [];
    }

    const stateList = [];

    for (const state in states) {
      if (states[state] !== undefined) {
        stateList.push(state);
      }
    }

    return stateList;
  }

  public set baseType(baseType: BlockBaseType) {
    this._baseType = baseType;
    this._baseTypeId = baseType.name;
  }

  public get material() {
    return this._material;
  }

  public renderType: BlockRenderType = BlockRenderType.Custom;

  get icon() {
    let val = this._typeData.ic;

    if (val === undefined && this.baseType !== undefined) {
      val = this.baseType.icon;
    }

    return val;
  }

  get typeId() {
    return this._typeId;
  }

  get shortTypeName() {
    let name = this._typeId;

    const colonIndex = name.indexOf(":");

    if (colonIndex >= 0) {
      name = name.substring(colonIndex + 1, name.length);
    }

    return name;
  }

  get title() {
    const id = this.shortTypeName;

    return Utilities.humanifyMinecraftName(id);
  }

  constructor(name: string) {
    this._typeId = name;
    this._handleFileUpdated = this._handleFileUpdated.bind(this);
    this._typeData = {
      n: name,
    };

    if (name.indexOf(":") >= 0 && !name.startsWith("minecraft:")) {
      this._isCustom = true;
    }
  }

  public get id() {
    if (this._data && this._data.description) {
      return this._data.description.identifier;
    }

    if (!this._id) {
      return "";
    }

    return this._id;
  }

  public set id(newId: string) {
    this._id = newId;

    if (this._data && this._data.description && newId) {
      this._data.description.identifier = newId;
    }
  }

  public get onComponentAdded() {
    return this._onComponentAdded.asEvent();
  }

  public get onComponentRemoved() {
    return this._onComponentRemoved.asEvent();
  }

  public get onComponentChanged() {
    return this._onComponentChanged.asEvent();
  }

  public get isLoaded() {
    return this._isLoaded;
  }

  public get behaviorPackFile() {
    return this._file;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public set behaviorPackFile(newFile: IFile | undefined) {
    if (this._file) {
      this._file.onFileContentUpdated.unsubscribe(this._handleFileUpdated);
    }

    this._file = newFile;

    if (this._file) {
      this._file.onFileContentUpdated.subscribe(this._handleFileUpdated);
    }
  }

  _handleFileUpdated(file: IFile, fileB: IFile) {
    this._data = undefined;
    this._wrapper = null;
    this._isLoaded = false;
    this._managed = {};
  }

  public get shortId() {
    if (this._id !== undefined) {
      if (this._id.startsWith("minecraft:")) {
        return this._id.substring(10, this._id.length);
      }

      return this._id;
    }

    return undefined;
  }

  getPermutationByCondition(permutationCondition: string) {
    if (!this._data || !this.data?.permutations || !Array.isArray(this.data.permutations)) {
      return undefined;
    }

    for (const perm of this.data.permutations) {
      if (permutationCondition === perm.condition) {
        return perm;
      }
    }

    return undefined;
  }

  static getComponentFromBaseFileName(name: string) {
    let canonName = name;

    if (canonName.startsWith("minecraft_")) {
      canonName = canonName.substring(10);
    }

    return canonName;
  }

  ensureComponent(id: string, defaultData?: IComponent | string | string[] | boolean | number[] | number | undefined) {
    const comp = this.getComponent(id);

    if (comp) {
      return comp;
    }

    return this.addComponent(id, defaultData);
  }

  getComponent(id: string) {
    if (this._data === undefined) {
      return undefined;
    }

    if (!this._managed[id]) {
      if (this._data.components) {
        const comp = this._data.components[id];
        if (comp) {
          this._managed[id] = new ManagedComponent(this._data.components, id, comp);
        }
      }
    }

    return this._managed[id];
  }

  getComponentsInBaseAndPermutations(id: string): IManagedComponent[] {
    if (this._data === undefined) {
      return [];
    }

    let results: IManagedComponent[] = [];

    let comp = this.getComponent(id);

    if (comp) {
      results.push(comp);
    }

    const perms = this.getManagedPermutations();

    if (perms && Array.isArray(perms)) {
      for (const perm of perms) {
        if (perm) {
          comp = perm.getComponent(id);

          if (comp) {
            results.push(comp);
          }
        }
      }
    }

    return results;
  }

  notifyComponentUpdated(id: string) {
    const component = this.getComponent(id);

    if (component === undefined) {
      Log.unexpectedUndefined("BTNCU");
    } else {
      this._onComponentChanged.dispatch(this, component);
    }
  }

  getAllComponents(): IManagedComponent[] {
    return this.getComponents();
  }

  getComponents(): IManagedComponent[] {
    const componentSet: IManagedComponent[] = [];

    if (this._data !== undefined) {
      for (const componentName in this._data.components) {
        const component = this.getComponent(componentName);

        if (component !== undefined) {
          componentSet.push(component);
        }
      }
    }

    return componentSet;
  }

  addComponent(
    id: string,
    componentOrData: ManagedComponent | IComponent | string | string[] | boolean | number[] | number | undefined
  ) {
    this._ensureBehaviorPackDataInitialized();

    const bpData = this._data as IBlockTypeBehaviorPack;

    const mc =
      componentOrData instanceof ManagedComponent
        ? componentOrData
        : new ManagedComponent(bpData.components, id, componentOrData);

    bpData.components[id] = mc.getData();
    this._managed[id] = mc;

    this._onComponentAdded.dispatch(this, mc);

    return mc;
  }

  removeComponent(id: string) {
    if (this._data === undefined) {
      return;
    }

    const newBehaviorPacks: {
      [name: string]: IComponent | string | string[] | boolean | number[] | number | undefined;
    } = {};
    const newComponents: { [name: string]: IManagedComponent | undefined } = {};

    for (const name in this._data.components) {
      if (name !== id) {
        if (Utilities.isUsableAsObjectKey(name)) {
          const component = this._data.components[name];

          newBehaviorPacks[name] = component;
        }
      }
    }

    for (const name in this._managed) {
      if (name !== id) {
        newComponents[name] = this._managed[name];
      }
    }

    this._data.components = newBehaviorPacks;
    this._managed = newComponents;
  }

  public async getTextureItems(
    blockTypeProjectItem: ProjectItem
  ): Promise<{ [name: string]: ProjectItem } | undefined> {
    if (!this._data || !blockTypeProjectItem.childItems) {
      return undefined;
    }

    const textureList = this.getTextureList();

    const results: { [name: string]: ProjectItem } = {};

    for (const childItem of blockTypeProjectItem.childItems) {
      let candItem = childItem.childItem;

      if (candItem.itemType === ProjectItemType.terrainTextureCatalogResourceJson) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile && candItem.childItems) {
          const blockTextureCatalog = await TerrainTextureCatalogDefinition.ensureOnFile(candItem.primaryFile);

          if (blockTextureCatalog && textureList) {
            for (const textureId of textureList) {
              const texPaths = blockTextureCatalog.getAllTexturePaths(textureId);

              if (texPaths) {
                for (const texPath of texPaths) {
                  for (const catalogChildItem of candItem.childItems) {
                    let path = catalogChildItem.childItem.projectPath;

                    if (path) {
                      const lastPeriod = path.lastIndexOf(".");

                      if (lastPeriod >= 0) {
                        path = path.substring(0, lastPeriod);
                      }

                      if (path.endsWith(texPath)) {
                        results[texPath] = catalogChildItem.childItem;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return results;
  }

  public getGeometryList() {
    if (!this._data) {
      return undefined;
    }

    const comps = this.getComponentsInBaseAndPermutations("minecraft:geometry");

    if (!comps) {
      return undefined;
    }

    const geometryList = [];

    for (const comp of comps) {
      const compData = comp.getData();

      if (typeof compData === "string") {
        geometryList.push(compData);
      } else {
        const id = comp.getProperty("identifier");

        if (id) {
          geometryList.push(id);
        }
      }
    }

    return geometryList;
  }

  public getTextureList() {
    if (!this._data) {
      return undefined;
    }

    const comps = this.getComponentsInBaseAndPermutations("minecraft:material_instances");

    if (!comps) {
      return undefined;
    }

    const textureList: string[] = [];

    for (const comp of comps) {
      const compData = comp.getData();

      if (typeof compData === "object") {
        for (const materialName in compData) {
          const material = (compData as any)[materialName];

          if (material && material.texture) {
            textureList.push(material.texture);
          }
        }
      }
    }

    return textureList;
  }

  _ensureBehaviorPackDataInitialized() {
    if (this._data === undefined) {
      this._data = {
        description: {
          identifier: "unknown",
        },
        components: {},
        events: {},
      };
    }
  }

  getPackRootFolder() {
    let packRootFolder = undefined;
    if (this._file && this._file.parentFolder) {
      let parentFolder = this._file.parentFolder;

      packRootFolder = StorageUtilities.getParentOfParentFolderNamed("blocks", parentFolder);
    }

    return packRootFolder;
  }

  getCustomComponentIds() {
    let customComponentIds: string[] = [];
    const customComponents = this.getComponentsInBaseAndPermutations("minecraft:custom_components");

    for (const comp of customComponents) {
      let compData = comp.getData();

      if (compData && Array.isArray(compData)) {
        for (const str of compData) {
          if (typeof str === "string") {
            customComponentIds.push(str);
          }
        }
      }
    }

    const allComponentsInUse = this.getAllComponents();

    for (const component of allComponentsInUse) {
      if (component && component.id && !component.id.startsWith("minecraft:") && !component.id.startsWith("tag:")) {
        customComponentIds.push(component.id);
      }
    }

    return customComponentIds;
  }

  getLootTablePaths() {
    let lootTablePaths: string[] = [];

    const lootComps = this.getComponentsInBaseAndPermutations("minecraft:loot");

    for (const comp of lootComps) {
      let compData = comp.getData();

      if (typeof compData === "string") {
        lootTablePaths.push(compData);
      } else {
        let lootTablePath = comp.getProperty("table");

        if (lootTablePath) {
          lootTablePaths.push(lootTablePath);
        }
      }
    }

    return lootTablePaths;
  }

  async addChildItems(project: Project, item: ProjectItem) {
    let lootTablePaths = this.getLootTablePaths();

    let customComponentIds: string[] = this.getCustomComponentIds();

    let textureList = this.getTextureList();
    let geometryList = this.getGeometryList();
    const itemsCopy = project.getItemsCopy();

    for (const candItem of itemsCopy) {
      if (candItem.itemType === ProjectItemType.ts) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile) {
          if (!candItem.primaryFile.isContentLoaded) {
            await candItem.primaryFile.loadContent();
          }

          const tsd = await TypeScriptDefinition.ensureOnFile(candItem.primaryFile);

          if (tsd && tsd.data && customComponentIds) {
            let doAddTs = false;

            for (const customCompId of customComponentIds) {
              if (tsd.data.indexOf(customCompId) >= 0) {
                doAddTs = true;
                break;
              }
            }

            if (doAddTs) {
              item.addChildItem(candItem);
            }
          }
        }
      } else if (candItem.itemType === ProjectItemType.terrainTextureCatalogResourceJson) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile) {
          const blockTextureCatalog = await TerrainTextureCatalogDefinition.ensureOnFile(candItem.primaryFile);

          if (blockTextureCatalog && textureList) {
            let doAddTextureCatalog = false;

            for (const textureId of textureList) {
              const blockResource = blockTextureCatalog.getTexture(textureId);

              if (blockResource) {
                doAddTextureCatalog = true;
                break;
              }
            }

            if (doAddTextureCatalog) {
              item.addChildItem(candItem);
            }
          }
        }
      } else if (candItem.itemType === ProjectItemType.blocksCatalogResourceJson) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile) {
          const blockCatalog = await BlocksCatalogDefinition.ensureOnFile(candItem.primaryFile);

          if (blockCatalog && this.id) {
            const blockResource = blockCatalog.getBlockDefinition(this.id);

            if (blockResource) {
              item.addChildItem(candItem);
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
      } else if (candItem.itemType === ProjectItemType.lootTableBehavior) {
        for (const lootTablePath of lootTablePaths) {
          if (candItem.projectPath?.endsWith(lootTablePath)) {
            item.addChildItem(candItem);
          }
        }
      }
    }
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<BlockTypeDefinition, BlockTypeDefinition>) {
    let bt: BlockTypeDefinition | undefined;

    if (file.manager === undefined) {
      bt = new BlockTypeDefinition("custom:" + file.name);

      bt.behaviorPackFile = file;

      file.manager = bt;
    }

    if (file.manager !== undefined && file.manager instanceof BlockTypeDefinition) {
      bt = file.manager as BlockTypeDefinition;

      if (!bt.isLoaded) {
        if (loadHandler) {
          bt.onLoaded.subscribe(loadHandler);
        }

        await bt.load();
      }
    }

    return bt;
  }

  async addCustomComponent(blockTypeItem: ProjectItem, componentName: string) {
    let componentNameShort = componentName;

    const idx = componentName.indexOf(":");
    if (idx >= 0) {
      componentNameShort = componentName.substring(idx + 1);
    }

    this.ensureComponent(componentName, {});

    const fileNameSugg = Utilities.getHumanifiedObjectNameNoSpaces(componentNameShort);

    await ProjectUtilities.ensureTypeScriptFileWith(
      blockTypeItem.project,
      componentName,
      "new-templates",
      "blockCustomComponent",
      fileNameSugg,
      {
        "example:newComponentId": componentName,
        ExampleNewComponent: fileNameSugg,
        initExampleNew: "init" + fileNameSugg,
      }
    );

    await ProjectUtilities.ensureContentInDefaultScriptFile(
      blockTypeItem.project,
      "import { init" + fileNameSugg,
      "import { init" + fileNameSugg + ' } from "./' + fileNameSugg + '"\n',
      false
    );

    await ProjectUtilities.ensureContentInDefaultScriptFile(
      blockTypeItem.project,
      "init" + fileNameSugg + "()",
      "init" + fileNameSugg + "();\n",
      true
    );

    this.persist();
  }

  persist(): boolean {
    if (this._file === undefined) {
      return false;
    }

    Log.assert(!this._isLoaded || this._wrapper !== null, "BTP");

    if (!this._wrapper) {
      return false;
    }

    return this._file.setObjectContentIfSemanticallyDifferent(this._wrapper);
  }

  async load() {
    if (this._file === undefined || this._isLoaded) {
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

    this._wrapper = data;

    const block = data["minecraft:block"];

    if (block && block.description) {
      this.id = block.description.identifier;
    }

    this._data = block;

    this._onLoaded.dispatch(this, this);

    this._isLoaded = true;
  }
}

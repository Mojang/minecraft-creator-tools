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
  private _behaviorPackFile?: IFile;
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
    return this._typeData.mapColor;
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

  public async getFormatVersionIsCurrent() {
    const fv = this.getFormatVersion();

    if (fv === undefined || fv.length !== 3) {
      return false;
    }

    return await Database.isRecentVersionFromVersionArray(fv);
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

    if (this._data?.description) {
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
    let val = this._typeData.icon;

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

    this._typeData = {
      name: name,
    };

    if (name.indexOf(":") >= 0 && !name.startsWith("minecraft:")) {
      this._isCustom = true;
    }
  }

  public get id() {
    if (this._data && this._data.description) {
      return this._data.description.identifier;
    }

    return this._id;
  }

  public set id(newId: string | undefined) {
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
    return this._behaviorPackFile;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public set behaviorPackFile(newFile: IFile | undefined) {
    this._behaviorPackFile = newFile;
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

  getComponent(id: string) {
    if (this._data === undefined) {
      return undefined;
    }

    if (!this._managed[id]) {
      const comp = this._data.components[id];
      if (comp) {
        this._managed[id] = new ManagedComponent(id, comp);
      }
    }

    return this._managed[id];
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

  addComponent(id: string, component: any) {
    this._ensureBehaviorPackDataInitialized();

    const mc = new ManagedComponent(id, component);

    const bpData = this._data as IBlockTypeBehaviorPack;

    bpData.components[id] = component;
    this._managed[id] = mc;

    this._onComponentAdded.dispatch(this, mc);
  }

  removeComponent(id: string) {
    if (this._data === undefined) {
      return;
    }

    const newBehaviorPacks: { [name: string]: IComponent | string | number | undefined } = {};
    const newComponents: { [name: string]: IManagedComponent | undefined } = {};

    for (const name in this._data.components) {
      if (name !== id) {
        const component = this._data.components[name];

        newBehaviorPacks[name] = component;
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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<BlockTypeDefinition, BlockTypeDefinition>) {
    let bt: BlockTypeDefinition | undefined;

    if (file.manager === undefined) {
      bt = new BlockTypeDefinition("custom:" + file.name);

      bt.behaviorPackFile = file;

      file.manager = bt;
    }

    if (file.manager !== undefined && file.manager instanceof BlockTypeDefinition) {
      bt = file.manager as BlockTypeDefinition;

      if (!bt.isLoaded && loadHandler) {
        bt.onLoaded.subscribe(loadHandler);
      }

      await bt.load();
    }

    return bt;
  }

  persist() {
    if (this._behaviorPackFile === undefined) {
      return;
    }

    const bpString = JSON.stringify(this._wrapper, null, 2);

    this._behaviorPackFile.setContent(bpString);
  }

  async load() {
    if (this._behaviorPackFile === undefined || this._isLoaded) {
      return;
    }

    await this._behaviorPackFile.loadContent();

    if (!this._behaviorPackFile.content || this._behaviorPackFile.content instanceof Uint8Array) {
      return;
    }

    let data: any = {};

    let result = StorageUtilities.getJsonObject(this._behaviorPackFile);

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

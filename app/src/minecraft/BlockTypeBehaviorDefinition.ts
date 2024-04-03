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

export default class BlockTypeBehaviorDefinition implements IManagedComponentSetItem {
  private _typeId = "";

  public data: IBlockTypeData;

  private _baseType?: BlockBaseType;
  private _baseTypeId = "";

  private _material = "";
  private _isCustom = false;
  private _behaviorPackData: IBlockTypeWrapper | null = null;
  private _behaviorPackFile?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public behaviorPackBlockTypeDef?: IBlockTypeBehaviorPack;
  private _managed: { [id: string]: IManagedComponent | undefined } = {};
  private _onLoaded = new EventDispatcher<BlockTypeBehaviorDefinition, BlockTypeBehaviorDefinition>();

  private _onComponentAdded = new EventDispatcher<BlockTypeBehaviorDefinition, IManagedComponent>();
  private _onComponentRemoved = new EventDispatcher<BlockTypeBehaviorDefinition, string>();
  private _onComponentChanged = new EventDispatcher<BlockTypeBehaviorDefinition, IManagedComponent>();

  public get numericId() {
    return this.data.id;
  }

  public get baseTypeId() {
    return this._baseTypeId;
  }

  public get mapColor() {
    return this.data.mapColor;
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

  public getFormatVersion(): number[] | undefined {
    if (!this._behaviorPackData) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this._behaviorPackData.format_version);
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
    let val = this.data.icon;

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

    this.data = {
      name: name,
    };

    if (name.indexOf(":") >= 0 && !name.startsWith("minecraft:")) {
      this._isCustom = true;
    }
  }

  public set id(newId: string | undefined) {
    this._id = newId;
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
    if (this.behaviorPackBlockTypeDef === undefined) {
      return undefined;
    }

    if (!this._managed[id]) {
      const comp = this.behaviorPackBlockTypeDef.components[id];
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

  getComponents(): IManagedComponent[] {
    const componentSet: IManagedComponent[] = [];

    if (this.behaviorPackBlockTypeDef !== undefined) {
      for (const componentName in this.behaviorPackBlockTypeDef.components) {
        const component = this.getComponent(componentName);

        if (component !== undefined) {
          componentSet.push(component);
        }
      }
    }

    return componentSet;
  }

  addComponent(id: string, component: IManagedComponent) {
    this._ensureBehaviorPackDataInitialized();

    const bpData = this.behaviorPackBlockTypeDef as IBlockTypeBehaviorPack;

    bpData.components[id] = component.getData();
    this._managed[id] = component;

    this._onComponentAdded.dispatch(this, component);
  }

  removeComponent(id: string) {
    if (this.behaviorPackBlockTypeDef === undefined) {
      return;
    }

    const newBehaviorPacks: { [name: string]: IComponent | string | number | undefined } = {};
    const newComponents: { [name: string]: IManagedComponent | undefined } = {};

    for (const name in this.behaviorPackBlockTypeDef.components) {
      if (name !== id) {
        const component = this.behaviorPackBlockTypeDef.components[name];

        newBehaviorPacks[name] = component;
      }
    }

    for (const name in this._managed) {
      if (name !== id) {
        newComponents[name] = this._managed[name];
      }
    }

    this.behaviorPackBlockTypeDef.components = newBehaviorPacks;
    this._managed = newComponents;
  }

  _ensureBehaviorPackDataInitialized() {
    if (this.behaviorPackBlockTypeDef === undefined) {
      this.behaviorPackBlockTypeDef = {
        description: {
          identifier: "unknown",
        },
        components: {},
        events: {},
      };
    }
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<BlockTypeBehaviorDefinition, BlockTypeBehaviorDefinition>
  ) {
    let bt: BlockTypeBehaviorDefinition | undefined;

    if (file.manager === undefined) {
      bt = new BlockTypeBehaviorDefinition("custom:" + file.name);

      bt.behaviorPackFile = file;

      file.manager = bt;
    }

    if (file.manager !== undefined && file.manager instanceof BlockTypeBehaviorDefinition) {
      bt = file.manager as BlockTypeBehaviorDefinition;

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

    const bpString = JSON.stringify(this._behaviorPackData, null, 2);

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

    this._behaviorPackData = data;

    const block = data["minecraft:block"];

    if (block.description) {
      this.id = block.description.identifier;
    }

    this.behaviorPackBlockTypeDef = block;

    this._onLoaded.dispatch(this, this);

    this._isLoaded = true;
  }
}

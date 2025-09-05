// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import IManagedComponentSetItem from "./IManagedComponentSetItem";
import IComponent from "./IComponent";
import { EventDispatcher, IEventHandler } from "ste-events";
import IItemTypeWrapper from "./IItemTypeWrapper";
import { ManagedComponent } from "./ManagedComponent";
import IManagedComponent from "./IManagedComponent";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";
import IDefinition from "./IDefinition";
import IItemTypeResourcePack from "./IItemTypeResourcePack";
import { Util } from "leaflet";
import Utilities from "../core/Utilities";

// this is a type that is "legacy" version 1.10 definitions of item types
export default class ItemTypeResourceDefinition implements IManagedComponentSetItem, IDefinition {
  public wrapper: IItemTypeWrapper | null = null;
  private _behaviorPackFile?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;
  private _managed: { [id: string]: IManagedComponent | undefined } = {};

  private _data?: IItemTypeResourcePack;

  private _onLoaded = new EventDispatcher<ItemTypeResourceDefinition, ItemTypeResourceDefinition>();

  private _onComponentAdded = new EventDispatcher<ItemTypeResourceDefinition, IManagedComponent>();
  private _onComponentRemoved = new EventDispatcher<ItemTypeResourceDefinition, string>();
  private _onComponentChanged = new EventDispatcher<ItemTypeResourceDefinition, IManagedComponent>();

  public get data() {
    return this._data;
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

  public get id() {
    if (this._id === undefined) {
      return "";
    }
    return this._id;
  }

  public set id(newId: string) {
    this._id = newId;
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

  public async getFormatVersionIsCurrent() {
    const fv = this.getFormatVersion();

    if (fv === undefined || fv.length !== 3) {
      return false;
    }

    return await Database.isRecentVersionFromVersionArray(fv);
  }

  public getFormatVersion(): number[] | undefined {
    if (!this.wrapper) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this.wrapper.format_version);
  }

  getComponent(id: string) {
    if (this._data === undefined) {
      return undefined;
    }

    if (!this._managed[id]) {
      const comp = this._data.components[id];
      if (comp) {
        this._managed[id] = new ManagedComponent(this._data.components, id, comp);
      }
    }

    return this._managed[id];
  }

  notifyComponentUpdated(id: string) {
    const component = this.getComponent(id);

    if (component === undefined) {
      Log.unexpectedUndefined("ITRNCU");
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

  setResourcePackFormatVersion(versionStr: string) {
    this._ensureDataInitialized();

    if (this.wrapper) {
      this.wrapper.format_version = versionStr;
    }
  }

  addComponent(
    id: string,
    componentOrData: ManagedComponent | IComponent | string | string[] | boolean | number[] | number | undefined
  ) {
    this._ensureDataInitialized();

    const bpData = this._data as IItemTypeResourcePack;

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
    const newManagedComponents: { [name: string]: IManagedComponent | undefined } = {};

    for (const name in this._data.components) {
      if (name !== id && Utilities.isUsableAsObjectKey(name)) {
        const component = this._data.components[name];

        newBehaviorPacks[name] = component;
      }
    }

    for (const name in this._managed) {
      if (name !== id && Utilities.isUsableAsObjectKey(name)) {
        newManagedComponents[name] = this._managed[name];
      }
    }

    this._data.components = newBehaviorPacks;
    this._managed = newManagedComponents;
  }

  _ensureDataInitialized() {
    if (this._data === undefined) {
      this._data = {
        description: {
          identifier: "unknown",
        },
        components: {},
      };
    }
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<ItemTypeResourceDefinition, ItemTypeResourceDefinition>
  ) {
    let itt: ItemTypeResourceDefinition | undefined;

    if (file.manager === undefined) {
      itt = new ItemTypeResourceDefinition();

      itt.behaviorPackFile = file;

      file.manager = itt;
    }

    if (file.manager !== undefined && file.manager instanceof ItemTypeResourceDefinition) {
      itt = file.manager as ItemTypeResourceDefinition;

      if (!itt.isLoaded) {
        if (loadHandler) {
          itt.onLoaded.subscribe(loadHandler);
        }

        await itt.load();
      }
    }

    return itt;
  }

  persist() {
    if (this._behaviorPackFile === undefined) {
      return;
    }

    const bpString = JSON.stringify(this.wrapper, null, 2);

    this._behaviorPackFile.setContent(bpString);
  }

  async load() {
    if (this._behaviorPackFile === undefined || this._isLoaded) {
      return;
    }

    if (!this._behaviorPackFile.isContentLoaded) {
      await this._behaviorPackFile.loadContent();
    }

    if (this._behaviorPackFile.content === null || this._behaviorPackFile.content instanceof Uint8Array) {
      return;
    }

    this.wrapper = StorageUtilities.getJsonObject(this._behaviorPackFile);

    if (this.wrapper) {
      const item = (this.wrapper as any)["minecraft:item"];

      if (item && item.description) {
        this.id = item.description.identifier;
      }

      this._data = item;
    }

    this._isLoaded = true;
  }
}

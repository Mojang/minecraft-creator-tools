// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import IManagedComponentSetItem from "./IManagedComponentSetItem";
import IComponent from "./IComponent";
import { EventDispatcher, IEventHandler } from "ste-events";
import IItemTypeBehaviorPack from "./IItemTypeBehaviorPack";
import IItemTypeWrapper from "./IItemTypeWrapper";
import { ManagedComponent } from "./ManagedComponent";
import IManagedComponent from "./IManagedComponent";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";

export default class ItemTypeDefinition implements IManagedComponentSetItem {
  private wrapper: IItemTypeWrapper | null = null;
  private _behaviorPackFile?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;
  private _managed: { [id: string]: IManagedComponent | undefined } = {};

  public data?: IItemTypeBehaviorPack;

  private _onLoaded = new EventDispatcher<ItemTypeDefinition, ItemTypeDefinition>();

  private _onComponentAdded = new EventDispatcher<ItemTypeDefinition, IManagedComponent>();
  private _onComponentRemoved = new EventDispatcher<ItemTypeDefinition, string>();
  private _onComponentChanged = new EventDispatcher<ItemTypeDefinition, IManagedComponent>();

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
    return this._id;
  }

  public set id(newId: string | undefined) {
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
    if (this.data === undefined) {
      return undefined;
    }

    if (!this._managed[id]) {
      const comp = this.data.components[id];
      if (comp) {
        this._managed[id] = new ManagedComponent(id, comp);
      }
    }

    return this._managed[id];
  }

  notifyComponentUpdated(id: string) {
    const component = this.getComponent(id);

    if (component === undefined) {
      Log.unexpectedUndefined("ITNCU");
    } else {
      this._onComponentChanged.dispatch(this, component);
    }
  }

  getComponents(): IManagedComponent[] {
    const componentSet: IManagedComponent[] = [];

    if (this.data !== undefined) {
      for (const componentName in this.data.components) {
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

    const bpData = this.data as IItemTypeBehaviorPack;

    bpData.components[id] = component.getData();
    this._managed[id] = component;

    this._onComponentAdded.dispatch(this, component);
  }

  removeComponent(id: string) {
    if (this.data === undefined) {
      return;
    }

    const newBehaviorPacks: { [name: string]: IComponent | string | number | undefined } = {};
    const newManagedComponents: { [name: string]: IManagedComponent | undefined } = {};

    for (const name in this.data.components) {
      if (name !== id) {
        const component = this.data.components[name];

        newBehaviorPacks[name] = component;
      }
    }

    for (const name in this._managed) {
      if (name !== id) {
        newManagedComponents[name] = this._managed[name];
      }
    }

    this.data.components = newBehaviorPacks;
    this._managed = newManagedComponents;
  }

  _ensureBehaviorPackDataInitialized() {
    if (this.data === undefined) {
      this.data = {
        description: {
          identifier: "unknown",
        },
        components: {},
        events: {},
      };
    }
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<ItemTypeDefinition, ItemTypeDefinition>) {
    let itt: ItemTypeDefinition | undefined = undefined;

    if (file.manager === undefined) {
      itt = new ItemTypeDefinition();

      itt.behaviorPackFile = file;

      file.manager = itt;
    }

    if (file.manager !== undefined && file.manager instanceof ItemTypeDefinition) {
      itt = file.manager as ItemTypeDefinition;

      if (!itt.isLoaded && loadHandler) {
        itt.onLoaded.subscribe(loadHandler);
      }

      await itt.load();
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

    await this._behaviorPackFile.loadContent();

    if (this._behaviorPackFile.content === null || this._behaviorPackFile.content instanceof Uint8Array) {
      return;
    }

    this.wrapper = StorageUtilities.getJsonObject(this._behaviorPackFile);

    if (this.wrapper) {
      const item = (this.wrapper as any)["minecraft:item"];

      this.id = item.description.identifier;

      this.data = item;
    }

    this._isLoaded = true;
  }
}

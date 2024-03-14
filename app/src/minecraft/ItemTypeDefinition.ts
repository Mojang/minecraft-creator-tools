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

export default class ItemTypeDefinition implements IManagedComponentSetItem {
  private _behaviorPackData: IItemTypeWrapper | null = null;
  private _behaviorPackFile?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;
  private _managed: { [id: string]: IManagedComponent | undefined } = {};

  public behaviorPackDefinition?: IItemTypeBehaviorPack;

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

  getComponent(id: string) {
    if (this.behaviorPackDefinition === undefined) {
      return undefined;
    }

    if (!this._managed[id]) {
      const comp = this.behaviorPackDefinition.components[id];
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

    if (this.behaviorPackDefinition !== undefined) {
      for (const componentName in this.behaviorPackDefinition.components) {
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

    const bpData = this.behaviorPackDefinition as IItemTypeBehaviorPack;

    bpData.components[id] = component.getData();
    this._managed[id] = component;

    this._onComponentAdded.dispatch(this, component);
  }

  removeComponent(id: string) {
    if (this.behaviorPackDefinition === undefined) {
      return;
    }

    const newBehaviorPacks: { [name: string]: IComponent | string | number | undefined } = {};
    const newManagedComponents: { [name: string]: IManagedComponent | undefined } = {};

    for (const name in this.behaviorPackDefinition.components) {
      if (name !== id) {
        const component = this.behaviorPackDefinition.components[name];

        newBehaviorPacks[name] = component;
      }
    }

    for (const name in this._managed) {
      if (name !== id) {
        newManagedComponents[name] = this._managed[name];
      }
    }

    this.behaviorPackDefinition.components = newBehaviorPacks;
    this._managed = newManagedComponents;
  }

  _ensureBehaviorPackDataInitialized() {
    if (this.behaviorPackDefinition === undefined) {
      this.behaviorPackDefinition = {
        description: {
          identifier: "unknown",
        },
        components: {},
        events: {},
      };
    }
  }

  static async ensureItemTypeOnFile(file: IFile, loadHandler?: IEventHandler<ItemTypeDefinition, ItemTypeDefinition>) {
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

    const bpString = JSON.stringify(this._behaviorPackData, null, 2);

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

    this._behaviorPackData = StorageUtilities.getJsonObject(this._behaviorPackFile);

    if (this._behaviorPackData) {
      const entity = (this._behaviorPackData as any)["minecraft:entity"];

      this.id = entity.description.identifier;

      this.behaviorPackDefinition = entity;
    }

    this._isLoaded = true;
  }
}

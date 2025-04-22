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
import IDefinition from "./IDefinition";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import AttachableResourceDefinition from "./AttachableResourceDefinition";
import TypeScriptDefinition from "./TypeScriptDefinition";

export default class ItemTypeDefinition implements IManagedComponentSetItem, IDefinition {
  public wrapper: IItemTypeWrapper | null = null;
  private _behaviorPackFile?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;
  private _managed: { [id: string]: IManagedComponent | undefined } = {};

  private _data?: IItemTypeBehaviorPack;

  private _onLoaded = new EventDispatcher<ItemTypeDefinition, ItemTypeDefinition>();

  private _onComponentAdded = new EventDispatcher<ItemTypeDefinition, IManagedComponent>();
  private _onComponentRemoved = new EventDispatcher<ItemTypeDefinition, string>();
  private _onComponentChanged = new EventDispatcher<ItemTypeDefinition, IManagedComponent>();

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

  ensureComponent(id: string, defaultData?: IComponent | string | string[] | boolean | number[] | number | undefined) {
    const comp = this.getComponent(id);

    if (comp) {
      return comp;
    }

    return this.addComponent(id, defaultData);
  }

  getComponent(id: string) {
    if (!this._data || !this._data.components) {
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
      Log.unexpectedUndefined("ITNCU");
    } else {
      this._onComponentChanged.dispatch(this, component);
    }
  }

  getAllComponents(): IManagedComponent[] {
    return this.getComponents();
  }

  getCustomComponentIds() {
    let customComponentIds: string[] = [];
    const customComponent = this.getComponent("minecraft:custom_components");

    if (customComponent) {
      let compData = customComponent.getData();

      if (compData && Array.isArray(compData)) {
        for (const str of compData) {
          if (typeof str === "string") {
            customComponentIds.push(str);
          }
        }
      }
    }

    return customComponentIds;
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

  async addChildItems(project: Project, item: ProjectItem) {
    const itemsCopy = project.getItemsCopy();

    let customComponentIds: string[] = this.getCustomComponentIds();
    for (const candItem of itemsCopy) {
      if (candItem.itemType === ProjectItemType.ts) {
        await candItem.ensureStorage();

        if (candItem.defaultFile) {
          await candItem.load();

          const tsd = await TypeScriptDefinition.ensureOnFile(candItem.defaultFile);

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
      } else if (candItem.itemType === ProjectItemType.attachableResourceJson) {
        await candItem.ensureStorage();

        if (candItem.defaultFile) {
          const ard = await AttachableResourceDefinition.ensureOnFile(candItem.defaultFile);

          if (ard) {
            const id = ard.id;

            if (id === this.id) {
              item.addChildItem(candItem);
            }
          }
        }
      }
    }
  }

  setBehaviorPackFormatVersion(versionStr: string) {
    this._ensureBehaviorPackDataInitialized();

    if (this.wrapper) {
      this.wrapper.format_version = versionStr;
    }
  }

  addComponent(
    id: string,
    componentOrData: ManagedComponent | IComponent | string | string[] | boolean | number[] | number | undefined
  ) {
    this._ensureBehaviorPackDataInitialized();

    const bpData = this._data as IItemTypeBehaviorPack;

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
      if (name !== id) {
        const component = this._data.components[name];

        newBehaviorPacks[name] = component;
      }
    }

    for (const name in this._managed) {
      if (name !== id) {
        newManagedComponents[name] = this._managed[name];
      }
    }

    this._data.components = newBehaviorPacks;
    this._managed = newManagedComponents;
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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<ItemTypeDefinition, ItemTypeDefinition>) {
    let itt: ItemTypeDefinition | undefined;

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

  static isVisualComponent(value: string) {
    if (
      value === "minecraft:icon" ||
      value === "minecraft:display_name" ||
      value === "minecraft:glint" ||
      value === "minecraft:hover_text_color"
    ) {
      return true;
    }

    return false;
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

      if (item && item.description) {
        this.id = item.description.identifier;
      }

      this._data = item;
    }

    this._isLoaded = true;
  }
}

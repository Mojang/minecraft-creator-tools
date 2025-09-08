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
import Utilities from "../core/Utilities";
import ProjectUtilities from "../app/ProjectUtilities";

export default class ItemTypeDefinition implements IManagedComponentSetItem, IDefinition {
  private _wrapper: IItemTypeWrapper | null = null;
  private _file?: IFile;
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
    this._isLoaded = false;
    this._wrapper = null;
    this._managed = {};
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

  public get formatVersion() {
    if (this._wrapper) {
      return this._wrapper.format_version;
    }

    return undefined;
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
    if (!this._wrapper) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this._wrapper.format_version);
  }

  public setFormatVersion(version: string): void {
    if (!this._wrapper) {
      return;
    }

    this._wrapper.format_version = version;
  }

  constructor() {
    this._handleFileUpdated = this._handleFileUpdated.bind(this);
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

    if (!Utilities.isUsableAsObjectKey(id)) {
      Log.unsupportedToken(id);
      throw new Error();
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

    for (const comp of this.getComponents()) {
      if (!comp.id.startsWith("minecraft:") && !comp.id.startsWith("tag:")) {
        customComponentIds.push(comp.id);
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
      } else if (candItem.itemType === ProjectItemType.attachableResourceJson) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile) {
          const ard = await AttachableResourceDefinition.ensureOnFile(candItem.primaryFile);

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

    if (this._wrapper) {
      this._wrapper.format_version = versionStr;
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

  async addCustomComponent(itemTypeItem: ProjectItem, componentName: string) {
    let componentNameShort = componentName;

    const idx = componentName.indexOf(":");
    if (idx >= 0) {
      componentNameShort = componentName.substring(idx + 1);
    }

    this.ensureComponent(componentName, {});

    const fileNameSugg = Utilities.getHumanifiedObjectNameNoSpaces(componentNameShort);

    this.setFormatVersion("1.21.100");

    await ProjectUtilities.ensureTypeScriptFileWith(
      itemTypeItem.project,
      componentName,
      "new-templates",
      "itemCustomComponent",
      fileNameSugg,
      {
        "example:newComponentId": componentName,
        ExampleNewComponent: fileNameSugg,
        initExampleNew: "init" + fileNameSugg,
      }
    );

    await ProjectUtilities.ensureContentInDefaultScriptFile(
      itemTypeItem.project,
      "import { init" + fileNameSugg,
      "import { init" + fileNameSugg + ' } from "./' + fileNameSugg + '"\n',
      false
    );

    await ProjectUtilities.ensureContentInDefaultScriptFile(
      itemTypeItem.project,
      "init" + fileNameSugg + "()",
      "init" + fileNameSugg + "();\n",
      true
    );

    this.persist();
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

      if (!itt.isLoaded) {
        if (loadHandler) {
          itt.onLoaded.subscribe(loadHandler);
        }

        await itt.load();
      }
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
    if (this._file === undefined) {
      return;
    }

    Log.assert(!this._isLoaded || this._wrapper !== null, "ITDP");

    if (!this._wrapper) {
      return;
    }

    const bpString = JSON.stringify(this._wrapper, null, 2);

    this._file.setContent(bpString);
  }

  async load() {
    if (this._file === undefined || this._isLoaded) {
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this._wrapper = StorageUtilities.getJsonObject(this._file);

    if (this._wrapper) {
      const item = (this._wrapper as any)["minecraft:item"];

      if (item && item.description) {
        this.id = item.description.identifier;
      }

      this._data = item;
    }

    this._isLoaded = true;
  }
}

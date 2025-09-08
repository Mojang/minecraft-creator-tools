// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Utilities from "../core/Utilities";
import { EventDispatcher } from "ste-events";
import IFile from "../storage/IFile";
import Log from "../core/Log";
import IComponent from "./IComponent";
import IManagedComponentSetItem from "./IManagedComponentSetItem";
import IManagedComponent from "./IManagedComponent";
import { ManagedComponent } from "./ManagedComponent";
import IDefinition from "./IDefinition";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import MinecraftDefinitions from "./MinecraftDefinitions";
import BiomeResourceDefinition from "./BiomeResourceDefinition";

export interface IBiomeBehaviorData {
  format_version: string;
  "minecraft:biome": {
    description: {
      identifier: string;
    };
    components: { [componentName: string]: any };
  };
}

export default class BiomeBehaviorDefinition implements IManagedComponentSetItem, IDefinition {
  private _typeId = "";
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public _data?: IBiomeBehaviorData;
  private _managed: { [id: string]: IManagedComponent | undefined } = {};
  private _onLoaded = new EventDispatcher<BiomeBehaviorDefinition, BiomeBehaviorDefinition>();

  private _onComponentAdded = new EventDispatcher<BiomeBehaviorDefinition, IManagedComponent>();
  private _onComponentRemoved = new EventDispatcher<BiomeBehaviorDefinition, string>();
  private _onComponentChanged = new EventDispatcher<BiomeBehaviorDefinition, IManagedComponent>();

  public get data() {
    return this._data;
  }

  public get isLoaded() {
    return this._isLoaded;
  }

  public get file() {
    return this._file;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
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

  constructor(typeId?: string) {
    if (typeId) {
      this._typeId = typeId;
      this._id = typeId;
    }
  }

  public get typeId() {
    return this._typeId;
  }

  public set typeId(newId: string) {
    this._typeId = newId;
    this._id = newId;
  }

  public get id(): string {
    return this._id || this._typeId || "";
  }

  public set id(newId: string) {
    this._id = newId;
    this._typeId = newId;
  }

  private _ensureBiomeDataInitialized() {
    if (!this._data) {
      this._data = {
        format_version: "1.16.0",
        "minecraft:biome": {
          description: {
            identifier: this._typeId,
          },
          components: {},
        },
      };
    }

    if (!this._data["minecraft:biome"]) {
      this._data["minecraft:biome"] = {
        description: {
          identifier: this._typeId,
        },
        components: {},
      };
    }

    if (!this._data["minecraft:biome"].description) {
      this._data["minecraft:biome"].description = {
        identifier: this._typeId,
      };
    }

    if (!this._data["minecraft:biome"].components) {
      this._data["minecraft:biome"].components = {};
    }
  }

  ensureComponent(id: string, defaultData?: IComponent | string | string[] | boolean | number[] | number | undefined) {
    const comp = this.getComponent(id);

    if (comp) {
      return comp;
    }

    return this.addComponent(id, defaultData);
  }

  getComponent(id: string): IManagedComponent | undefined {
    if (this._data === undefined) {
      return undefined;
    }

    if (!this._managed[id]) {
      if (this._data["minecraft:biome"]?.components) {
        const comp = this._data["minecraft:biome"].components[id];
        if (comp) {
          this._managed[id] = new ManagedComponent(this._data["minecraft:biome"].components, id, comp);
        }
      }
    }

    return this._managed[id];
  }

  notifyComponentUpdated(id: string) {
    const component = this.getComponent(id);

    if (component === undefined) {
      Log.unexpectedUndefined("BDNCU");
    } else {
      this._onComponentChanged.dispatch(this, component);
    }
  }

  getAllComponents(): IManagedComponent[] {
    return this.getComponents();
  }

  getComponents(): IManagedComponent[] {
    const componentSet: IManagedComponent[] = [];

    if (this._data !== undefined && this._data["minecraft:biome"]?.components) {
      for (const componentName in this._data["minecraft:biome"].components) {
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
  ): IManagedComponent {
    this._ensureBiomeDataInitialized();

    const biomeData = this._data as IBiomeBehaviorData;

    const mc =
      componentOrData instanceof ManagedComponent
        ? componentOrData
        : new ManagedComponent(biomeData["minecraft:biome"].components, id, componentOrData);

    biomeData["minecraft:biome"].components[id] = mc.getData();
    this._managed[id] = mc;

    this._onComponentAdded.dispatch(this, mc);

    return mc;
  }

  removeComponent(id: string) {
    if (this._data === undefined || !this._data["minecraft:biome"]?.components) {
      return;
    }

    const newComponents: {
      [name: string]: IComponent | string | string[] | boolean | number[] | number | undefined;
    } = {};
    const newManagedComponents: { [name: string]: IManagedComponent | undefined } = {};

    for (const name in this._data["minecraft:biome"].components) {
      if (name !== id) {
        if (Utilities.isUsableAsObjectKey(name)) {
          const component = this._data["minecraft:biome"].components[name];
          newComponents[name] = component;
        }
      }
    }

    for (const name in this._managed) {
      if (name !== id) {
        newManagedComponents[name] = this._managed[name];
      }
    }

    this._data["minecraft:biome"].components = newComponents;
    this._managed = newManagedComponents;

    this._onComponentRemoved.dispatch(this, id);
  }

  static async ensureOnFile(file: IFile): Promise<BiomeBehaviorDefinition | undefined> {
    if (file.manager === undefined) {
      const bd = new BiomeBehaviorDefinition();

      bd._file = file;

      if (!bd.isLoaded) {
        await bd.load();
      }

      file.manager = bd;
    }

    if (file.manager instanceof BiomeBehaviorDefinition) {
      return file.manager as BiomeBehaviorDefinition;
    }

    return undefined;
  }

  async persist() {
    if (this._file === undefined) {
      return;
    }

    Log.assert(this._data !== null, "BBDP");

    if (this._data) {
      this._file.setContent(JSON.stringify(this._data, null, 2));
    }
  }

  async load() {
    if (this._file === undefined) {
      return;
    }

    const fileContent = this._file.content;

    if (fileContent === null || fileContent instanceof Uint8Array) {
      return;
    }

    try {
      this._data = JSON.parse(fileContent);

      if (this._data && this._data["minecraft:biome"]?.description?.identifier) {
        this._typeId = this._data["minecraft:biome"].description.identifier;
        this._id = this._typeId;
      }

      this._isLoaded = true;
      this._onLoaded.dispatch(this, this);
    } catch (e) {
      Log.error("Could not load biome definition: " + e);
    }
  }

  async addChildItems(project: Project, item: ProjectItem) {
    const itemsCopy = project.getItemsCopy();

    for (const candItem of itemsCopy) {
      if (candItem.itemType === ProjectItemType.biomeResource) {
        const biomeResourceDef = (await MinecraftDefinitions.get(candItem)) as undefined | BiomeResourceDefinition;

        if (biomeResourceDef && biomeResourceDef.id === this.id) {
          item.addChildItem(candItem);
        }
      }
    }
  }

  static getComponentFromBaseFileName(name: string) {
    let canonName = name;

    if (canonName.startsWith("minecraft_")) {
      canonName = canonName.substring(10);
    }

    return canonName;
  }

  public get shortId() {
    if (this._typeId && this._typeId.indexOf(":") >= 0) {
      return this._typeId.substring(this._typeId.indexOf(":") + 1);
    }

    return this._typeId;
  }

  public get namespace() {
    if (this._typeId && this._typeId.indexOf(":") >= 0) {
      return this._typeId.substring(0, this._typeId.indexOf(":"));
    }

    return undefined;
  }

  ensureDefinition() {
    this._ensureBiomeDataInitialized();

    if (this._data && this._data["minecraft:biome"]?.description) {
      this._data["minecraft:biome"].description.identifier = this._typeId;
    }
  }
}

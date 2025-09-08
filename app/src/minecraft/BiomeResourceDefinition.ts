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
import ClientBiomeJSONFile, { ClientBiomeJSONFileMinecraftClientBiome } from "./json/client_biome/ClientBiomeJSONFile";
import { IComponentContainer } from "./IComponentDataItem";

export default class BiomeResourceDefinition implements IManagedComponentSetItem, IDefinition {
  private _typeId = "";
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public _data?: ClientBiomeJSONFile;
  private _managed: { [id: string]: IManagedComponent | undefined } = {};
  private _onLoaded = new EventDispatcher<BiomeResourceDefinition, BiomeResourceDefinition>();

  private _onComponentAdded = new EventDispatcher<BiomeResourceDefinition, IManagedComponent>();
  private _onComponentRemoved = new EventDispatcher<BiomeResourceDefinition, string>();
  private _onComponentChanged = new EventDispatcher<BiomeResourceDefinition, IManagedComponent>();

  public get data() {
    return this._data;
  }

  public get clientBiomeData() {
    this._ensureBiomeDataInitialized();

    return (this._data as ClientBiomeJSONFile)["minecraft:client_biome"] as ClientBiomeJSONFileMinecraftClientBiome;
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
    if (!this._data || !this._data["minecraft:client_biome"]) {
      this._data = {
        format_version: "1.16.0",
        "minecraft:client_biome": {
          description: {
            identifier: this._typeId,
          },
          components: {},
        },
      };
    }

    if (!this._data["minecraft:client_biome"]) {
      this._data["minecraft:client_biome"] = {
        description: {
          identifier: this._typeId,
        },
        components: {},
      };
    }

    if (!this._data["minecraft:client_biome"].description) {
      this._data["minecraft:client_biome"].description = {
        identifier: this._typeId,
      };
    }

    if (!this._data["minecraft:client_biome"].components) {
      this._data["minecraft:client_biome"].components = {};
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
      if (this._data["minecraft:client_biome"]?.components) {
        const comp = (this._data["minecraft:client_biome"].components as IComponentContainer)[id];
        if (comp) {
          this._managed[id] = new ManagedComponent(
            this._data["minecraft:client_biome"].components as IComponentContainer,
            id,
            comp
          );
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

    if (this._data !== undefined && this._data["minecraft:client_biome"]?.components) {
      for (const componentName in this._data["minecraft:client_biome"].components) {
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

    const biomeData = this._data as ClientBiomeJSONFile;

    this.ensureDefinition();

    if (!biomeData || !biomeData["minecraft:client_biome"] || !biomeData["minecraft:client_biome"].components) {
      throw new Error();
    }

    const mc =
      componentOrData instanceof ManagedComponent
        ? componentOrData
        : new ManagedComponent(
            biomeData["minecraft:client_biome"].components as IComponentContainer,
            id,
            componentOrData
          );

    (biomeData["minecraft:client_biome"].components as any)[id] = mc.getData();
    this._managed[id] = mc;

    this._onComponentAdded.dispatch(this, mc);

    return mc;
  }

  removeComponent(id: string) {
    if (this._data === undefined || !this._data["minecraft:client_biome"]?.components) {
      return;
    }

    const newComponents: IComponentContainer = {};
    const newManagedComponents: { [name: string]: IManagedComponent | undefined } = {};

    for (const name in this._data["minecraft:client_biome"].components) {
      if (name !== id) {
        if (Utilities.isUsableAsObjectKey(name)) {
          const component = (this._data["minecraft:client_biome"].components as IComponentContainer)[name] as any;
          newComponents[name] = component;
        }
      }
    }

    for (const name in this._managed) {
      if (name !== id) {
        newManagedComponents[name] = this._managed[name];
      }
    }

    this._data["minecraft:client_biome"].components = newComponents;
    this._managed = newManagedComponents;

    this._onComponentRemoved.dispatch(this, id);
  }

  static async ensureOnFile(file: IFile): Promise<BiomeResourceDefinition | undefined> {
    if (file.manager === undefined) {
      const bd = new BiomeResourceDefinition();

      bd._file = file;

      if (!bd.isLoaded) {
        await bd.load();
      }

      file.manager = bd;
    }

    if (file.manager instanceof BiomeResourceDefinition) {
      return file.manager as BiomeResourceDefinition;
    }

    return undefined;
  }

  async persist() {
    if (this._file === undefined) {
      return;
    }

    Log.assert(this._data !== null, "ITDP");

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

      if (this._data && this._data["minecraft:client_biome"]?.description?.identifier) {
        this._typeId = this._data["minecraft:client_biome"].description.identifier;
        this._id = this._typeId;
      }

      this._isLoaded = true;
      this._onLoaded.dispatch(this, this);
    } catch (e) {
      Log.error("Could not load biome definition: " + e);
    }
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

    if (this._data && this._data["minecraft:client_biome"]?.description) {
      this._data["minecraft:client_biome"].description.identifier = this._typeId;
    }
  }
}

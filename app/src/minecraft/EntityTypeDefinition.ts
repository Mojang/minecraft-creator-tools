import IEntityTypeBehaviorPack from "./IEntityTypeBehaviorPack";
import IEntityTypeWrapper from "./IEntityTypeWrapper";
import IFile from "../storage/IFile";
import Log from "../core/Log";
import IManagedComponentSetItem from "./IManagedComponentSetItem";
import IComponent from "./IComponent";
import { EventDispatcher, IEventHandler } from "ste-events";
import ScriptGen from "../script/ScriptGen";
import ManagedComponentGroup from "./ManagedComponentGroup";
import IManagedComponent from "./IManagedComponent";
import { ManagedComponent } from "./ManagedComponent";
import ManagedEvent from "./ManagedEvent";
import StorageUtilities from "../storage/StorageUtilities";

export default class EntityTypeDefinition implements IManagedComponentSetItem {
  public behaviorPackWrapper?: IEntityTypeWrapper;
  private _behaviorPackFile?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  private _managedComponents: { [id: string]: IManagedComponent | undefined } = {};

  public behaviorPackEntityTypeDef?: IEntityTypeBehaviorPack;

  public _componentGroups: { [name: string]: ManagedComponentGroup } = {};
  public _events: { [name: string]: ManagedEvent } = {};

  private _onLoaded = new EventDispatcher<EntityTypeDefinition, EntityTypeDefinition>();

  private _onComponentAdded = new EventDispatcher<EntityTypeDefinition, IManagedComponent>();
  private _onComponentRemoved = new EventDispatcher<EntityTypeDefinition, string>();
  private _onComponentChanged = new EventDispatcher<EntityTypeDefinition, IManagedComponent>();

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

  public getFormatVersion(): number[] | undefined {
    if (!this.behaviorPackWrapper) {
      return undefined;
    }

    const fv = this.behaviorPackWrapper.format_version;

    if (typeof fv === "number") {
      return [fv];
    }

    if (typeof fv === "string") {
      let fvarr = this.behaviorPackWrapper.format_version.split(".");

      let fvarrInt: number[] = [];
      for (let i = 0; i < fvarr.length; i++) {
        try {
          fvarrInt.push(parseInt(fvarr[i]));
        } catch (e) {}
      }

      return fvarrInt;
    }

    return undefined;
  }

  public get shortId() {
    if (this._id !== undefined) {
      let val = this._id;

      if (val.startsWith("minecraft:")) {
        return val.substring(10, this._id.length);
      }

      const firstColon = val.indexOf(":");

      if (firstColon >= 0) {
        val = val.substring(firstColon + 1);
      }

      return val;
    }

    return undefined;
  }

  getComponent(id: string) {
    if (this.behaviorPackEntityTypeDef === undefined) {
      return undefined;
    }

    if (!this._managedComponents[id]) {
      const comp = this.behaviorPackEntityTypeDef.components[id];

      if (comp) {
        this._managedComponents[id] = new ManagedComponent(id, comp);
      }
    }

    return this._managedComponents[id];
  }

  get behaviorPackFormatVersion() {
    if (!this.behaviorPackWrapper || !this.behaviorPackWrapper.format_version) {
      return undefined;
    }

    return this.behaviorPackWrapper.format_version;
  }

  setBehaviorPackFormatVersion(versionStr: string) {
    this._ensureBehaviorPackDataInitialized();

    if (this.behaviorPackWrapper) {
      this.behaviorPackWrapper.format_version = versionStr;
    }
  }

  notifyComponentUpdated(id: string) {
    const component = this.getComponent(id);

    if (component === undefined) {
      Log.unexpectedUndefined("ETNCU");
    } else {
      this._onComponentChanged.dispatch(this, component);
    }
  }

  getComponents(): IManagedComponent[] {
    const componentSet: IManagedComponent[] = [];

    if (this.behaviorPackEntityTypeDef !== undefined) {
      for (const componentName in this.behaviorPackEntityTypeDef.components) {
        const component = this.getComponent(componentName);

        if (component !== undefined) {
          componentSet.push(component);
        }
      }
    }

    return componentSet;
  }

  getComponentGroup(componentGroupName: string): ManagedComponentGroup | undefined {
    if (this.behaviorPackEntityTypeDef !== undefined) {
      if (!this._componentGroups[componentGroupName]) {
        const componentGroupData = this.behaviorPackEntityTypeDef.component_groups[componentGroupName];

        const cg = new ManagedComponentGroup(componentGroupData, componentGroupName);

        this._componentGroups[componentGroupName] = cg;
      }

      return this._componentGroups[componentGroupName];
    }

    return undefined;
  }

  getComponentGroups(): ManagedComponentGroup[] {
    const componentGroups: ManagedComponentGroup[] = [];

    if (this.behaviorPackEntityTypeDef !== undefined) {
      for (const componentGroupName in this.behaviorPackEntityTypeDef.component_groups) {
        if (!this._componentGroups[componentGroupName]) {
          const componentGroupData = this.behaviorPackEntityTypeDef.component_groups[componentGroupName];

          const cg = new ManagedComponentGroup(componentGroupData, componentGroupName);

          this._componentGroups[componentGroupName] = cg;

          componentGroups.push(cg);
        } else {
          componentGroups.push(this._componentGroups[componentGroupName]);
        }
      }
    }

    return componentGroups;
  }

  getEvent(eventName: string): ManagedEvent | undefined {
    if (this.behaviorPackEntityTypeDef !== undefined) {
      if (!this._events[eventName]) {
        const eventData = this.behaviorPackEntityTypeDef.events[eventName];

        const evt = new ManagedEvent(eventData, eventName);

        this._events[eventName] = evt;
      }

      return this._events[eventName];
    }

    return undefined;
  }

  getEvents(): ManagedEvent[] {
    const events: ManagedEvent[] = [];

    if (this.behaviorPackEntityTypeDef !== undefined) {
      for (const eventName in this.behaviorPackEntityTypeDef.events) {
        if (!this._events[eventName]) {
          const eventData = this.behaviorPackEntityTypeDef.events[eventName];

          const ev = new ManagedEvent(eventData, eventName);

          this._events[eventName] = ev;
          events.push(ev);
        } else {
          events.push(this._events[eventName]);
        }
      }
    }

    return events;
  }

  addComponent(id: string, component: IManagedComponent) {
    this._ensureBehaviorPackDataInitialized();

    const bpData = this.behaviorPackEntityTypeDef as IEntityTypeBehaviorPack;

    bpData.components[id] = component.getData();
    this._managedComponents[id] = component;

    this._onComponentAdded.dispatch(this, component);
  }

  removeComponent(id: string) {
    if (this.behaviorPackEntityTypeDef === undefined) {
      return;
    }

    const newBehaviorPacks: { [name: string]: string | number | IComponent | undefined } = {};
    const newManagedComponents: { [name: string]: IManagedComponent | undefined } = {};

    for (const name in this.behaviorPackEntityTypeDef.components) {
      if (name !== id) {
        const component = this.behaviorPackEntityTypeDef.components[name];

        newBehaviorPacks[name] = component;
      }
    }

    for (const name in this._managedComponents) {
      if (name !== id && this._managedComponents[name]) {
        newManagedComponents[name] = this._managedComponents[name];
      }
    }

    this.behaviorPackEntityTypeDef.components = newBehaviorPacks;
    this._managedComponents = newManagedComponents;
  }

  _ensureBehaviorPackDataInitialized() {
    if (!this.behaviorPackWrapper) {
      this.behaviorPackWrapper = {
        format_version: "1.20.0",
      };
    }
    if (this.behaviorPackEntityTypeDef === undefined) {
      this.behaviorPackEntityTypeDef = {
        description: {
          identifier: "unknown",
          is_experimental: false,
          is_spawnable: false,
          is_summonable: false,
        },
        components: {},
        component_groups: {},
        events: {},
      };

      if (this.behaviorPackWrapper) {
        //@ts-ignore
        this.behaviorPackWrapper["minecraft:entity"] = this.behaviorPackEntityTypeDef;
      }
    }
  }

  static async ensureOnFile(
    behaviorPackFile: IFile,
    loadHandler?: IEventHandler<EntityTypeDefinition, EntityTypeDefinition>
  ) {
    let et: EntityTypeDefinition | undefined = undefined;

    if (behaviorPackFile.manager === undefined) {
      et = new EntityTypeDefinition();

      et.behaviorPackFile = behaviorPackFile;

      behaviorPackFile.manager = et;
    }

    if (behaviorPackFile.manager !== undefined && behaviorPackFile.manager instanceof EntityTypeDefinition) {
      et = behaviorPackFile.manager as EntityTypeDefinition;

      if (!et.isLoaded && loadHandler) {
        et.onLoaded.subscribe(loadHandler);
      }

      await et.load();
    }

    return et;
  }

  getScript(isTypeScript: boolean) {
    if (this.shortId === undefined) {
      return;
    }

    const className = ScriptGen.getClassName(this.shortId);
    const results = [];

    results.push("import * as mc from '@minecraft/server';");
    results.push("import * as gt from '@minecraft/server-gametest';\r\n");

    results.push("export default class " + className + "Base");
    results.push("{");

    if (isTypeScript) {
      results.push("  _entity : mc.Entity;");
      results.push("  constructor(entity : mc.Entity) {");
    } else {
      results.push("  _entity;\r\n");
      results.push("  constructor(entity) {");
    }

    results.push("    this._entity = entity;");
    results.push("  }\r\n\r\n");

    if (isTypeScript) {
      results.push("  static spawn(location : mc.BlockLocation) {");
    } else {
      results.push("  static spawn(location) {");
    }

    results.push('    const entity = world.getDimension("overworld").spawnEntity("' + this.id + '", location);');
    results.push("    const " + ScriptGen.getInstanceName(this.shortId) + " = new " + className + "(entity);");
    results.push("    return " + ScriptGen.getInstanceName(this.shortId) + ";");
    results.push("  }\r\n");

    if (this.behaviorPackEntityTypeDef !== undefined) {
      const healthC = this.behaviorPackEntityTypeDef.components["minecraft:health"];

      if (healthC !== undefined) {
        results.push("  fullyHeal() {");
        results.push('    this._entity.getComponent("minecraft:health").resetToMaxValue();');
        results.push("  }\r\n");
        if (isTypeScript) {
          results.push("  setHealth(newValue : number) {");
        } else {
          results.push("  setHealth(newValue) {");
        }

        results.push('    this._entity.getComponent("minecraft:health").setCurrent(newValue);');
        results.push("  }\r\n");
      }

      const rideableC = this.behaviorPackEntityTypeDef.components["minecraft:rideable"];
      if (rideableC !== undefined) {
        if (isTypeScript) {
          results.push("  addRider(newRider : mc.Entity) {");
        } else {
          results.push("  addRider(newRider) {");
        }

        results.push('    this._entity.getComponent("minecraft:rideable").addRider(newRider);');
        results.push("  }\r\n");

        if (isTypeScript) {
          results.push("  ejectRider(rider : mc.Entity) {");
        } else {
          results.push("  ejectRider(rider) {");
        }
        results.push('    this._entity.getComponent("minecraft:rideable").addRider(rider);');
        results.push("  }\r\n");
      }

      const tameableC = this.behaviorPackEntityTypeDef.components["minecraft:tameable"];
      if (tameableC !== undefined) {
        results.push("  tame() {");
        results.push('    return this._entity.getComponent("minecraft:tameable").tame();');
        results.push("  }\r\n");
      }
    }

    results.push("}");

    return results.join("\r\n");
  }

  persist() {
    if (this._behaviorPackFile === undefined) {
      return;
    }

    const bpString = JSON.stringify(this.behaviorPackWrapper, null, 2);

    this._behaviorPackFile.setContent(bpString);
  }

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._behaviorPackFile === undefined) {
      Log.unexpectedUndefined("ETBPF");
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

    this.behaviorPackWrapper = data;

    const entity = data["minecraft:entity"];

    if (entity && entity.description) {
      this.id = entity.description.identifier;
    }

    this.behaviorPackEntityTypeDef = entity;

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}

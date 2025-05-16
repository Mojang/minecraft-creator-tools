// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

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
import IEventAction from "./IEventAction";
import IEventActionSet from "./IEventActionSet";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import EntityTypeResourceDefinition from "./EntityTypeResourceDefinition";
import SpawnRulesBehaviorDefinition from "./SpawnRulesBehaviorDefinition";
import IDefinition from "./IDefinition";
import IEventWrapper from "./IEventWrapper";

export enum EntityTypeComponentCategory {
  attribute = 0,
  complex = 1,
  behavior = 2,
  trigger = 3,
}

export enum EntityTypeComponentExtendedCategory {
  attribute = 0,
  complex = 1,
  movementComplex = 2,
  combatAndHealthComplex = 3,
  sensorComponents = 4,
  trigger = 5,
  behavior = 6,
  movementBehavior = 7,
  mobSpecificBehavior = 8,
}

export const AttributeComponents: { [id: string]: string } = {
  "minecraft:body_rotation_blocked": "b",
  "minecraft:can_climb": "b",
  "minecraft:can_fly": "b",
  "minecraft:can_power_jump": "b",
  "minecraft:cannot_be_attacked": "b",
  "minecraft:color": "s",
  "minecraft:color2": "s",
  "minecraft:default_look_angle": "f",
  "minecraft:fire_immune": "b",
  "minecraft:floats_in_liquid": "b",
  "minecraft:flying_speed": "f",
  "minecraft:friction_modifier": "f",
  "minecraft:ground_offset": "f",
  "minecraft:ignore_cannot_be_attacked": "b",
  "minecraft:input_ground_controlled": "b",
  "minecraft:is_baby": "b",
  "minecraft:is_charged": "b",
  "minecraft:is_chested": "b",
  "minecraft:is_dyeable": "b",
  "minecraft:is_hidden_when_invisible": "b",
  "minecraft:is_ignited": "b",
  "minecraft:is_illager_captain": "b",
  "minecraft:is_pregnant": "b",
  "minecraft:is_saddled": "b",
  "minecraft:is_sheared": "b",
  "minecraft:is_stackable": "b",
  "minecraft:is_stunned": "b",
  "minecraft:is_tamed": "b",
  "minecraft:mark_variant": "i",
  "minecraft:movement_sound_distance_offset": "f",
  "minecraft:push_through": "f",
  "minecraft:renders_when_invisible": "b",
  "minecraft:scale": "f",
  "minecraft:skin_id": "i",
  "minecraft:sound_volume": "f",
  "minecraft:type_family": "family",
  "minecraft:variant": "i",
  "minecraft:walk_animation_speed": "f",
  "minecraft:wants_jockey": "b",
};

export enum EntityPropertyType {
  string = 0,
  boolean = 1,
  number = 2,
}

export default class EntityTypeDefinition implements IManagedComponentSetItem, IDefinition {
  public behaviorPackWrapper?: IEntityTypeWrapper;
  private _behaviorPackFile?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  private _managedComponents: { [id: string]: IManagedComponent | undefined } = {};

  public _data?: IEntityTypeBehaviorPack;

  public _componentGroups: { [name: string]: ManagedComponentGroup } = {};
  public _events: { [name: string]: IEventAction | IEventActionSet } = {};

  private _onLoaded = new EventDispatcher<EntityTypeDefinition, EntityTypeDefinition>();

  private _onComponentAdded = new EventDispatcher<EntityTypeDefinition, IManagedComponent>();
  private _onComponentRemoved = new EventDispatcher<EntityTypeDefinition, string>();
  private _onComponentChanged = new EventDispatcher<EntityTypeDefinition, IManagedComponent>();

  public get data() {
    return this._data;
  }

  public static getFormIdFromComponentId(componentId: string) {
    return componentId.replace(/:/gi, "_").replace(/\./gi, "_");
  }

  public static getComponentCategory(id: string) {
    if (id.startsWith("minecraft:behavior")) {
      return EntityTypeComponentCategory.behavior;
    } else if (id.startsWith("minecraft:on_")) {
      return EntityTypeComponentCategory.trigger;
    } else if (AttributeComponents[id] !== undefined) {
      return EntityTypeComponentCategory.attribute;
    }

    return EntityTypeComponentCategory.complex;
  }

  public static getExtendedComponentCategory(id: string) {
    if (
      id.startsWith("minecraft:behavior.move") ||
      id.startsWith("minecraft:behavior.jump") ||
      id.startsWith("minecraft:behavior.go") ||
      id.startsWith("minecraft:behavior.follow") ||
      id.startsWith("minecraft:behavior.circle")
    ) {
      return EntityTypeComponentExtendedCategory.movementBehavior;
    } else if (
      id.startsWith("minecraft:behavior.dragon") ||
      id.startsWith("minecraft:behavior.enderman") ||
      id.startsWith("minecraft:behavior.guardian") ||
      id.startsWith("minecraft:behavior.ocelot") ||
      id.startsWith("minecraft:behavior.silverfish") ||
      id.startsWith("minecraft:behavior.skeleton") ||
      id.startsWith("minecraft:behavior.slime") ||
      id.startsWith("minecraft:behavior.squid") ||
      id.startsWith("minecraft:behavior.vex") ||
      id.startsWith("minecraft:behavior.wither")
    ) {
      return EntityTypeComponentExtendedCategory.mobSpecificBehavior;
    } else if (id.startsWith("minecraft:behavior")) {
      return EntityTypeComponentExtendedCategory.behavior;
    } else if (id.startsWith("minecraft:on_")) {
      return EntityTypeComponentExtendedCategory.trigger;
    } else if (AttributeComponents[id] !== undefined) {
      return EntityTypeComponentExtendedCategory.attribute;
    } else if (id.indexOf("sensor") >= 0) {
      return EntityTypeComponentExtendedCategory.sensorComponents;
    } else if (
      id.indexOf("jump") >= 0 ||
      id.indexOf("climb") >= 0 ||
      id.indexOf("move") >= 0 ||
      id.startsWith("minecraft:navigation") ||
      id.startsWith("minecraft:flying") ||
      id.startsWith("minecraft:friction") ||
      id.startsWith("minecraft:walk_animation")
    ) {
      return EntityTypeComponentExtendedCategory.movementComplex;
    } else if (
      id.indexOf("attack") >= 0 ||
      id.indexOf("combat") >= 0 ||
      id.indexOf("damage") >= 0 ||
      id.startsWith("minecraft:health") ||
      id.startsWith("minecraft:healable") ||
      id.startsWith("minecraft:hurt_on")
    ) {
      return EntityTypeComponentExtendedCategory.combatAndHealthComplex;
    }
    return EntityTypeComponentExtendedCategory.complex;
  }

  static getComponentFromBaseFileName(name: string) {
    let canonName = name;

    if (canonName.startsWith("minecraft_")) {
      canonName = canonName.substring(10);
      if (canonName.startsWith("behavior_")) {
        canonName = "behavior." + canonName.substring(9);
      }
      if (canonName.startsWith("movement_")) {
        canonName = "movement." + canonName.substring(9);
      }
      if (canonName.startsWith("navigation_")) {
        canonName = "navigation." + canonName.substring(11);
      }
      if (canonName.startsWith("player_")) {
        canonName = "player." + canonName.substring(7);
      }
      if (canonName.startsWith("jump_")) {
        canonName = "jump." + canonName.substring(5);
      }
      if (canonName.startsWith("horse_")) {
        canonName = "horse." + canonName.substring(6);
      }
      if (canonName.startsWith("annotation_")) {
        canonName = "annotation." + canonName.substring(11);
      }
    }

    return canonName;
  }

  public static getComponentCategoryDescription(category: EntityTypeComponentCategory) {
    switch (category) {
      case EntityTypeComponentCategory.behavior:
        return "Behavior";
      case EntityTypeComponentCategory.attribute:
        return "Attribute";
      case EntityTypeComponentCategory.trigger:
        return "Trigger";
      default:
        return "Component";
    }
  }

  public static getPluralComponentCategoryDescription(category: EntityTypeComponentCategory) {
    switch (category) {
      case EntityTypeComponentCategory.behavior:
        return "Behaviors (AI)";
      case EntityTypeComponentCategory.attribute:
        return "Attributes";
      case EntityTypeComponentCategory.trigger:
        return "Triggers";
      default:
        return "Components";
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

  public get id() {
    return this._id;
  }

  public set id(newId: string | undefined) {
    this._id = newId;
  }

  public get runtimeIdentifier() {
    if (this._data && this._data.description) {
      return this._data.description.runtime_identifier;
    }

    return undefined;
  }

  public set runtimeIdentifier(newId: string | undefined) {
    if (this._data && this._data.description) {
      this._data.description.runtime_identifier = newId;
    }
  }

  public get aliases() {
    if (!this._data || !this._data.description) {
      return undefined;
    }

    return this._data.description.aliases;
  }

  public get properties() {
    if (!this._data || !this._data.description) {
      return undefined;
    }

    return this._data.description.properties;
  }

  public async getFormatVersionIsCurrent() {
    const fv = this.getFormatVersion();

    if (fv === undefined || fv.length !== 3) {
      return false;
    }

    return await Database.isRecentVersionFromVersionArray(fv);
  }

  public getFormatVersion(): number[] | undefined {
    if (!this.behaviorPackWrapper) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this.behaviorPackWrapper.format_version);
  }

  public removeProperty(propertyName: string) {
    if (this._data?.description?.properties) {
      this._data.description.properties[propertyName] = undefined;
    }
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
    if (this._data === undefined || this._data.components === undefined) {
      return undefined;
    }

    if (!this._managedComponents[id]) {
      const comp = this._data.components[id];

      if (comp) {
        this._managedComponents[id] = new ManagedComponent(this._data.components, id, comp);
      }
    }

    return this._managedComponents[id];
  }

  getComponentsInBaseAndGroups(id: string): IManagedComponent[] {
    if (this._data === undefined) {
      return [];
    }

    let results: IManagedComponent[] = [];

    let comp = this.getComponent(id);

    if (comp) {
      results.push(comp);
    }

    for (const componentGroupName in this._componentGroups) {
      const group = this._componentGroups[componentGroupName];
      if (group) {
        comp = group.getComponent(id);

        if (comp) {
          results.push(comp);
        }
      }
    }

    return results;
  }

  getAllComponents(): IManagedComponent[] {
    if (this._data === undefined) {
      return [];
    }

    let results: IManagedComponent[] = this.getComponents();

    for (const componentGroupName in this._componentGroups) {
      const group = this._componentGroups[componentGroupName];
      if (group) {
        for (const comp of group.getComponents()) {
          if (comp) {
            results.push(comp);
          }
        }
      }
    }

    return results;
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

  getComponentGroupsComponentUsedIn(componentName: string): ManagedComponentGroup[] {
    const componentGroups = this.getComponentGroups();
    const cgsUsedIn: ManagedComponentGroup[] = [];

    for (const cg of componentGroups) {
      if (cg && cg.getComponent(componentName)) {
        cgsUsedIn.push(cg);
      }
    }

    return cgsUsedIn;
  }

  getComponentGroup(componentGroupName: string): ManagedComponentGroup | undefined {
    if (this._data !== undefined) {
      if (!this._componentGroups[componentGroupName]) {
        const componentGroupData = this._data.component_groups[componentGroupName];

        const cg = new ManagedComponentGroup(componentGroupData, componentGroupName);

        this._componentGroups[componentGroupName] = cg;
      }

      return this._componentGroups[componentGroupName];
    }

    return undefined;
  }

  getComponentGroups(): ManagedComponentGroup[] {
    const componentGroups: ManagedComponentGroup[] = [];

    if (this._data !== undefined) {
      for (const componentGroupName in this._data.component_groups) {
        if (!this._componentGroups[componentGroupName]) {
          const componentGroupData = this._data.component_groups[componentGroupName];

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

  getEvent(eventName: string): IEventActionSet | IEventAction | undefined {
    if (this._data !== undefined) {
      if (!this._events[eventName]) {
        const eventData = this._data.events[eventName];

        this._events[eventName] = eventData;
      }

      return this._events[eventName];
    }

    return undefined;
  }

  getEvents(): IEventWrapper[] {
    const events: IEventWrapper[] = [];

    if (this._data !== undefined) {
      for (const eventName in this._data.events) {
        if (!this._events[eventName]) {
          const eventData = this._data.events[eventName];

          this._events[eventName] = eventData;

          events.push({ id: eventName, event: eventData });
        } else {
          events.push({ id: eventName, event: this._events[eventName] });
        }
      }
    }

    return events;
  }

  addComponent(
    id: string,
    componentOrData: ManagedComponent | IComponent | string | string[] | boolean | number[] | number | undefined
  ) {
    this._ensureBehaviorPackDataInitialized();

    const bpData = this._data as IEntityTypeBehaviorPack;

    const mc =
      componentOrData instanceof ManagedComponent
        ? componentOrData
        : new ManagedComponent(bpData.components, id, componentOrData);

    bpData.components[id] = mc.getData();
    this._managedComponents[id] = mc;

    this._onComponentAdded.dispatch(this, mc);

    return mc;
  }

  removeComponent(id: string) {
    if (this._data === undefined) {
      return;
    }

    const newBehaviorPacks: {
      [name: string]: string | string[] | boolean | number[] | number | IComponent | undefined;
    } = {};
    const newManagedComponents: { [name: string]: IManagedComponent | undefined } = {};

    for (const name in this._data.components) {
      if (name !== id) {
        const componentData = this._data.components[name];

        newBehaviorPacks[name] = componentData;
      }
    }

    for (const name in this._managedComponents) {
      if (name !== id && this._managedComponents[name]) {
        newManagedComponents[name] = this._managedComponents[name];
      }
    }

    this._data.components = newBehaviorPacks;
    this._managedComponents = newManagedComponents;
  }

  _ensureBehaviorPackDataInitialized() {
    if (!this.behaviorPackWrapper) {
      this.behaviorPackWrapper = {
        format_version: "1.20.0",
      };
    }
    if (this._data === undefined) {
      this._data = {
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
        this.behaviorPackWrapper["minecraft:entity"] = this._data;
      }
    }
  }

  public getProperties() {
    if (!this._data || !this._data?.description) {
      return undefined;
    }

    return this._data.description.properties;
  }

  public getPropertyList() {
    const props = this.getProperties();

    if (!props) {
      return [];
    }

    const propertyList = [];

    for (const propName in props) {
      if (props[propName] !== undefined) {
        propertyList.push(propName);
      }
    }

    return propertyList;
  }

  public addProperty(propertyName: string, stateType: EntityPropertyType) {
    if (!this._data || !this._data.description) {
      return;
    }

    let dataArr: string[] | number[] | boolean[] = [];

    if (stateType === EntityPropertyType.boolean) {
      dataArr = [false, true];
    } else if (stateType === EntityPropertyType.number) {
      dataArr = [0, 1, 2];
    } else if (stateType === EntityPropertyType.string) {
      dataArr = ["value1", "value2"];
    }

    if (!this._data.description.properties) {
      this._data.description.properties = {};
    }

    this._data.description.properties[propertyName] = dataArr;
  }

  public addEvent(eventName: string) {
    if (!this._data) {
      return;
    }

    if (!this._data.events) {
      this._data.events = {};
    }

    this._data.events[eventName] = {};
  }

  async addChildItems(project: Project, item: ProjectItem) {
    let lootTablePaths: string[] = [];

    const comps = this.getComponentsInBaseAndGroups("minecraft:loot");

    for (const comp of comps) {
      let lootTablePath = comp.getProperty("table");

      if (lootTablePath) {
        lootTablePaths.push(lootTablePath);
      }
    }

    const itemsCopy = project.getItemsCopy();

    for (const candItem of itemsCopy) {
      if (candItem.itemType === ProjectItemType.entityTypeResource) {
        await candItem.ensureStorage();

        if (candItem.primaryFile) {
          const etrd = await EntityTypeResourceDefinition.ensureOnFile(candItem.primaryFile);

          if (etrd) {
            const id = etrd.id;

            if (id === this.id) {
              item.addChildItem(candItem);
            }
          }
        }
      } else if (candItem.itemType === ProjectItemType.spawnRuleBehavior) {
        await candItem.ensureStorage();

        if (candItem.primaryFile) {
          const srb = await SpawnRulesBehaviorDefinition.ensureOnFile(candItem.primaryFile);

          if (srb) {
            const id = srb.id;

            if (id === this.id) {
              item.addChildItem(candItem);
            }
          }
        }
      } else if (candItem.itemType === ProjectItemType.lootTableBehavior) {
        for (const lootTablePath of lootTablePaths) {
          if (candItem.projectPath?.endsWith(lootTablePath)) {
            item.addChildItem(candItem);
          }
        }
      }
    }
  }

  static async ensureOnFile(
    behaviorPackFile: IFile,
    loadHandler?: IEventHandler<EntityTypeDefinition, EntityTypeDefinition>
  ) {
    let et: EntityTypeDefinition | undefined;

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
      results.push("  static spawn(location : mc.Vector3) {");
    } else {
      results.push("  static spawn(location) {");
    }

    results.push('    const entity = world.getDimension("overworld").spawnEntity("' + this.id + '", location);');
    results.push("    const " + ScriptGen.getInstanceName(this.shortId) + " = new " + className + "(entity);");
    results.push("    return " + ScriptGen.getInstanceName(this.shortId) + ";");
    results.push("  }\r\n");

    if (this._data !== undefined) {
      const healthC = this._data.components["minecraft:health"];

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

      const rideableC = this._data.components["minecraft:rideable"];
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

      const tameableC = this._data.components["minecraft:tameable"];
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

    this._data = entity;

    if (this._data) {
      if (this._data.components) {
        for (const compName in this._data.components) {
          const comp = this._data.components[compName];

          if (comp) {
            this._managedComponents[compName] = new ManagedComponent(this._data.components, compName, comp);
          }
        }
      }
      if (this._data.component_groups) {
        for (const compGroupName in this._data.component_groups) {
          const compGroup = this._data.component_groups[compGroupName];

          if (compGroup) {
            this._componentGroups[compGroupName] = new ManagedComponentGroup(compGroup, compGroupName);
          }
        }
      }
    }

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}

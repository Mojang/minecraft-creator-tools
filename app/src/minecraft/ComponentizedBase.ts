// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EventDispatcher } from "ste-events";
import IManagedComponentSetItem from "./IManagedComponentSetItem";
import IComponent from "./IComponent";
import Log from "../core/Log";
import IntAttributeComponent from "./components/IntAttributeComponent";
import FloatAttributeComponent from "./components/FloatAttributeComponent";
import MinecraftUtilities from "./MinecraftUtilities";
import ComponentProperty from "./ComponentProperty";
import NbtBinaryTag from "./NbtBinaryTag";
import IManagedComponent from "./IManagedComponent";
import { ManagedComponent } from "./ManagedComponent";
import Utilities from "../core/Utilities";

export default class ComponentizedBase implements IManagedComponentSetItem {
  private _components: { [id: string]: IComponent | string | string[] | boolean | number[] | number | undefined };
  private _managedComponents: { [id: string]: IManagedComponent };

  private _componentProperties: { [id: string]: ComponentProperty };

  private _onComponentAdded = new EventDispatcher<ComponentizedBase, IManagedComponent>();
  private _onComponentRemoved = new EventDispatcher<ComponentizedBase, string>();
  private _onComponentChanged = new EventDispatcher<ComponentizedBase, IManagedComponent>();

  public get onComponentAdded() {
    return this._onComponentAdded.asEvent();
  }

  public get onComponentRemoved() {
    return this._onComponentRemoved.asEvent();
  }

  public get onComponentChanged() {
    return this._onComponentChanged.asEvent();
  }

  id: string = "";

  constructor() {
    this._componentProperties = {};
    this._components = {};
    this._managedComponents = {};
  }

  getComponent(id: string) {
    if (this._components === undefined) {
      return undefined;
    }

    id = MinecraftUtilities.canonicalizeFullName(id);

    const component = this._components[id];

    if (component === undefined) {
      return undefined;
    }

    if (!this._managedComponents[id] && Utilities.isUsableAsObjectKey(id)) {
      this._managedComponents[id] = new ManagedComponent(this._components, id, component);
    }

    return this._managedComponents[id];
  }

  notifyComponentUpdated(id: string) {
    const component = this.getComponent(id);

    if (component === undefined) {
      Log.unexpectedUndefined("CBNCU");
    } else {
      this._onComponentChanged.dispatch(this, component);
    }
  }

  getAllComponents() {
    return this.getComponents();
  }

  getComponents(): IManagedComponent[] {
    const componentSet: IManagedComponent[] = [];

    if (this._components !== undefined) {
      for (const componentName in this._managedComponents) {
        const component = this.getComponent(componentName);

        if (component !== undefined) {
          componentSet.push(component);
        }
      }
    }

    return componentSet;
  }

  ensureDataComponent(
    id: string,
    component: IComponent | string | number
  ): IComponent | string | string[] | boolean | number[] | number | undefined {
    this._ensureComponentsInitialized();

    id = MinecraftUtilities.canonicalizeFullName(id);

    if (this._components === undefined || this._managedComponents === undefined) {
      Log.unexpectedUndefined("CBEDC");
      throw new Error();
    }

    if (this._managedComponents[id] !== undefined) {
      return this._managedComponents[id].getData();
    }

    const mc = this.ensureComponent(id, new ManagedComponent(this._components, id, component));

    if (mc) {
      return mc.getData();
    }

    return undefined;
  }

  ensureComponent(id: string, component: IManagedComponent): IManagedComponent {
    this._ensureComponentsInitialized();

    id = MinecraftUtilities.canonicalizeFullName(id);

    if (this._components === undefined || this._managedComponents === undefined || !Utilities.isUsableAsObjectKey(id)) {
      Log.unexpectedUndefined("CBEC");
      throw new Error();
    }

    if (this._managedComponents[id] !== undefined) {
      return this._managedComponents[id];
    }

    this._managedComponents[id] = component;
    this._components[id] = component.getData();

    this._onComponentAdded.dispatch(this, component);

    return component;
  }

  addComponent(id: string, component: IManagedComponent) {
    this._ensureComponentsInitialized();

    id = MinecraftUtilities.canonicalizeFullName(id);

    if (!Utilities.isUsableAsObjectKey(id)) {
      Log.unsupportedToken(id);
      throw new Error();
    }

    component.id = id;

    if (this._managedComponents !== undefined) {
      this._managedComponents[id] = component;

      this._onComponentAdded.dispatch(this, component);
    }

    if (this._components) {
      this._components[id] = component.getData();
    }

    return component;
  }

  removeComponent(id: string) {
    if (this._components === undefined) {
      return;
    }

    id = MinecraftUtilities.canonicalizeFullName(id);

    const newComponents: { [id: string]: IComponent | string | string[] | boolean | number[] | number | undefined } =
      {};
    const newManagedComponents: { [id: string]: IManagedComponent } = {};

    for (const name in this._components) {
      const nameCanon = MinecraftUtilities.canonicalizeFullName(name);

      if (nameCanon !== id) {
        const component = this._components[name];

        newComponents[name] = component;
      }
    }

    for (const name in this._managedComponents) {
      const nameCanon = MinecraftUtilities.canonicalizeFullName(name);

      if (nameCanon !== id) {
        const component = this._managedComponents[name];

        newManagedComponents[name] = component;
      }
    }

    this._components = newComponents;
    this._managedComponents = newManagedComponents;
  }

  public getComponentProperty(name: string) {
    return this._componentProperties[name];
  }

  public ensureComponentProperty(name: string) {
    return this.addComponentProperty(name);
  }

  public addComponentProperty(name: string) {
    let property = this._componentProperties[name];

    if (property == null) {
      property = new ComponentProperty(this, name);
      property.id = name;

      this._componentProperties[name] = property;

      this.notifyComponentPropertyChanged(property);
    }

    return property;
  }

  notifyComponentPropertyChanged(property: ComponentProperty) {}

  loadAttributeComponentsFromNbtTag(attributesTag: NbtBinaryTag) {
    const attributesChildren = attributesTag.getTagChildren();

    for (let i = 0; i < attributesChildren.length; i++) {
      const attributeChild = attributesChildren[i];

      const nameChild = attributeChild.find("Name");

      if (nameChild !== null) {
        const name = nameChild.valueAsString;

        let component: IComponent | null = null;
        if (
          name.endsWith("luck") ||
          name.endsWith("health") ||
          name.endsWith("absorption") ||
          name.endsWith("knockback_resistance") ||
          name.endsWith("follow_range")
        ) {
          component = new IntAttributeComponent();
        } else if (name.endsWith("movement") || name.endsWith("jump_strength") || name.endsWith("attack_damage")) {
          // movement, underwater_movement, lava_movement, horse.jump_strength
          component = new FloatAttributeComponent();
        } else {
          Log.debugAlert("Unknown component '" + name + "' found");
          component = new FloatAttributeComponent();
        }

        const managedComponent = new ManagedComponent(this._components, name, component);

        this.ensureComponent(name, managedComponent);
      }
    }
  }

  _ensureComponentsInitialized() {
    if (this._components === null) {
      this._components = {};
    }
  }
}

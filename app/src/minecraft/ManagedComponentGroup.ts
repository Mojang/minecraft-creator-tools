// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EventDispatcher } from "ste-events";
import { ManagedComponent } from "./ManagedComponent";
import IComponentGroup from "./IComponentGroup";
import IManagedComponentSetItem from "./IManagedComponentSetItem";
import IManagedComponent from "./IManagedComponent";
import IComponent from "./IComponent";

export default class ManagedComponentGroup implements IManagedComponentSetItem {
  _data?: IComponentGroup;
  _managed?: { [id: string]: IManagedComponent | undefined };

  id: string;

  private _onComponentAdded = new EventDispatcher<ManagedComponentGroup, IManagedComponent>();
  private _onComponentRemoved = new EventDispatcher<ManagedComponentGroup, string>();
  private _onComponentChanged = new EventDispatcher<ManagedComponentGroup, IManagedComponent>();

  public constructor(data: IComponentGroup, id: string) {
    this._data = data;

    this._managed = {};

    this.id = id;
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

  addComponent(
    id: string,
    componentOrData: ManagedComponent | IComponent | string | string[] | boolean | number[] | number | undefined
  ): IManagedComponent {
    if (!this._data) {
      this._data = {};
    }

    if (!this._managed) {
      this._managed = {};
    }

    const mc =
      componentOrData instanceof ManagedComponent
        ? componentOrData
        : new ManagedComponent(this._data, id, componentOrData);

    this._data[mc.id] = mc.getData();
    this._managed[mc.id] = mc;

    return mc;
  }

  removeComponent(id: string) {
    if (!this._data) {
      return;
    }

    this._data[id] = undefined;
  }

  getComponent(id: string): IManagedComponent | undefined {
    if (!this._data) {
      return undefined;
    }

    if (!this._managed) {
      this._managed = {};
    }

    if (!this._managed[id]) {
      const data = this._data[id];
      if (data) {
        this._managed[id] = new ManagedComponent(this._data, id, data);
      }
    }

    return this._managed[id];
  }

  getAllComponents() {
    return this.getComponents();
  }

  getComponents(): IManagedComponent[] {
    if (!this._data) {
      return [];
    }

    if (!this._managed) {
      this._managed = {};
    }

    const comparr: IManagedComponent[] = [];

    for (const c in this._data) {
      const comp = this._data[c];

      if (!this._managed[c] && comp) {
        this._managed[c] = new ManagedComponent(this._data, c, comp);
      }

      const mc = this._managed[c];

      if (mc) {
        comparr.push(mc);
      }
    }

    return comparr;
  }

  notifyComponentUpdated(id: string): void {
    if (!this._managed) {
      return;
    }

    const comp = this._managed[id];

    if (comp) {
      this._onComponentChanged.dispatch(this, comp);
    }
  }
}

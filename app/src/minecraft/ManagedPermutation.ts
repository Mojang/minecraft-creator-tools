// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EventDispatcher } from "ste-events";
import { ManagedComponent } from "./ManagedComponent";
import { IBlockPermutation } from "./IBlockTypeBehaviorPack";
import IManagedComponentSetItem from "./IManagedComponentSetItem";
import IManagedComponent from "./IManagedComponent";
import IComponent from "./IComponent";

export default class ManagedPermutation implements IManagedComponentSetItem {
  _data?: IBlockPermutation;
  _managed?: { [id: string]: IManagedComponent | undefined };

  private _onComponentAdded = new EventDispatcher<ManagedPermutation, IManagedComponent>();
  private _onComponentRemoved = new EventDispatcher<ManagedPermutation, string>();
  private _onComponentChanged = new EventDispatcher<ManagedPermutation, IManagedComponent>();

  public constructor(data: IBlockPermutation) {
    this._data = data;

    this._managed = {};
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

  public get condition() {
    return this._data?.condition;
  }

  public set condition(value: string | undefined) {
    if (value) {
      if (!this._data) {
        this._data = {
          condition: "",
          components: {},
        };
      }

      this._data.condition = value;
    }
  }

  addComponent(
    id: string,
    componentOrData: ManagedComponent | IComponent | string | string[] | boolean | number[] | number | undefined
  ): IManagedComponent {
    if (!this._data) {
      this._data = {
        condition: "",
        components: {},
      };
    }

    if (!this._managed) {
      this._managed = {};
    }
    const mc =
      componentOrData instanceof ManagedComponent
        ? componentOrData
        : new ManagedComponent(this._data.components, id, componentOrData);

    this._data.components[mc.id] = mc.getData();
    this._managed[mc.id] = mc;

    return mc;
  }

  removeComponent(id: string) {
    if (!this._data) {
      return;
    }

    this._data.components[id] = undefined;
  }

  getComponent(id: string): IManagedComponent | undefined {
    if (!this._data) {
      return undefined;
    }

    if (!this._managed) {
      this._managed = {};
    }

    if (!this._managed[id]) {
      const data = this._data.components[id];

      if (data) {
        this._managed[id] = new ManagedComponent(this._data.components, id, data);
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
      const comp = this._data.components[c];

      if (!this._managed[c] && comp) {
        this._managed[c] = new ManagedComponent(this._data.components, c, comp);
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

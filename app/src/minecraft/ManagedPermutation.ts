// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EventDispatcher } from "ste-events";
import { ManagedComponent } from "./ManagedComponent";
import { IBlockPermutation } from "./IBlockTypeBehaviorPack";
import IManagedComponentSetItem from "./IManagedComponentSetItem";
import IManagedComponent from "./IManagedComponent";
import Molang from "./Molang";
import IComponent from "./IComponent";
import Utilities from "../core/Utilities";

export default class ManagedPermutation implements IManagedComponentSetItem {
  _data?: IBlockPermutation;
  _managed?: { [id: string]: IManagedComponent | undefined };

  _conditionMolang: Molang | undefined;

  private _onComponentAdded = new EventDispatcher<ManagedPermutation, IManagedComponent>();
  private _onComponentRemoved = new EventDispatcher<ManagedPermutation, string>();
  private _onComponentChanged = new EventDispatcher<ManagedPermutation, IManagedComponent>();

  public constructor(data: IBlockPermutation) {
    this._data = data;

    this._managed = {};
  }

  id: string = "";

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

  public get conditionExpression() {
    if (this._conditionMolang) {
      return this._conditionMolang;
    }

    const cond = this.condition;

    if (!cond) {
      return undefined;
    }

    this._conditionMolang = new Molang(cond);

    return this._conditionMolang;
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

    if (Utilities.isUsableAsObjectKey(mc.id)) {
      this._data.components[mc.id] = mc.getData();
      this._managed[mc.id] = mc;
    }

    return mc;
  }

  removeComponent(id: string) {
    if (!this._data) {
      return;
    }
    if (!Utilities.isUsableAsObjectKey(id)) {
      throw new Error();
    }

    this._data.components[id] = undefined;

    if (this._managed) {
      this._managed[id] = undefined;
    }
  }

  getComponent(id: string): IManagedComponent | undefined {
    if (!this._data) {
      return undefined;
    }

    if (!this._managed) {
      this._managed = {};
    }
    if (!Utilities.isUsableAsObjectKey(id)) {
      throw new Error();
    }

    if (!this._managed[id]) {
      const comps = this._data.components;

      if (!comps) {
        return undefined;
      }

      const data = comps[id];

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

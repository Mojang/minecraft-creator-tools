// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EventDispatcher } from "ste-events";
import IComponent from "./IComponent";
import IManagedComponent from "./IManagedComponent";

export class ManagedComponent implements IManagedComponent {
  private _data: IComponent | string | string[] | boolean | number[] | number | undefined;
  private _parent: { [componentId: string]: IComponent | string | string[] | boolean | number[] | number | undefined };
  id: string;

  private _onPropertyChanged = new EventDispatcher<ManagedComponent, string>();

  public get onPropertyChanged() {
    return this._onPropertyChanged.asEvent();
  }

  constructor(
    parent: { [componentId: string]: IComponent | string | string[] | boolean | number[] | number | undefined },
    id: string,
    data: IComponent | string | string[] | boolean | number[] | number | undefined
  ) {
    this._parent = parent;
    this._data = data;
    this.id = id;
  }

  getData() {
    return this._data;
  }

  getBaseValue() {
    return this._data;
  }

  setData(newData: IComponent | string | string[] | boolean | number[] | number | undefined) {
    this._parent[this.id] = newData;
    this._data = newData;
  }

  setBaseValue(value: any): void {
    this._parent[this.id] = value;
    this._data = value;
  }

  getProperty(id: string) {
    if (!this._data) {
      return undefined;
    }

    return (this._data as any)[id] as any;
  }

  setProperty(propertyId: string, value: any) {
    if (typeof this._data === "string") {
      if (this.id === "minecraft:geometry") {
        this._data = {
          identifier: this._data,
        };
      } else {
        this._data = {
          value: this._data,
        };
      }
    }

    if (this._data && typeof this._data !== "string") {
      (this._data as any)[propertyId] = value;
    }
  }
}

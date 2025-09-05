// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EventDispatcher } from "ste-events";
import IComponent from "./IComponent";
import IManagedComponent from "./IManagedComponent";
import Utilities from "../core/Utilities";
import { IComponentContainer } from "./IComponentDataItem";
import IProperty from "../dataform/IProperty";

export class ManagedComponent implements IManagedComponent {
  private _data: IComponent | string | string[] | boolean | number[] | number | undefined;
  private _parent: IComponentContainer;
  private _uniqueId: string;
  id: string;

  private _onPropertyChanged = new EventDispatcher<ManagedComponent, string>();

  public get onPropertyChanged() {
    return this._onPropertyChanged.asEvent();
  }

  constructor(
    parent: IComponentContainer,
    id: string,
    data: IComponent | string | string[] | boolean | number[] | number | undefined
  ) {
    this._parent = parent;
    this._data = data;
    this.id = id;
    this._uniqueId = Utilities.createRandomLowerId(8);
    this.handlePropertyChanged = this.handlePropertyChanged.bind(this);
  }

  getData() {
    return this._data;
  }

  getBaseValue() {
    return this._data;
  }

  setData(newData: IComponent | string | string[] | boolean | number[] | number | undefined) {
    if (Utilities.isUsableAsObjectKey(this.id)) {
      this._parent[this.id] = newData;
    }
    this._data = newData;
  }

  setBaseValue(value: any): void {
    this._parent[this.id] = value;
    this._data = value;
  }

  handlePropertyChanged(props: any, property: IProperty, newValue: any, updatedObject?: object | undefined) {
    if (updatedObject) {
      this.setData(updatedObject as any);
    }
  }

  getProperty(id: string) {
    if (!this._data) {
      return undefined;
    }

    return (this._data as any)[id] as any;
  }

  setProperty(propertyId: string, value: any) {
    if (
      typeof this._data === "string" ||
      typeof this._data === "number" ||
      typeof this._data === "boolean" ||
      Array.isArray(this._data)
    ) {
      if (typeof this._data === typeof value || typeof value === "object") {
        this.setData(value);
        return;
      } else {
        this.setData({
          value: this._data,
        });
      }
    }

    if (this._data && Utilities.isUsableAsObjectKey(propertyId)) {
      (this._data as any)[propertyId] = value;
    }
  }
}

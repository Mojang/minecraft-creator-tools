// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EventDispatcher } from "ste-events";
import IComponent from "./IComponent";
import IManagedComponent from "./IManagedComponent";

export class ManagedComponent implements IManagedComponent {
  private _data: IComponent | string | number | undefined;
  id: string;

  private _onPropertyChanged = new EventDispatcher<ManagedComponent, string>();

  public get onPropertyChanged() {
    return this._onPropertyChanged.asEvent();
  }

  constructor(id: string, data: IComponent | string | number) {
    this._data = data;
    this.id = id;
  }

  getData() {
    return this._data;
  }

  getProperty(id: string) {
    if (!this._data) {
      return undefined;
    }

    return (this._data as any)[id] as any;
  }

  setProperty(id: string, value: any) {
    if (this._data && typeof this._data !== "string") {
      (this._data as any)[id] = value;
    }
  }
}

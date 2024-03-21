// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ComponentizedBase from "./ComponentizedBase";
import IPropertyObject from "../dataform/IPropertyObject";
import IProperty from "./../dataform/IProperty";
import { EventDispatcher } from "ste-events";
import ComponentProperty from "./ComponentProperty";

export default class ItemStack extends ComponentizedBase implements IPropertyObject {
  _typeId: string = "";

  tags: string[] = [];

  private _onPropertyChanged = new EventDispatcher<ItemStack, IProperty>();

  public get onPropertyChanged() {
    return this._onPropertyChanged.asEvent();
  }

  get typeId() {
    return this._typeId;
  }

  set typeId(newTypeId: string) {
    this._typeId = newTypeId;
  }

  public getProperty(name: string) {
    return this.getComponentProperty(name);
  }

  public ensureProperty(name: string) {
    return this.addComponentProperty(name);
  }

  public addProperty(name: string) {
    return this.addComponentProperty(name);
  }

  notifyComponentPropertyChanged(property: ComponentProperty) {
    this._onPropertyChanged.dispatch(this, property);
  }
}

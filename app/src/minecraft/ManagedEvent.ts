// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IEntityEvent from "./IEntityEvent";
import IManagedComponent from "./IManagedComponent";

export default class ManagedEvent {
  _data?: IEntityEvent;
  _managed?: { [id: string]: IManagedComponent | undefined };

  id: string;

  //private _onComponentGroupAddAdded = new EventDispatcher<ManagedEvent, IManagedComponent>();
  //private _onComponentGroupAddRemoved = new EventDispatcher<ManagedEvent, string>();
  //private _onComponentGroupAddChanged = new EventDispatcher<ManagedEvent, IManagedComponent>();

  public constructor(data: IEntityEvent, id: string) {
    this._data = data;

    this._managed = {};

    this.id = id;
  }
}

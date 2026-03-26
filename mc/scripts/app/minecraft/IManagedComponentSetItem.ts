// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IEvent } from "ste-events";
import IManagedComponent from "./IManagedComponent";
import IComponent from "./IComponent";

export default interface IManagedComponentSetItem {
  addComponent(
    id: string,
    componentOrData: IManagedComponent | IComponent | string | string[] | boolean | number[] | number | undefined
  ): IManagedComponent;
  removeComponent(id: string): void;
  getComponent(id: string): IManagedComponent | undefined;
  getComponents(): IManagedComponent[];
  getAllComponents(): IManagedComponent[];
  notifyComponentUpdated(id: string): void;

  id: string;

  onComponentAdded: IEvent<IManagedComponentSetItem, IManagedComponent>;
  onComponentRemoved: IEvent<IManagedComponentSetItem, string>;
  onComponentChanged: IEvent<IManagedComponentSetItem, IManagedComponent>;
}

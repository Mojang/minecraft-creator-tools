// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IEvent } from "ste-events";
import IManagedComponent from "./IManagedComponent";

export default interface IManagedComponentSetItem {
  addComponent(id: string, component: IManagedComponent): void;
  removeComponent(id: string): void;
  getComponent(id: string): IManagedComponent | undefined;
  getComponents(): IManagedComponent[];
  getAllComponents(): IManagedComponent[];
  notifyComponentUpdated(id: string): void;

  onComponentAdded: IEvent<IManagedComponentSetItem, IManagedComponent>;
  onComponentRemoved: IEvent<IManagedComponentSetItem, string>;
  onComponentChanged: IEvent<IManagedComponentSetItem, IManagedComponent>;
}

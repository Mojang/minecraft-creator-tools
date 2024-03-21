// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IComponentDataItem from "./IComponentDataItem";
import IComponentGroup from "./IComponentGroup";
import IEntityEvent from "./IEntityEvent";
import IEntityTypeDescription from "./IEntityTypeDescription";

export default interface IEntityTypeBehaviorPack extends IComponentDataItem {
  description: IEntityTypeDescription;

  component_groups: { [name: string]: IComponentGroup };
  events: { [name: string]: IEntityEvent };
}

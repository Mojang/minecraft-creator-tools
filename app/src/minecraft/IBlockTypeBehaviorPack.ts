// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IBlockEvent from "./IBlockEvent";
import IBlockTypeDescription from "./IBlockTypeDescription";
import IComponentDataItem from "./IComponentDataItem";

export default interface IBlockTypeBehaviorPack extends IComponentDataItem {
  description: IBlockTypeDescription;

  events: { [name: string]: IBlockEvent };
}

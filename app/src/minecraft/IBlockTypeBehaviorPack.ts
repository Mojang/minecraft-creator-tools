// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IBlockEvent from "./IBlockEvent";
import IBlockTypeDescription from "./IBlockTypeDescription";
import IComponentDataItem from "./IComponentDataItem";

export default interface IBlockTypeBehaviorPack extends IComponentDataItem {
  description: IBlockTypeDescription;
  permutations?: IBlockPermutation[];
  events?: { [name: string]: IBlockEvent };
}

export interface IBlockPermutation extends IComponentDataItem {
  condition: string;
}

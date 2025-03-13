// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IComponentDataItem from "./IComponentDataItem";

export interface IItemTypeResourcePackDescription {
  identifier: string;
  category?: string;
}

export default interface IItemTypeResourcePack extends IComponentDataItem {
  description: IItemTypeResourcePackDescription;

  "minecraft:icon"?: string;
  "minecraft:render_offsets"?: string;
}

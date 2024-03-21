// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IBlockTypeData from "./IBlockTypeData";
import IBlockTypePropertyData from "./IBlockTypePropertyData";

export enum BlockShape {
  custom = 0,
  unitCube = 1,
}

export default interface IBlockBaseTypeData {
  id?: number;
  name: string;
  shortId?: string;
  altShortId?: string;
  mapColor?: string;
  icon?: string;
  abstract?: boolean;
  isOpaque?: boolean;
  shape?: BlockShape;
  properties?: IBlockTypePropertyData[];
  variants?: IBlockTypeData[];
}

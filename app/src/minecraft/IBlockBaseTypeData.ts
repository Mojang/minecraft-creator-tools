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
  n: string;
  shortId?: string;
  altShortId?: string;
  mc?: string;
  ic?: string;
  abstract?: boolean;
  isOpaque?: boolean;
  shape?: BlockShape;
  properties?: IBlockTypePropertyData[];
  variants?: IBlockTypeData[];
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IEntityNbtJson from "./IEntityNbtJson";

export default interface ISnbtEntity {
  blockPos: number[];
  pos: number[];
  nbt: IEntityNbtJson;
}

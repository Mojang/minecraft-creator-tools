// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IMinMixRange from "./jsoncommon/IMinMixRange";

export default interface ILootTableBehavior {
  pools: any[];
}

export interface ILootTableBehaviorPool {
  rolls: number;
  entries: ILootTableBehaviorEntry[];
}

export interface ILootTableBehaviorEntry {
  type: string;
  name?: string;
  weight?: number;
  functions?: ILootTableBehaviorFunction[];
}

export interface ILootTableBehaviorFunction {
  function: string;
  id?: string;
  count?: number | IMinMixRange;
}

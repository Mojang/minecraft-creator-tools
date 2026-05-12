// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IMinMixRange from "./jsoncommon/IMinMixRange";

export default interface ILootTableBehavior {
  pools: ILootTableBehaviorPool[];
}

export interface ILootTableBehaviorPool {
  rolls: number | IMinMixRange;
  entries: ILootTableBehaviorEntry[];
  conditions?: unknown[];
  bonus_rolls?: number | IMinMixRange;
  tiers?: unknown;
}

export interface ILootTableBehaviorEntry {
  type: string;
  name?: string;
  weight?: number;
  functions?: ILootTableBehaviorFunction[];
  conditions?: unknown[];
}

export interface ILootTableBehaviorFunction {
  function: string;
  id?: string;
  count?: number | IMinMixRange;
}

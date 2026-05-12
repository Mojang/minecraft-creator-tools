// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IMinMixRange from "./jsoncommon/IMinMixRange";

/**
 * Bedrock trade table shape. Files MAY be authored either as a bare array of tiers
 * (per the official schema) or as an object `{ tiers: [...] }` (as in our seed
 * template). Readers should normalize; writers should preserve the original shape.
 */
export default interface ITradingBehavior {
  tiers: ITradeTableTier[];
}

export interface ITradeTableTier {
  groups: ITradeTableGroup[];
  total_exp_required?: number;
}

export interface ITradeTableGroup {
  trades: ITradeTableTrade[];
  num_to_select?: number;
}

export interface ITradeTableTrade {
  wants: ITradeTableItem[];
  gives: ITradeTableItem[];
  weight?: number;
  max_uses?: number;
  trader_exp?: number;
  reward_exp?: boolean;
}

export interface ITradeTableItem {
  item: string;
  quantity?: number | IMinMixRange;
  price_multiplier?: number;
  filters?: unknown;
  functions?: unknown[];
}

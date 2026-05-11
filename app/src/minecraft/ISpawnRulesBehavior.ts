// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface ISpawnRulesBehavior {
  format_version?: string;
  "minecraft:spawn_rules": ISpawnRulesInner;
}

export interface ISpawnRulesInner {
  description?: ISpawnRulesDescription;
  conditions?: ISpawnRulesCondition[];
}

export interface ISpawnRulesDescription {
  identifier: string;
  population_control?: string;
}

export interface ISpawnRulesCondition {
  "minecraft:biome_filter"?: ISpawnRulesBiomeFilter;
  "minecraft:herd"?: ISpawnRulesHerd | ISpawnRulesHerd[];
  "minecraft:spawns_on_block_filter"?: string[] | string;
  "minecraft:spawns_on_block_prevented_filter"?: string[];
  "minecraft:brightness_filter"?: { min?: number; max?: number; adjust_for_weather?: boolean };
  "minecraft:weight"?: { default?: number; rarity?: number };
  "minecraft:density_limit"?: { surface?: number; underground?: number };
  "minecraft:height_filter"?: { min?: number; max?: number };
  "minecraft:difficulty_filter"?: { min?: string; max?: string };
  "minecraft:spawns_on_surface"?: object;
  "minecraft:spawns_underground"?: object;
  "minecraft:spawns_underwater"?: object;
  "minecraft:spawns_lava"?: object;
  "minecraft:delay_filter"?: object;
  "minecraft:distance_filter"?: { min?: number; max?: number };
  "minecraft:mob_event_filter"?: { event?: string };
  "minecraft:player_in_village_filter"?: { distance?: number; village_border_tolerance?: number };
  "minecraft:world_age_filter"?: { min?: number; max?: number };
  "minecraft:permute_type"?: object | object[];
  "minecraft:disallow_spawns_in_bubble"?: object;
  [key: string]: unknown;
}

export interface ISpawnRulesHerd {
  min_size?: number;
  max_size?: number;
  event?: string;
  event_skip_count?: number;
}

export interface ISpawnRulesBiomeFilter {
  test?: string;
  value?: string | number;
  operator?: string;
  subject?: string;
  domain?: string;
  any_of?: ISpawnRulesBiomeFilter[];
  all_of?: ISpawnRulesBiomeFilter[];
  none_of?: ISpawnRulesBiomeFilter[];
}

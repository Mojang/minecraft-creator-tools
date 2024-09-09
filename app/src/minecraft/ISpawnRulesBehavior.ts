// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface ISpawnRulesBehavior {
  format_version?: string;
  "minecraft:spawn_rules": ISpawnRulesInner;
}

export interface ISpawnRulesInner {
  description?: ISpawnRulesDescription;
}

export interface ISpawnRulesDescription {
  identifier: string;
  population_control?: string;
}

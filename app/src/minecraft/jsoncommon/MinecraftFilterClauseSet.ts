// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { MinecraftFilterClause } from "./MinecraftFilterClause";

export interface MinecraftFilterClauseSet {
  any_of?: (MinecraftFilterClauseSet | MinecraftFilterClause)[];
  all_of?: (MinecraftFilterClauseSet | MinecraftFilterClause)[];
}

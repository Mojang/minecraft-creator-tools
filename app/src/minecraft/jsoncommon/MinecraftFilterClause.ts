// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum FilterMode {
  and = 0,
  or = 1,
}

export interface MinecraftFilterClause {
  test: string;
  operator?: string;
  value: string | number | boolean;
  subject: string;
}

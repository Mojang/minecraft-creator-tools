// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum FilterMode {
  and = 0,
  or = 1,
}

export interface IFilterClause {
  test: string;
  operator?: string;
  value: string | number | boolean;
  subject: string;
}

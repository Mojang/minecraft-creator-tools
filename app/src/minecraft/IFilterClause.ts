// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface IFilterClause {
  test: string;
  operator?: string;
  value: string;
  subject: string;
}

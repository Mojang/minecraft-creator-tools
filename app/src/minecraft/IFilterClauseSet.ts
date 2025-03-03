// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IFilterClause } from "./IFilterClause";

export interface IFilterClauseSet {
  any_of?: (IFilterClauseSet | IFilterClause)[];
  all_of?: (IFilterClauseSet | IFilterClause)[];
}

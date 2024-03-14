// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum ComparisonType {
  equals = "=",
  lessThan = "<",
  lessThanOrEqualTo = "<=",
  greaterThan = ">",
  greaterThanOrEqualTo = ">=",
  isDefined = "defined",
  isNonEmpty = "nonempty",
}

export default interface ICondition {
  field?: string;
  comparison: ComparisonType | string;
  value?: number | string;
  anyValues?: number[] | string[];
}

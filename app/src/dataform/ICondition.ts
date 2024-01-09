export enum ComparisonType {
  equals = 0,
  lessThan = 1,
  lessThanOrEqualTo = 2,
  greaterThan = 3,
  greaterThanOrEqualTo = 4,
  isDefined = 5,
}

export default interface ICondition {
  field?: string;
  comparison: ComparisonType;
  value?: number | string;
  anyValues?: number[] | string[];
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum InfoItemType {
  testCompleteSuccess = 0,
  testCompleteFail = 1,
  info = 2,
  error = 3,
  warning = 4,
  internalProcessingError = 5,
  recommendation = 6,
  featureAggregate = 7,
}

export default interface IInfoItemData {
  iTp: InfoItemType;
  gId: string;
  gIx: number;
  m: string | undefined;
  p: string | null | undefined;
  d: string | boolean | number | object | number[] | undefined;
  iId: string | undefined;
  c: string | undefined;
  fs: { [setName: string]: { [measureName: string]: number | undefined } | undefined } | undefined;
}

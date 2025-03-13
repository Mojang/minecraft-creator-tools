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

// sorry that the fields here are truncated to save a few characters.
export default interface IInfoItemData {
  iTp: InfoItemType; // type
  gId: string; // generatorId
  gIx: number; // generatorIndex
  m: string | undefined; // message
  p: string | null | undefined; // item project path
  d: string | boolean | number | number[] | undefined; // data
  iId: string | undefined; // item id
  c: string | undefined; // content -- should be the broader context of content that is causing the info item. Sometimes, the content in question that might be problematic might be in .d?
  fs: { [setName: string]: { [measureName: string]: number | undefined } | undefined } | undefined; // feature state
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum StatusType {
  message = 0,
  operationStarted = 1,
  operationUpdate = 2,
  operationEndedComplete = 3,
  operationEndedErrors = 4,
}

export enum StatusTopic {
  general = 0,
  validation = 1,
  projectLoad = 2,
  worldLoad = 3,
  scriptBuild = 4,
  processing = 5,
  minecraft = 6,
}

export default interface IStatus {
  type: StatusType;
  topic?: StatusTopic;
  time: Date;
  operationId?: number;
  message: string;
  context?: string;
  operation?: string;
}

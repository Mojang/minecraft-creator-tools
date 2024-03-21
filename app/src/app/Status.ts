// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum StatusType {
  message = 0,
  operationStarted = 1,
  operationEnded = 2,
}

export enum StatusTopic {
  general = 0,
  validation = 1,
  projectLoad = 2,
  worldLoad = 3,
}

export default class Status {
  type: StatusType = StatusType.message;
  topic?: StatusTopic = StatusTopic.general;
  time: Date = new Date();
  operationId: number | null = null;
  message: string = "";
}

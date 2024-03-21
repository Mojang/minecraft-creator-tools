// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum CustomToolType {
  function = 0,
  script = 1,
}

export default interface ICustomTool {
  name: string;
  type: CustomToolType;
  text?: string;
  lastRunResult?: ICustomToolResult;
}

export interface ICustomToolResult {
  dateTime: Date;
  resultItems: ICustomToolResultItem;
  resultState: number;
}

export interface ICustomToolResultItem {
  dateTime: Date;
  lineNumber: number;
  response?: any;
}

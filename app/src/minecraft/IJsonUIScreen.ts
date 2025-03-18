// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface IJsonUIScreen {
  [name: string]: IJsonUIControl | string;
}

export interface IJsonUIControl {
  type?: string;
  size?: number[];
  texture?: string;
  controls?: { [name: string]: IJsonUIControl | string }[];
}

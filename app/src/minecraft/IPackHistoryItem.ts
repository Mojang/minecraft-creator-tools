// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IPackHistoryItem {
  can_be_redownloaded?: boolean;
  name?: string;
  uuid: string;
  version: number[];
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IPackRegistration {
  pack_id: string;
  version: number[];
  priority?: number;
}

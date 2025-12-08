// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum ServerPermissionLevel {
  none = 0,
  displayReadOnly = 1,
  fullReadOnly = 2,
  updateState = 3,
  admin = 4,
}

export interface IAuthenticationToken {
  time: number;
  code: string;
  permissionLevel: ServerPermissionLevel;
  fingerprint?: string; // Optional for backward compatibility
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface ICommandResponse {
  body: ICommandResponseBody;
  header: ICommandResponseHeader;
}

export interface ICommandResponseBody {
  statusCode: number;
  statusMessage: string;
  position?: ICommandBlockPosition;
}

export interface ICommandBlockPosition {
  x: number;
  y: number;
  z: number;
}

export interface ICommandResponseHeader {
  messagePurpose: string;
  requestId: string;
  version: string;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface IErrorable {
  isInErrorState?: boolean;
  errorMessages?: IErrorMessage[];
}

export interface IErrorMessage {
  message: string;
  context?: string;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IStorageObject {
  name: string;
  storageRelativePath: string;
  fullPath: string;
  manager?: any;
  tag?: any;
}

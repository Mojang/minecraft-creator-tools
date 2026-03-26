// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface ITagData {
  [category: string]: ITagList;
}

export interface ITagList {
  [tag: string]: string[];
}

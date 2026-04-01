// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IContextIndexData {
  items: string[];
  trie: { [name: string]: object | undefined };
}

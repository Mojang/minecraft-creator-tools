// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface IBlocksCatalogResource {
  [identifier: string]: IBlockResource;
}

export interface IBlockResource {
  sound: string;
  textures: string | { [side: string]: string };
}

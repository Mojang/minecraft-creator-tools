// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface ITerrainTextureCatalog {
  num_mip_levels: number;
  padding: number;
  resource_pack_name: string;
  texture_data: ITerrainTextureDataSet;
}

export interface ITerrainTextureDataSet {
  [name: string]: ITerrainTextureDataItem;
}

export interface ITerrainTextureDataItem {
  textures: string | string[] | ITerainTextureInstance[];
}

export interface ITerainTextureInstance {
  path: string;
  overlay_color: string;
}

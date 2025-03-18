// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface IBlocksCatalogResource {
  [identifier: string]: IBlockResource;
}

export interface IBlockResource {
  sound?: string;
  isotropic?: IBlocksIsotropic | boolean;
  ambient_occlusion_exponent?: number;
  carried_textures?: string;
  textures?: IBlockTextures | string;
}

export interface IBlocksIsotropic {
  up?: boolean;
  down?: boolean;
}

export interface IBlockTextures {
  north?: string;
  south?: string;
  east?: string;
  west?: string;
  side?: string;
  up?: string;
  down?: string;
}

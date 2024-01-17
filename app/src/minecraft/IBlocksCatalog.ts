export interface IBlocksCatalogResource {
  [identifier: string]: IBlockResource;
}

export interface IBlockResource {
  sound: string;
  textures: string;
}

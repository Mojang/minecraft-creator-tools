export interface ITerrainTexture {
  num_mip_levels: number;
  padding: number;
  resource_pack_name: string;
  texture_data: ITextureDataSet;
}

export interface ITextureDataSet {
  [name: string]: ITextureDataItem;
}

export interface ITextureDataItem {
  sound: string;
  textures: string | string[];
}

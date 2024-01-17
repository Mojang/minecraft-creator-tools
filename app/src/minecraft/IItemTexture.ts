export interface IItemTexture {
  resource_pack_name: string;
  texture_name: string;
  texture_data: IItemTextureDataSet;
}

export interface IItemTextureDataSet {
  [name: string]: IItemTextureDataItem;
}

export interface IItemTextureDataItem {
  textures: string | string[];
}

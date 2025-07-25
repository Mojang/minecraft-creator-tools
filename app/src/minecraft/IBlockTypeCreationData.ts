import { IBlockResource } from "./IBlocksCatalog";
import { ITerrainTextureDataSet } from "./ITerrainTextureCatalog";

export interface IBlockTypeCreationData {
  resource: IBlockResource;
  texture_data: ITerrainTextureDataSet;
}

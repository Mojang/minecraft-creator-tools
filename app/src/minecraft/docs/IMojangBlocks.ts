export default interface IMojangBlocks {
  block_properties: IBlockTypePropertyData[];
  data_items: IMojangBlock[];
}

export interface IBlockTypePropertyData {
  name: string;
  type?: string;
  values?: string[];
}

export interface IMojangBlock {
  name: string;
  properties: {
    name: string;
    type?: string;
    values?: string[];
  }[];
  raw_id: number;
  serialization_id: string;
}

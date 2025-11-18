export default interface IBlocksMetadata {
  block_properties: IBlocksMetadataBlockProperty[];
  data_items: IBlocksMetadataDataItem[];
  minecraft_version: string;
  module_type: string;
  name: string;
  vanilla_data_type: string;
}

export interface IBlocksMetadataBlockProperty {
  name: string;
  type: "bool" | "int" | "string";
  values: IBlocksMetadataBLockPropertyValue[];
}

export interface IBlocksMetadataBLockPropertyValue {
  value: string | number | boolean;
}

export interface IBlocksMetadataDataItem {
  name: string;
  properties: IBlocksMetadataDataItemPropertyPointer[];
  raw_id: number;
  serialization_id: string;
}

export interface IBlocksMetadataDataItemPropertyPointer {
  name: string;
}

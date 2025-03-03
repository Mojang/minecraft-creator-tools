export default interface IBlocksMetadata {
  data_items: IBlocksMetadataDataItem[];
  minecraft_version: string;
  module_type: string;
  name: string;
  vanilla_data_type: string;
}

export interface IBlocksMetadataDataItem {
  name: string;
  properties: IBlocksMetadataDataItemProperty[];
  raw_id: number;
  serialization_id: string;
}

export interface IBlocksMetadataDataItemProperty {
  name: string;
}

export interface IBlocksMetadataBlockProperty {
  name: string;
  type: string;
  values: IBlocksMetadataBLockPropertyValue[];
}

export interface IBlocksMetadataBLockPropertyValue {
  value: string;
}

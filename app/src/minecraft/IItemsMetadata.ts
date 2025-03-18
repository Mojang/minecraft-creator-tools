export default interface IItemsMetadata {
  data_items: IItemsMetadataDataItem[];
  minecraft_version: string;
  module_type: string;
  name: string;
  vanilla_data_type: string;
}

export interface IItemsMetadataDataItem {
  name: string;
  command_name: string;
  serialization_id: string;
  serialization_name: string;
  raw_id: number;
}

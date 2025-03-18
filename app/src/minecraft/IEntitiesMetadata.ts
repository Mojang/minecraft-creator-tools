export default interface IEntitiesMetadata {
  data_items: IEntitiesMetadataDataItem[];
  minecraft_version: string;
  module_type: string;
  name: string;
  vanilla_data_type: string;
}

export interface IEntitiesMetadataDataItem {
  name: string;
}

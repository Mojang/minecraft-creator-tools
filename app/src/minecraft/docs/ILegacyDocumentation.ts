export default interface ILegacyDocumentationNode {
  name: string;
  nodes: ILegacyDocumentationNode[];
  header_level?: number;
  description?: string[];
  examples?: ILegacyDocumentationExample[];
  examples_print_mode?: string;
  default?: string;
  show_in_index?: boolean;
  table_default_title?: string;
  table_descrpition_title?: string;
  table_name_title?: string;
  table_type_title?: string;
  nodes_as_table?: boolean;
  examples_title?: string;
  type?: string;
}

export interface ILegacyDocumentationExample {
  name: string;
  text: string[];
}

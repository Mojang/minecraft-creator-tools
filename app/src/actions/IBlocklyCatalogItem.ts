import { ActionSetTarget } from "./IActionSetData";

export default interface IBlocklyCatalog {
  items: IBlocklyCatalogItem[];
}

export interface IBlocklyCatalogItem {
  type: BlocklyCatalogItemType;
  title?: string;
  definition: any; // right now this is 'any', though.
  target?: ActionSetTarget;
  category?: BlocklyCategory;
}

export enum BlocklyCategory {
  logic = 1,
  actions = 2,
  conditions = 3,
  triggers = 4,
}

export enum BlocklyCatalogItemType {
  scriptContainer = 1,
}

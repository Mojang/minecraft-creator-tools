import IBlockTypePropertyValueData from "./IBlockTypePropertyValueData";

export enum BlockPropertyType {
  int = 0,
  boolean = 1,
  string = 2,
  float = 3,
  stringEnum = 4,
  intEnum = 5,
  intBoolean = 6,
}

export default interface IBlockTypePropertyData {
  name: string;
  default?: string | number | number[] | bigint | bigint[] | boolean | null;
  type: BlockPropertyType;
  title?: string;
  values?: IBlockTypePropertyValueData[];
}

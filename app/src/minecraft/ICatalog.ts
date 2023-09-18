import IBlockBaseTypeData from "./IBlockBaseTypeData";

export default interface ICatalog {
  blockBaseTypes: IBlockBaseTypeData[];
  entityTypes: { id: string; type: number }[];
}

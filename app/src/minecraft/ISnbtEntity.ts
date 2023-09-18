import IEntityNbtJson from "./IEntityNbtJson";

export default interface ISnbtEntity {
  blockPos: number[];
  pos: number[];
  nbt: IEntityNbtJson;
}

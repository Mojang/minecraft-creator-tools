import IVector3 from "../app/minecraft/IVector3";

export default interface IPackInfo {
  title: string;
  infoItemsByLocation: IPackInfoItemLocation[];
}

export interface IPackInfoItemLocation {
  id: string;
  title: string;
  location: IVector3;
}

import IWorldTestArea from "./IWorldTestArea";

export default interface IWorldTestDefinition {
  name: string;
  areas: IWorldTestArea[];
  worldId?: string;
}

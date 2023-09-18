import { IBlockComponentList } from "./IBlockComponentList";

export default interface IBlockEvent {
  sequence: IBlockComponentList[] | undefined;
}

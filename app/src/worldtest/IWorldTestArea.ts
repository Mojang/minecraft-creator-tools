import IActionSetData from "../actions/IActionSetData.js";

export enum WorldTestItemType {
  setBlock = 1,
  spawnEntity = 2,
  runCommand = 5,
}

export default interface IWorldTestArea {
  location: number[];
  scripts: IActionSetData[];
}

import IActionGroup from "./IActionGroup.js";

export enum ActionSetTarget {
  general = 0,
  script = 1,
  mcfunction = 2,
  entityEvent = 3,
  gameTest = 4,
  worldTest = 5,
}

export default interface IActionSetData extends IActionGroup {
  name: string;
  targetType: ActionSetTarget;
}

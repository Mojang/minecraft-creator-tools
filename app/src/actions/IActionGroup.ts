import IAction from "./IAction.js";

export default interface IActionGroup {
  id?: string;
  name?: string;
  actions: (IAction | IActionGroup)[];
  canvasX?: number;
  canvasY?: number;
  groupActionType?: string;
  groupActionData?: IAction;
}

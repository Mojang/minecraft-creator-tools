import IConditionClause from "./IConditionClause";

export enum ActionContextType {
  general = 0,
  entity = 1,
  block = 2,
  item = 3,
  gameTest = 4,
  dimensionLocation = 5,
}

export default interface IAction {
  id?: string;
  type: string;
  args?: object;
  condition?: IConditionClause[];
  actions?: IAction[];
  value?: string;
  withId?: string;
  setId?: string;

  name?: string;
  location?: number[];
}

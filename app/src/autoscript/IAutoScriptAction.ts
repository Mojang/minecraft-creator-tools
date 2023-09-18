import IAutoScriptClause from "./IAutoScriptClause.js";

export default interface IAutoScriptAction {
  type: string;
  args?: object;
  condition?: IAutoScriptClause[];
  actions?: IAutoScriptAction[];
  value?: string;
  withId?: string;
  setId?: string;
}

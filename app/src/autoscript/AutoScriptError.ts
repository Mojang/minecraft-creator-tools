import AutoScriptAction from "./AutoScriptAction";

export default class AutoScriptError {
  action: AutoScriptAction;
  message: string;

  constructor(action: AutoScriptAction, message: string) {
    this.action = action;
    this.message = message;
  }
}

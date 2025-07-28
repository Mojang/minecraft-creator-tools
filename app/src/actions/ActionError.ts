import Action from "./Action";

export default class ActionError {
  action: Action;
  message: string;

  constructor(action: Action, message: string) {
    this.action = action;
    this.message = message;
  }
}

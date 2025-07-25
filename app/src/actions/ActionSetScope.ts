import Utilities from "../core/Utilities";
import Test from "../gameTest/Test";
import IWorld from "../minecraft/IWorld";
import Action from "./Action";
import ActionError from "./ActionError";

export default class ActionSetScope {
  parent: ActionSetScope | undefined;

  test: Test | undefined;
  world: IWorld | undefined;
  errors: ActionError[] = [];

  state: { [name: string]: object } = {};

  getState(name: string): object | undefined {
    const result = this.state[name];

    if (!result && this.parent) {
      return this.parent.getState(name);
    }

    return result;
  }

  setState(name: string, val: object) {
    if (Utilities.isUsableAsObjectKey(name)) {
      this.state[name] = val;
    }
  }

  addError(action: Action, message: string) {
    const error = new ActionError(action, message);

    this.addErrorDirect(error);
  }

  addErrorDirect(error: ActionError) {
    this.errors.push(error);

    if (this.parent) {
      this.parent.addErrorDirect(error);
    }
  }

  createBlockLocation(name: string) {
    const val = this.getState(name);

    if (val instanceof Array) {
    }
  }
}

import Test from "../gameTest/Test";
import IWorld from "../minecraft/IWorld";
import AutoScriptAction from "./AutoScriptAction";
import AutoScriptError from "./AutoScriptError";

export default class AutoScriptScope {
  parent: AutoScriptScope | undefined;

  test: Test | undefined;
  world: IWorld | undefined;
  errors: AutoScriptError[] = [];

  state: { [name: string]: object } = {};

  getState(name: string): object | undefined {
    const result = this.state[name];

    if (!result && this.parent) {
      return this.parent.getState(name);
    }

    return result;
  }

  setState(name: string, val: object) {
    this.state[name] = val;
  }

  addError(action: AutoScriptAction, message: string) {
    const error = new AutoScriptError(action, message);

    this.addErrorDirect(error);
  }

  addErrorDirect(error: AutoScriptError) {
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

import { ManagedComponent } from "../ManagedComponent";

export default class NumberValueComponent extends ManagedComponent {
  get value(): number | undefined {
    return this.getProperty("value");
  }

  set value(newVal: number | undefined) {
    this.setProperty("value", newVal);
  }
}

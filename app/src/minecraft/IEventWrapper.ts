import IEventActionSet from "./IEventActionSet";
import IEventAction from "./IEventAction";

export default interface IEventWrapper {
  id: string;
  event: IEventActionSet | IEventAction;
}

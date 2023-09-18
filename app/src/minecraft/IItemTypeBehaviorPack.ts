import IComponentDataItem from "./IComponentDataItem";
import IItemEvent from "./IItemEvent";
import IItemTypeDescription from "./IItemTypeDescription";

export default interface IItemTypeBehaviorPack extends IComponentDataItem {
  description: IItemTypeDescription;

  events: { [name: string]: IItemEvent };
}

import IComponent from "./IComponent";

export default interface IComponentDataItem {
  components: { [name: string]: IComponent | string | number | undefined };
}

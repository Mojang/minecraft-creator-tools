import IComponent from "./IComponent";

export default interface IComponentGroup {
  [name: string]: IComponent | string | number | undefined;
}

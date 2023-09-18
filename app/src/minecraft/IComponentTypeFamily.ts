import IComponent from "./IComponent";

export default interface IComponentTypeFamily extends IComponent {
  on_death: string;
}

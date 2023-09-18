import IManagedComponent from "./IManagedComponent";

export default interface IManagedComponentGroup {
  [name: string]: IManagedComponent | undefined;
}

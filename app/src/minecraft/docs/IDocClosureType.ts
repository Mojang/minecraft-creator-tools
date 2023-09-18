import IDocTypeReference from "./IDocTypeReference";

export default interface IDocClosureType {
  argument_types: IDocTypeReference[];
  return_type: IDocTypeReference;
}

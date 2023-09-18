import IDocClosureType from "./IDocClosureType";

export default interface IDocTypeReference {
  closure_type: IDocClosureType;
  element_type: IDocTypeReference | null;
  promise_type: IDocTypeReference | null;
  is_bind_type: boolean;
  is_errorable: boolean;
  name: string;
  valid_range: boolean;
}

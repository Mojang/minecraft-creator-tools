import IDocTypeReference from "./IDocTypeReference";

export default interface IDocArgument {
  details: string | null;
  name: string;
  type: IDocTypeReference;
}

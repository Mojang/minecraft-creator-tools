import IDocCommandOverloadParamType from "./IDocCommandOverloadParamType";

export default interface IDocCommandOverloadParam {
  is_optional: boolean;
  name: string;
  type: IDocCommandOverloadParamType;
}

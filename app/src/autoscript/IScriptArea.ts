import IAutoScriptData from "./IAutoScriptData.js";

export default interface IAutoScriptArea {
  name: string;
  location: number[];
  script: IAutoScriptData;
}

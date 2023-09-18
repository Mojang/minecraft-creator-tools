import IInfoItemData from "./IInfoItemData";
import IProjectInfo from "./IProjectInfo";

export default interface IProjectInfoData {
  info: IProjectInfo;
  items: IInfoItemData[];
  sourcePath?: string;
  sourceHash?: string;
  sourceName?: string;
  generatorName?: string;
  generatorVersion?: string;
}

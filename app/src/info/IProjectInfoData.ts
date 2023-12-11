import IInfoItemData from "./IInfoItemData";
import IProjectInfo from "./IProjectInfo";

export enum ProjectInfoSuite {
  allExceptAddOn = 0,
  currentPlatform = 1,
  addOn = 2,
}

export default interface IProjectInfoData {
  info: IProjectInfo;
  items: IInfoItemData[];
  sourcePath?: string;
  sourceHash?: string;
  sourceName?: string;
  suite?: number;
  generatorName?: string;
  generatorVersion?: string;
}

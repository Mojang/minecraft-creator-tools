import IProjectInfoData from "../info/IProjectInfoData";

export default interface IProjectMetaState {
  projectContainerName: string;
  projectPath?: string;
  projectName?: string;
  projectTitle: string;
  infoSetData: IProjectInfoData;
}

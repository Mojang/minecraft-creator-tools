import IProjectInfoData, { ProjectInfoSuite } from "./IProjectInfoData";

export default interface IProjectMetaState {
  projectContainerName: string;
  projectPath?: string;
  projectName?: string;
  projectTitle: string;
  infoSetData: IProjectInfoData;
  suite: ProjectInfoSuite | undefined;
}

import IProjectInfoData, { ProjectInfoSuite } from "./IProjectInfoData";
import ProjectInfoSet from "./ProjectInfoSet";

export default interface IProjectMetaState {
  projectContainerName: string;
  projectPath?: string;
  projectName?: string;
  projectTitle: string;
  infoSetData: IProjectInfoData;
  suite: ProjectInfoSuite | undefined;
}

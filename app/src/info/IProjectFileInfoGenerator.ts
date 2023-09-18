import ProjectInfoItem from "./ProjectInfoItem";
import IFile from "../storage/IFile";
import IProjectInfoGeneratorBase from "./IProjectInfoGeneratorBase";

export default interface IProjectFileInfoGenerator extends IProjectInfoGeneratorBase {
  generate(projectFile: IFile): Promise<ProjectInfoItem[]>;
}

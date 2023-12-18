import ProjectInfoItem from "./ProjectInfoItem";
import IFile from "../storage/IFile";
import IProjectInfoGeneratorBase from "./IProjectInfoGeneratorBase";
import Project from "../app/Project";

export default interface IProjectFileInfoGenerator extends IProjectInfoGeneratorBase {
  generate(project: Project, projectFile: IFile): Promise<ProjectInfoItem[]>;
}

import ProjectInfoItem from "./ProjectInfoItem";
import Project from "./../app/Project";
import IProjectInfoGeneratorBase from "./IProjectInfoGeneratorBase";

export default interface IProjectInfoGenerator extends IProjectInfoGeneratorBase {
  generate(project: Project): Promise<ProjectInfoItem[]>;
}

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "./../app/ProjectItem";
import IProjectInfoGeneratorBase from "./IProjectInfoGeneratorBase";
import ProjectInfoSet from "./ProjectInfoSet";

export default interface IProjectItemInfoGenerator extends IProjectInfoGeneratorBase {
  generate(projectItem: ProjectItem): Promise<ProjectInfoItem[]>;
}

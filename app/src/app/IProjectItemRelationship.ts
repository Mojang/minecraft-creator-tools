import ProjectItem from "./ProjectItem";

export default interface IProjectItemRelationship {
  parentItem: ProjectItem;
  childItem: ProjectItem;
}

import { ProjectItemType } from "./IProjectItemData";
import ProjectItem from "./ProjectItem";

export default interface IProjectItemUnfulfilledRelationship {
  parentItem: ProjectItem;
  itemType: ProjectItemType;
  path: string;
  isVanillaDependent: boolean;
}

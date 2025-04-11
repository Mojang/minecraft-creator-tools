import { ProjectItemCreationType, ProjectItemErrorStatus } from "./IProjectItemData";

export enum ProjectItemVariantType {
  general = 0,
  subPack = 1,
}

export default interface IProjectItemVariant {
  label: string;
  variantType: ProjectItemVariantType;
  projectPath?: string;
  creationType?: ProjectItemCreationType;
  errorMessage?: string;
  errorStatus?: ProjectItemErrorStatus;
}

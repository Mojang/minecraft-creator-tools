import { ProjectItemCreationType, ProjectItemErrorStatus } from "./IProjectItemData";

export enum ProjectItemVariantType {
  general = 0,
  subPack = 1,
  versionSlice = 2,
  versionSliceAlt = 3,
  versionSliceAltPacks = 4,
}

export const MaxVariantCounts = 4;

export default interface IProjectItemVariant {
  label: string;
  variantType: ProjectItemVariantType;
  projectPath?: string;
  creationType?: ProjectItemCreationType;
  errorMessage?: string;
  errorStatus?: ProjectItemErrorStatus;
}

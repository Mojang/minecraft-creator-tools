// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IProjectItemData from "./IProjectItemData";
import IGitHubInfo from "./IGitHubInfo";
import ITool from "./ITool";
import { IWorldSettings } from "../minecraft/IWorldSettings";
import IStatus from "./Status";
import { MinecraftTrack } from "./ICreatorToolsData";
import IProjectVariant from "./IProjectVariant";

export enum ProjectDataType {
  localStorage = 0,
  clientStorage = 1,
}

export enum ProjectFocus {
  general = 0,
  gameTests = 1,
  world = 2,
  focusedCodeSnippet = 3,
  editorExtension = 4,
}

export enum ProjectScriptLanguage {
  javaScript = 0,
  typeScript = 1,
}

export enum ProjectScriptVersion {
  latestStable = 0,
  stable10 = 1,
  latestBeta = 999,
}

export enum ProjectEditPreference {
  default = 0,
  summarized = 1,
  editors = 2,
  raw = 3,
}

export enum ProjectRole {
  general = 0,
  documentation = 1,
  meta = 2,
  explorer = 3,
}

export default interface IProjectData {
  dataType: ProjectDataType;
  storageBasePath: string;
  name: string;
  title: string;
  shortName?: string;
  creator?: string;
  defaultNamespace?: string;
  scriptEntryPoint?: string;
  description: string;
  focus: ProjectFocus;
  role?: ProjectRole;
  projectFolderTitle?: string;
  variants: { [variant: string]: IProjectVariant };

  track?: MinecraftTrack;

  editPreference: ProjectEditPreference;

  gitHubReferences?: IGitHubInfo[];

  collapsedStoragePaths?: string[];

  preferredTools?: ITool[];

  preferredScriptLanguage?: ProjectScriptLanguage;
  scriptVersion?: ProjectScriptVersion;

  versionMajor?: number;
  versionMinor?: number;
  versionPatch?: number;
  usesCustomWorldSettings?: boolean;
  worldSettings?: IWorldSettings;
  editorWorldSettings?: IWorldSettings;
  autoDeploymentMode?: number;

  lastMapDeployedDate?: Date;
  lastMapDeployedHash?: string;

  showHiddenItems?: boolean;
  showFunctions?: boolean;
  showAssets?: boolean;
  showTypes?: boolean;

  gitHubRepoName?: string;
  gitHubOwner?: string;
  gitHubFolder?: string;
  gitHubBranch?: string;

  originalGalleryId?: string;
  originalSampleId?: string;
  originalFullPath?: string;
  originalFileList?: string[];
  originalGitHubRepoName?: string;
  originalGitHubOwner?: string;
  originalGitHubBranch?: string;
  originalGitHubFolder?: string;

  defaultBehaviorPackUniqueId: string;
  defaultBehaviorPackVersion?: number[];
  defaultResourcePackUniqueId: string;
  defaultResourcePackVersion?: number[];
  defaultDataUniqueId: string;
  defaultScriptModuleUniqueId: string;
  contentsModified: Date | null;

  localFolderPath?: string;
  mainDeployFolderPath?: string;
  localFilePath?: string;
  dataStorageRelativePath: string;
  messages?: IStatus[];

  /**
   * Base64-encoded PNG image for project preview thumbnail.
   * Used in the project list to show a visual preview of the project.
   * If not set, a default placeholder image will be shown.
   */
  previewImageBase64?: string;

  items: IProjectItemData[];
}

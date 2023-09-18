export default interface IProjectInfo {
  defaultBehaviorPackUuid?: string;
  defaultBehaviorPackMinEngineVersion?: string;
  defaultBehaviorPackName?: string;
  defaultBehaviorPackDescription?: string;
  behaviorPackManifestCount?: number;
  defaultResourcePackUuid?: string;
  defaultResourcePackMinEngineVersion?: string;
  defaultResourcePackName?: string;
  defaultResourcePackDescription?: string;
  resourcePackManifestCount?: number;
  unknownJsonCount?: number;
  entityTypeManifestCount?: number;
  blockTypeManifestCount?: number;
  itemTypeManifestCount?: number;
  worldCount?: number;
  entityTypeResourceCount?: number;
  behaviorPackAnimationCount?: number;
  behaviorPackAnimationControllerCount?: number;
  features?: { [featureName: string]: number | undefined };
}

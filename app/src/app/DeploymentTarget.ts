import IFolder from "../storage/IFolder";
import IStorage from "../storage/IStorage";

export const MaxDeploymentTargets = 8;

export enum DeploymentTargetType {
  none = 0,
  bedrock = 1,
  bedrockPreview = 2,
  education = 3,
  educationPreview = 4,
  developer = 5,
  customDedicatedServer = 6,
  customCoreData = 7,
}

export default class DeploymentTarget {
  storage: IStorage;
  targetType: DeploymentTargetType;

  private _deployBehaviorPacksFolder: IFolder;
  private _deployResourcePacksFolder: IFolder;

  get deployBehaviorPacksFolder(): IFolder | null {
    return this._deployBehaviorPacksFolder;
  }

  get deployResourcePacksFolder(): IFolder | null {
    return this._deployResourcePacksFolder;
  }

  constructor(storage: IStorage, targetType: DeploymentTargetType) {
    this.storage = storage;
    this.targetType = targetType;

    this._deployBehaviorPacksFolder = this.storage.rootFolder.ensureFolder("development_behavior_packs");
    this._deployResourcePacksFolder = this.storage.rootFolder.ensureFolder("development_resource_packs");
  }
}

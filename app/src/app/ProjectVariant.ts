import IProjectVariant from "./IProjectVariant";
import Project from "./Project";

export default class ProjectVariant {
  private _data: IProjectVariant;

  private _isDefault: boolean;
  private _project: Project;

  constructor(parent: Project, data: IProjectVariant) {
    this._project = parent;
    this._data = data;

    this._isDefault = this._data.label === "";
  }

  static canonicalizeVariantLabel(variantLabel: string) {
    return variantLabel.toLowerCase().trim();
  }

  get isDefault() {
    return this._isDefault;
  }

  get effectiveUnifiedTier() {
    if (this.memoryTier === undefined) {
      return undefined;
    }

    // per specified mappings of previous subpack tiers (where each number corresponds to 512mb of device memory)
    // to updated, broader, unified tiers that adds in device profile info
    if (this.memoryTier < 11) {
      return 0;
    }

    if (this.memoryTier <= 11) {
      return 1;
    }

    if (this.memoryTier <= 12) {
      return 2;
    }

    if (this.memoryTier <= 18) {
      return 3;
    }

    if (this.memoryTier <= 31) {
      return 4;
    }

    return 5;
  }

  get memoryTier() {
    return this._data.memoryTier;
  }

  set memoryTier(newTier: number | undefined) {
    this._data.memoryTier = newTier;
  }

  get title() {
    return this._data.title;
  }

  set title(newTitle: string | undefined) {
    this._data.title = newTitle;
  }
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";
import IDefinition from "./IDefinition";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import RelationsIndex from "../app/RelationsIndex";
import MinecraftAggregateFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftAggregateFeature";
import MinecraftBeardsAndShavers from "@minecraft/bedrock-schemas/types/bp/features/MinecraftBeardsAndShavers";
import MinecraftCaveCarverFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftCaveCarverFeature";
import MinecraftFossilFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftFossilFeature";
import MinecraftGeodeFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftGeodeFeature";
import MinecraftGrowingPlantFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftGrowingPlantFeature";
import MinecraftMultifaceFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftMultifaceFeature";
import MinecraftNetherCaveCarverFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftNetherCaveCarverFeature";
import MinecraftOreFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftOreFeature";
import MinecraftPartiallyExposedBlobFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftPartiallyExposedBlobFeature";
import MinecraftRectLayout from "@minecraft/bedrock-schemas/types/bp/features/MinecraftRectLayout";
import MinecraftScanSurface from "@minecraft/bedrock-schemas/types/bp/features/MinecraftScanSurface";
import MinecraftScatterFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftScatterFeature";
import MinecraftSculkPatchFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftSculkPatchFeature";
import MinecraftSearchFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftSearchFeature";
import MinecraftSequenceFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftSequenceFeature";
import MinecraftSingleBlockFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftSingleBlockFeature";
import MinecraftSnapToSurfaceFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftSnapToSurfaceFeature";
import MinecraftStructureTemplateFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftStructureTemplateFeature";
import MinecraftSurfaceRelativeThresholdFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftSurfaceRelativeThresholdFeature";
import MinecraftTreeFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftTreeFeature";
import MinecraftUnderwaterCaveCarverFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftUnderwaterCaveCarverFeature";
import MinecraftVegetationPatchFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftVegetationPatchFeature";
import MinecraftWeightedRandomFeature from "@minecraft/bedrock-schemas/types/bp/features/MinecraftWeightedRandomFeature";
import MinecraftFeatureBase from "./jsoncommon/MinecraftFeatureBase";
import Log from "../core/Log";

export const FeatureTypes = [
  "aggregate_feature",
  "beards_and_shavers",
  "cave_carver_feature",
  "conditional_list",
  "fossil_feature",
  "geode_feature",
  "growing_plant_feature",
  "multiface_feature",
  "nether_cave_carver_feature",
  "ore_feature",
  "partially_exposed_blob_feature",
  "rect_layout",
  "scan_surface",
  "scatter_feature",
  "sculk_patch_feature",
  "search_feature",
  "sequence_feature",
  "single_block_feature",
  "snap_to_surface_feature",
  "structure_template_feature",
  "surface_relative_threshold_feature",
  "tree_feature",
  "underwater_cave_carver_feature",
  "vegetation_patch_feature",
  "weighted_random_feature",
];

export default class FeatureDefinition implements IDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;
  private _loadedWithComments: boolean = false;

  private _data?:
    | MinecraftAggregateFeature
    | MinecraftBeardsAndShavers
    | MinecraftCaveCarverFeature
    | MinecraftFossilFeature
    | MinecraftGeodeFeature
    | MinecraftGrowingPlantFeature
    | MinecraftMultifaceFeature
    | MinecraftNetherCaveCarverFeature
    | MinecraftOreFeature
    | MinecraftPartiallyExposedBlobFeature
    | MinecraftRectLayout
    | MinecraftScanSurface
    | MinecraftScatterFeature
    | MinecraftSculkPatchFeature
    | MinecraftSearchFeature
    | MinecraftSequenceFeature
    | MinecraftSingleBlockFeature
    | MinecraftSnapToSurfaceFeature
    | MinecraftStructureTemplateFeature
    | MinecraftSurfaceRelativeThresholdFeature
    | MinecraftTreeFeature
    | MinecraftUnderwaterCaveCarverFeature
    | MinecraftVegetationPatchFeature
    | MinecraftWeightedRandomFeature
    | MinecraftFeatureBase;

  private _onLoaded = new EventDispatcher<FeatureDefinition, FeatureDefinition>();

  public get typeString() {
    if (!this._data) {
      return undefined;
    }

    for (const typeStr of FeatureTypes) {
      if ((this._data as any)["minecraft:" + typeStr] !== undefined) {
        return typeStr;
      }
    }

    return undefined;
  }

  public get data() {
    return this._data;
  }

  public get isLoaded() {
    return this._isLoaded;
  }

  public get file() {
    return this._file;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public set file(newFile: IFile | undefined) {
    this._file = newFile;
  }

  public get id() {
    return this._id;
  }

  public set id(newId: string | undefined) {
    this._id = newId;
  }

  public get shortId() {
    if (this._id !== undefined) {
      if (this._id.startsWith("minecraft:")) {
        return this._id.substring(10, this._id.length);
      }

      return this._id;
    }

    return undefined;
  }

  public async getFormatVersionIsCurrent() {
    const fv = this.getFormatVersion();

    if (fv === undefined || fv.length !== 3) {
      return false;
    }

    return await Database.isRecentVersionFromVersionArray(fv);
  }

  public getFormatVersion(): number[] | undefined {
    if (!this._data || !(this._data as MinecraftFeatureBase).format_version) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom((this._data as MinecraftFeatureBase).format_version);
  }

  setResourcePackFormatVersion(versionStr: string) {
    this._ensureDataInitialized();

    if (this._data) {
      (this._data as MinecraftFeatureBase).format_version = versionStr;
    }
  }

  _ensureDataInitialized() {
    if (this._data === undefined) {
      this._data = {
        format_version: "1.21.0",
      };
    }
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<FeatureDefinition, FeatureDefinition>) {
    let fd: FeatureDefinition | undefined;

    if (file.manager === undefined) {
      fd = new FeatureDefinition();

      fd.file = file;

      file.manager = fd;
    }

    if (file.manager !== undefined && file.manager instanceof FeatureDefinition) {
      fd = file.manager as FeatureDefinition;

      if (!fd.isLoaded) {
        if (loadHandler) {
          fd.onLoaded.subscribe(loadHandler);
        }

        await fd.load();
      }
    }

    return fd;
  }

  persist(): boolean {
    if (this._file === undefined) {
      return false;
    }

    Log.assert(this._data !== null, "FDP");

    if (!this._data) {
      return false;
    }

    return this._file.setObjectContentIfSemanticallyDifferent(this._data);
  }

  /**
   * Loads the definition from the file.
   * @param preserveComments If true, uses comment-preserving JSON parsing for edit/save cycles.
   *                         If false (default), uses efficient standard JSON parsing.
   *                         Can be called again with true to "upgrade" a read-only load to read/write.
   */
  async load(preserveComments: boolean = false) {
    // If already loaded with comments, we have the "best" version - nothing more to do
    if (this._isLoaded && this._loadedWithComments) {
      return;
    }

    // If already loaded without comments and caller doesn't need comments, we're done
    if (this._isLoaded && !preserveComments) {
      return;
    }

    if (this._file === undefined) {
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      this._isLoaded = true;
      this._loadedWithComments = preserveComments;
      this._onLoaded.dispatch(this, this);
      return;
    }

    // Use comment-preserving parser only when needed for editing
    this._data = preserveComments
      ? StorageUtilities.getJsonObjectWithComments(this._file)
      : StorageUtilities.getJsonObject(this._file);

    // Extract the identifier from the feature description
    // Features can be of different types, so we check all known feature types
    if (this._data) {
      for (const typeStr of FeatureTypes) {
        const featureData = (this._data as any)["minecraft:" + typeStr];
        if (featureData?.description?.identifier) {
          this._id = featureData.description.identifier;
          break;
        }
      }
    }

    this._isLoaded = true;
    this._loadedWithComments = preserveComments;
    this._onLoaded.dispatch(this, this);
  }

  /**
   * Extracts all feature identifiers that this feature references/depends on.
   * Different feature types reference other features in different ways:
   * - aggregate_feature, sequence_feature: features[] array of strings
   * - weighted_random_feature: features[] array of [featureId, weight] tuples
   * - scatter_feature, search_feature, beards_and_shavers: places_feature string
   * - conditional_list: conditional_features[] array of objects with places_feature
   * - snap_to_surface_feature: feature_to_snap string
   * - surface_relative_threshold_feature: feature_to_place string
   * - vegetation_patch_feature: vegetation_feature string
   */
  getReferencedFeatureIds(): string[] {
    if (!this._data) {
      return [];
    }

    const referencedFeatures: string[] = [];

    // Check each possible feature type and extract references
    for (const typeStr of FeatureTypes) {
      const featureData = (this._data as any)["minecraft:" + typeStr];
      if (!featureData) {
        continue;
      }

      // aggregate_feature and sequence_feature: features[] is an array of feature IDs
      if (typeStr === "aggregate_feature" || typeStr === "sequence_feature") {
        if (Array.isArray(featureData.features)) {
          for (const feature of featureData.features) {
            if (typeof feature === "string") {
              referencedFeatures.push(feature);
            }
          }
        }
      }
      // weighted_random_feature: features[] is an array of [featureId, weight] tuples
      else if (typeStr === "weighted_random_feature") {
        if (Array.isArray(featureData.features)) {
          for (const feature of featureData.features) {
            if (Array.isArray(feature) && feature.length >= 1 && typeof feature[0] === "string") {
              referencedFeatures.push(feature[0]);
            }
          }
        }
      }
      // scatter_feature, search_feature, beards_and_shavers: places_feature is a string
      else if (typeStr === "scatter_feature" || typeStr === "search_feature" || typeStr === "beards_and_shavers") {
        if (typeof featureData.places_feature === "string") {
          referencedFeatures.push(featureData.places_feature);
        }
      }
      // conditional_list: conditional_features[] is an array of objects with places_feature
      else if (typeStr === "conditional_list") {
        if (Array.isArray(featureData.conditional_features)) {
          for (const condFeature of featureData.conditional_features) {
            if (condFeature && typeof condFeature.places_feature === "string") {
              referencedFeatures.push(condFeature.places_feature);
            }
          }
        }
      }
      // snap_to_surface_feature: feature_to_snap is a string
      else if (typeStr === "snap_to_surface_feature") {
        if (typeof featureData.feature_to_snap === "string") {
          referencedFeatures.push(featureData.feature_to_snap);
        }
      }
      // surface_relative_threshold_feature: feature_to_place is a string
      else if (typeStr === "surface_relative_threshold_feature") {
        if (typeof featureData.feature_to_place === "string") {
          referencedFeatures.push(featureData.feature_to_place);
        }
      }
      // vegetation_patch_feature: vegetation_feature is a string
      else if (typeStr === "vegetation_patch_feature") {
        if (typeof featureData.vegetation_feature === "string") {
          referencedFeatures.push(featureData.vegetation_feature);
        }
      }
    }

    return referencedFeatures;
  }

  async addChildItems(project: Project, item: ProjectItem, index?: RelationsIndex) {
    const referencedFeatureIds = this.getReferencedFeatureIds();

    if (referencedFeatureIds.length === 0) {
      return;
    }

    for (const featureId of referencedFeatureIds) {
      let foundMatch = false;

      // Use index for O(1) lookup when available
      if (index) {
        const matchingItems = index.getItemsById(index.featureBehaviorsById, featureId);
        if (matchingItems.length > 0) {
          for (const matchItem of matchingItems) {
            item.addChildItem(matchItem);
          }
          foundMatch = true;
        }
      } else {
        const featureItems = project.getItemsByType(ProjectItemType.featureBehavior);

        // Look for matching feature items in the project
        for (const candItem of featureItems) {
          if (!candItem.isContentLoaded) {
            await candItem.loadContent();
          }

          if (candItem.primaryFile) {
            const featureDef = await FeatureDefinition.ensureOnFile(candItem.primaryFile);

            if (featureDef) {
              const candFeatureId = featureDef.id;

              if (candFeatureId === featureId) {
                item.addChildItem(candItem);
                foundMatch = true;
                break;
              }
            }
          }
        }
      }

      // If no matching feature was found, add as unfulfilled relationship
      if (!foundMatch) {
        const isVanilla = await Database.isVanillaToken(featureId);
        item.addUnfulfilledRelationship(featureId, ProjectItemType.featureBehavior, isVanilla);
      }
    }
  }
}

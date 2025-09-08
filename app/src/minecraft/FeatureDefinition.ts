// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";
import IDefinition from "./IDefinition";
import MinecraftAggregateFeature from "./json/features/MinecraftAggregateFeature";
import MinecraftBeardsAndShavers from "./json/features/MinecraftBeardsAndShavers";
import MinecraftCaveCarverFeature from "./json/features/MinecraftCaveCarverFeature";
import MinecraftFossilFeature from "./json/features/MinecraftFossilFeature";
import MinecraftGeodeFeature from "./json/features/MinecraftGeodeFeature";
import MinecraftGrowingPlantFeature from "./json/features/MinecraftGrowingPlantFeature";
import MinecraftMultifaceFeature from "./json/features/MinecraftMultifaceFeature";
import MinecraftNetherCaveCarverFeature from "./json/features/MinecraftNetherCaveCarverFeature";
import MinecraftOreFeature from "./json/features/MinecraftOreFeature";
import MinecraftPartiallyExposedBlobFeature from "./json/features/MinecraftPartiallyExposedBlobFeature";
import MinecraftRectLayout from "./json/features/MinecraftRectLayout";
import MinecraftScanSurface from "./json/features/MinecraftScanSurface";
import MinecraftScatterFeature from "./json/features/MinecraftScatterFeature";
import MinecraftSculkPatchFeature from "./json/features/MinecraftSculkPatchFeature";
import MinecraftSearchFeature from "./json/features/MinecraftSearchFeature";
import MinecraftSequenceFeature from "./json/features/MinecraftSequenceFeature";
import MinecraftSingleBlockFeature from "./json/features/MinecraftSingleBlockFeature";
import MinecraftSnapToSurfaceFeature from "./json/features/MinecraftSnapToSurfaceFeature";
import MinecraftStructureTemplateFeature from "./json/features/MinecraftStructureTemplateFeature";
import MinecraftSurfaceRelativeThresholdFeature from "./json/features/MinecraftSurfaceRelativeThresholdFeature";
import MinecraftTreeFeature from "./json/features/MinecraftTreeFeature";
import MinecraftUnderwaterCaveCarverFeature from "./json/features/MinecraftUnderwaterCaveCarverFeature";
import MinecraftVegetationPatchFeature from "./json/features/MinecraftVegetationPatchFeature";
import MinecraftWeightedRandomFeature from "./json/features/MinecraftWeightedRandomFeature";
import MinecraftFeatureBase from "./jsoncommon/MinecraftFeatureBase";
import Log from "../core/Log";

export const FeatureTypes = [
  "aggregate_feature",
  "cave_carver_feature",
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

  persist() {
    if (this._file === undefined) {
      return;
    }

    Log.assert(this._data !== null, "FDP");

    if (this._data) {
      const bpString = JSON.stringify(this._data, null, 2);

      this._file.setContent(bpString);
    }
  }

  async load() {
    if (this._file === undefined || this._isLoaded) {
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this._data = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}

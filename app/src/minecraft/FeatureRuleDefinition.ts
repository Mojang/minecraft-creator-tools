// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";
import IDefinition from "./IDefinition";
import { MinecraftFeatureBase } from "./jsoncommon";
import Log from "../core/Log";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import FeatureDefinition from "./FeatureDefinition";
import RelationsIndex from "../app/RelationsIndex";

export default class FeatureRuleDefinition implements IDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;
  private _loadedWithComments: boolean = false;

  private _data?: MinecraftFeatureBase;

  private _onLoaded = new EventDispatcher<FeatureRuleDefinition, FeatureRuleDefinition>();

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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<FeatureRuleDefinition, FeatureRuleDefinition>) {
    let fd: FeatureRuleDefinition | undefined;

    if (file.manager === undefined) {
      fd = new FeatureRuleDefinition();

      fd.file = file;

      file.manager = fd;
    }

    if (file.manager !== undefined && file.manager instanceof FeatureRuleDefinition) {
      fd = file.manager as FeatureRuleDefinition;

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

    Log.assert(this._data !== null, "ITDP");

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

    // Extract the identifier from the feature rule description
    const featureRulesData = (this._data as any)?.["minecraft:feature_rules"];
    if (featureRulesData?.description?.identifier) {
      this._id = featureRulesData.description.identifier;
    }

    this._isLoaded = true;
    this._loadedWithComments = preserveComments;
    this._onLoaded.dispatch(this, this);
  }

  /**
   * Gets the feature identifier that this feature rule places.
   * Feature rules reference their target feature via description.places_feature
   */
  getPlacesFeatureId(): string | undefined {
    if (!this._data) {
      return undefined;
    }

    const featureRulesData = (this._data as any)?.["minecraft:feature_rules"];
    if (featureRulesData?.description?.places_feature) {
      return featureRulesData.description.places_feature;
    }

    return undefined;
  }

  async addChildItems(project: Project, item: ProjectItem, index?: RelationsIndex) {
    const placesFeatureId = this.getPlacesFeatureId();

    if (!placesFeatureId) {
      return;
    }

    let foundMatch = false;

    // Use index for O(1) lookup when available
    if (index) {
      const matchingItems = index.getItemsById(index.featureBehaviorsById, placesFeatureId);
      if (matchingItems.length > 0) {
        for (const matchItem of matchingItems) {
          item.addChildItem(matchItem);
        }
        foundMatch = true;
      }
    } else {
      const featureItems = project.getItemsByType(ProjectItemType.featureBehavior);

      // Look for the matching feature item in the project
      for (const candItem of featureItems) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile) {
          const featureDef = await FeatureDefinition.ensureOnFile(candItem.primaryFile);

          if (featureDef) {
            const candFeatureId = featureDef.id;

            if (candFeatureId === placesFeatureId) {
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
      const isVanilla = await Database.isVanillaToken(placesFeatureId);
      item.addUnfulfilledRelationship(placesFeatureId, ProjectItemType.featureBehavior, isVanilla);
    }
  }
}

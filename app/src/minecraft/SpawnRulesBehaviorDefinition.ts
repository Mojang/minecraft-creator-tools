// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";
import ISpawnRulesBehavior, { ISpawnRulesInner } from "./ISpawnRulesBehavior";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import RelationsIndex from "../app/RelationsIndex";
import { ProjectItemType } from "../app/IProjectItemData";
import EntityTypeDefinition from "./EntityTypeDefinition";

export default class SpawnRulesBehaviorDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;
  private _loadedWithComments: boolean = false;

  public data?: ISpawnRulesBehavior;
  public dataInner?: ISpawnRulesInner;

  private _onLoaded = new EventDispatcher<SpawnRulesBehaviorDefinition, SpawnRulesBehaviorDefinition>();

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

    if (this.dataInner && this.dataInner.description && newId) {
      this.dataInner.description.identifier = newId;
    }
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
    if (!this.data || !this.data.format_version) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this.data.format_version);
  }

  setFormatVersion(versionStr: string) {
    this._ensureDataInitialized();

    if (this.data) {
      this.data.format_version = versionStr;
    }
  }

  _ensureDataInitialized() {
    if (this.data === undefined) {
      this.data = { "minecraft:spawn_rules": { description: { identifier: this._id ? this._id : "" } } };
    }
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<SpawnRulesBehaviorDefinition, SpawnRulesBehaviorDefinition>
  ) {
    let srb: SpawnRulesBehaviorDefinition | undefined;

    if (file.manager === undefined) {
      srb = new SpawnRulesBehaviorDefinition();

      srb.file = file;

      file.manager = srb;
    }

    if (file.manager !== undefined && file.manager instanceof SpawnRulesBehaviorDefinition) {
      srb = file.manager as SpawnRulesBehaviorDefinition;

      if (!srb.isLoaded) {
        if (loadHandler) {
          srb.onLoaded.subscribe(loadHandler);
        }

        await srb.load();
      }
    }

    return srb;
  }

  persist(): boolean {
    if (this._file === undefined) {
      return false;
    }

    if (!this.data) {
      return false;
    }

    return this._file.setObjectContentIfSemanticallyDifferent(this.data);
  }

  async addChildItems(project: Project, item: ProjectItem, index?: RelationsIndex) {
    if (!this.id) {
      return;
    }

    let foundMatch = false;

    if (index) {
      // Use pre-built index for O(1) lookup
      const matchingEntities = index.getItemsById(index.entityBehaviorsById, this.id);
      foundMatch = matchingEntities.length > 0;
    } else {
      // Fallback: scan entity behaviors
      const entityBehaviorItems = project.getItemsByType(ProjectItemType.entityTypeBehavior);

      for (const candItem of entityBehaviorItems) {
        if (!candItem.isContentLoaded) {
          await candItem.loadContent();
        }

        if (candItem.primaryFile) {
          const entityType = await EntityTypeDefinition.ensureOnFile(candItem.primaryFile);

          if (entityType) {
            const entityId = entityType.id;

            if (entityId === this.id) {
              foundMatch = true;
              break;
            }
          }
        }
      }
    }

    // If no matching entity type was found, add as unfulfilled relationship
    if (!foundMatch) {
      const isVanilla = await Database.isVanillaToken(this.id);
      item.addUnfulfilledRelationship(this.id, ProjectItemType.entityTypeBehavior, isVanilla);
    }
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
    this.data = preserveComments
      ? StorageUtilities.getJsonObjectWithComments(this._file)
      : StorageUtilities.getJsonObject(this._file);

    this.dataInner = this.data?.["minecraft:spawn_rules"];

    if (this.dataInner && this.dataInner.description) {
      this._id = this.dataInner.description.identifier;
    }

    this._isLoaded = true;
    this._loadedWithComments = preserveComments;
    this._onLoaded.dispatch(this, this);
  }
}

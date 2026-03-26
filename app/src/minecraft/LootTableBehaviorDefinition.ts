// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import ILootTableBehavior from "./ILootTableBehavior";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import RelationsIndex from "../app/RelationsIndex";
import ItemTypeDefinition from "./ItemTypeDefinition";
import Utilities from "../core/Utilities";
import Database from "./Database";
import Log from "../core/Log";

export default class LootTableBehaviorDefinition {
  private _file?: IFile;
  private _isLoaded: boolean = false;
  private _loadedWithComments: boolean = false;

  public data?: ILootTableBehavior;

  private _onLoaded = new EventDispatcher<LootTableBehaviorDefinition, LootTableBehaviorDefinition>();

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

  _ensureDataInitialized() {
    if (this.data === undefined) {
      this.data = { pools: [] };
    }
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<LootTableBehaviorDefinition, LootTableBehaviorDefinition>
  ) {
    let ltb: LootTableBehaviorDefinition | undefined;

    if (file.manager === undefined) {
      ltb = new LootTableBehaviorDefinition();

      ltb.file = file;

      file.manager = ltb;
    }

    if (file.manager !== undefined && file.manager instanceof LootTableBehaviorDefinition) {
      ltb = file.manager as LootTableBehaviorDefinition;

      if (!ltb.isLoaded) {
        if (loadHandler) {
          ltb.onLoaded.subscribe(loadHandler);
        }

        await ltb.load();
      }
    }

    return ltb;
  }

  getTargetItemTypeIdList() {
    if (!this.data || !this.data.pools || !Array.isArray(this.data.pools)) {
      return;
    }

    const targetItems: string[] = [];

    for (const pool of this.data.pools) {
      if (pool.entries && Array.isArray(pool.entries)) {
        for (const entry of pool.entries) {
          if (entry.type === "item" && entry.name) {
            targetItems.push(entry.name);
          }
        }
      }
    }

    return targetItems;
  }

  getTargetLootTablePathList() {
    if (!this.data || !this.data.pools || !Array.isArray(this.data.pools)) {
      return;
    }

    const targetLootTablePaths: string[] = [];

    for (const pool of this.data.pools) {
      if (pool.entries && Array.isArray(pool.entries)) {
        for (const entry of pool.entries) {
          if (entry.type === "loot_table" && entry.name) {
            targetLootTablePaths.push(this.canonicalizeLootTablePath(entry.name));
          }
        }
      }
    }

    return targetLootTablePaths;
  }

  persist(): boolean {
    if (this._file === undefined) {
      return false;
    }

    if (!this.data) {
      Log.unexpectedUndefined("ITRDP");
      return false;
    }

    return this._file.setObjectContentIfSemanticallyDifferent(this.data);
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

    this._isLoaded = true;
    this._loadedWithComments = preserveComments;
    this._onLoaded.dispatch(this, this);
  }

  canonicalizeLootTablePath(lootTablePath: string) {
    lootTablePath = Utilities.ensureNotStartsWithSlash(lootTablePath);

    const lastPeriod = lootTablePath.lastIndexOf(".");

    if (lastPeriod > 0) {
      lootTablePath = lootTablePath.substring(0, lastPeriod);
    }

    return lootTablePath.toLowerCase();
  }

  async addChildItems(project: Project, item: ProjectItem, index?: RelationsIndex) {
    let itemList = this.getTargetItemTypeIdList();
    let lootTableList = this.getTargetLootTablePathList();

    if (index) {
      // Use pre-built index for O(1) lookups
      if (itemList) {
        for (const itemTypeId of itemList) {
          if (typeof itemTypeId === "string") {
            const matchingItems = index.getItemsById(index.itemTypesById, itemTypeId);
            if (matchingItems.length > 0) {
              for (const candItem of matchingItems) {
                item.addChildItem(candItem);
              }
              itemList = Utilities.removeItemInArray(itemTypeId, itemList);
            }
          }
        }
      }

      // TODO: lootTablesByPath index stores by exact projectPath, but lookup needs
      // endsWith() matching. Fall back to scanning for now until a suffix-based index is added.
      if (lootTableList) {
        const lootTableItems = project.getItemsByType(ProjectItemType.lootTableBehavior);
        for (const candItem of lootTableItems) {
          if (candItem.primaryFile) {
            let lootTablePath = await candItem.getPackRelativePath();

            if (lootTablePath) {
              lootTablePath = this.canonicalizeLootTablePath(lootTablePath);
              if (lootTableList.includes(lootTablePath)) {
                item.addChildItem(candItem);
                lootTableList = Utilities.removeItemInArray(lootTablePath, lootTableList);
              }
            }
          }
        }
      }
    } else {
      // Fallback: scan all items
      const itemsCopy = project.getItemsCopy();

      for (const candItem of itemsCopy) {
        if (candItem.itemType === ProjectItemType.itemTypeBehavior && itemList) {
          if (!candItem.isContentLoaded) {
            await candItem.loadContent();
          }

          if (candItem.primaryFile) {
            const itemType = await ItemTypeDefinition.ensureOnFile(candItem.primaryFile);

            if (itemType) {
              if (itemList.includes(itemType.id)) {
                item.addChildItem(candItem);
                itemList = Utilities.removeItemInArray(itemType.id, itemList);
                continue;
              }
            }
          }
        } else if (candItem.itemType === ProjectItemType.lootTableBehavior && lootTableList) {
          if (!candItem.isContentLoaded) {
            await candItem.loadContent();
          }

          if (candItem.primaryFile) {
            let lootTablePath = await candItem.getPackRelativePath();

            if (lootTablePath) {
              lootTablePath = this.canonicalizeLootTablePath(lootTablePath);
              if (lootTableList.includes(lootTablePath)) {
                item.addChildItem(candItem);
                lootTableList = Utilities.removeItemInArray(lootTablePath, lootTableList);
                continue;
              }
            }
          }
        }
      }
    }

    if (itemList && Array.isArray(itemList)) {
      for (const itemTypeId of itemList) {
        if (typeof itemTypeId === "string") {
          const isVanilla = await Database.isVanillaToken(itemTypeId);
          item.addUnfulfilledRelationship(itemTypeId, ProjectItemType.itemTypeBehavior, isVanilla);
        }
      }
    }

    if (lootTableList && Array.isArray(lootTableList)) {
      for (const lootTablePath of lootTableList) {
        const isVanilla = await Database.matchesVanillaPathFromIndex(lootTablePath);
        item.addUnfulfilledRelationship(lootTablePath, ProjectItemType.lootTableBehavior, isVanilla);
      }
    }
  }
}

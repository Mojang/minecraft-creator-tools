// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "./Database";
import MinecraftUtilities from "./MinecraftUtilities";
import IRecipeBehavior, { IRecipeShaped, IRecipeShapeless } from "./IRecipeBehavior";
import IDefinition from "./IDefinition";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import ItemTypeDefinition from "./ItemTypeDefinition";
import BlockTypeDefinition from "./BlockTypeDefinition";
import RelationsIndex from "../app/RelationsIndex";

export default class RecipeBehaviorDefinition implements IDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;
  private _loadedWithComments: boolean = false;

  private _data?: IRecipeBehavior;
  private _interior?: IRecipeShaped | IRecipeShapeless;

  private _onLoaded = new EventDispatcher<RecipeBehaviorDefinition, RecipeBehaviorDefinition>();

  public get data() {
    return this._data;
  }

  public set data(newData: IRecipeBehavior | undefined) {
    this._data = newData;

    if (this._data && this._data["minecraft:recipe_shaped"]) {
      this._interior = this._data["minecraft:recipe_shaped"];
    } else if (this._data && this._data["minecraft:recipe_shapeless"]) {
      this._interior = this._data["minecraft:recipe_shapeless"];
    } else {
      this._interior = undefined;
    }
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
    if (this._interior && this._interior.description && this._interior.description.identifier) {
      return this._interior.description.identifier;
    }

    return this._id;
  }

  public set id(newId: string | undefined) {
    if (this._interior && this._interior.description) {
      this._interior.description.identifier = newId;
    }

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
    if (!this._data || !this._data.format_version) {
      return undefined;
    }

    return MinecraftUtilities.getVersionArrayFrom(this._data.format_version);
  }

  setBehaviorPackFormatVersion(versionStr: string) {
    this._ensureDataInitialized();

    if (this._data) {
      this._data.format_version = versionStr;
    }
  }

  _ensureDataInitialized() {
    if (this._data === undefined) {
      this._data = {};
    }
  }

  async addChildItems(project: Project, recipeItem: ProjectItem, index?: RelationsIndex) {
    const dependentItemIds: string[] = [];

    // Collect all item IDs that this recipe depends on. Ingredients can be a descriptor
    // object ({ "item": "..." }) or, in newer formats, a plain identifier string.
    if (this._interior) {
      const addIngredient = (ingredient: any) => {
        if (typeof ingredient === "string") {
          dependentItemIds.push(ingredient);
        } else if (ingredient && typeof ingredient.item === "string") {
          dependentItemIds.push(ingredient.item);
        }
      };

      const ingredientsArray = (this._interior as any).ingredients;

      // For shapeless recipes, collect ingredients
      if (ingredientsArray && Array.isArray(ingredientsArray)) {
        for (const ingredient of ingredientsArray) {
          addIngredient(ingredient);
        }
      }

      // For shaped recipes, collect key items
      if ("key" in this._interior && this._interior.key) {
        for (const keyItem of Object.values(this._interior.key)) {
          addIngredient(keyItem);
        }
      }
    }

    let blockTypeItems: ProjectItem[] | undefined;

    // Check each dependent item ID against project items
    for (const dependentItemId of new Set(dependentItemIds)) {
      let foundMatch = false;
      let isVanilla: boolean | undefined;

      // Use index for O(1) lookup when available. A block is also an item, so a custom block
      // can be a recipe ingredient.
      if (index) {
        let matchingItems = index.getItemsById(index.itemTypesById, dependentItemId);

        if (matchingItems.length === 0) {
          matchingItems = index.getItemsById(index.blockTypesById, dependentItemId);
        }

        for (const matchItem of matchingItems) {
          recipeItem.addChildItem(matchItem);
        }

        foundMatch = matchingItems.length > 0;
      } else {
        const itemTypeItems = project.getItemsByType(ProjectItemType.itemTypeBehavior);
        for (const candItem of itemTypeItems) {
          if (!candItem.isContentLoaded) {
            await candItem.loadContent();
          }

          if (candItem.primaryFile) {
            const itd = await ItemTypeDefinition.ensureOnFile(candItem.primaryFile);

            if (itd && itd.id === dependentItemId) {
              recipeItem.addChildItem(candItem);
              foundMatch = true;
              break;
            }
          }
        }

        if (!foundMatch) {
          isVanilla = await Database.isVanillaItemOrBlock(dependentItemId);
        }

        // A block is also an item, so scan custom blocks for unresolved, non-vanilla ingredients.
        if (!foundMatch && !isVanilla) {
          if (!blockTypeItems) {
            blockTypeItems = project.getItemsByType(ProjectItemType.blockTypeBehavior);
          }

          for (const candItem of blockTypeItems) {
            if (!candItem.isContentLoaded) {
              await candItem.loadContent();
            }

            if (candItem.primaryFile) {
              const btd = await BlockTypeDefinition.ensureOnFile(candItem.primaryFile);

              if (btd && btd.id === dependentItemId) {
                recipeItem.addChildItem(candItem);
                foundMatch = true;
                break;
              }
            }
          }
        }
      }

      // Vanilla items and blocks are expected in recipes, so only unknown IDs are reported.
      if (!foundMatch && !(isVanilla ?? (await Database.isVanillaItemOrBlock(dependentItemId)))) {
        recipeItem.addUnfulfilledRelationship(dependentItemId, ProjectItemType.itemTypeBehavior, false);
      }
    }
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<RecipeBehaviorDefinition, RecipeBehaviorDefinition>
  ) {
    let rbd: RecipeBehaviorDefinition | undefined;

    if (file.manager === undefined) {
      rbd = new RecipeBehaviorDefinition();

      rbd.file = file;

      file.manager = rbd;
    }

    if (file.manager !== undefined && file.manager instanceof RecipeBehaviorDefinition) {
      rbd = file.manager as RecipeBehaviorDefinition;

      if (!rbd.isLoaded) {
        if (loadHandler) {
          rbd.onLoaded.subscribe(loadHandler);
        }

        await rbd.load();
      }
    }

    return rbd;
  }

  persist(): boolean {
    if (this._file === undefined) {
      return false;
    }

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
    this.data = preserveComments
      ? StorageUtilities.getJsonObjectWithComments(this._file)
      : StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
    this._loadedWithComments = preserveComments;
    this._onLoaded.dispatch(this, this);
  }
}

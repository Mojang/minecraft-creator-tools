// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import "../app/CreatorToolsHost";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import RelationsIndex from "../app/RelationsIndex";
import Database from "./Database";
import RecipeBehaviorDefinition from "./RecipeBehaviorDefinition";
import ContentIndex, { AnnotationCategory } from "../core/ContentIndex";

describe("RecipeBehaviorDefinition.addChildItems", () => {
  it("resolves a custom block ingredient through the index without scanning project items", async () => {
    const recipe = new RecipeBehaviorDefinition();
    recipe.data = {
      format_version: "1.21.0",
      "minecraft:recipe_shapeless": {
        description: { identifier: "demo:recipe" },
        tags: ["crafting_table"],
        ingredients: [{ item: "demo:ore" }, "demo:ore"],
        result: { item: "demo:ingot" },
      },
    } as any;

    const blockItem = {} as ProjectItem;
    const index = new RelationsIndex();
    index.blockTypesById.set("demo:ore", [blockItem]);

    const children: ProjectItem[] = [];
    const unfulfilled: string[] = [];
    const recipeItem = {
      addChildItem: (item: ProjectItem) => children.push(item),
      addUnfulfilledRelationship: (id: string) => unfulfilled.push(id),
    } as unknown as ProjectItem;

    const project = {
      getItemsByType: () => {
        throw new Error("project items should not be scanned when an index is supplied");
      },
    } as unknown as Project;

    await recipe.addChildItems(project, recipeItem, index);

    expect(children).to.deep.equal([blockItem]);
    expect(unfulfilled).to.deep.equal([]);
  });

  it("accepts exact vanilla item and block IDs but reports other vanilla IDs and prefixes", async () => {
    const recipe = new RecipeBehaviorDefinition();
    recipe.data = {
      format_version: "1.21.0",
      "minecraft:recipe_shapeless": {
        description: { identifier: "demo:recipe" },
        tags: ["crafting_table"],
        ingredients: [
          { item: "minecraft:ender_pearl" },
          { item: "minecraft:log2" },
          { item: "minecraft:iron_ingot" },
          { item: "minecraft:iron" },
          { item: "minecraft:acacia_planks_from_stripped" },
          { item: "minecraft:zombie" },
        ],
        result: { item: "demo:ingot" },
      },
    } as any;

    const unfulfilled: string[] = [];
    const recipeItem = {
      addChildItem: () => {},
      addUnfulfilledRelationship: (id: string) => unfulfilled.push(id),
    } as unknown as ProjectItem;

    const vanillaIndex = new ContentIndex();
    vanillaIndex.insert("minecraft:iron_ingot", "/items/iron_ingot.json", AnnotationCategory.itemTypeSource);
    vanillaIndex.insert("minecraft:log2", "/resource_pack/blocks.json", AnnotationCategory.blockTypeSource);
    vanillaIndex.insert("minecraft:acacia_planks_from_stripped", "/recipes/a.json", AnnotationCategory.recipeSource);
    vanillaIndex.insert("minecraft:zombie", "/entities/zombie.json", AnnotationCategory.entityTypeSource);

    const savedItemIds = Database.vanillaItemIds;
    const savedIndex = Database.vanillaContentIndex;
    Database.vanillaItemIds = new Set(["minecraft:ender_pearl"]);
    Database.vanillaContentIndex = vanillaIndex;

    try {
      await recipe.addChildItems({} as Project, recipeItem, new RelationsIndex());
    } finally {
      Database.vanillaItemIds = savedItemIds;
      Database.vanillaContentIndex = savedIndex;
    }

    expect(unfulfilled).to.deep.equal(["minecraft:iron", "minecraft:acacia_planks_from_stripped", "minecraft:zombie"]);
  });
});

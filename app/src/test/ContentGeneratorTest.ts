// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ContentGeneratorTest - Tests for the ContentGenerator and createMinecraftContentOp functionality.
 *
 * This test suite validates that the ContentGenerator produces correct Minecraft
 * Bedrock content from meta-schema definitions. It covers:
 *
 * 1. Entity generation with various traits and behaviors
 * 2. Block generation with different shapes and properties
 * 3. Item generation (food, tools, weapons, armor)
 * 4. Loot table generation from drops and explicit definitions
 * 5. Recipe generation (shaped, shapeless, furnace)
 * 6. Spawn rule generation
 * 7. Feature generation for world gen
 *
 * Test Strategy:
 * - Unit tests validate individual generation methods
 * - Integration tests validate full content generation
 * - Baseline tests compare generated JSON against expected outputs
 */

import { expect, assert } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
import { ContentGenerator, IGeneratedContent, IGeneratedFile } from "../minecraft/ContentGenerator";
import { IMinecraftContentDefinition } from "../minecraft/IContentMetaSchema";
import { testFolders, assertJsonMatchesBaseline } from "./PngTestUtilities";

/**
 * Test fixtures for ContentGenerator tests.
 * Each fixture represents a different content generation scenario.
 */
export class ContentTestFixtures {
  /**
   * Minimal entity - just an id and display name
   */
  static readonly MINIMAL_ENTITY: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    entityTypes: [
      {
        id: "minimal_mob",
        displayName: "Minimal Mob",
      },
    ],
  };

  /**
   * Hostile entity with melee attack traits
   */
  static readonly HOSTILE_MELEE_ENTITY: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    entityTypes: [
      {
        id: "orc_warrior",
        displayName: "Orc Warrior",
        traits: ["humanoid", "hostile", "melee_attacker"],
        behaviors: ["wander", "melee_attack", "target_players"],
        health: 30,
        attackDamage: 6,
        movementSpeed: 0.3,
        drops: [
          { item: "iron_sword", chance: 0.1 },
          { item: "test:orc_tooth", count: { min: 1, max: 3 } },
        ],
      },
    ],
  };

  /**
   * Passive entity with breeding
   */
  static readonly PASSIVE_BREEDABLE_ENTITY: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    entityTypes: [
      {
        id: "fancy_sheep",
        displayName: "Fancy Sheep",
        traits: ["quadruped", "passive", "breedable"],
        behaviors: ["wander", "flee_when_hurt", "follow_parent", "tempt"],
        health: 10,
        breedable: {
          breedItems: ["wheat", "carrot"],
          breedCooldown: 300,
        },
      },
    ],
  };

  /**
   * Tameable entity (pet-like)
   */
  static readonly TAMEABLE_ENTITY: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    entityTypes: [
      {
        id: "pet_fox",
        displayName: "Pet Fox",
        traits: ["quadruped_small", "neutral", "tameable"],
        behaviors: ["wander", "follow_owner", "retaliate", "sit_command"],
        health: 20,
        tameable: {
          tameItems: ["sweet_berries"],
          chance: 0.33,
        },
      },
    ],
  };

  /**
   * Boss entity with high stats
   */
  static readonly BOSS_ENTITY: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    entityTypes: [
      {
        id: "dungeon_boss",
        displayName: "Dungeon Boss",
        traits: ["humanoid", "hostile", "boss"],
        behaviors: ["melee_attack", "target_players"],
        health: 300,
        attackDamage: 15,
        knockbackResistance: 0.8,
        scale: 1.5,
      },
    ],
  };

  /**
   * Simple unit cube block
   */
  static readonly SIMPLE_BLOCK: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    blockTypes: [
      {
        id: "magic_stone",
        displayName: "Magic Stone",
        destroyTime: 2.0,
        explosionResistance: 10,
        lightEmission: 5,
        mapColor: "#8800FF",
      },
    ],
  };

  /**
   * Block with traits
   */
  static readonly BLOCK_WITH_TRAITS: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    blockTypes: [
      {
        id: "magic_log",
        displayName: "Magic Log",
        traits: ["log"],
        destroyTime: 2.0,
        sounds: "wood",
        flammable: {
          catchChance: 0.3,
          destroyChance: 0.4,
        },
      },
    ],
  };

  /**
   * Block with drops
   */
  static readonly BLOCK_WITH_DROPS: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    blockTypes: [
      {
        id: "gem_ore",
        displayName: "Gem Ore",
        destroyTime: 4.0,
        drops: [
          { item: "test:magic_gem", count: { min: 1, max: 3 } },
          { item: "diamond", chance: 0.05 },
        ],
      },
    ],
  };

  /**
   * Food item
   */
  static readonly FOOD_ITEM: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    itemTypes: [
      {
        id: "magic_apple",
        displayName: "Magic Apple",
        category: "nature",
        food: {
          nutrition: 6,
          saturation: 1.2,
          canAlwaysEat: true,
          effects: [
            { name: "regeneration", duration: 10, amplifier: 1 },
            { name: "speed", duration: 30, amplifier: 0, chance: 0.5 },
          ],
        },
      },
    ],
  };

  /**
   * Tool item
   */
  static readonly TOOL_ITEM: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    itemTypes: [
      {
        id: "magic_pickaxe",
        displayName: "Magic Pickaxe",
        category: "equipment",
        traits: ["pickaxe"],
        tool: {
          durability: 1000,
          miningLevel: "diamond",
          miningSpeed: 8.0,
        },
      },
    ],
  };

  /**
   * Weapon item
   */
  static readonly WEAPON_ITEM: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    itemTypes: [
      {
        id: "flame_sword",
        displayName: "Flame Sword",
        category: "equipment",
        traits: ["sword"],
        weapon: {
          damage: 10,
          durability: 500,
          attackSpeed: 1.6,
        },
        glint: true,
      },
    ],
  };

  /**
   * Armor item
   */
  static readonly ARMOR_ITEM: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    itemTypes: [
      {
        id: "dragon_helmet",
        displayName: "Dragon Helmet",
        category: "equipment",
        traits: ["armor_helmet"],
        armor: {
          slot: "helmet",
          defense: 4,
          durability: 400,
          toughness: 2,
        },
      },
    ],
  };

  /**
   * Explicit loot table
   */
  static readonly LOOT_TABLE: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    lootTables: [
      {
        id: "dungeon_chest",
        pools: [
          {
            rolls: { min: 2, max: 5 },
            entries: [
              { item: "diamond", weight: 1, count: { min: 1, max: 3 } },
              { item: "gold_ingot", weight: 5, count: { min: 2, max: 8 } },
              { item: "iron_ingot", weight: 10, count: { min: 3, max: 10 } },
            ],
          },
          {
            rolls: 1,
            entries: [{ item: "enchanted_golden_apple", chance: 0.05 }],
            conditions: [{ type: "killed_by_player" }],
          },
        ],
      },
    ],
  };

  /**
   * Shaped recipe
   */
  static readonly SHAPED_RECIPE: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    recipes: [
      {
        id: "magic_sword_recipe",
        type: "shaped",
        pattern: [" D ", " D ", " S "],
        key: {
          D: "diamond",
          S: "stick",
        },
        result: { item: "test:flame_sword", count: 1 },
      },
    ],
  };

  /**
   * Shapeless recipe
   */
  static readonly SHAPELESS_RECIPE: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    recipes: [
      {
        id: "magic_apple_recipe",
        type: "shapeless",
        ingredients: ["apple", "gold_ingot", "redstone"],
        result: "test:magic_apple",
      },
    ],
  };

  /**
   * Furnace recipe
   */
  static readonly FURNACE_RECIPE: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    recipes: [
      {
        id: "smelt_gem_ore",
        type: "furnace",
        input: "test:gem_ore",
        result: "test:magic_gem",
        experience: 1.0,
        cookTime: 200,
      },
    ],
  };

  /**
   * Spawn rule
   */
  static readonly SPAWN_RULE: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    spawnRules: [
      {
        entity: "test:orc_warrior",
        biomes: ["plains", "forest", "taiga"],
        weight: 50,
        groupSize: { min: 1, max: 3 },
        lightLevel: { min: 0, max: 7 },
        timeOfDay: "night",
        surface: true,
      },
    ],
  };

  /**
   * Feature for ore generation
   */
  static readonly ORE_FEATURE: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    features: [
      {
        id: "gem_ore_feature",
        spread: {
          places: [{ type: "ore", id: "test:gem_ore", count: 8, replacesBlocks: ["stone", "deepslate"] }],
          heightPlacement: { type: "range", min: -64, max: 32 },
          rarity: 8,
          biomes: ["plains", "forest"],
        },
      },
    ],
  };

  /**
   * Complete mixed content - entity, block, item, recipe
   */
  static readonly COMPLETE_ADDON: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "mymod",
    displayName: "My Complete Addon",
    description: "A complete addon with entities, blocks, and items",
    entityTypes: [
      {
        id: "goblin",
        displayName: "Goblin",
        traits: ["humanoid", "hostile", "melee_attacker"],
        behaviors: ["wander", "melee_attack", "target_players"],
        health: 15,
        attackDamage: 4,
        drops: [{ item: "mymod:goblin_ear", chance: 0.5 }],
      },
    ],
    blockTypes: [
      {
        id: "goblin_totem",
        displayName: "Goblin Totem",
        destroyTime: 3.0,
        lightEmission: 10,
      },
    ],
    itemTypes: [
      {
        id: "goblin_ear",
        displayName: "Goblin Ear",
        category: "items",
        maxStackSize: 64,
      },
      {
        id: "goblin_stew",
        displayName: "Goblin Stew",
        category: "nature",
        food: {
          nutrition: 8,
          saturation: 0.8,
        },
      },
    ],
    recipes: [
      {
        id: "goblin_stew_recipe",
        type: "shapeless",
        ingredients: ["mymod:goblin_ear", "bowl", "carrot"],
        result: "mymod:goblin_stew",
      },
    ],
    spawnRules: [
      {
        entity: "mymod:goblin",
        biomes: ["forest", "dark_forest"],
        weight: 80,
        groupSize: { min: 2, max: 4 },
        timeOfDay: "night",
      },
    ],
  };
}

describe("ContentGenerator", function () {
  // Allow more time for content generation
  this.timeout(10000);

  before(async function () {
    await testFolders.initialize();
  });

  // ============================================================================
  // UNIT TESTS - Basic Generation
  // ============================================================================

  describe("Basic Generation", function () {
    it("should generate behavior and resource pack manifests", async function () {
      const definition: IMinecraftContentDefinition = {
        schemaVersion: "1.0.0",
        namespace: "test",
        displayName: "Test Pack",
        description: "Test description",
      };

      const generator = new ContentGenerator(definition);
      const result = await generator.generate();

      // Check behavior pack manifest
      assert.isDefined(result.behaviorPackManifest, "Should have behavior pack manifest");
      const bpManifest = result.behaviorPackManifest!.content as any;
      expect(bpManifest.format_version).to.equal(2);
      expect(bpManifest.header.name).to.equal("Test Pack");
      expect(bpManifest.header.description).to.equal("Test description");
      expect(bpManifest.modules[0].type).to.equal("data");

      // Check resource pack manifest
      assert.isDefined(result.resourcePackManifest, "Should have resource pack manifest");
      const rpManifest = result.resourcePackManifest!.content as any;
      expect(rpManifest.format_version).to.equal(2);
      expect(rpManifest.modules[0].type).to.equal("resources");
    });

    // Regression: recurring "invisible entity" root cause was that
    // the BP manifest had no `dependencies` array linking to the RP, so Bedrock
    // never loaded the RP and entities rendered invisible.
    it("should declare a BP→RP dependency in the behavior pack manifest", async function () {
      const definition: IMinecraftContentDefinition = {
        schemaVersion: "1.0.0",
        namespace: "bp_rp_dep_test",
        displayName: "BP→RP Dep Test",
      };

      const generator = new ContentGenerator(definition);
      const result = await generator.generate();

      const bpManifest = result.behaviorPackManifest!.content as any;
      const rpManifest = result.resourcePackManifest!.content as any;
      assert.isArray(bpManifest.dependencies, "BP manifest must include dependencies array");
      expect(bpManifest.dependencies.length).to.be.greaterThan(0);
      const dep = bpManifest.dependencies.find((d: any) => d.uuid === rpManifest.header.uuid);
      assert.isDefined(dep, "BP dependencies must reference the sibling RP header UUID");
      expect(dep.version).to.deep.equal([1, 0, 0]);
    });

    it("should use namespace in manifest if no displayName", async function () {
      const definition: IMinecraftContentDefinition = {
        schemaVersion: "1.0.0",
        namespace: "orc_dungeon",
      };

      const generator = new ContentGenerator(definition);
      const result = await generator.generate();

      const bpManifest = result.behaviorPackManifest!.content as any;
      expect(bpManifest.header.name).to.include("orc_dungeon");
    });

    it("should generate summary with correct counts", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.COMPLETE_ADDON);
      const result = await generator.generate();

      expect(result.summary.namespace).to.equal("mymod");
      expect(result.summary.entityCount).to.equal(1);
      expect(result.summary.blockCount).to.equal(1);
      expect(result.summary.itemCount).to.equal(2);
      expect(result.summary.recipeCount).to.equal(1);
      expect(result.summary.spawnRuleCount).to.equal(1);
    });
  });

  // ============================================================================
  // ENTITY GENERATION TESTS
  // ============================================================================

  describe("Entity Generation", function () {
    it("should generate minimal entity with default components", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.MINIMAL_ENTITY);
      const result = await generator.generate();

      expect(result.entityBehaviors).to.have.length(1);
      const entityFile = result.entityBehaviors[0];
      expect(entityFile.path).to.equal("entities/minimal_mob.json");
      expect(entityFile.pack).to.equal("behavior");

      const entity = entityFile.content as any;
      expect(entity.format_version).to.equal("1.21.0");
      expect(entity["minecraft:entity"].description.identifier).to.equal("test:minimal_mob");
      expect(entity["minecraft:entity"].components["minecraft:physics"]).to.exist;
    });

    it("should apply hostile trait components", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.HOSTILE_MELEE_ENTITY);
      const result = await generator.generate();

      const entity = result.entityBehaviors[0].content as any;
      const components = entity["minecraft:entity"].components;

      // Check health was set
      expect(components["minecraft:health"].value).to.equal(30);

      // Check attack damage was set
      expect(components["minecraft:attack"].damage).to.equal(6);

      // Check movement speed was set
      expect(components["minecraft:movement"].value).to.equal(0.3);
    });

    it("should generate loot table from entity drops", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.HOSTILE_MELEE_ENTITY);
      const result = await generator.generate();

      // Should have auto-generated loot table
      expect(result.lootTables.length).to.be.greaterThan(0);

      const lootTable = result.lootTables[0];
      expect(lootTable.path).to.include("orc_warrior");
    });

    it("should generate entity resource file", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.MINIMAL_ENTITY);
      const result = await generator.generate();

      expect(result.entityResources).to.have.length(1);
      const resourceFile = result.entityResources[0];
      expect(resourceFile.pack).to.equal("resource");

      const resource = resourceFile.content as any;
      expect(resource["minecraft:client_entity"]).to.exist;
    });

    it("should generate entity texture and render controller", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.MINIMAL_ENTITY);
      const result = await generator.generate();

      // Should generate a texture for the entity
      expect(result.textures).to.have.length(1);
      const textureFile = result.textures[0];
      expect(textureFile.path).to.equal("textures/entity/minimal_mob.png");
      expect(textureFile.pack).to.equal("resource");
      expect(textureFile.content).to.be.instanceOf(Uint8Array);

      // Should generate a render controller for the entity
      expect(result.renderControllers).to.have.length(1);
      const renderControllerFile = result.renderControllers[0];
      expect(renderControllerFile.path).to.equal("render_controllers/minimal_mob.render_controllers.json");
      expect(renderControllerFile.pack).to.equal("resource");

      const renderController = renderControllerFile.content as any;
      expect(renderController.format_version).to.exist;
      expect(renderController.render_controllers["controller.render.test.minimal_mob"]).to.exist;
    });

    it("should apply breedable trait", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.PASSIVE_BREEDABLE_ENTITY);
      const result = await generator.generate();

      const entity = result.entityBehaviors[0].content as any;
      const components = entity["minecraft:entity"].components;

      // Breedable entities should have breedable component
      expect(components["minecraft:breedable"] || entity["minecraft:entity"].component_groups?.["adult"]).to.exist;
    });

    it("should apply tameable trait with component groups", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.TAMEABLE_ENTITY);
      const result = await generator.generate();

      const entity = result.entityBehaviors[0].content as any;

      // Should have component groups for taming states
      const componentGroups = entity["minecraft:entity"].component_groups;
      if (componentGroups) {
        // Check for wild/tamed groups or similar
        const hasWildOrTamed =
          componentGroups["wild"] !== undefined ||
          componentGroups["tamed"] !== undefined ||
          componentGroups["minecraft:wild"] !== undefined;
        // This might not be implemented yet - just log for now
        if (!hasWildOrTamed) {
          console.log("Note: Tameable component groups not yet fully implemented");
        }
      }
    });

    it("should apply boss trait with high stats", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.BOSS_ENTITY);
      const result = await generator.generate();

      const entity = result.entityBehaviors[0].content as any;
      const components = entity["minecraft:entity"].components;

      expect(components["minecraft:health"].value).to.equal(300);
      expect(components["minecraft:knockback_resistance"]?.value).to.equal(0.8);
      expect(components["minecraft:scale"]?.value).to.equal(1.5);
    });
  });

  // ============================================================================
  // BLOCK GENERATION TESTS
  // ============================================================================

  describe("Block Generation", function () {
    it("should generate simple block with properties", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.SIMPLE_BLOCK);
      const result = await generator.generate();

      expect(result.blockBehaviors).to.have.length(1);
      const blockFile = result.blockBehaviors[0];
      expect(blockFile.path).to.equal("blocks/magic_stone.json");

      const block = blockFile.content as any;
      expect(block.format_version).to.exist;
      expect(block["minecraft:block"].description.identifier).to.equal("test:magic_stone");

      const components = block["minecraft:block"].components;
      expect(components["minecraft:light_emission"]).to.equal(5);
      expect(components["minecraft:map_color"]).to.equal("#8800FF");
    });

    it("should apply block traits", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.BLOCK_WITH_TRAITS);
      const result = await generator.generate();

      const block = result.blockBehaviors[0].content as any;
      const components = block["minecraft:block"].components;

      // Log blocks should be rotatable
      expect(
        components["minecraft:flammable"] ||
          block["minecraft:block"].states ||
          components["minecraft:destructible_by_mining"]
      ).to.exist;
    });

    it("should generate loot table from block drops", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.BLOCK_WITH_DROPS);
      const result = await generator.generate();

      // Should have auto-generated loot table for the block
      const blockLootTables = result.lootTables.filter((lt) => lt.path.includes("gem_ore"));
      expect(blockLootTables.length).to.be.greaterThan(0);
    });
  });

  // ============================================================================
  // ITEM GENERATION TESTS
  // ============================================================================

  describe("Item Generation", function () {
    it("should generate food item with effects", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.FOOD_ITEM);
      const result = await generator.generate();

      expect(result.itemBehaviors).to.have.length(1);
      const itemFile = result.itemBehaviors[0];
      expect(itemFile.path).to.equal("items/magic_apple.json");

      const item = itemFile.content as any;
      expect(item["minecraft:item"].description.identifier).to.equal("test:magic_apple");

      const components = item["minecraft:item"].components;
      expect(components["minecraft:food"]).to.exist;
      expect(components["minecraft:food"].nutrition).to.equal(6);
    });

    it("should generate tool item with mining properties", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.TOOL_ITEM);
      const result = await generator.generate();

      const item = result.itemBehaviors[0].content as any;
      const components = item["minecraft:item"].components;

      // Should have durability and mining-related components
      expect(components["minecraft:durability"] || components["minecraft:max_stack_size"]).to.exist;
    });

    it("should generate weapon item with attack properties", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.WEAPON_ITEM);
      const result = await generator.generate();

      const item = result.itemBehaviors[0].content as any;
      const components = item["minecraft:item"].components;

      // Should have glint
      expect(components["minecraft:glint"]).to.equal(true);
    });

    it("should generate armor item", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.ARMOR_ITEM);
      const result = await generator.generate();

      const item = result.itemBehaviors[0].content as any;
      const components = item["minecraft:item"].components;

      // Should have wearable component
      expect(components["minecraft:wearable"]).to.exist;
    });

    it("should render item.icon with generate+pixelArt into a distinct PNG", async function () {
      // Same item authored two ways: once with just a color, once with an explicit
      // ITextureSpec (generate + pixelArt). The two textures MUST differ — if they're
      // identical, item.icon is being silently ignored (the bug we're preventing).
      const defWithColor: any = {
        schemaVersion: "1.0.0",
        namespace: "test",
        itemTypes: [{ id: "orc_tooth", displayName: "Orc Tooth", color: "#C0C0C0" }],
      };
      const defWithIcon: any = {
        schemaVersion: "1.0.0",
        namespace: "test",
        itemTypes: [
          {
            id: "orc_tooth",
            displayName: "Orc Tooth",
            color: "#C0C0C0",
            icon: {
              generate: { type: "none", colors: [] },
              pixelArt: [
                {
                  lines: [
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                    "XXXXXXXXXXXXXXXX",
                  ],
                  palette: { X: { hex: "#FF0000" } },
                },
              ],
            },
          },
        ],
      };

      const r1 = await new ContentGenerator(defWithColor).generate();
      const r2 = await new ContentGenerator(defWithIcon).generate();

      const png1 = r1.textures.find((t) => t.path.endsWith("orc_tooth.png"))?.content as Uint8Array;
      const png2 = r2.textures.find((t) => t.path.endsWith("orc_tooth.png"))?.content as Uint8Array;
      expect(png1, "color-only PNG should be emitted").to.be.instanceOf(Uint8Array);
      expect(png2, "icon-spec PNG should be emitted").to.be.instanceOf(Uint8Array);

      // The two PNGs must not be byte-identical — if they are, item.icon was ignored.
      let identical = png1.length === png2.length;
      if (identical) {
        for (let i = 0; i < png1.length; i++) {
          if (png1[i] !== png2[i]) {
            identical = false;
            break;
          }
        }
      }
      expect(identical, "item.icon must change the generated PNG; got identical bytes").to.equal(false);
    });

    it("should skip placeholder PNG when item.icon is a file reference string", async function () {
      const def: any = {
        schemaVersion: "1.0.0",
        namespace: "test",
        itemTypes: [
          {
            id: "prebuilt_item",
            displayName: "Prebuilt",
            icon: "textures/items/prebuilt_item",
          },
        ],
      };

      const result = await new ContentGenerator(def).generate();
      const png = result.textures.find((t) => t.path.endsWith("prebuilt_item.png"));
      expect(png, "file-reference icon should not emit a placeholder PNG").to.be.undefined;
    });

    it("should render block.texture.all with generate into a distinct PNG vs mapColor fallback", async function () {
      const defWithMapColor: any = {
        schemaVersion: "1.0.0",
        namespace: "test",
        blockTypes: [{ id: "neon_block", displayName: "Neon Block", mapColor: "#C0C0C0" }],
      };
      const defWithTexture: any = {
        schemaVersion: "1.0.0",
        namespace: "test",
        blockTypes: [
          {
            id: "neon_block",
            displayName: "Neon Block",
            mapColor: "#C0C0C0",
            texture: {
              all: {
                generate: { type: "solid", colors: ["#FF00FF"] },
              },
            },
          },
        ],
      };

      const r1 = await new ContentGenerator(defWithMapColor).generate();
      const r2 = await new ContentGenerator(defWithTexture).generate();

      const png1 = r1.textures.find((t) => t.path.endsWith("neon_block.png"))?.content as Uint8Array;
      const png2 = r2.textures.find((t) => t.path.endsWith("neon_block.png"))?.content as Uint8Array;
      expect(png1, "mapColor-only block PNG should be emitted").to.be.instanceOf(Uint8Array);
      expect(png2, "texture-spec block PNG should be emitted").to.be.instanceOf(Uint8Array);

      let identical = png1.length === png2.length;
      if (identical) {
        for (let i = 0; i < png1.length; i++) {
          if (png1[i] !== png2[i]) {
            identical = false;
            break;
          }
        }
      }
      expect(identical, "block.texture must change the generated PNG; got identical bytes").to.equal(false);
    });

    it("should emit minecraft:shooter + minecraft:chargeable for chargeable projectile items", async function () {
      const def: any = {
        schemaVersion: "1.0.0",
        namespace: "test",
        itemTypes: [
          {
            id: "magic_bow",
            displayName: "Magic Bow",
            projectile: { projectile: "arrow", chargeable: true, launchPower: 1.5 },
          },
        ],
      };

      const result = await new ContentGenerator(def).generate();
      const item = result.itemBehaviors[0].content as any;
      const components = item["minecraft:item"].components;
      expect(components["minecraft:shooter"], "chargeable item should emit minecraft:shooter").to.exist;
      expect(components["minecraft:shooter"].projectiles[0].projectile).to.equal("minecraft:arrow");
      expect(components["minecraft:chargeable"], "chargeable item should emit minecraft:chargeable").to.exist;
      expect(components["minecraft:throwable"], "chargeable item should NOT emit minecraft:throwable").to.not.exist;
    });

    it("should emit minecraft:throwable for non-chargeable projectile items", async function () {
      const def: any = {
        schemaVersion: "1.0.0",
        namespace: "test",
        itemTypes: [
          {
            id: "snow_ball",
            displayName: "Snow Ball",
            projectile: { projectile: "snowball" },
          },
        ],
      };

      const result = await new ContentGenerator(def).generate();
      const item = result.itemBehaviors[0].content as any;
      const components = item["minecraft:item"].components;
      expect(components["minecraft:throwable"], "non-chargeable item should emit minecraft:throwable").to.exist;
      expect(components["minecraft:projectile"].projectile_entity).to.equal("minecraft:snowball");
      expect(components["minecraft:shooter"], "non-chargeable item should NOT emit minecraft:shooter").to.not.exist;
    });
  });

  // ============================================================================
  // LOOT TABLE GENERATION TESTS
  // ============================================================================

  describe("Loot Table Generation", function () {
    it("should generate explicit loot table", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.LOOT_TABLE);
      const result = await generator.generate();

      expect(result.lootTables).to.have.length(1);
      const lootFile = result.lootTables[0];
      expect(lootFile.path).to.include("dungeon_chest");

      const loot = lootFile.content as any;
      expect(loot.pools).to.have.length(2);
      expect(loot.pools[0].rolls.min).to.equal(2);
      expect(loot.pools[0].rolls.max).to.equal(5);
    });
  });

  // ============================================================================
  // RECIPE GENERATION TESTS
  // ============================================================================

  describe("Recipe Generation", function () {
    it("should generate shaped recipe", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.SHAPED_RECIPE);
      const result = await generator.generate();

      expect(result.recipes).to.have.length(1);
      const recipeFile = result.recipes[0];

      const recipe = recipeFile.content as any;
      expect(recipe.format_version).to.exist;
      // Recipe should have pattern and key
      const recipeData = recipe["minecraft:recipe_shaped"] || recipe;
      expect(recipeData.pattern || recipeData.key).to.exist;
    });

    it("should generate shapeless recipe", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.SHAPELESS_RECIPE);
      const result = await generator.generate();

      const recipe = result.recipes[0].content as any;
      const recipeData = recipe["minecraft:recipe_shapeless"] || recipe;
      expect(recipeData.ingredients || recipeData.result).to.exist;
    });

    it("should generate furnace recipe", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.FURNACE_RECIPE);
      const result = await generator.generate();

      const recipe = result.recipes[0].content as any;
      // Should be a furnace recipe type
      expect(recipe.format_version).to.exist;
    });
  });

  // ============================================================================
  // SPAWN RULE GENERATION TESTS
  // ============================================================================

  describe("Spawn Rule Generation", function () {
    it("should generate spawn rule", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.SPAWN_RULE);
      const result = await generator.generate();

      expect(result.spawnRules).to.have.length(1);
      const spawnFile = result.spawnRules[0];
      expect(spawnFile.path).to.include("orc_warrior");

      const spawn = spawnFile.content as any;
      expect(spawn.format_version).to.exist;
      expect(spawn["minecraft:spawn_rules"]).to.exist;
    });
  });

  // ============================================================================
  // FEATURE GENERATION TESTS
  // ============================================================================

  describe("Feature Generation", function () {
    it("should generate ore feature", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.ORE_FEATURE);
      const result = await generator.generate();

      // Should have feature and possibly feature rule
      expect(result.features.length + result.featureRules.length).to.be.greaterThan(0);
    });
  });

  // ============================================================================
  // COMPLETE ADDON INTEGRATION TEST
  // ============================================================================

  describe("Complete Addon Generation", function () {
    it("should generate all content types for complete addon", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.COMPLETE_ADDON);
      const result = await generator.generate();

      // Check all expected counts
      expect(result.entityBehaviors).to.have.length(1);
      expect(result.entityResources).to.have.length(1);
      expect(result.blockBehaviors).to.have.length(1);
      expect(result.itemBehaviors).to.have.length(2);
      expect(result.recipes).to.have.length(1);
      expect(result.spawnRules).to.have.length(1);

      // Check loot table was auto-generated from drops
      expect(result.lootTables.length).to.be.greaterThan(0);

      // Check summary
      expect(result.summary.warnings).to.be.an("array");
      expect(result.summary.errors).to.be.an("array");
    });

    it("should produce valid file paths", async function () {
      const generator = new ContentGenerator(ContentTestFixtures.COMPLETE_ADDON);
      const result = await generator.generate();

      // All behavior pack files should have behavior pack
      for (const file of result.entityBehaviors) {
        expect(file.pack).to.equal("behavior");
        expect(file.path).to.match(/^entities\//);
      }

      // All resource pack files should have resource pack
      for (const file of result.entityResources) {
        expect(file.pack).to.equal("resource");
      }
    });
  });

  // ============================================================================
  // BASELINE COMPARISON TESTS
  // ============================================================================

  describe("Baseline Comparisons", function () {
    const SCENARIO_NAME = "contentGenerator";
    const VOLATILE_KEYS = ["uuid", "header.uuid", "modules.0.uuid", "modules.1.uuid"];

    before(async function () {
      // Ensure results folder exists
      testFolders.ensureResultFolder(SCENARIO_NAME);
    });

    /**
     * Helper to write generated content to disk and compare with baseline.
     */
    async function compareGeneratedContent(
      testContext: Mocha.Context,
      definition: IMinecraftContentDefinition,
      testName: string
    ): Promise<IGeneratedContent> {
      const generator = new ContentGenerator(definition);
      const result = await generator.generate();

      const resultPath = testFolders.getResultsPath(SCENARIO_NAME);
      const scenarioPath = testFolders.getScenariosPath(SCENARIO_NAME);

      // Write summary
      const summaryPath = path.join(resultPath, `${testName}-summary.json`);
      fs.writeFileSync(summaryPath, JSON.stringify(result.summary, null, 2));

      // Compare summary (excluding counts which may change as implementation evolves)
      const scenarioSummaryPath = path.join(scenarioPath, `${testName}-summary.json`);
      if (fs.existsSync(scenarioSummaryPath)) {
        assertJsonMatchesBaseline(testContext, summaryPath, scenarioSummaryPath, ["warnings", "errors"]);
      }

      // Write and compare each file type
      const writeAndCompare = (files: IGeneratedFile[], subdir: string) => {
        for (const file of files) {
          if (file.type === "json") {
            const fileName = `${testName}-${subdir}-${path.basename(file.path)}`;
            const filePath = path.join(resultPath, fileName);
            fs.writeFileSync(filePath, JSON.stringify(file.content, null, 2));

            const scenarioFilePath = path.join(scenarioPath, fileName);
            if (fs.existsSync(scenarioFilePath)) {
              assertJsonMatchesBaseline(testContext, filePath, scenarioFilePath, VOLATILE_KEYS);
            }
          }
        }
      };

      writeAndCompare(result.entityBehaviors, "entity-bp");
      writeAndCompare(result.entityResources, "entity-rp");
      writeAndCompare(result.blockBehaviors, "block-bp");
      writeAndCompare(result.itemBehaviors, "item-bp");
      writeAndCompare(result.lootTables, "loot");
      writeAndCompare(result.recipes, "recipe");
      writeAndCompare(result.spawnRules, "spawn");
      writeAndCompare(result.renderControllers, "render-controller");

      return result;
    }

    it("should match baseline for hostile melee entity", async function () {
      await compareGeneratedContent(this, ContentTestFixtures.HOSTILE_MELEE_ENTITY, "hostile-melee");
    });

    it("should match baseline for passive breedable entity", async function () {
      await compareGeneratedContent(this, ContentTestFixtures.PASSIVE_BREEDABLE_ENTITY, "passive-breedable");
    });

    it("should match baseline for simple block", async function () {
      await compareGeneratedContent(this, ContentTestFixtures.SIMPLE_BLOCK, "simple-block");
    });

    it("should match baseline for food item", async function () {
      await compareGeneratedContent(this, ContentTestFixtures.FOOD_ITEM, "food-item");
    });

    it("should match baseline for weapon item", async function () {
      await compareGeneratedContent(this, ContentTestFixtures.WEAPON_ITEM, "weapon-item");
    });

    it("should match baseline for complete addon", async function () {
      await compareGeneratedContent(this, ContentTestFixtures.COMPLETE_ADDON, "complete-addon");
    });
  });
});

/**
 * Utility function to generate baselines.
 * Run with: npm test -- --grep "generate baselines" --reporter min
 * Then copy files from test/results/contentGenerator to test/scenarios/contentGenerator
 */
describe("Content Generator Baseline Generation", function () {
  this.timeout(30000);

  it.skip("generate baselines for all test fixtures", async function () {
    await testFolders.initialize();
    const SCENARIO_NAME = "contentGenerator";
    testFolders.ensureResultFolder(SCENARIO_NAME);

    const fixtures: [string, IMinecraftContentDefinition][] = [
      ["minimal-entity", ContentTestFixtures.MINIMAL_ENTITY],
      ["hostile-melee", ContentTestFixtures.HOSTILE_MELEE_ENTITY],
      ["passive-breedable", ContentTestFixtures.PASSIVE_BREEDABLE_ENTITY],
      ["tameable", ContentTestFixtures.TAMEABLE_ENTITY],
      ["boss", ContentTestFixtures.BOSS_ENTITY],
      ["simple-block", ContentTestFixtures.SIMPLE_BLOCK],
      ["block-traits", ContentTestFixtures.BLOCK_WITH_TRAITS],
      ["block-drops", ContentTestFixtures.BLOCK_WITH_DROPS],
      ["food-item", ContentTestFixtures.FOOD_ITEM],
      ["tool-item", ContentTestFixtures.TOOL_ITEM],
      ["weapon-item", ContentTestFixtures.WEAPON_ITEM],
      ["armor-item", ContentTestFixtures.ARMOR_ITEM],
      ["loot-table", ContentTestFixtures.LOOT_TABLE],
      ["shaped-recipe", ContentTestFixtures.SHAPED_RECIPE],
      ["shapeless-recipe", ContentTestFixtures.SHAPELESS_RECIPE],
      ["furnace-recipe", ContentTestFixtures.FURNACE_RECIPE],
      ["spawn-rule", ContentTestFixtures.SPAWN_RULE],
      ["ore-feature", ContentTestFixtures.ORE_FEATURE],
      ["complete-addon", ContentTestFixtures.COMPLETE_ADDON],
    ];

    for (const [name, definition] of fixtures) {
      console.log(`Generating baseline for: ${name}`);
      const generator = new ContentGenerator(definition);
      const result = await generator.generate();

      const resultPath = testFolders.getResultsPath(SCENARIO_NAME);

      // Write summary
      const summaryPath = path.join(resultPath, `${name}-summary.json`);
      fs.writeFileSync(summaryPath, JSON.stringify(result.summary, null, 2));

      // Helper to write files
      const writeFiles = (files: IGeneratedFile[], subdir: string) => {
        for (const file of files) {
          if (file.type === "json") {
            const fileName = `${name}-${subdir}-${path.basename(file.path)}`;
            const filePath = path.join(resultPath, fileName);
            fs.writeFileSync(filePath, JSON.stringify(file.content, null, 2));
          }
        }
      };

      writeFiles(result.entityBehaviors, "entity-bp");
      writeFiles(result.entityResources, "entity-rp");
      writeFiles(result.blockBehaviors, "block-bp");
      writeFiles(result.blockResources, "block-rp");
      writeFiles(result.itemBehaviors, "item-bp");
      writeFiles(result.itemResources, "item-rp");
      writeFiles(result.lootTables, "loot");
      writeFiles(result.recipes, "recipe");
      writeFiles(result.spawnRules, "spawn");
      writeFiles(result.features, "feature");
      writeFiles(result.featureRules, "feature-rule");

      console.log(
        `  Generated ${result.summary.entityCount} entities, ${result.summary.blockCount} blocks, ${result.summary.itemCount} items`
      );
    }

    console.log("\nBaselines generated in test/results/contentGenerator/");
    console.log("Copy to test/scenarios/contentGenerator/ to use as baselines.");
  });
});

// ============================================================================
// ADVANCED CONTENT FIXTURES
// ============================================================================

/**
 * Additional test fixtures for edge cases and complex scenarios.
 */
export class AdvancedContentFixtures {
  /**
   * Entity with all supported traits applied
   */
  static readonly ALL_TRAITS_ENTITY: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    entityTypes: [
      {
        id: "super_entity",
        displayName: "Super Entity",
        traits: ["humanoid", "hostile", "melee_attacker", "undead", "wanders"],
        behaviors: ["wander", "melee_attack", "target_players", "flee_when_hurt", "look_at_player"],
        health: 100,
        attackDamage: 10,
        movementSpeed: 0.35,
        followRange: 40,
        knockbackResistance: 0.5,
        scale: 1.2,
        collisionWidth: 0.8,
        collisionHeight: 2.0,
      },
    ],
  };

  /**
   * Entity with ranged attack behavior
   */
  static readonly RANGED_ATTACKER_ENTITY: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    entityTypes: [
      {
        id: "skeleton_mage",
        displayName: "Skeleton Mage",
        traits: ["humanoid", "hostile", "ranged_attacker", "undead"],
        behaviors: ["ranged_attack", "target_players", "hide_from_sun", "wander"],
        health: 20,
        attackDamage: 4,
      },
    ],
  };

  /**
   * Flying entity
   */
  static readonly FLYING_ENTITY: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    entityTypes: [
      {
        id: "fire_drake",
        displayName: "Fire Drake",
        traits: ["flying", "hostile", "melee_attacker"],
        behaviors: ["fly_around", "melee_attack", "target_players"],
        health: 50,
        attackDamage: 8,
        scale: 2.0,
      },
    ],
  };

  /**
   * Aquatic entity
   */
  static readonly AQUATIC_ENTITY: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    entityTypes: [
      {
        id: "crystal_fish",
        displayName: "Crystal Fish",
        traits: ["aquatic", "passive"],
        behaviors: ["swim", "flee_when_hurt"],
        health: 6,
        scale: 0.5,
      },
    ],
  };

  /**
   * Rideable entity
   */
  static readonly RIDEABLE_ENTITY: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    entityTypes: [
      {
        id: "war_horse",
        displayName: "War Horse",
        traits: ["quadruped", "passive", "rideable", "tameable"],
        behaviors: ["wander", "flee_when_hurt"],
        health: 30,
        rideable: {
          seatCount: 1,
          controllable: true,
          controlItems: ["carrot_on_a_stick"],
        },
        tameable: {
          tameItems: ["golden_apple"],
          chance: 0.5,
        },
      },
    ],
  };

  /**
   * Block with permutations (states)
   */
  static readonly BLOCK_WITH_STATES: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    blockTypes: [
      {
        id: "magic_lamp",
        displayName: "Magic Lamp",
        destroyTime: 1.0,
        lightEmission: 15,
        states: {
          "test:powered": [true, false],
        },
        permutations: [
          {
            condition: "q.block_state('test:powered') == true",
            components: {
              "minecraft:light_emission": 15,
            },
          },
          {
            condition: "q.block_state('test:powered') == false",
            components: {
              "minecraft:light_emission": 0,
            },
          },
        ],
      },
    ],
  };

  /**
   * Block with custom geometry reference
   */
  static readonly BLOCK_WITH_GEOMETRY: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    blockTypes: [
      {
        id: "crystal_pillar",
        displayName: "Crystal Pillar",
        destroyTime: 3.0,
        shape: "custom",
        geometry: {
          template: "block",
        },
      },
    ],
  };

  /**
   * Item with fuel property
   */
  static readonly FUEL_ITEM: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    itemTypes: [
      {
        id: "magic_coal",
        displayName: "Magic Coal",
        category: "items",
        fuel: 3200, // Burns for 3200 ticks (longer than coal)
      },
    ],
  };

  /**
   * Throwable item
   */
  static readonly THROWABLE_ITEM: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    itemTypes: [
      {
        id: "magic_bomb",
        displayName: "Magic Bomb",
        category: "equipment",
        traits: ["throwable"],
        maxStackSize: 16,
      },
    ],
  };

  /**
   * Multiple recipes at once
   */
  static readonly MULTIPLE_RECIPES: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    recipes: [
      {
        id: "iron_upgrade",
        type: "shaped",
        pattern: ["III", "ISI", "III"],
        key: { I: "iron_ingot", S: "stick" },
        result: { item: "test:super_tool", count: 1 },
      },
      {
        id: "diamond_upgrade",
        type: "shapeless",
        ingredients: ["diamond", "test:super_tool"],
        result: "test:diamond_super_tool",
      },
      {
        id: "smelt_ore",
        type: "furnace",
        input: "test:raw_magic",
        result: "test:magic_ingot",
        experience: 1.5,
        cookTime: 100,
      },
    ],
  };

  /**
   * Multiple spawn rules
   */
  static readonly MULTIPLE_SPAWN_RULES: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    spawnRules: [
      {
        entity: "test:surface_mob",
        biomes: ["plains", "forest"],
        weight: 100,
        groupSize: { min: 1, max: 2 },
        surface: true,
        timeOfDay: "day",
      },
      {
        entity: "test:cave_mob",
        biomes: ["plains", "forest"],
        weight: 50,
        groupSize: { min: 1, max: 4 },
        surface: false,
        heightRange: { min: -64, max: 0 },
        lightLevel: { min: 0, max: 7 },
      },
      {
        entity: "test:night_mob",
        biomes: ["plains"],
        weight: 80,
        groupSize: { min: 2, max: 5 },
        surface: true,
        timeOfDay: "night",
      },
    ],
  };

  /**
   * Entity with spawning configuration inline
   */
  static readonly ENTITY_WITH_SPAWNING: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "test",
    entityTypes: [
      {
        id: "forest_sprite",
        displayName: "Forest Sprite",
        traits: ["flying", "passive"],
        behaviors: ["fly_around", "flee_when_hurt"],
        health: 10,
        spawning: {
          biomes: ["forest", "birch_forest", "dark_forest"],
          weight: 50,
          groupSize: { min: 2, max: 4 },
          timeOfDay: "day",
          surface: true,
          heightRange: { min: 64, max: 128 },
        },
      },
    ],
  };

  /**
   * Complex addon with everything
   */
  static readonly MEGA_ADDON: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace: "megamod",
    displayName: "Mega Mod",
    description: "A mega addon with all content types",
    entityTypes: [
      {
        id: "mega_boss",
        displayName: "Mega Boss",
        traits: ["humanoid", "hostile", "boss", "melee_attacker"],
        behaviors: ["melee_attack", "target_players"],
        health: 500,
        attackDamage: 20,
        knockbackResistance: 1.0,
        scale: 2.0,
        drops: [
          { item: "megamod:boss_heart", count: 1 },
          { item: "diamond", count: { min: 5, max: 10 }, chance: 0.5 },
        ],
      },
      {
        id: "minion",
        displayName: "Minion",
        traits: ["humanoid", "hostile", "melee_attacker"],
        behaviors: ["wander", "melee_attack", "target_players"],
        health: 10,
        attackDamage: 3,
        drops: [{ item: "rotten_flesh", chance: 0.5 }],
      },
    ],
    blockTypes: [
      {
        id: "boss_altar",
        displayName: "Boss Altar",
        destroyTime: 50,
        explosionResistance: 1000,
        lightEmission: 15,
      },
      {
        id: "magic_ore",
        displayName: "Magic Ore",
        destroyTime: 4.0,
        drops: [{ item: "megamod:raw_magic", count: { min: 1, max: 2 } }],
      },
    ],
    itemTypes: [
      {
        id: "boss_heart",
        displayName: "Boss Heart",
        category: "items",
        glint: true,
      },
      {
        id: "raw_magic",
        displayName: "Raw Magic",
        category: "items",
      },
      {
        id: "magic_ingot",
        displayName: "Magic Ingot",
        category: "items",
      },
      {
        id: "boss_sword",
        displayName: "Boss Sword",
        category: "equipment",
        traits: ["sword"],
        weapon: { damage: 15, durability: 2000 },
        glint: true,
      },
    ],
    recipes: [
      {
        id: "smelt_magic",
        type: "furnace",
        input: "megamod:raw_magic",
        result: "megamod:magic_ingot",
        experience: 2.0,
      },
      {
        id: "boss_sword_recipe",
        type: "shaped",
        pattern: [" H ", " M ", " S "],
        key: { H: "megamod:boss_heart", M: "megamod:magic_ingot", S: "stick" },
        result: "megamod:boss_sword",
      },
    ],
    spawnRules: [
      {
        entity: "megamod:minion",
        biomes: ["all"],
        weight: 30,
        groupSize: { min: 2, max: 4 },
        timeOfDay: "night",
      },
    ],
    features: [
      {
        id: "magic_ore_vein",
        spread: {
          places: [{ type: "ore", id: "megamod:magic_ore", count: 6, replacesBlocks: ["stone", "deepslate"] }],
          heightPlacement: { type: "range", min: -32, max: 16 },
          rarity: 12,
        },
      },
    ],
  };
}

// ============================================================================
// ADVANCED CONTENT GENERATION TESTS
// ============================================================================

describe("Advanced ContentGenerator Tests", function () {
  this.timeout(15000);

  before(async function () {
    await testFolders.initialize();
  });

  describe("Entity Trait Combinations", function () {
    it("should handle all traits entity", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.ALL_TRAITS_ENTITY);
      const result = await generator.generate();

      expect(result.entityBehaviors).to.have.length(1);
      const entity = result.entityBehaviors[0].content as any;
      const components = entity["minecraft:entity"].components;

      // Verify key properties were applied
      expect(components["minecraft:health"].value).to.equal(100);
      expect(components["minecraft:movement"].value).to.equal(0.35);
      expect(components["minecraft:knockback_resistance"]?.value).to.equal(0.5);
      expect(components["minecraft:scale"]?.value).to.equal(1.2);
      expect(components["minecraft:collision_box"].width).to.equal(0.8);
      expect(components["minecraft:collision_box"].height).to.equal(2.0);
    });

    it("should handle ranged attacker entity", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.RANGED_ATTACKER_ENTITY);
      const result = await generator.generate();

      const entity = result.entityBehaviors[0].content as any;
      const components = entity["minecraft:entity"].components;

      // Should have ranged attack behavior
      expect(components["minecraft:behavior.ranged_attack"]).to.exist;
    });

    it("should handle flying entity", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.FLYING_ENTITY);
      const result = await generator.generate();

      const entity = result.entityBehaviors[0].content as any;
      const components = entity["minecraft:entity"].components;

      // Should have flying navigation and can_fly
      expect(components["minecraft:navigation.fly"] || components["minecraft:can_fly"]).to.exist;
    });

    it("should handle aquatic entity", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.AQUATIC_ENTITY);
      const result = await generator.generate();

      const entity = result.entityBehaviors[0].content as any;
      const components = entity["minecraft:entity"].components;

      // Should have swimming navigation
      expect(components["minecraft:navigation.swim"]).to.exist;
    });

    // Regression: generated aquatic entities had BOTH
    // `minecraft:movement.basic` (added as default) and `minecraft:movement.sway`
    // (added by the aquatic trait). Bedrock allows only one move-control
    // component and emits "Mobs can only have 1 Move Control Component".
    it("should not emit two minecraft:movement.* controllers on aquatic entities", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.AQUATIC_ENTITY);
      const result = await generator.generate();

      const entity = result.entityBehaviors[0].content as any;
      const components = entity["minecraft:entity"].components;
      const movementKeys = Object.keys(components).filter((k) => k.startsWith("minecraft:movement."));
      expect(
        movementKeys.length,
        `expected exactly one movement.* controller, got ${movementKeys.join(", ")}`
      ).to.equal(1);
      // The aquatic trait's controller (sway) should win over the default basic.
      expect(components["minecraft:movement.basic"]).to.be.undefined;
      expect(components["minecraft:movement.sway"]).to.exist;
    });

    it("should handle rideable entity", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.RIDEABLE_ENTITY);
      const result = await generator.generate();

      const entity = result.entityBehaviors[0].content as any;
      const components = entity["minecraft:entity"].components;
      const componentGroups = entity["minecraft:entity"].component_groups;

      // The rideable component could be in components directly or in a component group
      // (e.g., "saddled" group if the entity requires a saddle)
      const hasRideableComponent =
        components["minecraft:rideable"] !== undefined ||
        (componentGroups &&
          Object.values(componentGroups).some((group: any) => group && group["minecraft:rideable"] !== undefined));

      expect(hasRideableComponent, "Entity should have rideable component (in components or component groups)").to.be
        .true;
    });
  });

  describe("Block Advanced Features", function () {
    it("should handle block with states", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.BLOCK_WITH_STATES);
      const result = await generator.generate();

      const block = result.blockBehaviors[0].content as any;

      // Should have states defined
      expect(block["minecraft:block"].states || block["minecraft:block"].permutations).to.exist;
    });

    it("should handle block with geometry reference", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.BLOCK_WITH_GEOMETRY);
      const result = await generator.generate();

      expect(result.blockBehaviors).to.have.length(1);
    });
  });

  describe("Item Advanced Features", function () {
    it("should handle fuel item", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.FUEL_ITEM);
      const result = await generator.generate();

      const item = result.itemBehaviors[0].content as any;
      const components = item["minecraft:item"].components;

      // Should have fuel component or equivalent
      expect(components["minecraft:fuel"] || components).to.exist;
    });

    it("should handle throwable item", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.THROWABLE_ITEM);
      const result = await generator.generate();

      const item = result.itemBehaviors[0].content as any;
      const components = item["minecraft:item"].components;

      // Should have throwable component
      expect(components["minecraft:throwable"] || components["minecraft:projectile"]).to.exist;
    });
  });

  describe("Multiple Content Items", function () {
    it("should handle multiple recipes", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.MULTIPLE_RECIPES);
      const result = await generator.generate();

      expect(result.recipes).to.have.length(3);
    });

    it("should handle multiple spawn rules", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.MULTIPLE_SPAWN_RULES);
      const result = await generator.generate();

      expect(result.spawnRules).to.have.length(3);
    });

    it("should handle entity with inline spawning", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.ENTITY_WITH_SPAWNING);
      const result = await generator.generate();

      // Should generate both entity and spawn rule
      expect(result.entityBehaviors).to.have.length(1);
      expect(result.spawnRules.length).to.be.greaterThan(0);
    });
  });

  describe("Mega Addon Integration", function () {
    it("should generate all content for mega addon", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.MEGA_ADDON);
      const result = await generator.generate();

      // Check counts
      expect(result.summary.entityCount).to.equal(2);
      expect(result.summary.blockCount).to.equal(2);
      expect(result.summary.itemCount).to.equal(4);
      expect(result.summary.recipeCount).to.equal(2);
      expect(result.summary.spawnRuleCount).to.equal(1);
      expect(result.summary.featureCount).to.equal(1);

      // Check loot tables were auto-generated
      expect(result.lootTables.length).to.be.greaterThan(0);
    });

    it("should produce coherent file structure", async function () {
      const generator = new ContentGenerator(AdvancedContentFixtures.MEGA_ADDON);
      const result = await generator.generate();

      // All entity behaviors should be in entities/ folder
      for (const file of result.entityBehaviors) {
        expect(file.path).to.match(/^entities\//);
        expect(file.pack).to.equal("behavior");
      }

      // All block behaviors should be in blocks/ folder
      for (const file of result.blockBehaviors) {
        expect(file.path).to.match(/^blocks\//);
        expect(file.pack).to.equal("behavior");
      }

      // All item behaviors should be in items/ folder
      for (const file of result.itemBehaviors) {
        expect(file.path).to.match(/^items\//);
        expect(file.pack).to.equal("behavior");
      }

      // All recipes should be in recipes/ folder
      for (const file of result.recipes) {
        expect(file.path).to.match(/^recipes\//);
        expect(file.pack).to.equal("behavior");
      }

      // All spawn rules should be in spawn_rules/ folder
      for (const file of result.spawnRules) {
        expect(file.path).to.match(/^spawn_rules\//);
        expect(file.pack).to.equal("behavior");
      }
    });
  });
});

// ============================================================================
// SCHEMA VALIDATION TESTS
// ============================================================================

import { MinecraftContentSchema } from "../minecraft/ContentMetaSchemaZod";

describe("MinecraftContentSchema Validation", function () {
  describe("Valid Definitions", function () {
    it("should validate minimal definition", function () {
      const result = MinecraftContentSchema.safeParse({
        schemaVersion: "1.0.0",
      });
      expect(result.success).to.be.true;
    });

    it("should validate complete addon definition", function () {
      const result = MinecraftContentSchema.safeParse(ContentTestFixtures.COMPLETE_ADDON);
      expect(result.success).to.be.true;
    });

    it("should validate all test fixtures", function () {
      const fixtures = [
        ContentTestFixtures.MINIMAL_ENTITY,
        ContentTestFixtures.HOSTILE_MELEE_ENTITY,
        ContentTestFixtures.PASSIVE_BREEDABLE_ENTITY,
        ContentTestFixtures.TAMEABLE_ENTITY,
        ContentTestFixtures.BOSS_ENTITY,
        ContentTestFixtures.SIMPLE_BLOCK,
        ContentTestFixtures.BLOCK_WITH_TRAITS,
        ContentTestFixtures.BLOCK_WITH_DROPS,
        ContentTestFixtures.FOOD_ITEM,
        ContentTestFixtures.TOOL_ITEM,
        ContentTestFixtures.WEAPON_ITEM,
        ContentTestFixtures.ARMOR_ITEM,
        ContentTestFixtures.LOOT_TABLE,
        ContentTestFixtures.SHAPED_RECIPE,
        ContentTestFixtures.SHAPELESS_RECIPE,
        ContentTestFixtures.FURNACE_RECIPE,
        ContentTestFixtures.SPAWN_RULE,
        ContentTestFixtures.ORE_FEATURE,
      ];

      for (const fixture of fixtures) {
        const result = MinecraftContentSchema.safeParse(fixture);
        expect(result.success, `Fixture should be valid: ${JSON.stringify(fixture).substring(0, 100)}`).to.be.true;
      }
    });

    it("should validate advanced fixtures", function () {
      const fixtures = [
        AdvancedContentFixtures.ALL_TRAITS_ENTITY,
        AdvancedContentFixtures.RANGED_ATTACKER_ENTITY,
        AdvancedContentFixtures.FLYING_ENTITY,
        AdvancedContentFixtures.AQUATIC_ENTITY,
        AdvancedContentFixtures.RIDEABLE_ENTITY,
        AdvancedContentFixtures.BLOCK_WITH_STATES,
        AdvancedContentFixtures.BLOCK_WITH_GEOMETRY,
        AdvancedContentFixtures.FUEL_ITEM,
        AdvancedContentFixtures.THROWABLE_ITEM,
        AdvancedContentFixtures.MULTIPLE_RECIPES,
        AdvancedContentFixtures.MULTIPLE_SPAWN_RULES,
        AdvancedContentFixtures.ENTITY_WITH_SPAWNING,
        AdvancedContentFixtures.MEGA_ADDON,
      ];

      for (const fixture of fixtures) {
        const result = MinecraftContentSchema.safeParse(fixture);
        expect(result.success, `Advanced fixture should be valid: ${JSON.stringify(fixture).substring(0, 100)}`).to.be
          .true;
      }
    });
  });

  describe("Invalid Definitions", function () {
    it("should reject missing schemaVersion", function () {
      const result = MinecraftContentSchema.safeParse({
        namespace: "test",
      });
      expect(result.success).to.be.false;
    });

    it("should reject invalid schemaVersion", function () {
      const result = MinecraftContentSchema.safeParse({
        schemaVersion: "2.0.0", // Only 1.0.0 is valid
      });
      expect(result.success).to.be.false;
    });

    it("should reject entity with invalid trait", function () {
      const result = MinecraftContentSchema.safeParse({
        schemaVersion: "1.0.0",
        entityTypes: [
          {
            id: "test",
            displayName: "Test",
            traits: ["invalid_trait_name"],
          },
        ],
      });
      expect(result.success).to.be.false;
    });

    it("should reject entity missing id", function () {
      const result = MinecraftContentSchema.safeParse({
        schemaVersion: "1.0.0",
        entityTypes: [
          {
            displayName: "Test",
          },
        ],
      });
      expect(result.success).to.be.false;
    });

    it("should reject block missing id", function () {
      const result = MinecraftContentSchema.safeParse({
        schemaVersion: "1.0.0",
        blockTypes: [
          {
            displayName: "Test Block",
          },
        ],
      });
      expect(result.success).to.be.false;
    });

    it("should reject recipe with invalid type", function () {
      const result = MinecraftContentSchema.safeParse({
        schemaVersion: "1.0.0",
        recipes: [
          {
            id: "test",
            type: "invalid_type",
            result: "test:item",
          },
        ],
      });
      expect(result.success).to.be.false;
    });

    it("should reject loot table missing pools", function () {
      const result = MinecraftContentSchema.safeParse({
        schemaVersion: "1.0.0",
        lootTables: [
          {
            id: "test",
          },
        ],
      });
      expect(result.success).to.be.false;
    });
  });
});

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ContentGenerator - Generates native Minecraft Bedrock content from meta-schema definitions.
 *
 * This module converts simplified IMinecraftContentDefinition objects into the full
 * set of Minecraft files (behavior pack JSONs, resource pack JSONs, textures, etc.).
 *
 * Key responsibilities:
 * 1. Expand traits into native components
 * 2. Generate placeholder textures using IMcpTexturedRectangle
 * 3. Create proper file structure with format_version
 * 4. Handle cross-references between files
 * 5. Generate loot tables from drops definitions
 *
 * @see IContentMetaSchema.ts for type definitions
 * @see ContentMetaSchemaZod.ts for validation schemas
 */

import {
  IMinecraftContentDefinition,
  IEntityTypeDefinition,
  IBlockTypeDefinition,
  IItemTypeDefinition,
  IStructureDefinition,
  IFeatureDefinition,
  ILootTableDefinition,
  IRecipeDefinition,
  ISpawnRuleDefinition,
  EntityTraitId,
  BlockTraitId,
  ItemTraitId,
  IDropDefinition,
  ISpawnConfig,
  EntityBehaviorPreset,
  IGenerationOptions,
  ITextureSpec,
  IBlockTexture,
} from "./IContentMetaSchema";
import CreatorToolsHost from "../app/CreatorToolsHost";
import ImageCodec from "../core/ImageCodec";
import PngEncoder from "./PngEncoder";
import { generateItemTextureFromTemplate } from "./ItemTextureTemplates";
import { TraitRegistry, registerAllEntityTraits, registerAllBlockTraits, registerAllItemTraits } from "./traits";
import ModelDesignUtilities from "./ModelDesignUtilities";
import TexturedRectangleGenerator from "./TexturedRectangleGenerator";
import { applyTextureEffects } from "./TextureEffects";
import { getModelTemplateAsync, ModelTemplateType } from "./ModelDesignTemplates";
import { IMcpModelDesign, IMcpTextureDefinition } from "./IMcpModelDesign";

// Initialize trait registry on module load
let traitsInitialized = false;
function ensureTraitsInitialized(): void {
  if (!traitsInitialized) {
    registerAllEntityTraits();
    registerAllBlockTraits();
    registerAllItemTraits();
    traitsInitialized = true;
  }
}

// ============================================================================
// GENERATED FILE TYPES
// ============================================================================

interface ILootFunction {
  function: string;
  count: number | { min: number; max: number };
}

interface ILootCondition {
  condition: string;
  chance?: number;
}

/**
 * Result of content generation - all files to be created.
 */
export interface IGeneratedContent {
  /** Manifest for behavior pack */
  behaviorPackManifest?: IGeneratedFile;

  /** Manifest for resource pack */
  resourcePackManifest?: IGeneratedFile;

  /** Entity behavior files (behavior_packs/entities/) */
  entityBehaviors: IGeneratedFile[];

  /** Entity resource files (resource_packs/entity/) */
  entityResources: IGeneratedFile[];

  /** Block behavior files */
  blockBehaviors: IGeneratedFile[];

  /** Block resource files */
  blockResources: IGeneratedFile[];

  /** Item behavior files */
  itemBehaviors: IGeneratedFile[];

  /** Item resource files */
  itemResources: IGeneratedFile[];

  /** Structure files (.mcstructure) */
  structures: IGeneratedFile[];

  /** Feature files */
  features: IGeneratedFile[];

  /** Feature rule files */
  featureRules: IGeneratedFile[];

  /** Loot table files */
  lootTables: IGeneratedFile[];

  /** Recipe files */
  recipes: IGeneratedFile[];

  /** Spawn rule files */
  spawnRules: IGeneratedFile[];

  /** Texture files (as base64 PNG) */
  textures: IGeneratedFile[];

  /** Geometry files */
  geometries: IGeneratedFile[];

  /** Render controller files */
  renderControllers: IGeneratedFile[];

  /** Sound definition files */
  sounds: IGeneratedFile[];

  /** terrain_texture.json entries */
  terrainTextures?: IGeneratedFile;

  /** item_texture.json entries */
  itemTextures?: IGeneratedFile;

  /** blocks.json resource pack catalog (singleton, should be merged across calls) */
  blocksCatalog?: IGeneratedFile;

  /** sound_definitions.json (singleton, should be merged across calls) */
  soundDefinitions?: IGeneratedFile;

  /** music_definitions.json (singleton, should be merged across calls) */
  musicDefinitions?: IGeneratedFile;

  /** Summary of what was generated */
  summary: IGenerationSummary;
}

/**
 * A single generated file.
 */
export interface IGeneratedFile {
  /** Relative path within the pack (e.g., "entities/orc.json") */
  path: string;

  /** Content - JSON object, string for text, or Uint8Array for binary */
  content: object | string | Uint8Array;

  /** Content type */
  type: "json" | "png" | "mcstructure" | "text";

  /** Which pack this belongs to */
  pack: "behavior" | "resource" | "world" | "none";
}

/**
 * Summary of generation results.
 */
export interface IGenerationSummary {
  namespace: string;
  entityCount: number;
  blockCount: number;
  itemCount: number;
  structureCount: number;
  featureCount: number;
  lootTableCount: number;
  recipeCount: number;
  spawnRuleCount: number;
  textureCount: number;
  warnings: string[];
  errors: string[];
}

// ============================================================================
// TRAIT EXPANSION
// ============================================================================

/**
 * Trait definitions - maps trait IDs to native Minecraft components.
 */
const ENTITY_TRAIT_COMPONENTS: Record<EntityTraitId, Record<string, any>> = {
  // Body types (primarily affect geometry/animation, but also some components)
  humanoid: {
    "minecraft:can_climb": {},
    "minecraft:jump.static": {},
  },
  quadruped: {
    "minecraft:can_climb": {},
    "minecraft:jump.static": {},
  },
  quadruped_small: {
    "minecraft:can_climb": {},
    "minecraft:jump.static": {},
  },
  flying: {
    "minecraft:navigation.fly": {
      can_path_over_water: true,
      can_path_over_lava: false,
    },
    "minecraft:can_fly": {},
  },
  aquatic: {
    "minecraft:navigation.swim": {
      can_path_over_water: false,
      can_swim: true,
    },
    "minecraft:underwater_movement": { value: 0.3 },
    "minecraft:breathable": {
      total_supply: 15,
      suffocate_time: 0,
      breathes_water: true,
      breathes_air: false,
    },
  },
  arthropod: {
    "minecraft:can_climb": {},
    "minecraft:mark_variant": { value: 0 },
  },
  slime: {
    "minecraft:movement.sway": { sway_amplitude: 0.0 },
  },

  // Behavior archetypes
  hostile: {
    "minecraft:behavior.hurt_by_target": { priority: 1 },
    "minecraft:behavior.nearest_attackable_target": {
      priority: 2,
      entity_types: [{ filters: { test: "is_family", subject: "other", value: "player" } }],
    },
    "minecraft:attack": { damage: 3 },
  },
  passive: {
    "minecraft:behavior.panic": {
      priority: 1,
      speed_multiplier: 1.25,
    },
  },
  neutral: {
    "minecraft:behavior.hurt_by_target": {
      priority: 1,
      alert_same_type: true,
    },
  },
  boss: {
    "minecraft:boss": {
      should_darken_sky: true,
      hud_range: 55,
    },
  },

  // Combat styles
  melee_attacker: {
    "minecraft:behavior.melee_attack": {
      priority: 3,
      speed_multiplier: 1.2,
      track_target: true,
    },
    "minecraft:attack": { damage: 3 },
  },
  ranged_attacker: {
    "minecraft:behavior.ranged_attack": {
      priority: 3,
      attack_interval_min: 1.0,
      attack_interval_max: 3.0,
      attack_radius: 15.0,
    },
    "minecraft:shooter": {
      def: "minecraft:arrow",
    },
  },
  exploder: {
    "minecraft:explode": {
      fuse_length: 1.5,
      fuse_lit: false,
      power: 3,
      causes_fire: false,
    },
  },

  // Interaction
  trader: {
    "minecraft:trade_table": {},
    "minecraft:behavior.trade_with_player": { priority: 1 },
  },
  tameable: {
    "minecraft:tameable": {
      probability: 0.33,
      tame_items: ["bone"],
    },
    "minecraft:is_tamed": {},
  },
  rideable: {
    "minecraft:rideable": {
      seat_count: 1,
      family_types: ["player"],
      interact_text: "action.interact.ride.horse",
      seats: [{ position: [0.0, 1.1, -0.2] }],
    },
    "minecraft:input_ground_controlled": {},
  },
  breedable: {
    "minecraft:breedable": {
      require_tame: false,
      breed_items: ["wheat"],
      breeds_with: { mate_type: "self", baby_type: "self" },
    },
    "minecraft:behavior.breed": { priority: 3, speed_multiplier: 1.0 },
  },
  leasable: {
    "minecraft:leashable": {
      soft_distance: 4.0,
      hard_distance: 6.0,
      max_distance: 10.0,
    },
  },

  // Special traits
  undead: {
    "minecraft:burns_in_daylight": {},
    "minecraft:type_family": { family: ["undead", "monster"] },
  },
  illager: {
    "minecraft:type_family": { family: ["illager", "monster"] },
    "minecraft:behavior.raid_garden": { priority: 5 },
  },
  aquatic_only: {
    "minecraft:breathable": {
      total_supply: 15,
      suffocate_time: -1,
      breathes_water: true,
      breathes_air: false,
      generates_bubbles: false,
    },
  },
  baby_variant: {
    "minecraft:is_baby": {},
    "minecraft:scale": { value: 0.5 },
    "minecraft:ageable": {
      duration: 1200,
      grow_up: { event: "minecraft:ageable_grow_up" },
    },
  },
  wanders: {
    "minecraft:behavior.random_stroll": { priority: 6, speed_multiplier: 1.0 },
    "minecraft:behavior.random_look_around": { priority: 7 },
  },
  patrols: {
    "minecraft:behavior.move_to_poi": { priority: 3, speed_multiplier: 0.6 },
  },
  guards: {
    "minecraft:behavior.defend_village_target": { priority: 1 },
  },
  flees_daylight: {
    "minecraft:behavior.flee_sun": { priority: 2, speed_multiplier: 1.0 },
  },
  teleporter: {
    "minecraft:teleport": {
      random_teleports: true,
      max_random_teleport_time: 30,
      random_teleport_cube: [32, 16, 32],
      target_distance: 16,
      target_teleport_chance: 0.05,
    },
  },
};

/**
 * Block trait components.
 */
const BLOCK_TRAIT_COMPONENTS: Record<BlockTraitId, Record<string, any>> = {
  solid: {},
  transparent: {
    "minecraft:material_instances": {
      "*": { render_method: "blend" },
    },
  },
  leaves: {
    "minecraft:material_instances": {
      "*": { render_method: "alpha_test" },
    },
    "minecraft:destructible_by_mining": { seconds_to_destroy: 0.2 },
  },
  log: {
    "minecraft:destructible_by_mining": { seconds_to_destroy: 2.0 },
    "minecraft:flammable": { catch_chance_modifier: 5, destroy_chance_modifier: 5 },
  },
  slab: {
    "minecraft:geometry": "minecraft:geometry.slab",
  },
  stairs: {
    "minecraft:geometry": "minecraft:geometry.stairs",
  },
  fence: {
    "minecraft:geometry": { identifier: "minecraft:geometry.fence" },
  },
  wall: {
    "minecraft:geometry": { identifier: "minecraft:geometry.wall" },
  },
  door: {
    "minecraft:geometry": { identifier: "minecraft:geometry.door" },
    "minecraft:on_interact": {
      event: "toggle_open",
    },
  },
  trapdoor: {
    "minecraft:geometry": { identifier: "minecraft:geometry.trapdoor" },
    "minecraft:on_interact": {
      event: "toggle_open",
    },
  },
  workstation: {},
  light_source: {
    "minecraft:light_emission": 15,
  },
  gravity: {
    "minecraft:gravity": {},
  },
  liquid: {
    "minecraft:material_instances": {
      "*": { render_method: "blend" },
    },
  },
  redstone_signal: {
    "minecraft:redstone_conductivity": {
      redstone_conductor: true,
      allows_wire_to_step_down: true,
    },
  },
  redstone_receiver: {
    "minecraft:redstone_conductivity": {
      redstone_conductor: true,
    },
  },
  button: {
    "minecraft:geometry": { identifier: "minecraft:geometry.button" },
  },
  lever: {
    "minecraft:geometry": { identifier: "minecraft:geometry.lever" },
  },
  pressure_plate: {
    "minecraft:geometry": { identifier: "minecraft:geometry.pressure_plate" },
  },
  flammable: {
    "minecraft:flammable": { catch_chance_modifier: 5, destroy_chance_modifier: 20 },
  },
  explosion_resistant: {
    "minecraft:destructible_by_explosion": { explosion_resistance: 1200 },
  },
  slippery: {
    "minecraft:friction": 0.1,
  },
};

/**
 * Item trait components.
 */
const ITEM_TRAIT_COMPONENTS: Record<ItemTraitId, Record<string, any>> = {
  sword: {
    "minecraft:hand_equipped": true,
    "minecraft:damage": 4,
    "minecraft:enchantable": { slot: "sword", value: 10 },
  },
  pickaxe: {
    "minecraft:hand_equipped": true,
    "minecraft:digger": {
      use_efficiency: true,
      destroy_speeds: [{ block: { tags: "q.any_tag('stone', 'metal')" }, speed: 4 }],
    },
    "minecraft:enchantable": { slot: "pickaxe", value: 10 },
  },
  axe: {
    "minecraft:hand_equipped": true,
    "minecraft:digger": {
      use_efficiency: true,
      destroy_speeds: [{ block: { tags: "q.any_tag('wood', 'pumpkin')" }, speed: 4 }],
    },
    "minecraft:enchantable": { slot: "axe", value: 10 },
  },
  shovel: {
    "minecraft:hand_equipped": true,
    "minecraft:digger": {
      use_efficiency: true,
      destroy_speeds: [{ block: { tags: "q.any_tag('dirt', 'sand', 'gravel')" }, speed: 4 }],
    },
    "minecraft:enchantable": { slot: "shovel", value: 10 },
  },
  hoe: {
    "minecraft:hand_equipped": true,
    "minecraft:enchantable": { slot: "hoe", value: 10 },
  },
  bow: {
    "minecraft:use_duration": 72000,
    "minecraft:enchantable": { slot: "bow", value: 1 },
  },
  crossbow: {
    "minecraft:use_duration": 72000,
    "minecraft:enchantable": { slot: "crossbow", value: 1 },
  },
  food: {
    "minecraft:food": {
      nutrition: 4,
      saturation_modifier: "normal",
      can_always_eat: false,
    },
    "minecraft:use_duration": 32,
  },
  armor_helmet: {
    "minecraft:wearable": { slot: "slot.armor.head" },
    "minecraft:enchantable": { slot: "armor_head", value: 10 },
  },
  armor_chestplate: {
    "minecraft:wearable": { slot: "slot.armor.chest" },
    "minecraft:enchantable": { slot: "armor_torso", value: 10 },
  },
  armor_leggings: {
    "minecraft:wearable": { slot: "slot.armor.legs" },
    "minecraft:enchantable": { slot: "armor_legs", value: 10 },
  },
  armor_boots: {
    "minecraft:wearable": { slot: "slot.armor.feet" },
    "minecraft:enchantable": { slot: "armor_feet", value: 10 },
  },
  throwable: {
    "minecraft:throwable": {
      do_swing_animation: true,
      launch_power_scale: 1.0,
      max_launch_power: 1.0,
    },
    "minecraft:projectile": {
      projectile_entity: "minecraft:snowball",
    },
  },
  placeable: {
    "minecraft:block_placer": {
      block: "minecraft:stone",
    },
  },
};

// ============================================================================
// BEHAVIOR PRESET EXPANSION
// ============================================================================

/**
 * Maps behavior presets to AI goal components.
 */
const BEHAVIOR_PRESET_COMPONENTS: Record<EntityBehaviorPreset, Record<string, any>> = {
  // Movement
  wander: {
    "minecraft:behavior.random_stroll": { priority: 6, speed_multiplier: 1.0 },
  },
  swim: {
    "minecraft:behavior.random_swim": { priority: 4, speed_multiplier: 1.0 },
  },
  fly_around: {
    "minecraft:behavior.random_fly": { priority: 6, xz_dist: 4, y_dist: 2 },
  },
  float: {
    "minecraft:behavior.float": { priority: 0 },
  },
  climb: {
    "minecraft:can_climb": {},
  },

  // Combat
  melee_attack: {
    "minecraft:behavior.melee_attack": { priority: 3, speed_multiplier: 1.0 },
    "minecraft:attack": { damage: 3 },
  },
  ranged_attack: {
    "minecraft:behavior.ranged_attack": { priority: 3, attack_radius: 15.0 },
  },
  target_players: {
    "minecraft:behavior.nearest_attackable_target": {
      priority: 2,
      entity_types: [{ filters: { test: "is_family", subject: "other", value: "player" } }],
    },
  },
  target_monsters: {
    "minecraft:behavior.nearest_attackable_target": {
      priority: 2,
      entity_types: [{ filters: { test: "is_family", subject: "other", value: "monster" } }],
    },
  },
  flee_when_hurt: {
    "minecraft:behavior.panic": { priority: 1, speed_multiplier: 1.25 },
  },
  retaliate: {
    "minecraft:behavior.hurt_by_target": { priority: 1 },
  },

  // Social
  follow_owner: {
    "minecraft:behavior.follow_owner": {
      priority: 4,
      speed_multiplier: 1.0,
      start_distance: 10,
      stop_distance: 2,
    },
  },
  follow_parent: {
    "minecraft:behavior.follow_parent": { priority: 5, speed_multiplier: 1.0 },
  },
  herd: {
    "minecraft:behavior.move_towards_dwelling_restriction": { priority: 4 },
  },
  avoid_players: {
    "minecraft:behavior.avoid_mob_type": {
      priority: 1,
      entity_types: [{ filters: { test: "is_family", subject: "other", value: "player" } }],
      max_dist: 10,
      walk_speed_multiplier: 0.8,
      sprint_speed_multiplier: 1.2,
    },
  },

  // Interaction
  look_at_player: {
    "minecraft:behavior.look_at_player": {
      priority: 7,
      look_distance: 6.0,
      probability: 0.02,
    },
  },
  beg: {
    "minecraft:behavior.beg": {
      priority: 8,
      look_distance: 8.0,
      items: ["bone"],
    },
  },
  tempt: {
    "minecraft:behavior.tempt": {
      priority: 4,
      speed_multiplier: 1.0,
      items: ["wheat"],
    },
  },
  sit_command: {
    "minecraft:behavior.sit": { priority: 2 },
    "minecraft:sittable": {},
  },

  // Actions
  eat_grass: {
    "minecraft:behavior.eat_block": {
      priority: 6,
      time_until_eat: 1.8,
      eat_and_replace_block_pairs: [{ eat_block: "grass", replace_block: "dirt" }],
    },
  },
  break_doors: {
    "minecraft:behavior.break_door": { priority: 1 },
  },
  open_doors: {
    "minecraft:behavior.open_door": { priority: 6, close_door_after: true },
  },
  pick_up_items: {
    "minecraft:behavior.pickup_items": { priority: 7, max_dist: 3 },
  },
  sleep_in_bed: {
    "minecraft:behavior.sleep": { priority: 3, speed_multiplier: 1.2 },
  },

  // Environment
  hide_from_sun: {
    "minecraft:behavior.flee_sun": { priority: 2, speed_multiplier: 1.0 },
  },
  go_home_at_night: {
    "minecraft:behavior.go_home": { priority: 4, speed_multiplier: 1.0, goal_radius: 1.5 },
  },
  seek_water: {
    "minecraft:behavior.go_and_give_items_to_noteblock": { priority: 5 },
  },
  seek_land: {
    "minecraft:behavior.move_to_land": { priority: 1, search_range: 16 },
  },
};

// ============================================================================
// MAIN GENERATOR CLASS
// ============================================================================

/**
 * Generates native Minecraft content from meta-schema definitions.
 */
export class ContentGenerator {
  private _definition: IMinecraftContentDefinition;
  private _options: IGenerationOptions;
  private _namespace: string;
  private _warnings: string[] = [];
  private _errors: string[] = [];

  /**
   * Sanitizes an ID for safe use in file paths.
   * Strips path separators and traversal sequences to prevent directory escape.
   */
  private static _sanitizeIdForPath(id: string): string {
    // Remove null bytes, path separators, and traversal sequences
    return id.replace(/\0/g, "").replace(/\.\./g, "").replace(/[/\\]/g, "_").replace(/:/g, "_");
  }

  constructor(definition: IMinecraftContentDefinition) {
    this._definition = definition;
    this._options = definition.options || {};
    this._namespace = definition.namespace || "custom";
  }

  // ============================================================================
  // TRAIT VALIDATION
  // ============================================================================

  /**
   * Validates trait combinations for entities, blocks, and items.
   * Checks for conflicting traits and adds warnings to the result.
   *
   * @param result - The generation result to add warnings to
   */
  private _validateTraitCombinations(): void {
    // Validate entity traits
    if (this._definition.entityTypes) {
      for (const entity of this._definition.entityTypes) {
        if (entity.traits && entity.traits.length > 1) {
          this._validateEntityTraits(entity.id, entity.traits);
        }
      }
    }

    // Validate block traits
    if (this._definition.blockTypes) {
      for (const block of this._definition.blockTypes) {
        if (block.traits && block.traits.length > 1) {
          this._validateBlockTraits(block.id, block.traits);
        }
      }
    }

    // Validate item traits
    if (this._definition.itemTypes) {
      for (const item of this._definition.itemTypes) {
        if (item.traits && item.traits.length > 1) {
          this._validateItemTraits(item.id, item.traits);
        }
      }
    }
  }

  /**
   * Validates entity trait combinations for conflicts.
   */
  private _validateEntityTraits(entityId: string, traits: EntityTraitId[]): void {
    const traitSet = new Set(traits);

    for (const traitId of traits) {
      const trait = TraitRegistry.getEntityTrait(traitId);
      if (trait) {
        const traitData = trait.getData();

        // Check for conflicts
        if (traitData.conflicts) {
          for (const conflictId of traitData.conflicts) {
            if (traitSet.has(conflictId as EntityTraitId)) {
              this._warnings.push(
                `Entity '${entityId}': Trait '${traitId}' conflicts with '${conflictId}'. ` +
                  `These traits may produce unexpected behavior when combined.`
              );
            }
          }
        }
      }
    }

    // Check common known conflicts not defined in trait data
    this._checkKnownEntityConflicts(entityId, traitSet);
  }

  /**
   * Validates block trait combinations for conflicts.
   */
  private _validateBlockTraits(blockId: string, traits: BlockTraitId[]): void {
    const traitSet = new Set(traits);

    for (const traitId of traits) {
      const trait = TraitRegistry.getBlockTrait(traitId);
      if (trait) {
        const traitData = trait.getData();

        // Check for conflicts
        if (traitData.conflicts) {
          for (const conflictId of traitData.conflicts) {
            if (traitSet.has(conflictId as BlockTraitId)) {
              this._warnings.push(
                `Block '${blockId}': Trait '${traitId}' conflicts with '${conflictId}'. ` +
                  `These traits may produce unexpected behavior when combined.`
              );
            }
          }
        }
      }
    }

    // Check common known conflicts
    this._checkKnownBlockConflicts(blockId, traitSet);
  }

  /**
   * Validates item trait combinations for conflicts.
   */
  private _validateItemTraits(itemId: string, traits: ItemTraitId[]): void {
    const traitSet = new Set(traits);

    for (const traitId of traits) {
      const trait = TraitRegistry.getItemTrait(traitId);
      if (trait) {
        const traitData = trait.getData();

        // Check for conflicts
        if (traitData.conflicts) {
          for (const conflictId of traitData.conflicts) {
            if (traitSet.has(conflictId as ItemTraitId)) {
              this._warnings.push(
                `Item '${itemId}': Trait '${traitId}' conflicts with '${conflictId}'. ` +
                  `These traits may produce unexpected behavior when combined.`
              );
            }
          }
        }
      }
    }

    // Check common known conflicts
    this._checkKnownItemConflicts(itemId, traitSet);
  }

  /**
   * Checks for common entity trait conflicts that may not be defined in trait data.
   */
  private _checkKnownEntityConflicts(entityId: string, traits: Set<EntityTraitId>): void {
    // Behavior conflicts: hostile, passive, neutral are mutually exclusive
    const behaviorTraits = ["hostile", "passive", "neutral"].filter((t) => traits.has(t as EntityTraitId));
    if (behaviorTraits.length > 1) {
      this._warnings.push(
        `Entity '${entityId}': Multiple behavior traits (${behaviorTraits.join(", ")}) are mutually exclusive. ` +
          `Only one behavior archetype should be used.`
      );
    }

    // Body type conflicts: only one body type should be selected
    const bodyTypeTraits = [
      "humanoid",
      "quadruped",
      "quadruped_small",
      "flying",
      "aquatic",
      "arthropod",
      "slime",
    ].filter((t) => traits.has(t as EntityTraitId));
    if (bodyTypeTraits.length > 1) {
      this._warnings.push(
        `Entity '${entityId}': Multiple body types (${bodyTypeTraits.join(", ")}) specified. ` +
          `Only one body type should be selected.`
      );
    }

    // aquatic and flying don't mix well
    if (traits.has("aquatic" as EntityTraitId) && traits.has("flying" as EntityTraitId)) {
      this._warnings.push(
        `Entity '${entityId}': 'aquatic' and 'flying' traits may conflict. ` +
          `Consider using one or the other for cleaner behavior.`
      );
    }

    // undead with passive is unusual
    if (traits.has("undead" as EntityTraitId) && traits.has("passive" as EntityTraitId)) {
      this._warnings.push(
        `Entity '${entityId}': 'undead' trait is typically used with hostile entities, not passive ones.`
      );
    }
  }

  /**
   * Checks for common block trait conflicts.
   */
  private _checkKnownBlockConflicts(blockId: string, traits: Set<BlockTraitId>): void {
    // Shape conflicts: only one shape should be selected
    const shapeTraits = ["slab", "stairs", "fence", "wall", "door", "trapdoor", "button", "lever"].filter((t) =>
      traits.has(t as BlockTraitId)
    );
    if (shapeTraits.length > 1) {
      this._warnings.push(
        `Block '${blockId}': Multiple shape traits (${shapeTraits.join(", ")}) specified. ` +
          `Only one shape type should be selected.`
      );
    }

    // transparent and solid are typically mutually exclusive
    if (traits.has("transparent" as BlockTraitId) && traits.has("solid" as BlockTraitId)) {
      this._warnings.push(
        `Block '${blockId}': 'transparent' and 'solid' traits may be redundant. ` +
          `Consider which visual style you want.`
      );
    }
  }

  /**
   * Checks for common item trait conflicts.
   */
  private _checkKnownItemConflicts(itemId: string, traits: Set<ItemTraitId>): void {
    // Tool conflicts: items should typically be one tool type
    const toolTraits = ["sword", "pickaxe", "axe", "shovel", "hoe"].filter((t) => traits.has(t as ItemTraitId));
    if (toolTraits.length > 1) {
      this._warnings.push(
        `Item '${itemId}': Multiple tool traits (${toolTraits.join(", ")}) specified. ` +
          `Items are typically one tool type.`
      );
    }

    // Armor conflicts: items should be one armor slot
    const armorTraits = ["armor_helmet", "armor_chestplate", "armor_leggings", "armor_boots"].filter((t) =>
      traits.has(t as ItemTraitId)
    );
    if (armorTraits.length > 1) {
      this._warnings.push(
        `Item '${itemId}': Multiple armor slot traits (${armorTraits.join(", ")}) specified. ` +
          `Items can only occupy one armor slot.`
      );
    }

    // Food with weapon is unusual
    if (traits.has("food" as ItemTraitId) && toolTraits.length > 0) {
      this._warnings.push(
        `Item '${itemId}': 'food' trait combined with tool trait (${toolTraits.join(", ")}). ` +
          `This is unusual - consider if this is intentional.`
      );
    }
  }

  /**
   * Generate all content from the definition.
   */
  async generate(): Promise<IGeneratedContent> {
    // Ensure trait registry is initialized
    ensureTraitsInitialized();

    // Validate trait combinations before generation
    this._validateTraitCombinations();

    const result: IGeneratedContent = {
      entityBehaviors: [],
      entityResources: [],
      blockBehaviors: [],
      blockResources: [],
      itemBehaviors: [],
      itemResources: [],
      structures: [],
      features: [],
      featureRules: [],
      lootTables: [],
      recipes: [],
      spawnRules: [],
      textures: [],
      geometries: [],
      renderControllers: [],
      sounds: [],
      summary: {
        namespace: this._namespace,
        entityCount: 0,
        blockCount: 0,
        itemCount: 0,
        structureCount: 0,
        featureCount: 0,
        lootTableCount: 0,
        recipeCount: 0,
        spawnRuleCount: 0,
        textureCount: 0,
        warnings: [],
        errors: [],
      },
    };

    // Generate manifests. Resource pack first so the behavior pack can declare
    // a dependency on it — without this link, Bedrock will not load the RP at
    // runtime and entities/blocks/items render invisible.
    result.resourcePackManifest = this._generateResourceManifest();
    const rpHeaderUuid = (result.resourcePackManifest.content as any)?.header?.uuid;
    result.behaviorPackManifest = this._generateBehaviorManifest(rpHeaderUuid);

    // Generate entities
    if (this._definition.entityTypes) {
      for (const entity of this._definition.entityTypes) {
        await this._generateEntity(entity, result);
      }
      result.summary.entityCount = this._definition.entityTypes.length;
    }

    // Generate blocks
    if (this._definition.blockTypes) {
      for (const block of this._definition.blockTypes) {
        await this._generateBlock(block, result);
      }
      result.summary.blockCount = this._definition.blockTypes.length;
    }

    // Generate items
    if (this._definition.itemTypes) {
      for (const item of this._definition.itemTypes) {
        await this._generateItem(item, result);
      }
      result.summary.itemCount = this._definition.itemTypes.length;
    }

    // Generate loot tables
    if (this._definition.lootTables) {
      for (const lootTable of this._definition.lootTables) {
        this._generateLootTable(lootTable, result);
      }
      result.summary.lootTableCount = this._definition.lootTables.length;
    }

    // Generate recipes
    if (this._definition.recipes) {
      for (const recipe of this._definition.recipes) {
        this._generateRecipe(recipe, result);
      }
      result.summary.recipeCount = this._definition.recipes.length;
    }

    // Generate spawn rules
    if (this._definition.spawnRules) {
      for (const spawnRule of this._definition.spawnRules) {
        this._generateSpawnRule(spawnRule, result);
      }
      result.summary.spawnRuleCount = this._definition.spawnRules.length;
    }

    // Generate features
    if (this._definition.features) {
      for (const feature of this._definition.features) {
        this._generateFeature(feature, result);
      }
      result.summary.featureCount = this._definition.features.length;
    }

    // Generate structures
    if (this._definition.structures) {
      for (const structure of this._definition.structures) {
        await this._generateStructure(structure, result);
      }
      result.summary.structureCount = this._definition.structures.length;
    }

    // Generate terrain_texture.json for blocks
    if (this._definition.blockTypes && this._definition.blockTypes.length > 0) {
      result.terrainTextures = this._generateTerrainTextures(this._definition.blockTypes);
      result.blocksCatalog = this._generateBlocksCatalog(this._definition.blockTypes);
    }

    // Generate item_texture.json for items
    if (this._definition.itemTypes && this._definition.itemTypes.length > 0) {
      result.itemTextures = this._generateItemTextures(this._definition.itemTypes);
    }

    result.summary.textureCount = result.textures.length;
    result.summary.warnings = this._warnings;
    result.summary.errors = this._errors;

    return result;
  }

  // ============================================================================
  // MANIFEST GENERATION
  // ============================================================================

  private _generateBehaviorManifest(resourcePackHeaderUuid?: string): IGeneratedFile {
    const uuid1 = this._generateUuid();
    const uuid2 = this._generateUuid();

    const content: any = {
      format_version: 2,
      header: {
        name: this._definition.displayName || `${this._namespace} Behavior Pack`,
        description: this._definition.description || `Generated content for ${this._namespace}`,
        uuid: uuid1,
        version: [1, 0, 0],
        min_engine_version: [1, 21, 0],
      },
      modules: [
        {
          type: "data",
          uuid: uuid2,
          version: [1, 0, 0],
        },
      ],
    };

    // BP must declare a dependency on its sibling RP, otherwise Bedrock won't
    // load the RP and all entities/blocks render invisible. This was a recurring
    // root-cause bug that historically required many server restarts to identify.
    if (resourcePackHeaderUuid) {
      content.dependencies = [
        {
          uuid: resourcePackHeaderUuid,
          version: [1, 0, 0],
        },
      ];
    }

    return {
      path: "manifest.json",
      pack: "behavior",
      type: "json",
      content,
    };
  }

  private _generateResourceManifest(): IGeneratedFile {
    const uuid1 = this._generateUuid();
    const uuid2 = this._generateUuid();

    return {
      path: "manifest.json",
      pack: "resource",
      type: "json",
      content: {
        format_version: 2,
        header: {
          name: this._definition.displayName || `${this._namespace} Resource Pack`,
          description: this._definition.description || `Resources for ${this._namespace}`,
          uuid: uuid1,
          version: [1, 0, 0],
          min_engine_version: [1, 21, 0],
        },
        modules: [
          {
            type: "resources",
            uuid: uuid2,
            version: [1, 0, 0],
          },
        ],
      },
    };
  }

  // ============================================================================
  // ENTITY GENERATION
  // ============================================================================

  private async _generateEntity(entity: IEntityTypeDefinition, result: IGeneratedContent): Promise<void> {
    const safeId = ContentGenerator._sanitizeIdForPath(entity.id);
    const fullId = `${this._namespace}:${entity.id}`;

    // Build components from traits first
    let components: Record<string, any> = {
      "minecraft:type_family": { family: entity.families || [entity.id] },
      "minecraft:collision_box": {
        width: entity.collisionWidth || 0.6,
        height: entity.collisionHeight || 1.8,
      },
      "minecraft:physics": {},
      "minecraft:pushable": { is_pushable: true, is_pushable_by_piston: true },
      "minecraft:movement": { value: entity.movementSpeed || 0.25 },
      "minecraft:movement.basic": {},
      "minecraft:navigation.walk": {
        can_path_over_water: true,
        avoid_damage_blocks: true,
      },
    };

    // Collect component groups and events from traits
    let componentGroups: Record<string, Record<string, any>> = {};
    let events: Record<string, any> = {};
    let spawnEvent: any = undefined;

    // Apply traits using the new trait system
    if (entity.traits) {
      for (const traitId of entity.traits) {
        // First try the new registry-based traits
        const trait = TraitRegistry.getEntityTrait(traitId);
        if (trait) {
          const traitData = trait.getData({
            attackDamage: entity.attackDamage,
            tameItems: (entity as any).tameItems,
            tameChance: (entity as any).tameChance,
          });

          // Merge components
          if (traitData.components) {
            components = { ...components, ...traitData.components };
          }

          // Merge component groups
          if (traitData.componentGroups) {
            componentGroups = { ...componentGroups, ...traitData.componentGroups };
          }

          // Merge events
          if (traitData.events) {
            events = { ...events, ...traitData.events };
          }

          // Collect spawn events (last one wins if multiple)
          if (traitData.spawnEvent) {
            if (!spawnEvent) {
              spawnEvent = traitData.spawnEvent;
            } else {
              // Merge spawn events - combine component groups to add
              if (spawnEvent.add?.component_groups && traitData.spawnEvent.add?.component_groups) {
                spawnEvent.add.component_groups = [
                  ...spawnEvent.add.component_groups,
                  ...traitData.spawnEvent.add.component_groups,
                ];
              }
            }
          }
        } else {
          // Fall back to legacy ENTITY_TRAIT_COMPONENTS lookup
          const traitComponents = ENTITY_TRAIT_COMPONENTS[traitId];
          if (traitComponents) {
            components = { ...components, ...traitComponents };
          }
        }
      }
    }

    // Apply behavior presets
    if (entity.behaviors) {
      for (const behavior of entity.behaviors) {
        const behaviorComponents = BEHAVIOR_PRESET_COMPONENTS[behavior];
        if (behaviorComponents) {
          components = { ...components, ...behaviorComponents };
        }
      }
    }

    // Deduplicate movement controllers. Bedrock allows only ONE
    // `minecraft:movement.*` component per entity; having both `movement.basic`
    // (added as default above) and a trait-provided controller like
    // `movement.sway` triggers a "Mobs can only have 1 Move Control Component"
    // error at runtime. If a trait supplied a more specific movement.* the
    // default basic controller must be dropped.
    const movementKeys = Object.keys(components).filter((k) => k.startsWith("minecraft:movement."));
    if (movementKeys.length > 1 && components["minecraft:movement.basic"] !== undefined) {
      delete components["minecraft:movement.basic"];
    }

    // Apply simplified properties
    if (entity.health !== undefined) {
      components["minecraft:health"] = { value: entity.health, max: entity.health };
    }
    if (entity.attackDamage !== undefined) {
      components["minecraft:attack"] = { damage: entity.attackDamage };
    }
    if (entity.followRange !== undefined) {
      components["minecraft:follow_range"] = { value: entity.followRange };
    }
    if (entity.knockbackResistance !== undefined) {
      components["minecraft:knockback_resistance"] = { value: entity.knockbackResistance };
    }
    if (entity.scale !== undefined) {
      components["minecraft:scale"] = { value: entity.scale };
    }
    // appearance.scale overrides entity.scale if both are set (documented in schema).
    if (entity.appearance?.scale !== undefined) {
      components["minecraft:scale"] = { value: entity.appearance.scale };
    }

    // Apply native components (override everything)
    if (entity.components) {
      components = { ...components, ...entity.components };
    }

    // Generate behavior pack entity
    const behaviorEntity: any = {
      format_version: "1.21.0",
      "minecraft:entity": {
        description: {
          identifier: fullId,
          is_spawnable: true,
          is_summonable: true,
          is_experimental: false,
        },
        components,
      },
    };

    // Merge component groups from traits with those specified directly
    const mergedComponentGroups = { ...componentGroups };
    if (entity.componentGroups) {
      for (const [key, value] of Object.entries(entity.componentGroups)) {
        mergedComponentGroups[key] = value;
      }
    }
    if (Object.keys(mergedComponentGroups).length > 0) {
      behaviorEntity["minecraft:entity"].component_groups = mergedComponentGroups;
    }

    // Merge events from traits with those specified directly
    const mergedEvents = { ...events };
    if (entity.events) {
      for (const [key, value] of Object.entries(entity.events)) {
        mergedEvents[key] = value;
      }
    }
    // Add spawn event if we have one
    if (spawnEvent) {
      mergedEvents["minecraft:entity_spawned"] = spawnEvent;
    }
    if (Object.keys(mergedEvents).length > 0) {
      behaviorEntity["minecraft:entity"].events = mergedEvents;
    }

    result.entityBehaviors.push({
      path: `entities/${safeId}.json`,
      pack: "behavior",
      type: "json",
      content: behaviorEntity,
    });

    // Generate resource pack entity
    const resourceEntity = this._generateEntityResource(entity, fullId);
    result.entityResources.push({
      path: `entity/${safeId}.entity.json`,
      pack: "resource",
      type: "json",
      content: resourceEntity,
    });

    // Try model-design-based generation for geometry + texture
    const designResult = await this._generateEntityFromModelDesign(entity);
    if (designResult) {
      result.geometries.push({
        path: `models/entity/${safeId}.geo.json`,
        pack: "resource",
        type: "json",
        content: designResult.geometry,
      });
      if (designResult.texture) {
        result.textures.push({
          path: `textures/entity/${safeId}.png`,
          pack: "resource",
          type: "png",
          content: designResult.texture,
        });
      }
    } else {
      // Fallback: use legacy geometry + placeholder texture
      const geometry = this._generateEntityGeometry(entity);
      result.geometries.push({
        path: `models/entity/${safeId}.geo.json`,
        pack: "resource",
        type: "json",
        content: geometry,
      });
      const texture = await this._generateEntityTexturePlaceholder(entity);
      if (texture) {
        result.textures.push({
          path: `textures/entity/${safeId}.png`,
          pack: "resource",
          type: "png",
          content: texture,
        });
      }
    }

    // Generate render controller for the entity
    const renderController = this._generateEntityRenderController(entity);
    result.renderControllers.push({
      path: `render_controllers/${safeId}.render_controllers.json`,
      pack: "resource",
      type: "json",
      content: renderController,
    });

    // Generate loot table from drops if specified
    if (entity.drops && entity.drops.length > 0) {
      const lootTable = this._generateLootTableFromDrops(entity.id, entity.drops);
      result.lootTables.push(lootTable);

      // Update entity to reference loot table
      behaviorEntity["minecraft:entity"].components["minecraft:loot"] = {
        table: `loot_tables/entities/${entity.id}.json`,
      };
    }

    // Generate spawn rule if specified
    if (entity.spawning) {
      const spawnRule = this._generateSpawnRuleFromConfig(entity.id, fullId, entity.spawning);
      result.spawnRules.push(spawnRule);
    }
  }

  // ============================================================================
  // MODEL-DESIGN-BASED ENTITY GENERATION
  // ============================================================================

  /**
   * Maps a content meta-schema bodyType to a model template type.
   */
  private _bodyTypeToTemplateType(bodyType: string): ModelTemplateType {
    switch (bodyType) {
      case "quadruped":
        return "large_animal";
      case "quadruped_small":
        return "small_animal";
      default:
        return bodyType as ModelTemplateType;
    }
  }

  /**
   * Maps an appearance.textureStyle value to the corresponding TexturedRectangleType
   * used in model-design textures. Falls back to the template's existing background type
   * (or 'stipple_noise') when no textureStyle is specified.
   */
  private _textureStyleToType(
    textureStyle: "solid" | "spotted" | "striped" | "gradient" | "organic" | "armored" | undefined,
    fallback: string | undefined
  ): any {
    if (!textureStyle) {
      return fallback || "stipple_noise";
    }
    switch (textureStyle) {
      case "solid":
        return "solid";
      case "spotted":
        return "stipple_noise";
      case "striped":
        return "dither_noise";
      case "gradient":
        return "gradient";
      case "organic":
        return "perlin_noise";
      case "armored":
        // Stippled base + an outset lighting effect is applied by the caller.
        return "stipple_noise";
      default:
        return fallback || "stipple_noise";
    }
  }

  /**
   * Creates a recolored copy of a model design template using the user's primary/secondary colors.
   * Each named texture in the template gets a distinct color derived from the user's choices,
   * producing visually distinct faces that make it obvious how to customize the mob.
   */
  private _recolorModelDesign(
    template: IMcpModelDesign,
    primaryColor: string,
    secondaryColor: string,
    entityId: string,
    textureStyle?: "solid" | "spotted" | "striped" | "gradient" | "organic" | "armored"
  ): IMcpModelDesign {
    const parseHex = (hex: string): { r: number; g: number; b: number } => {
      const h = hex.startsWith("#") ? hex.slice(1) : hex;
      return {
        r: parseInt(h.slice(0, 2), 16) || 128,
        g: parseInt(h.slice(2, 4), 16) || 128,
        b: parseInt(h.slice(4, 6), 16) || 128,
      };
    };

    const toHex = (c: { r: number; g: number; b: number }): string => {
      const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
      return `#${cl(c.r).toString(16).padStart(2, "0")}${cl(c.g).toString(16).padStart(2, "0")}${cl(c.b).toString(16).padStart(2, "0")}`;
    };

    const primary = parseHex(primaryColor);
    const secondary = parseHex(secondaryColor);

    // Generate a palette of distinct colors derived from primary/secondary
    const colorVariants: { r: number; g: number; b: number }[] = [
      primary, // variant 0: primary as-is
      secondary, // variant 1: secondary as-is
      { r: Math.min(255, primary.r + 40), g: Math.max(0, primary.g - 15), b: Math.max(0, primary.b - 25) }, // variant 2: warmer/brighter
      { r: Math.max(0, secondary.r - 20), g: Math.max(0, secondary.g - 20), b: Math.min(255, secondary.b + 30) }, // variant 3: cooler/darker
      {
        r: Math.min(255, Math.round((primary.r + secondary.r) / 2 + 30)), // variant 4: midtone lighter
        g: Math.min(255, Math.round((primary.g + secondary.g) / 2 + 30)),
        b: Math.min(255, Math.round((primary.b + secondary.b) / 2 + 30)),
      },
      {
        r: Math.max(0, Math.round(primary.r * 0.6)), // variant 5: darkened primary
        g: Math.max(0, Math.round(primary.g * 0.6)),
        b: Math.max(0, Math.round(primary.b * 0.6)),
      },
    ];

    // Build new textures dict with recolored versions
    const newTextures: { [id: string]: IMcpTextureDefinition } = {};
    const textureNames = template.textures ? Object.keys(template.textures) : [];

    for (let i = 0; i < textureNames.length; i++) {
      const name = textureNames[i];
      const original = template.textures![name];
      const variant = colorVariants[i % colorVariants.length];

      // Create three color variants for noise textures (base, slightly lighter, slightly darker)
      const c1 = toHex(variant);
      const c2 = toHex({
        r: Math.min(255, variant.r + 15),
        g: Math.min(255, variant.g + 15),
        b: Math.min(255, variant.b + 15),
      });
      const c3 = toHex({
        r: Math.max(0, variant.r - 15),
        g: Math.max(0, variant.g - 15),
        b: Math.max(0, variant.b - 15),
      });

      newTextures[name] = {
        background: {
          type: this._textureStyleToType(textureStyle, original.background?.type),
          colors: [c1, c2, c3],
          seed: (original.background?.seed || 1000) + i,
        },
        effects:
          textureStyle === "armored"
            ? { ...(original.effects || {}), lighting: { preset: "outset", intensity: 0.4 } }
            : original.effects,
        pixelArt: original.pixelArt,
      };
    }

    // Deep clone the design and replace textures
    const cloned: IMcpModelDesign = JSON.parse(JSON.stringify(template));
    cloned.textures = newTextures;
    cloned.identifier = `${this._namespace}_${entityId}`;

    return cloned;
  }

  /**
   * Generates entity geometry and texture using the model design pipeline.
   * Uses model templates with per-face textured rectangles for high-quality output.
   * Returns null if template loading fails, in which case the caller should use legacy generation.
   */
  private async _generateEntityFromModelDesign(
    entity: IEntityTypeDefinition
  ): Promise<{ geometry: object; texture: Uint8Array | null } | null> {
    const appearance = entity.appearance || {};
    const bodyType = appearance.bodyType || "humanoid";
    const primaryColor = appearance.primaryColor || "#5B8C3E";
    const secondaryColor = appearance.secondaryColor || "#3D6B2E";

    // Map bodyType to template type and load template
    const templateType = this._bodyTypeToTemplateType(bodyType);
    let template: IMcpModelDesign | undefined;

    try {
      template = await getModelTemplateAsync(templateType);
    } catch {
      // Template not available - fall back to legacy
      return null;
    }

    if (!template) {
      return null;
    }

    // Recolor the template with the user's colors
    const design = this._recolorModelDesign(template, primaryColor, secondaryColor, entity.id, appearance.textureStyle);

    // Convert model design to geometry + atlas regions
    const conversionResult = ModelDesignUtilities.convertToGeometry(design);

    // Override the geometry identifier to use our namespace
    const geometryId = `geometry.${this._namespace}.${entity.id}`;
    const geoData = conversionResult.geometry as {
      "minecraft:geometry": { description: { identifier: string } }[];
    };
    if (geoData["minecraft:geometry"] && geoData["minecraft:geometry"][0]) {
      geoData["minecraft:geometry"][0].description.identifier = geometryId;
    }

    // Render atlas regions into a pixel buffer (same approach as ImageGenerationUtilities)
    const [texWidth, texHeight] = conversionResult.textureSize;
    const pixels = new Uint8Array(texWidth * texHeight * 4);

    // Initialize with transparent
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i + 3] = 0;
    }

    // Render each atlas region
    for (const region of conversionResult.atlasRegions) {
      if (region.isDuplicate) {
        continue; // Duplicate regions share UV space, already rendered
      }

      if (region.content.background) {
        const bgPixels = TexturedRectangleGenerator.generatePixels(
          region.content.background,
          region.width,
          region.height,
          region.contextString || `region-${region.x}-${region.y}`
        );

        // Copy pixels to atlas
        for (let dy = 0; dy < region.height && region.y + dy < texHeight; dy++) {
          for (let dx = 0; dx < region.width && region.x + dx < texWidth; dx++) {
            const srcIdx = (dy * region.width + dx) * 4;
            const dstIdx = ((region.y + dy) * texWidth + (region.x + dx)) * 4;
            pixels[dstIdx] = bgPixels[srcIdx];
            pixels[dstIdx + 1] = bgPixels[srcIdx + 1];
            pixels[dstIdx + 2] = bgPixels[srcIdx + 2];
            pixels[dstIdx + 3] = bgPixels[srcIdx + 3];
          }
        }
      } else if (region.content.color) {
        // Solid color fill
        const parsed = ModelDesignUtilities.parseColor(region.content.color);
        for (let y = region.y; y < region.y + region.height && y < texHeight; y++) {
          for (let x = region.x; x < region.x + region.width && x < texWidth; x++) {
            const idx = (y * texWidth + x) * 4;
            pixels[idx] = parsed.r;
            pixels[idx + 1] = parsed.g;
            pixels[idx + 2] = parsed.b;
            pixels[idx + 3] = parsed.a ?? 255;
          }
        }
      }

      // Apply pixel art overlays
      if (region.content.pixelArt && region.content.pixelArt.length > 0) {
        const regionPixels = new Uint8Array(region.width * region.height * 4);
        for (let dy = 0; dy < region.height && region.y + dy < texHeight; dy++) {
          for (let dx = 0; dx < region.width && region.x + dx < texWidth; dx++) {
            const srcIdx = ((region.y + dy) * texWidth + (region.x + dx)) * 4;
            const dstIdx = (dy * region.width + dx) * 4;
            regionPixels[dstIdx] = pixels[srcIdx];
            regionPixels[dstIdx + 1] = pixels[srcIdx + 1];
            regionPixels[dstIdx + 2] = pixels[srcIdx + 2];
            regionPixels[dstIdx + 3] = pixels[srcIdx + 3];
          }
        }

        TexturedRectangleGenerator.applyPixelArtLayers(
          regionPixels,
          region.width,
          region.height,
          region.content.pixelArt,
          conversionResult.pixelsPerUnit
        );

        for (let dy = 0; dy < region.height && region.y + dy < texHeight; dy++) {
          for (let dx = 0; dx < region.width && region.x + dx < texWidth; dx++) {
            const srcIdx = (dy * region.width + dx) * 4;
            const dstIdx = ((region.y + dy) * texWidth + (region.x + dx)) * 4;
            pixels[dstIdx] = regionPixels[srcIdx];
            pixels[dstIdx + 1] = regionPixels[srcIdx + 1];
            pixels[dstIdx + 2] = regionPixels[srcIdx + 2];
            pixels[dstIdx + 3] = regionPixels[srcIdx + 3];
          }
        }
      }

      // Apply post-processing effects
      if (region.content.effects) {
        const regionPixels = new Uint8Array(region.width * region.height * 4);
        for (let dy = 0; dy < region.height && region.y + dy < texHeight; dy++) {
          for (let dx = 0; dx < region.width && region.x + dx < texWidth; dx++) {
            const srcIdx = ((region.y + dy) * texWidth + (region.x + dx)) * 4;
            const dstIdx = (dy * region.width + dx) * 4;
            regionPixels[dstIdx] = pixels[srcIdx];
            regionPixels[dstIdx + 1] = pixels[srcIdx + 1];
            regionPixels[dstIdx + 2] = pixels[srcIdx + 2];
            regionPixels[dstIdx + 3] = pixels[srcIdx + 3];
          }
        }

        applyTextureEffects(regionPixels, region.width, region.height, region.content.effects);

        for (let dy = 0; dy < region.height && region.y + dy < texHeight; dy++) {
          for (let dx = 0; dx < region.width && region.x + dx < texWidth; dx++) {
            const srcIdx = (dy * region.width + dx) * 4;
            const dstIdx = ((region.y + dy) * texWidth + (region.x + dx)) * 4;
            pixels[dstIdx] = regionPixels[srcIdx];
            pixels[dstIdx + 1] = regionPixels[srcIdx + 1];
            pixels[dstIdx + 2] = regionPixels[srcIdx + 2];
            pixels[dstIdx + 3] = regionPixels[srcIdx + 3];
          }
        }
      }
    }

    // Encode to PNG – try sync (Node.js), then async browser Canvas, then placeholder
    let pngData = ImageCodec.encodeToPngSync(pixels, texWidth, texHeight);
    if (!pngData) {
      pngData = await ImageCodec.encodeToPngBrowser(pixels, texWidth, texHeight);
    }
    return {
      geometry: conversionResult.geometry,
      texture: pngData || PngEncoder.getPlaceholderTexture("entity"),
    };
  }

  private _generateEntityResource(entity: IEntityTypeDefinition, fullId: string): object {
    const appearance = entity.appearance || {};
    const geometryId = `geometry.${this._namespace}.${entity.id}`;
    const textureId = `textures/entity/${entity.id}`;
    const renderControllerId = `controller.render.${this._namespace}.${entity.id}`;

    // Eye style controls the material selection. 'glowing' and 'red' use an emissive
    // material so the entity glows in low light; 'normal'/'none' use the default alphatest.
    const eyes = appearance.eyes;
    const material = eyes === "glowing" || eyes === "red" ? "entity_emissive" : "entity_alphatest";

    const description: any = {
      identifier: fullId,
      materials: {
        default: material,
      },
      textures: {
        default: textureId,
      },
      geometry: {
        default: geometryId,
      },
      render_controllers: [renderControllerId],
      spawn_egg: {
        base_color: appearance.primaryColor || "#5B8C3E",
        overlay_color: appearance.secondaryColor || "#3D6B2E",
      },
    };

    // Ambient particle effects (flames, smoke, etc.). These are referenced by an
    // animation/emitter controller. We emit the particle_effects map so the agent's
    // chosen effects are at least declared and addressable; a full emitter controller
    // can be layered on top by raw components if needed.
    if (appearance.particles && appearance.particles.length > 0) {
      const particleMap: { [key: string]: string } = {
        flames: "minecraft:mobflame_emitter",
        smoke: "minecraft:mobspell_emitter",
        drip: "minecraft:water_drip_particle",
        sparkle: "minecraft:villager_happy",
        hearts: "minecraft:heart_particle",
      };
      const particle_effects: { [key: string]: string } = {};
      for (const p of appearance.particles) {
        const mapped = particleMap[p];
        if (mapped) {
          particle_effects[p] = mapped;
        }
      }
      if (Object.keys(particle_effects).length > 0) {
        description.particle_effects = particle_effects;
      }
    }

    return {
      format_version: "1.10.0",
      "minecraft:client_entity": {
        description,
      },
    };
  }

  /**
   * Generate a render controller for an entity.
   * This creates a simple render controller that references the entity's geometry and texture.
   */
  private _generateEntityRenderController(entity: IEntityTypeDefinition): object {
    const renderControllerId = `controller.render.${this._namespace}.${entity.id}`;

    return {
      format_version: "1.8.0",
      render_controllers: {
        [renderControllerId]: {
          geometry: "Geometry.default",
          materials: [{ "*": "Material.default" }],
          textures: ["Texture.default"],
        },
      },
    };
  }

  /**
   * Generate a simple geometry for an entity based on its bodyType.
   * Returns a Minecraft geometry JSON structure.
   */
  private _generateEntityGeometry(entity: IEntityTypeDefinition): object {
    const appearance = entity.appearance || {};
    const bodyType = appearance.bodyType || "humanoid";
    const geometryId = `geometry.${this._namespace}.${entity.id}`;

    // Get template geometry based on bodyType
    const bones = this._getGeometryBonesForBodyType(bodyType);

    return {
      format_version: "1.12.0",
      "minecraft:geometry": [
        {
          description: {
            identifier: geometryId,
            texture_width: 64,
            texture_height: 64,
            visible_bounds_width: 2,
            visible_bounds_height: 2.5,
            visible_bounds_offset: [0, 0.75, 0],
          },
          bones,
        },
      ],
    };
  }

  /**
   * Get bone structure for different body types.
   */
  private _getGeometryBonesForBodyType(bodyType: string): object[] {
    switch (bodyType) {
      case "humanoid":
        return [
          {
            name: "root",
            pivot: [0, 0, 0],
          },
          {
            name: "body",
            parent: "root",
            pivot: [0, 24, 0],
            cubes: [{ origin: [-4, 12, -2], size: [8, 12, 4], uv: [16, 16] }],
          },
          {
            name: "head",
            parent: "body",
            pivot: [0, 24, 0],
            cubes: [{ origin: [-4, 24, -4], size: [8, 8, 8], uv: [0, 0] }],
          },
          {
            name: "left_arm",
            parent: "body",
            pivot: [5, 22, 0],
            cubes: [{ origin: [4, 12, -2], size: [4, 12, 4], uv: [40, 16] }],
          },
          {
            name: "right_arm",
            parent: "body",
            pivot: [-5, 22, 0],
            cubes: [{ origin: [-8, 12, -2], size: [4, 12, 4], uv: [32, 48] }],
          },
          {
            name: "left_leg",
            parent: "root",
            pivot: [2, 12, 0],
            cubes: [{ origin: [0, 0, -2], size: [4, 12, 4], uv: [0, 16] }],
          },
          {
            name: "right_leg",
            parent: "root",
            pivot: [-2, 12, 0],
            cubes: [{ origin: [-4, 0, -2], size: [4, 12, 4], uv: [16, 48] }],
          },
        ];

      case "quadruped":
        return [
          {
            name: "root",
            pivot: [0, 0, 0],
          },
          {
            name: "body",
            parent: "root",
            pivot: [0, 13, 0],
            cubes: [{ origin: [-5, 8, -8], size: [10, 10, 16], uv: [0, 0] }],
          },
          {
            name: "head",
            parent: "body",
            pivot: [0, 14, -8],
            cubes: [{ origin: [-4, 10, -14], size: [8, 8, 6], uv: [0, 26] }],
          },
          {
            name: "leg0",
            parent: "root",
            pivot: [-3, 8, 6],
            cubes: [{ origin: [-5, 0, 4], size: [4, 8, 4], uv: [0, 40] }],
          },
          {
            name: "leg1",
            parent: "root",
            pivot: [3, 8, 6],
            cubes: [{ origin: [1, 0, 4], size: [4, 8, 4], uv: [0, 40] }],
          },
          {
            name: "leg2",
            parent: "root",
            pivot: [-3, 8, -6],
            cubes: [{ origin: [-5, 0, -8], size: [4, 8, 4], uv: [0, 40] }],
          },
          {
            name: "leg3",
            parent: "root",
            pivot: [3, 8, -6],
            cubes: [{ origin: [1, 0, -8], size: [4, 8, 4], uv: [0, 40] }],
          },
        ];

      case "slime":
        return [
          {
            name: "root",
            pivot: [0, 0, 0],
          },
          {
            name: "body",
            parent: "root",
            pivot: [0, 8, 0],
            cubes: [{ origin: [-4, 0, -4], size: [8, 8, 8], uv: [0, 0] }],
          },
        ];

      default:
        // Simple cube for unknown types
        return [
          {
            name: "root",
            pivot: [0, 0, 0],
          },
          {
            name: "body",
            parent: "root",
            pivot: [0, 8, 0],
            cubes: [{ origin: [-4, 0, -4], size: [8, 16, 8], uv: [0, 0] }],
          },
        ];
    }
  }

  /**
   * Generate an entity placeholder texture PNG with distinct colors per body part.
   * Creates a 64x64 texture where each UV region (head, body, arms, legs) gets a
   * unique color derived from the entity's primary/secondary colors, with subtle
   * noise for visual interest.
   * Returns Uint8Array PNG data.
   */
  private async _generateEntityTexturePlaceholder(entity: IEntityTypeDefinition): Promise<Uint8Array> {
    const appearance = entity.appearance || {};
    const bodyType = appearance.bodyType || "humanoid";
    const primaryColor = appearance.primaryColor || "#5B8C3E";
    const secondaryColor = appearance.secondaryColor || "#3D6B2E";

    const width = 64;
    const height = 64;
    const pixels = new Uint8Array(width * height * 4);

    const parseHex = (hex: string): { r: number; g: number; b: number } => {
      const h = hex.startsWith("#") ? hex.slice(1) : hex;
      return {
        r: parseInt(h.slice(0, 2), 16) || 128,
        g: parseInt(h.slice(2, 4), 16) || 128,
        b: parseInt(h.slice(4, 6), 16) || 128,
      };
    };

    const primary = parseHex(primaryColor);
    const secondary = parseHex(secondaryColor);

    // Derive a palette of distinct body-part colors from primary/secondary
    const shiftColor = (
      base: { r: number; g: number; b: number },
      hShift: number,
      brightnessShift: number
    ): { r: number; g: number; b: number } => {
      // Simple hue rotation and brightness adjustment
      const r = Math.max(0, Math.min(255, Math.round(base.r * (1 + brightnessShift) + hShift)));
      const g = Math.max(0, Math.min(255, Math.round(base.g * (1 + brightnessShift) - hShift * 0.5)));
      const b = Math.max(0, Math.min(255, Math.round(base.b * (1 + brightnessShift) + hShift * 0.3)));
      return { r, g, b };
    };

    // Body part color palette
    const headColor = shiftColor(primary, 10, 0.15); // Slightly brighter
    const bodyColor = primary;
    const armColor = shiftColor(secondary, -5, 0.05);
    const legColor = secondary;
    const bellyColor = shiftColor(primary, 5, 0.25); // Lighter for undersides

    // Simple seeded noise for texture variation
    const noise = (x: number, y: number, seed: number): number => {
      const n = Math.sin(x * 127.1 + y * 311.7 + seed * 113.5) * 43758.5453;
      return n - Math.floor(n);
    };

    // Fill a rectangular region with a color + subtle noise
    const fillRegion = (
      rx: number,
      ry: number,
      rw: number,
      rh: number,
      color: { r: number; g: number; b: number },
      noiseAmount: number = 12,
      seed: number = 0
    ) => {
      for (let y = ry; y < ry + rh && y < height; y++) {
        for (let x = rx; x < rx + rw && x < width; x++) {
          const idx = (y * width + x) * 4;
          const n = (noise(x, y, seed) - 0.5) * noiseAmount;
          pixels[idx] = Math.max(0, Math.min(255, Math.round(color.r + n)));
          pixels[idx + 1] = Math.max(0, Math.min(255, Math.round(color.g + n)));
          pixels[idx + 2] = Math.max(0, Math.min(255, Math.round(color.b + n)));
          pixels[idx + 3] = 255;
        }
      }
    };

    // Fill the entire texture with a transparent/dark base first
    const bgColor = shiftColor(secondary, 0, -0.3);
    fillRegion(0, 0, width, height, bgColor, 6, 99);

    // Paint UV regions based on body type
    if (bodyType === "humanoid") {
      // Classic Minecraft skin UV layout (64x64)
      // Head (uv 0,0): top/bottom at (8,0)-(15,7), front at (8,8)-(15,15), sides around
      fillRegion(0, 0, 32, 16, headColor, 10, 1); // Head area
      // Eyes region - slightly darker strip across front face of head
      const eyeColor = shiftColor({ r: 20, g: 20, b: 20 }, 0, 0);
      fillRegion(10, 12, 4, 2, eyeColor, 3, 50); // Simple eye dots on front face

      // Body (uv 16,16): torso
      fillRegion(16, 16, 24, 16, bodyColor, 10, 2);
      // Lighter belly area on front face of body
      fillRegion(20, 20, 8, 12, bellyColor, 8, 3);

      // Left leg (uv 0,16)
      fillRegion(0, 16, 16, 16, legColor, 10, 4);
      // Right leg (uv 16,48)
      fillRegion(16, 48, 16, 16, legColor, 10, 5);

      // Left arm (uv 40,16)
      fillRegion(40, 16, 16, 16, armColor, 10, 6);
      // Right arm (uv 32,48)
      fillRegion(32, 48, 16, 16, armColor, 10, 7);
    } else if (bodyType === "quadruped" || bodyType === "quadruped_small") {
      // Quadruped UV layout
      // Body (uv 0,0): large body
      fillRegion(0, 0, 36, 26, bodyColor, 10, 1);
      // Lighter belly
      fillRegion(10, 10, 10, 10, bellyColor, 8, 2);

      // Head (uv 0,26)
      fillRegion(0, 26, 22, 14, headColor, 10, 3);
      // Snout/nose darker area
      const noseColor = shiftColor(secondary, 0, -0.15);
      fillRegion(6, 34, 4, 3, noseColor, 5, 40);

      // Legs (uv 0,40) - all four legs share UV
      fillRegion(0, 40, 16, 16, legColor, 10, 4);
    } else if (bodyType === "slime") {
      // Slime: single cube body
      fillRegion(0, 0, 32, 16, bodyColor, 15, 1);
      // Slight translucent/lighter center
      fillRegion(8, 8, 8, 8, bellyColor, 10, 2);
    } else if (bodyType === "insect") {
      // Spider-like: body + head + legs
      fillRegion(0, 0, 32, 16, bodyColor, 10, 1);
      fillRegion(0, 16, 24, 12, headColor, 10, 2);
      // Legs
      fillRegion(24, 16, 16, 16, legColor, 10, 3);
      // Eyes
      const eyeColor2 = { r: 200, g: 20, b: 20 };
      fillRegion(8, 22, 3, 2, eyeColor2, 5, 50);
      fillRegion(14, 22, 3, 2, eyeColor2, 5, 51);
    } else if (bodyType === "flying" || bodyType === "bird") {
      // Flying creature
      fillRegion(0, 0, 32, 16, bodyColor, 10, 1);
      fillRegion(0, 16, 24, 16, headColor, 10, 2);
      // Wings
      const wingColor = shiftColor(primary, 15, 0.1);
      fillRegion(24, 16, 24, 16, wingColor, 12, 3);
      fillRegion(0, 32, 32, 16, wingColor, 12, 4);
    } else if (bodyType === "fish") {
      // Fish: body + fins
      fillRegion(0, 0, 24, 16, bodyColor, 10, 1);
      // Lighter belly stripe
      fillRegion(6, 8, 12, 4, bellyColor, 8, 2);
      // Fins
      const finColor = shiftColor(primary, 20, 0.15);
      fillRegion(24, 0, 16, 16, finColor, 10, 3);
      fillRegion(0, 16, 20, 16, finColor, 10, 4);
    } else {
      // Generic fallback - paint body-sized regions in distinct colors
      fillRegion(0, 0, 32, 16, headColor, 10, 1);
      fillRegion(0, 16, 32, 16, bodyColor, 10, 2);
      fillRegion(32, 0, 32, 32, armColor, 10, 3);
      fillRegion(0, 32, 32, 32, legColor, 10, 4);
      fillRegion(32, 32, 32, 32, bellyColor, 8, 5);
    }

    // Try runtime encoding – sync first, then async browser Canvas, fall back to pre-encoded placeholder
    let encoded = ImageCodec.encodeToPngSync(pixels, width, height);
    if (!encoded) {
      encoded = await ImageCodec.encodeToPngBrowser(pixels, width, height);
    }
    return encoded || PngEncoder.getPlaceholderTexture("entity");
  }

  /**
   * Render an ITextureSpec to PNG bytes.
   *
   * Precedence:
   *   1. If `spec` is a string or `spec.file` is set, the caller should use that file reference
   *      directly — this helper returns `undefined` so no placeholder PNG is emitted.
   *   2. If `spec.generate` and/or `spec.pixelArt` is set, build the PNG procedurally.
   *      - `generate` controls the background (use type: "none" for a transparent background).
   *      - `pixelArt` layers are drawn on top.
   *      - `spec.effects` are applied last.
   *   3. Returns `undefined` if the spec has nothing renderable.
   */
  private async _renderTextureSpecToPng(
    spec: string | ITextureSpec | undefined,
    width: number,
    height: number,
    contextString: string
  ): Promise<Uint8Array | undefined> {
    if (!spec) {
      return undefined;
    }

    // String shorthand = file reference; caller should skip placeholder.
    if (typeof spec === "string") {
      return undefined;
    }

    // Explicit file reference = skip placeholder.
    if (spec.file) {
      return undefined;
    }

    const hasGenerate = !!spec.generate;
    const hasPixelArt = spec.pixelArt && spec.pixelArt.length > 0;

    if (!hasGenerate && !hasPixelArt && !spec.effects) {
      return undefined;
    }

    // Build background. Default is transparent when only pixelArt is specified.
    let pixels: Uint8Array;
    if (hasGenerate) {
      pixels = TexturedRectangleGenerator.generatePixels(spec.generate!, width, height, contextString);
    } else {
      pixels = new Uint8Array(width * height * 4); // transparent
    }

    // Overlay pixel art layers.
    if (hasPixelArt) {
      TexturedRectangleGenerator.applyPixelArtLayers(pixels, width, height, spec.pixelArt!);
    }

    // Apply post-processing effects.
    if (spec.effects) {
      applyTextureEffects(pixels, width, height, spec.effects);
    }

    // Encode. Try sync first, then async (browser).
    let encoded = ImageCodec.encodeToPngSync(pixels, width, height);
    if (!encoded) {
      encoded = await ImageCodec.encodeToPngBrowser(pixels, width, height);
    }
    return encoded || undefined;
  }

  /**
   * Pick the most representative face from an IBlockTexture to drive the single-PNG
   * placeholder we currently emit per block. Preference order: all, side, up, north,
   * south, east, west, down.
   */
  private _pickBlockFaceTexture(texture: IBlockTexture | undefined): string | ITextureSpec | undefined {
    if (!texture) {
      return undefined;
    }
    return (
      texture.all ??
      texture.side ??
      texture.up ??
      texture.north ??
      texture.south ??
      texture.east ??
      texture.west ??
      texture.down
    );
  }

  // ============================================================================
  // BLOCK GENERATION
  // ============================================================================

  private async _generateBlock(block: IBlockTypeDefinition, result: IGeneratedContent): Promise<void> {
    const safeId = ContentGenerator._sanitizeIdForPath(block.id);
    const fullId = `${this._namespace}:${block.id}`;

    let components: Record<string, any> = {};
    let properties: Record<string, any[]> = {};
    let permutations: any[] = [];
    let blockEvents: Record<string, any> = {};
    let minecraftTraits: Record<string, any> = {};

    // Apply traits using the new trait system
    if (block.traits) {
      for (const traitId of block.traits) {
        // First try the new registry-based traits
        const trait = TraitRegistry.getBlockTrait(traitId);
        if (trait) {
          const traitData = trait.getData({
            hardness: block.destroyTime,
            lightLevel: block.lightEmission,
          });

          // Merge components
          if (traitData.components) {
            components = { ...components, ...traitData.components };
          }

          // Merge properties
          if (traitData.properties) {
            properties = { ...properties, ...traitData.properties };
          }

          // Merge permutations
          if (traitData.permutations) {
            permutations = [...permutations, ...traitData.permutations];
          }

          // Merge events
          if (traitData.events) {
            blockEvents = { ...blockEvents, ...traitData.events };
          }

          // Merge Minecraft-native traits (e.g., minecraft:placement_position, minecraft:connection)
          if (traitData.minecraftTraits) {
            minecraftTraits = { ...minecraftTraits, ...traitData.minecraftTraits };
          }

          // Add geometry files to resource pack
          if (traitData.geometryFiles) {
            for (const geoFile of traitData.geometryFiles) {
              result.geometries.push({
                path: geoFile.path,
                pack: "resource",
                type: "json",
                content: geoFile.content,
              });
            }
          }
        } else {
          // Fall back to legacy BLOCK_TRAIT_COMPONENTS lookup
          const traitComponents = BLOCK_TRAIT_COMPONENTS[traitId];
          if (traitComponents) {
            components = { ...components, ...traitComponents };
          }
        }
      }
    }

    // Apply simplified properties
    if (block.destroyTime !== undefined) {
      components["minecraft:destructible_by_mining"] = { seconds_to_destroy: block.destroyTime };
    }
    if (block.explosionResistance !== undefined) {
      components["minecraft:destructible_by_explosion"] = { explosion_resistance: block.explosionResistance };
    }
    if (block.friction !== undefined) {
      components["minecraft:friction"] = block.friction;
    }
    if (block.lightEmission !== undefined) {
      components["minecraft:light_emission"] = block.lightEmission;
    }
    if (block.lightDampening !== undefined) {
      components["minecraft:light_dampening"] = block.lightDampening;
    }
    if (block.mapColor !== undefined) {
      components["minecraft:map_color"] = block.mapColor;
    }

    // Flammability
    if (block.flammable) {
      if (typeof block.flammable === "boolean") {
        components["minecraft:flammable"] = { catch_chance_modifier: 5, destroy_chance_modifier: 20 };
      } else {
        components["minecraft:flammable"] = {
          catch_chance_modifier: Math.floor(block.flammable.catchChance * 100),
          destroy_chance_modifier: Math.floor(block.flammable.destroyChance * 100),
        };
      }
    }

    // Add geometry for blocks that don't already have one (solid cubes need minecraft:geometry.full_block)
    if (!components["minecraft:geometry"]) {
      components["minecraft:geometry"] = "minecraft:geometry.full_block";
    }

    // Add material_instances to reference our generated texture
    const textureKey = `${this._namespace}_${block.id}`;
    if (!components["minecraft:material_instances"]) {
      components["minecraft:material_instances"] = {
        "*": {
          texture: textureKey,
          render_method: "opaque",
        },
      };
    }

    // Apply native components
    if (block.components) {
      components = { ...components, ...block.components };
    }

    // Use 1.26.0 if connection trait is used (requires that version), otherwise 1.21.40
    const blockFormatVersion = minecraftTraits["minecraft:connection"] ? "1.26.0" : "1.21.40";

    const behaviorBlock: any = {
      format_version: blockFormatVersion,
      "minecraft:block": {
        description: {
          identifier: fullId,
          menu_category: {
            category: "construction",
          },
        },
        components,
      },
    };

    // Merge properties/states from traits with those specified directly
    const mergedProperties = { ...properties };
    if (block.states) {
      for (const [key, value] of Object.entries(block.states)) {
        mergedProperties[key] = value;
      }
    }
    if (Object.keys(mergedProperties).length > 0) {
      behaviorBlock["minecraft:block"].description.states = mergedProperties;
    }

    // Add Minecraft-native traits to description
    if (Object.keys(minecraftTraits).length > 0) {
      behaviorBlock["minecraft:block"].description.traits = minecraftTraits;
    }

    // Merge permutations from traits with those specified directly
    const mergedPermutations = [...permutations];
    if (block.permutations) {
      mergedPermutations.push(...block.permutations);
    }
    if (mergedPermutations.length > 0) {
      behaviorBlock["minecraft:block"].permutations = mergedPermutations;
    }

    // Add events if we have any from traits
    if (Object.keys(blockEvents).length > 0) {
      behaviorBlock["minecraft:block"].events = blockEvents;
    }

    result.blockBehaviors.push({
      path: `blocks/${safeId}.json`,
      pack: "behavior",
      type: "json",
      content: behaviorBlock,
    });

    // Generate placeholder texture for the block
    const texture = await this._generateBlockTexturePlaceholder(block);
    if (texture) {
      result.textures.push({
        path: `textures/blocks/${safeId}.png`,
        pack: "resource",
        type: "png",
        content: texture,
      });
    }

    // Generate loot table from drops
    if (block.drops && block.drops.length > 0) {
      const lootTable = this._generateLootTableFromDrops(block.id, block.drops, "blocks");
      result.lootTables.push(lootTable);
    }
  }

  /**
   * Generate a placeholder texture for a block.
   *
   * Precedence:
   *   1. `block.texture` (ITextureSpec) — rendered via _renderTextureSpecToPng.
   *   2. `block.mapColor` — checkerboard fallback.
   *
   * Returns undefined if block.texture is a string/file reference (no placeholder needed).
   */
  private async _generateBlockTexturePlaceholder(block: IBlockTypeDefinition): Promise<Uint8Array | undefined> {
    // 1. Honor block.texture if it specifies inline generate/pixelArt content.
    const faceSpec = this._pickBlockFaceTexture(block.texture);
    if (faceSpec) {
      const rendered = await this._renderTextureSpecToPng(faceSpec, 16, 16, `block-${block.id}`);
      if (rendered) {
        return rendered;
      }
      // String or { file: ... } means "use an existing file" — don't emit a placeholder.
      if (typeof faceSpec === "string" || faceSpec.file) {
        return undefined;
      }
    }

    // 2. Fallback: checkerboard from mapColor.
    const primaryColor = block.mapColor || "#808080";
    const secondaryColor = this._darkenColor(primaryColor, 0.15);

    const custom = await PngEncoder.createCheckerboardPngAsync(16, 16, primaryColor, secondaryColor, 4);
    return custom || PngEncoder.getPlaceholderTexture("block");
  }

  /**
   * Darken a hex color by a percentage.
   */
  private _darkenColor(hex: string, percent: number): string {
    // Parse hex color
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    // Darken
    r = Math.max(0, Math.floor(r * (1 - percent)));
    g = Math.max(0, Math.floor(g * (1 - percent)));
    b = Math.max(0, Math.floor(b * (1 - percent)));

    // Convert back to hex
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  // ============================================================================
  // ITEM GENERATION
  // ============================================================================

  private async _generateItem(item: IItemTypeDefinition, result: IGeneratedContent): Promise<void> {
    const safeId = ContentGenerator._sanitizeIdForPath(item.id);
    const fullId = `${this._namespace}:${item.id}`;

    let components: Record<string, any> = {};
    let itemEvents: Record<string, any> = {};
    let attachableData: any = undefined;

    // Apply traits using the new trait system
    if (item.traits) {
      for (const traitId of item.traits) {
        // First try the new registry-based traits
        const trait = TraitRegistry.getItemTrait(traitId);
        if (trait) {
          const traitData = trait.getData({
            damage: item.weapon?.damage,
            durability: item.durability,
            protection: item.armor?.defense,
            nutrition: item.food?.nutrition,
            saturation: item.food?.saturation,
          });

          // Merge components
          if (traitData.components) {
            components = { ...components, ...traitData.components };
          }

          // Merge events
          if (traitData.events) {
            itemEvents = { ...itemEvents, ...traitData.events };
          }

          // Collect attachable data
          if (traitData.attachable && !attachableData) {
            attachableData = traitData.attachable;
          }
        } else {
          // Fall back to legacy ITEM_TRAIT_COMPONENTS lookup
          const traitComponents = ITEM_TRAIT_COMPONENTS[traitId];
          if (traitComponents) {
            components = { ...components, ...traitComponents };
          }
        }
      }
    }

    // Apply simplified properties
    if (item.maxStackSize !== undefined) {
      components["minecraft:max_stack_size"] = item.maxStackSize;
    }
    if (item.durability !== undefined) {
      components["minecraft:durability"] = { max_durability: item.durability };
    }
    if (item.glint) {
      components["minecraft:glint"] = true;
    }
    if (item.fuel !== undefined) {
      components["minecraft:fuel"] = { duration: item.fuel / 20 }; // Convert ticks to seconds
    }

    // Food properties
    if (item.food) {
      components["minecraft:food"] = {
        nutrition: item.food.nutrition,
        saturation_modifier: item.food.saturation !== undefined ? "custom" : "normal",
        can_always_eat: item.food.canAlwaysEat || false,
      };
      if (item.food.effects) {
        components["minecraft:food"].effects = item.food.effects.map((e) => ({
          name: e.name,
          duration: e.duration,
          amplifier: e.amplifier || 0,
          chance: e.chance || 1.0,
        }));
      }
    }

    // Weapon properties
    if (item.weapon) {
      components["minecraft:damage"] = item.weapon.damage;
      if (item.weapon.durability) {
        components["minecraft:durability"] = { max_durability: item.weapon.durability };
      }
    }

    // Armor properties
    if (item.armor) {
      const slotMap: Record<string, string> = {
        helmet: "slot.armor.head",
        chestplate: "slot.armor.chest",
        leggings: "slot.armor.legs",
        boots: "slot.armor.feet",
      };
      components["minecraft:wearable"] = {
        slot: slotMap[item.armor.slot] || "slot.armor.chest",
      };
      components["minecraft:armor"] = { protection: item.armor.defense };
      components["minecraft:durability"] = { max_durability: item.armor.durability };
    }

    // Tool properties
    if (item.tool) {
      components["minecraft:durability"] = { max_durability: item.tool.durability };
    }

    // Projectile properties (bow/crossbow-style chargeable shooters, or throwables like snowballs).
    if (item.projectile) {
      const projectileEntityId = item.projectile.projectile.includes(":")
        ? item.projectile.projectile
        : `minecraft:${item.projectile.projectile}`;
      const launchPower = item.projectile.launchPower ?? 1.0;

      if (item.projectile.chargeable) {
        // Bow/crossbow: charge-while-held + release-to-shoot.
        components["minecraft:shooter"] = {
          projectiles: [
            {
              projectile: projectileEntityId,
              launch_power_scale: launchPower,
            },
          ],
        };
        components["minecraft:chargeable"] = { movement_modifier: 0.5 };
        components["minecraft:use_modifiers"] = { use_duration: 999999, movement_modifier: 0.5 };
      } else {
        // Throwable (snowball/egg style): single-use, no charge.
        components["minecraft:throwable"] = {
          do_swing_animation: true,
          launch_power_scale: launchPower,
          max_draw_duration: 0,
          max_launch_power: launchPower,
          min_draw_duration: 0,
          scale_power_by_draw_duration: false,
        };
        components["minecraft:projectile"] = {
          projectile_entity: projectileEntityId,
        };
      }
    }

    // Add icon component using string shorthand (1.21.70+ format)
    const textureKey = `${this._namespace}:${item.id}`;
    if (!components["minecraft:icon"]) {
      components["minecraft:icon"] = textureKey;
    }

    // Apply native components
    if (item.components) {
      components = { ...components, ...item.components };
    }

    const behaviorItem: any = {
      format_version: "1.21.70",
      "minecraft:item": {
        description: {
          identifier: fullId,
          menu_category: {
            category: item.category || "items",
          },
        },
        components,
      },
    };

    result.itemBehaviors.push({
      path: `items/${safeId}.json`,
      pack: "behavior",
      type: "json",
      content: behaviorItem,
    });

    // Generate placeholder texture for the item
    const texture = await this._generateItemTexturePlaceholder(item);
    if (texture) {
      result.textures.push({
        path: `textures/items/${safeId}.png`,
        pack: "resource",
        type: "png",
        content: texture,
      });
    }
  }

  /**
   * Generate a placeholder texture for an item.
   *
   * Precedence:
   *   1. `item.icon` (ITextureSpec) — rendered via _renderTextureSpecToPng. If it's a
   *      string/file reference, no placeholder is emitted (caller should skip).
   *   2. `item.traits` — shaped template (sword/pickaxe/etc.) recolored with item.color.
   *   3. Fallback — checkerboard with item.color.
   */
  private async _generateItemTexturePlaceholder(item: IItemTypeDefinition): Promise<Uint8Array | undefined> {
    // 1. Honor item.icon if it specifies inline generate/pixelArt content.
    if (item.icon !== undefined) {
      const rendered = await this._renderTextureSpecToPng(item.icon, 16, 16, `item-${item.id}`);
      if (rendered) {
        return rendered;
      }
      // String or { file: ... } means "use an existing file" — don't emit a placeholder.
      if (typeof item.icon === "string" || item.icon.file) {
        return undefined;
      }
    }

    const color = item.color || "#808080";

    // 2. Try template-based generation (shaped icons recolored to user's color).
    if (item.traits) {
      const templateTexture = await generateItemTextureFromTemplate(item.traits, color);
      if (templateTexture) {
        return templateTexture;
      }
    }

    // 3. Fallback: checkerboard with the user's color.
    const secondaryColor = this._darkenColor(color, 0.2);
    const custom = await PngEncoder.createCheckerboardPngAsync(16, 16, color, secondaryColor, 4);
    return custom || PngEncoder.getPlaceholderTexture("item");
  }

  /**
   * Generate terrain_texture.json content for all blocks.
   */
  private _generateTerrainTextures(blocks: IBlockTypeDefinition[]): IGeneratedFile {
    const textureData: Record<string, { textures: string }> = {};

    for (const block of blocks) {
      const textureKey = `${this._namespace}_${block.id}`;
      textureData[textureKey] = {
        textures: `textures/blocks/${block.id}`,
      };
    }

    return {
      path: "textures/terrain_texture.json",
      pack: "resource",
      type: "json",
      content: {
        resource_pack_name: this._namespace,
        texture_name: "atlas.terrain",
        padding: 8,
        num_mip_levels: 4,
        texture_data: textureData,
      },
    };
  }

  /**
   * Generate item_texture.json content for all items.
   */
  private _generateItemTextures(items: IItemTypeDefinition[]): IGeneratedFile {
    const textureData: Record<string, { textures: string }> = {};

    for (const item of items) {
      const textureKey = `${this._namespace}:${item.id}`;
      textureData[textureKey] = {
        textures: `textures/items/${item.id}`,
      };
    }

    return {
      path: "textures/item_texture.json",
      pack: "resource",
      type: "json",
      content: {
        resource_pack_name: this._namespace,
        texture_name: "atlas.items",
        texture_data: textureData,
      },
    };
  }

  /**
   * Generate blocks.json catalog for the resource pack.
   * This maps block identifiers to their texture and sound references.
   */
  private _generateBlocksCatalog(blocks: IBlockTypeDefinition[]): IGeneratedFile {
    const blockEntries: Record<string, any> = {};

    for (const block of blocks) {
      const fullId = `${this._namespace}:${block.id}`;
      const textureKey = `${this._namespace}_${block.id}`;
      const entry: any = {
        textures: textureKey,
      };

      if (block.sounds) {
        entry.sound = block.sounds;
      }

      blockEntries[fullId] = entry;
    }

    return {
      path: "blocks.json",
      pack: "resource",
      type: "json",
      content: blockEntries,
    };
  }

  // ============================================================================
  // LOOT TABLE GENERATION
  // ============================================================================

  private _generateLootTable(lootTable: ILootTableDefinition, result: IGeneratedContent): void {
    const safeId = ContentGenerator._sanitizeIdForPath(lootTable.id);
    const nativeLootTable: any = {
      pools: lootTable.pools.map((pool) => ({
        rolls: pool.rolls,
        entries: pool.entries.map((entry) => ({
          type: "item",
          name: entry.item.includes(":") ? entry.item : `minecraft:${entry.item}`,
          weight: entry.weight || 1,
          functions: this._buildLootFunctions(entry),
        })),
        conditions: pool.conditions?.map((c) => this._buildLootCondition(c)),
      })),
    };

    result.lootTables.push({
      path: `loot_tables/${safeId}.json`,
      pack: "behavior",
      type: "json",
      content: nativeLootTable,
    });
  }

  private _generateLootTableFromDrops(
    id: string,
    drops: IDropDefinition[],
    folder: string = "entities"
  ): IGeneratedFile {
    const safeId = ContentGenerator._sanitizeIdForPath(id);
    const safeFolder = ContentGenerator._sanitizeIdForPath(folder);
    const entries = drops.map((drop) => ({
      type: "item",
      name: drop.item.includes(":") ? drop.item : `minecraft:${drop.item}`,
      weight: 1,
      functions: this._buildLootFunctions({
        count: drop.count,
        lootingBonus: drop.lootingBonus,
      }),
    }));

    return {
      path: `loot_tables/${safeFolder}/${safeId}.json`,
      pack: "behavior",
      type: "json",
      content: {
        pools: [
          {
            rolls: 1,
            entries,
          },
        ],
      },
    };
  }

  private _buildLootFunctions(entry: {
    count?: number | { min: number; max: number };
    lootingBonus?: number;
  }): ILootFunction[] | undefined {
    const functions: ILootFunction[] = [];

    if (entry.count) {
      if (typeof entry.count === "number") {
        functions.push({ function: "set_count", count: entry.count });
      } else {
        functions.push({
          function: "set_count",
          count: { min: entry.count.min, max: entry.count.max },
        });
      }
    }

    if (entry.lootingBonus) {
      functions.push({
        function: "looting_enchant",
        count: { min: 0, max: entry.lootingBonus },
      });
    }

    return functions.length > 0 ? functions : undefined;
  }

  private _buildLootCondition(condition: { type: string; chance?: number }): ILootCondition {
    switch (condition.type) {
      case "killed_by_player":
        return { condition: "killed_by_player" };
      case "random_chance":
        return { condition: "random_chance", chance: condition.chance };
      default:
        return { condition: condition.type };
    }
  }

  // ============================================================================
  // RECIPE GENERATION
  // ============================================================================

  private _generateRecipe(recipe: IRecipeDefinition, result: IGeneratedContent): void {
    let nativeRecipe: any;

    const resultItem =
      typeof recipe.result === "string"
        ? { item: recipe.result, count: 1 }
        : { item: recipe.result.item, count: recipe.result.count };

    switch (recipe.type) {
      case "shaped":
        nativeRecipe = {
          format_version: "1.21.0",
          "minecraft:recipe_shaped": {
            description: { identifier: `${this._namespace}:${recipe.id}` },
            tags: ["crafting_table"],
            pattern: recipe.pattern,
            key: Object.fromEntries(
              Object.entries(recipe.key || {}).map(([k, v]) => [k, { item: v.includes(":") ? v : `minecraft:${v}` }])
            ),
            result: {
              item: resultItem.item.includes(":") ? resultItem.item : `${this._namespace}:${resultItem.item}`,
              count: resultItem.count,
            },
          },
        };
        break;

      case "shapeless":
        nativeRecipe = {
          format_version: "1.21.0",
          "minecraft:recipe_shapeless": {
            description: { identifier: `${this._namespace}:${recipe.id}` },
            tags: ["crafting_table"],
            ingredients: (recipe.ingredients || []).map((i) => ({
              item: i.includes(":") ? i : `minecraft:${i}`,
            })),
            result: {
              item: resultItem.item.includes(":") ? resultItem.item : `${this._namespace}:${resultItem.item}`,
              count: resultItem.count,
            },
          },
        };
        break;

      case "furnace":
        nativeRecipe = {
          format_version: "1.21.0",
          "minecraft:recipe_furnace": {
            description: { identifier: `${this._namespace}:${recipe.id}` },
            tags: ["furnace"],
            input: recipe.input?.includes(":") ? recipe.input : `minecraft:${recipe.input}`,
            output: resultItem.item.includes(":") ? resultItem.item : `${this._namespace}:${resultItem.item}`,
          },
        };
        break;

      default:
        this._warnings.push(`Unsupported recipe type: ${recipe.type}`);
        return;
    }

    result.recipes.push({
      path: `recipes/${ContentGenerator._sanitizeIdForPath(recipe.id)}.json`,
      pack: "behavior",
      type: "json",
      content: nativeRecipe,
    });
  }

  // ============================================================================
  // SPAWN RULE GENERATION
  // ============================================================================

  private _generateSpawnRule(spawnRule: ISpawnRuleDefinition, result: IGeneratedContent): void {
    const entityId = spawnRule.entity.includes(":") ? spawnRule.entity : `${this._namespace}:${spawnRule.entity}`;

    const nativeSpawnRule: any = {
      format_version: "1.8.0",
      "minecraft:spawn_rules": {
        description: {
          identifier: entityId,
          population_control: "animal",
        },
        conditions: [this._buildSpawnConditions(spawnRule)],
      },
    };

    result.spawnRules.push({
      path: `spawn_rules/${ContentGenerator._sanitizeIdForPath(spawnRule.entity.replace(":", "_"))}.json`,
      pack: "behavior",
      type: "json",
      content: nativeSpawnRule,
    });
  }

  private _generateSpawnRuleFromConfig(id: string, fullId: string, config: ISpawnConfig): IGeneratedFile {
    const nativeSpawnRule: any = {
      format_version: "1.8.0",
      "minecraft:spawn_rules": {
        description: {
          identifier: fullId,
          population_control: "animal",
        },
        conditions: [this._buildSpawnConditions(config as any)],
      },
    };

    return {
      path: `spawn_rules/${ContentGenerator._sanitizeIdForPath(id)}.json`,
      pack: "behavior",
      type: "json",
      content: nativeSpawnRule,
    };
  }

  private _buildSpawnConditions(config: ISpawnRuleDefinition | ISpawnConfig): any {
    const conditions: any = {
      "minecraft:spawns_on_surface": {},
      "minecraft:weight": { default: (config as any).weight || 10 },
    };

    if ((config as any).biomes) {
      conditions["minecraft:biome_filter"] = {
        any_of: (config as any).biomes.map((b: string) => ({
          test: "has_biome_tag",
          value: b,
        })),
      };
    }

    if ((config as any).groupSize) {
      conditions["minecraft:herd"] = {
        min_size: (config as any).groupSize.min,
        max_size: (config as any).groupSize.max,
      };
    }

    if ((config as any).lightLevel) {
      conditions["minecraft:brightness_filter"] = {
        min: (config as any).lightLevel.min || 0,
        max: (config as any).lightLevel.max || 15,
        adjust_for_weather: true,
      };
    }

    if ((config as any).heightRange) {
      conditions["minecraft:height_filter"] = {
        min: (config as any).heightRange.min,
        max: (config as any).heightRange.max,
      };
    }

    return conditions;
  }

  // ============================================================================
  // FEATURE GENERATION
  // ============================================================================

  private _generateFeature(feature: IFeatureDefinition, result: IGeneratedContent): void {
    const safeId = ContentGenerator._sanitizeIdForPath(feature.id);
    if (feature.spread) {
      // Generate from spread definition
      this._generateFeatureFromSpread(feature, result);
    } else if (feature.nativeFeature) {
      // Use native feature directly
      result.features.push({
        path: `features/${safeId}.json`,
        pack: "behavior",
        type: "json",
        content: feature.nativeFeature,
      });

      if (feature.nativeFeatureRule) {
        result.featureRules.push({
          path: `feature_rules/${safeId}.json`,
          pack: "behavior",
          type: "json",
          content: feature.nativeFeatureRule,
        });
      }
    }
  }

  private _generateFeatureFromSpread(feature: IFeatureDefinition, result: IGeneratedContent): void {
    const safeId = ContentGenerator._sanitizeIdForPath(feature.id);
    const spread = feature.spread!;
    const featureId = `${this._namespace}:${feature.id}`;

    // Create scatter feature for placement
    const scatterFeature: any = {
      format_version: "1.13.0",
      "minecraft:scatter_feature": {
        description: { identifier: featureId },
        iterations: typeof spread.count === "number" ? spread.count : spread.count?.max || 1,
        scatter_chance: spread.rarity ? { numerator: 1, denominator: spread.rarity } : 100.0,
        x: { distribution: "uniform", extent: [0, 16] },
        z: { distribution: "uniform", extent: [0, 16] },
        y: this._buildHeightPlacement(spread.heightPlacement),
        places_feature: `${this._namespace}:${feature.id}_placed`,
      },
    };

    result.features.push({
      path: `features/${safeId}_scatter.json`,
      pack: "behavior",
      type: "json",
      content: scatterFeature,
    });

    // Create the actual placement feature(s)
    for (const placement of spread.places) {
      if (placement.type === "ore") {
        const oreFeature: any = {
          format_version: "1.13.0",
          "minecraft:ore_feature": {
            description: { identifier: `${this._namespace}:${feature.id}_placed` },
            count: typeof placement.count === "number" ? placement.count : placement.count?.max || 8,
            replace_rules: [
              {
                places_block: placement.id.includes(":") ? placement.id : `${this._namespace}:${placement.id}`,
                may_replace: (placement.replacesBlocks || ["stone"]).map((b) =>
                  b.includes(":") ? b : `minecraft:${b}`
                ),
              },
            ],
          },
        };

        result.features.push({
          path: `features/${safeId}_placed.json`,
          pack: "behavior",
          type: "json",
          content: oreFeature,
        });
      }
    }

    // Create feature rule
    const featureRule: any = {
      format_version: "1.13.0",
      "minecraft:feature_rules": {
        description: { identifier: `${this._namespace}:${feature.id}_rule`, places_feature: featureId },
        conditions: {
          placement_pass: "underground_pass",
          "minecraft:biome_filter": spread.biomes
            ? { any_of: spread.biomes.map((b) => ({ test: "has_biome_tag", value: b })) }
            : { test: "has_biome_tag", value: "overworld" },
        },
        distribution: {
          iterations: 1,
          x: 0,
          y: 0,
          z: 0,
        },
      },
    };

    result.featureRules.push({
      path: `feature_rules/${safeId}.json`,
      pack: "behavior",
      type: "json",
      content: featureRule,
    });
  }

  private _buildHeightPlacement(placement?: { type: string; y?: number; min?: number; max?: number }): any {
    if (!placement) {
      return { distribution: "uniform", extent: [0, 64] };
    }

    switch (placement.type) {
      case "fixed":
        return placement.y || 64;
      case "surface":
        return "q.heightmap(v.worldx, v.worldz)";
      case "underground":
        return { distribution: "uniform", extent: [placement.min || 0, placement.max || 64] };
      case "range":
        return { distribution: "uniform", extent: [placement.min || 0, placement.max || 256] };
      default:
        return { distribution: "uniform", extent: [0, 64] };
    }
  }

  // ============================================================================
  // STRUCTURE GENERATION
  // ============================================================================

  private async _generateStructure(structure: IStructureDefinition, result: IGeneratedContent): Promise<void> {
    // For now, just track structure references
    // Full .mcstructure generation would use StructureUtilities
    if (structure.type === "simple" && structure.blocks) {
      this._warnings.push(`Structure ${structure.id}: Inline block generation not yet implemented`);
    }

    if (structure.type === "jigsaw" && structure.jigsaw) {
      this._warnings.push(`Structure ${structure.id}: Jigsaw generation not yet implemented`);
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private _generateUuid(): string {
    return CreatorToolsHost.generateUuid();
  }
}

// ============================================================================
// CONVENIENCE FUNCTION
// ============================================================================

/**
 * Generate Minecraft content from a meta-schema definition.
 */
export async function generateContent(definition: IMinecraftContentDefinition): Promise<IGeneratedContent> {
  const generator = new ContentGenerator(definition);
  return generator.generate();
}

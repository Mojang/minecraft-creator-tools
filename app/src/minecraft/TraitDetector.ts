// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * TraitDetector - Maps native Minecraft components to trait identifiers.
 *
 * This module analyzes Minecraft Bedrock content (entity/block/item definitions)
 * and detects which traits from the Content Meta-Schema would produce similar
 * component configurations. This enables reverse-engineering of existing content
 * into the simplified meta-schema format.
 *
 * @see ContentSchemaInferrer.ts for the main orchestrator
 * @see IContentMetaSchema.ts for trait type definitions
 */

import { EntityTraitId, BlockTraitId, ItemTraitId, EntityBehaviorPreset } from "./IContentMetaSchema";

// ============================================================================
// TRAIT DETECTION RESULT
// ============================================================================

/**
 * Result of trait detection with confidence scoring.
 */
export interface ITraitDetectionResult<T extends string> {
  /** The detected trait ID */
  traitId: T;

  /** Confidence score 0-1 (1 = perfect match, 0.6 = likely match) */
  confidence: number;

  /** Components that matched this trait */
  matchedComponents: string[];

  /** Optional notes about the detection */
  notes?: string;
}

/**
 * Result of simplified property extraction.
 */
export interface IExtractedProperties {
  // Entity properties
  health?: number;
  attackDamage?: number;
  movementSpeed?: number;
  scale?: number;
  followRange?: number;
  knockbackResistance?: number;
  collisionWidth?: number;
  collisionHeight?: number;
  families?: string[];

  // Block properties
  destroyTime?: number;
  explosionResistance?: number;
  lightEmission?: number;
  lightDampening?: number;
  friction?: number;
  mapColor?: string;

  // Item properties
  maxStackSize?: number;
  durability?: number;
  damage?: number;
  nutrition?: number;
  saturation?: number;
}

// ============================================================================
// ENTITY TRAIT SIGNATURES
// ============================================================================

/**
 * Signature definition for detecting a trait.
 * Components can be required (must be present) or optional (increase confidence).
 */
interface ITraitSignature {
  /** Components that MUST be present (or in component_groups) */
  requiredComponents?: string[];

  /** Components that increase confidence if present */
  optionalComponents?: string[];

  /** Custom validation function for complex matching */
  validator?: (components: Record<string, any>, componentGroups?: Record<string, any>) => number;

  /** Traits that conflict with this one (mutually exclusive) */
  conflictsWith?: string[];
}

/**
 * Entity trait signature definitions.
 */
const ENTITY_TRAIT_SIGNATURES: Record<EntityTraitId, ITraitSignature> = {
  // Body types — these are primarily about the visual model and animation rig,
  // not easily detectable from behavior components alone. We check type_family
  // for clues but these are intentionally conservative.
  humanoid: {
    optionalComponents: ["minecraft:can_climb", "minecraft:type_family"],
    validator: (components) => {
      // Humanoid detection requires strong signals from type_family
      const typeFamily = components["minecraft:type_family"];
      if (typeFamily) {
        const families: string[] = typeFamily.family || [];
        const humanoidFamilies = ["zombie", "skeleton", "humanoid", "piglin", "villager", "illager", "witch", "player"];
        if (families.some((f) => humanoidFamilies.includes(f.toLowerCase()))) return 0.9;
      }
      // Without type_family signals, no confident detection
      return 0;
    },
  },

  quadruped: {
    optionalComponents: ["minecraft:behavior.follow_parent", "minecraft:type_family"],
    validator: (components) => {
      // Quadruped detection uses type_family animal clues + follow_parent pattern
      const typeFamily = components["minecraft:type_family"];
      const hasFollowParent = "minecraft:behavior.follow_parent" in components;
      if (typeFamily) {
        const families: string[] = typeFamily.family || [];
        const quadrupedFamilies = [
          "cow",
          "pig",
          "sheep",
          "horse",
          "donkey",
          "mule",
          "llama",
          "goat",
          "wolf",
          "fox",
          "cat",
          "ocelot",
          "animal",
        ];
        if (families.some((f) => quadrupedFamilies.includes(f.toLowerCase()))) return 0.9;
      }
      // follow_parent + breedable suggests a land animal but not enough for body type
      const hasBreedable = "minecraft:breedable" in components;
      if (hasFollowParent && hasBreedable) return 0.5;
      return 0;
    },
  },

  quadruped_small: {
    optionalComponents: ["minecraft:scale"],
    validator: (components) => {
      const scale = components["minecraft:scale"]?.value;
      if (scale && scale < 0.7) return 0.7;
      return 0;
    },
  },

  flying: {
    requiredComponents: ["minecraft:navigation.fly"],
    optionalComponents: ["minecraft:can_fly", "minecraft:behavior.float"],
    validator: (components) => {
      const hasFlyNav = "minecraft:navigation.fly" in components;
      const hasCanFly = "minecraft:can_fly" in components;
      if (hasFlyNav && hasCanFly) return 1.0;
      if (hasFlyNav) return 0.8;
      if (hasCanFly) return 0.6;
      return 0;
    },
  },

  aquatic: {
    requiredComponents: ["minecraft:navigation.swim"],
    optionalComponents: ["minecraft:underwater_movement", "minecraft:breathable"],
    validator: (components) => {
      const hasSwimNav = "minecraft:navigation.swim" in components;
      const hasUnderwaterMovement = "minecraft:underwater_movement" in components;
      const breathable = components["minecraft:breathable"];
      const breathesWater = breathable?.breathes_water === true;

      if (hasSwimNav && breathesWater) return 1.0;
      if (hasSwimNav && hasUnderwaterMovement) return 0.9;
      if (hasSwimNav) return 0.7;
      return 0;
    },
  },

  arthropod: {
    optionalComponents: ["minecraft:can_climb", "minecraft:mark_variant"],
    validator: (components) => {
      // Arthropods typically have climbing ability and multiple variants
      const hasClimb = "minecraft:can_climb" in components;
      const hasVariant = "minecraft:mark_variant" in components;
      return hasClimb && hasVariant ? 0.6 : 0;
    },
  },

  slime: {
    optionalComponents: ["minecraft:movement.sway"],
    validator: (components) => {
      return "minecraft:movement.sway" in components ? 0.8 : 0;
    },
  },

  // Behavior archetypes
  hostile: {
    optionalComponents: ["minecraft:behavior.nearest_attackable_target", "minecraft:behavior.hurt_by_target"],
    conflictsWith: ["passive"],
    validator: (components) => {
      const hasTargeting = "minecraft:behavior.nearest_attackable_target" in components;
      const hasHurtBy = "minecraft:behavior.hurt_by_target" in components;
      const hasAttack = "minecraft:attack" in components || "minecraft:behavior.melee_attack" in components;

      // Check if targeting players
      const targeting = components["minecraft:behavior.nearest_attackable_target"];
      const targetsPlayers = targeting ? JSON.stringify(targeting).includes("player") : false;

      if (hasTargeting && targetsPlayers && hasAttack) return 1.0;
      if (hasTargeting && hasAttack) return 0.8;
      if (hasHurtBy && hasAttack) return 0.7;
      return 0;
    },
  },

  passive: {
    requiredComponents: ["minecraft:behavior.panic"],
    conflictsWith: ["hostile"],
    validator: (components) => {
      const hasPanic = "minecraft:behavior.panic" in components;
      const hasNoAttack = !("minecraft:attack" in components) && !("minecraft:behavior.melee_attack" in components);

      if (hasPanic && hasNoAttack) return 1.0;
      if (hasPanic) return 0.7;
      return 0;
    },
  },

  neutral: {
    optionalComponents: ["minecraft:behavior.hurt_by_target"],
    conflictsWith: ["hostile", "passive"],
    validator: (components) => {
      const hurtBy = components["minecraft:behavior.hurt_by_target"];
      const alertsSameType = hurtBy?.alert_same_type === true;
      const hasPanic = "minecraft:behavior.panic" in components;
      const hasAttack = "minecraft:attack" in components;

      // Neutral mobs retaliate but don't seek targets
      if (alertsSameType && !("minecraft:behavior.nearest_attackable_target" in components)) return 0.9;
      if (hurtBy && hasAttack && hasPanic) return 0.7;
      return 0;
    },
  },

  boss: {
    requiredComponents: ["minecraft:boss"],
    validator: (components) => {
      return "minecraft:boss" in components ? 1.0 : 0;
    },
  },

  // Combat styles
  melee_attacker: {
    requiredComponents: ["minecraft:behavior.melee_attack"],
    optionalComponents: ["minecraft:attack"],
    validator: (components) => {
      const hasMelee = "minecraft:behavior.melee_attack" in components;
      const hasAttack = "minecraft:attack" in components;

      if (hasMelee && hasAttack) return 1.0;
      if (hasMelee) return 0.8;
      return 0;
    },
  },

  ranged_attacker: {
    requiredComponents: ["minecraft:behavior.ranged_attack"],
    optionalComponents: ["minecraft:shooter"],
    validator: (components) => {
      const hasRanged = "minecraft:behavior.ranged_attack" in components;
      const hasShooter = "minecraft:shooter" in components;

      if (hasRanged && hasShooter) return 1.0;
      if (hasRanged) return 0.8;
      return 0;
    },
  },

  exploder: {
    requiredComponents: ["minecraft:explode"],
    validator: (components) => {
      return "minecraft:explode" in components ? 1.0 : 0;
    },
  },

  // Interaction patterns
  trader: {
    requiredComponents: ["minecraft:trade_table"],
    optionalComponents: ["minecraft:behavior.trade_with_player"],
    validator: (components) => {
      const hasTradeTable = "minecraft:trade_table" in components;
      const hasTradeBehavior = "minecraft:behavior.trade_with_player" in components;

      if (hasTradeTable && hasTradeBehavior) return 1.0;
      if (hasTradeTable) return 0.9;
      return 0;
    },
  },

  tameable: {
    requiredComponents: ["minecraft:tameable"],
    optionalComponents: ["minecraft:is_tamed"],
    validator: (components, componentGroups) => {
      // Check both direct components and component groups
      const hasTameable =
        "minecraft:tameable" in components ||
        (componentGroups && Object.values(componentGroups).some((g: any) => "minecraft:tameable" in g));
      const hasIsTamed =
        "minecraft:is_tamed" in components ||
        (componentGroups && Object.values(componentGroups).some((g: any) => "minecraft:is_tamed" in g));

      if (hasTameable) return 1.0;
      if (hasIsTamed) return 0.7;
      return 0;
    },
  },

  rideable: {
    requiredComponents: ["minecraft:rideable"],
    optionalComponents: ["minecraft:input_ground_controlled"],
    validator: (components, componentGroups) => {
      // Check both direct components and component groups
      const hasRideable =
        "minecraft:rideable" in components ||
        (componentGroups && Object.values(componentGroups).some((g: any) => "minecraft:rideable" in g));
      const hasInput =
        "minecraft:input_ground_controlled" in components ||
        (componentGroups && Object.values(componentGroups).some((g: any) => "minecraft:input_ground_controlled" in g));

      if (hasRideable && hasInput) return 1.0;
      if (hasRideable) return 0.9;
      return 0;
    },
  },

  breedable: {
    requiredComponents: ["minecraft:breedable"],
    optionalComponents: ["minecraft:behavior.breed"],
    validator: (components, componentGroups) => {
      const hasBreedable =
        "minecraft:breedable" in components ||
        (componentGroups && Object.values(componentGroups).some((g: any) => "minecraft:breedable" in g));
      const hasBreedBehavior = "minecraft:behavior.breed" in components;

      if (hasBreedable && hasBreedBehavior) return 1.0;
      if (hasBreedable) return 0.9;
      return 0;
    },
  },

  leasable: {
    requiredComponents: ["minecraft:leashable"],
    validator: (components) => {
      return "minecraft:leashable" in components ? 1.0 : 0;
    },
  },

  // Special behaviors
  undead: {
    optionalComponents: ["minecraft:burns_in_daylight", "minecraft:type_family"],
    validator: (components) => {
      const burnsDaylight = "minecraft:burns_in_daylight" in components;
      const typeFamily = components["minecraft:type_family"];
      const isUndeadFamily =
        typeFamily?.family?.includes("undead") || (typeFamily ? JSON.stringify(typeFamily).includes("undead") : false);

      if (burnsDaylight && isUndeadFamily) return 1.0;
      if (burnsDaylight) return 0.9;
      if (isUndeadFamily) return 0.7;
      return 0;
    },
  },

  illager: {
    optionalComponents: ["minecraft:behavior.raid_garden", "minecraft:type_family"],
    validator: (components) => {
      const hasRaidGarden = "minecraft:behavior.raid_garden" in components;
      const typeFamily = components["minecraft:type_family"];
      const isIllagerFamily = typeFamily ? JSON.stringify(typeFamily).includes("illager") : false;

      if (hasRaidGarden && isIllagerFamily) return 1.0;
      if (isIllagerFamily) return 0.8;
      return 0;
    },
  },

  aquatic_only: {
    optionalComponents: ["minecraft:breathable"],
    validator: (components) => {
      const breathable = components["minecraft:breathable"];
      const breathesWater = breathable?.breathes_water === true;
      const breathesAir = breathable?.breathes_air !== false;

      if (breathesWater && !breathesAir) return 1.0;
      return 0;
    },
  },

  baby_variant: {
    optionalComponents: ["minecraft:is_baby", "minecraft:ageable"],
    validator: (components, componentGroups) => {
      // Check component groups for baby state
      const hasIsBaby =
        "minecraft:is_baby" in components ||
        (componentGroups && Object.values(componentGroups).some((g: any) => "minecraft:is_baby" in g));
      const hasAgeable = "minecraft:ageable" in components;

      if (hasIsBaby && hasAgeable) return 1.0;
      if (hasAgeable) return 0.8;
      if (hasIsBaby) return 0.7;
      return 0;
    },
  },

  wanders: {
    requiredComponents: ["minecraft:behavior.random_stroll"],
    optionalComponents: ["minecraft:behavior.random_look_around"],
    validator: (components) => {
      const hasStroll = "minecraft:behavior.random_stroll" in components;
      const hasLookAround = "minecraft:behavior.random_look_around" in components;

      if (hasStroll && hasLookAround) return 1.0;
      if (hasStroll) return 0.9;
      return 0;
    },
  },

  patrols: {
    requiredComponents: ["minecraft:behavior.move_to_poi"],
    validator: (components) => {
      return "minecraft:behavior.move_to_poi" in components ? 0.9 : 0;
    },
  },

  guards: {
    requiredComponents: ["minecraft:behavior.defend_village_target"],
    validator: (components) => {
      return "minecraft:behavior.defend_village_target" in components ? 1.0 : 0;
    },
  },

  flees_daylight: {
    requiredComponents: ["minecraft:behavior.flee_sun"],
    validator: (components) => {
      return "minecraft:behavior.flee_sun" in components ? 1.0 : 0;
    },
  },

  teleporter: {
    optionalComponents: ["minecraft:teleport"],
    validator: (components) => {
      return "minecraft:teleport" in components ? 1.0 : 0;
    },
  },
};

// ============================================================================
// BEHAVIOR PRESET SIGNATURES
// ============================================================================

const BEHAVIOR_PRESET_SIGNATURES: Record<EntityBehaviorPreset, ITraitSignature> = {
  // Movement
  wander: {
    requiredComponents: ["minecraft:behavior.random_stroll"],
    validator: (c) => ("minecraft:behavior.random_stroll" in c ? 1.0 : 0),
  },
  swim: {
    requiredComponents: ["minecraft:behavior.swim_idle"],
    validator: (c) => ("minecraft:behavior.swim_idle" in c || "minecraft:navigation.swim" in c ? 0.8 : 0),
  },
  fly_around: {
    requiredComponents: ["minecraft:behavior.fly_idle"],
    validator: (c) => ("minecraft:behavior.fly_idle" in c ? 1.0 : 0),
  },
  float: {
    requiredComponents: ["minecraft:behavior.float"],
    validator: (c) => ("minecraft:behavior.float" in c ? 1.0 : 0),
  },
  climb: {
    requiredComponents: ["minecraft:can_climb"],
    validator: (c) => ("minecraft:can_climb" in c ? 1.0 : 0),
  },

  // Combat
  melee_attack: {
    requiredComponents: ["minecraft:behavior.melee_attack"],
    validator: (c) => ("minecraft:behavior.melee_attack" in c ? 1.0 : 0),
  },
  ranged_attack: {
    requiredComponents: ["minecraft:behavior.ranged_attack"],
    validator: (c) => ("minecraft:behavior.ranged_attack" in c ? 1.0 : 0),
  },
  target_players: {
    requiredComponents: ["minecraft:behavior.nearest_attackable_target"],
    validator: (c) => {
      const targeting = c["minecraft:behavior.nearest_attackable_target"];
      return targeting && JSON.stringify(targeting).includes("player") ? 1.0 : 0;
    },
  },
  target_monsters: {
    requiredComponents: ["minecraft:behavior.nearest_attackable_target"],
    validator: (c) => {
      const targeting = c["minecraft:behavior.nearest_attackable_target"];
      return targeting && JSON.stringify(targeting).includes("monster") ? 1.0 : 0;
    },
  },
  flee_when_hurt: {
    requiredComponents: ["minecraft:behavior.panic"],
    validator: (c) => ("minecraft:behavior.panic" in c ? 1.0 : 0),
  },
  retaliate: {
    requiredComponents: ["minecraft:behavior.hurt_by_target"],
    validator: (c) => ("minecraft:behavior.hurt_by_target" in c ? 1.0 : 0),
  },

  // Social
  follow_owner: {
    requiredComponents: ["minecraft:behavior.follow_owner"],
    validator: (c) => ("minecraft:behavior.follow_owner" in c ? 1.0 : 0),
  },
  follow_parent: {
    requiredComponents: ["minecraft:behavior.follow_parent"],
    validator: (c) => ("minecraft:behavior.follow_parent" in c ? 1.0 : 0),
  },
  herd: {
    requiredComponents: ["minecraft:behavior.move_towards_dwelling_restriction"],
    validator: (c) => ("minecraft:behavior.move_towards_dwelling_restriction" in c ? 0.7 : 0),
  },
  avoid_players: {
    requiredComponents: ["minecraft:behavior.avoid_mob_type"],
    validator: (c) => {
      const avoid = c["minecraft:behavior.avoid_mob_type"];
      return avoid && JSON.stringify(avoid).includes("player") ? 1.0 : 0;
    },
  },

  // Interaction
  look_at_player: {
    requiredComponents: ["minecraft:behavior.look_at_player"],
    validator: (c) => ("minecraft:behavior.look_at_player" in c ? 1.0 : 0),
  },
  beg: {
    requiredComponents: ["minecraft:behavior.beg"],
    validator: (c) => ("minecraft:behavior.beg" in c ? 1.0 : 0),
  },
  tempt: {
    requiredComponents: ["minecraft:behavior.tempt"],
    validator: (c) => ("minecraft:behavior.tempt" in c ? 1.0 : 0),
  },
  sit_command: {
    requiredComponents: ["minecraft:behavior.sit"],
    validator: (c) => ("minecraft:behavior.sit" in c ? 1.0 : 0),
  },

  // Actions
  eat_grass: {
    requiredComponents: ["minecraft:behavior.eat_block"],
    validator: (c) => ("minecraft:behavior.eat_block" in c ? 1.0 : 0),
  },
  break_doors: {
    requiredComponents: ["minecraft:behavior.break_door"],
    validator: (c) => ("minecraft:behavior.break_door" in c ? 1.0 : 0),
  },
  open_doors: {
    requiredComponents: ["minecraft:behavior.open_door"],
    validator: (c) => ("minecraft:behavior.open_door" in c ? 1.0 : 0),
  },
  pick_up_items: {
    requiredComponents: ["minecraft:behavior.pickup_items"],
    validator: (c) => ("minecraft:behavior.pickup_items" in c ? 1.0 : 0),
  },
  sleep_in_bed: {
    requiredComponents: ["minecraft:behavior.sleep"],
    validator: (c) => ("minecraft:behavior.sleep" in c ? 1.0 : 0),
  },

  // Environment
  hide_from_sun: {
    requiredComponents: ["minecraft:behavior.flee_sun"],
    validator: (c) => ("minecraft:behavior.flee_sun" in c ? 1.0 : 0),
  },
  go_home_at_night: {
    requiredComponents: ["minecraft:behavior.go_home"],
    validator: (c) => ("minecraft:behavior.go_home" in c ? 1.0 : 0),
  },
  seek_water: {
    requiredComponents: ["minecraft:behavior.find_water"],
    validator: (c) => ("minecraft:behavior.find_water" in c ? 1.0 : 0),
  },
  seek_land: {
    requiredComponents: ["minecraft:behavior.stroll_towards_village"],
    validator: (c) => ("minecraft:behavior.stroll_towards_village" in c ? 0.6 : 0),
  },
};

// ============================================================================
// BLOCK TRAIT SIGNATURES
// ============================================================================

/**
 * Block trait signature definitions.
 */
const BLOCK_TRAIT_SIGNATURES: Record<BlockTraitId, ITraitSignature> = {
  // Basic types
  solid: {
    validator: (components) => {
      // Solid blocks have standard collision and no transparency
      const hasCollision =
        !("minecraft:collision_box" in components) || components["minecraft:collision_box"] !== false;
      const isDestructible = "minecraft:destructible_by_mining" in components;
      if (hasCollision && isDestructible) return 0.7;
      return 0;
    },
  },

  transparent: {
    optionalComponents: ["minecraft:light_dampening"],
    validator: (components) => {
      const lightDamp = components["minecraft:light_dampening"];
      if (lightDamp !== undefined && lightDamp < 15) return 0.8;
      return 0;
    },
  },

  leaves: {
    optionalComponents: ["minecraft:destructible_by_mining"],
    validator: (components) => {
      // Leaves have fast destroy time and specific properties
      const destructible = components["minecraft:destructible_by_mining"];
      if (destructible?.seconds_to_destroy !== undefined && destructible.seconds_to_destroy < 0.5) {
        // Check for transparency
        const lightDamp = components["minecraft:light_dampening"];
        if (lightDamp !== undefined && lightDamp < 5) return 0.9;
        return 0.5;
      }
      return 0;
    },
  },

  log: {
    optionalComponents: ["minecraft:transformation"],
    validator: (components) => {
      // Logs often have pillar rotation and medium hardness
      const hasTransformation = "minecraft:transformation" in components;
      const destructible = components["minecraft:destructible_by_mining"];
      const hasWoodHardness = destructible?.seconds_to_destroy >= 2 && destructible?.seconds_to_destroy <= 3;
      if (hasTransformation || hasWoodHardness) return 0.7;
      return 0;
    },
  },

  slab: {
    optionalComponents: ["minecraft:geometry"],
    validator: (components) => {
      // Slabs have half-height geometry or specific states
      const geometry = components["minecraft:geometry"];
      if (geometry && JSON.stringify(geometry).includes("slab")) return 1.0;
      // Check for vertical_half state handling
      const collision = components["minecraft:collision_box"];
      if (collision?.size && collision.size[1] === 8) return 0.8;
      return 0;
    },
  },

  stairs: {
    optionalComponents: ["minecraft:geometry"],
    validator: (components) => {
      const geometry = components["minecraft:geometry"];
      if (geometry && JSON.stringify(geometry).includes("stairs")) return 1.0;
      return 0;
    },
  },

  fence: {
    optionalComponents: ["minecraft:support", "minecraft:connection_rule", "minecraft:geometry"],
    validator: (components) => {
      const support = components["minecraft:support"];
      if (support?.shape === "fence") return 1.0;
      if ("minecraft:connection_rule" in components) return 0.7;
      const geometry = components["minecraft:geometry"];
      if (geometry && JSON.stringify(geometry).includes("fence")) return 0.8;
      const collision = components["minecraft:collision_box"];
      if (collision?.size && collision.size[0] < 16) return 0.6;
      return 0;
    },
  },

  wall: {
    optionalComponents: ["minecraft:geometry"],
    validator: (components) => {
      const geometry = components["minecraft:geometry"];
      if (geometry && JSON.stringify(geometry).includes("wall")) return 1.0;
      return 0;
    },
  },

  door: {
    optionalComponents: ["minecraft:on_interact"],
    validator: (components) => {
      const hasInteract = "minecraft:on_interact" in components;
      const geometry = components["minecraft:geometry"];
      if (geometry && JSON.stringify(geometry).includes("door")) return 1.0;
      if (hasInteract) return 0.6;
      return 0;
    },
  },

  trapdoor: {
    optionalComponents: ["minecraft:on_interact"],
    validator: (components) => {
      const geometry = components["minecraft:geometry"];
      if (geometry && JSON.stringify(geometry).includes("trapdoor")) return 1.0;
      return 0;
    },
  },

  // Functional
  workstation: {
    optionalComponents: ["minecraft:crafting_table"],
    validator: (components) => {
      const hasCrafting = "minecraft:crafting_table" in components;
      const hasInteract = "minecraft:on_interact" in components;
      if (hasCrafting) return 1.0;
      if (hasInteract) return 0.5;
      return 0;
    },
  },

  light_source: {
    requiredComponents: ["minecraft:light_emission"],
    validator: (components) => {
      const light = components["minecraft:light_emission"];
      if (light !== undefined && light > 0) return 1.0;
      return 0;
    },
  },

  gravity: {
    optionalComponents: ["minecraft:gravity"],
    validator: (components) => {
      // Blocks affected by gravity (sand, gravel, etc.)
      return "minecraft:gravity" in components ? 1.0 : 0;
    },
  },

  liquid: {
    optionalComponents: ["minecraft:liquid"],
    validator: (components) => {
      return "minecraft:liquid" in components ? 1.0 : 0;
    },
  },

  // Redstone
  redstone_signal: {
    optionalComponents: ["minecraft:redstone_conductivity", "minecraft:redstone_producer"],
    validator: (components) => {
      if ("minecraft:redstone_producer" in components) return 1.0;
      const redstone = components["minecraft:redstone_conductivity"];
      if (redstone?.emits_redstone) return 1.0;
      return 0;
    },
  },

  redstone_receiver: {
    optionalComponents: ["minecraft:redstone_conductivity"],
    validator: (components) => {
      const redstone = components["minecraft:redstone_conductivity"];
      if (redstone && !redstone.emits_redstone) return 0.8;
      return 0;
    },
  },

  button: {
    optionalComponents: ["minecraft:on_interact"],
    validator: (components) => {
      const geometry = components["minecraft:geometry"];
      if (geometry && JSON.stringify(geometry).includes("button")) return 1.0;
      // Buttons are small interactable blocks
      const collision = components["minecraft:collision_box"];
      const hasInteract = "minecraft:on_interact" in components;
      if (hasInteract && collision?.size && collision.size[1] < 4) return 0.8;
      return 0;
    },
  },

  lever: {
    optionalComponents: ["minecraft:on_interact"],
    validator: (components) => {
      const geometry = components["minecraft:geometry"];
      if (geometry && JSON.stringify(geometry).includes("lever")) return 1.0;
      return 0;
    },
  },

  pressure_plate: {
    optionalComponents: ["minecraft:on_step_on", "minecraft:on_step_off"],
    validator: (components) => {
      const hasStepOn = "minecraft:on_step_on" in components;
      const hasStepOff = "minecraft:on_step_off" in components;
      if (hasStepOn || hasStepOff) return 1.0;
      // Pressure plates are flat
      const collision = components["minecraft:collision_box"];
      if (collision?.size && collision.size[1] <= 1) return 0.6;
      return 0;
    },
  },

  // Properties
  flammable: {
    optionalComponents: ["minecraft:flammable"],
    validator: (components) => {
      return "minecraft:flammable" in components ? 1.0 : 0;
    },
  },

  explosion_resistant: {
    optionalComponents: ["minecraft:destructible_by_explosion"],
    validator: (components) => {
      const explosionData = components["minecraft:destructible_by_explosion"];
      if (explosionData === false) return 1.0;
      if (explosionData?.explosion_resistance !== undefined && explosionData.explosion_resistance >= 1000) return 1.0;
      return 0;
    },
  },

  slippery: {
    optionalComponents: ["minecraft:friction"],
    validator: (components) => {
      const friction = components["minecraft:friction"];
      if (typeof friction === "number" && friction < 0.3) return 1.0;
      if (typeof friction === "number" && friction < 0.4) return 0.6;
      return 0;
    },
  },
};

// ============================================================================
// ITEM TRAIT SIGNATURES
// ============================================================================

/**
 * Item trait signature definitions.
 */
const ITEM_TRAIT_SIGNATURES: Record<ItemTraitId, ITraitSignature> = {
  // Tools
  sword: {
    optionalComponents: ["minecraft:damage", "minecraft:weapon"],
    validator: (components) => {
      const hasDamage = "minecraft:damage" in components;
      const hasWeapon = "minecraft:weapon" in components;
      const hasDigger = "minecraft:digger" in components;
      // Swords have damage but aren't mining tools
      if (hasDamage && !hasDigger) return 0.9;
      if (hasWeapon && !hasDigger) return 0.8;
      return 0;
    },
  },

  pickaxe: {
    requiredComponents: ["minecraft:digger"],
    validator: (components) => {
      const digger = components["minecraft:digger"];
      if (!digger) return 0;
      const rules = JSON.stringify(digger);
      if (rules.includes("stone") || rules.includes("ore") || rules.includes("pickaxe")) return 1.0;
      return 0;
    },
  },

  axe: {
    requiredComponents: ["minecraft:digger"],
    validator: (components) => {
      const digger = components["minecraft:digger"];
      if (!digger) return 0;
      const rules = JSON.stringify(digger);
      if (rules.includes("wood") || rules.includes("log") || rules.includes("axe")) return 1.0;
      return 0;
    },
  },

  shovel: {
    requiredComponents: ["minecraft:digger"],
    validator: (components) => {
      const digger = components["minecraft:digger"];
      if (!digger) return 0;
      const rules = JSON.stringify(digger);
      if (rules.includes("dirt") || rules.includes("sand") || rules.includes("shovel")) return 1.0;
      return 0;
    },
  },

  hoe: {
    requiredComponents: ["minecraft:digger"],
    validator: (components) => {
      const digger = components["minecraft:digger"];
      if (!digger) return 0;
      const rules = JSON.stringify(digger);
      if (rules.includes("hoe") || rules.includes("leaves") || rules.includes("hay")) return 1.0;
      return 0;
    },
  },

  bow: {
    optionalComponents: ["minecraft:shooter", "minecraft:use_modifiers"],
    validator: (components) => {
      const hasShooter = "minecraft:shooter" in components;
      const useModifiers = components["minecraft:use_modifiers"];
      const hasChargeTime = useModifiers?.use_duration !== undefined;
      if (hasShooter && hasChargeTime) return 1.0;
      if (hasShooter) return 0.8;
      return 0;
    },
  },

  crossbow: {
    optionalComponents: ["minecraft:shooter"],
    validator: (components) => {
      const shooter = components["minecraft:shooter"];
      if (shooter && JSON.stringify(shooter).includes("crossbow")) return 1.0;
      return 0;
    },
  },

  food: {
    requiredComponents: ["minecraft:food"],
    validator: (components) => {
      return "minecraft:food" in components ? 1.0 : 0;
    },
  },

  // Armor
  armor_helmet: {
    requiredComponents: ["minecraft:wearable"],
    validator: (components) => {
      const wearable = components["minecraft:wearable"];
      if (wearable?.slot === "slot.armor.head") return 1.0;
      return 0;
    },
  },

  armor_chestplate: {
    requiredComponents: ["minecraft:wearable"],
    validator: (components) => {
      const wearable = components["minecraft:wearable"];
      if (wearable?.slot === "slot.armor.chest") return 1.0;
      return 0;
    },
  },

  armor_leggings: {
    requiredComponents: ["minecraft:wearable"],
    validator: (components) => {
      const wearable = components["minecraft:wearable"];
      if (wearable?.slot === "slot.armor.legs") return 1.0;
      return 0;
    },
  },

  armor_boots: {
    requiredComponents: ["minecraft:wearable"],
    validator: (components) => {
      const wearable = components["minecraft:wearable"];
      if (wearable?.slot === "slot.armor.feet") return 1.0;
      return 0;
    },
  },

  throwable: {
    optionalComponents: ["minecraft:throwable", "minecraft:projectile"],
    validator: (components) => {
      const hasThrowable = "minecraft:throwable" in components;
      const hasProjectile = "minecraft:projectile" in components;
      if (hasThrowable || hasProjectile) return 1.0;
      return 0;
    },
  },

  placeable: {
    optionalComponents: ["minecraft:block_placer", "minecraft:entity_placer"],
    validator: (components) => {
      const hasBlockPlacer = "minecraft:block_placer" in components;
      const hasEntityPlacer = "minecraft:entity_placer" in components;
      if (hasBlockPlacer || hasEntityPlacer) return 1.0;
      return 0;
    },
  },
};

// ============================================================================
// TRAIT DETECTOR CLASS
// ============================================================================

/**
 * TraitDetector - Detects traits from native Minecraft components.
 */
export default class TraitDetector {
  /** Minimum confidence threshold for including a trait */
  static readonly DEFAULT_MIN_CONFIDENCE = 0.6;

  /**
   * Detect entity traits from components.
   */
  static detectEntityTraits(
    components: Record<string, any>,
    componentGroups?: Record<string, Record<string, any>>,
    minConfidence: number = TraitDetector.DEFAULT_MIN_CONFIDENCE
  ): ITraitDetectionResult<EntityTraitId>[] {
    const results: ITraitDetectionResult<EntityTraitId>[] = [];

    // Merge component group components for detection
    const allComponents = { ...components };
    if (componentGroups) {
      for (const group of Object.values(componentGroups)) {
        Object.assign(allComponents, group);
      }
    }

    for (const [traitId, signature] of Object.entries(ENTITY_TRAIT_SIGNATURES)) {
      let confidence = 0;
      const matchedComponents: string[] = [];

      // Check required components
      if (signature.requiredComponents) {
        const hasAllRequired = signature.requiredComponents.every((comp) => {
          if (comp in allComponents) {
            matchedComponents.push(comp);
            return true;
          }
          return false;
        });
        if (!hasAllRequired) continue; // Skip if missing required
        confidence = 0.5;
      }

      // Check optional components
      if (signature.optionalComponents) {
        for (const comp of signature.optionalComponents) {
          if (comp in allComponents) {
            matchedComponents.push(comp);
            confidence += 0.1;
          }
        }
      }

      // Run custom validator
      if (signature.validator) {
        const validatorScore = signature.validator(allComponents, componentGroups);
        confidence = Math.max(confidence, validatorScore);
      }

      if (confidence >= minConfidence) {
        results.push({
          traitId: traitId as EntityTraitId,
          confidence,
          matchedComponents,
        });
      }
    }

    // Handle conflicts
    return TraitDetector.resolveConflicts(results, ENTITY_TRAIT_SIGNATURES);
  }

  /**
   * Detect behavior presets from components.
   */
  static detectBehaviorPresets(
    components: Record<string, any>,
    minConfidence: number = TraitDetector.DEFAULT_MIN_CONFIDENCE
  ): ITraitDetectionResult<EntityBehaviorPreset>[] {
    const results: ITraitDetectionResult<EntityBehaviorPreset>[] = [];

    for (const [presetId, signature] of Object.entries(BEHAVIOR_PRESET_SIGNATURES)) {
      let confidence = 0;
      const matchedComponents: string[] = [];

      if (signature.requiredComponents) {
        const hasAllRequired = signature.requiredComponents.every((comp) => {
          if (comp in components) {
            matchedComponents.push(comp);
            return true;
          }
          return false;
        });
        if (!hasAllRequired) continue;
        confidence = 0.7;
      }

      if (signature.validator) {
        const validatorScore = signature.validator(components);
        confidence = Math.max(confidence, validatorScore);
      }

      if (confidence >= minConfidence) {
        results.push({
          traitId: presetId as EntityBehaviorPreset,
          confidence,
          matchedComponents,
        });
      }
    }

    return results;
  }

  /**
   * Detect block traits from components.
   */
  static detectBlockTraits(
    components: Record<string, any>,
    minConfidence: number = TraitDetector.DEFAULT_MIN_CONFIDENCE
  ): ITraitDetectionResult<BlockTraitId>[] {
    const results: ITraitDetectionResult<BlockTraitId>[] = [];

    for (const [traitId, signature] of Object.entries(BLOCK_TRAIT_SIGNATURES)) {
      let confidence = 0;
      const matchedComponents: string[] = [];

      // Check required components
      if (signature.requiredComponents) {
        const hasAllRequired = signature.requiredComponents.every((comp) => {
          if (comp in components) {
            matchedComponents.push(comp);
            return true;
          }
          return false;
        });
        if (!hasAllRequired) continue;
        confidence = 0.5;
      }

      // Check optional components
      if (signature.optionalComponents) {
        for (const comp of signature.optionalComponents) {
          if (comp in components) {
            matchedComponents.push(comp);
            confidence += 0.1;
          }
        }
      }

      // Run custom validator
      if (signature.validator) {
        const validatorScore = signature.validator(components);
        confidence = Math.max(confidence, validatorScore);
      }

      if (confidence >= minConfidence) {
        results.push({
          traitId: traitId as BlockTraitId,
          confidence,
          matchedComponents,
        });
      }
    }

    // Resolve conflicts (some block traits are mutually exclusive)
    return TraitDetector.resolveConflicts(results, BLOCK_TRAIT_SIGNATURES);
  }

  /**
   * Detect item traits from components.
   */
  static detectItemTraits(
    components: Record<string, any>,
    minConfidence: number = TraitDetector.DEFAULT_MIN_CONFIDENCE
  ): ITraitDetectionResult<ItemTraitId>[] {
    const results: ITraitDetectionResult<ItemTraitId>[] = [];

    for (const [traitId, signature] of Object.entries(ITEM_TRAIT_SIGNATURES)) {
      let confidence = 0;
      const matchedComponents: string[] = [];

      // Check required components
      if (signature.requiredComponents) {
        const hasAllRequired = signature.requiredComponents.every((comp) => {
          if (comp in components) {
            matchedComponents.push(comp);
            return true;
          }
          return false;
        });
        if (!hasAllRequired) continue;
        confidence = 0.5;
      }

      // Check optional components
      if (signature.optionalComponents) {
        for (const comp of signature.optionalComponents) {
          if (comp in components) {
            matchedComponents.push(comp);
            confidence += 0.1;
          }
        }
      }

      // Run custom validator
      if (signature.validator) {
        const validatorScore = signature.validator(components);
        confidence = Math.max(confidence, validatorScore);
      }

      if (confidence >= minConfidence) {
        results.push({
          traitId: traitId as ItemTraitId,
          confidence,
          matchedComponents,
        });
      }
    }

    // Resolve conflicts (e.g., can't be both sword and pickaxe)
    return TraitDetector.resolveConflicts(results, ITEM_TRAIT_SIGNATURES);
  }

  /**
   * Extract simplified properties from entity components.
   */
  static extractEntityProperties(components: Record<string, any>): IExtractedProperties {
    const props: IExtractedProperties = {};

    // Health
    const health = components["minecraft:health"];
    if (health) {
      props.health = health.max ?? health.value;
    }

    // Attack damage
    const attack = components["minecraft:attack"];
    if (attack?.damage !== undefined) {
      props.attackDamage = attack.damage;
    }

    // Movement speed
    const movement = components["minecraft:movement"];
    if (movement?.value !== undefined) {
      props.movementSpeed = movement.value;
    }

    // Scale
    const scale = components["minecraft:scale"];
    if (scale?.value !== undefined && scale.value !== 1.0) {
      props.scale = scale.value;
    }

    // Follow range (from targeting behaviors)
    const targeting = components["minecraft:behavior.nearest_attackable_target"];
    if (targeting?.entity_types?.[0]?.max_dist) {
      props.followRange = targeting.entity_types[0].max_dist;
    }

    // Knockback resistance
    const knockback = components["minecraft:knockback_resistance"];
    if (knockback?.value !== undefined) {
      props.knockbackResistance = knockback.value;
    }

    // Collision box
    const collision = components["minecraft:collision_box"];
    if (collision) {
      props.collisionWidth = collision.width;
      props.collisionHeight = collision.height;
    }

    // Type family
    const family = components["minecraft:type_family"];
    if (family?.family) {
      props.families = Array.isArray(family.family) ? family.family : [family.family];
    }

    return props;
  }

  /**
   * Extract simplified properties from block components.
   */
  static extractBlockProperties(components: Record<string, any>): IExtractedProperties {
    const props: IExtractedProperties = {};

    // Destroy time
    const destructible = components["minecraft:destructible_by_mining"];
    if (destructible?.seconds_to_destroy !== undefined) {
      props.destroyTime = destructible.seconds_to_destroy;
    }

    // Explosion resistance
    const explosion = components["minecraft:destructible_by_explosion"];
    if (explosion?.explosion_resistance !== undefined) {
      props.explosionResistance = explosion.explosion_resistance;
    }

    // Light emission
    const light = components["minecraft:light_emission"];
    if (light !== undefined) {
      props.lightEmission = typeof light === "number" ? light : light.emission;
    }

    // Light dampening
    const dampen = components["minecraft:light_dampening"];
    if (dampen !== undefined) {
      props.lightDampening = typeof dampen === "number" ? dampen : dampen.light_dampening;
    }

    // Friction
    const friction = components["minecraft:friction"];
    if (friction !== undefined) {
      props.friction = typeof friction === "number" ? friction : friction.value;
    }

    // Map color
    const mapColor = components["minecraft:map_color"];
    if (mapColor) {
      props.mapColor = typeof mapColor === "string" ? mapColor : mapColor.color;
    }

    return props;
  }

  /**
   * Extract simplified properties from item components.
   */
  static extractItemProperties(components: Record<string, any>): IExtractedProperties {
    const props: IExtractedProperties = {};

    // Max stack size
    const stack = components["minecraft:max_stack_size"];
    if (stack !== undefined) {
      props.maxStackSize = typeof stack === "number" ? stack : stack.max_stack_size;
    }

    // Durability
    const durability = components["minecraft:durability"];
    if (durability?.max_durability !== undefined) {
      props.durability = durability.max_durability;
    }

    // Damage (for weapons)
    const damage = components["minecraft:damage"];
    if (damage?.value !== undefined) {
      props.damage = damage.value;
    }

    // Food properties
    const food = components["minecraft:food"];
    if (food) {
      props.nutrition = food.nutrition;
      props.saturation = food.saturation_modifier;
    }

    return props;
  }

  /**
   * Resolve conflicting traits by keeping higher confidence ones.
   */
  private static resolveConflicts<T extends string>(
    results: ITraitDetectionResult<T>[],
    signatures: Record<string, ITraitSignature>
  ): ITraitDetectionResult<T>[] {
    const resolved: ITraitDetectionResult<T>[] = [];
    const excluded = new Set<string>();

    // Sort by confidence descending
    const sorted = [...results].sort((a, b) => b.confidence - a.confidence);

    for (const result of sorted) {
      if (excluded.has(result.traitId)) continue;

      resolved.push(result);

      // Mark conflicts as excluded
      const sig = signatures[result.traitId];
      if (sig?.conflictsWith) {
        for (const conflict of sig.conflictsWith) {
          excluded.add(conflict);
        }
      }
    }

    return resolved;
  }

  /**
   * Get components that are NOT explained by any detected trait.
   * These should be included as explicit components in the schema.
   */
  static getUnexplainedComponents(
    allComponents: Record<string, any>,
    detectedTraits: ITraitDetectionResult<string>[]
  ): string[] {
    const explainedComponents = new Set<string>();

    for (const trait of detectedTraits) {
      for (const comp of trait.matchedComponents) {
        explainedComponents.add(comp);
      }
    }

    return Object.keys(allComponents).filter((comp) => !explainedComponents.has(comp));
  }
}

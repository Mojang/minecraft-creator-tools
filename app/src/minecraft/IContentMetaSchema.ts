// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Minecraft Content Meta-Schema
 *
 * A simplified, AI-friendly schema for creating Minecraft Bedrock content.
 * This schema consolidates multiple file types into unified definitions that
 * are easier for AI to generate correctly.
 *
 * Key design principles:
 * 1. Single source of truth - one definition generates all required files
 * 2. Traits - pre-packaged bundles of components and behaviors
 * 3. Progressive complexity - simple things are simple, complex things are possible
 * 4. Native compatibility - can use raw Minecraft components when needed
 * 5. Reuses existing MCP schemas for textures and geometry where possible
 *
 * @see MinecraftContentMetaSchema.md for full design documentation
 */

import { IBlockVolume } from "./IBlockVolume";
import { IMcpTexturedRectangle, IMcpPixelArt, IMcpModelDesign } from "./IMcpModelDesign";
import { ITextureEffects } from "./TextureEffects";

// ============================================================================
// TOP-LEVEL SCHEMA
// ============================================================================

/**
 * Root schema for defining Minecraft content.
 * A single definition can create entities, blocks, items, structures, and more.
 */
export interface IMinecraftContentDefinition {
  /** Schema version for this meta-format */
  schemaVersion: "1.0.0";

  /**
   * Namespace for all content (e.g., "orc_dungeon").
   * Used as prefix for all IDs: "namespace:entity_id"
   *
   * Optional if adding to an existing project - will use project's namespace.
   */
  namespace?: string;

  /** Human-readable name for this content pack */
  displayName?: string;

  /** Description of what this content adds */
  description?: string;

  /** Entity type definitions */
  entityTypes?: IEntityTypeDefinition[];

  /** Block type definitions */
  blockTypes?: IBlockTypeDefinition[];

  /** Item type definitions */
  itemTypes?: IItemTypeDefinition[];

  /** Structure definitions (including jigsaws) */
  structures?: IStructureDefinition[];

  /** Feature definitions for world generation */
  features?: IFeatureDefinition[];

  /** Loot table definitions */
  lootTables?: ILootTableDefinition[];

  /** Recipe definitions */
  recipes?: IRecipeDefinition[];

  /** Spawn rule definitions */
  spawnRules?: ISpawnRuleDefinition[];

  /** Shared resources that can be referenced by multiple items */
  sharedResources?: ISharedResources;

  /** Generation options */
  options?: IGenerationOptions;
}

/**
 * Options controlling how content is generated from the meta-schema.
 */
export interface IGenerationOptions {
  /** Auto-generate placeholder textures for content without explicit textures */
  generatePlaceholderTextures?: boolean;

  /** Auto-generate geometry using templates when not specified */
  generateDefaultGeometry?: boolean;

  /** Auto-create spawn rules for entities that don't have explicit ones */
  createDefaultSpawnRules?: boolean;

  /** Auto-create loot tables from entity 'drops' shorthand */
  createLootTablesFromDrops?: boolean;

  /** Pixels per unit for generated textures (1, 2, or 4) */
  textureResolution?: 1 | 2 | 4;
}

// ============================================================================
// TEXTURE AND GEOMETRY (reusing existing MCP schemas)
// ============================================================================

/**
 * Texture specification - can be a file path, procedural generation, or inline definition.
 * Reuses IMcpTexturedRectangle from existing model design tools.
 */
export interface ITextureSpec {
  /** Reference an existing texture file (relative to resource pack) */
  file?: string;

  /**
   * Generate texture procedurally using the same schema as model design tools.
   * @see IMcpTexturedRectangle
   */
  generate?: IMcpTexturedRectangle;

  /** Pixel art overlay using the same schema as model design tools */
  pixelArt?: IMcpPixelArt[];

  /** Post-processing effects */
  effects?: ITextureEffects;
}

/**
 * Geometry specification - can be a file path or inline model design.
 * Reuses IMcpModelDesign from existing model design tools.
 */
export interface IGeometrySpec {
  /** Reference an existing geometry file (relative to resource pack) */
  file?: string;

  /**
   * Inline model design using the same schema as MCP model preview/export tools.
   * @see IMcpModelDesign
   */
  design?: IMcpModelDesign;

  /** Use a template geometry (humanoid, quadruped, etc.) */
  template?: GeometryTemplateType;
}

/** Available geometry templates */
export type GeometryTemplateType =
  | "humanoid"
  | "quadruped"
  | "quadruped_small"
  | "bird"
  | "fish"
  | "insect"
  | "slime"
  | "flying"
  | "block"
  | "item";

// ============================================================================
// ENTITY TYPE DEFINITION
// ============================================================================

/**
 * Entity type traits - pre-packaged bundles of components and behaviors.
 */
export type EntityTraitId =
  // Body types (provide geometry, basic physics, animations)
  | "humanoid"
  | "quadruped"
  | "quadruped_small"
  | "flying"
  | "aquatic"
  | "arthropod"
  | "slime"

  // Behavior archetypes
  | "hostile"
  | "passive"
  | "neutral"
  | "boss"

  // Combat styles
  | "melee_attacker"
  | "ranged_attacker"
  | "exploder"

  // Interaction patterns
  | "trader"
  | "tameable"
  | "rideable"
  | "breedable"
  | "leasable"

  // Special behaviors
  | "undead"
  | "illager"
  | "aquatic_only"
  | "baby_variant"
  | "wanders"
  | "patrols"
  | "guards"
  | "flees_daylight"
  | "teleporter";

/**
 * Simplified behavior presets that map to full AI components.
 */
export type EntityBehaviorPreset =
  // Movement
  | "wander"
  | "swim"
  | "fly_around"
  | "float"
  | "climb"

  // Combat
  | "melee_attack"
  | "ranged_attack"
  | "target_players"
  | "target_monsters"
  | "flee_when_hurt"
  | "retaliate"

  // Social
  | "follow_owner"
  | "follow_parent"
  | "herd"
  | "avoid_players"

  // Interaction
  | "look_at_player"
  | "beg"
  | "tempt"
  | "sit_command"

  // Actions
  | "eat_grass"
  | "break_doors"
  | "open_doors"
  | "pick_up_items"
  | "sleep_in_bed"

  // Environment
  | "hide_from_sun"
  | "go_home_at_night"
  | "seek_water"
  | "seek_land";

/**
 * Simplified appearance specification for entities.
 */
export interface IEntityAppearance {
  /** Base body template to use for geometry */
  bodyType?: GeometryTemplateType;

  /** Primary color (hex) - used for texture generation */
  primaryColor?: string;

  /** Secondary color (hex) - used for accents */
  secondaryColor?: string;

  /** Texture style for procedural generation */
  textureStyle?: "solid" | "spotted" | "striped" | "gradient" | "organic" | "armored";

  /** Scale multiplier */
  scale?: number;

  /** Eye style */
  eyes?: "normal" | "glowing" | "red" | "none";

  /** Particle effects */
  particles?: ("flames" | "smoke" | "drip" | "sparkle" | "hearts")[];

  /**
   * Custom texture using the same schema as model design tools.
   * Overrides auto-generated texture from colors/style.
   */
  texture?: ITextureSpec;

  /**
   * Custom geometry using the same schema as model design tools.
   * Overrides bodyType template.
   */
  geometry?: IGeometrySpec;
}

/**
 * Drop specification for loot.
 */
export interface IDropDefinition {
  /** Item ID (vanilla like "iron_sword" or namespaced like "namespace:custom_item") */
  item: string;

  /** Drop chance (0-1), default 1.0 */
  chance?: number;

  /** Stack size */
  count?: number | { min: number; max: number };

  /** Only drop if killed by player */
  killedByPlayer?: boolean;

  /** Looting enchantment bonus per level */
  lootingBonus?: number;
}

/**
 * Configuration for tameable entities.
 */
export interface ITameableConfig {
  /** Items that can be used to tame */
  tameItems: string[];

  /** Chance to tame on each attempt (0-1) */
  chance?: number;
}

/**
 * Configuration for rideable entities.
 */
export interface IRideableConfig {
  /** Number of seats */
  seatCount?: number;

  /** Can be controlled by player? */
  controllable?: boolean;

  /** Items required to control (like carrot on a stick) */
  controlItems?: string[];
}

/**
 * Configuration for breedable entities.
 */
export interface IBreedableConfig {
  /** Items that trigger breeding */
  breedItems: string[];

  /** Time between breeding attempts in seconds */
  breedCooldown?: number;
}

/**
 * Spawn configuration for entities.
 */
export interface ISpawnConfig {
  /** Biomes where entity spawns */
  biomes?: string[];

  /** Spawn weight (higher = more common) */
  weight?: number;

  /** Group size range */
  groupSize?: { min: number; max: number };

  /** Light level range (0-15) */
  lightLevel?: { min?: number; max?: number };

  /** Y level range */
  heightRange?: { min?: number; max?: number };

  /** Time of day */
  timeOfDay?: "day" | "night" | "any";

  /** Surface or underground */
  surface?: boolean;

  /** Block types to spawn on */
  spawnOn?: string[];

  /** Population cap in area */
  populationCap?: number;

  /** Rarity (1 in N chance per spawn cycle) */
  rarity?: number;
}

/**
 * Entity type definition.
 * Supports three levels of abstraction:
 * 1. Traits - highest level, pre-packaged bundles
 * 2. Simplified properties - common settings as simple values
 * 3. Native components - full Minecraft component JSON
 */
export interface IEntityTypeDefinition {
  /** Unique identifier within namespace (full ID becomes "namespace:id") */
  id: string;

  /** Display name shown in-game */
  displayName: string;

  // ============ TRAIT-BASED (HIGHEST ABSTRACTION) ============

  /**
   * Apply pre-built trait bundles. Traits provide components, behaviors,
   * appearance, and AI as a package. Later traits override earlier ones.
   */
  traits?: EntityTraitId[];

  // ============ SIMPLIFIED PROPERTIES (MEDIUM ABSTRACTION) ============

  /** Health points */
  health?: number;

  /** Attack damage */
  attackDamage?: number;

  /** Movement speed (blocks per second) */
  movementSpeed?: number;

  /** Follow/detection range */
  followRange?: number;

  /** Knockback resistance (0-1) */
  knockbackResistance?: number;

  /** Scale multiplier */
  scale?: number;

  /** Collision box dimensions */
  collisionWidth?: number;
  collisionHeight?: number;

  /** AI behavior presets */
  behaviors?: EntityBehaviorPreset[];

  /** What the entity drops when killed */
  drops?: IDropDefinition[];

  /** Appearance specification */
  appearance?: IEntityAppearance;

  /** Entity families */
  families?: string[];

  /** Is this entity hostile to players? */
  hostile?: boolean;

  /** Can this entity be tamed? */
  tameable?: boolean | ITameableConfig;

  /** Can this entity be ridden? */
  rideable?: boolean | IRideableConfig;

  /** Can this entity be bred? */
  breedable?: boolean | IBreedableConfig;

  // ============ NATIVE COMPONENTS (FULL CONTROL) ============

  /**
   * Native Minecraft components - uses actual Minecraft component schema.
   * These OVERRIDE any components set by traits or simplified properties.
   * Key format: component name without "minecraft:" prefix.
   */
  components?: Record<string, unknown>;

  /**
   * Component groups for conditional behavior.
   * Uses native Minecraft format.
   */
  componentGroups?: Record<string, Record<string, unknown>>;

  /**
   * Events that trigger component group changes.
   * Uses native Minecraft format.
   */
  events?: Record<string, unknown>;

  // ============ RESOURCE OVERRIDES ============

  /** Custom geometry */
  geometry?: IGeometrySpec;

  /** Custom texture */
  texture?: ITextureSpec;

  /** Sound definitions */
  sounds?: IEntitySounds;

  // ============ SPAWN CONFIGURATION ============

  /** Inline spawn rule (alternative to separate spawnRules array) */
  spawning?: ISpawnConfig;
}

/**
 * Entity sound definitions.
 */
export interface IEntitySounds {
  ambient?: string;
  hurt?: string;
  death?: string;
  step?: string;
  attack?: string;
}

// ============================================================================
// BLOCK TYPE DEFINITION
// ============================================================================

/**
 * Block type traits.
 */
export type BlockTraitId =
  // Basic types
  | "solid"
  | "transparent"
  | "leaves"
  | "log"
  | "slab"
  | "stairs"
  | "fence"
  | "wall"
  | "door"
  | "trapdoor"

  // Functional
  | "container"
  | "workstation"
  | "light_source"
  | "gravity"
  | "liquid"

  // Redstone
  | "redstone_signal"
  | "redstone_receiver"
  | "button"
  | "lever"
  | "pressure_plate";

/**
 * Block shape types.
 */
export type BlockShapeType = "cube" | "slab" | "stairs" | "fence" | "wall" | "cross" | "custom";

/**
 * Block sound types.
 */
export type BlockSoundType =
  | "stone"
  | "wood"
  | "gravel"
  | "grass"
  | "sand"
  | "glass"
  | "metal"
  | "cloth"
  | "snow"
  | "coral";

/**
 * Block texture specification - can specify per-face or uniform.
 */
export interface IBlockTexture {
  /** All sides same texture */
  all?: string | ITextureSpec;

  /** Per-face textures */
  up?: string | ITextureSpec;
  down?: string | ITextureSpec;
  north?: string | ITextureSpec;
  south?: string | ITextureSpec;
  east?: string | ITextureSpec;
  west?: string | ITextureSpec;

  /** Side faces (north/south/east/west) */
  side?: string | ITextureSpec;
}

/**
 * Flammable configuration.
 */
export interface IFlammableConfig {
  /** Chance to catch fire */
  catchChance: number;

  /** Chance to be destroyed by fire */
  destroyChance: number;
}

/**
 * Block permutation for state-based variations.
 */
export interface IBlockPermutation {
  /** Condition expression (Molang) */
  condition: string;

  /** Components to apply when condition is true */
  components: Record<string, unknown>;
}

/**
 * Block type definition.
 */
export interface IBlockTypeDefinition {
  /** Unique identifier within namespace */
  id: string;

  /** Display name */
  displayName: string;

  // ============ TRAIT-BASED ============

  /** Apply pre-built block traits */
  traits?: BlockTraitId[];

  // ============ SIMPLIFIED PROPERTIES ============

  /** Destruction time in seconds (0 = instant, -1 = unbreakable) */
  destroyTime?: number;

  /** Explosion resistance */
  explosionResistance?: number;

  /** Friction (0-1, default 0.6) */
  friction?: number;

  /** Light emission (0-15) */
  lightEmission?: number;

  /** Light dampening (0-15) */
  lightDampening?: number;

  /** Flammability settings */
  flammable?: boolean | IFlammableConfig;

  /** Map color (hex) */
  mapColor?: string;

  /** Block shape */
  shape?: BlockShapeType;

  /** What drops when mined */
  drops?: IDropDefinition[];

  // ============ APPEARANCE ============

  /** Texture specification */
  texture?: IBlockTexture;

  /** Custom geometry (for non-cube shapes) */
  geometry?: IGeometrySpec;

  /** Sound set */
  sounds?: BlockSoundType;

  // ============ NATIVE COMPONENTS ============

  /** Native Minecraft components */
  components?: Record<string, unknown>;

  /** Permutations for block states */
  permutations?: IBlockPermutation[];

  /** Block states/properties */
  states?: Record<string, boolean[] | number[] | string[]>;

  /** Events */
  events?: Record<string, unknown>;
}

// ============================================================================
// ITEM TYPE DEFINITION
// ============================================================================

/**
 * Item type traits.
 */
export type ItemTraitId =
  | "sword"
  | "pickaxe"
  | "axe"
  | "shovel"
  | "hoe"
  | "bow"
  | "crossbow"
  | "food"
  | "armor_helmet"
  | "armor_chestplate"
  | "armor_leggings"
  | "armor_boots"
  | "throwable"
  | "placeable";

/**
 * Item category for creative menu.
 */
export type ItemCategory = "construction" | "nature" | "equipment" | "items" | "none";

/**
 * Food properties.
 */
export interface IFoodProperties {
  /** Hunger points restored */
  nutrition: number;

  /** Saturation modifier */
  saturation?: number;

  /** Can eat when full? */
  canAlwaysEat?: boolean;

  /** Status effects when eaten */
  effects?: IFoodEffect[];
}

/**
 * Food effect (status effect when eaten).
 */
export interface IFoodEffect {
  /** Effect name (e.g., "speed", "regeneration") */
  name: string;

  /** Duration in seconds */
  duration: number;

  /** Amplifier (0 = level 1) */
  amplifier?: number;

  /** Chance to apply (0-1) */
  chance?: number;
}

/**
 * Tool properties.
 */
export interface IToolProperties {
  /** Mining speed multiplier */
  miningSpeed?: number;

  /** Mining level */
  miningLevel?: "wood" | "stone" | "iron" | "diamond" | "netherite";

  /** Durability */
  durability: number;
}

/**
 * Weapon properties.
 */
export interface IWeaponProperties {
  /** Attack damage */
  damage: number;

  /** Attacks per second */
  attackSpeed?: number;

  /** Durability */
  durability?: number;

  /** Knockback amount */
  knockback?: number;
}

/**
 * Armor properties.
 */
export interface IArmorProperties {
  /** Defense points */
  defense: number;

  /** Armor slot */
  slot: "helmet" | "chestplate" | "leggings" | "boots";

  /** Durability */
  durability: number;

  /** Toughness */
  toughness?: number;
}

/**
 * Projectile properties.
 */
export interface IProjectileProperties {
  /** Projectile entity ID */
  projectile: string;

  /** Launch power */
  launchPower?: number;

  /** Is it a chargeble item (bow-like)? */
  chargeable?: boolean;
}

/**
 * Item type definition.
 */
export interface IItemTypeDefinition {
  /** Unique identifier within namespace */
  id: string;

  /** Display name */
  displayName: string;

  // ============ TRAIT-BASED ============

  /** Apply pre-built item traits */
  traits?: ItemTraitId[];

  // ============ SIMPLIFIED PROPERTIES ============

  /** Maximum stack size (default 64) */
  maxStackSize?: number;

  /** Item category for creative menu */
  category?: ItemCategory;

  /** Durability (for tools/armor) */
  durability?: number;

  /** Food properties */
  food?: IFoodProperties;

  /** Tool properties */
  tool?: IToolProperties;

  /** Weapon properties */
  weapon?: IWeaponProperties;

  /** Armor properties */
  armor?: IArmorProperties;

  /** Projectile properties */
  projectile?: IProjectileProperties;

  /** Glint effect (enchanted look) */
  glint?: boolean;

  /** Can be used as fuel (burn duration in ticks) */
  fuel?: number;

  // ============ APPEARANCE ============

  /** Primary color for recoloring the item texture (hex, e.g., "#4A7BA5") */
  color?: string;

  /** Texture for inventory icon */
  icon?: string | ITextureSpec;

  /** 3D model when held/dropped (optional) */
  geometry?: IGeometrySpec;

  // ============ NATIVE COMPONENTS ============

  /** Native Minecraft components */
  components?: Record<string, unknown>;

  /** Events */
  events?: Record<string, unknown>;
}

// ============================================================================
// STRUCTURE DEFINITION
// ============================================================================

/**
 * Jigsaw connection point.
 */
export interface IJigsawConnection {
  /** Connection name (used for matching) */
  name: string;

  /** Position in the structure (block coordinates) */
  position: { x: number; y: number; z: number };

  /** Direction this connection faces */
  direction: "up" | "down" | "north" | "south" | "east" | "west";

  /** What connections this can connect TO */
  canConnectTo: string[];

  /** Is this required or optional? */
  required?: boolean;
}

/**
 * Spawn definition within a structure.
 */
export interface IStructureSpawn {
  /** Entity to spawn (can reference entities defined in this schema) */
  entity: string;

  /** Number to spawn */
  count: number | { min: number; max: number };

  /** Position within piece */
  position?: { x: number; y: number; z: number };

  /** Spread radius from position */
  spread?: number;
}

/**
 * Loot placement within a structure.
 */
export interface IStructureLoot {
  /** Loot table (can reference tables defined in this schema) */
  lootTable: string;

  /** Container position */
  position: { x: number; y: number; z: number };

  /** Container type */
  containerType?: "chest" | "barrel" | "spawner";
}

/**
 * Jigsaw piece definition.
 */
export interface IJigsawPiece {
  /** Piece identifier */
  id: string;

  /** Structure file for this piece */
  structureFile?: string;

  /**
   * OR define inline using block volume format.
   * Uses same schema as MCP structure design tools.
   * @see IBlockVolume
   */
  blocks?: IBlockVolume;

  /** Connection points */
  connections: IJigsawConnection[];

  /** Weight for random selection */
  weight?: number;

  /** How many times this can appear */
  maxCount?: number;

  /** What to spawn in this room */
  spawns?: IStructureSpawn[];

  /** Loot in this room */
  loot?: IStructureLoot[];
}

/**
 * Jigsaw structure definition.
 */
export interface IJigsawDefinition {
  /** Pieces in this structure */
  pieces: IJigsawPiece[];

  /** Starting piece ID */
  startPiece: string;

  /** Maximum depth of generation */
  maxDepth?: number;

  /** Overall size constraints */
  maxSize?: { x: number; y: number; z: number };
}

/**
 * Structure generation configuration.
 */
export interface IStructureGeneration {
  /** Biomes where this can generate */
  biomes?: string[];

  /** Y level range */
  heightRange?: { min: number; max: number };

  /** Rarity (1 in N chunks) */
  rarity?: number;

  /** Terrain adaptation */
  terrainAdaptation?: "none" | "bury" | "beard_thin" | "beard_box";

  /** Generate in underground? */
  underground?: boolean;
}

/**
 * Structure definition.
 */
export interface IStructureDefinition {
  /** Unique identifier */
  id: string;

  /** Display name */
  displayName?: string;

  /** Structure type */
  type: "simple" | "jigsaw";

  /** Path to .mcstructure file (for simple structures) */
  structureFile?: string;

  /**
   * Inline block volume (for simple structures).
   * Uses same schema as MCP structure design tools.
   */
  blocks?: IBlockVolume;

  /** Jigsaw definition (for jigsaw structures) */
  jigsaw?: IJigsawDefinition;

  /** World generation settings */
  generation?: IStructureGeneration;
}

// ============================================================================
// FEATURE DEFINITION (WORLD GENERATION)
// ============================================================================

/**
 * Feature spread - simplified feature hierarchy generation.
 * Creates a complete feature rule + feature chain from a single definition.
 */
export interface IFeatureSpread {
  /** What block/structure/entity to place */
  places: IFeaturePlacement[];

  /** How many to place per chunk */
  count?: number | { min: number; max: number };

  /** Y level placement strategy */
  heightPlacement?: IHeightPlacement;

  /** Scatter pattern */
  scatter?: IScatterPattern;

  /** Biomes where this generates */
  biomes?: string[];

  /** Rarity (1 in N chunks) */
  rarity?: number;
}

/**
 * What a feature places.
 */
export interface IFeaturePlacement {
  /** Type of thing to place */
  type: "block" | "structure" | "tree" | "ore" | "vegetation";

  /** Block/structure ID to place */
  id: string;

  /** For ore: vein size */
  count?: number | { min: number; max: number };

  /** For ore: blocks it can replace */
  replacesBlocks?: string[];
}

/**
 * Height placement strategy.
 */
export interface IHeightPlacement {
  /** Placement type */
  type: "surface" | "underground" | "fixed" | "range";

  /** Y level (for fixed) */
  y?: number;

  /** Y range */
  min?: number;
  max?: number;
}

/**
 * Scatter pattern for feature placement.
 */
export interface IScatterPattern {
  /** Pattern type */
  type: "uniform" | "cluster" | "line";

  /** Spread radius */
  radius?: number;
}

/**
 * Feature definition - can be a simple placement or complex spread hierarchy.
 */
export interface IFeatureDefinition {
  /** Unique identifier */
  id: string;

  /** Display name */
  displayName?: string;

  /**
   * Simplified feature spread - generates complete feature rule + feature hierarchy.
   * Use this for most cases.
   */
  spread?: IFeatureSpread;

  /**
   * Native feature definition (for advanced cases).
   * Uses Minecraft feature JSON format.
   */
  nativeFeature?: Record<string, unknown>;

  /**
   * Native feature rule definition (for advanced cases).
   * Uses Minecraft feature rule JSON format.
   */
  nativeFeatureRule?: Record<string, unknown>;
}

// ============================================================================
// LOOT TABLE DEFINITION
// ============================================================================

/**
 * Loot pool.
 */
export interface ILootPool {
  /** Number of rolls */
  rolls: number | { min: number; max: number };

  /** Items in this pool */
  entries: ILootEntry[];

  /** Conditions for this pool */
  conditions?: ILootCondition[];
}

/**
 * Loot entry.
 */
export interface ILootEntry {
  /** Item ID */
  item: string;

  /** Weight for random selection */
  weight?: number;

  /** Stack size */
  count?: number | { min: number; max: number };

  /** Drop chance (0-1) */
  chance?: number;

  /** Only drop if killed by player? */
  killedByPlayer?: boolean;

  /** Looting enchantment bonus */
  lootingBonus?: number;
}

/**
 * Loot condition.
 */
export type ILootCondition =
  | { type: "killed_by_player" }
  | { type: "random_chance"; chance: number }
  | { type: "looting_enchant"; multiplier: number };

/**
 * Loot table definition.
 */
export interface ILootTableDefinition {
  /** Unique identifier */
  id: string;

  /** Loot pools */
  pools: ILootPool[];
}

// ============================================================================
// RECIPE DEFINITION
// ============================================================================

/**
 * Recipe definition.
 */
export interface IRecipeDefinition {
  /** Unique identifier */
  id: string;

  /** Recipe type */
  type: "shaped" | "shapeless" | "furnace" | "brewing" | "smithing";

  /** Output item */
  result: string | { item: string; count: number };

  /** Pattern for shaped recipes (e.g., ["###", " | ", " | "]) */
  pattern?: string[];

  /** Key mapping for shaped recipes (e.g., { "#": "iron_ingot", "|": "stick" }) */
  key?: Record<string, string>;

  /** Ingredients for shapeless recipes */
  ingredients?: string[];

  /** Input for furnace/smelting recipes */
  input?: string;

  /** Experience for furnace recipes */
  experience?: number;

  /** Cook time for furnace recipes */
  cookTime?: number;

  /** Items that unlock this recipe when obtained */
  unlocksWith?: string[];
}

// ============================================================================
// SPAWN RULE DEFINITION
// ============================================================================

/**
 * Spawn rule definition.
 */
export interface ISpawnRuleDefinition {
  /** Entity this rule applies to */
  entity: string;

  /** Biomes where entity spawns */
  biomes?: string[];

  /** Spawn weight */
  weight?: number;

  /** Group size range */
  groupSize?: { min: number; max: number };

  /** Light level range */
  lightLevel?: { min?: number; max?: number };

  /** Y level range */
  heightRange?: { min?: number; max?: number };

  /** Time of day */
  timeOfDay?: "day" | "night" | "any";

  /** Surface or underground */
  surface?: boolean;

  /** Block types to spawn on */
  spawnOn?: string[];

  /** Population cap */
  populationCap?: number;
}

// ============================================================================
// SHARED RESOURCES
// ============================================================================

/**
 * Shared resources that can be referenced by multiple content items.
 */
export interface ISharedResources {
  /** Shared texture definitions */
  textures?: Record<string, ITextureSpec>;

  /** Shared geometry definitions */
  geometries?: Record<string, IGeometrySpec>;

  /** Shared sound definitions */
  sounds?: Record<string, ISoundDefinition>;
}

/**
 * Sound definition.
 */
export interface ISoundDefinition {
  /** Sound file path */
  file?: string;

  /** Volume (0-1) */
  volume?: number;

  /** Pitch */
  pitch?: number;

  /** Category */
  category?: "master" | "music" | "ambient" | "hostile" | "neutral" | "player";
}

// ============================================================================
// PROJECT SCHEMA EXPORT (for understanding existing projects)
// ============================================================================

/**
 * Exported schema from an existing project.
 * Used to help AI understand what's already in a project.
 */
export interface IProjectSchemaExport {
  /** Schema version */
  schemaVersion: "1.0.0";

  /** When this was generated */
  exportedAt: string;

  /** Project overview */
  project: {
    name: string;
    namespace?: string;
  };

  /** Entity types in project (simplified view) */
  entityTypes: IEntityTypeSummary[];

  /** Block types in project (simplified view) */
  blockTypes: IBlockTypeSummary[];

  /** Item types in project (simplified view) */
  itemTypes: IItemTypeSummary[];

  /** Structures in project */
  structures: IStructureSummary[];

  /** Cross-reference map */
  dependencies: IDependencyMap;
}

/**
 * Summary of an entity type (for project export).
 */
export interface IEntityTypeSummary {
  id: string;
  displayName: string;
  detectedTraits: EntityTraitId[];
  stats: {
    health?: number;
    attackDamage?: number;
    movementSpeed?: number;
  };
  files: {
    behavior: string;
    resource?: string;
    texture?: string;
    geometry?: string;
  };
  references: string[];
}

/**
 * Summary of a block type (for project export).
 */
export interface IBlockTypeSummary {
  id: string;
  displayName: string;
  detectedTraits: BlockTraitId[];
  files: {
    behavior: string;
    texture?: string;
    geometry?: string;
  };
}

/**
 * Summary of an item type (for project export).
 */
export interface IItemTypeSummary {
  id: string;
  displayName: string;
  detectedTraits: ItemTraitId[];
  files: {
    behavior: string;
    icon?: string;
  };
}

/**
 * Summary of a structure (for project export).
 */
export interface IStructureSummary {
  id: string;
  displayName?: string;
  type: "simple" | "jigsaw";
  files: string[];
}

/**
 * Dependency map showing what references what.
 */
export interface IDependencyMap {
  [contentId: string]: {
    dependsOn: string[];
    usedBy: string[];
  };
}

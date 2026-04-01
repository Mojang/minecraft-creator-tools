// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Zod schemas for Minecraft Content Meta-Schema.
 *
 * These schemas are used for:
 * 1. MCP tool input validation
 * 2. Runtime type checking
 * 3. AI-friendly schema descriptions
 *
 * The schemas mirror the TypeScript interfaces in IContentMetaSchema.ts
 */

import { z } from "zod";

// ============================================================================
// TEXTURE AND GEOMETRY SCHEMAS (reusing existing patterns)
// ============================================================================

/**
 * Color specification - hex string or RGB object.
 */
export const McpColorSchema = z.union([
  z.string().describe("Hex color like '#FF0000' or 'rgb(255,0,0)'"),
  z.object({
    r: z.number().min(0).max(255).describe("Red channel (0-255)"),
    g: z.number().min(0).max(255).describe("Green channel (0-255)"),
    b: z.number().min(0).max(255).describe("Blue channel (0-255)"),
    a: z.number().min(0).max(255).optional().describe("Alpha channel (0-255, default 255)"),
  }),
]);

/**
 * Textured rectangle - procedural texture generation.
 */
export const TexturedRectangleSchema = z
  .object({
    type: z
      .enum(["solid", "random_noise", "dither_noise", "perlin_noise", "stipple_noise", "gradient"])
      .describe("Fill algorithm: solid, or noise types for Minecraft-style textures"),
    colors: z.array(McpColorSchema).min(1).describe("Colors to use. For solid, only first is used"),
    factor: z.number().min(0).max(1).optional().describe("Noise intensity (0-1). Default: 0.2"),
    seed: z.number().int().optional().describe("Random seed for deterministic results"),
    pixelSize: z.number().int().min(1).optional().describe("Pixel size for noise. Default: 1"),
    scale: z.number().optional().describe("Scale for perlin noise. Default: 4"),
  })
  .describe("Procedural texture using Minecraft-style patterns");

/**
 * Pixel art overlay.
 */
export const PixelArtSchema = z
  .object({
    scaleMode: z
      .enum(["unit", "exact", "cover"])
      .optional()
      .describe("How to scale: unit (1 char = 1 MC unit), exact (1 char = 1 pixel), cover (stretch to fill)"),
    x: z.number().optional().describe("X offset from left edge"),
    y: z.number().optional().describe("Y offset from top edge"),
    lines: z.array(z.string()).describe("Rows of characters from top to bottom. Space = transparent"),
    palette: z
      .record(
        z.object({
          r: z.number().min(0).max(255).optional(),
          g: z.number().min(0).max(255).optional(),
          b: z.number().min(0).max(255).optional(),
          a: z.number().min(0).max(255).optional(),
          hex: z.string().optional(),
        })
      )
      .describe("Map characters to colors. Don't define space - it's always transparent"),
  })
  .describe("ASCII-art style pixel overlay for textures");

/**
 * Texture specification.
 */
export const TextureSpecSchema = z
  .object({
    file: z.string().optional().describe("Reference existing texture file (relative to resource pack)"),
    generate: TexturedRectangleSchema.optional().describe("Generate texture procedurally"),
    pixelArt: z.array(PixelArtSchema).optional().describe("Pixel art overlays"),
  })
  .describe("Texture specification - file reference or procedural generation");

/**
 * Geometry template types.
 */
export const GeometryTemplateSchema = z
  .enum(["humanoid", "quadruped", "quadruped_small", "bird", "fish", "insect", "slime", "flying", "block", "item"])
  .describe("Pre-built geometry template");

/**
 * Geometry specification.
 */
export const GeometrySpecSchema = z
  .object({
    file: z.string().optional().describe("Reference existing geometry file"),
    template: GeometryTemplateSchema.optional().describe("Use a template geometry"),
    // Note: full IMcpModelDesign is complex, accepting any object for now
    design: z.record(z.any()).optional().describe("Inline model design (IMcpModelDesign format)"),
  })
  .describe("Geometry specification - file reference, template, or inline design");

// ============================================================================
// ENTITY TYPE SCHEMAS
// ============================================================================

/**
 * Entity traits.
 */
export const EntityTraitSchema = z
  .enum([
    // Body types
    "humanoid",
    "quadruped",
    "quadruped_small",
    "flying",
    "aquatic",
    "arthropod",
    "slime",
    // Behavior archetypes
    "hostile",
    "passive",
    "neutral",
    "boss",
    // Combat styles
    "melee_attacker",
    "ranged_attacker",
    "exploder",
    // Interaction
    "trader",
    "tameable",
    "rideable",
    "breedable",
    "leasable",
    // Special
    "undead",
    "illager",
    "aquatic_only",
    "baby_variant",
    "wanders",
    "patrols",
    "guards",
    "flees_daylight",
    "teleporter",
  ])
  .describe("Pre-packaged bundle of components, behaviors, and appearance");

/**
 * Entity behavior presets.
 */
export const EntityBehaviorPresetSchema = z
  .enum([
    // Movement
    "wander",
    "swim",
    "fly_around",
    "float",
    "climb",
    // Combat
    "melee_attack",
    "ranged_attack",
    "target_players",
    "target_monsters",
    "flee_when_hurt",
    "retaliate",
    // Social
    "follow_owner",
    "follow_parent",
    "herd",
    "avoid_players",
    // Interaction
    "look_at_player",
    "beg",
    "tempt",
    "sit_command",
    // Actions
    "eat_grass",
    "break_doors",
    "open_doors",
    "pick_up_items",
    "sleep_in_bed",
    // Environment
    "hide_from_sun",
    "go_home_at_night",
    "seek_water",
    "seek_land",
  ])
  .describe("Simplified behavior that maps to AI components");

/**
 * Drop definition.
 */
export const DropSchema = z
  .object({
    item: z.string().describe("Item ID (vanilla like 'iron_sword' or namespaced like 'namespace:custom')"),
    chance: z.number().min(0).max(1).optional().describe("Drop chance (0-1). Default: 1.0"),
    count: z
      .union([z.number().int(), z.object({ min: z.number().int(), max: z.number().int() })])
      .optional()
      .describe("Stack size - number or {min, max} range"),
    killedByPlayer: z.boolean().optional().describe("Only drop if killed by player"),
    lootingBonus: z.number().optional().describe("Bonus items per looting level"),
  })
  .describe("What drops when entity is killed or block is mined");

/**
 * Entity appearance.
 */
export const EntityAppearanceSchema = z
  .object({
    bodyType: GeometryTemplateSchema.optional().describe("Base body template for geometry"),
    primaryColor: z.string().optional().describe("Primary color (hex) for texture generation"),
    secondaryColor: z.string().optional().describe("Secondary/accent color (hex)"),
    textureStyle: z
      .enum(["solid", "spotted", "striped", "gradient", "organic", "armored"])
      .optional()
      .describe("Texture pattern style"),
    scale: z.number().optional().describe("Scale multiplier"),
    eyes: z.enum(["normal", "glowing", "red", "none"]).optional().describe("Eye style"),
    particles: z
      .array(z.enum(["flames", "smoke", "drip", "sparkle", "hearts"]))
      .optional()
      .describe("Particle effects"),
    texture: TextureSpecSchema.optional().describe("Custom texture (overrides auto-generation)"),
    geometry: GeometrySpecSchema.optional().describe("Custom geometry (overrides bodyType)"),
  })
  .describe("Simplified appearance specification");

/**
 * Tameable configuration.
 */
export const TameableConfigSchema = z.object({
  tameItems: z.array(z.string()).describe("Items that can be used to tame"),
  chance: z.number().min(0).max(1).optional().describe("Chance per attempt (0-1)"),
});

/**
 * Rideable configuration.
 */
export const RideableConfigSchema = z.object({
  seatCount: z.number().int().optional().describe("Number of seats"),
  controllable: z.boolean().optional().describe("Can be controlled by player"),
  controlItems: z.array(z.string()).optional().describe("Items required to control"),
});

/**
 * Breedable configuration.
 */
export const BreedableConfigSchema = z.object({
  breedItems: z.array(z.string()).describe("Items that trigger breeding"),
  breedCooldown: z.number().optional().describe("Seconds between breeding"),
});

/**
 * Spawn configuration.
 */
export const SpawnConfigSchema = z
  .object({
    biomes: z.array(z.string()).optional().describe("Biomes where entity spawns"),
    weight: z.number().int().optional().describe("Spawn weight (higher = more common)"),
    groupSize: z.object({ min: z.number().int(), max: z.number().int() }).optional().describe("Group size range"),
    lightLevel: z
      .object({
        min: z.number().int().min(0).max(15).optional(),
        max: z.number().int().min(0).max(15).optional(),
      })
      .optional()
      .describe("Light level range (0-15)"),
    heightRange: z.object({ min: z.number(), max: z.number() }).optional().describe("Y level range"),
    timeOfDay: z.enum(["day", "night", "any"]).optional().describe("When to spawn"),
    surface: z.boolean().optional().describe("Surface or underground"),
    spawnOn: z.array(z.string()).optional().describe("Block types to spawn on"),
    populationCap: z.number().int().optional().describe("Max population in area"),
    rarity: z.number().optional().describe("1 in N chance per spawn cycle"),
  })
  .describe("Spawn configuration");

/**
 * Entity sounds.
 */
export const EntitySoundsSchema = z.object({
  ambient: z.string().optional(),
  hurt: z.string().optional(),
  death: z.string().optional(),
  step: z.string().optional(),
  attack: z.string().optional(),
});

/**
 * Entity type definition.
 */
export const EntityTypeSchema = z
  .object({
    id: z.string().describe("Unique identifier (full ID becomes 'namespace:id')"),
    displayName: z.string().describe("Display name shown in-game"),

    // Trait-based
    traits: z.array(EntityTraitSchema).optional().describe("Pre-built trait bundles to apply"),

    // Simplified properties
    health: z.number().optional().describe("Health points"),
    attackDamage: z.number().optional().describe("Attack damage"),
    movementSpeed: z.number().optional().describe("Movement speed (blocks/sec)"),
    followRange: z.number().optional().describe("Follow/detection range"),
    knockbackResistance: z.number().min(0).max(1).optional().describe("Knockback resistance (0-1)"),
    scale: z.number().optional().describe("Scale multiplier"),
    collisionWidth: z.number().optional().describe("Collision box width"),
    collisionHeight: z.number().optional().describe("Collision box height"),

    behaviors: z.array(EntityBehaviorPresetSchema).optional().describe("AI behavior presets"),
    drops: z.array(DropSchema).optional().describe("What drops when killed"),
    appearance: EntityAppearanceSchema.optional().describe("Appearance specification"),
    families: z.array(z.string()).optional().describe("Entity type families"),

    hostile: z.boolean().optional().describe("Is hostile to players?"),
    tameable: z.union([z.boolean(), TameableConfigSchema]).optional().describe("Can be tamed"),
    rideable: z.union([z.boolean(), RideableConfigSchema]).optional().describe("Can be ridden"),
    breedable: z.union([z.boolean(), BreedableConfigSchema]).optional().describe("Can be bred"),

    // Native components (full control)
    components: z.record(z.any()).optional().describe("Native Minecraft components (override traits)"),
    componentGroups: z.record(z.record(z.any())).optional().describe("Component groups for conditions"),
    events: z.record(z.any()).optional().describe("Events for component group changes"),

    // Resources
    geometry: GeometrySpecSchema.optional().describe("Custom geometry"),
    texture: TextureSpecSchema.optional().describe("Custom texture"),
    sounds: EntitySoundsSchema.optional().describe("Sound definitions"),

    // Spawning
    spawning: SpawnConfigSchema.optional().describe("Inline spawn rule"),
  })
  .describe("Entity type definition with traits, simplified props, or native components");

// ============================================================================
// BLOCK TYPE SCHEMAS
// ============================================================================

/**
 * Block traits.
 */
export const BlockTraitSchema = z
  .enum([
    "solid",
    "transparent",
    "leaves",
    "log",
    "slab",
    "stairs",
    "fence",
    "wall",
    "door",
    "trapdoor",
    "container",
    "workstation",
    "light_source",
    "gravity",
    "liquid",
    "redstone_signal",
    "redstone_receiver",
    "button",
    "lever",
    "pressure_plate",
  ])
  .describe("Pre-packaged block behavior bundle");

/**
 * Block shape.
 */
export const BlockShapeSchema = z
  .enum(["cube", "slab", "stairs", "fence", "wall", "cross", "custom"])
  .describe("Block shape type");

/**
 * Block sound type.
 */
export const BlockSoundSchema = z
  .enum(["stone", "wood", "gravel", "grass", "sand", "glass", "metal", "cloth", "snow", "coral"])
  .describe("Sound set for block");

/**
 * Block texture.
 */
export const BlockTextureSchema = z
  .object({
    all: z.union([z.string(), TextureSpecSchema]).optional().describe("All sides same texture"),
    up: z.union([z.string(), TextureSpecSchema]).optional().describe("Top face"),
    down: z.union([z.string(), TextureSpecSchema]).optional().describe("Bottom face"),
    north: z.union([z.string(), TextureSpecSchema]).optional().describe("North face"),
    south: z.union([z.string(), TextureSpecSchema]).optional().describe("South face"),
    east: z.union([z.string(), TextureSpecSchema]).optional().describe("East face"),
    west: z.union([z.string(), TextureSpecSchema]).optional().describe("West face"),
    side: z.union([z.string(), TextureSpecSchema]).optional().describe("All side faces"),
  })
  .describe("Block texture specification - per-face or uniform");

/**
 * Flammable config.
 */
export const FlammableConfigSchema = z.object({
  catchChance: z.number().min(0).max(1).describe("Chance to catch fire"),
  destroyChance: z.number().min(0).max(1).describe("Chance to be destroyed"),
});

/**
 * Block type definition.
 */
export const BlockTypeSchema = z
  .object({
    id: z.string().describe("Unique identifier"),
    displayName: z.string().describe("Display name"),

    traits: z.array(BlockTraitSchema).optional().describe("Pre-built trait bundles"),

    destroyTime: z.number().optional().describe("Seconds to mine (0=instant, -1=unbreakable)"),
    explosionResistance: z.number().optional().describe("Explosion resistance"),
    friction: z.number().min(0).max(1).optional().describe("Friction (0-1). Default: 0.6"),
    lightEmission: z.number().int().min(0).max(15).optional().describe("Light emission (0-15)"),
    lightDampening: z.number().int().min(0).max(15).optional().describe("Light dampening (0-15)"),
    flammable: z.union([z.boolean(), FlammableConfigSchema]).optional().describe("Flammability"),
    mapColor: z.string().optional().describe("Map color (hex)"),
    shape: BlockShapeSchema.optional().describe("Block shape"),
    drops: z.array(DropSchema).optional().describe("What drops when mined"),

    texture: BlockTextureSchema.optional().describe("Texture specification"),
    geometry: GeometrySpecSchema.optional().describe("Custom geometry"),
    sounds: BlockSoundSchema.optional().describe("Sound set"),

    components: z.record(z.unknown()).optional().describe("Native Minecraft components"),
    permutations: z.array(z.record(z.unknown())).optional().describe("Block state permutations"),
    states: z.record(z.union([z.array(z.boolean()), z.array(z.number()), z.array(z.string())])).optional(),
    events: z.record(z.unknown()).optional(),
  })
  .describe("Block type definition");

// ============================================================================
// ITEM TYPE SCHEMAS
// ============================================================================

/**
 * Item traits.
 */
export const ItemTraitSchema = z.enum([
  "sword",
  "pickaxe",
  "axe",
  "shovel",
  "hoe",
  "bow",
  "crossbow",
  "food",
  "armor_helmet",
  "armor_chestplate",
  "armor_leggings",
  "armor_boots",
  "throwable",
  "placeable",
]);

/**
 * Item category.
 */
export const ItemCategorySchema = z.enum(["construction", "nature", "equipment", "items", "none"]);

/**
 * Food effect.
 */
export const FoodEffectSchema = z.object({
  name: z.string().describe("Effect name (e.g., 'speed', 'regeneration')"),
  duration: z.number().describe("Duration in seconds"),
  amplifier: z.number().int().optional().describe("Amplifier (0 = level 1)"),
  chance: z.number().min(0).max(1).optional().describe("Chance to apply"),
});

/**
 * Food properties.
 */
export const FoodPropertiesSchema = z.object({
  nutrition: z.number().int().describe("Hunger points restored"),
  saturation: z.number().optional().describe("Saturation modifier"),
  canAlwaysEat: z.boolean().optional().describe("Can eat when full"),
  effects: z.array(FoodEffectSchema).optional().describe("Status effects when eaten"),
});

/**
 * Tool properties.
 */
export const ToolPropertiesSchema = z.object({
  miningSpeed: z.number().optional().describe("Mining speed multiplier"),
  miningLevel: z.enum(["wood", "stone", "iron", "diamond", "netherite"]).optional(),
  durability: z.number().int().describe("Tool durability"),
});

/**
 * Weapon properties.
 */
export const WeaponPropertiesSchema = z.object({
  damage: z.number().describe("Attack damage"),
  attackSpeed: z.number().optional().describe("Attacks per second"),
  durability: z.number().int().optional().describe("Weapon durability"),
  knockback: z.number().optional().describe("Knockback amount"),
});

/**
 * Armor properties.
 */
export const ArmorPropertiesSchema = z.object({
  defense: z.number().int().describe("Defense points"),
  slot: z.enum(["helmet", "chestplate", "leggings", "boots"]).describe("Armor slot"),
  durability: z.number().int().describe("Armor durability"),
  toughness: z.number().optional().describe("Armor toughness"),
});

/**
 * Item type definition.
 */
export const ItemTypeSchema = z
  .object({
    id: z.string().describe("Unique identifier"),
    displayName: z.string().describe("Display name"),

    traits: z.array(ItemTraitSchema).optional().describe("Pre-built trait bundles"),

    maxStackSize: z.number().int().min(1).max(64).optional().describe("Max stack size. Default: 64"),
    category: ItemCategorySchema.optional().describe("Creative menu category"),
    durability: z.number().int().optional().describe("Durability"),
    food: FoodPropertiesSchema.optional().describe("Food properties"),
    tool: ToolPropertiesSchema.optional().describe("Tool properties"),
    weapon: WeaponPropertiesSchema.optional().describe("Weapon properties"),
    armor: ArmorPropertiesSchema.optional().describe("Armor properties"),
    glint: z.boolean().optional().describe("Enchanted glint effect"),
    fuel: z.number().int().optional().describe("Burn duration in ticks"),

    icon: z.union([z.string(), TextureSpecSchema]).optional().describe("Inventory icon"),
    geometry: GeometrySpecSchema.optional().describe("3D model when held"),

    components: z.record(z.any()).optional().describe("Native Minecraft components"),
    events: z.record(z.any()).optional(),
  })
  .describe("Item type definition");

// ============================================================================
// STRUCTURE SCHEMAS
// ============================================================================

/**
 * Block volume for inline structure definition.
 * Uses same format as MCP structure design tools.
 */
export const BlockVolumeSchema = z
  .object({
    southWestBottom: z
      .object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
      })
      .describe("World position of south-west-bottom corner"),
    size: z
      .object({
        x: z.number().int(),
        y: z.number().int(),
        z: z.number().int(),
      })
      .optional()
      .describe("Optional dimensions - inferred from data if not provided"),
    blockLayersBottomToTop: z
      .array(z.array(z.string()))
      .describe("Y layers from bottom to top. Each layer: rows from north to south. Each char: X from west to east"),
    key: z
      .record(
        z.object({
          typeId: z.string().describe("Block type ID"),
          properties: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
        })
      )
      .describe("Map single characters to block types. Space = air"),
  })
  .describe("Block volume using layer-by-layer character grid");

/**
 * Jigsaw connection.
 */
export const JigsawConnectionSchema = z.object({
  name: z.string().describe("Connection name for matching"),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }).describe("Position in structure"),
  direction: z.enum(["up", "down", "north", "south", "east", "west"]).describe("Direction connection faces"),
  canConnectTo: z.array(z.string()).describe("Names of connections this can connect to"),
  required: z.boolean().optional().describe("Is this connection required?"),
});

/**
 * Structure spawn.
 */
export const StructureSpawnSchema = z.object({
  entity: z.string().describe("Entity ID to spawn"),
  count: z
    .union([z.number().int(), z.object({ min: z.number().int(), max: z.number().int() })])
    .describe("Spawn count"),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
  spread: z.number().optional().describe("Spread radius"),
});

/**
 * Structure loot.
 */
export const StructureLootSchema = z.object({
  lootTable: z.string().describe("Loot table ID"),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }).describe("Container position"),
  containerType: z.enum(["chest", "barrel", "spawner"]).optional(),
});

/**
 * Jigsaw piece.
 */
export const JigsawPieceSchema = z
  .object({
    id: z.string().describe("Piece identifier"),
    structureFile: z.string().optional().describe("Path to .mcstructure file"),
    blocks: BlockVolumeSchema.optional().describe("Inline block volume definition"),
    connections: z.array(JigsawConnectionSchema).describe("Connection points"),
    weight: z.number().optional().describe("Weight for random selection. Default: 1"),
    maxCount: z.number().int().optional().describe("Max times this piece can appear"),
    spawns: z.array(StructureSpawnSchema).optional().describe("Entities to spawn"),
    loot: z.array(StructureLootSchema).optional().describe("Loot containers"),
  })
  .describe("Jigsaw structure piece");

/**
 * Jigsaw definition.
 */
export const JigsawDefinitionSchema = z
  .object({
    pieces: z.array(JigsawPieceSchema).describe("All pieces in the structure"),
    startPiece: z.string().describe("ID of starting piece"),
    maxDepth: z.number().int().optional().describe("Maximum generation depth. Default: 7"),
    maxSize: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
  })
  .describe("Jigsaw structure definition - auto-creates template pools and connections");

/**
 * Structure generation.
 */
export const StructureGenerationSchema = z.object({
  biomes: z.array(z.string()).optional().describe("Biomes where structure generates"),
  heightRange: z.object({ min: z.number(), max: z.number() }).optional(),
  rarity: z.number().optional().describe("1 in N chunks. Default: 100"),
  terrainAdaptation: z.enum(["none", "bury", "beard_thin", "beard_box"]).optional(),
  underground: z.boolean().optional(),
});

/**
 * Structure definition.
 */
export const StructureSchema = z
  .object({
    id: z.string().describe("Unique identifier"),
    displayName: z.string().optional(),
    type: z.enum(["simple", "jigsaw"]).describe("Structure type"),
    structureFile: z.string().optional().describe("Path to .mcstructure (for simple)"),
    blocks: BlockVolumeSchema.optional().describe("Inline blocks (for simple)"),
    jigsaw: JigsawDefinitionSchema.optional().describe("Jigsaw definition"),
    generation: StructureGenerationSchema.optional().describe("World generation settings"),
  })
  .describe("Structure definition - simple or jigsaw");

// ============================================================================
// FEATURE SCHEMAS
// ============================================================================

/**
 * Feature placement.
 */
export const FeaturePlacementSchema = z.object({
  type: z.enum(["block", "structure", "tree", "ore", "vegetation"]).describe("What to place"),
  id: z.string().describe("Block/structure ID"),
  count: z.union([z.number().int(), z.object({ min: z.number().int(), max: z.number().int() })]).optional(),
  replacesBlocks: z.array(z.string()).optional().describe("Blocks that can be replaced (for ore)"),
});

/**
 * Height placement.
 */
export const HeightPlacementSchema = z.object({
  type: z.enum(["surface", "underground", "fixed", "range"]),
  y: z.number().optional().describe("Y level for fixed"),
  min: z.number().optional(),
  max: z.number().optional(),
});

/**
 * Scatter pattern.
 */
export const ScatterPatternSchema = z.object({
  type: z.enum(["uniform", "cluster", "line"]),
  radius: z.number().optional(),
});

/**
 * Feature spread - simplified feature hierarchy.
 */
export const FeatureSpreadSchema = z
  .object({
    places: z.array(FeaturePlacementSchema).describe("What to place"),
    count: z.union([z.number().int(), z.object({ min: z.number().int(), max: z.number().int() })]).optional(),
    heightPlacement: HeightPlacementSchema.optional(),
    scatter: ScatterPatternSchema.optional(),
    biomes: z.array(z.string()).optional(),
    rarity: z.number().optional().describe("1 in N chunks"),
  })
  .describe("Simplified feature spread - generates complete feature rule + hierarchy");

/**
 * Feature definition.
 */
export const FeatureSchema = z
  .object({
    id: z.string().describe("Unique identifier"),
    displayName: z.string().optional(),
    spread: FeatureSpreadSchema.optional().describe("Simplified feature spread"),
    nativeFeature: z.record(z.any()).optional().describe("Native Minecraft feature JSON"),
    nativeFeatureRule: z.record(z.any()).optional().describe("Native feature rule JSON"),
  })
  .describe("Feature definition for world generation");

// ============================================================================
// LOOT TABLE SCHEMAS
// ============================================================================

/**
 * Loot entry.
 */
export const LootEntrySchema = z.object({
  item: z.string().describe("Item ID"),
  weight: z.number().optional().describe("Weight for random selection"),
  count: z.union([z.number().int(), z.object({ min: z.number().int(), max: z.number().int() })]).optional(),
  chance: z.number().min(0).max(1).optional(),
  killedByPlayer: z.boolean().optional(),
  lootingBonus: z.number().optional(),
});

/**
 * Loot condition.
 */
export const LootConditionSchema = z.union([
  z.object({ type: z.literal("killed_by_player") }),
  z.object({ type: z.literal("random_chance"), chance: z.number() }),
  z.object({ type: z.literal("looting_enchant"), multiplier: z.number() }),
]);

/**
 * Loot pool.
 */
export const LootPoolSchema = z.object({
  rolls: z.union([z.number().int(), z.object({ min: z.number().int(), max: z.number().int() })]),
  entries: z.array(LootEntrySchema),
  conditions: z.array(LootConditionSchema).optional(),
});

/**
 * Loot table definition.
 */
export const LootTableSchema = z
  .object({
    id: z.string().describe("Unique identifier"),
    pools: z.array(LootPoolSchema).describe("Loot pools"),
  })
  .describe("Loot table definition");

// ============================================================================
// RECIPE SCHEMAS
// ============================================================================

/**
 * Recipe definition.
 */
export const RecipeSchema = z
  .object({
    id: z.string().describe("Unique identifier"),
    type: z.enum(["shaped", "shapeless", "furnace", "brewing", "smithing"]),
    result: z.union([z.string(), z.object({ item: z.string(), count: z.number().int() })]),
    pattern: z.array(z.string()).optional().describe("Pattern for shaped (e.g., ['###', ' | ', ' | '])"),
    key: z.record(z.string()).optional().describe("Key mapping for shaped"),
    ingredients: z.array(z.string()).optional().describe("Ingredients for shapeless"),
    input: z.string().optional().describe("Input for furnace"),
    experience: z.number().optional().describe("XP for furnace"),
    cookTime: z.number().int().optional().describe("Cook time for furnace"),
    unlocksWith: z.array(z.string()).optional().describe("Items that unlock recipe"),
  })
  .describe("Recipe definition");

// ============================================================================
// SPAWN RULE SCHEMAS
// ============================================================================

/**
 * Spawn rule definition.
 */
export const SpawnRuleSchema = z
  .object({
    entity: z.string().describe("Entity ID this rule applies to"),
    biomes: z.array(z.string()).optional(),
    weight: z.number().optional(),
    groupSize: z.object({ min: z.number().int(), max: z.number().int() }).optional(),
    lightLevel: z.object({ min: z.number().int().optional(), max: z.number().int().optional() }).optional(),
    heightRange: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
    timeOfDay: z.enum(["day", "night", "any"]).optional(),
    surface: z.boolean().optional(),
    spawnOn: z.array(z.string()).optional(),
    populationCap: z.number().int().optional(),
  })
  .describe("Spawn rule definition");

// ============================================================================
// SHARED RESOURCES
// ============================================================================

/**
 * Sound definition.
 */
export const SoundDefinitionSchema = z.object({
  file: z.string().optional(),
  volume: z.number().min(0).max(1).optional(),
  pitch: z.number().optional(),
  category: z.enum(["master", "music", "ambient", "hostile", "neutral", "player"]).optional(),
});

/**
 * Shared resources.
 */
export const SharedResourcesSchema = z.object({
  textures: z.record(TextureSpecSchema).optional(),
  geometries: z.record(GeometrySpecSchema).optional(),
  sounds: z.record(SoundDefinitionSchema).optional(),
});

// ============================================================================
// GENERATION OPTIONS
// ============================================================================

/**
 * Generation options.
 */
export const GenerationOptionsSchema = z.object({
  generatePlaceholderTextures: z.boolean().optional().describe("Auto-generate placeholder textures. Default: true"),
  generateDefaultGeometry: z.boolean().optional().describe("Auto-generate default geometry. Default: true"),
  createDefaultSpawnRules: z.boolean().optional().describe("Auto-create spawn rules. Default: false"),
  createLootTablesFromDrops: z.boolean().optional().describe("Create loot tables from drops. Default: true"),
  textureResolution: z
    .union([z.literal(1), z.literal(2), z.literal(4)])
    .optional()
    .describe("Pixels per unit. Default: 2"),
});

// ============================================================================
// ROOT SCHEMA
// ============================================================================

/**
 * Complete Minecraft content definition schema.
 */
export const MinecraftContentSchema = z
  .object({
    schemaVersion: z.literal("1.0.0").describe("Schema version"),
    namespace: z
      .string()
      .optional()
      .describe("Namespace for all content (e.g., 'orc_dungeon'). Optional if adding to existing project"),
    displayName: z.string().optional().describe("Human-readable pack name"),
    description: z.string().optional().describe("Pack description"),

    entityTypes: z.array(EntityTypeSchema).optional().describe("Entity type definitions"),
    blockTypes: z.array(BlockTypeSchema).optional().describe("Block type definitions"),
    itemTypes: z.array(ItemTypeSchema).optional().describe("Item type definitions"),
    structures: z.array(StructureSchema).optional().describe("Structure definitions"),
    features: z.array(FeatureSchema).optional().describe("Feature definitions for world generation"),
    lootTables: z.array(LootTableSchema).optional().describe("Loot table definitions"),
    recipes: z.array(RecipeSchema).optional().describe("Recipe definitions"),
    spawnRules: z.array(SpawnRuleSchema).optional().describe("Spawn rule definitions"),

    sharedResources: SharedResourcesSchema.optional().describe("Resources shared by multiple content items"),
    options: GenerationOptionsSchema.optional().describe("Generation options"),
  })
  .describe(
    "Minecraft content meta-schema - a simplified format for AI-friendly content creation. " +
      "Supports traits (pre-packaged bundles), simplified properties, and native Minecraft components."
  );

/**
 * Type inference from schema.
 */
export type MinecraftContent = z.infer<typeof MinecraftContentSchema>;
export type EntityType = z.infer<typeof EntityTypeSchema>;
export type BlockType = z.infer<typeof BlockTypeSchema>;
export type ItemType = z.infer<typeof ItemTypeSchema>;
export type Structure = z.infer<typeof StructureSchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type LootTable = z.infer<typeof LootTableSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type SpawnRule = z.infer<typeof SpawnRuleSchema>;

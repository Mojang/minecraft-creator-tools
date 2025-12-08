// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import NbtBinaryTag from "./NbtBinaryTag";

/**
 * Represents an entity stored in a chunk's entity data.
 * This is a lightweight representation used for world map rendering.
 */
export default class ChunkEntity {
  /** The entity type identifier (e.g., "minecraft:cow", "minecraft:zombie") */
  identifier: string;

  /** Entity position (absolute world coordinates) */
  x: number;
  y: number;
  z: number;

  /** Entity rotation (yaw, pitch) */
  yaw?: number;
  pitch?: number;

  /** Whether the entity is a baby */
  isBaby?: boolean;

  /** Whether the entity is tamed */
  isTamed?: boolean;

  /** Entity variant (for entities with visual variants) */
  variant?: number;

  /** Entity's unique ID */
  uniqueId?: bigint;

  /** Custom name if set */
  customName?: string;

  /** Entity definitions (component groups) */
  definitions?: string[];

  constructor(identifier: string, x: number, y: number, z: number) {
    this.identifier = identifier;
    this.x = x;
    this.y = y;
    this.z = z;
  }

  /**
   * Creates a ChunkEntity from an NBT compound tag.
   */
  static fromNbtTag(root: NbtBinaryTag): ChunkEntity | undefined {
    const identifierTag = root.find("identifier");
    const posTag = root.find("Pos");

    if (!identifierTag || !posTag) {
      return undefined;
    }

    const identifier = identifierTag.valueAsString;
    const pos = posTag.valueAsNumericArray;

    if (!identifier || !pos || pos.length < 3) {
      return undefined;
    }

    const entity = new ChunkEntity(identifier, pos[0], pos[1], pos[2]);

    // Parse rotation
    const rotationTag = root.find("Rotation");
    if (rotationTag) {
      const rotation = rotationTag.valueAsNumericArray;
      if (rotation && rotation.length >= 2) {
        entity.yaw = rotation[0];
        entity.pitch = rotation[1];
      }
    }

    // Parse optional properties
    const isBabyTag = root.find("IsBaby");
    if (isBabyTag) {
      entity.isBaby = isBabyTag.valueAsBoolean;
    }

    const isTamedTag = root.find("IsTamed");
    if (isTamedTag) {
      entity.isTamed = isTamedTag.valueAsBoolean;
    }

    const variantTag = root.find("Variant");
    if (variantTag) {
      entity.variant = variantTag.valueAsInt;
    }

    const uniqueIdTag = root.find("UniqueID");
    if (uniqueIdTag) {
      entity.uniqueId = uniqueIdTag.valueAsBigInt;
    }

    const customNameTag = root.find("CustomName");
    if (customNameTag) {
      entity.customName = customNameTag.valueAsString;
    }

    const definitionsTag = root.find("definitions");
    if (definitionsTag) {
      entity.definitions = definitionsTag.valueAsStringArray;
    }

    return entity;
  }

  /**
   * Gets a short, human-readable name for this entity type.
   */
  get shortName(): string {
    let name = this.identifier;

    // Remove namespace prefix
    const colonIndex = name.indexOf(":");
    if (colonIndex >= 0) {
      name = name.substring(colonIndex + 1);
    }

    // Convert snake_case to Title Case
    return name
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Checks if this is a hostile mob.
   */
  get isHostile(): boolean {
    const hostileMobs = [
      "zombie",
      "skeleton",
      "creeper",
      "spider",
      "cave_spider",
      "enderman",
      "witch",
      "slime",
      "magma_cube",
      "blaze",
      "ghast",
      "wither_skeleton",
      "zombie_pigman",
      "zombified_piglin",
      "piglin",
      "piglin_brute",
      "hoglin",
      "zoglin",
      "drowned",
      "husk",
      "stray",
      "phantom",
      "pillager",
      "vindicator",
      "evoker",
      "ravager",
      "vex",
      "warden",
      "elder_guardian",
      "guardian",
      "shulker",
      "endermite",
      "silverfish",
      "breeze",
      "bogged",
    ];

    const shortId = this.identifier.replace("minecraft:", "");
    return hostileMobs.includes(shortId);
  }

  /**
   * Checks if this is a passive/friendly mob.
   */
  get isPassive(): boolean {
    const passiveMobs = [
      "cow",
      "pig",
      "sheep",
      "chicken",
      "horse",
      "donkey",
      "mule",
      "llama",
      "wolf",
      "cat",
      "ocelot",
      "parrot",
      "rabbit",
      "fox",
      "bee",
      "turtle",
      "dolphin",
      "squid",
      "glow_squid",
      "cod",
      "salmon",
      "tropical_fish",
      "pufferfish",
      "axolotl",
      "goat",
      "frog",
      "tadpole",
      "allay",
      "camel",
      "sniffer",
      "armadillo",
      "villager",
      "wandering_trader",
      "snow_golem",
      "iron_golem",
      "bat",
      "mooshroom",
      "panda",
      "polar_bear",
      "strider",
    ];

    const shortId = this.identifier.replace("minecraft:", "");
    return passiveMobs.includes(shortId);
  }

  /**
   * Checks if this is a player entity.
   */
  get isPlayer(): boolean {
    return this.identifier === "minecraft:player";
  }

  /**
   * Gets a category for this entity (for icon selection).
   */
  get category(): "hostile" | "passive" | "player" | "item" | "other" {
    if (this.isPlayer) return "player";
    if (this.isHostile) return "hostile";
    if (this.isPassive) return "passive";
    if (this.identifier === "minecraft:item") return "item";
    return "other";
  }
}

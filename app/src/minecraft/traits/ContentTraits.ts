// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ContentTraits - Trait System for Content Generation
 *
 * This module defines the trait architecture for the Content Wizard meta-schema.
 * Traits are pre-packaged bundles of Minecraft components, states, and behaviors
 * that can be easily combined to create complex content.
 *
 * ARCHITECTURE:
 * - ITraitData: Base interface for all trait data
 * - IEntityTraitData: Entity-specific (has component groups, events)
 * - IBlockTraitData: Block-specific (has properties, permutations)
 * - IItemTraitData: Item-specific (has events, simpler structure)
 *
 * - ContentTrait: Abstract base class for trait implementations
 * - EntityContentTrait: Generates IEntityTraitData
 * - BlockContentTrait: Generates IBlockTraitData
 * - ItemContentTrait: Generates IItemTraitData
 *
 * Each ContentTrait implementation encapsulates the logic for a specific trait
 * and can accept parameters to customize the generated data.
 */

// ============================================================================
// BASE TRAIT DATA INTERFACES
// ============================================================================

/**
 * Base interface for all trait data.
 * Contains common metadata about a trait.
 */
export interface ITraitData {
  /** Unique identifier for this trait */
  id: string;

  /** Human-readable display name */
  displayName: string;

  /** Description of what this trait provides */
  description: string;

  /** Category for UI grouping */
  category: TraitCategory;

  /** Other traits this requires */
  requires?: string[];

  /** Traits this conflicts with */
  conflicts?: string[];

  /** Base components that are always applied */
  components: Record<string, any>;
}

/**
 * Categories for organizing traits in the UI.
 */
export type TraitCategory =
  | "body_type"
  | "behavior"
  | "combat"
  | "interaction"
  | "special"
  | "movement"
  | "environment"
  | "material"
  | "shape"
  | "tool"
  | "armor"
  | "consumable"
  | "placement"
  | "usable"
  | "basic"
  | "visual"
  | "interactive";

// ============================================================================
// ENTITY TRAIT DATA
// ============================================================================

/**
 * Entity-specific trait data.
 * Entities support component groups (states) and events (transitions).
 */
export interface IEntityTraitData extends ITraitData {
  /**
   * Component groups define different states the entity can be in.
   * Each group is a set of components that are applied together.
   * Example: "wild" vs "tamed" states for a wolf.
   */
  componentGroups?: Record<string, Record<string, any>>;

  /**
   * Events define transitions between states.
   * They can add/remove component groups and trigger other events.
   */
  events?: Record<string, IEntityEvent>;

  /**
   * The spawn event is triggered when the entity first spawns.
   * Use this to set initial state.
   */
  spawnEvent?: IEntityEvent;

  /**
   * Resource-related data (textures, animations, sounds).
   */
  resources?: {
    textures?: Record<string, string>;
    animations?: Record<string, string>;
    sounds?: Record<string, string>;
    particles?: string[];
  };
}

/**
 * Entity event structure.
 */
export interface IEntityEvent {
  /** Add component groups */
  add?: {
    component_groups: string[];
  };

  /** Remove component groups */
  remove?: {
    component_groups: string[];
  };

  /** Trigger another event */
  trigger?: {
    event: string;
    target?: string;
    filters?: any;
  };

  /** Queue a command */
  queue_command?: {
    command: string | string[];
  };

  /** Randomize between options */
  randomize?: Array<{
    weight: number;
    add?: { component_groups: string[] };
    remove?: { component_groups: string[] };
    trigger?: { event: string; target?: string };
  }>;

  /** Sequence of events */
  sequence?: IEntityEvent[];

  /** Set property value */
  set_property?: Record<string, any>;
}

// ============================================================================
// BLOCK TRAIT DATA
// ============================================================================

/**
 * Block-specific trait data.
 * Blocks support properties (states) and permutations (conditional components).
 */
export interface IBlockTraitData extends ITraitData {
  /** Block properties (states) - e.g., { "custom:open": [false, true] } */
  properties?: Record<string, (string | number | boolean)[]>;

  /** Conditional component application based on property values */
  permutations?: IBlockPermutation[];

  /** Block event triggers */
  events?: Record<string, IBlockEvent>;

  /** Geometry files to include in the resource pack (path → geo JSON content) */
  geometryFiles?: { path: string; content: object }[];

  /**
   * Minecraft-native block traits to add to description.traits.
   * These are built-in Minecraft traits like minecraft:placement_position
   * and minecraft:connection that the engine handles automatically.
   * Example: { "minecraft:placement_position": { enabled_states: ["minecraft:vertical_half"] } }
   */
  minecraftTraits?: Record<string, any>;

  /** Tags for categorization (e.g., ["stone", "pickaxe_mineable"]) */
  tags?: string[];

  /** Menu category for creative inventory */
  menuCategory?: {
    category: string;
    group?: string;
  };
}

/**
 * Block permutation - applies components when condition is met.
 */
export interface IBlockPermutation {
  /** Molang condition (e.g., "q.block_property('custom:open') == true") */
  condition: string;

  /** Components to apply when condition is true */
  components: Record<string, any>;
}

/**
 * Block event structure.
 */
export interface IBlockEvent {
  /** Set block property values */
  set_block_property?: Record<string, any>;

  /** Trigger event on another block/entity */
  trigger?: {
    event: string;
    target?: string;
    conditions?: any;
    delay?: number;
  };

  /** Run command */
  run_command?: {
    command: string | string[];
  };

  /** Spawn loot */
  spawn_loot?: {
    table: string;
  };

  /** Sequence of actions */
  sequence?: IBlockEvent[];

  /** Randomized actions */
  randomize?: Array<
    {
      weight: number;
    } & IBlockEvent
  >;
}

// ============================================================================
// ITEM TRAIT DATA
// ============================================================================

/**
 * Item-specific trait data.
 * Items have a simpler event system than entities.
 */
export interface IItemTraitData extends ITraitData {
  /** Item events (on_use, on_consume, etc.) */
  events?: Record<string, IItemEvent>;

  /** Attachable definition for equipped rendering */
  attachable?: IAttachableData;
}

/**
 * Item event structure.
 */
export interface IItemEvent {
  /** Run command on use */
  run_command?: {
    command: string | string[];
    target?: string;
  };

  /** Trigger entity event */
  trigger?: {
    event: string;
    target?: string;
  };

  /** Damage item */
  damage?: {
    type: string;
    amount: number;
  };

  /** Decrement stack */
  decrement_stack?: {};

  /** Swing animation */
  swing?: boolean;

  /** Shoot projectile */
  shoot?: {
    projectile: string;
    launch_power?: number;
  };

  /** Sequence of events */
  sequence?: IItemEvent[];
}

/**
 * Attachable definition for items that render when equipped.
 */
export interface IAttachableData {
  /** Materials for rendering */
  materials?: Record<string, string>;

  /** Texture references */
  textures?: Record<string, string>;

  /** Geometry reference */
  geometry?: Record<string, string>;

  /** Animation references */
  animations?: Record<string, string>;

  /** Render controllers */
  renderControllers?: string[];

  /** Scripts for attachable */
  scripts?: {
    animate?: string[];
  };
}

// ============================================================================
// CONTENT TRAIT BASE CLASSES
// ============================================================================

/**
 * Configuration options that can be passed to traits.
 */
export interface ITraitConfig {
  [key: string]: any;
}

/**
 * Abstract base class for entity content traits.
 */
export abstract class EntityContentTrait {
  /** Unique identifier for this trait */
  abstract get id(): string;

  /**
   * Generate the trait data with optional configuration.
   * @param config - Optional parameters to customize the trait
   */
  abstract getData(config?: ITraitConfig): IEntityTraitData;
}

/**
 * Abstract base class for block content traits.
 */
export abstract class BlockContentTrait {
  /** Unique identifier for this trait */
  abstract get id(): string;

  /**
   * Generate the trait data with optional configuration.
   * @param config - Optional parameters to customize the trait
   */
  abstract getData(config?: ITraitConfig): IBlockTraitData;
}

/**
 * Abstract base class for item content traits.
 */
export abstract class ItemContentTrait {
  /** Unique identifier for this trait */
  abstract get id(): string;

  /**
   * Generate the trait data with optional configuration.
   * @param config - Optional parameters to customize the trait
   */
  abstract getData(config?: ITraitConfig): IItemTraitData;
}

// ============================================================================
// TRAIT REGISTRY
// ============================================================================

/**
 * Registry for all trait implementations.
 * Allows lookup by trait ID.
 */
export class TraitRegistry {
  private static entityTraits: Map<string, EntityContentTrait> = new Map();
  private static blockTraits: Map<string, BlockContentTrait> = new Map();
  private static itemTraits: Map<string, ItemContentTrait> = new Map();

  static registerEntityTrait(trait: EntityContentTrait): void {
    this.entityTraits.set(trait.id, trait);
  }

  static registerBlockTrait(trait: BlockContentTrait): void {
    this.blockTraits.set(trait.id, trait);
  }

  static registerItemTrait(trait: ItemContentTrait): void {
    this.itemTraits.set(trait.id, trait);
  }

  static getEntityTrait(id: string): EntityContentTrait | undefined {
    return this.entityTraits.get(id);
  }

  static getBlockTrait(id: string): BlockContentTrait | undefined {
    return this.blockTraits.get(id);
  }

  static getItemTrait(id: string): ItemContentTrait | undefined {
    return this.itemTraits.get(id);
  }

  static getAllEntityTraits(): EntityContentTrait[] {
    return Array.from(this.entityTraits.values());
  }

  static getAllBlockTraits(): BlockContentTrait[] {
    return Array.from(this.blockTraits.values());
  }

  static getAllItemTraits(): ItemContentTrait[] {
    return Array.from(this.itemTraits.values());
  }

  static getEntityTraitsByCategory(category: TraitCategory): EntityContentTrait[] {
    return this.getAllEntityTraits().filter((t) => t.getData().category === category);
  }

  static getBlockTraitsByCategory(category: TraitCategory): BlockContentTrait[] {
    return this.getAllBlockTraits().filter((t) => t.getData().category === category);
  }

  static getItemTraitsByCategory(category: TraitCategory): ItemContentTrait[] {
    return this.getAllItemTraits().filter((t) => t.getData().category === category);
  }
}

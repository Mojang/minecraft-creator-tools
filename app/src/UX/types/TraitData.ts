// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * TraitData — Shared trait definitions for use in the Content Wizard and Entity Editor.
 *
 * Contains the ITraitInfo interface, all trait arrays (entity, block, item),
 * exclusive group metadata, and category color mappings. Extracted so the
 * same data drives both the wizard creation flow and the editor trait picker.
 */

import React from "react";
import { EntityTraitId } from "../../minecraft/IContentMetaSchema";
import IProjectTheme from "./IProjectTheme";

// ============================================================================
// TRAIT INFO INTERFACE
// ============================================================================

export interface ITraitInfo {
  id: string;
  label: string;
  description: string;
  category: string;
  exclusiveGroup?: string;
  /** Icon accent color (CSS color string). Applied to the SVG icon. */
  iconColor?: string;
}

// ============================================================================
// CATEGORY COLORS
// ============================================================================

/**
 * Category icon colors — Minecraft-inspired palette.
 * Body shape = blue, movement = cyan, temperament = orange-red,
 * combat = red, interaction = green, special = purple, movement = teal.
 */
export const TRAIT_CATEGORY_COLORS: Record<string, string> = {
  "Body Type": "#5b9bd5",
  Behavior: "#e07040",
  Combat: "#d64545",
  Interaction: "#52a535",
  Special: "#a855f7",
  Movement: "#3dbda5",
  // Block categories
  Basic: "#8b8b8b",
  Shape: "#c0842a",
  Interactive: "#52a535",
  Properties: "#5b9bd5",
  Redstone: "#d64545",
  // Item categories
  Weapon: "#d64545",
  Tool: "#c0842a",
  Consumable: "#d68f4a",
  Armor: "#5b9bd5",
  Other: "#8b8b8b",
};

/** Resolve icon color for a trait: explicit override > category color > default */
export function getTraitIconColor(trait: ITraitInfo): string {
  return trait.iconColor || TRAIT_CATEGORY_COLORS[trait.category] || "#aaaaaa";
}

// ============================================================================
// ENTITY TRAITS
// ============================================================================

export const ENTITY_TRAITS: ITraitInfo[] = [
  {
    id: "humanoid",
    label: "Two-legged",
    description: "Bipedal model with walk/attack animations",
    category: "Body Type",
    exclusiveGroup: "bodyShape",
  },
  {
    id: "quadruped",
    label: "Four-legged",
    description: "Quadruped model with animal animations",
    category: "Body Type",
    exclusiveGroup: "bodyShape",
  },
  {
    id: "flying",
    label: "Flying",
    description: "Can fly through the air",
    category: "Body Type",
    exclusiveGroup: "movement",
  },
  { id: "aquatic", label: "Aquatic", description: "Lives in water", category: "Body Type", exclusiveGroup: "movement" },
  {
    id: "hostile",
    label: "Hostile",
    description: "Attacks players on sight",
    category: "Behavior",
    exclusiveGroup: "temperament",
  },
  {
    id: "passive",
    label: "Passive",
    description: "Flees when attacked",
    category: "Behavior",
    exclusiveGroup: "temperament",
  },
  {
    id: "neutral",
    label: "Neutral",
    description: "Only attacks when provoked",
    category: "Behavior",
    exclusiveGroup: "temperament",
  },
  { id: "melee_attacker", label: "Melee Attacker", description: "Attacks with melee", category: "Combat" },
  { id: "ranged_attacker", label: "Ranged Attacker", description: "Attacks from distance", category: "Combat" },
  { id: "exploder", label: "Exploder", description: "Explodes near target", category: "Combat" },
  { id: "tameable", label: "Tameable", description: "Can be tamed by players", category: "Interaction" },
  { id: "rideable", label: "Rideable", description: "Can be ridden", category: "Interaction" },
  { id: "breedable", label: "Breedable", description: "Can breed with same type", category: "Interaction" },
  { id: "undead", label: "Undead", description: "Burns in daylight, undead type", category: "Special" },
  { id: "wanders", label: "Wanders", description: "Walks around randomly", category: "Movement" },
  { id: "teleporter", label: "Teleporter", description: "Can teleport", category: "Special" },
];

/**
 * Display names for exclusive groups shown as section headers.
 */
export const EXCLUSIVE_GROUP_LABELS: Record<string, string> = {
  bodyShape: "Body Shape (pick one)",
  movement: "Movement (pick one)",
  temperament: "Temperament (pick one)",
};

/** Icon for exclusive group headers */
export const EXCLUSIVE_GROUP_ICONS: Record<string, string> = {
  bodyShape: "\u2726", // four-pointed star
  movement: "\u279C", // arrow
  temperament: "\u2661", // heart
};

/** Ordered list of exclusive groups for rendering */
export const EXCLUSIVE_GROUPS = ["bodyShape", "movement", "temperament"];

// ============================================================================
// BLOCK TRAITS
// ============================================================================

export const BLOCK_TRAITS: ITraitInfo[] = [
  { id: "solid", label: "Solid", description: "Standard solid block", category: "Basic", exclusiveGroup: "shape" },
  {
    id: "transparent",
    label: "Transparent",
    description: "See-through block",
    category: "Basic",
    exclusiveGroup: "shape",
  },
  { id: "slab", label: "Slab", description: "Half-height block", category: "Shape", exclusiveGroup: "shape" },
  { id: "stairs", label: "Stairs", description: "Stair-shaped block", category: "Shape", exclusiveGroup: "shape" },
  { id: "fence", label: "Fence", description: "Fence post shape", category: "Shape", exclusiveGroup: "shape" },
  { id: "door", label: "Door", description: "Openable door", category: "Interactive", exclusiveGroup: "shape" },
  { id: "light_source", label: "Light Source", description: "Emits light", category: "Properties" },
  { id: "gravity", label: "Gravity", description: "Falls like sand", category: "Properties" },
  { id: "redstone_signal", label: "Redstone Signal", description: "Outputs redstone", category: "Redstone" },
  { id: "flammable", label: "Flammable", description: "Can catch fire and burn", category: "Properties" },
  {
    id: "explosion_resistant",
    label: "Explosion Resistant",
    description: "Highly resistant to explosions",
    category: "Properties",
  },
  { id: "slippery", label: "Slippery", description: "Low-friction surface", category: "Properties" },
];

// ============================================================================
// ITEM TRAITS
// ============================================================================

export const ITEM_TRAITS: ITraitInfo[] = [
  { id: "sword", label: "Sword", description: "Melee weapon", category: "Weapon", exclusiveGroup: "type" },
  { id: "pickaxe", label: "Pickaxe", description: "Mining tool for stone", category: "Tool", exclusiveGroup: "type" },
  { id: "axe", label: "Axe", description: "Chopping tool for wood", category: "Tool", exclusiveGroup: "type" },
  { id: "shovel", label: "Shovel", description: "Digging tool", category: "Tool", exclusiveGroup: "type" },
  { id: "armor_helmet", label: "Helmet", description: "Head armor", category: "Armor", exclusiveGroup: "type" },
  {
    id: "armor_chestplate",
    label: "Chestplate",
    description: "Chest armor",
    category: "Armor",
    exclusiveGroup: "type",
  },
  { id: "armor_leggings", label: "Leggings", description: "Leg armor", category: "Armor", exclusiveGroup: "type" },
  { id: "armor_boots", label: "Boots", description: "Foot armor", category: "Armor", exclusiveGroup: "type" },
  { id: "food", label: "Food", description: "Edible item", category: "Consumable" },
  { id: "throwable", label: "Throwable", description: "Can be thrown", category: "Special" },
  {
    id: "custom",
    label: "Custom Item",
    description: "Start with a blank item and customize everything yourself",
    category: "Other",
    exclusiveGroup: "type",
  },
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Groups traits into exclusive-group sections (in order) plus an ungrouped section.
 * Used by both the Content Wizard and Entity Trait Picker.
 */
export function groupEntityTraits(): { group: string | null; traits: ITraitInfo[] }[] {
  const grouped: { group: string | null; traits: ITraitInfo[] }[] = [];

  for (const group of EXCLUSIVE_GROUPS) {
    const groupTraits = ENTITY_TRAITS.filter((t) => t.exclusiveGroup === group);
    if (groupTraits.length > 0) {
      grouped.push({ group, traits: groupTraits });
    }
  }

  const ungroupedTraits = ENTITY_TRAITS.filter((t) => !t.exclusiveGroup);
  if (ungroupedTraits.length > 0) {
    grouped.push({ group: null, traits: ungroupedTraits });
  }

  return grouped;
}

/**
 * Applies exclusive-group rules when toggling a trait.
 * Returns the new trait list after toggling traitId on or off.
 */
export function toggleEntityTrait(currentTraits: EntityTraitId[], traitId: EntityTraitId): EntityTraitId[] {
  const traits = [...currentTraits];
  const idx = traits.indexOf(traitId);

  if (idx >= 0) {
    // Deselect
    traits.splice(idx, 1);
  } else {
    // If this trait belongs to an exclusive group, remove others in the same group
    const traitInfo = ENTITY_TRAITS.find((t) => t.id === traitId);
    if (traitInfo?.exclusiveGroup) {
      const groupMembers = ENTITY_TRAITS.filter(
        (t) => t.exclusiveGroup === traitInfo.exclusiveGroup && t.id !== traitId
      ).map((t) => t.id as EntityTraitId);
      for (const memberId of groupMembers) {
        const memberIdx = traits.indexOf(memberId);
        if (memberIdx >= 0) {
          traits.splice(memberIdx, 1);
        }
      }
    }
    traits.push(traitId);
  }

  return traits;
}

// ============================================================================
// TRAIT CARD THEME STYLES
// ============================================================================

/** Brighten or darken a hex color by a signed offset per channel. */
function adjustHex(hex: string, offset: number): string {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + offset));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + offset));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + offset));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Build CSS custom-property style object for the trait card grid container.
 * Sets --trait-bg, --trait-border, --trait-shadow, --trait-highlight, --trait-fg
 * and hover variants derived from the theme's Minecraft button bevel palette.
 */
export function getTraitCardThemeStyle(theme: IProjectTheme): React.CSSProperties {
  return {
    "--trait-bg": theme.mc4,
    "--trait-border": theme.mc0,
    "--trait-shadow": theme.mc1,
    "--trait-highlight": theme.mc5,
    "--trait-fg": theme.mcc1,
    "--trait-hover-bg": adjustHex(theme.mc4, 11),
    "--trait-hover-shadow": adjustHex(theme.mc1, 9),
    "--trait-hover-highlight": adjustHex(theme.mc5, 10),
  } as React.CSSProperties;
}

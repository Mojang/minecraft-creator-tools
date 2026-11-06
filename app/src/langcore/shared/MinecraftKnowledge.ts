// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MinecraftKnowledge - Shared Minecraft domain knowledge for language features
 *
 * This module provides reference data and knowledge about Minecraft for
 * features like inlay hints (comparisons), hover info, and completions.
 */

import { getBedrockKnowledge, onDidChangeBedrockKnowledge } from "../../knowledge/BedrockKnowledge";

/**
 * Known reference values for health comparisons
 */
export const HEALTH_REFERENCES: { [value: number]: string } = {
  1: "1 HP (0.5❤)",
  2: "1❤",
  4: "2❤",
  6: "3❤ (Chicken)",
  10: "5❤ (Chicken, Fish)",
  12: "6❤ (Ocelot)",
  14: "7❤ (Wolf)",
  16: "8❤ (Pig)",
  20: "10❤ (Player, Cow)",
  24: "12❤ (Donkey)",
  26: "13❤ (Llama)",
  30: "15❤ (Horse max)",
  40: "20❤ (Ravager)",
  50: "25❤ (Iron Golem)",
  100: "50❤ (Ender Dragon)",
  200: "100❤ (Wither)",
  300: "150❤ (Warden)",
  500: "250❤ (Warden max)",
};

/**
 * Known reference values for speed comparisons
 */
export const SPEED_REFERENCES: { [value: number]: string } = {
  0.1: "Turtle speed",
  0.15: "Slow (Zombie baby)",
  0.2: "Zombie speed",
  0.23: "Skeleton speed",
  0.25: "Player speed",
  0.3: "Spider speed",
  0.35: "Wolf speed",
  0.4: "Fast speed",
  0.43: "Horse speed",
  0.5: "Very fast",
  0.6: "Extremely fast",
};

/**
 * Known reference values for damage comparisons
 */
export const DAMAGE_REFERENCES: { [value: number]: string } = {
  1: "0.5❤ (Zombie Easy)",
  2: "1❤ (Zombie Easy)",
  3: "1.5❤ (Zombie Normal)",
  4: "2❤ (Zombie Hard)",
  5: "2.5❤",
  6: "3❤ (Iron Golem)",
  7: "3.5❤ (Diamond sword)",
  8: "4❤",
  10: "5❤ (Warden ranged)",
  15: "7.5❤",
  16: "8❤",
  30: "15❤ (Warden melee)",
};

/**
 * Known tick-to-time conversions
 */
export const TICK_CONVERSIONS = {
  ticksPerSecond: 20,
  ticksPerMinute: 1200,
  ticksPerHour: 72000,
  ticksPerDay: 24000, // Minecraft day cycle
};

/**
 * Convert ticks to a human-readable time string
 */
export function formatTicksAsTime(ticks: number): string {
  if (ticks < TICK_CONVERSIONS.ticksPerSecond) {
    return `${ticks} ticks`;
  }

  const seconds = ticks / TICK_CONVERSIONS.ticksPerSecond;

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get a comparison reference for a health value
 */
export function getHealthComparison(value: number): string | null {
  if (HEALTH_REFERENCES[value]) {
    return HEALTH_REFERENCES[value];
  }

  // Find closest reference
  const keys = Object.keys(HEALTH_REFERENCES).map(Number);
  const closest = keys.reduce((prev, curr) => (Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev));

  if (Math.abs(closest - value) <= 2) {
    return `~${HEALTH_REFERENCES[closest]}`;
  }

  return null;
}

/**
 * Get a comparison reference for a speed value
 */
export function getSpeedComparison(value: number): string | null {
  if (SPEED_REFERENCES[value]) {
    return SPEED_REFERENCES[value];
  }

  const keys = Object.keys(SPEED_REFERENCES).map(Number);
  for (const key of keys) {
    if (Math.abs(key - value) < 0.02) {
      return `~${SPEED_REFERENCES[key]}`;
    }
  }

  return null;
}

/**
 * Get a comparison reference for a damage value
 */
export function getDamageComparison(value: number): string | null {
  if (DAMAGE_REFERENCES[value]) {
    return DAMAGE_REFERENCES[value];
  }

  return null;
}

/**
 * Vanilla identifiers from engine metadata for the active Bedrock channel.
 * The array instances are stable; their contents are refreshed in place when the knowledge changes.
 */
export const VANILLA_ENTITIES: string[] = [...getBedrockKnowledge().vanilla.entities];
export const VANILLA_ITEMS: string[] = [...getBedrockKnowledge().vanilla.items];
export const VANILLA_BLOCKS: string[] = getBedrockKnowledge().vanilla.blocks.map((b) => b.name);

onDidChangeBedrockKnowledge((knowledge) => {
  VANILLA_ENTITIES.splice(0, VANILLA_ENTITIES.length, ...knowledge.vanilla.entities);
  VANILLA_ITEMS.splice(0, VANILLA_ITEMS.length, ...knowledge.vanilla.items);
  VANILLA_BLOCKS.splice(0, VANILLA_BLOCKS.length, ...knowledge.vanilla.blocks.map((b) => b.name));
});

// Note: MOLANG_QUERIES, MOLANG_MATH, IScriptModuleInfo, and SCRIPT_MODULES are exported
// from their respective modules (molang/MolangParser.ts and javascript/ScriptModuleInfo.ts).
// Import from those modules for the canonical definitions.

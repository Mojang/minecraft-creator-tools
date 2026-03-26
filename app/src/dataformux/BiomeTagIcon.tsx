// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* ═══════════════════════════════════════════════════════════════════════════
   BIOME TAG ICON - Minecraft-Inspired Pixel Art Icons for Biome Tags
   
   Provides unique pixel-art style SVG icons for each biome tag in the
   SimplifiedBiomeFilterEditor. Icons are designed to be recognizable
   representations of each Minecraft biome or biome characteristic.
   
   ═══════════════════════════════════════════════════════════════════════════ */

import React from "react";

export interface IBiomeTagIconProps {
  tagId: string;
  size?: number;
  className?: string;
}

// Color palette for biome icons - Minecraft-inspired colors
const COLORS = {
  // Grass & vegetation
  grass: "#5d9b47",
  grassDark: "#4a7a38",
  leaves: "#4d8c3d",
  leavesDark: "#3a6b2e",

  // Wood & trees
  oakWood: "#6b5839",
  birchWood: "#d5c9a3",
  spruceWood: "#4a3a2a",
  jungleWood: "#6b5328",
  acaciaWood: "#6b4028",
  darkOakWood: "#3a2810",

  // Ground
  dirt: "#8b6b4a",
  sand: "#d9c88a",
  gravel: "#8a8a8a",
  stone: "#7a7a7a",
  terracotta: "#b45a3a",

  // Water & ice
  water: "#3a6dbf",
  waterDeep: "#2a4d8f",
  ice: "#9ac8e8",
  iceDark: "#7ab0d0",
  snow: "#f0f0f0",
  snowDark: "#d8d8d8",

  // Nether
  netherrack: "#6b2a2a",
  netherBrick: "#4a2020",
  soulSand: "#4a3a2a",
  soulFire: "#4ac8c8",
  crimson: "#7a2a3a",
  warped: "#2a6a6a",
  basalt: "#4a4a4a",

  // End
  endStone: "#c8c8a0",
  obsidian: "#1a1020",

  // Special
  mushroom: "#c87878",
  mycelium: "#8a6878",
  flower: "#e85878",
  flowerYellow: "#e8d858",
  glow: "#a8e858",
  sculk: "#0a3040",
  sculkGlow: "#18c8c8",

  // Weather/temp
  sun: "#f8d858",
  sunOrange: "#e8a838",
  cloud: "#e8e8e8",

  // Misc
  rare: "#58c8e8",
  portal: "#9858c8",
};

/**
 * Get icon for a specific biome tag
 */
function getTagIcon(tagId: string, size: number): JSX.Element {
  const s = size; // shorthand
  const p = size / 16; // pixel unit (for 16x16 grid)

  switch (tagId.toLowerCase()) {
    // ═══════════════════════════════════════════════════════════════════
    // DIMENSIONS
    // ═══════════════════════════════════════════════════════════════════

    case "overworld":
      // Grass block with dirt
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="6" width="12" height="8" fill={COLORS.dirt} />
          <rect x="2" y="2" width="12" height="5" fill={COLORS.grass} />
          <rect x="2" y="2" width="12" height="1" fill={COLORS.grassDark} />
          <rect x="4" y="3" width="2" height="1" fill="#6dab57" />
          <rect x="9" y="4" width="3" height="1" fill="#6dab57" />
          <rect x="4" y="8" width="2" height="2" fill="#9b7b5a" />
          <rect x="9" y="10" width="2" height="2" fill="#7b5b3a" />
        </svg>
      );

    case "nether":
      // Nether portal
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="3" y="2" width="10" height="12" fill={COLORS.obsidian} />
          <rect x="5" y="4" width="6" height="8" fill={COLORS.portal} opacity="0.8" />
          <rect x="6" y="5" width="4" height="6" fill={COLORS.portal} />
          <rect x="7" y="6" width="2" height="4" fill="#b878d8" />
          <rect x="5" y="6" width="1" height="2" fill="#b878d8" opacity="0.5" />
          <rect x="10" y="8" width="1" height="2" fill="#b878d8" opacity="0.5" />
        </svg>
      );

    case "the_end":
      // End stone with void
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" fill="#0a0010" />
          <rect x="3" y="8" width="10" height="5" fill={COLORS.endStone} />
          <rect x="4" y="9" width="2" height="2" fill="#b8b890" />
          <rect x="8" y="10" width="3" height="2" fill="#d8d8b0" />
          {/* Stars */}
          <rect x="5" y="3" width="1" height="1" fill="#ffffff" />
          <rect x="10" y="4" width="1" height="1" fill="#e0e0e0" />
          <rect x="7" y="5" width="1" height="1" fill="#ffffff" />
          <rect x="12" y="3" width="1" height="1" fill="#d0d0d0" />
        </svg>
      );

    // ═══════════════════════════════════════════════════════════════════
    // TEMPERATURE
    // ═══════════════════════════════════════════════════════════════════

    case "cold":
      // Snowflake
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="7" y="2" width="2" height="12" fill={COLORS.ice} />
          <rect x="2" y="7" width="12" height="2" fill={COLORS.ice} />
          <rect x="4" y="4" width="2" height="2" fill={COLORS.ice} />
          <rect x="10" y="4" width="2" height="2" fill={COLORS.ice} />
          <rect x="4" y="10" width="2" height="2" fill={COLORS.ice} />
          <rect x="10" y="10" width="2" height="2" fill={COLORS.ice} />
          <rect x="7" y="7" width="2" height="2" fill="#ffffff" />
          <rect x="3" y="7" width="1" height="2" fill={COLORS.iceDark} />
          <rect x="12" y="7" width="1" height="2" fill={COLORS.iceDark} />
        </svg>
      );

    case "frozen":
      // Ice block
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" fill={COLORS.ice} />
          <rect x="2" y="2" width="12" height="2" fill={COLORS.iceDark} />
          <rect x="3" y="4" width="4" height="3" fill="#b8d8f0" />
          <rect x="9" y="6" width="3" height="4" fill="#b8d8f0" />
          <rect x="4" y="9" width="3" height="3" fill="#a0c8e0" />
          <rect x="4" y="5" width="2" height="1" fill="#ffffff" opacity="0.6" />
          <rect x="10" y="7" width="1" height="2" fill="#ffffff" opacity="0.4" />
        </svg>
      );

    case "lukewarm":
      // Partly cloudy
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="9" y="2" width="5" height="5" fill={COLORS.sun} />
          <rect x="10" y="3" width="3" height="3" fill={COLORS.sunOrange} />
          <rect x="11" y="4" width="1" height="1" fill="#ffffff" opacity="0.4" />
          <rect x="3" y="6" width="8" height="4" fill={COLORS.cloud} />
          <rect x="2" y="7" width="10" height="3" fill={COLORS.cloud} />
          <rect x="5" y="5" width="4" height="2" fill={COLORS.cloud} />
          <rect x="4" y="7" width="2" height="1" fill="#d0d0d0" />
        </svg>
      );

    case "warm":
      // Sun
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="5" y="5" width="6" height="6" fill={COLORS.sun} />
          <rect x="6" y="6" width="4" height="4" fill={COLORS.sunOrange} />
          <rect x="7" y="2" width="2" height="2" fill={COLORS.sun} />
          <rect x="7" y="12" width="2" height="2" fill={COLORS.sun} />
          <rect x="2" y="7" width="2" height="2" fill={COLORS.sun} />
          <rect x="12" y="7" width="2" height="2" fill={COLORS.sun} />
          <rect x="3" y="3" width="2" height="2" fill={COLORS.sun} opacity="0.7" />
          <rect x="11" y="3" width="2" height="2" fill={COLORS.sun} opacity="0.7" />
          <rect x="3" y="11" width="2" height="2" fill={COLORS.sun} opacity="0.7" />
          <rect x="11" y="11" width="2" height="2" fill={COLORS.sun} opacity="0.7" />
          <rect x="7" y="7" width="2" height="2" fill="#ffffff" opacity="0.4" />
        </svg>
      );

    case "temperate":
      // Balanced leaf/sun
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="10" y="2" width="4" height="4" fill={COLORS.sun} opacity="0.7" />
          <rect x="11" y="3" width="2" height="2" fill={COLORS.sunOrange} opacity="0.7" />
          <rect x="4" y="5" width="6" height="6" fill={COLORS.leaves} />
          <rect x="3" y="6" width="8" height="4" fill={COLORS.leaves} />
          <rect x="5" y="4" width="4" height="2" fill={COLORS.leavesDark} />
          <rect x="6" y="7" width="2" height="2" fill="#5d9c4d" />
          <rect x="7" y="11" width="2" height="3" fill={COLORS.oakWood} />
        </svg>
      );

    // ═══════════════════════════════════════════════════════════════════
    // BIOME TYPES
    // ═══════════════════════════════════════════════════════════════════

    case "forest":
      // Oak tree
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="7" y="9" width="2" height="5" fill={COLORS.oakWood} />
          <rect x="4" y="3" width="8" height="6" fill={COLORS.leaves} />
          <rect x="3" y="4" width="10" height="4" fill={COLORS.leaves} />
          <rect x="5" y="2" width="6" height="2" fill={COLORS.leavesDark} />
          <rect x="5" y="5" width="2" height="2" fill="#5d9c4d" />
          <rect x="9" y="4" width="2" height="3" fill="#4d8c3d" />
        </svg>
      );

    case "plains":
      // Grass with flowers
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="10" width="12" height="4" fill={COLORS.grass} />
          <rect x="2" y="10" width="12" height="1" fill={COLORS.grassDark} />
          <rect x="3" y="7" width="1" height="3" fill={COLORS.grass} />
          <rect x="6" y="8" width="1" height="2" fill={COLORS.grass} />
          <rect x="10" y="6" width="1" height="4" fill={COLORS.grass} />
          <rect x="13" y="7" width="1" height="3" fill={COLORS.grass} />
          <rect x="5" y="6" width="2" height="2" fill={COLORS.flower} />
          <rect x="11" y="4" width="2" height="2" fill={COLORS.flowerYellow} />
        </svg>
      );

    case "desert":
      // Cactus on sand
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="11" width="12" height="3" fill={COLORS.sand} />
          <rect x="7" y="4" width="2" height="7" fill="#4a8a4a" />
          <rect x="5" y="6" width="2" height="2" fill="#4a8a4a" />
          <rect x="5" y="6" width="1" height="3" fill="#4a8a4a" />
          <rect x="9" y="8" width="2" height="2" fill="#4a8a4a" />
          <rect x="10" y="7" width="1" height="3" fill="#4a8a4a" />
          <rect x="7" y="4" width="1" height="1" fill="#5a9a5a" />
          <rect x="4" y="12" width="2" height="1" fill="#c9b87a" />
          <rect x="10" y="11" width="3" height="1" fill="#e9d89a" />
        </svg>
      );

    case "jungle":
      // Jungle tree with vines
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="6" y="6" width="4" height="8" fill={COLORS.jungleWood} />
          <rect x="3" y="2" width="10" height="6" fill="#3d7c2d" />
          <rect x="2" y="3" width="12" height="4" fill="#3d7c2d" />
          <rect x="4" y="1" width="8" height="2" fill="#2d6c1d" />
          <rect x="2" y="7" width="1" height="4" fill="#4d9c3d" />
          <rect x="13" y="6" width="1" height="5" fill="#4d9c3d" />
          <rect x="3" y="9" width="1" height="3" fill="#3d8c2d" />
          <rect x="5" y="4" width="2" height="2" fill="#4d8c3d" />
        </svg>
      );

    case "taiga":
      // Spruce tree
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="7" y="11" width="2" height="3" fill={COLORS.spruceWood} />
          <rect x="7" y="2" width="2" height="2" fill="#2a5a3a" />
          <rect x="5" y="4" width="6" height="2" fill="#2a5a3a" />
          <rect x="4" y="6" width="8" height="2" fill="#2d6d3d" />
          <rect x="3" y="8" width="10" height="3" fill="#3a7a4a" />
          <rect x="6" y="3" width="1" height="1" fill="#3a6a4a" />
          <rect x="9" y="3" width="1" height="1" fill="#3a6a4a" />
          <rect x="5" y="5" width="1" height="1" fill="#1a4a2a" />
          <rect x="4" y="7" width="1" height="1" fill="#1a4a2a" />
        </svg>
      );

    case "savanna":
      // Acacia tree
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="7" y="7" width="2" height="7" fill={COLORS.acaciaWood} />
          <rect x="9" y="6" width="2" height="1" fill={COLORS.acaciaWood} />
          <rect x="5" y="5" width="2" height="1" fill={COLORS.acaciaWood} />
          <rect x="2" y="2" width="6" height="3" fill="#6d9d4d" />
          <rect x="9" y="3" width="5" height="3" fill="#6d9d4d" />
          <rect x="3" y="3" width="2" height="1" fill="#5d8d3d" />
          <rect x="10" y="4" width="2" height="1" fill="#5d8d3d" />
          <rect x="2" y="11" width="12" height="3" fill="#b8a870" />
        </svg>
      );

    case "swamp":
      // Lily pad on murky water
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="8" width="12" height="6" fill="#3a5a4a" />
          <rect x="2" y="8" width="12" height="2" fill="#4a6a5a" />
          <rect x="5" y="6" width="6" height="4" fill="#4d7d3d" />
          <rect x="4" y="7" width="8" height="2" fill="#4d7d3d" />
          <rect x="7" y="7" width="2" height="1" fill="#5d8d4d" />
          <rect x="12" y="4" width="2" height="6" fill="#5a4a3a" />
          <rect x="11" y="3" width="4" height="2" fill="#4d6d3d" />
          <rect x="3" y="10" width="2" height="1" fill="#5a7a6a" />
        </svg>
      );

    case "mangrove_swamp":
      // Mangrove roots
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="10" width="12" height="4" fill="#4a6a5a" />
          <rect x="6" y="2" width="4" height="6" fill="#6d4d3d" />
          <rect x="5" y="1" width="6" height="3" fill="#5d8d4d" />
          <rect x="3" y="6" width="2" height="6" fill="#6d4d3d" />
          <rect x="11" y="5" width="2" height="7" fill="#6d4d3d" />
          <rect x="4" y="8" width="1" height="4" fill="#5d3d2d" />
          <rect x="8" y="7" width="1" height="5" fill="#5d3d2d" />
          <rect x="12" y="7" width="1" height="5" fill="#5d3d2d" />
          <rect x="3" y="11" width="3" height="1" fill="#5a8a6a" />
        </svg>
      );

    case "mountain":
      // Mountain peak
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="6" y="2" width="4" height="3" fill={COLORS.snow} />
          <rect x="7" y="1" width="2" height="1" fill={COLORS.snowDark} />
          <rect x="4" y="5" width="8" height="3" fill={COLORS.stone} />
          <rect x="2" y="8" width="12" height="6" fill={COLORS.stone} />
          <rect x="5" y="5" width="2" height="2" fill="#8a8a8a" />
          <rect x="9" y="6" width="2" height="2" fill="#6a6a6a" />
          <rect x="3" y="10" width="3" height="2" fill="#6a6a6a" />
          <rect x="10" y="9" width="2" height="3" fill="#8a8a8a" />
        </svg>
      );

    case "extreme_hills":
      // Jagged peaks
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="10" width="12" height="4" fill={COLORS.stone} />
          <rect x="2" y="7" width="4" height="4" fill={COLORS.stone} />
          <rect x="3" y="5" width="2" height="3" fill={COLORS.stone} />
          <rect x="3" y="4" width="1" height="1" fill={COLORS.snow} />
          <rect x="8" y="5" width="5" height="6" fill={COLORS.stone} />
          <rect x="9" y="3" width="3" height="3" fill={COLORS.stone} />
          <rect x="10" y="1" width="1" height="2" fill={COLORS.snow} />
          <rect x="9" y="2" width="3" height="1" fill={COLORS.snowDark} />
          <rect x="6" y="8" width="2" height="6" fill={COLORS.gravel} />
        </svg>
      );

    case "mesa":
      // Terracotta layers
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="3" fill="#c47a4a" />
          <rect x="2" y="5" width="12" height="2" fill="#d4a47a" />
          <rect x="2" y="7" width="12" height="2" fill="#b45a3a" />
          <rect x="2" y="9" width="12" height="2" fill="#e4b48a" />
          <rect x="2" y="11" width="12" height="3" fill="#a44a2a" />
          <rect x="4" y="3" width="3" height="1" fill="#d48a5a" />
          <rect x="9" y="8" width="2" height="1" fill="#c46a4a" />
          <rect x="3" y="12" width="2" height="1" fill="#b45a3a" />
        </svg>
      );

    case "mushroom_island":
      // Giant mushroom
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="7" y="8" width="2" height="6" fill="#c8c8b8" />
          <rect x="3" y="3" width="10" height="5" fill={COLORS.mushroom} />
          <rect x="4" y="2" width="8" height="2" fill={COLORS.mushroom} />
          <rect x="5" y="4" width="2" height="2" fill="#d89898" />
          <rect x="9" y="3" width="2" height="2" fill="#d89898" />
          <rect x="6" y="6" width="3" height="1" fill="#b86868" />
          <rect x="2" y="12" width="12" height="2" fill={COLORS.mycelium} />
        </svg>
      );

    case "beach":
      // Sand meeting water
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="8" width="12" height="6" fill={COLORS.sand} />
          <rect x="2" y="2" width="12" height="6" fill={COLORS.water} />
          <rect x="2" y="7" width="12" height="2" fill="#5a9dcf" />
          <rect x="3" y="8" width="3" height="1" fill="#e9d89a" />
          <rect x="8" y="8" width="4" height="1" fill="#f9e8aa" />
          <rect x="5" y="10" width="2" height="2" fill="#c9b87a" />
          <rect x="10" y="11" width="3" height="2" fill="#d9c88a" />
          <rect x="4" y="4" width="2" height="1" fill="#4a8dbf" />
        </svg>
      );

    case "ocean":
      // Ocean waves
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" fill={COLORS.water} />
          <rect x="2" y="4" width="4" height="2" fill="#4a8dcf" />
          <rect x="8" y="6" width="5" height="2" fill="#4a8dcf" />
          <rect x="3" y="9" width="6" height="2" fill="#4a8dcf" />
          <rect x="10" y="11" width="3" height="2" fill="#4a8dcf" />
          <rect x="3" y="4" width="2" height="1" fill="#6aadef" />
          <rect x="9" y="6" width="2" height="1" fill="#6aadef" />
          <rect x="4" y="9" width="3" height="1" fill="#6aadef" />
        </svg>
      );

    case "deep":
      // Deep ocean
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" fill={COLORS.waterDeep} />
          <rect x="2" y="3" width="12" height="2" fill="#3a5d9f" />
          <rect x="3" y="6" width="4" height="2" fill="#2a4d8f" />
          <rect x="9" y="8" width="4" height="2" fill="#2a4d8f" />
          <rect x="4" y="11" width="5" height="2" fill="#1a3d7f" />
          <rect x="6" y="5" width="1" height="1" fill="#5a8dcf" opacity="0.5" />
          <rect x="10" y="4" width="1" height="1" fill="#5a8dcf" opacity="0.5" />
        </svg>
      );

    case "river":
      // Flowing river
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="4" height="12" fill={COLORS.grass} />
          <rect x="10" y="2" width="4" height="12" fill={COLORS.grass} />
          <rect x="5" y="2" width="6" height="12" fill={COLORS.water} />
          <rect x="6" y="3" width="4" height="2" fill="#5a9dcf" />
          <rect x="5" y="7" width="5" height="2" fill="#5a9dcf" />
          <rect x="6" y="11" width="4" height="2" fill="#5a9dcf" />
          <rect x="7" y="4" width="2" height="1" fill="#7abdef" />
          <rect x="6" y="8" width="2" height="1" fill="#7abdef" />
        </svg>
      );

    // ═══════════════════════════════════════════════════════════════════
    // SPECIAL
    // ═══════════════════════════════════════════════════════════════════

    case "ice":
      // Ice crystal
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="6" y="2" width="4" height="12" fill={COLORS.ice} />
          <rect x="2" y="6" width="12" height="4" fill={COLORS.ice} />
          <rect x="4" y="4" width="2" height="2" fill={COLORS.iceDark} />
          <rect x="10" y="4" width="2" height="2" fill={COLORS.iceDark} />
          <rect x="4" y="10" width="2" height="2" fill={COLORS.iceDark} />
          <rect x="10" y="10" width="2" height="2" fill={COLORS.iceDark} />
          <rect x="7" y="7" width="2" height="2" fill="#ffffff" />
          <rect x="6" y="3" width="1" height="1" fill="#ffffff" opacity="0.6" />
        </svg>
      );

    case "ice_plains":
      // Snowy flat terrain
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="8" width="12" height="6" fill={COLORS.snow} />
          <rect x="2" y="8" width="12" height="1" fill={COLORS.snowDark} />
          <rect x="3" y="6" width="1" height="2" fill={COLORS.ice} />
          <rect x="6" y="5" width="1" height="3" fill={COLORS.ice} />
          <rect x="10" y="4" width="1" height="4" fill={COLORS.ice} />
          <rect x="13" y="6" width="1" height="2" fill={COLORS.ice} />
          <rect x="4" y="10" width="2" height="1" fill="#e8e8e8" />
          <rect x="9" y="11" width="3" height="1" fill="#e0e0e0" />
          <rect x="5" y="3" width="1" height="1" fill="#c8e8f8" />
          <rect x="11" y="2" width="1" height="1" fill="#d8f0ff" />
        </svg>
      );

    case "flower_forest":
      // Flowers and trees
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="10" width="12" height="4" fill={COLORS.grass} />
          <rect x="10" y="5" width="2" height="5" fill={COLORS.oakWood} />
          <rect x="8" y="2" width="6" height="4" fill={COLORS.leaves} />
          <rect x="3" y="7" width="2" height="2" fill={COLORS.flower} />
          <rect x="4" y="6" width="1" height="1" fill="#f86888" />
          <rect x="6" y="8" width="2" height="2" fill={COLORS.flowerYellow} />
          <rect x="7" y="7" width="1" height="1" fill="#f8e868" />
          <rect x="3" y="9" width="1" height="1" fill="#4a8a4a" />
          <rect x="6" y="10" width="1" height="1" fill="#4a8a4a" />
        </svg>
      );

    case "birch":
      // Birch tree
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="7" y="8" width="2" height="6" fill={COLORS.birchWood} />
          <rect x="7" y="9" width="2" height="1" fill="#2a2a2a" />
          <rect x="7" y="12" width="1" height="1" fill="#2a2a2a" />
          <rect x="4" y="2" width="8" height="6" fill="#6dab5d" />
          <rect x="3" y="3" width="10" height="4" fill="#6dab5d" />
          <rect x="5" y="4" width="2" height="2" fill="#7dbb6d" />
          <rect x="9" y="3" width="2" height="2" fill="#5d9b4d" />
        </svg>
      );

    case "roofed":
      // Dark oak canopy
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="8" fill="#2a4a2a" />
          <rect x="2" y="3" width="12" height="5" fill="#3a5a3a" />
          <rect x="4" y="4" width="3" height="2" fill="#2a3a2a" />
          <rect x="9" y="3" width="3" height="3" fill="#2a3a2a" />
          <rect x="6" y="10" width="2" height="4" fill={COLORS.darkOakWood} />
          <rect x="10" y="9" width="2" height="5" fill={COLORS.darkOakWood} />
          <rect x="4" y="5" width="1" height="1" fill="#4a6a4a" />
        </svg>
      );

    case "mega":
      // Giant tree trunk
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="5" y="6" width="6" height="8" fill={COLORS.spruceWood} />
          <rect x="4" y="8" width="8" height="6" fill={COLORS.spruceWood} />
          <rect x="3" y="2" width="10" height="6" fill="#2a5a3a" />
          <rect x="2" y="3" width="12" height="4" fill="#2a5a3a" />
          <rect x="4" y="1" width="8" height="2" fill="#1a4a2a" />
          <rect x="6" y="7" width="2" height="3" fill="#3a2a1a" />
          <rect x="8" y="9" width="2" height="3" fill="#4a3a2a" />
          <rect x="5" y="4" width="2" height="2" fill="#3a6a4a" />
        </svg>
      );

    case "mutated":
      // Warped/unusual terrain
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="10" width="12" height="4" fill={COLORS.grass} />
          <rect x="3" y="8" width="3" height="3" fill={COLORS.stone} />
          <rect x="4" y="6" width="2" height="2" fill={COLORS.gravel} />
          <rect x="9" y="7" width="4" height="4" fill={COLORS.stone} />
          <rect x="10" y="5" width="2" height="2" fill={COLORS.stone} />
          <rect x="11" y="3" width="1" height="2" fill={COLORS.gravel} />
          <rect x="6" y="9" width="2" height="2" fill="#7a9a6a" />
          <rect x="5" y="5" width="1" height="1" fill={COLORS.portal} opacity="0.5" />
          <rect x="8" y="4" width="1" height="1" fill={COLORS.portal} opacity="0.5" />
        </svg>
      );

    case "rare":
      // Diamond/gem
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="5" y="4" width="6" height="4" fill={COLORS.rare} />
          <rect x="4" y="5" width="8" height="2" fill={COLORS.rare} />
          <rect x="6" y="3" width="4" height="1" fill="#78d8f8" />
          <rect x="3" y="6" width="2" height="2" fill="#48b8d8" />
          <rect x="11" y="6" width="2" height="2" fill="#48b8d8" />
          <rect x="5" y="8" width="6" height="3" fill="#48b8d8" />
          <rect x="6" y="11" width="4" height="1" fill="#38a8c8" />
          <rect x="7" y="12" width="2" height="1" fill="#38a8c8" />
          <rect x="6" y="5" width="2" height="1" fill="#a8f8ff" />
          <rect x="7" y="4" width="1" height="1" fill="#ffffff" opacity="0.6" />
        </svg>
      );

    case "hills":
      // Rolling hills
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="10" width="12" height="4" fill={COLORS.grass} />
          <rect x="2" y="8" width="5" height="3" fill={COLORS.grass} />
          <rect x="3" y="7" width="3" height="2" fill={COLORS.grassDark} />
          <rect x="9" y="7" width="5" height="4" fill={COLORS.grass} />
          <rect x="10" y="5" width="3" height="3" fill={COLORS.grassDark} />
          <rect x="11" y="4" width="1" height="1" fill={COLORS.grass} />
          <rect x="4" y="8" width="1" height="1" fill="#6dab57" />
          <rect x="11" y="6" width="2" height="1" fill="#6dab57" />
        </svg>
      );

    case "edge":
      // Boundary line
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="6" height="12" fill={COLORS.grass} />
          <rect x="8" y="2" width="6" height="12" fill={COLORS.sand} />
          <rect x="7" y="2" width="2" height="12" fill="#7a9a6a" />
          <rect x="3" y="5" width="2" height="2" fill={COLORS.grassDark} />
          <rect x="5" y="9" width="2" height="2" fill="#5d9b47" />
          <rect x="10" y="4" width="2" height="2" fill="#c9b87a" />
          <rect x="9" y="10" width="3" height="2" fill="#e9d89a" />
        </svg>
      );

    case "shore":
      // Shoreline
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="5" fill={COLORS.water} />
          <rect x="2" y="9" width="12" height="5" fill={COLORS.sand} />
          <rect x="2" y="7" width="12" height="3" fill="#5a9dcf" />
          <rect x="3" y="7" width="4" height="1" fill="#7abdef" />
          <rect x="9" y="8" width="3" height="1" fill="#7abdef" />
          <rect x="4" y="10" width="2" height="1" fill="#f9e8aa" />
          <rect x="9" y="11" width="3" height="1" fill="#e9d89a" />
          <rect x="5" y="4" width="2" height="1" fill="#4a8dbf" />
        </svg>
      );

    // ═══════════════════════════════════════════════════════════════════
    // CAVES
    // ═══════════════════════════════════════════════════════════════════

    case "caves":
      // Cave opening
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" fill={COLORS.stone} />
          <rect x="4" y="5" width="8" height="9" fill="#2a2a2a" />
          <rect x="5" y="4" width="6" height="2" fill="#3a3a3a" />
          <rect x="3" y="3" width="2" height="2" fill="#6a6a6a" />
          <rect x="11" y="4" width="2" height="2" fill="#6a6a6a" />
          <rect x="5" y="6" width="2" height="3" fill={COLORS.stone} opacity="0.5" />
          <rect x="9" y="7" width="2" height="4" fill={COLORS.stone} opacity="0.5" />
          <rect x="7" y="10" width="2" height="2" fill="#1a1a1a" />
        </svg>
      );

    case "dripstone_caves":
      // Pointed dripstone
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="3" fill={COLORS.stone} />
          <rect x="2" y="11" width="12" height="3" fill={COLORS.stone} />
          {/* Stalactites */}
          <rect x="4" y="5" width="2" height="4" fill="#8a7a6a" />
          <rect x="5" y="9" width="1" height="2" fill="#7a6a5a" />
          <rect x="10" y="5" width="2" height="3" fill="#8a7a6a" />
          <rect x="11" y="8" width="1" height="2" fill="#7a6a5a" />
          {/* Stalagmites */}
          <rect x="6" y="9" width="2" height="2" fill="#8a7a6a" />
          <rect x="7" y="7" width="1" height="2" fill="#7a6a5a" />
          <rect x="3" y="10" width="1" height="1" fill="#8a7a6a" />
        </svg>
      );

    case "lush_caves":
      // Glow berries and azalea
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" fill="#4a5a4a" />
          <rect x="2" y="2" width="12" height="2" fill={COLORS.stone} />
          {/* Vines with glow berries */}
          <rect x="4" y="4" width="1" height="6" fill="#4d7d3d" />
          <rect x="4" y="6" width="1" height="1" fill={COLORS.glow} />
          <rect x="4" y="9" width="1" height="1" fill={COLORS.glow} />
          <rect x="10" y="4" width="1" height="7" fill="#4d7d3d" />
          <rect x="10" y="5" width="1" height="1" fill={COLORS.glow} />
          <rect x="10" y="8" width="1" height="1" fill={COLORS.glow} />
          {/* Azalea bush */}
          <rect x="6" y="9" width="4" height="3" fill="#5d8d4d" />
          <rect x="7" y="8" width="2" height="2" fill="#c878a8" />
          <rect x="7" y="12" width="2" height="2" fill="#5a4a3a" />
        </svg>
      );

    case "deep_dark":
      // Sculk with glow
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" fill={COLORS.sculk} />
          <rect x="3" y="4" width="4" height="3" fill="#0a4050" />
          <rect x="9" y="6" width="4" height="4" fill="#0a4050" />
          <rect x="4" y="10" width="5" height="3" fill="#0a4050" />
          {/* Sculk glow patches */}
          <rect x="5" y="5" width="1" height="1" fill={COLORS.sculkGlow} />
          <rect x="10" y="8" width="1" height="1" fill={COLORS.sculkGlow} />
          <rect x="6" y="11" width="1" height="1" fill={COLORS.sculkGlow} />
          <rect x="4" y="8" width="1" height="1" fill={COLORS.sculkGlow} opacity="0.5" />
          <rect x="11" y="4" width="1" height="1" fill={COLORS.sculkGlow} opacity="0.5" />
        </svg>
      );

    // ═══════════════════════════════════════════════════════════════════
    // NETHER BIOMES
    // ═══════════════════════════════════════════════════════════════════

    case "nether_wastes":
      // Netherrack terrain
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" fill={COLORS.netherrack} />
          <rect x="3" y="4" width="3" height="3" fill="#7b3a3a" />
          <rect x="9" y="3" width="4" height="2" fill="#5b2a2a" />
          <rect x="4" y="9" width="5" height="3" fill="#7b3a3a" />
          <rect x="10" y="8" width="3" height="4" fill="#5b2a2a" />
          {/* Lava pools */}
          <rect x="5" y="6" width="2" height="2" fill="#e87828" />
          <rect x="6" y="7" width="1" height="1" fill="#f8a848" />
        </svg>
      );

    case "crimson_forest":
      // Crimson fungus
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="10" width="12" height="4" fill="#5a2030" />
          <rect x="7" y="6" width="2" height="4" fill="#8a4858" />
          <rect x="4" y="2" width="8" height="5" fill={COLORS.crimson} />
          <rect x="3" y="3" width="10" height="3" fill={COLORS.crimson} />
          <rect x="5" y="4" width="2" height="1" fill="#9a3a4a" />
          <rect x="9" y="3" width="2" height="2" fill="#6a1a2a" />
          {/* Particles */}
          <rect x="3" y="7" width="1" height="1" fill="#9a4a5a" />
          <rect x="12" y="8" width="1" height="1" fill="#8a3a4a" />
        </svg>
      );

    case "warped_forest":
      // Warped fungus
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="10" width="12" height="4" fill="#1a4a4a" />
          <rect x="7" y="6" width="2" height="4" fill="#3a7a7a" />
          <rect x="4" y="2" width="8" height="5" fill={COLORS.warped} />
          <rect x="3" y="3" width="10" height="3" fill={COLORS.warped} />
          <rect x="5" y="4" width="2" height="1" fill="#3a8a8a" />
          <rect x="9" y="3" width="2" height="2" fill="#1a5a5a" />
          {/* Particles */}
          <rect x="3" y="7" width="1" height="1" fill="#4a9a9a" />
          <rect x="12" y="8" width="1" height="1" fill="#3a8a8a" />
        </svg>
      );

    case "soul_sand_valley":
      // Soul sand with blue fire
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="8" width="12" height="6" fill={COLORS.soulSand} />
          <rect x="3" y="9" width="2" height="2" fill="#3a2a1a" />
          <rect x="8" y="10" width="3" height="2" fill="#5a4a3a" />
          {/* Soul fire */}
          <rect x="5" y="4" width="2" height="4" fill={COLORS.soulFire} />
          <rect x="4" y="5" width="4" height="2" fill={COLORS.soulFire} />
          <rect x="5" y="3" width="1" height="1" fill="#6ad8d8" />
          <rect x="10" y="5" width="2" height="3" fill={COLORS.soulFire} opacity="0.7" />
          <rect x="11" y="4" width="1" height="1" fill="#6ad8d8" opacity="0.7" />
          {/* Bone */}
          <rect x="3" y="12" width="3" height="1" fill="#d8d0c0" />
        </svg>
      );

    case "basalt_deltas":
      // Basalt columns
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="10" width="12" height="4" fill={COLORS.basalt} />
          <rect x="3" y="6" width="2" height="5" fill="#5a5a5a" />
          <rect x="3" y="5" width="2" height="1" fill="#3a3a3a" />
          <rect x="6" y="4" width="3" height="7" fill="#5a5a5a" />
          <rect x="6" y="3" width="3" height="1" fill="#3a3a3a" />
          <rect x="11" y="7" width="2" height="4" fill="#5a5a5a" />
          <rect x="11" y="6" width="2" height="1" fill="#3a3a3a" />
          {/* Lava */}
          <rect x="9" y="11" width="2" height="2" fill="#e87828" />
          <rect x="10" y="12" width="1" height="1" fill="#f8a848" />
        </svg>
      );

    // ═══════════════════════════════════════════════════════════════════
    // DEFAULT
    // ═══════════════════════════════════════════════════════════════════

    default:
      // Generic biome tag icon (leaf)
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
          <rect x="4" y="4" width="8" height="6" fill={COLORS.leaves} />
          <rect x="3" y="5" width="10" height="4" fill={COLORS.leaves} />
          <rect x="5" y="3" width="6" height="2" fill={COLORS.leavesDark} />
          <rect x="5" y="10" width="6" height="2" fill={COLORS.leavesDark} />
          <rect x="6" y="6" width="2" height="2" fill="#6dab5d" />
          <rect x="9" y="5" width="2" height="2" fill="#4d8c3d" />
          <rect x="7" y="11" width="2" height="3" fill={COLORS.oakWood} />
        </svg>
      );
  }
}

/**
 * BiomeTagIcon component
 * Displays a Minecraft-inspired pixel-art icon for a specific biome tag.
 */
export default function BiomeTagIcon({ tagId, size = 14, className }: IBiomeTagIconProps): JSX.Element {
  return (
    <span
      className={`biome-tag-icon ${className || ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        marginRight: "2px",
        flexShrink: 0,
      }}
    >
      {getTagIcon(tagId, size)}
    </span>
  );
}

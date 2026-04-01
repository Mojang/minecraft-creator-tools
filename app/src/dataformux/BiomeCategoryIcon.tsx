// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* ═══════════════════════════════════════════════════════════════════════════
   BIOME CATEGORY ICON - Inline SVG Icons for Biome Categories
   
   Provides unique pixel-art style icons for biome filter categories.
   Used by SimplifiedBiomeFilterEditor to visually distinguish category types.
   
   Categories:
   - Dimensions (cyan): Portal/world icon - Overworld, Nether, The End
   - Temperature (orange): Thermometer icon - Cold, Warm, Frozen, etc.
   - Biome Types (green): Terrain/landscape icon - Forest, Desert, Ocean, etc.
   - Special (purple): Star/sparkle icon - Mutated, Rare, etc.
   - Caves (brown): Cave opening icon - Dripstone, Lush, Deep Dark
   - Nether Biomes (red): Fire/flame icon - Crimson, Warped, etc.
   
   ═══════════════════════════════════════════════════════════════════════════ */

import React from "react";

export interface IBiomeCategoryIconProps {
  categoryName: string;
  size?: number;
  className?: string;
}

// Color palette for biome categories
const BIOME_CATEGORY_COLORS = {
  dimensions: "#6bc9c9", // Cyan - dimensions/worlds
  temperature: "#e8a855", // Orange - temperature
  biomeTypes: "#52a535", // Green - biome types/terrain
  special: "#9b6bc9", // Purple - special variants
  caves: "#8b6b4a", // Brown - caves
  netherBiomes: "#d65c5c", // Red - nether biomes
  default: "#7b9fe0", // Blue - fallback
};

/**
 * Map category name to color key
 */
function getCategoryColorKey(categoryName: string): string {
  const lower = categoryName.toLowerCase();

  if (lower.includes("dimension")) return "dimensions";
  if (lower.includes("temperature")) return "temperature";
  if (lower.includes("biome type")) return "biomeTypes";
  if (lower.includes("special")) return "special";
  if (lower.includes("cave")) return "caves";
  if (lower.includes("nether")) return "netherBiomes";

  return "default";
}

/**
 * Get the color for a biome category
 */
export function getBiomeCategoryColor(categoryName: string): string {
  const key = getCategoryColorKey(categoryName);
  return BIOME_CATEGORY_COLORS[key as keyof typeof BIOME_CATEGORY_COLORS] || BIOME_CATEGORY_COLORS.default;
}

/**
 * Dimensions icon - Portal/world (Overworld, Nether, The End)
 */
function renderDimensionsIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Globe/world shape */}
      <rect x="4" y="2" width="8" height="12" fill={color} opacity="0.3" />
      <rect x="3" y="4" width="10" height="8" fill={color} opacity="0.3" />
      {/* Portal frame */}
      <rect x="3" y="2" width="10" height="2" fill={color} />
      <rect x="3" y="12" width="10" height="2" fill={color} />
      <rect x="2" y="4" width="2" height="8" fill={color} />
      <rect x="12" y="4" width="2" height="8" fill={color} />
      {/* Portal center glow */}
      <rect x="5" y="5" width="6" height="6" fill={color} opacity="0.6" />
      <rect x="6" y="6" width="4" height="4" fill={color} opacity="0.8" />
      <rect x="7" y="7" width="2" height="2" fill="#ffffff" opacity="0.5" />
    </svg>
  );
}

/**
 * Temperature icon - Thermometer (Cold, Warm, Frozen, etc.)
 */
function renderTemperatureIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Thermometer body */}
      <rect x="6" y="1" width="4" height="10" fill={color} opacity="0.4" />
      <rect x="5" y="2" width="1" height="8" fill={color} />
      <rect x="10" y="2" width="1" height="8" fill={color} />
      <rect x="6" y="1" width="4" height="1" fill={color} />
      {/* Thermometer bulb */}
      <rect x="4" y="10" width="8" height="5" fill={color} />
      <rect x="5" y="9" width="6" height="1" fill={color} />
      <rect x="5" y="15" width="6" height="1" fill={color} opacity="0.6" />
      {/* Mercury level */}
      <rect x="7" y="4" width="2" height="6" fill={color} />
      <rect x="6" y="11" width="4" height="3" fill={color} />
      {/* Highlight */}
      <rect x="6" y="11" width="1" height="2" fill="#ffffff" opacity="0.3" />
      {/* Temperature marks */}
      <rect x="11" y="3" width="2" height="1" fill={color} opacity="0.5" />
      <rect x="11" y="5" width="2" height="1" fill={color} opacity="0.5" />
      <rect x="11" y="7" width="2" height="1" fill={color} opacity="0.5" />
    </svg>
  );
}

/**
 * Biome Types icon - Terrain/landscape (Forest, Desert, Ocean, etc.)
 */
function renderBiomeTypesIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Ground/terrain base */}
      <rect x="0" y="12" width="16" height="4" fill={color} opacity="0.6" />
      {/* Mountain peaks */}
      <rect x="1" y="10" width="3" height="2" fill={color} />
      <rect x="2" y="8" width="2" height="2" fill={color} />
      <rect x="2" y="6" width="1" height="2" fill={color} />
      {/* Second mountain */}
      <rect x="6" y="9" width="4" height="3" fill={color} />
      <rect x="7" y="7" width="3" height="2" fill={color} />
      <rect x="8" y="5" width="2" height="2" fill={color} />
      <rect x="8" y="3" width="1" height="2" fill={color} />
      {/* Small hill */}
      <rect x="12" y="10" width="3" height="2" fill={color} />
      <rect x="13" y="9" width="2" height="1" fill={color} />
      {/* Tree on hill */}
      <rect x="3" y="6" width="1" height="4" fill={color} opacity="0.8" />
      <rect x="2" y="4" width="3" height="3" fill={color} opacity="0.9" />
      <rect x="3" y="3" width="1" height="1" fill={color} />
      {/* Sun */}
      <rect x="12" y="2" width="3" height="3" fill={color} opacity="0.4" />
      <rect x="13" y="3" width="1" height="1" fill="#ffffff" opacity="0.6" />
    </svg>
  );
}

/**
 * Special icon - Star/sparkle (Mutated, Rare, etc.)
 */
function renderSpecialIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Center star */}
      <rect x="7" y="2" width="2" height="12" fill={color} />
      <rect x="2" y="7" width="12" height="2" fill={color} />
      {/* Diagonal rays */}
      <rect x="4" y="4" width="2" height="2" fill={color} opacity="0.8" />
      <rect x="10" y="4" width="2" height="2" fill={color} opacity="0.8" />
      <rect x="4" y="10" width="2" height="2" fill={color} opacity="0.8" />
      <rect x="10" y="10" width="2" height="2" fill={color} opacity="0.8" />
      {/* Star points */}
      <rect x="7" y="0" width="2" height="2" fill={color} opacity="0.6" />
      <rect x="7" y="14" width="2" height="2" fill={color} opacity="0.6" />
      <rect x="0" y="7" width="2" height="2" fill={color} opacity="0.6" />
      <rect x="14" y="7" width="2" height="2" fill={color} opacity="0.6" />
      {/* Center glow */}
      <rect x="6" y="6" width="4" height="4" fill={color} />
      <rect x="7" y="7" width="2" height="2" fill="#ffffff" opacity="0.5" />
      {/* Small sparkles */}
      <rect x="3" y="2" width="1" height="1" fill={color} opacity="0.4" />
      <rect x="12" y="2" width="1" height="1" fill={color} opacity="0.4" />
      <rect x="3" y="13" width="1" height="1" fill={color} opacity="0.4" />
      <rect x="12" y="13" width="1" height="1" fill={color} opacity="0.4" />
    </svg>
  );
}

/**
 * Caves icon - Cave opening (Dripstone, Lush, Deep Dark)
 */
function renderCavesIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cave opening background */}
      <rect x="4" y="6" width="8" height="10" fill={color} opacity="0.3" />
      {/* Stone arch/cave entrance */}
      <rect x="2" y="4" width="12" height="2" fill={color} />
      <rect x="1" y="6" width="2" height="10" fill={color} />
      <rect x="13" y="6" width="2" height="10" fill={color} />
      {/* Stone texture on arch */}
      <rect x="4" y="4" width="2" height="1" fill={color} opacity="0.7" />
      <rect x="8" y="4" width="3" height="1" fill={color} opacity="0.7" />
      {/* Stalactites */}
      <rect x="4" y="6" width="2" height="3" fill={color} opacity="0.8" />
      <rect x="5" y="9" width="1" height="2" fill={color} opacity="0.8" />
      <rect x="9" y="6" width="2" height="4" fill={color} opacity="0.8" />
      <rect x="10" y="10" width="1" height="2" fill={color} opacity="0.8" />
      {/* Stalagmites */}
      <rect x="5" y="13" width="2" height="3" fill={color} opacity="0.7" />
      <rect x="6" y="11" width="1" height="2" fill={color} opacity="0.7" />
      <rect x="10" y="14" width="2" height="2" fill={color} opacity="0.7" />
      {/* Cave darkness */}
      <rect x="6" y="8" width="4" height="5" fill={color} opacity="0.2" />
      {/* Glowing crystal */}
      <rect x="7" y="10" width="2" height="2" fill={color} opacity="0.9" />
      <rect x="7" y="10" width="1" height="1" fill="#ffffff" opacity="0.4" />
    </svg>
  );
}

/**
 * Nether Biomes icon - Fire/flame (Crimson, Warped, etc.)
 */
function renderNetherBiomesIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Main flame body */}
      <rect x="6" y="10" width="4" height="6" fill={color} />
      <rect x="5" y="8" width="6" height="4" fill={color} />
      <rect x="4" y="6" width="8" height="4" fill={color} />
      <rect x="5" y="4" width="6" height="3" fill={color} />
      <rect x="6" y="2" width="4" height="3" fill={color} />
      <rect x="7" y="0" width="2" height="3" fill={color} />
      {/* Flame tip */}
      <rect x="7" y="0" width="1" height="1" fill={color} opacity="0.6" />
      {/* Side flames */}
      <rect x="3" y="8" width="2" height="4" fill={color} opacity="0.7" />
      <rect x="3" y="6" width="1" height="2" fill={color} opacity="0.5" />
      <rect x="11" y="8" width="2" height="4" fill={color} opacity="0.7" />
      <rect x="12" y="6" width="1" height="2" fill={color} opacity="0.5" />
      {/* Inner flame highlight */}
      <rect x="7" y="8" width="2" height="4" fill="#ffffff" opacity="0.2" />
      <rect x="7" y="5" width="2" height="3" fill="#ffffff" opacity="0.15" />
      <rect x="8" y="3" width="1" height="2" fill="#ffffff" opacity="0.1" />
      {/* Ember particles */}
      <rect x="4" y="2" width="1" height="1" fill={color} opacity="0.4" />
      <rect x="11" y="3" width="1" height="1" fill={color} opacity="0.4" />
      <rect x="2" y="5" width="1" height="1" fill={color} opacity="0.3" />
      <rect x="13" y="4" width="1" height="1" fill={color} opacity="0.3" />
    </svg>
  );
}

/**
 * Default icon - Globe (fallback)
 */
function renderDefaultIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Circle/globe */}
      <rect x="4" y="1" width="8" height="2" fill={color} />
      <rect x="2" y="3" width="12" height="2" fill={color} />
      <rect x="1" y="5" width="14" height="6" fill={color} />
      <rect x="2" y="11" width="12" height="2" fill={color} />
      <rect x="4" y="13" width="8" height="2" fill={color} />
      {/* Latitude lines */}
      <rect x="2" y="7" width="12" height="1" fill="#ffffff" opacity="0.2" />
      <rect x="3" y="4" width="10" height="1" fill="#ffffff" opacity="0.15" />
      <rect x="3" y="11" width="10" height="1" fill="#ffffff" opacity="0.15" />
      {/* Longitude line */}
      <rect x="7" y="2" width="2" height="12" fill="#ffffff" opacity="0.15" />
      {/* Highlight */}
      <rect x="4" y="4" width="3" height="3" fill="#ffffff" opacity="0.2" />
    </svg>
  );
}

/**
 * BiomeCategoryIcon component
 * Displays a pixel-art SVG icon for a biome category.
 */
export default function BiomeCategoryIcon({
  categoryName,
  size = 16,
  className,
}: IBiomeCategoryIconProps): JSX.Element {
  const colorKey = getCategoryColorKey(categoryName);
  const color = getBiomeCategoryColor(categoryName);

  let icon: JSX.Element;

  switch (colorKey) {
    case "dimensions":
      icon = renderDimensionsIcon(size, color);
      break;
    case "temperature":
      icon = renderTemperatureIcon(size, color);
      break;
    case "biomeTypes":
      icon = renderBiomeTypesIcon(size, color);
      break;
    case "special":
      icon = renderSpecialIcon(size, color);
      break;
    case "caves":
      icon = renderCavesIcon(size, color);
      break;
    case "netherBiomes":
      icon = renderNetherBiomesIcon(size, color);
      break;
    default:
      icon = renderDefaultIcon(size, color);
      break;
  }

  return (
    <span
      className={`biome-category-icon biome-category-icon-${colorKey} ${className || ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: size,
        height: size,
        marginRight: "6px",
      }}
    >
      {icon}
    </span>
  );
}

// Export helper for external color access
export { getCategoryColorKey };

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK COMPONENT ICON - External SVG Loader for Block Components
   
   Loads unique SVG icons for Minecraft block components from external files.
   Each block component has a dedicated SVG icon file in:
     /public/res/icons/block-components/
   
   Categories (color-coded):
   - Geometry (cyan): geometry, transformation, unit_cube
   - Material (purple): material_instances, map_color, bone_visibility
   - Physics (green): collision_box, selection_box, friction
   - Light (yellow): light_emission, light_dampening
   - Destruction (dark red): destructible_by_explosion, destructible_by_mining, flammable
   - Interaction (orange): crafting_table, placement_filter, loot
   - Redstone (red): redstone_conductivity, ticking
   - Misc (blue): custom_components, replaceable, movable
   
   ═══════════════════════════════════════════════════════════════════════════ */

import React from "react";
import CreatorToolsHost from "../../../app/CreatorToolsHost";

export interface IBlockComponentIconProps {
  componentId: string;
  size?: number;
  className?: string;
}

// Data-driven color palette for block component categories.
// These are intentionally hardcoded (not theme colors) because they represent
// fixed semantic categories that must remain visually distinct regardless of theme.
const BLOCK_ICON_COLORS = {
  geometry: "#6bc9c9", // Cyan - geometry/shape
  material: "#9b6bc9", // Purple - materials/textures
  physics: "#52a535", // Green - physics/collision
  interaction: "#e8a855", // Orange - player interaction
  redstone: "#d65c5c", // Red - redstone
  light: "#e8d855", // Yellow - light
  destruction: "#c94545", // Dark red - destruction/explosion
  misc: "#7b9fe0", // Blue - miscellaneous
};

/**
 * Map of legacy/alternate component IDs to their canonical icon equivalents.
 * Some blocks may use older naming conventions or aliases.
 * NOTE: All keys MUST be lowercase for case-insensitive lookup.
 */
const COMPONENT_ICON_ALIASES: { [key: string]: string } = {
  // Legacy naming conventions (format version < 1.19.40)
  "minecraft:destroy_time": "minecraft:destructible_by_mining",
  "minecraft:explosion_resistance": "minecraft:destructible_by_explosion",
  "minecraft:block_light_emission": "minecraft:light_emission",
  "minecraft:block_light_absorption": "minecraft:light_dampening",
  "minecraft:block_light_filter": "minecraft:light_dampening",

  // Aliases and variations
  "minecraft:block_collision": "minecraft:collision_box",
  "minecraft:pick_collision": "minecraft:selection_box",
  "minecraft:aim_collision": "minecraft:selection_box",
  "minecraft:creative_category": "minecraft:display_name",
  "minecraft:on_step_on": "minecraft:entity_fall_on",
  "minecraft:on_step_off": "minecraft:entity_fall_on",
  "minecraft:on_fall_on": "minecraft:entity_fall_on",
  "minecraft:on_placed": "minecraft:placement_filter",
  "minecraft:on_player_placing": "minecraft:placement_filter",
  "minecraft:on_interact": "minecraft:crafting_table",
  "minecraft:on_player_destroyed": "minecraft:destructible_by_mining",
  "minecraft:breakonpush": "minecraft:movable",
  "minecraft:immovable": "minecraft:movable",
  "minecraft:onlypistonpush": "minecraft:movable",
  "minecraft:unwalkable": "minecraft:collision_box",
};

/**
 * Get the canonical component ID for icon lookup.
 * Maps legacy/alias IDs to their modern equivalents.
 */
function getCanonicalComponentId(componentId: string): string {
  // Keys are already lowercase in the map, so just lowercase the input
  const lower = componentId.toLowerCase();
  const mapped = COMPONENT_ICON_ALIASES[lower];
  return mapped || componentId;
}

/**
 * Convert a component ID (minecraft:geometry) to an SVG filename
 * minecraft:geometry -> minecraft_geometry.svg
 */
function componentIdToFilename(componentId: string): string {
  const canonical = getCanonicalComponentId(componentId);
  return canonical.replace("minecraft:", "minecraft_").replace(/\./g, "_") + ".svg";
}

/**
 * Get the icon type category based on block component ID
 */
function getBlockIconType(componentId: string): string {
  // First try to get the canonical component ID
  const canonical = getCanonicalComponentId(componentId);
  const id = canonical.toLowerCase();

  // Geometry related
  if (
    id.includes("geometry") ||
    id.includes("transformation") ||
    id.includes("unit_cube") ||
    id.includes("bone_visibility")
  ) {
    return "geometry";
  }

  // Material related
  if (id.includes("material") || id.includes("map_color") || id.includes("item_visual") || id.includes("embedded")) {
    return "material";
  }

  // Light related
  if (
    id.includes("light_emission") ||
    id.includes("light_dampening") ||
    id.includes("light_absorption") ||
    id.includes("light_filter")
  ) {
    return "light";
  }

  // Destruction related
  if (
    id.includes("destructible") ||
    id.includes("flammable") ||
    id.includes("explosion") ||
    id.includes("mining") ||
    id.includes("destruction") ||
    id.includes("destroy_time") ||
    id.includes("explosion_resistance")
  ) {
    return "destruction";
  }

  // Physics/collision related
  if (
    id.includes("collision") ||
    id.includes("selection") ||
    id.includes("friction") ||
    id.includes("breathability") ||
    id.includes("pick_collision") ||
    id.includes("aim_collision") ||
    id.includes("unwalkable")
  ) {
    return "physics";
  }

  // Redstone related
  if (id.includes("redstone") || id.includes("tick") || id.includes("queued") || id.includes("random_ticking")) {
    return "redstone";
  }

  // Interaction related
  if (
    id.includes("crafting") ||
    id.includes("placement") ||
    id.includes("loot") ||
    id.includes("display_name") ||
    id.includes("flower") ||
    id.includes("entity_fall") ||
    id.includes("on_step") ||
    id.includes("on_fall") ||
    id.includes("on_interact") ||
    id.includes("on_placed") ||
    id.includes("creative_category")
  ) {
    return "interaction";
  }

  return "misc";
}

/**
 * Get the fill color for a block component icon based on its category
 */
export function getBlockComponentColor(componentId: string): string {
  const iconType = getBlockIconType(componentId);

  switch (iconType) {
    case "geometry":
      return BLOCK_ICON_COLORS.geometry;
    case "material":
      return BLOCK_ICON_COLORS.material;
    case "physics":
      return BLOCK_ICON_COLORS.physics;
    case "light":
      return BLOCK_ICON_COLORS.light;
    case "destruction":
      return BLOCK_ICON_COLORS.destruction;
    case "redstone":
      return BLOCK_ICON_COLORS.redstone;
    case "interaction":
      return BLOCK_ICON_COLORS.interaction;
    default:
      return BLOCK_ICON_COLORS.misc;
  }
}

/**
 * Get a CSS class name for the block component category (used for theming)
 */
export function getBlockComponentCategoryClass(componentId: string): string {
  return `block-component-${getBlockIconType(componentId)}`;
}

/**
 * Fallback inline SVG icon (cube) for when external icon fails to load
 */
function renderFallbackIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="12" height="10" fill={color} />
      <rect x="2" y="2" width="10" height="2" fill={color} opacity="0.7" />
      <rect x="12" y="2" width="2" height="2" fill={color} opacity="0.5" />
      <rect x="4" y="6" width="4" height="4" fill="#ffffff" opacity="0.3" />
    </svg>
  );
}

/**
 * BlockComponentIcon component
 * Loads and displays an SVG icon for a Minecraft block component.
 * Falls back to an inline icon if the external SVG fails to load.
 */
export default function BlockComponentIcon({
  componentId,
  size = 16,
  className,
}: IBlockComponentIconProps): JSX.Element {
  const color = getBlockComponentColor(componentId);
  const filename = componentIdToFilename(componentId);
  const iconUrl = CreatorToolsHost.contentWebRoot + `res/icons/block-components/${filename}`;

  const [hasError, setHasError] = React.useState(false);

  // Reset error state when componentId changes
  React.useEffect(() => {
    setHasError(false);
  }, [componentId]);

  const iconType = getBlockIconType(componentId);

  if (hasError) {
    // Show fallback inline icon if external SVG failed
    return (
      <span
        className={`block-component-icon block-component-icon-${iconType} ${className || ""}`}
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        {renderFallbackIcon(size, color)}
      </span>
    );
  }

  return (
    <span
      className={`block-component-icon block-component-icon-${iconType} ${className || ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: size,
        height: size,
      }}
    >
      <img
        src={iconUrl}
        alt={componentId + " icon"}
        width={size}
        height={size}
        onError={() => {
          setHasError(true);
        }}
        style={{
          display: "block",
          imageRendering: "pixelated", // Keep crisp blocky pixels
        }}
      />
    </span>
  );
}

// Export the icon type getter for use in styling
export { getBlockIconType };

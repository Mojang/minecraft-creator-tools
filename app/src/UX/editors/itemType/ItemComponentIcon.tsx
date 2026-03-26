/* ═══════════════════════════════════════════════════════════════════════════
   ITEM COMPONENT ICON - External SVG Loader for Item Components
   
   Loads unique SVG icons for Minecraft item components from external files.
   Each item component has a dedicated SVG icon file in:
     /public/res/icons/item-components/
   
   If a specific icon doesn't exist, falls back to a category-colored icon.
   
   Categories (color-coded):
   - Combat (red): damage, projectile, weapon, throwable
   - Tools (brown): digger, durability, repairable
   - Food (green): food, saturation
   - Appearance (purple): icon, glint, wearable, hand_equipped
   - Interaction (orange): entity_placer, block_placer, on_use
   - Storage (blue): max_stack_size, bundle
   - Misc (gray): custom_components, tags
   
   ═══════════════════════════════════════════════════════════════════════════ */

import React from "react";
import CreatorToolsHost from "../../../app/CreatorToolsHost";

export interface IItemComponentIconProps {
  componentId: string;
  size?: number;
  className?: string;
}

// Color palette for item component categories
const ITEM_ICON_COLORS = {
  combat: "#d65c5c", // Red - combat/weapons
  tools: "#a67c52", // Brown - tools/durability
  food: "#52a535", // Green - food/consumables
  appearance: "#9b6bc9", // Purple - visual/appearance
  interaction: "#e8a855", // Orange - player interaction
  storage: "#5c8dd6", // Blue - storage/stacking
  enchantment: "#5cd6d6", // Cyan - enchantments
  misc: "#7b9fe0", // Light blue - miscellaneous
};

/**
 * Map of legacy/alternate component IDs to their canonical icon equivalents.
 */
const COMPONENT_ICON_ALIASES: { [key: string]: string } = {
  // Common aliases
  "minecraft:weapon": "minecraft:damage",
  "minecraft:armor": "minecraft:wearable",
  "minecraft:tool": "minecraft:digger",
};

/**
 * Get the canonical component ID for icon lookup.
 */
function getCanonicalComponentId(componentId: string): string {
  const lower = componentId.toLowerCase();
  return COMPONENT_ICON_ALIASES[lower] || componentId;
}

/**
 * Convert a component ID (minecraft:damage) to an SVG filename
 * minecraft:damage -> minecraft_damage.svg
 */
function componentIdToFilename(componentId: string): string {
  const canonical = getCanonicalComponentId(componentId);
  return canonical.replace("minecraft:", "minecraft_").replace(/\./g, "_") + ".svg";
}

/**
 * Get the icon type category based on item component ID
 */
function getItemIconType(componentId: string): string {
  const canonical = getCanonicalComponentId(componentId);
  const id = canonical.toLowerCase();

  // Combat related
  if (
    id.includes("damage") ||
    id.includes("projectile") ||
    id.includes("weapon") ||
    id.includes("throwable") ||
    id.includes("shooter") ||
    id.includes("knockback")
  ) {
    return "combat";
  }

  // Tools related
  if (
    id.includes("digger") ||
    id.includes("durability") ||
    id.includes("repairable") ||
    id.includes("mining_speed") ||
    id.includes("tool")
  ) {
    return "tools";
  }

  // Food related
  if (
    id.includes("food") ||
    id.includes("saturation") ||
    id.includes("nutrition") ||
    id.includes("consumable") ||
    id.includes("use_duration")
  ) {
    return "food";
  }

  // Appearance related
  if (
    id.includes("icon") ||
    id.includes("glint") ||
    id.includes("wearable") ||
    id.includes("hand_equipped") ||
    id.includes("render") ||
    id.includes("display") ||
    id.includes("hover_text") ||
    id.includes("rarity") ||
    id.includes("dyeable")
  ) {
    return "appearance";
  }

  // Interaction related
  if (
    id.includes("entity_placer") ||
    id.includes("block_placer") ||
    id.includes("on_use") ||
    id.includes("interact") ||
    id.includes("seed") ||
    id.includes("bucket") ||
    id.includes("record")
  ) {
    return "interaction";
  }

  // Storage related
  if (id.includes("max_stack") || id.includes("bundle") || id.includes("storage") || id.includes("container")) {
    return "storage";
  }

  // Enchantment related
  if (id.includes("enchant") || id.includes("magic")) {
    return "enchantment";
  }

  return "misc";
}

/**
 * Get the fill color for an item component icon based on its category
 */
export function getItemComponentColor(componentId: string): string {
  const iconType = getItemIconType(componentId);

  switch (iconType) {
    case "combat":
      return ITEM_ICON_COLORS.combat;
    case "tools":
      return ITEM_ICON_COLORS.tools;
    case "food":
      return ITEM_ICON_COLORS.food;
    case "appearance":
      return ITEM_ICON_COLORS.appearance;
    case "interaction":
      return ITEM_ICON_COLORS.interaction;
    case "storage":
      return ITEM_ICON_COLORS.storage;
    case "enchantment":
      return ITEM_ICON_COLORS.enchantment;
    default:
      return ITEM_ICON_COLORS.misc;
  }
}

/**
 * Get a CSS class name for the item component category
 */
export function getItemComponentCategoryClass(componentId: string): string {
  return getItemIconType(componentId);
}

/**
 * Get a human-readable category description
 */
export function getItemComponentCategoryDescription(componentId: string): string {
  const iconType = getItemIconType(componentId);

  switch (iconType) {
    case "combat":
      return "Combat";
    case "tools":
      return "Tools";
    case "food":
      return "Food";
    case "appearance":
      return "Appearance";
    case "interaction":
      return "Interaction";
    case "storage":
      return "Storage";
    case "enchantment":
      return "Enchantment";
    default:
      return "Other";
  }
}

/**
 * Fallback inline SVG icon for items (sword shape)
 */
function renderFallbackIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Simple item/tool shape */}
      <rect x="7" y="2" width="2" height="10" fill={color} />
      <rect x="5" y="12" width="6" height="2" fill={color} />
      <rect x="6" y="14" width="4" height="1" fill={color} opacity="0.7" />
      <rect x="6" y="4" width="4" height="2" fill={color} opacity="0.7" />
    </svg>
  );
}

/**
 * ItemComponentIcon component
 * Loads and displays an SVG icon for a Minecraft item component.
 * Falls back to an inline icon if the external SVG fails to load.
 */
export default function ItemComponentIcon({ componentId, size = 16, className }: IItemComponentIconProps): JSX.Element {
  const color = getItemComponentColor(componentId);
  const filename = componentIdToFilename(componentId);
  const iconUrl = CreatorToolsHost.contentWebRoot + `res/icons/item-components/${filename}`;

  const [hasError, setHasError] = React.useState(false);

  // Reset error state when componentId changes
  React.useEffect(() => {
    setHasError(false);
  }, [componentId]);

  const iconType = getItemIconType(componentId);

  if (hasError) {
    // Show fallback inline icon if external SVG failed
    return (
      <span
        className={`item-component-icon item-component-icon-${iconType} ${className || ""}`}
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        {renderFallbackIcon(size, color)}
      </span>
    );
  }

  return (
    <span
      className={`item-component-icon item-component-icon-${iconType} ${className || ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: size,
        height: size,
      }}
    >
      <img
        src={iconUrl}
        alt=""
        role="presentation"
        width={size}
        height={size}
        onError={() => setHasError(true)}
        style={{
          display: "block",
          imageRendering: "pixelated",
        }}
      />
    </span>
  );
}

export { getItemIconType };

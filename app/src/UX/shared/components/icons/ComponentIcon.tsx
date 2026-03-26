/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT ICON - External SVG Loader for Entity Components
   
   Loads unique SVG icons for Minecraft entity components from external files.
   Each of the 380 entity components has its own dedicated SVG icon file in:
     /public/res/icons/components/
   
   Categories (color-coded):
   - Movement (cyan): walk, fly, swim, climb, navigation
   - Combat (red): attack, damage, knockback  
   - Health (pink): health, heal, regeneration
   - Sensor (purple): target, look, see, track
   - Behavior (orange): AI behaviors
   - Trigger (dark red): event triggers (on_*)
   - Attribute (blue): simple properties (is_*, can_*)
   - Complex (green): multi-property components
   
   See: docs/ux/Components.md
   ═══════════════════════════════════════════════════════════════════════════ */

import React from "react";
import CreatorToolsHost from "../../../../app/CreatorToolsHost";

export interface IComponentIconProps {
  componentId: string;
  size?: number;
  className?: string;
}

// Color palette matching Minecraft Creator Tools design system
const ICON_COLORS = {
  attribute: "#7b9fe0", // Blue - simple properties
  behavior: "#e8a855", // Orange/Gold - AI behaviors
  trigger: "#d65c5c", // Red - event triggers
  complex: "#52a535", // Green - complex components
  movement: "#6bc9c9", // Cyan - movement related
  combat: "#c94545", // Dark red - combat/damage
  sensor: "#9b6bc9", // Purple - sensors
  health: "#e05c7a", // Pink/Red - health related
  interact: "#4a9fd4", // Blue - interaction
  spawn: "#8fd46b", // Light green - spawn/life
  sound: "#d4a84a", // Gold - audio
};

/**
 * Convert a component ID (minecraft:behavior.wander) to an SVG filename
 * minecraft:behavior.wander -> minecraft_behavior_wander.svg
 */
function componentIdToFilename(componentId: string): string {
  return componentId.replace("minecraft:", "minecraft_").replace(/\./g, "_") + ".svg";
}

/**
 * Get the icon type category based on component ID keywords
 */
function getIconType(componentId: string): string {
  const id = componentId.toLowerCase();

  // Movement related
  if (
    id.includes("move") ||
    id.includes("walk") ||
    id.includes("fly") ||
    id.includes("swim") ||
    id.includes("jump") ||
    id.includes("climb") ||
    id.includes("navigation") ||
    id.includes("follow") ||
    id.includes("go_") ||
    id.includes("path")
  ) {
    return "movement";
  }

  // Combat related
  if (
    id.includes("attack") ||
    id.includes("combat") ||
    id.includes("damage") ||
    id.includes("hurt") ||
    id.includes("knockback") ||
    id.includes("melee")
  ) {
    return "combat";
  }

  // Health related
  if (id.includes("health") || id.includes("heal") || id.includes("regeneration")) {
    return "health";
  }

  // Sensor related
  if (
    id.includes("sensor") ||
    id.includes("target") ||
    id.includes("look") ||
    id.includes("nearest") ||
    id.includes("see") ||
    id.includes("track")
  ) {
    return "sensor";
  }

  // Interact related
  if (
    id.includes("interact") ||
    id.includes("rideable") ||
    id.includes("tame") ||
    id.includes("leash") ||
    id.includes("sit") ||
    id.includes("trade") ||
    id.includes("barter") ||
    id.includes("ride")
  ) {
    return "interact";
  }

  // Sound related
  if (id.includes("sound") || id.includes("ambient") || id.includes("audio") || id.includes("croak")) {
    return "sound";
  }

  // Spawn related
  if (
    id.includes("spawn") ||
    id.includes("despawn") ||
    id.includes("baby") ||
    id.includes("ageable") ||
    id.includes("breed") ||
    id.includes("grow")
  ) {
    return "spawn";
  }

  // Behavior prefix
  if (id.includes("behavior")) {
    return "behavior";
  }

  // Trigger prefix
  if (id.startsWith("minecraft:on_") || id.includes("trigger") || id.includes("event")) {
    return "trigger";
  }

  // Boolean attributes
  if (
    id.includes("is_") ||
    id.includes("can_") ||
    id.includes("_blocked") ||
    id.includes("_immune") ||
    id.includes("wants_")
  ) {
    return "attribute";
  }

  return "complex";
}

/**
 * Get the fill color for a component icon based on its category
 */
export function getComponentColor(componentId: string): string {
  const iconType = getIconType(componentId);

  switch (iconType) {
    case "movement":
      return ICON_COLORS.movement;
    case "combat":
      return ICON_COLORS.combat;
    case "health":
      return ICON_COLORS.health;
    case "sensor":
      return ICON_COLORS.sensor;
    case "interact":
      return ICON_COLORS.interact;
    case "sound":
      return ICON_COLORS.sound;
    case "spawn":
      return ICON_COLORS.spawn;
    case "behavior":
      return ICON_COLORS.behavior;
    case "trigger":
      return ICON_COLORS.trigger;
    case "attribute":
      return ICON_COLORS.attribute;
    default:
      return ICON_COLORS.complex;
  }
}

/**
 * Get a CSS class name for the component category (used for theming)
 */
export function getComponentCategoryClass(componentId: string): string {
  return `component-${getIconType(componentId)}`;
}

/**
 * Fallback inline SVG icon (puzzle piece) for when external icon fails to load
 */
function renderFallbackIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="4" height="8" fill={color} />
      <rect x="6" y="2" width="4" height="4" fill={color} />
      <rect x="6" y="6" width="8" height="4" fill={color} />
      <rect x="6" y="10" width="4" height="4" fill={color} />
      <rect x="10" y="4" width="2" height="2" fill={color} />
      <rect x="10" y="10" width="2" height="2" fill={color} />
    </svg>
  );
}

/**
 * ComponentIcon component
 * Loads and displays an SVG icon for a Minecraft entity component.
 * Falls back to an inline icon if the external SVG fails to load.
 */
export default function ComponentIcon({ componentId, size = 16, className }: IComponentIconProps): JSX.Element {
  const color = getComponentColor(componentId);
  const filename = componentIdToFilename(componentId);
  const iconUrl = CreatorToolsHost.contentWebRoot + `res/icons/components/${filename}`;

  const [hasError, setHasError] = React.useState(false);

  // Reset error state when componentId changes
  React.useEffect(() => {
    setHasError(false);
  }, [componentId]);

  const iconType = getIconType(componentId);

  if (hasError) {
    // Show fallback inline icon if external SVG failed
    return (
      <span
        className={`component-icon component-icon-${iconType} ${className || ""}`}
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        {renderFallbackIcon(size, color)}
      </span>
    );
  }

  return (
    <span
      className={`component-icon component-icon-${iconType} ${className || ""}`}
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
        onError={() => setHasError(true)}
        style={{
          display: "block",
          imageRendering: "pixelated", // Keep crisp blocky pixels
        }}
      />
    </span>
  );
}

// Export the icon type getter for use in styling
export { getIconType };

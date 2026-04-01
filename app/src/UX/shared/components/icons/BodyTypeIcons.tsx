// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * BodyTypeIcons - SVG icons for entity body types in the Content Wizard.
 *
 * These icons are simple, recognizable silhouettes that represent different
 * entity body types (humanoid, quadruped, flying, etc.) for the Content Wizard UI.
 *
 * Each icon is designed to be rendered at 20x20 pixels and uses currentColor
 * for fill, making them adaptable to different themes.
 */

import React from "react";

// ============================================================================
// SVG ICON COMPONENTS
// ============================================================================

/**
 * Humanoid body type icon - two-legged, stands upright.
 */
export const HumanoidIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <circle cx="12" cy="4" r="2.5" />
    <rect x="10" y="7" width="4" height="7" rx="1" />
    <rect x="6" y="8" width="3" height="5" rx="1" transform="rotate(-15 7.5 10.5)" />
    <rect x="15" y="8" width="3" height="5" rx="1" transform="rotate(15 16.5 10.5)" />
    <rect x="9" y="14" width="2.5" height="6" rx="1" />
    <rect x="12.5" y="14" width="2.5" height="6" rx="1" />
  </svg>
);

/**
 * Quadruped body type icon - large four-legged animal.
 */
export const QuadrupedIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <ellipse cx="12" cy="10" rx="6" ry="4" />
    <circle cx="18" cy="8" r="2.5" />
    <rect x="7" y="12" width="2" height="5" rx="0.5" />
    <rect x="10" y="12" width="2" height="5" rx="0.5" />
    <rect x="13" y="12" width="2" height="5" rx="0.5" />
    <rect x="16" y="12" width="2" height="5" rx="0.5" />
    <path d="M19 9 L22 8 L22 9 L19 10 Z" />
  </svg>
);

/**
 * Small quadruped body type icon - small four-legged animal.
 */
export const QuadrupedSmallIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <ellipse cx="12" cy="12" rx="4" ry="2.5" />
    <circle cx="16" cy="11" r="2" />
    <rect x="9" y="13.5" width="1.5" height="3" rx="0.5" />
    <rect x="11" y="13.5" width="1.5" height="3" rx="0.5" />
    <rect x="13" y="13.5" width="1.5" height="3" rx="0.5" />
    <rect x="15" y="13.5" width="1.5" height="3" rx="0.5" />
    <circle cx="17.5" cy="10" r="0.8" />
    <circle cx="15.5" cy="10" r="0.8" />
  </svg>
);

/**
 * Flying body type icon - winged creature.
 */
export const FlyingIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <ellipse cx="12" cy="12" rx="3" ry="2" />
    <circle cx="16" cy="11" r="1.5" />
    <path d="M9 10 C4 6, 4 10, 6 12 C4 14, 4 18, 9 14 Z" />
    <path d="M15 10 C20 6, 20 10, 18 12 C20 14, 20 18, 15 14 Z" />
    <path d="M9 12 L7 14 L8 14 L10 12 Z" />
  </svg>
);

/**
 * Aquatic body type icon - swims in water.
 */
export const AquaticIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <ellipse cx="12" cy="12" rx="7" ry="3" />
    <path d="M19 12 L23 9 L23 15 Z" />
    <path d="M12 9 L14 6 L14 9 Z" />
    <circle cx="7" cy="11" r="1" />
    <path d="M5 12 C4 11, 4 13, 5 12" strokeWidth="1" />
  </svg>
);

/**
 * Slime/blob body type icon - bouncy cube-shaped body.
 */
export const SlimeIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <rect x="6" y="8" width="12" height="10" rx="2" />
    <circle cx="9" cy="12" r="1.5" fill="white" />
    <circle cx="15" cy="12" r="1.5" fill="white" />
    <circle cx="9" cy="12" r="0.8" />
    <circle cx="15" cy="12" r="0.8" />
    <rect x="10" y="15" width="4" height="1.5" rx="0.5" fill="white" />
  </svg>
);

// ============================================================================
// ICON MAPPING
// ============================================================================

/**
 * Maps body type IDs to their corresponding icon components.
 */
export const BodyTypeIconMap: Record<string, React.FC> = {
  humanoid: HumanoidIcon,
  quadruped: QuadrupedIcon,
  quadruped_small: QuadrupedSmallIcon,
  flying: FlyingIcon,
  aquatic: AquaticIcon,
  slime: SlimeIcon,
};

/**
 * Get the icon component for a given body type ID.
 * Returns undefined if the body type is not found.
 */
export function getBodyTypeIcon(bodyTypeId: string): React.FC | undefined {
  return BodyTypeIconMap[bodyTypeId];
}

/**
 * Render the icon for a given body type ID.
 * Returns null if the body type is not found.
 */
export function renderBodyTypeIcon(bodyTypeId: string): JSX.Element | null {
  const IconComponent = BodyTypeIconMap[bodyTypeId];
  if (!IconComponent) {
    return null;
  }
  return <IconComponent />;
}

// ============================================================================
// BODY TYPE DEFINITIONS
// ============================================================================

export interface IBodyTypeInfo {
  id: string;
  label: string;
  description: string;
}

/**
 * Body type metadata without icon references.
 * Use with renderBodyTypeIcon() to get the icon.
 */
export const BODY_TYPES: IBodyTypeInfo[] = [
  {
    id: "humanoid",
    label: "Humanoid",
    description: "Two-legged, stands upright",
  },
  {
    id: "quadruped",
    label: "Four-legged",
    description: "Large four-legged animal",
  },
  {
    id: "quadruped_small",
    label: "Four-legged (Small)",
    description: "Small four-legged animal",
  },
  {
    id: "flying",
    label: "Flying",
    description: "Winged, flies through the air",
  },
  {
    id: "aquatic",
    label: "Aquatic",
    description: "Swims in water",
  },
  {
    id: "slime",
    label: "Blob",
    description: "Bouncy cube-shaped body",
  },
];

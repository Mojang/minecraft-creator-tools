/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE TYPE ICON - SVG Icons for Minecraft Feature Types
   
   Provides unique color-coded SVG icons for each Minecraft feature type.
   Icons are loaded from external SVG files in /public/res/icons/features/.
   Falls back to inline rendering if external load fails.
   
   Categories (color-coded):
   - Composite (purple): aggregate, sequence, weighted_random, scatter
   - Placement (cyan): search, snap_to_surface, scan_surface, rect_layout
   - Block (brown): single_block, ore, multiface, partially_exposed_blob
   - Vegetation (green): tree, growing_plant, vegetation_patch, sculk_patch
   - Structure (blue): structure_template, fossil, geode
   - Cave (dark gray): cave_carver, underwater_cave_carver, nether_cave_carver   
  
   ═══════════════════════════════════════════════════════════════════════════ */

import React from "react";

export interface IFeatureTypeIconProps {
  featureType: string;
  size?: number;
  className?: string;
}

// Color palette for feature type categories
export const FEATURE_COLORS = {
  composite: "#9b6bc9", // Purple - combines/sequences features
  placement: "#6bc9c9", // Cyan - placement control
  block: "#a67c52", // Brown - block placement
  vegetation: "#52a535", // Green - plants/trees
  structure: "#4a9fd4", // Blue - structures/templates
  cave: "#6b6b6b", // Gray - cave carving
  unknown: "#888888", // Gray fallback
};

/**
 * Get the category for a feature type
 */
export function getFeatureCategory(featureType: string): string {
  const type = featureType.toLowerCase();

  // Composite features
  if (
    type.includes("aggregate") ||
    type.includes("sequence") ||
    type.includes("weighted_random") ||
    type.includes("scatter") ||
    type.includes("conditional_list")
  ) {
    return "composite";
  }

  // Placement features
  if (
    type.includes("search") ||
    type.includes("snap_to_surface") ||
    type.includes("scan_surface") ||
    type.includes("rect_layout") ||
    type.includes("surface_relative")
  ) {
    return "placement";
  }

  // Block-based features
  if (
    type.includes("single_block") ||
    type.includes("ore") ||
    type.includes("multiface") ||
    type.includes("blob") ||
    type.includes("beards_and_shavers")
  ) {
    return "block";
  }

  // Vegetation features
  if (
    type.includes("tree") ||
    type.includes("growing_plant") ||
    type.includes("vegetation") ||
    type.includes("sculk") ||
    type.includes("flower")
  ) {
    return "vegetation";
  }

  // Structure features
  if (type.includes("structure_template") || type.includes("fossil") || type.includes("geode")) {
    return "structure";
  }

  // Cave features
  if (type.includes("cave") || type.includes("carver") || type.includes("dripstone")) {
    return "cave";
  }

  return "unknown";
}

/**
 * Get the color for a feature type
 */
export function getFeatureColor(featureType: string): string {
  const category = getFeatureCategory(featureType);
  return FEATURE_COLORS[category as keyof typeof FEATURE_COLORS] || FEATURE_COLORS.unknown;
}

/**
 * Convert feature type to icon filename
 * e.g., "minecraft:tree_feature" -> "tree"
 */
function featureTypeToFilename(featureType: string): string {
  return featureType
    .replace(/^minecraft:/, "")
    .replace(/_feature$/, "")
    .toLowerCase();
}

/**
 * Get the icon URL for a feature type
 */
function getIconUrl(featureType: string): string {
  const filename = featureTypeToFilename(featureType);
  return `/res/icons/features/${filename}.svg`;
}

/**
 * Get the category fallback icon URL
 */
function getCategoryIconUrl(category: string): string {
  return `/res/icons/features/category_${category}.svg`;
}

// ═══════════════════════════════════════════════════════════════════════════
// FALLBACK INLINE ICONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Render icon for composite features (layered squares)
 */
function renderCompositeIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="5" width="6" height="6" fill={color} opacity="0.5" />
      <rect x="5" y="3" width="6" height="6" fill={color} opacity="0.7" />
      <rect x="9" y="7" width="6" height="6" fill={color} />
    </svg>
  );
}

/**
 * Render icon for placement features (crosshair/target)
 */
function renderPlacementIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="7" y="1" width="2" height="5" fill={color} />
      <rect x="7" y="10" width="2" height="5" fill={color} />
      <rect x="1" y="7" width="5" height="2" fill={color} />
      <rect x="10" y="7" width="5" height="2" fill={color} />
      <rect x="6" y="6" width="4" height="4" fill={color} opacity="0.5" />
    </svg>
  );
}

/**
 * Render icon for block features (3D cube)
 */
function renderBlockIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Top face */}
      <polygon points="8,2 14,5 8,8 2,5" fill={color} />
      {/* Left face */}
      <polygon points="2,5 8,8 8,14 2,11" fill={color} opacity="0.7" />
      {/* Right face */}
      <polygon points="14,5 14,11 8,14 8,8" fill={color} opacity="0.5" />
    </svg>
  );
}

/**
 * Render icon for vegetation features (tree)
 */
function renderVegetationIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Trunk */}
      <rect x="7" y="10" width="2" height="5" fill="#8B4513" />
      {/* Leaves - triangular tree shape */}
      <polygon points="8,1 13,6 11,6 14,10 2,10 5,6 3,6" fill={color} />
    </svg>
  );
}

/**
 * Render icon for structure features (building/temple)
 */
function renderStructureIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Roof */}
      <polygon points="8,1 15,6 1,6" fill={color} />
      {/* Pillars */}
      <rect x="2" y="6" width="2" height="8" fill={color} opacity="0.8" />
      <rect x="7" y="6" width="2" height="8" fill={color} opacity="0.8" />
      <rect x="12" y="6" width="2" height="8" fill={color} opacity="0.8" />
      {/* Base */}
      <rect x="1" y="13" width="14" height="2" fill={color} />
    </svg>
  );
}

/**
 * Render icon for cave features (cave opening)
 */
function renderCaveIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cave background (dark) */}
      <ellipse cx="8" cy="10" rx="6" ry="5" fill="#2a2a2a" />
      {/* Cave opening highlight */}
      <ellipse cx="8" cy="10" rx="4" ry="3" fill="#1a1a1a" />
      {/* Rock frame */}
      <path d="M1,8 Q0,12 2,15 L14,15 Q16,12 15,8 Q13,4 8,3 Q3,4 1,8 Z" fill="none" stroke={color} strokeWidth="2" />
      {/* Stalactites */}
      <polygon points="5,6 6,9 4,9" fill={color} />
      <polygon points="10,5 11,8 9,8" fill={color} />
    </svg>
  );
}

/**
 * Render unknown/fallback icon (question mark)
 */
function renderUnknownIcon(size: number, color: string): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="12" height="12" rx="2" fill={color} opacity="0.3" />
      <text x="8" y="12" textAnchor="middle" fontSize="10" fill={color} fontWeight="bold">
        ?
      </text>
    </svg>
  );
}

/**
 * Render fallback icon based on category
 */
function renderFallbackIcon(featureType: string, size: number): JSX.Element {
  const color = getFeatureColor(featureType);
  const category = getFeatureCategory(featureType);

  switch (category) {
    case "composite":
      return renderCompositeIcon(size, color);
    case "placement":
      return renderPlacementIcon(size, color);
    case "block":
      return renderBlockIcon(size, color);
    case "vegetation":
      return renderVegetationIcon(size, color);
    case "structure":
      return renderStructureIcon(size, color);
    case "cave":
      return renderCaveIcon(size, color);
    default:
      return renderUnknownIcon(size, color);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * FeatureTypeIcon component
 * Displays a color-coded SVG icon for a Minecraft feature type.
 * Loads external SVG files from /res/icons/features/ with inline fallback.
 */
export default function FeatureTypeIcon({ featureType, size = 16, className }: IFeatureTypeIconProps): JSX.Element {
  const [hasError, setHasError] = React.useState(false);
  const [hasCategoryError, setHasCategoryError] = React.useState(false);

  const category = getFeatureCategory(featureType);
  const iconUrl = getIconUrl(featureType);
  const categoryIconUrl = getCategoryIconUrl(category);

  // Reset error state when feature type changes
  React.useEffect(() => {
    setHasError(false);
    setHasCategoryError(false);
  }, [featureType]);

  const containerStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    width: size,
    height: size,
  };

  const imgStyle: React.CSSProperties = {
    width: size,
    height: size,
  };

  // If both external loads failed, use inline fallback
  if (hasError && hasCategoryError) {
    return (
      <span className={`feature-type-icon feature-type-icon-${category} ${className || ""}`} style={containerStyle}>
        {renderFallbackIcon(featureType, size)}
      </span>
    );
  }

  // If specific feature icon failed, try category icon
  if (hasError) {
    return (
      <span className={`feature-type-icon feature-type-icon-${category} ${className || ""}`} style={containerStyle}>
        <img
          src={categoryIconUrl}
          alt={`${category} feature icon`}
          style={imgStyle}
          onError={() => setHasCategoryError(true)}
        />
      </span>
    );
  }

  // Try to load specific feature icon first
  return (
    <span className={`feature-type-icon feature-type-icon-${category} ${className || ""}`} style={containerStyle}>
      <img src={iconUrl} alt={`${featureType} icon`} style={imgStyle} onError={() => setHasError(true)} />
    </span>
  );
}

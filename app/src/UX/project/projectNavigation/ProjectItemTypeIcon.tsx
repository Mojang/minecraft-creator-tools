// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* ═══════════════════════════════════════════════════════════════════════════
   PROJECT ITEM TYPE ICON - SVG Icon Component for Project Item Types
   
   Renders SVG icons for project item types by loading external SVG files
   from /res/icons/itemtypes/. Icons use the Minecraft-themed color system
   defined in ProjectItemTypeInfo.ts.
   
   Usage:
     <ProjectItemTypeIcon itemType={ProjectItemType.entityTypeBehavior} size={16} />
   
   Icons are cached after first load for performance.
   
   See: src/app/ProjectItemTypeIconMap.ts for icon file mappings
   See: src/app/ProjectItemTypeInfo.ts for colors
   ═══════════════════════════════════════════════════════════════════════════ */

import React from "react";
import { ProjectItemType } from "../../../app/IProjectItemData";
import {
  getHexColorForProjectItemType,
  getProjectItemTypeGroup,
  ProjectItemTypeGroup,
  ProjectItemTypeGroupColors,
} from "../../../app/ProjectItemTypeInfo";
import { getIconPathForProjectItemType, getIconPathForProjectItemTypeGroup } from "../../../app/ProjectItemTypeIconMap";
import "./ProjectItemTypeIcon.css";

export interface IProjectItemTypeIconProps {
  itemType: ProjectItemType;
  size?: number;
  className?: string;
  /**
   * If true, uses a lighter/more transparent version of the color.
   * Good for backgrounds or less prominent contexts.
   */
  subtle?: boolean;
  /**
   * Custom color override. If provided, uses this instead of the semantic color.
   */
  color?: string;
  /**
   * If true, adds a subtle background circle behind the icon.
   */
  showBackground?: boolean;
}

/**
 * ProjectItemTypeIcon component
 * Renders an SVG icon for a Minecraft project item type.
 * Colors are based on the semantic category of the item type.
 */
export default function ProjectItemTypeIcon({
  itemType,
  size = 16,
  className,
  subtle = false,
  color,
  showBackground = false,
}: IProjectItemTypeIconProps): JSX.Element {
  const group = getProjectItemTypeGroup(itemType);
  const iconPath = getIconPathForProjectItemType(itemType);

  // Determine fill color
  const fillColor = color || getHexColorForProjectItemType(itemType);

  // Apply subtle opacity if needed
  const opacity = subtle ? 0.6 : 1;

  // Background circle for showBackground mode
  const backgroundStyle: React.CSSProperties = showBackground
    ? {
        backgroundColor: `${fillColor}22`,
        borderRadius: "2px",
        padding: "2px",
      }
    : {};

  // Use CSS mask-image to colorize the SVG
  // The SVG acts as a mask, and background-color provides the fill
  const iconStyle: React.CSSProperties = {
    display: "block",
    width: size,
    height: size,
    backgroundColor: fillColor,
    opacity: opacity,
    WebkitMaskImage: `url(${iconPath})`,
    WebkitMaskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskImage: `url(${iconPath})`,
    maskSize: "contain",
    maskRepeat: "no-repeat",
    maskPosition: "center",
  };

  return (
    <span
      className={`piti-icon piti-icon-${group} ${className || ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size + (showBackground ? 4 : 0),
        height: size + (showBackground ? 4 : 0),
        ...backgroundStyle,
      }}
    >
      <span style={iconStyle} />
    </span>
  );
}

/**
 * ProjectItemTypeGroupIcon component
 * Renders an SVG icon for a project item type group (category).
 */
export function ProjectItemTypeGroupIcon({
  group,
  size = 16,
  className,
  subtle = false,
  color,
}: {
  group: ProjectItemTypeGroup;
  size?: number;
  className?: string;
  subtle?: boolean;
  color?: string;
}): JSX.Element {
  const iconPath = getIconPathForProjectItemTypeGroup(group);

  const groupColor = ProjectItemTypeGroupColors[group];

  // Determine fill color
  const fillColor = color
    ? color
    : `#${groupColor.red.toString(16).padStart(2, "0")}${groupColor.green
        .toString(16)
        .padStart(2, "0")}${groupColor.blue.toString(16).padStart(2, "0")}`;

  const opacity = subtle ? 0.6 : 1;

  // Use CSS mask-image to colorize the SVG
  const iconStyle: React.CSSProperties = {
    display: "block",
    width: size,
    height: size,
    backgroundColor: fillColor,
    opacity: opacity,
    WebkitMaskImage: `url(${iconPath})`,
    WebkitMaskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskImage: `url(${iconPath})`,
    maskSize: "contain",
    maskRepeat: "no-repeat",
    maskPosition: "center",
  };

  return (
    <span
      className={`piti-icon piti-group-icon piti-icon-${group} ${className || ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
      }}
    >
      <span style={iconStyle} />
    </span>
  );
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* ═══════════════════════════════════════════════════════════════════════════
   EDITOR HEADER COMPONENT - Minecraft "Chip" Style
   
   A reusable header component for typed editors (Entity, Block, Item, etc.)
   styled as a chunky Minecraft-style outset "chip" with pixelated bevels.
   
   Features:
   - Minecraft stone button aesthetic with pixelated corners
   - Type-tinted stone coloring (subtle hue from ProjectItemTypeInfo)
   - Light on top/left edges, shadow on bottom/right (outset 3D effect)
   - Unified chip wraps header bar AND tabs area
   
   Usage:
     <EditorHeaderChip itemType={ProjectItemType.entityTypeBehavior} theme={theme}>
       <EditorHeaderBar itemId="minecraft:zombie" typeName="Entity Type" />
       <EditorHeaderTabs>
         ... tabs content ...
       </EditorHeaderTabs>
     </EditorHeaderChip>
   
   Or use the simpler single-row header:
     <EditorHeader
       itemId="minecraft:zombie"
       itemType={ProjectItemType.entityTypeBehavior}
       typeName="Entity Type"
       theme={theme}
     />
   
   See: docs/EditorHeaderStyleGuide.md
   ═══════════════════════════════════════════════════════════════════════════ */

import React from "react";
import { ProjectItemType } from "../../app/IProjectItemData";
import ProjectItemUtilities from "../../app/ProjectItemUtilities";
import ColorUtilities from "../../core/ColorUtilities";
import IColor from "../../core/IColor";
import ProjectItemTypeIcon from "../project/projectNavigation/ProjectItemTypeIcon";
import "./EditorHeader.css";
import IProjectTheme from "../types/IProjectTheme";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";

// Pixel size for Minecraft-style bevels (2px looks best at most resolutions)
const PX = 2;

/**
 * Generates a stone color palette tinted by the type color.
 * The tint is subtle - primarily gray with a hint of the type hue.
 * Uses a lighter base stone in light mode for better contrast.
 */
function getStoneColors(typeColor: IColor) {
  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

  // Base stone colors - lighter in light mode
  const baseStone: IColor = isDark
    ? { red: 107, green: 107, blue: 107, alpha: 1 } // #6b6b6b dark mode
    : { red: 160, green: 160, blue: 160, alpha: 1 }; // #a0a0a0 light mode

  // Blend type color into stone (10% type color, 90% stone)
  const tintAmount = 0.12;
  const tintedStone: IColor = {
    red: Math.round(baseStone.red * (1 - tintAmount) + typeColor.red * tintAmount),
    green: Math.round(baseStone.green * (1 - tintAmount) + typeColor.green * tintAmount),
    blue: Math.round(baseStone.blue * (1 - tintAmount) + typeColor.blue * tintAmount),
    alpha: 1,
  };

  return {
    border: ColorUtilities.darker(tintedStone, 0.45), // Outer border (darkest)
    highlight: ColorUtilities.lighter(tintedStone, 0.25), // Top/left inner edge (lightest)
    main: tintedStone, // Main face background
    shadow: ColorUtilities.darker(tintedStone, 0.25), // Bottom/right inner edge
    corner: ColorUtilities.darker(tintedStone, 0.1), // Corner pixel blend
    text: { red: 255, green: 255, blue: 255, alpha: 1 }, // White text
    typeAccent: typeColor, // For subtle accents
  };
}

/* =============================================================================
   EditorHeaderChip - The main container with Minecraft bevel
   ============================================================================= */

export interface IEditorHeaderChipProps {
  /** The project item type for color theming */
  itemType: ProjectItemType;
  /** Theme for styling */
  theme: IProjectTheme;
  /** Children (EditorHeaderBar and/or EditorHeaderTabs) */
  children: React.ReactNode;
}

/**
 * A Minecraft-style "chip" container with pixelated beveled edges.
 * Wraps the header bar and tabs in a unified stone-like container.
 */
export const EditorHeaderChip: React.FC<IEditorHeaderChipProps> = (props) => {
  const typeColor = ProjectItemUtilities.getColorForType(props.itemType);
  const colors = getStoneColors(typeColor);

  // Pass colors down via CSS custom properties
  const chipStyle: React.CSSProperties = {
    "--chip-border": ColorUtilities.toCss(colors.border),
    "--chip-highlight": ColorUtilities.toCss(colors.highlight),
    "--chip-main": ColorUtilities.toCss(colors.main),
    "--chip-shadow": ColorUtilities.toCss(colors.shadow),
    "--chip-corner": ColorUtilities.toCss(colors.corner),
    "--chip-text": ColorUtilities.toCss(colors.text),
    "--type-color": ColorUtilities.toCss(colors.typeAccent),
    "--type-color-light": ColorUtilities.toCss(ColorUtilities.lighter(typeColor, 0.3)),
  } as React.CSSProperties;

  return (
    <div className="editor-header-chip" style={chipStyle}>
      {/* 3x3 grid for pixelated corners */}
      <div className="chip-grid">
        {/* Row 1: Top edge */}
        <div className="chip-corner-tl" />
        <div className="chip-edge-top" />
        <div className="chip-corner-tr" />

        {/* Row 2: Content area */}
        <div className="chip-edge-left" />
        <div className="chip-content">{props.children}</div>
        <div className="chip-edge-right" />

        {/* Row 3: Bottom edge */}
        <div className="chip-corner-bl" />
        <div className="chip-edge-bottom" />
        <div className="chip-corner-br" />
      </div>
    </div>
  );
};

/* =============================================================================
   EditorHeaderBar - The title row inside the chip
   ============================================================================= */

export interface IEditorHeaderBarProps {
  /** The item identifier to display (e.g., "minecraft:zombie") */
  itemId: string;
  /** The project item type for icon */
  itemType: ProjectItemType;
  /** Optional display name shown as the primary title (identifier shown smaller underneath) */
  displayName?: string;
  /** Optional type name to show in badge (e.g., "Entity Type") */
  typeName?: string;
  /** Optional format_version string (e.g., "1.21.0") */
  formatVersion?: string;
  /** Optional thumbnail data URL to display next to the title */
  thumbnailUrl?: string;
  /** Optional children for additional header content */
  children?: React.ReactNode;
}

/**
 * The title bar row inside EditorHeaderChip.
 * Contains icon, title, and optional badge.
 */
export const EditorHeaderBar: React.FC<IEditorHeaderBarProps> = (props) => {
  return (
    <div className="editor-header-bar">
      {props.thumbnailUrl ? (
        <img src={props.thumbnailUrl} alt="" className="editor-header-thumbnail" />
      ) : (
        <span className="editor-header-icon">
          <ProjectItemTypeIcon itemType={props.itemType} size={20} color="currentColor" />
        </span>
      )}
      {props.displayName ? (
        <span className="editor-header-title-group">
          <span className="editor-header-title">{props.displayName}</span>
          <span className="editor-header-subtitle" style={{ fontSize: "0.85em", opacity: 0.6, marginLeft: "8px" }}>
            ({props.itemId})
          </span>
        </span>
      ) : (
        <span className="editor-header-title">{props.itemId}</span>
      )}
      {props.typeName && <span className="editor-header-badge">{props.typeName}</span>}
      {props.formatVersion && (
        <span className="editor-header-format-version" title="Minecraft format version this content uses">
          v{props.formatVersion}
        </span>
      )}
      {props.children}
    </div>
  );
};

/* =============================================================================
   EditorHeaderTabs - Container for tabs inside the chip
   ============================================================================= */

export interface IEditorHeaderTabsProps {
  /** Tab content (typically a Toolbar with tab items) */
  children: React.ReactNode;
}

/**
 * Container for tabs inside EditorHeaderChip.
 * Provides consistent styling and spacing.
 */
export const EditorHeaderTabs: React.FC<IEditorHeaderTabsProps> = (props) => {
  return <div className="editor-header-tabs-container">{props.children}</div>;
};

/* =============================================================================
   EditorHeader - Simple single-row header (backwards compatible)
   ============================================================================= */

export interface IEditorHeaderProps {
  /** The item identifier to display (e.g., "minecraft:zombie") */
  itemId: string;
  /** The project item type for color theming */
  itemType: ProjectItemType;
  /** Optional type name to show in badge (e.g., "Entity Type") */
  typeName?: string;
  /** Theme for styling */
  theme: IProjectTheme;
  /** Optional children for additional header content */
  children?: React.ReactNode;
}

/**
 * Simple single-row Minecraft chip header.
 * For editors that don't need tabs, this provides a complete header.
 */
export const EditorHeader: React.FC<IEditorHeaderProps> = (props) => {
  return (
    <EditorHeaderChip itemType={props.itemType} theme={props.theme}>
      <EditorHeaderBar itemId={props.itemId} itemType={props.itemType} typeName={props.typeName}>
        {props.children}
      </EditorHeaderBar>
    </EditorHeaderChip>
  );
};

/* =============================================================================
   EditorHeaderDivider - DEPRECATED (chip style replaces this)
   Kept for backwards compatibility but the chip style doesn't need it
   ============================================================================= */

export interface IEditorHeaderDividerProps {
  /** The project item type for color theming */
  itemType: ProjectItemType;
  /** Divider style variant */
  variant?: "block-edge" | "ore-scatter" | "inventory" | "pixel-dots" | "simple";
}

/**
 * @deprecated The EditorHeaderChip style includes built-in beveled edges.
 * This component is kept for backwards compatibility.
 */
export const EditorHeaderDivider: React.FC<IEditorHeaderDividerProps> = (props) => {
  // Return an empty spacer - the chip bevel replaces the divider
  return <div className="editor-header-divider-spacer" />;
};

export default EditorHeader;

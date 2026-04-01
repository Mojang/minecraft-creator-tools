/* ═══════════════════════════════════════════════════════════════════════════
   EDITOR CONTENT PANEL - Minecraft Creator Tools
   
   ARCHITECTURE OVERVIEW:
   This component provides simple, theme-aware panels for content areas below
   the EditorHeader chip. The design is intentionally minimalist - the header
   chip provides the Minecraft aesthetic, while content panels remain clean
   and functional.
   
   PANEL TYPES:
   - "inset": Sidebar panel - slightly different background for hierarchy
   - "raised": Main content panel - primary background
   - "flat": Simple bordered panel
   
   VISUAL DESIGN:
   Panels use subtle background differences and borders to create hierarchy,
   NOT heavy beveling. The result is clean and works well in both light and
   dark mode.
   
   RELATED FILES:
   - EditorHeader.tsx: Header chip that sits above these panels (has beveling)
   - EntityTypeEditor.tsx: Uses these panels for component groups
   - EntityTypeComponentSetEditor.tsx: Uses these for component lists
   
   ═══════════════════════════════════════════════════════════════════════════ */

import React from "react";
import { ProjectItemType } from "../../app/IProjectItemData";
import "./EditorContentPanel.css";
import IProjectTheme from "../types/IProjectTheme";
import { isDarkMode } from "../hooks/theme/useThemeColors";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type PanelVariant = "inset" | "raised" | "flat";

interface IEditorContentPanelProps {
  /** The variant determines the visual treatment */
  variant: PanelVariant;
  /** Optional item type (not currently used, but kept for future tinting) */
  itemType?: ProjectItemType;
  /** Theme for color scheme access */
  theme: IProjectTheme;
  /** Optional header text */
  header?: string;
  /** Optional tooltip for the header */
  title?: string;
  /** Panel content */
  children: React.ReactNode;
  /** Optional className for additional styling */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Whether to use compact header (smaller font, less padding) */
  compactHeader?: boolean;
}

interface IEditorPanelGridProps {
  /** Theme for color scheme access */
  theme: IProjectTheme;
  /** Optional item type (not currently used, but kept for future tinting) */
  itemType?: ProjectItemType;
  /** Panel content (should be EditorContentPanel children) */
  children: React.ReactNode;
  /** Optional className */
  className?: string;
  /** Grid template columns (CSS value) */
  columns?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// THEME UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates simple theme-aware panel colors.
 * Light mode: white/light-gray backgrounds
 * Dark mode: dark-gray backgrounds
 */
function getPanelColors(theme: IProjectTheme, variant: PanelVariant) {
  const dark = isDarkMode();

  if (dark) {
    // Dark mode colors
    const sidebarBg = "#2d2d2d"; // Dark mode fallback: slightly lighter for sidebar
    const mainBg = "#252525"; // Dark mode fallback: standard dark
    const divider = "rgba(255, 255, 255, 0.06)";
    const border = "rgba(255, 255, 255, 0.08)";
    const headerText = "#888888"; // Dark mode fallback: muted header text

    return {
      "--panel-bg": variant === "inset" ? sidebarBg : mainBg,
      "--panel-divider": divider,
      "--panel-border": border,
      "--panel-header-text": headerText,
    };
  } else {
    // Light mode colors
    const sidebarBg = "#f0f0f0"; // Light mode fallback: light gray for sidebar
    const mainBg = "#fafafa"; // Light mode fallback: near-white for main
    const divider = "rgba(0, 0, 0, 0.06)";
    const border = "rgba(0, 0, 0, 0.08)";
    const headerText = "#707070";

    return {
      "--panel-bg": variant === "inset" ? sidebarBg : mainBg,
      "--panel-divider": divider,
      "--panel-border": border,
      "--panel-header-text": headerText,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR CONTENT PANEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EditorContentPanel - A simple, theme-aware panel for editor content areas.
 *
 * Use "inset" variant for sidebars and lists.
 * Use "raised" variant for main content areas.
 * Use "flat" variant for simple bordered containers.
 */
export function EditorContentPanel({
  variant,
  itemType,
  theme,
  header,
  title,
  children,
  className = "",
  style = {},
  compactHeader = false,
}: IEditorContentPanelProps) {
  const panelColors = getPanelColors(theme, variant);
  const cssVars = panelColors as React.CSSProperties;

  return (
    <div className={`editor-content-panel editor-panel-${variant} ${className}`} style={{ ...cssVars, ...style }}>
      {header && (
        <div className={`editor-panel-header ${compactHeader ? "editor-panel-header-compact" : ""}`} title={title}>{header}</div>
      )}
      <div className="editor-panel-content">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR PANEL GRID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EditorPanelGrid - A grid container for laying out multiple panels.
 *
 * This provides consistent spacing between panels.
 */
export function EditorPanelGrid({
  theme,
  itemType,
  children,
  className = "",
  columns = "220px 1fr",
}: IEditorPanelGridProps) {
  const panelColors = getPanelColors(theme, "flat");
  const cssVars = {
    ...panelColors,
    "--grid-columns": columns,
  } as React.CSSProperties;

  return (
    <div className={`editor-panel-grid ${className}`} style={cssVars}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL HEADER (standalone, for use inside panels)
// ─────────────────────────────────────────────────────────────────────────────

interface IEditorPanelSectionHeaderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * EditorPanelSectionHeader - A section header inside a panel.
 *
 * Use this for category headers within a list panel.
 */
export function EditorPanelSectionHeader({ children, className = "" }: IEditorPanelSectionHeaderProps) {
  return <div className={`editor-panel-section-header ${className}`}>{children}</div>;
}

export default EditorContentPanel;

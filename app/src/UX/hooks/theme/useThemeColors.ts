/**
 * Theme Color Utilities
 *
 * ARCHITECTURE: Canonical Theme Color Access
 *
 * This module provides the standard way to access theme colors in the application.
 * It uses CreatorToolsHost.theme to determine dark/light mode, and returns a
 * ThemeColors object whose property names match IProjectTheme (background1,
 * foreground1, mc0, etc.).
 *
 * Usage:
 * ```tsx
 * import { getThemeColors, isDarkMode } from "./useThemeColors";
 *
 * const colors = getThemeColors();
 * style={{ backgroundColor: colors.background1, color: colors.foreground1 }}
 *
 * // Or for simple dark/light branching:
 * import { getThemedColor } from "./useThemeColors";
 * const bg = getThemedColor("#1a1a1a", "#ffffff");
 * ```
 */

import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import { mcColors } from "./mcColors";

/**
 * Theme colors interface - property names match IProjectTheme for consistency.
 */
export interface ThemeColors {
  // Backgrounds - ordered from darkest (1) to lightest (6) in dark mode
  background: string; // accent background (green)
  background1: string; // main outermost background
  background2: string; // complement background
  background3: string; // tertiary background
  background4: string; // quaternary background
  background5: string; // subtle accent background
  background6: string; // subtle theme background

  // Foregrounds - ordered from lightest (1) to darkest (6) in dark mode
  foreground: string; // accent foreground (green)
  foreground1: string; // main foreground
  foreground2: string; // complement foreground
  foreground3: string; // tertiary foreground
  foreground4: string; // quaternary foreground (button text)
  foreground5: string; // warning/alert color
  foreground6: string; // subtle foreground

  // Hover states
  backgroundHover: string;
  backgroundHover1: string;
  backgroundHover2: string;
  backgroundHover3: string;

  // Active states
  backgroundActive: string;
  backgroundActive1: string;
  foregroundActive: string;
  foregroundActive1: string;

  // Minecraft button bevel colors (for 3D button effects)
  mc0: string; // Border color
  mc1: string; // Shadow/dark edge
  mc2: string; // Mid shadow
  mc3: string; // Light edge
  mc4: string; // Button face
  mc5: string; // Highlight
  mcc1: string; // Button text color

  // ── Semantic colors ────────────────────────────────────────────
  // These provide meaningful names for the most common theme-dependent
  // patterns so that components can use `colors.sectionBorder` instead of
  // scattering `isDark ? mcColors.gray3 : mcColors.gray5` everywhere.

  /** Section / panel border color (gray3 / gray5) */
  sectionBorder: string;

  /** Section header / title-bar background (gray2 / gray6) */
  sectionHeaderBackground: string;

  /** Primary text on section headers & content areas (white / gray1) */
  sectionHeaderForeground: string;

  /** Inner content-area background (gray1 / white) */
  contentBackground: string;

  /** Primary text in content areas — same value as sectionHeaderForeground (white / gray1) */
  contentForeground: string;

  /** Secondary surface / panel / tab-bar background (gray5 / gray2) */
  surfaceBackground: string;

  /** Text on secondary surfaces (gray1 / gray6) */
  surfaceForeground: string;

  /** Card or dialog panel background (gray5 / white) */
  cardBackground: string;

  /** Card / input / divider border color (gray4 / gray3) */
  cardBorder: string;

  /** Form-input border color (gray5 / gray3) */
  inputBorder: string;

  /** Subtle / muted text (gray3 / gray4) — component names, descriptions */
  mutedForeground: string;

  /** Secondary descriptive text (gray2 / gray5) */
  secondaryForeground: string;

  /** Primary text color — headings, emphasis (white / gray6) */
  primaryForeground: string;

  /** Decorative / large icon color for empty-state illustrations (gray5 / gray3) */
  emptyStateIcon: string;

  /** Dialog section header border (rgba white 0.15 / rgba black 0.15) */
  dialogSectionBorder: string;

  /** Dialog input field background (rgba black 0.25 / rgba white 0.9) */
  dialogInputBackground: string;

  /** Dialog input field border (rgba white 0.2 / rgba black 0.2) */
  dialogInputBorder: string;

  /** Dialog gallery/card background (rgba black 0.2 / rgba white 0.85) */
  dialogGalleryBackground: string;
}

/**
 * Dark theme colors using mcColors palette
 */
const darkThemeColors: ThemeColors = {
  // Backgrounds
  background: mcColors.green5, // #3e8828 - accent
  background1: mcColors.gray6, // #262423 - main dark background
  background2: mcColors.gray5, // #4a4543 - slightly lighter
  background3: mcColors.gray4, // #6b6562 - tertiary
  background4: mcColors.gray3, // #a39895 - quaternary
  background5: mcColors.green6, // #2a641c - subtle accent
  background6: mcColors.offBlack, // #1a1918 - subtle dark

  // Foregrounds
  foreground: mcColors.green4, // #52a535 - accent
  foreground1: mcColors.offWhite, // #f5f0ed - main light text
  foreground2: mcColors.white, // #ffffff
  foreground3: mcColors.white, // #ffffff
  foreground4: mcColors.white, // #ffffff - button text
  foreground5: "#FFA500", // orange - warning
  foreground6: mcColors.gray3, // #a39895 - subtle

  // Hover states
  backgroundHover: mcColors.green3, // #6fc24a
  backgroundHover1: mcColors.gray4, // #6b6562
  backgroundHover2: mcColors.gray4, // #6b6562
  backgroundHover3: mcColors.gray4, // #6b6562

  // Active states
  backgroundActive: mcColors.green4, // #52a535
  backgroundActive1: mcColors.green6, // #2a641c
  foregroundActive: mcColors.gray2, // #d4ccc9
  foregroundActive1: mcColors.offWhite, // #f5f0ed

  // Minecraft button bevel colors (dark theme)
  mc0: "#131313",
  mc1: "#212121",
  mc2: "#212121",
  mc3: "#373737",
  mc4: "#3a3a3a",
  mc5: "#4e4e4e",
  mcc1: "#ffffff",

  // Semantic colors (dark theme)
  sectionBorder: mcColors.gray3,
  sectionHeaderBackground: mcColors.gray4,
  sectionHeaderForeground: mcColors.offWhite,
  contentBackground: mcColors.gray5,
  contentForeground: mcColors.offWhite,
  surfaceBackground: mcColors.gray5,
  surfaceForeground: mcColors.offWhite,
  cardBackground: mcColors.gray5,
  cardBorder: mcColors.gray4,
  inputBorder: mcColors.gray5,
  mutedForeground: mcColors.gray3,
  secondaryForeground: mcColors.gray2,
  primaryForeground: mcColors.white,
  emptyStateIcon: mcColors.gray5,
  dialogSectionBorder: "rgba(255,255,255,0.15)",
  dialogInputBackground: "rgba(0,0,0,0.25)",
  dialogInputBorder: "rgba(255,255,255,0.2)",
  dialogGalleryBackground: "rgba(0,0,0,0.2)",
};

/**
 * Light theme colors using mcColors palette
 */
const lightThemeColors: ThemeColors = {
  // Backgrounds
  background: mcColors.green3, // #6fc24a - accent
  background1: mcColors.gray1, // #ede5e2 - main light background
  background2: mcColors.gray2, // #d4ccc9 - slightly darker
  background3: mcColors.gray3, // #a39895 - tertiary
  background4: mcColors.gray4, // #6b6562 - quaternary
  background5: mcColors.green4, // #52a535 - subtle accent
  background6: mcColors.gray2, // #d4ccc9 - subtle light

  // Foregrounds
  foreground: mcColors.green5, // #3e8828 - accent
  foreground1: mcColors.offBlack, // #1a1918 - main dark text
  foreground2: mcColors.offBlack, // #1a1918
  foreground3: mcColors.offBlack, // #1a1918
  foreground4: mcColors.black, // #000000 - button text
  foreground5: mcColors.offBlack, // #1a1918
  foreground6: mcColors.gray5, // #4a4543 - subtle

  // Hover states
  backgroundHover: mcColors.green3, // #6fc24a
  backgroundHover1: mcColors.gray3, // #a39895
  backgroundHover2: mcColors.gray3, // #a39895
  backgroundHover3: mcColors.gray3, // #a39895

  // Active states
  backgroundActive: mcColors.green4, // #52a535
  backgroundActive1: mcColors.green5, // #3e8828
  foregroundActive: mcColors.gray5, // #4a4543
  foregroundActive1: mcColors.offBlack, // #1a1918

  // Minecraft button bevel colors (light theme)
  mc0: "#131313",
  mc1: "#595759",
  mc2: "#656465",
  mc3: "#C0BFC0",
  mc4: "#C6C6C6",
  mc5: "#f7f7f7",
  mcc1: "#4C4C4C",

  // Semantic colors (light theme)
  sectionBorder: mcColors.gray5,
  sectionHeaderBackground: mcColors.gray6,
  sectionHeaderForeground: mcColors.gray1,
  contentBackground: mcColors.white,
  contentForeground: mcColors.gray1,
  surfaceBackground: mcColors.gray2,
  surfaceForeground: mcColors.gray6,
  cardBackground: mcColors.white,
  cardBorder: mcColors.gray3,
  inputBorder: mcColors.gray3,
  mutedForeground: mcColors.gray4,
  secondaryForeground: mcColors.gray5,
  primaryForeground: mcColors.gray6,
  emptyStateIcon: mcColors.gray3,
  dialogSectionBorder: "rgba(0,0,0,0.15)",
  dialogInputBackground: "rgba(255,255,255,0.9)",
  dialogInputBorder: "rgba(0,0,0,0.2)",
  dialogGalleryBackground: "rgba(255,255,255,0.85)",
};

/**
 * Get theme colors based on current theme setting in CreatorToolsHost
 *
 * @returns ThemeColors object with all color values
 */
export function getThemeColors(): ThemeColors {
  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
  return isDark ? darkThemeColors : lightThemeColors;
}

/**
 * Check if current theme is dark mode
 */
export function isDarkMode(): boolean {
  return CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
}

/**
 * Check if current theme is in high contrast (forced-colors) mode
 */
export function isHighContrastMode(): boolean {
  return CreatorToolsHost.isHighContrast;
}

/**
 * Get a specific background color by number (1-6)
 */
export function getBackgroundColor(level: 1 | 2 | 3 | 4 | 5 | 6): string {
  const colors = getThemeColors();
  const key = `background${level}` as keyof ThemeColors;
  return colors[key];
}

/**
 * Get a specific foreground color by number (1-6)
 */
export function getForegroundColor(level: 1 | 2 | 3 | 4 | 5 | 6): string {
  const colors = getThemeColors();
  const key = `foreground${level}` as keyof ThemeColors;
  return colors[key];
}

/**
 * Get a color based on current theme mode.
 *
 * @param darkColor - Color to use in dark mode
 * @param lightColor - Color to use in light mode
 */
export function getThemedColor(darkColor: string, lightColor: string): string {
  return isDarkMode() ? darkColor : lightColor;
}

/**
 * Badge color palette — five-stop bevel definition for McBadge.
 */
export interface BadgeColorPalette {
  background: string;
  border: string;
  text: string;
  highlight: string;
  shadow: string;
}

/**
 * Badge color palettes keyed by variant, with dark/light entries.
 * Consumed by McBadge so that all color decisions live in the theme layer.
 */
export const mcBadgeColors: Record<string, { dark: BadgeColorPalette; light: BadgeColorPalette }> = {
  green: {
    dark: {
      background: mcColors.green4,
      border: "#1e4d14",
      text: mcColors.white,
      highlight: mcColors.green3,
      shadow: mcColors.green6,
    },
    light: {
      background: mcColors.green5,
      border: "#1e4d14",
      text: mcColors.white,
      highlight: mcColors.green4,
      shadow: "#1a5210",
    },
  },
  stone: {
    dark: {
      background: mcColors.stone,
      border: "#3a3a3a",
      text: mcColors.white,
      highlight: mcColors.stoneLight,
      shadow: mcColors.stoneDark,
    },
    light: {
      background: mcColors.stoneDark,
      border: "#2a2a2a",
      text: mcColors.white,
      highlight: mcColors.stone,
      shadow: "#333333",
    },
  },
  error: {
    dark: { background: "#d32f2f", border: "#8b1c1c", text: mcColors.white, highlight: "#ef5350", shadow: "#a12525" },
    light: { background: "#c62828", border: "#7b1a1a", text: mcColors.white, highlight: "#d32f2f", shadow: "#8e1c1c" },
  },
  warning: {
    dark: { background: "#f5a623", border: "#a16e0f", text: "#1a1a1a", highlight: "#ffc107", shadow: "#c7850a" },
    light: { background: "#e69500", border: "#8a5e00", text: "#1a1a1a", highlight: "#f5a623", shadow: "#b07800" },
  },
  info: {
    dark: { background: "#1976d2", border: "#0d4a82", text: mcColors.white, highlight: "#42a5f5", shadow: "#125ea5" },
    light: { background: "#1565c0", border: "#0a3d75", text: mcColors.white, highlight: "#1976d2", shadow: "#0d4a82" },
  },
  passed: {
    dark: {
      background: mcColors.green4,
      border: "#1e4d14",
      text: mcColors.white,
      highlight: mcColors.green3,
      shadow: mcColors.green6,
    },
    light: {
      background: mcColors.green5,
      border: "#1e4d14",
      text: mcColors.white,
      highlight: mcColors.green4,
      shadow: "#1a5210",
    },
  },
  recommendation: {
    dark: { background: "#f5a623", border: "#a16e0f", text: "#1a1a1a", highlight: "#ffc107", shadow: "#c7850a" },
    light: { background: "#e69500", border: "#8a5e00", text: "#1a1a1a", highlight: "#f5a623", shadow: "#b07800" },
  },
};

/**
 * Get badge colors for the current theme.
 */
export function getBadgeColors(variant: string): BadgeColorPalette {
  const entry = mcBadgeColors[variant] ?? mcBadgeColors.stone;
  return isDarkMode() ? entry.dark : entry.light;
}

/**
 * Common style patterns used throughout the app.
 * Prefer using `getThemeColors()` semantic properties directly instead of these
 * where possible (e.g. `colors.surfaceBackground` instead of `commonStyles.panelBackground()`).
 */
export const commonStyles = {
  /** Standard panel/card background — same as ThemeColors.cardBackground */
  panelBackground: () => getThemeColors().cardBackground,

  /** Page/outer background — same as ThemeColors.background1 */
  pageBackground: () => getThemeColors().background1,

  /** Primary text color — same as ThemeColors.primaryForeground */
  primaryText: () => getThemeColors().primaryForeground,

  /** Secondary text color — same as ThemeColors.secondaryForeground */
  secondaryText: () => getThemeColors().secondaryForeground,

  /** Border/divider color — same as ThemeColors.cardBorder */
  border: () => getThemeColors().cardBorder,

  /** Hover background */
  hoverBackground: () => getThemedColor(mcColors.gray4, mcColors.gray2),

  /** Selected item background - subtle tint to avoid eye strain */
  selectedBackground: () => getThemedColor("rgba(82, 165, 53, 0.25)", "rgba(82, 165, 53, 0.2)"),

  /** Accent/primary action color */
  accent: () => mcColors.green4,
};

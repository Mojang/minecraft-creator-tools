// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE: Theme System
 *
 * IProjectTheme is the application's canonical theme type, passed through the component tree
 * from App.tsx via props. It is constructed in StandardInit.ts as minecraftToolDarkTheme and
 * minecraftToolLightTheme, then selected via CreatorToolsHost.theme.
 *
 * The theme contains:
 *   - Font family (bodyFontFamily)
 *   - Brand colors: backgrounds, foregrounds, hover/active/disabled/focus/border states
 *   - Minecraft button bevel colors (mc0–mc5, mcc1) for 3D button effects
 *
 * For convenient access to theme colors without a theme prop, use:
 *   import { getThemeColors } from "../hooks/theme/useThemeColors";
 *   const colors = getThemeColors(); // reads from CreatorToolsHost.theme
 *
 * Both IProjectTheme and ThemeColors share the same property names (background1, foreground1,
 * mc0, etc.) so migrating between them is straightforward.
 */

/**
 * Application theme object passed through component props.
 *
 * This is a flat structure containing font family and all brand colors directly.
 * Created in StandardInit.ts and threaded through the component tree from App.tsx.
 */
export default interface IProjectTheme {
  bodyFontFamily: string;

  // Minecraft button bevel colors (for 3D button effects)
  mc0: string;
  mc1: string;
  mc2: string;
  mc3: string;
  mc4: string;
  mc5: string;
  mcc1: string;

  // Core accent
  background: string;
  foreground: string;

  // Numbered backgrounds (1 = outermost, 6 = subtle)
  background1: string;
  background2: string;
  background3: string;
  background4: string;
  background5: string;
  background6: string;

  // Numbered foregrounds (1 = primary text, 6 = subtle)
  foreground1: string;
  foreground2: string;
  foreground3: string;
  foreground4: string;
  foreground5: string;
  foreground6: string;

  // Hover states
  foregroundHover: string;
  foregroundHover1: string;
  foregroundHover2: string;
  foregroundHover3: string;
  backgroundHover: string;
  backgroundHover1: string;
  backgroundHover2: string;
  backgroundHover3: string;

  // Active states
  foregroundActive: string;
  foregroundActive1: string;
  backgroundActive: string;
  backgroundActive1: string;

  // Other
  backgroundPressed: string;

  // Allow additional string properties for forward compatibility
  [key: string]: string;
}

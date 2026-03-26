/**
 * Blockly Minecraft Theme & Custom Renderer
 *
 * Defines a complete Blockly theme using the Minecraft Creator Tools color palette,
 * plus a custom "minecraft" renderer that extends Zelos to produce squared-off,
 * beveled block shapes that match the Minecraft UI aesthetic.
 *
 * Renderer changes vs stock Zelos:
 * - CORNER_RADIUS reduced to 2 (from 4) for squared corners
 * - NOTCH uses straight-line SVG paths instead of curves
 * - Inside corners use straight-line paths instead of arcs
 * - FIELD_BORDER_RECT_RADIUS set to 2 for squared field borders
 * - Rounded/squared output shapes use smaller radii
 *
 * Block style mapping:
 * - action_style   → Green (MC primary accent) — used for action blocks (play_sound, emit_particle, etc.)
 * - logic_style    → Brown/Wood — used for containers like sequence, randomize, action_group
 * - trigger_style  → Stone/Gray — used for trigger blocks (hat-shaped)
 * - event_style    → Purple/Slate — used for entity event verbs (add/remove component group, set_property)
 * - condition_style → Teal/Blue — used for condition/filter blocks
 *
 * @see ActionSetEditor.tsx — consumes this via getMinecraftBlocklyConfig()
 * @see mcColors.ts — source color palette
 */
import * as Blockly from "blockly";
import { mcColors } from "../hooks/theme/mcColors";

let rendererRegistered = false;

/**
 * Registers the custom "minecraft" renderer with Blockly.
 * Safe to call multiple times — only registers once.
 */
export function ensureMinecraftRendererRegistered() {
  if (rendererRegistered) {
    return;
  }

  /**
   * Custom constant provider that produces squared, beveled shapes
   * instead of Zelos's default rounded ones.
   */
  class MinecraftConstantProvider extends Blockly.zelos.ConstantProvider {
    constructor() {
      super();
      // Squared corners instead of rounded
      this.CORNER_RADIUS = 2;
      // Squared field borders
      this.FIELD_BORDER_RECT_RADIUS = 2;
      // Square start hat
      this.START_HAT_HEIGHT = 16;
      this.START_HAT_WIDTH = 80;
    }

    /**
     * Override notch shape to use straight lines instead of curves.
     * Creates a simple rectangular notch that looks like a Minecraft
     * puzzle-piece connector.
     */
    override makeNotch() {
      const width = this.NOTCH_WIDTH;
      const height = this.NOTCH_HEIGHT;

      // Squared notch: go right, down, right, up, right
      const sideWidth = width / 3;

      const pathLeft =
        `l ${sideWidth},0 ` + `l 0,${height} ` + `l ${sideWidth},0 ` + `l 0,${-height} ` + `l ${sideWidth},0`;

      const pathRight =
        `l ${-sideWidth},0 ` + `l 0,${height} ` + `l ${-sideWidth},0 ` + `l 0,${-height} ` + `l ${-sideWidth},0`;

      return {
        type: this.SHAPES.NOTCH,
        width: width,
        height: height,
        pathLeft: pathLeft,
        pathRight: pathRight,
      };
    }

    /**
     * Override inside corners to use straight right-angle lines
     * instead of arcs.
     */
    override makeInsideCorners() {
      const radius = this.CORNER_RADIUS;

      return {
        width: radius,
        height: radius,
        pathTop: `l ${radius},0 l 0,${radius}`,
        pathBottom: `l 0,${-radius} l ${-radius},0`,
        rightWidth: radius,
        rightHeight: radius,
        pathTopRight: `l 0,${radius} l ${-radius},0`,
        pathBottomRight: `l ${radius},0 l 0,${-radius}`,
      };
    }

    /**
     * Override the start hat to use a flat squared shape rather than
     * a smooth curved hat.
     */
    override makeStartHat() {
      const height = this.START_HAT_HEIGHT;
      const width = this.START_HAT_WIDTH;

      // Simple beveled hat: rise up at an angle, flat across top, back down
      const bevelWidth = 8;
      const path = `l ${bevelWidth},${-height} ` + `l ${width - 2 * bevelWidth},0 ` + `l ${bevelWidth},${height}`;

      return {
        height: height,
        width: width,
        path: path,
      };
    }
  }

  /**
   * Custom renderer that extends Zelos but uses our squared
   * constant provider.
   */
  class MinecraftRenderer extends Blockly.zelos.Renderer {
    constructor(name: string) {
      super(name);
    }

    protected override makeConstants_(): MinecraftConstantProvider {
      return new MinecraftConstantProvider();
    }
  }

  // Register with Blockly's renderer registry.
  // Wrapped in try-catch because Vite HMR can re-evaluate this module
  // while Blockly's internal registry still holds the previous registration.
  try {
    Blockly.blockRendering.register("minecraft", MinecraftRenderer);
  } catch (_e) {
    // Already registered — safe to ignore.
  }
  rendererRegistered = true;
}

/**
 * Returns the full Blockly workspace configuration including the Minecraft theme,
 * custom squared renderer, and grid settings.
 *
 * Must be called after ensureMinecraftRendererRegistered().
 *
 * @param isDark - Whether the app is in dark mode
 */
export function getMinecraftBlocklyConfig(isDark: boolean) {
  // Ensure custom renderer is registered before returning config that uses it
  ensureMinecraftRendererRegistered();

  return {
    media: "/blockly/media/",
    renderer: "minecraft",
    trashcan: false,
    move: {
      scrollbars: {
        horizontal: true,
        vertical: true,
      },
      drag: true,
      wheel: true,
    },
    grid: {
      spacing: 40,
      length: 3,
      colour: isDark ? "#444444" : "#bbbbbb",
      snap: true,
    },
    theme: {
      name: "minecraft",
      startHats: true,
      fontStyle: {
        family: "Noto Sans, sans-serif",
        size: 11,
      },
      blockStyles: {
        action_style: {
          colourPrimary: isDark ? mcColors.green5 : mcColors.green4,
          colourSecondary: mcColors.green2,
          colourTertiary: mcColors.green7,
        },
        logic_style: {
          colourPrimary: isDark ? mcColors.brown : mcColors.brownLight,
          colourSecondary: mcColors.brownLight,
          colourTertiary: mcColors.brownBorder,
        },
        trigger_style: {
          colourPrimary: isDark ? mcColors.stoneDark : mcColors.stone,
          colourSecondary: mcColors.stoneLight,
          colourTertiary: mcColors.stoneBorder,
          hat: "cap",
        },
        // Slate-purple palette for event blocks — intentionally not in mcColors
        // as these are Blockly-editor-specific semantic colors, not part of the
        // Minecraft Creator product palette.
        event_style: {
          colourPrimary: isDark ? "#6a5acd" : "#7b68ee",
          colourSecondary: isDark ? "#8b7de0" : "#9b8ff5",
          colourTertiary: isDark ? "#4a3a9d" : "#5a48bd",
        },
        // Teal palette for condition blocks — same rationale as event_style.
        condition_style: {
          colourPrimary: isDark ? "#2a7b9b" : "#3a9bbf",
          colourSecondary: "#5ac0e0",
          colourTertiary: "#1a5b7b",
        },
      },
      categoryStyles: {
        actions: { colour: mcColors.green4 },
        events: { colour: "#7b68ee" },
        logic: { colour: mcColors.brown },
        triggers: { colour: mcColors.stone },
        conditions: { colour: "#2a7b9b" },
      },
      componentStyles: {
        workspaceBackgroundColour: isDark ? mcColors.gray6 : mcColors.gray1,
        toolboxBackgroundColour: isDark ? mcColors.gray5 : mcColors.gray2,
        toolboxForegroundColour: isDark ? mcColors.gray1 : mcColors.gray6,
        flyoutBackgroundColour: isDark ? "#3a3530" : mcColors.gray3,
        flyoutForegroundColour: isDark ? mcColors.gray1 : mcColors.gray6,
        flyoutOpacity: 1,
        scrollbarColour: isDark ? "#797979" : "#a09090",
        insertionMarkerColour: "#fff",
        insertionMarkerOpacity: 0.3,
        scrollbarOpacity: 0.4,
        cursorColour: "#d0d0d0",
      },
    },
  };
}

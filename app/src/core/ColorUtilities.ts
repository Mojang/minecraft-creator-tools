// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IColor from "./IColor";

export default class ColorUtilities {
  static fromCss(colorStr: string): IColor {
    if (colorStr.startsWith("#") && colorStr.length === 7) {
      return {
        red: ColorUtilities.fromTwoHexit(colorStr.substring(1, 3)),
        green: ColorUtilities.fromTwoHexit(colorStr.substring(3, 5)),
        blue: ColorUtilities.fromTwoHexit(colorStr.substring(5, 7)),
      };
    } else if (colorStr.startsWith("#") && colorStr.length === 9) {
      return {
        red: ColorUtilities.fromTwoHexit(colorStr.substring(1, 3)),
        green: ColorUtilities.fromTwoHexit(colorStr.substring(3, 5)),
        blue: ColorUtilities.fromTwoHexit(colorStr.substring(5, 7)),
        alpha: ColorUtilities.fromTwoHexit(colorStr.substring(7, 9)),
      };
    } else if (colorStr.length === 6) {
      return {
        red: ColorUtilities.fromTwoHexit(colorStr.substring(0, 2)),
        green: ColorUtilities.fromTwoHexit(colorStr.substring(2, 4)),
        blue: ColorUtilities.fromTwoHexit(colorStr.substring(4, 6)),
      };
    } else if (colorStr.length === 8) {
      return {
        red: ColorUtilities.fromTwoHexit(colorStr.substring(0, 2)),
        green: ColorUtilities.fromTwoHexit(colorStr.substring(2, 4)),
        blue: ColorUtilities.fromTwoHexit(colorStr.substring(4, 6)),
        alpha: ColorUtilities.fromTwoHexit(colorStr.substring(6, 8)),
      };
    }

    return {
      red: 0,
      green: 0,
      blue: 0,
    };
  }

  static fromTwoHexit(hexitChar: string) {
    try {
      return parseInt(hexitChar, 16);
    } catch {
      return 0;
    }
  }

  static toCss(color: IColor) {
    if (color.alpha !== undefined) {
      return `rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha})`;
    }

    return `rgb(${color.red}, ${color.green}, ${color.blue})`;
  }

  static lighter(color: IColor, multiplier: number): IColor {
    return {
      red: Math.min(255, color.red + color.red * multiplier),
      green: Math.min(255, color.green + color.green * multiplier),
      blue: Math.min(255, color.blue + color.blue * multiplier),
      alpha: color.alpha,
    };
  }

  static darker(color: IColor, multiplier: number): IColor {
    return {
      red: Math.max(0, color.red - color.red * multiplier),
      green: Math.max(0, color.green - color.green * multiplier),
      blue: Math.max(0, color.blue - color.blue * multiplier),
      alpha: color.alpha,
    };
  }

  /**
   * Alpha-composite `foreground` over an opaque `background`, returning an
   * opaque RGB color.
   *
   * Why not just rely on CSS `rgba(...)` backgrounds?
   * Accessibility scanners (e.g. axe-core) cannot reliably compute contrast
   * for translucent backgrounds. When the foreground sits over an `rgba(...)`
   * fill, axe walks up the DOM looking for the next opaque ancestor and
   * frequently falls back to the page default (white) — which produces false
   * "1.06:1" contrast failures even when the rendered pixels look fine.
   *
   * Pre-compositing on our side gives the element a SOLID `rgb(...)`
   * background that axe can evaluate directly, so contrast scoring matches
   * what the user actually sees.
   *
   * @param foreground The translucent color (must define `alpha` 0..1).
   *                   If `alpha` is undefined or 1, the foreground is returned unchanged.
   * @param background The opaque background it sits over.
   *                   If alpha is supplied here it is treated as 1.
   */
  static composite(foreground: IColor, background: IColor): IColor {
    const alpha = foreground.alpha ?? 1;
    if (alpha >= 1) {
      return { red: foreground.red, green: foreground.green, blue: foreground.blue };
    }
    if (alpha <= 0) {
      return { red: background.red, green: background.green, blue: background.blue };
    }
    return {
      red: Math.round(foreground.red * alpha + background.red * (1 - alpha)),
      green: Math.round(foreground.green * alpha + background.green * (1 - alpha)),
      blue: Math.round(foreground.blue * alpha + background.blue * (1 - alpha)),
    };
  }
}

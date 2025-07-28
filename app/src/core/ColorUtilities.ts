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
}

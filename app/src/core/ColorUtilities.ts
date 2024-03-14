// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IColor from "./IColor";

export default class ColorUtilities {
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

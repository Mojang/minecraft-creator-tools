// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Curated documentation layered over engine-exported Molang math metadata.
 *
 * The engine export is the source of truth for which functions exist and how many arguments they
 * take; it only provides terse titles, so this overlay supplies parameter names and descriptions.
 * Entries whose parameter count no longer matches the engine signature are ignored (see
 * getMolangMathDoc), so a stale overlay can never produce an incorrect signature.
 */

export interface IMolangMathDoc {
  params: string[];
  description: string;
}

const MATH_DOCS: { [name: string]: IMolangMathDoc } = {
  "math.abs": { params: ["value"], description: "Absolute value of value" },
  "math.acos": { params: ["value"], description: "Arccosine of value, in degrees" },
  "math.asin": { params: ["value"], description: "Arcsine of value, in degrees" },
  "math.atan": { params: ["value"], description: "Arctangent of value, in degrees" },
  "math.atan2": { params: ["y", "x"], description: "Arctangent of y/x, in degrees" },
  "math.ceil": { params: ["value"], description: "Round value up to the nearest integral number" },
  "math.clamp": { params: ["value", "min", "max"], description: "Clamp value to between min and max inclusive" },
  "math.copy_sign": { params: ["a", "b"], description: "Return a with the absolute value of a and the sign of b" },
  "math.cos": { params: ["degrees"], description: "Cosine of an angle in degrees" },
  "math.die_roll": {
    params: ["count", "low", "high"],
    description: "Sum of count random floating-point values, each between low and high",
  },
  "math.die_roll_integer": {
    params: ["count", "low", "high"],
    description: "Sum of count random integers, each between low and high inclusive",
  },
  "math.exp": { params: ["value"], description: "Calculates e to the power of value" },
  "math.floor": { params: ["value"], description: "Round value down to the nearest integral number" },
  "math.hermite_blend": { params: ["t"], description: "Hermite basis 3t² - 2t³, useful for smooth curves" },
  "math.inverse_lerp": {
    params: ["start", "end", "value"],
    description: "Returns the normalized progress (0-1) of value between start and end",
  },
  "math.lerp": { params: ["start", "end", "t"], description: "Lerp from start to end via t (0-1)" },
  "math.lerprotate": {
    params: ["start", "end", "t"],
    description: "Lerp the shortest direction around a circle from start degrees to end degrees via t (0-1)",
  },
  "math.ln": { params: ["value"], description: "Natural logarithm of value" },
  "math.max": { params: ["a", "b"], description: "Return the higher of a or b" },
  "math.min": { params: ["a", "b"], description: "Return the lower of a or b" },
  "math.min_angle": {
    params: ["degrees"],
    description: "Minimize angle magnitude (in degrees) into the range [-180, 180)",
  },
  "math.mod": { params: ["value", "denominator"], description: "Return the remainder of value / denominator" },
  "math.pi": { params: [], description: "Returns the float representation of the constant pi" },
  "math.pow": { params: ["base", "exponent"], description: "Elevates base to the exponent'th power" },
  "math.random": { params: ["low", "high"], description: "Random value between low and high inclusive" },
  "math.random_integer": { params: ["low", "high"], description: "Random integer between low and high inclusive" },
  "math.round": { params: ["value"], description: "Round value to the nearest integral number" },
  "math.sign": { params: ["value"], description: "Returns 1 if value is positive, -1 otherwise" },
  "math.sin": { params: ["degrees"], description: "Sine of an angle in degrees" },
  "math.sqrt": { params: ["value"], description: "Square root of value" },
  "math.trunc": { params: ["value"], description: "Round value towards zero" },
};

const EASE_PREFIX = "math.ease_";

/**
 * Curated parameter names and description for a math function, if they match the engine arity.
 */
export function getMolangMathDoc(
  name: string,
  minArgs: number,
  maxArgs: number | undefined
): IMolangMathDoc | undefined {
  const lower = name.toLowerCase();
  let doc = MATH_DOCS[lower];

  if (!doc && lower.startsWith(EASE_PREFIX)) {
    const curve = lower.substring(EASE_PREFIX.length).replace(/_/g, "-");
    doc = {
      params: ["start", "end", "t"],
      description: `Ease (${curve}) from start to end via t (0-1)`,
    };
  }

  if (!doc || doc.params.length !== minArgs || (maxArgs !== undefined && doc.params.length !== maxArgs)) {
    return undefined;
  }
  return doc;
}

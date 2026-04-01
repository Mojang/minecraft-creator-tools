// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MolangParser - Parse Molang expressions
 *
 * Provides tokenization and parsing of Molang expressions for editor intelligence.
 */

/**
 * Molang token types
 */
export type MolangTokenType =
  | "query" // query.is_baby, q.is_baby
  | "variable" // variable.my_var, v.my_var
  | "temp" // temp.x, t.x
  | "context" // context.other, c.other
  | "math" // math.sin, math.cos
  | "geometry" // geometry.bone
  | "material" // material.x
  | "texture" // texture.x
  | "array" // array.x
  | "number" // 1.5, 42
  | "string" // 'text'
  | "operator" // +, -, *, /, ==, etc.
  | "parenthesis" // (, )
  | "bracket" // [, ]
  | "brace" // {, }
  | "comma" // ,
  | "semicolon" // ;
  | "colon" // :
  | "questionmark" // ?
  | "dot" // .
  | "arrow" // ->
  | "keyword" // return, loop, for_each, break, continue, this
  | "identifier" // other identifiers
  | "whitespace"
  | "unknown";

/**
 * A Molang token
 */
export interface IMolangToken {
  type: MolangTokenType;
  value: string;
  start: number;
  end: number;
  /** For query/variable/math, the full function call including method */
  fullIdentifier?: string;
}

/**
 * Parsed Molang expression structure
 */
export interface IParsedMolang {
  /** Original expression text */
  text: string;
  /** Tokens */
  tokens: IMolangToken[];
  /** All queries used */
  queries: string[];
  /** All variables used */
  variables: string[];
  /** All temp variables used */
  temps: string[];
  /** All math functions used */
  mathFunctions: string[];
  /** Whether expression appears valid */
  isValid: boolean;
  /** Parse errors if any */
  errors: IMolangError[];
}

/**
 * A Molang parse error
 */
export interface IMolangError {
  message: string;
  start: number;
  end: number;
}

/**
 * Well-known Molang queries
 */
export const MOLANG_QUERIES: { name: string; description: string; returns: string }[] = [
  // Entity state
  { name: "query.is_baby", description: "Returns 1.0 if entity is a baby", returns: "0.0 or 1.0" },
  { name: "query.is_in_water", description: "Returns 1.0 if entity is in water", returns: "0.0 or 1.0" },
  {
    name: "query.is_in_water_or_rain",
    description: "Returns 1.0 if entity is in water or rain",
    returns: "0.0 or 1.0",
  },
  { name: "query.is_on_ground", description: "Returns 1.0 if entity is on the ground", returns: "0.0 or 1.0" },
  { name: "query.is_sneaking", description: "Returns 1.0 if entity is sneaking", returns: "0.0 or 1.0" },
  { name: "query.is_sprinting", description: "Returns 1.0 if entity is sprinting", returns: "0.0 or 1.0" },
  { name: "query.is_swimming", description: "Returns 1.0 if entity is swimming", returns: "0.0 or 1.0" },
  { name: "query.is_jumping", description: "Returns 1.0 if entity is jumping", returns: "0.0 or 1.0" },
  { name: "query.is_sleeping", description: "Returns 1.0 if entity is sleeping", returns: "0.0 or 1.0" },
  { name: "query.is_sitting", description: "Returns 1.0 if entity is sitting", returns: "0.0 or 1.0" },
  { name: "query.is_tamed", description: "Returns 1.0 if entity is tamed", returns: "0.0 or 1.0" },
  { name: "query.is_angry", description: "Returns 1.0 if entity is angry", returns: "0.0 or 1.0" },
  { name: "query.is_sheared", description: "Returns 1.0 if sheep is sheared", returns: "0.0 or 1.0" },
  { name: "query.is_powered", description: "Returns 1.0 if creeper is charged", returns: "0.0 or 1.0" },
  { name: "query.is_ignited", description: "Returns 1.0 if creeper is ignited", returns: "0.0 or 1.0" },
  { name: "query.is_saddled", description: "Returns 1.0 if entity has a saddle", returns: "0.0 or 1.0" },
  { name: "query.is_chested", description: "Returns 1.0 if entity has a chest", returns: "0.0 or 1.0" },
  { name: "query.is_leashed", description: "Returns 1.0 if entity is leashed", returns: "0.0 or 1.0" },
  { name: "query.is_moving", description: "Returns 1.0 if entity is moving", returns: "0.0 or 1.0" },
  { name: "query.is_alive", description: "Returns 1.0 if entity is alive", returns: "0.0 or 1.0" },

  // Animation and timing
  { name: "query.anim_time", description: "Current animation time in seconds", returns: "Float" },
  { name: "query.life_time", description: "Time since entity spawned", returns: "Float (seconds)" },
  { name: "query.modified_move_speed", description: "Entity's modified movement speed", returns: "Float" },
  { name: "query.ground_speed", description: "Entity's speed along the ground", returns: "Float" },
  { name: "query.vertical_speed", description: "Entity's vertical speed", returns: "Float" },

  // Position and rotation
  { name: "query.position", description: "Entity's position (takes axis index 0-2)", returns: "Float" },
  { name: "query.position_delta", description: "Position change since last tick", returns: "Float" },
  { name: "query.body_x_rotation", description: "Entity's body X rotation", returns: "Float (degrees)" },
  { name: "query.body_y_rotation", description: "Entity's body Y rotation", returns: "Float (degrees)" },
  { name: "query.head_x_rotation", description: "Entity's head X rotation (pitch)", returns: "Float (degrees)" },
  { name: "query.head_y_rotation", description: "Entity's head Y rotation (yaw)", returns: "Float (degrees)" },

  // Health and combat
  { name: "query.health", description: "Current health value", returns: "Float" },
  { name: "query.max_health", description: "Maximum health value", returns: "Float" },
  { name: "query.hurt_time", description: "Time since entity was last hurt", returns: "Float" },
  { name: "query.hurt_direction", description: "Direction entity was hurt from", returns: "Float" },

  // Items and equipment
  { name: "query.item_slot_to_bone_name", description: "Bone name for item slot", returns: "String" },
  { name: "query.is_item_equipped", description: "Returns 1.0 if item is equipped in slot", returns: "0.0 or 1.0" },
  { name: "query.main_hand_item_use_duration", description: "How long main hand item has been used", returns: "Float" },

  // World and environment
  { name: "query.time_of_day", description: "Time of day (0.0 to 1.0)", returns: "Float" },
  { name: "query.moon_phase", description: "Current moon phase (0-7)", returns: "Integer" },
  { name: "query.is_in_lava", description: "Returns 1.0 if entity is in lava", returns: "0.0 or 1.0" },
  { name: "query.eye_target_x_rotation", description: "Target X rotation for eyes", returns: "Float" },
  { name: "query.eye_target_y_rotation", description: "Target Y rotation for eyes", returns: "Float" },

  // Variant and color
  { name: "query.variant", description: "Entity's variant number", returns: "Integer" },
  { name: "query.mark_variant", description: "Entity's mark variant", returns: "Integer" },
  { name: "query.skin_id", description: "Entity's skin ID", returns: "Integer" },
  { name: "query.color", description: "Entity's color value", returns: "Integer" },
  { name: "query.color2", description: "Entity's secondary color", returns: "Integer" },

  // Block and actor
  { name: "query.block_state", description: "Returns block state value", returns: "Varies" },
  { name: "query.has_rider", description: "Returns 1.0 if entity has a rider", returns: "0.0 or 1.0" },
  { name: "query.is_riding", description: "Returns 1.0 if entity is riding", returns: "0.0 or 1.0" },
  { name: "query.rider_count", description: "Number of riders on this entity", returns: "Integer" },

  // Animation controller
  {
    name: "query.all_animations_finished",
    description: "Returns 1.0 if all animations are done",
    returns: "0.0 or 1.0",
  },
  { name: "query.any_animation_finished", description: "Returns 1.0 if any animation is done", returns: "0.0 or 1.0" },
];

/**
 * Molang math functions
 */
export const MOLANG_MATH: { name: string; description: string; syntax: string }[] = [
  { name: "math.abs", description: "Absolute value", syntax: "math.abs(value)" },
  { name: "math.acos", description: "Arccosine in degrees", syntax: "math.acos(value)" },
  { name: "math.asin", description: "Arcsine in degrees", syntax: "math.asin(value)" },
  { name: "math.atan", description: "Arctangent in degrees", syntax: "math.atan(value)" },
  { name: "math.atan2", description: "Arctangent of y/x in degrees", syntax: "math.atan2(y, x)" },
  { name: "math.ceil", description: "Round up to nearest integer", syntax: "math.ceil(value)" },
  { name: "math.clamp", description: "Clamp value between min and max", syntax: "math.clamp(value, min, max)" },
  { name: "math.cos", description: "Cosine (degrees)", syntax: "math.cos(degrees)" },
  { name: "math.die_roll", description: "Roll dice: sum of count d20 rolls", syntax: "math.die_roll(count, min, max)" },
  { name: "math.die_roll_integer", description: "Integer die roll", syntax: "math.die_roll_integer(count, min, max)" },
  { name: "math.exp", description: "Exponential (e^x)", syntax: "math.exp(value)" },
  { name: "math.floor", description: "Round down to nearest integer", syntax: "math.floor(value)" },
  { name: "math.hermite_blend", description: "Hermite interpolation blend", syntax: "math.hermite_blend(value)" },
  { name: "math.lerp", description: "Linear interpolation", syntax: "math.lerp(start, end, t)" },
  {
    name: "math.lerprotate",
    description: "Lerp rotation (handles 360 wrap)",
    syntax: "math.lerprotate(start, end, t)",
  },
  { name: "math.ln", description: "Natural logarithm", syntax: "math.ln(value)" },
  { name: "math.max", description: "Maximum of two values", syntax: "math.max(a, b)" },
  { name: "math.min", description: "Minimum of two values", syntax: "math.min(a, b)" },
  { name: "math.min_angle", description: "Minimum angle difference", syntax: "math.min_angle(angle)" },
  { name: "math.mod", description: "Modulo (remainder)", syntax: "math.mod(value, divisor)" },
  { name: "math.pi", description: "Pi constant (3.14159...)", syntax: "math.pi" },
  { name: "math.pow", description: "Power (base^exponent)", syntax: "math.pow(base, exponent)" },
  { name: "math.random", description: "Random value between min and max", syntax: "math.random(min, max)" },
  {
    name: "math.random_integer",
    description: "Random integer between min and max",
    syntax: "math.random_integer(min, max)",
  },
  { name: "math.round", description: "Round to nearest integer", syntax: "math.round(value)" },
  { name: "math.sin", description: "Sine (degrees)", syntax: "math.sin(degrees)" },
  { name: "math.sqrt", description: "Square root", syntax: "math.sqrt(value)" },
  { name: "math.trunc", description: "Truncate to integer", syntax: "math.trunc(value)" },
];

/**
 * Molang parser
 */
export class MolangParser {
  /**
   * Parse a Molang expression
   */
  public parse(expression: string): IParsedMolang {
    const tokens = this.tokenize(expression);
    const result: IParsedMolang = {
      text: expression,
      tokens,
      queries: [],
      variables: [],
      temps: [],
      mathFunctions: [],
      isValid: true,
      errors: [],
    };

    // Extract categorized identifiers
    for (const token of tokens) {
      if (token.fullIdentifier) {
        switch (token.type) {
          case "query":
            result.queries.push(token.fullIdentifier);
            break;
          case "variable":
            result.variables.push(token.fullIdentifier);
            break;
          case "temp":
            result.temps.push(token.fullIdentifier);
            break;
          case "math":
            result.mathFunctions.push(token.fullIdentifier);
            break;
        }
      }
    }

    // Basic validation
    result.errors = this.validate(tokens);
    result.isValid = result.errors.length === 0;

    return result;
  }

  /**
   * Tokenize a Molang expression
   */
  private tokenize(expression: string): IMolangToken[] {
    const tokens: IMolangToken[] = [];
    let i = 0;

    while (i < expression.length) {
      const char = expression[i];
      const remaining = expression.slice(i);

      // Whitespace
      if (/\s/.test(char)) {
        const match = remaining.match(/^\s+/);
        if (match) {
          i += match[0].length;
          continue;
        }
      }

      // Number
      if (/[0-9]/.test(char) || (char === "." && /[0-9]/.test(expression[i + 1] || ""))) {
        const match = remaining.match(/^[0-9]*\.?[0-9]+/);
        if (match) {
          tokens.push({
            type: "number",
            value: match[0],
            start: i,
            end: i + match[0].length,
          });
          i += match[0].length;
          continue;
        }
      }

      // String literal
      if (char === "'") {
        const end = expression.indexOf("'", i + 1);
        if (end !== -1) {
          tokens.push({
            type: "string",
            value: expression.slice(i, end + 1),
            start: i,
            end: end + 1,
          });
          i = end + 1;
          continue;
        }
      }

      // Arrow operator
      if (remaining.startsWith("->")) {
        tokens.push({ type: "arrow", value: "->", start: i, end: i + 2 });
        i += 2;
        continue;
      }

      // Multi-character operators
      const operators = ["==", "!=", ">=", "<=", "&&", "||", "??"];
      let foundOp = false;
      for (const op of operators) {
        if (remaining.startsWith(op)) {
          tokens.push({ type: "operator", value: op, start: i, end: i + op.length });
          i += op.length;
          foundOp = true;
          break;
        }
      }
      if (foundOp) continue;

      // Single character operators
      if ("+-*/%<>=!".includes(char)) {
        tokens.push({ type: "operator", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }

      // Punctuation
      if (char === "(") {
        tokens.push({ type: "parenthesis", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === ")") {
        tokens.push({ type: "parenthesis", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === "[") {
        tokens.push({ type: "bracket", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === "]") {
        tokens.push({ type: "bracket", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === "{") {
        tokens.push({ type: "brace", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === "}") {
        tokens.push({ type: "brace", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === ",") {
        tokens.push({ type: "comma", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === ";") {
        tokens.push({ type: "semicolon", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === ":") {
        tokens.push({ type: "colon", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === "?") {
        tokens.push({ type: "questionmark", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === ".") {
        tokens.push({ type: "dot", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }

      // Identifier (query, variable, temp, math, context, etc.)
      if (/[a-zA-Z_]/.test(char)) {
        const match = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
        if (match) {
          const identifier = match[0];
          const start = i;
          i += identifier.length;

          // Check for namespace prefix and full identifier
          let fullIdentifier = identifier;
          if (expression[i] === ".") {
            // Look for the rest: query.is_baby, math.sin, etc.
            const restMatch = expression.slice(i).match(/^\.[a-zA-Z_][a-zA-Z0-9_]*/);
            if (restMatch) {
              fullIdentifier += restMatch[0];
              i += restMatch[0].length;
            }
          }

          // Determine token type
          let type: MolangTokenType = "identifier";
          const prefix = identifier.toLowerCase();
          if (prefix === "query" || prefix === "q") type = "query";
          else if (prefix === "variable" || prefix === "v") type = "variable";
          else if (prefix === "temp" || prefix === "t") type = "temp";
          else if (prefix === "context" || prefix === "c") type = "context";
          else if (prefix === "math") type = "math";
          else if (prefix === "geometry") type = "geometry";
          else if (prefix === "material") type = "material";
          else if (prefix === "texture") type = "texture";
          else if (prefix === "array") type = "array";
          else if (["return", "loop", "for_each", "break", "continue", "this"].includes(identifier.toLowerCase())) {
            type = "keyword";
          }

          tokens.push({
            type,
            value: identifier,
            start,
            end: i,
            fullIdentifier: type !== "identifier" && type !== "keyword" ? fullIdentifier : undefined,
          });
          continue;
        }
      }

      // Unknown character
      tokens.push({ type: "unknown", value: char, start: i, end: i + 1 });
      i++;
    }

    return tokens;
  }

  /**
   * Basic validation of tokens
   */
  private validate(tokens: IMolangToken[]): IMolangError[] {
    const errors: IMolangError[] = [];

    // Check for balanced parentheses
    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;

    for (const token of tokens) {
      if (token.type === "parenthesis") {
        if (token.value === "(") parenDepth++;
        else parenDepth--;
      }
      if (token.type === "bracket") {
        if (token.value === "[") bracketDepth++;
        else bracketDepth--;
      }
      if (token.type === "brace") {
        if (token.value === "{") braceDepth++;
        else braceDepth--;
      }

      if (parenDepth < 0) {
        errors.push({ message: "Unmatched closing parenthesis", start: token.start, end: token.end });
        parenDepth = 0;
      }
      if (bracketDepth < 0) {
        errors.push({ message: "Unmatched closing bracket", start: token.start, end: token.end });
        bracketDepth = 0;
      }
      if (braceDepth < 0) {
        errors.push({ message: "Unmatched closing brace", start: token.start, end: token.end });
        braceDepth = 0;
      }
    }

    if (parenDepth > 0) {
      errors.push({ message: `Missing ${parenDepth} closing parenthesis`, start: 0, end: 0 });
    }
    if (bracketDepth > 0) {
      errors.push({ message: `Missing ${bracketDepth} closing bracket`, start: 0, end: 0 });
    }
    if (braceDepth > 0) {
      errors.push({ message: `Missing ${braceDepth} closing brace`, start: 0, end: 0 });
    }

    // Check for unknown tokens
    for (const token of tokens) {
      if (token.type === "unknown") {
        errors.push({ message: `Unknown character: ${token.value}`, start: token.start, end: token.end });
      }
    }

    return errors;
  }

  /**
   * Get cursor context in an expression
   */
  public getCursorContext(
    expression: string,
    offset: number
  ): {
    tokenAtCursor: IMolangToken | null;
    prefix: string;
    inFunction: boolean;
    functionName: string | null;
  } {
    const parsed = this.parse(expression);

    let tokenAtCursor: IMolangToken | null = null;
    for (const token of parsed.tokens) {
      if (offset >= token.start && offset <= token.end) {
        tokenAtCursor = token;
        break;
      }
    }

    // Determine prefix being typed
    let prefix = "";
    if (tokenAtCursor) {
      prefix = expression.slice(tokenAtCursor.start, offset);
    }

    // Check if we're inside a function call
    let inFunction = false;
    let functionName: string | null = null;
    let depth = 0;

    for (let i = offset - 1; i >= 0; i--) {
      if (expression[i] === ")") depth++;
      else if (expression[i] === "(") {
        if (depth === 0) {
          inFunction = true;
          // Find function name before the paren
          const beforeParen = expression.slice(0, i);
          const match = beforeParen.match(/([a-zA-Z_][a-zA-Z0-9_.]*)\s*$/);
          if (match) {
            functionName = match[1];
          }
          break;
        }
        depth--;
      }
    }

    return { tokenAtCursor, prefix, inFunction, functionName };
  }
}

// Singleton instance
export const molangParser = new MolangParser();

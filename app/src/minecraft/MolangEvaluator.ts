// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE: MolangEvaluator
 *
 * Evaluates Molang expressions used in Minecraft render controllers, animations,
 * and entity definitions. This is a subset evaluator focused on the expression
 * patterns found in render controllers:
 *
 * - Literals: `1.0`, `0`, `42`
 * - Query references: `query.is_baby`, `q.variant`
 * - Variable references: `variable.index`, `v.armor_texture_slot`
 * - Ternary conditionals: `query.is_baby ? Texture.baby : Texture.default`
 * - Nested ternary: `query.is_angry ? A : (query.is_tamed ? B : C)`
 * - Comparison operators: `==`, `!=`, `<`, `>`, `<=`, `>=`
 * - Logical operators: `&&`, `||`, `!`
 * - Arithmetic: `+`, `-`, `*`, `/`
 * - String references: `Texture.default`, `Geometry.baby`, `Array.geos`
 * - Array indexing: `Array.geos[query.is_sheared]`
 *
 * This evaluator uses a recursive descent parser rather than the existing
 * Molang.ts shunting-yard parser, because render controller expressions
 * contain string references (Texture.*, Geometry.*) and ternary operators
 * that the basic parser doesn't support.
 *
 * Related files:
 * - IMolangContext.ts — query/variable context for evaluation
 * - RenderControllerResolver.ts — uses this to resolve render controller fields
 * - IRenderControllerSet.ts — render controller data structures
 */

import IMolangContext from "./IMolangContext";

/**
 * Result of evaluating a Molang expression. Can be a number (for arithmetic/boolean)
 * or a string (for reference resolution like "Texture.default").
 */
export type MolangValue = number | string;

/**
 * Evaluates Molang expressions against an entity context.
 *
 * Design: stateless evaluator — create once, call evaluate() many times with
 * different expressions and contexts. Array definitions are passed per-call
 * since they come from the render controller, not the entity.
 */
export default class MolangEvaluator {
  /**
   * Evaluate a Molang expression string and return the result.
   *
   * @param expression The Molang expression (e.g., "query.is_baby ? Texture.baby : Texture.default")
   * @param context Entity state context (query values, variables)
   * @param arrays Optional array definitions from render controller (e.g., {"Array.geos": ["Geometry.default", "Geometry.sheared"]})
   * @returns The evaluated result — a number or a string reference
   */
  evaluate(
    expression: string,
    context: IMolangContext,
    arrays?: Map<string, string[]>
  ): MolangValue {
    const trimmed = expression.trim();
    if (trimmed.length === 0) {
      return 0;
    }

    const parser = new ExpressionParser(trimmed, context, arrays);
    return parser.parseTernary();
  }

  /**
   * Evaluate a Molang expression and return only the numeric result.
   * String references resolve to 0.
   */
  evaluateNumber(
    expression: string,
    context: IMolangContext,
    arrays?: Map<string, string[]>
  ): number {
    const result = this.evaluate(expression, context, arrays);
    return typeof result === "number" ? result : 0;
  }

  /**
   * Evaluate a Molang expression and return only the string result.
   * Numeric results resolve to empty string.
   */
  evaluateString(
    expression: string,
    context: IMolangContext,
    arrays?: Map<string, string[]>
  ): string {
    const result = this.evaluate(expression, context, arrays);
    return typeof result === "string" ? result : "";
  }
}

/**
 * Recursive descent parser/evaluator for a single Molang expression.
 * Handles operator precedence via grammar rules:
 *
 *   ternary    → logicalOr ('?' ternary ':' ternary)?
 *   logicalOr  → logicalAnd ('||' logicalAnd)*
 *   logicalAnd → equality ('&&' equality)*
 *   equality   → comparison (('==' | '!=') comparison)*
 *   comparison → additive (('<' | '>' | '<=' | '>=') additive)*
 *   additive   → multiplicative (('+' | '-') multiplicative)*
 *   multiplicative → unary (('*' | '/') unary)*
 *   unary      → '!' unary | primary
 *   primary    → NUMBER | REFERENCE | '(' ternary ')' | arrayAccess
 */
class ExpressionParser {
  private _expr: string;
  private _pos: number;
  private _context: IMolangContext;
  private _arrays: Map<string, string[]> | undefined;

  constructor(
    expr: string,
    context: IMolangContext,
    arrays?: Map<string, string[]>
  ) {
    this._expr = expr;
    this._pos = 0;
    this._context = context;
    this._arrays = arrays;
  }

  parseTernary(): MolangValue {
    const condition = this.parseLogicalOr();

    this.skipWhitespace();
    if (this.peek() === "?") {
      this.advance(); // skip '?'
      const trueBranch = this.parseTernary();
      this.skipWhitespace();
      this.expect(":");
      const falseBranch = this.parseTernary();
      return this.isTruthy(condition) ? trueBranch : falseBranch;
    }

    return condition;
  }

  private parseLogicalOr(): MolangValue {
    let left = this.parseLogicalAnd();

    this.skipWhitespace();
    while (this.matchStr("||")) {
      const right = this.parseLogicalAnd();
      left = (this.isTruthy(left) || this.isTruthy(right)) ? 1 : 0;
    }

    return left;
  }

  private parseLogicalAnd(): MolangValue {
    let left = this.parseEquality();

    this.skipWhitespace();
    while (this.matchStr("&&")) {
      const right = this.parseEquality();
      left = (this.isTruthy(left) && this.isTruthy(right)) ? 1 : 0;
    }

    return left;
  }

  private parseEquality(): MolangValue {
    let left = this.parseComparison();

    this.skipWhitespace();
    if (this.matchStr("==")) {
      const right = this.parseComparison();
      return this.toNumber(left) === this.toNumber(right) ? 1 : 0;
    }
    if (this.matchStr("!=")) {
      const right = this.parseComparison();
      return this.toNumber(left) !== this.toNumber(right) ? 1 : 0;
    }

    return left;
  }

  private parseComparison(): MolangValue {
    let left = this.parseAdditive();

    this.skipWhitespace();
    if (this.matchStr("<=")) {
      return this.toNumber(left) <= this.toNumber(this.parseAdditive()) ? 1 : 0;
    }
    if (this.matchStr(">=")) {
      return this.toNumber(left) >= this.toNumber(this.parseAdditive()) ? 1 : 0;
    }
    if (this.matchStr("<")) {
      return this.toNumber(left) < this.toNumber(this.parseAdditive()) ? 1 : 0;
    }
    if (this.matchStr(">")) {
      return this.toNumber(left) > this.toNumber(this.parseAdditive()) ? 1 : 0;
    }

    return left;
  }

  private parseAdditive(): MolangValue {
    let left = this.parseMultiplicative();

    this.skipWhitespace();
    while (true) {
      if (this.matchStr("+")) {
        left = this.toNumber(left) + this.toNumber(this.parseMultiplicative());
      } else if (this.matchStr("-")) {
        left = this.toNumber(left) - this.toNumber(this.parseMultiplicative());
      } else {
        break;
      }
      this.skipWhitespace();
    }

    return left;
  }

  private parseMultiplicative(): MolangValue {
    let left = this.parseUnary();

    this.skipWhitespace();
    while (true) {
      if (this.matchStr("*")) {
        left = this.toNumber(left) * this.toNumber(this.parseUnary());
      } else if (this.matchStr("/")) {
        const right = this.toNumber(this.parseUnary());
        left = right !== 0 ? this.toNumber(left) / right : 0;
      } else {
        break;
      }
      this.skipWhitespace();
    }

    return left;
  }

  private parseUnary(): MolangValue {
    this.skipWhitespace();
    if (this.matchStr("!")) {
      const val = this.parseUnary();
      return this.isTruthy(val) ? 0 : 1;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): MolangValue {
    this.skipWhitespace();

    // Parenthesized expression
    if (this.peek() === "(") {
      this.advance();
      const val = this.parseTernary();
      this.skipWhitespace();
      if (this.peek() === ")") {
        this.advance();
      }
      return val;
    }

    // Number literal (including negative and decimal)
    if (this.isDigit(this.peek()) || (this.peek() === "-" && this.isDigit(this.peekAt(1)))) {
      return this.parseNumber();
    }

    // Identifier/reference (query.x, variable.y, Texture.default, Array.geos, etc.)
    if (this.isIdentStart(this.peek())) {
      return this.parseReference();
    }

    // Single-quoted string literal
    if (this.peek() === "'") {
      return this.parseStringLiteral();
    }

    // Unknown — return 0
    return 0;
  }

  private parseNumber(): number {
    let numStr = "";
    if (this.peek() === "-") {
      numStr += "-";
      this.advance();
    }
    while (this._pos < this._expr.length && (this.isDigit(this.peek()) || this.peek() === ".")) {
      numStr += this.peek();
      this.advance();
    }
    return parseFloat(numStr) || 0;
  }

  private parseStringLiteral(): string {
    this.advance(); // skip opening '
    let str = "";
    while (this._pos < this._expr.length && this.peek() !== "'") {
      str += this.peek();
      this.advance();
    }
    if (this.peek() === "'") {
      this.advance(); // skip closing '
    }
    return str;
  }

  private parseReference(): MolangValue {
    let ident = this.parseIdentifier();

    // Expand short forms
    if (ident === "q") ident = "query";
    else if (ident === "v") ident = "variable";
    else if (ident === "t") ident = "temp";
    else if (ident === "c") ident = "context";

    // Check for dot-notation: query.is_baby, Texture.default, Array.geos
    if (this.peek() === ".") {
      this.advance(); // skip '.'
      const member = this.parseIdentifier();
      const fullRef = ident + "." + member;

      // Handle query lookups
      if (ident === "query") {
        return this._context.queries.get(fullRef) ?? this._context.queries.get("query." + member) ?? 0;
      }

      // Handle variable lookups
      if (ident === "variable") {
        return this._context.variables.get(fullRef) ?? this._context.variables.get("variable." + member) ?? 0;
      }

      // Handle temp lookups
      if (ident === "temp") {
        return this._context.temps.get(fullRef) ?? this._context.temps.get("temp." + member) ?? 0;
      }

      // Handle Array access: Array.geos[index]
      if (ident === "Array" || ident === "array") {
        this.skipWhitespace();
        if (this.peek() === "[") {
          this.advance(); // skip '['
          const indexVal = this.parseTernary();
          this.skipWhitespace();
          if (this.peek() === "]") {
            this.advance(); // skip ']'
          }
          return this.resolveArrayAccess(fullRef, this.toNumber(indexVal));
        }
        // Array reference without index — return as string
        return fullRef;
      }

      // Anything else (Texture.default, Geometry.baby, Material.body) — return as string reference
      return fullRef;
    }

    // Check for function call: math.sin(x) — simplified, just skip args for now
    if (this.peek() === "(") {
      // For now, evaluate function arguments but return 0 for unsupported functions
      this.advance(); // skip '('
      if (this.peek() !== ")") {
        this.parseTernary(); // evaluate argument (discard result)
      }
      if (this.peek() === ")") {
        this.advance(); // skip ')'
      }
      return 0;
    }

    // Bare identifier — try as variable
    const queryVal = this._context.queries.get("query." + ident);
    if (queryVal !== undefined) return queryVal;

    const varVal = this._context.variables.get("variable." + ident);
    if (varVal !== undefined) return varVal;

    // Could be "this" keyword (passthrough in color context)
    if (ident === "this") return "this";

    return ident;
  }

  private resolveArrayAccess(arrayName: string, index: number): MolangValue {
    if (!this._arrays) return arrayName;

    const arr = this._arrays.get(arrayName);
    if (!arr || arr.length === 0) return arrayName;

    // Molang uses integer index, clamp to valid range
    const idx = Math.max(0, Math.min(Math.floor(index), arr.length - 1));
    return arr[idx];
  }

  private parseIdentifier(): string {
    let id = "";
    while (this._pos < this._expr.length && this.isIdentChar(this.peek())) {
      id += this.peek();
      this.advance();
    }
    return id;
  }

  // -- Helpers --

  private isTruthy(val: MolangValue): boolean {
    if (typeof val === "number") return val !== 0;
    if (typeof val === "string") return val.length > 0;
    return false;
  }

  private toNumber(val: MolangValue): number {
    if (typeof val === "number") return val;
    return 0;
  }

  private peek(): string {
    return this._pos < this._expr.length ? this._expr[this._pos] : "";
  }

  private peekAt(offset: number): string {
    const idx = this._pos + offset;
    return idx < this._expr.length ? this._expr[idx] : "";
  }

  private advance(): void {
    this._pos++;
  }

  private skipWhitespace(): void {
    while (this._pos < this._expr.length && /\s/.test(this._expr[this._pos])) {
      this._pos++;
    }
  }

  private matchStr(s: string): boolean {
    this.skipWhitespace();
    if (this._expr.substring(this._pos, this._pos + s.length) === s) {
      // For multi-char operators, make sure next char isn't part of a longer operator
      if (s.length === 1 && (s === "<" || s === ">" || s === "!")) {
        const next = this.peekAt(s.length);
        if (next === "=") return false;
      }
      this._pos += s.length;
      return true;
    }
    return false;
  }

  private expect(s: string): void {
    this.skipWhitespace();
    if (this._expr.substring(this._pos, this._pos + s.length) === s) {
      this._pos += s.length;
    }
    // Silently skip if missing — defensive for malformed expressions
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }

  private isIdentChar(ch: string): boolean {
    return this.isIdentStart(ch) || this.isDigit(ch) || ch === "_";
  }
}

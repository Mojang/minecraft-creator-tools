// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * # Summarizer Evaluator
 *
 * This class evaluates a summarizer definition against data to produce
 * natural language phrases describing the data.
 *
 * ## Usage
 *
 * ```typescript
 * const evaluator = new SummarizerEvaluator();
 * const result = evaluator.evaluate(summarizer, data, options);
 *
 * console.log(result.phrases);
 * // ["has extremely high health (500 HP)", "can fly and teleport"]
 *
 * console.log(result.asCompleteSentence);
 * // "This entity has extremely high health (500 HP), can fly and teleport."
 * ```
 */

import Log from "../core/Log";
import Utilities from "../core/Utilities";
import ICondition, { ComparisonType } from "./ICondition";
import IFormDefinition from "./IFormDefinition";
import ISummarizer, {
  ISummarizerEvaluatedPhrase,
  ISummarizerEvaluatedResult,
  ISummarizerEvaluatedToken,
  ISummarizerOptions,
  ISummarizerResult,
} from "./ISummarizer";
import {
  IConjunctionToken,
  IExistsToken,
  IGroupToken,
  IListToken,
  ILiteralToken,
  IPluralToken,
  ISampleToken,
  ISummarizerEffects,
  ISummarizerToken,
  ISummarizerTokenBase,
  ISwitchToken,
  ITemplateToken,
  IUnitToken,
  IValueToken,
  SummarizerHumanifyType,
  SummarizerTokenType,
} from "./ISummarizerToken";

/**
 * Evaluates summarizer definitions against data objects.
 *
 * ## Design Philosophy
 *
 * Summarizers are **authored**, not dynamically generated. When creating a
 * summarizer (by AI or human), the author looks at form samples and bakes in
 * meaningful comparisons as literal text (e.g., "stronger than an Iron Golem").
 *
 * This evaluator focuses on:
 * - Evaluating conditions to select which phrases/tokens to display
 * - Formatting values with units and humanification
 * - Combining phrases with proper grammar
 *
 * It does NOT maintain a catalog of reference values - comparisons are
 * baked into the summarizer definition as literal text.
 */
export default class SummarizerEvaluator {
  private formDefinition?: IFormDefinition;
  private currentData?: object;
  private options: ISummarizerOptions;

  /**
   * Create a new SummarizerEvaluator.
   */
  constructor() {
    this.options = {};
  }

  /**
   * Evaluate a summarizer against data to produce natural language phrases.
   *
   * @param summarizer The summarizer definition
   * @param data The data object to summarize
   * @param formDefinition Optional form definition for sample lookup
   * @param options Evaluation options
   * @returns Result containing phrases and formatted output
   *
   * @example
   * const result = evaluator.evaluate(
   *   healthSummarizer,
   *   { max: 500, value: 500 },
   *   healthForm
   * );
   * // result.phrases = ["has god-tier health (500 HP)"]
   * // result.asCompleteSentence = "This entity has god-tier health (500 HP)."
   */
  evaluate(
    summarizer: ISummarizer,
    data: object,
    formDefinition?: IFormDefinition,
    options?: ISummarizerOptions
  ): ISummarizerResult {
    this.formDefinition = formDefinition;
    this.currentData = data;
    this.options = options || {};

    const debug = this.options.debug
      ? {
          includedPhrases: [] as string[],
          excludedPhrases: [] as string[],
          truncatedPhrases: [] as string[],
        }
      : undefined;

    // Evaluate all phrases
    const evaluatedPhrases: { text: string; priority: number; id?: string }[] = [];

    for (const phrase of summarizer.phrases) {
      const phraseId = phrase.id || `phrase_${evaluatedPhrases.length}`;

      // Check category filters
      if (this.options.includeCategories && phrase.category) {
        if (!this.options.includeCategories.includes(phrase.category)) {
          debug?.excludedPhrases.push(phraseId);
          continue;
        }
      }

      if (this.options.excludeCategories && phrase.category) {
        if (this.options.excludeCategories.includes(phrase.category)) {
          debug?.excludedPhrases.push(phraseId);
          continue;
        }
      }

      // Check visibility conditions
      if (phrase.visibility && !this.checkConditions(phrase.visibility, data)) {
        debug?.excludedPhrases.push(phraseId);
        continue;
      }

      // Evaluate the phrase tokens
      const text = this.evaluateTokens(phrase.tokens, data);

      if (text.trim().length > 0) {
        const priority = phrase.priority ?? 2;

        // Check priority filter
        if (this.options.maxPriority !== undefined && priority > this.options.maxPriority) {
          debug?.excludedPhrases.push(phraseId);
          continue;
        }

        evaluatedPhrases.push({
          text: text.trim(),
          priority,
          id: phraseId,
        });
        debug?.includedPhrases.push(phraseId);
      } else {
        debug?.excludedPhrases.push(phraseId);
      }
    }

    // Sort by priority (lower = more important)
    evaluatedPhrases.sort((a, b) => a.priority - b.priority);

    // Apply max phrases limit
    let phrases = evaluatedPhrases.map((p) => p.text);
    if (this.options.maxPhrases !== undefined && phrases.length > this.options.maxPhrases) {
      const truncated = evaluatedPhrases.slice(this.options.maxPhrases);
      debug?.truncatedPhrases.push(...truncated.map((p) => p.id || "unknown"));
      phrases = phrases.slice(0, this.options.maxPhrases);
    }

    // Build result
    const asSentence = this.joinPhrases(phrases);
    const asCompleteSentence = phrases.length > 0 ? `This entity ${asSentence}.` : "";

    return {
      phrases,
      asSentence,
      asCompleteSentence,
      debug,
    };
  }

  /**
   * Evaluate a summarizer against data with structured token output for rich rendering.
   *
   * This method is similar to evaluate() but returns structured data that preserves
   * token boundaries and effects, allowing the UI to render tokens with styling.
   *
   * @param summarizer The summarizer definition
   * @param data The data object to summarize
   * @param formDefinition Optional form definition for sample lookup
   * @param options Evaluation options
   * @returns Result containing structured tokens with effects
   *
   * @example
   * const result = evaluator.evaluateWithEffects(
   *   healthSummarizer,
   *   { max: 500, value: 500 },
   *   healthForm
   * );
   * // result.evaluatedPhrases[0].tokens = [
   * //   { text: "has ", effects: undefined },
   * //   { text: "god-tier health", effects: { emphasis: "strong", sentiment: "positive" } },
   * //   { text: " (", effects: { emphasis: "subtle" } },
   * //   { text: "500 HP", effects: { emphasis: "strong", role: "value" } },
   * //   { text: ")", effects: { emphasis: "subtle" } }
   * // ]
   */
  evaluateWithEffects(
    summarizer: ISummarizer,
    data: object,
    formDefinition?: IFormDefinition,
    options?: ISummarizerOptions
  ): ISummarizerEvaluatedResult {
    this.formDefinition = formDefinition;
    this.currentData = data;
    this.options = options || {};

    const debug = this.options.debug
      ? {
          includedPhrases: [] as string[],
          excludedPhrases: [] as string[],
          truncatedPhrases: [] as string[],
        }
      : undefined;

    // Evaluate all phrases with structured output
    const evaluatedPhrases: ISummarizerEvaluatedPhrase[] = [];

    for (const phrase of summarizer.phrases) {
      const phraseId = phrase.id || `phrase_${evaluatedPhrases.length}`;

      // Check category filters
      if (this.options.includeCategories && phrase.category) {
        if (!this.options.includeCategories.includes(phrase.category)) {
          debug?.excludedPhrases.push(phraseId);
          continue;
        }
      }

      if (this.options.excludeCategories && phrase.category) {
        if (this.options.excludeCategories.includes(phrase.category)) {
          debug?.excludedPhrases.push(phraseId);
          continue;
        }
      }

      // Check visibility conditions
      if (phrase.visibility && !this.checkConditions(phrase.visibility, data)) {
        debug?.excludedPhrases.push(phraseId);
        continue;
      }

      // Check priority filter
      const priority = phrase.priority ?? 2;
      if (this.options.maxPriority !== undefined && priority > this.options.maxPriority) {
        debug?.excludedPhrases.push(phraseId);
        continue;
      }

      // Evaluate the phrase tokens with effects
      const tokens = this.evaluateTokensWithEffects(phrase.tokens, data);
      const plainText = tokens.map((t) => t.text).join("");

      if (plainText.trim().length > 0) {
        evaluatedPhrases.push({
          id: phraseId,
          category: phrase.category,
          priority,
          tokens,
          plainText: plainText.trim(),
        });
        debug?.includedPhrases.push(phraseId);
      } else {
        debug?.excludedPhrases.push(phraseId);
      }
    }

    // Sort by priority (lower = more important)
    evaluatedPhrases.sort((a, b) => a.priority - b.priority);

    // Apply max phrases limit
    let resultPhrases = evaluatedPhrases;
    if (this.options.maxPhrases !== undefined && resultPhrases.length > this.options.maxPhrases) {
      const truncated = resultPhrases.slice(this.options.maxPhrases);
      debug?.truncatedPhrases.push(...truncated.map((p) => p.id || "unknown"));
      resultPhrases = resultPhrases.slice(0, this.options.maxPhrases);
    }

    // Build result
    const phrases = resultPhrases.map((p) => p.plainText);
    const asSentence = this.joinPhrases(phrases);
    const asCompleteSentence = phrases.length > 0 ? `This entity ${asSentence}.` : "";

    return {
      evaluatedPhrases: resultPhrases,
      phrases,
      asSentence,
      asCompleteSentence,
      debug,
    };
  }

  /**
   * Join phrases into a grammatically correct sentence.
   */
  private joinPhrases(phrases: string[]): string {
    if (phrases.length === 0) {
      return "";
    }
    if (phrases.length === 1) {
      return phrases[0];
    }
    if (phrases.length === 2) {
      return `${phrases[0]} and ${phrases[1]}`;
    }

    const allButLast = phrases.slice(0, -1).join(", ");
    return `${allButLast}, and ${phrases[phrases.length - 1]}`;
  }

  /**
   * Evaluate an array of tokens and return structured output with effects.
   *
   * This method preserves token boundaries and effects for rich rendering.
   */
  private evaluateTokensWithEffects(tokens: ISummarizerToken[], data: object): ISummarizerEvaluatedToken[] {
    const result: ISummarizerEvaluatedToken[] = [];

    for (const token of tokens) {
      // Check token visibility
      if (token.visibility && !this.checkConditions(token.visibility, data)) {
        continue;
      }

      const evaluatedTokens = this.evaluateTokenWithEffects(token, data);
      result.push(...evaluatedTokens);
    }

    return result;
  }

  /**
   * Evaluate a single token and return structured output with effects.
   *
   * Some token types (like switch, list, template) recursively evaluate
   * child tokens and inherit effects from the parent.
   */
  private evaluateTokenWithEffects(token: ISummarizerToken, data: object): ISummarizerEvaluatedToken[] {
    const baseEffects = token.effects;

    switch (token.type) {
      case SummarizerTokenType.literal:
      case "literal": {
        const text = (token as ILiteralToken).text;
        if (text) {
          return [{ text, effects: baseEffects }];
        }
        return [];
      }

      case SummarizerTokenType.value:
      case "value": {
        const text = this.evaluateValueToken(token as IValueToken, data);
        if (text) {
          // Value tokens default to "value" role if no effects specified
          const effects = baseEffects || { role: "value" };
          return [{ text, effects }];
        }
        return [];
      }

      case SummarizerTokenType.switch:
      case "switch": {
        const switchToken = token as ISwitchToken;
        for (const switchCase of switchToken.cases) {
          if (this.checkConditions(switchCase.conditions, data)) {
            const childTokens = this.evaluateTokensWithEffects(switchCase.tokens, data);
            // Apply parent effects to children that don't have their own
            return this.applyEffectsToChildren(childTokens, baseEffects);
          }
        }
        if (switchToken.default) {
          const childTokens = this.evaluateTokensWithEffects(switchToken.default, data);
          return this.applyEffectsToChildren(childTokens, baseEffects);
        }
        return [];
      }

      case SummarizerTokenType.list:
      case "list": {
        const listToken = token as IListToken;
        const visibleItems: ISummarizerEvaluatedToken[][] = [];

        for (const item of listToken.items) {
          if (item.visibility && !this.checkConditions(item.visibility, data)) {
            continue;
          }
          const itemTokens = this.evaluateTokensWithEffects(item.tokens, data);
          const itemText = itemTokens.map((t) => t.text).join("");
          if (itemText.trim().length > 0) {
            visibleItems.push(itemTokens);
          }
        }

        if (visibleItems.length === 0) {
          if (listToken.emptyText) {
            return [{ text: listToken.emptyText, effects: baseEffects }];
          }
          return [];
        }

        // Build the list with separators
        const result: ISummarizerEvaluatedToken[] = [];

        // Add prefix
        if (listToken.prefix) {
          result.push(...this.evaluateTokensWithEffects(listToken.prefix, data));
        }

        for (let i = 0; i < visibleItems.length; i++) {
          result.push(...visibleItems[i]);

          if (i < visibleItems.length - 1) {
            let sep: string;
            if (visibleItems.length === 2) {
              sep = listToken.twoItemSeparator ?? " and ";
            } else if (i === visibleItems.length - 2) {
              sep = listToken.finalSeparator ?? ", and ";
            } else {
              sep = listToken.separator ?? ", ";
            }
            result.push({ text: sep, effects: { emphasis: "subtle" } });
          }
        }

        // Add suffix
        if (listToken.suffix) {
          result.push(...this.evaluateTokensWithEffects(listToken.suffix, data));
        }

        return this.applyEffectsToChildren(result, baseEffects);
      }

      case SummarizerTokenType.template:
      case "template": {
        const templateToken = token as ITemplateToken;
        // For templates, we need to parse the template and insert evaluated values
        const result: ISummarizerEvaluatedToken[] = [];
        const template = templateToken.template;
        const parts = template.split(/(\{[^}]+\})/);

        for (const part of parts) {
          if (part.startsWith("{") && part.endsWith("}")) {
            const key = part.slice(1, -1);
            const valueTokens = templateToken.values[key];
            if (valueTokens) {
              result.push(...this.evaluateTokensWithEffects(valueTokens, data));
            }
          } else if (part.length > 0) {
            result.push({ text: part, effects: undefined });
          }
        }

        return this.applyEffectsToChildren(result, baseEffects);
      }

      case SummarizerTokenType.plural:
      case "plural": {
        const text = this.evaluatePluralToken(token as IPluralToken, data);
        if (text) {
          return [{ text, effects: baseEffects }];
        }
        return [];
      }

      case SummarizerTokenType.sample:
      case "sample": {
        const text = this.evaluateSampleToken(token as ISampleToken, data);
        if (text) {
          return [{ text, effects: baseEffects }];
        }
        return [];
      }

      case SummarizerTokenType.unit:
      case "unit": {
        const text = this.evaluateUnitToken(token as IUnitToken, data);
        if (text) {
          // Unit tokens get "value" role for the number and "unit" role overall
          const effects = baseEffects || { role: "value" };
          return [{ text, effects }];
        }
        return [];
      }

      case SummarizerTokenType.exists:
      case "exists": {
        const existsToken = token as IExistsToken;
        const value = this.getFieldValue(existsToken.field, data);
        let isDefined = value !== undefined && value !== null;

        if (isDefined && existsToken.treatEmptyAsUndefined) {
          if (typeof value === "string" && value.length === 0) {
            isDefined = false;
          } else if (Array.isArray(value) && value.length === 0) {
            isDefined = false;
          } else if (typeof value === "object" && Object.keys(value).length === 0) {
            isDefined = false;
          }
        }

        if (isDefined) {
          const childTokens = this.evaluateTokensWithEffects(existsToken.whenDefined, data);
          return this.applyEffectsToChildren(childTokens, baseEffects);
        } else if (existsToken.whenUndefined) {
          const childTokens = this.evaluateTokensWithEffects(existsToken.whenUndefined, data);
          return this.applyEffectsToChildren(childTokens, baseEffects);
        }
        return [];
      }

      case SummarizerTokenType.group:
      case "group": {
        const childTokens = this.evaluateTokensWithEffects((token as IGroupToken).tokens, data);
        return this.applyEffectsToChildren(childTokens, baseEffects);
      }

      case SummarizerTokenType.conjunction:
      case "conjunction": {
        const conjunctionToken = token as IConjunctionToken;
        const visibleItems: ISummarizerEvaluatedToken[][] = [];

        for (const item of conjunctionToken.items) {
          if (item.visibility && !this.checkConditions(item.visibility, data)) {
            continue;
          }
          const itemTokens = this.evaluateTokensWithEffects(item.tokens, data);
          const itemText = itemTokens.map((t) => t.text).join("");
          if (itemText.trim().length > 0) {
            visibleItems.push(itemTokens);
          }
        }

        if (visibleItems.length === 0) {
          return [];
        }

        const result: ISummarizerEvaluatedToken[] = [];
        for (let i = 0; i < visibleItems.length; i++) {
          result.push(...visibleItems[i]);
          if (i < visibleItems.length - 1) {
            result.push({
              text: ` ${conjunctionToken.conjunction} `,
              effects: { emphasis: "subtle" },
            });
          }
        }

        return this.applyEffectsToChildren(result, baseEffects);
      }

      default:
        Log.debug(`Unknown summarizer token type: ${(token as ISummarizerTokenBase).type}`);
        return [];
    }
  }

  /**
   * Apply parent effects to child tokens that don't have their own effects.
   *
   * Child effects take precedence. This allows a parent switch token to
   * set a sentiment (e.g., "positive" for high health) that applies to
   * all its children unless they override it.
   */
  private applyEffectsToChildren(
    children: ISummarizerEvaluatedToken[],
    parentEffects?: ISummarizerEffects
  ): ISummarizerEvaluatedToken[] {
    if (!parentEffects) {
      return children;
    }

    return children.map((child) => {
      if (!child.effects) {
        return { ...child, effects: parentEffects };
      }
      // Merge: child effects take precedence
      return {
        ...child,
        effects: { ...parentEffects, ...child.effects },
      };
    });
  }

  /**
   * Evaluate an array of tokens and concatenate their output.
   */
  private evaluateTokens(tokens: ISummarizerToken[], data: object): string {
    const parts: string[] = [];

    for (const token of tokens) {
      // Check token visibility
      if (token.visibility && !this.checkConditions(token.visibility, data)) {
        continue;
      }

      const text = this.evaluateToken(token, data);
      if (text !== undefined && text !== null) {
        parts.push(text);
      }
    }

    return parts.join("");
  }

  /**
   * Evaluate a single token and return its string output.
   */
  private evaluateToken(token: ISummarizerToken, data: object): string | undefined {
    switch (token.type) {
      case SummarizerTokenType.literal:
      case "literal":
        return (token as ILiteralToken).text;

      case SummarizerTokenType.value:
      case "value":
        return this.evaluateValueToken(token as IValueToken, data);

      case SummarizerTokenType.switch:
      case "switch":
        return this.evaluateSwitchToken(token as ISwitchToken, data);

      case SummarizerTokenType.list:
      case "list":
        return this.evaluateListToken(token as IListToken, data);

      case SummarizerTokenType.template:
      case "template":
        return this.evaluateTemplateToken(token as ITemplateToken, data);

      case SummarizerTokenType.plural:
      case "plural":
        return this.evaluatePluralToken(token as IPluralToken, data);

      case SummarizerTokenType.sample:
      case "sample":
        return this.evaluateSampleToken(token as ISampleToken, data);

      case SummarizerTokenType.unit:
      case "unit":
        return this.evaluateUnitToken(token as IUnitToken, data);

      case SummarizerTokenType.exists:
      case "exists":
        return this.evaluateExistsToken(token as IExistsToken, data);

      case SummarizerTokenType.group:
      case "group":
        return this.evaluateTokens((token as IGroupToken).tokens, data);

      case SummarizerTokenType.conjunction:
      case "conjunction":
        return this.evaluateConjunctionToken(token as IConjunctionToken, data);

      default:
        Log.debug(`Unknown summarizer token type: ${(token as ISummarizerTokenBase).type}`);
        return undefined;
    }
  }

  /**
   * Evaluate a value token: insert a field value from the data.
   */
  private evaluateValueToken(token: IValueToken, data: object): string {
    const value = this.getFieldValue(token.field, data);

    if (value === undefined || value === null) {
      return token.fallback ?? "";
    }

    let result: string;

    // Format the value
    if (token.format) {
      result = this.formatValue(value, token.format);
    } else {
      result = String(value);
    }

    // Apply humanification
    if (token.humanify && token.humanify !== SummarizerHumanifyType.none && token.humanify !== "none") {
      result = this.humanifyValue(result, token.humanify);
    }

    return result;
  }

  /**
   * Evaluate a switch token: select tokens based on conditions.
   */
  private evaluateSwitchToken(token: ISwitchToken, data: object): string | undefined {
    for (const switchCase of token.cases) {
      if (this.checkConditions(switchCase.conditions, data)) {
        return this.evaluateTokens(switchCase.tokens, data);
      }
    }

    if (token.default) {
      return this.evaluateTokens(token.default, data);
    }

    return undefined;
  }

  /**
   * Evaluate a list token: render items as a grammatically correct list.
   */
  private evaluateListToken(token: IListToken, data: object): string {
    const visibleItems: string[] = [];

    for (const item of token.items) {
      // Check item visibility
      if (item.visibility && !this.checkConditions(item.visibility, data)) {
        continue;
      }

      const itemText = this.evaluateTokens(item.tokens, data);
      if (itemText.trim().length > 0) {
        visibleItems.push(itemText.trim());
      }
    }

    if (visibleItems.length === 0) {
      return token.emptyText ?? "";
    }

    // Build the list with proper grammar
    let listText: string;
    if (visibleItems.length === 1) {
      listText = visibleItems[0];
    } else if (visibleItems.length === 2) {
      const sep = token.twoItemSeparator ?? " and ";
      listText = `${visibleItems[0]}${sep}${visibleItems[1]}`;
    } else {
      const separator = token.separator ?? ", ";
      const finalSep = token.finalSeparator ?? ", and ";
      const allButLast = visibleItems.slice(0, -1).join(separator);
      listText = `${allButLast}${finalSep}${visibleItems[visibleItems.length - 1]}`;
    }

    // Add prefix and suffix
    let result = listText;
    if (token.prefix) {
      result = this.evaluateTokens(token.prefix, data) + result;
    }
    if (token.suffix) {
      result = result + this.evaluateTokens(token.suffix, data);
    }

    return result;
  }

  /**
   * Evaluate a template token: string interpolation.
   */
  private evaluateTemplateToken(token: ITemplateToken, data: object): string {
    let result = token.template;

    for (const key in token.values) {
      const valueTokens = token.values[key];
      const valueText = this.evaluateTokens(valueTokens, data);
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), valueText);
    }

    return result;
  }

  /**
   * Evaluate a plural token: handle singular/plural forms.
   */
  private evaluatePluralToken(token: IPluralToken, data: object): string {
    const count = this.getFieldValue(token.countField, data);
    const numCount = typeof count === "number" ? count : parseInt(String(count), 10) || 0;

    let formTokens: ISummarizerToken[];
    if (numCount === 0 && token.zero) {
      formTokens = token.zero;
    } else if (numCount === 1) {
      formTokens = token.singular;
    } else {
      formTokens = token.plural;
    }

    const formText = this.evaluateTokens(formTokens, data);
    const includeCount = token.includeCount !== false;

    if (includeCount) {
      return `${numCount} ${formText}`;
    }

    return formText;
  }

  /**
   * Evaluate a sample token: pull a sample value from the form definition.
   */
  private evaluateSampleToken(token: ISampleToken, data: object): string | undefined {
    if (!this.formDefinition) {
      Log.debug("Sample token used but no form definition provided");
      return undefined;
    }

    // Look for the sample in the form definition
    // Samples are stored in fields as: samples: { "path": [{ content: ... }] }
    let sampleValue: any = undefined;

    // Try to find the sample in the form's fields
    for (const field of this.formDefinition.fields) {
      if (field.samples) {
        const sample = field.samples[token.samplePath];
        if (sample && sample.length > 0) {
          const sampleContent = sample[0].content;
          if (typeof sampleContent === "object" && sampleContent !== null) {
            sampleValue = (sampleContent as any)[token.field];
          } else if (field.id === token.field) {
            sampleValue = sampleContent;
          }
        }
      }
    }

    if (sampleValue === undefined) {
      return undefined;
    }

    // Evaluate the template with sample value available
    const augmentedData = {
      ...data,
      __sampleValue: sampleValue,
      __samplePath: token.samplePath,
      __sampleName: this.humanifyValue(
        token.samplePath.split("/").pop() || token.samplePath,
        token.humanifySampleName || SummarizerHumanifyType.minecraft
      ),
    };

    return this.evaluateTokens(token.template, augmentedData);
  }

  /**
   * Evaluate a unit token: format value with units.
   */
  private evaluateUnitToken(token: IUnitToken, data: object): string {
    const value = this.getFieldValue(token.field, data);
    const numValue = typeof value === "number" ? value : parseFloat(String(value));

    if (isNaN(numValue)) {
      return "";
    }

    // Get the unit string with optional pluralization
    let unitStr = token.unit;
    if (token.pluralize && numValue !== 1) {
      unitStr = token.unitPlural ?? token.unit + "s";
    }

    let result = `${numValue} ${unitStr}`;

    // Add conversion if specified
    if (token.conversion) {
      const convertedValue = numValue * token.conversion.factor;
      const decimals = token.conversion.decimals ?? 1;
      const formattedConverted = convertedValue.toFixed(decimals).replace(/\.?0+$/, "");

      let targetUnit = token.conversion.targetUnit;
      if (token.pluralize && convertedValue !== 1) {
        targetUnit = token.conversion.targetUnitPlural ?? token.conversion.targetUnit + "s";
      }

      if (token.showBoth !== false) {
        const format = token.bothFormat ?? "({value} {unit})";
        const parenthetical = format.replace("{value}", formattedConverted).replace("{unit}", targetUnit);
        result = `${result} ${parenthetical}`;
      } else {
        result = `${formattedConverted} ${targetUnit}`;
      }
    }

    return result;
  }

  /**
   * Evaluate an exists token: check if a field is defined.
   */
  private evaluateExistsToken(token: IExistsToken, data: object): string {
    const value = this.getFieldValue(token.field, data);

    let isDefined = value !== undefined && value !== null;

    // Optionally treat empty values as undefined
    if (isDefined && token.treatEmptyAsUndefined) {
      if (typeof value === "string" && value.length === 0) {
        isDefined = false;
      } else if (Array.isArray(value) && value.length === 0) {
        isDefined = false;
      } else if (typeof value === "object" && Object.keys(value).length === 0) {
        isDefined = false;
      }
    }

    if (isDefined) {
      return this.evaluateTokens(token.whenDefined, data);
    } else if (token.whenUndefined) {
      return this.evaluateTokens(token.whenUndefined, data);
    }

    return "";
  }

  /**
   * Evaluate a conjunction token: join items with a conjunction.
   */
  private evaluateConjunctionToken(token: IConjunctionToken, data: object): string {
    const visibleItems: string[] = [];

    for (const item of token.items) {
      if (item.visibility && !this.checkConditions(item.visibility, data)) {
        continue;
      }

      const itemText = this.evaluateTokens(item.tokens, data);
      if (itemText.trim().length > 0) {
        visibleItems.push(itemText.trim());
      }
    }

    if (visibleItems.length === 0) {
      return "";
    }

    if (visibleItems.length === 1) {
      return visibleItems[0];
    }

    return visibleItems.join(` ${token.conjunction} `);
  }

  /**
   * Get a field value from the data object only (literal value).
   * Does NOT fall back to default values from the form definition.
   * Use this when you need to check if a value is explicitly set.
   * Supports dot notation for nested fields: "damage.min"
   */
  private getLiteralFieldValue(fieldPath: string, data: object): any {
    const parts = fieldPath.split(".");
    let current: any = data;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Get the default value for a field from the form definition.
   */
  private getFieldDefaultValue(fieldPath: string): any {
    if (!this.formDefinition || !this.formDefinition.fields) {
      return undefined;
    }

    // For simple field paths, look up directly
    // For nested paths like "damage.min", we'd need to traverse subforms
    const parts = fieldPath.split(".");
    const fieldId = parts[0];

    for (const field of this.formDefinition.fields) {
      if (field.id === fieldId) {
        if (parts.length === 1) {
          return field.defaultValue;
        }
        // KNOWN LIMITATION: Nested subform default value lookup not implemented.
        // For paths like "damage.min", we would need to:
        // 1. Load the subForm referenced by field.subFormId
        // 2. Look up the remaining path parts in that subForm's fields
        // This is a rare edge case as most summarizers don't reference nested defaults.
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Get a field value from the data object, falling back to the
   * form definition's default value if not explicitly set.
   *
   * This is the "effective" value - what the user would see in the form.
   * Supports dot notation for nested fields: "damage.min"
   */
  private getFieldValue(fieldPath: string, data: object): any {
    // First try to get the literal value from the data
    const literalValue = this.getLiteralFieldValue(fieldPath, data);

    // If it's explicitly set (not undefined), use it
    if (literalValue !== undefined) {
      return literalValue;
    }

    // Fall back to the default value from the form definition
    return this.getFieldDefaultValue(fieldPath);
  }

  /**
   * Check if all conditions are met.
   */
  private checkConditions(conditions: ICondition[], data: object): boolean {
    for (const condition of conditions) {
      if (!this.checkCondition(condition, data)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check a single condition against data.
   * Uses effective values (data + defaults) unless checking for literallyDefined.
   */
  private checkCondition(condition: ICondition, data: object): boolean {
    const comparison = condition.comparison.toLowerCase();

    // For literallyDefined, we check only the actual data, not defaults
    if (comparison === ComparisonType.isLiterallyDefined || comparison === "literallydefined") {
      const literalValue = condition.field ? this.getLiteralFieldValue(condition.field, data) : undefined;
      return literalValue !== undefined && literalValue !== null;
    }

    // For all other comparisons, use effective value (data + defaults)
    const fieldValue = condition.field ? this.getFieldValue(condition.field, data) : undefined;

    switch (comparison) {
      case ComparisonType.equals:
      case "=":
      case "==":
      case "equals":
        if (condition.value !== undefined) {
          return fieldValue === condition.value;
        }
        if (condition.anyValues !== undefined) {
          return (condition.anyValues as (string | number | boolean)[]).includes(
            fieldValue as string | number | boolean
          );
        }
        return false;

      case ComparisonType.lessThan:
      case "<":
        return typeof fieldValue === "number" && fieldValue < (condition.value as number);

      case ComparisonType.lessThanOrEqualTo:
      case "<=":
        return typeof fieldValue === "number" && fieldValue <= (condition.value as number);

      case ComparisonType.greaterThan:
      case ">":
        return typeof fieldValue === "number" && fieldValue > (condition.value as number);

      case ComparisonType.greaterThanOrEqualTo:
      case ">=":
        return typeof fieldValue === "number" && fieldValue >= (condition.value as number);

      case ComparisonType.isDefined:
      case "defined":
        return fieldValue !== undefined && fieldValue !== null;

      case ComparisonType.isNonEmpty:
      case "nonempty":
        if (fieldValue === undefined || fieldValue === null) {
          return false;
        }
        if (typeof fieldValue === "string") {
          return fieldValue.length > 0;
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.length > 0;
        }
        return true;

      case "!=":
      case "notequals":
        return fieldValue !== condition.value;

      default:
        Log.debug(`Unknown comparison type: ${condition.comparison}`);
        return false;
    }
  }

  /**
   * Format a value according to a format string.
   */
  private formatValue(value: any, format: string): string {
    const locale = this.options.locale ?? "en-US";

    if (format === "number") {
      const num = typeof value === "number" ? value : parseFloat(String(value));
      if (!isNaN(num)) {
        return num.toLocaleString(locale);
      }
    }

    if (format === "percent") {
      const num = typeof value === "number" ? value : parseFloat(String(value));
      if (!isNaN(num)) {
        return `${(num * 100).toFixed(0)}%`;
      }
    }

    if (format.startsWith("decimal:")) {
      const decimals = parseInt(format.substring(8), 10);
      const num = typeof value === "number" ? value : parseFloat(String(value));
      if (!isNaN(num)) {
        return num.toFixed(decimals);
      }
    }

    return String(value);
  }

  /**
   * Apply humanification to a value.
   */
  private humanifyValue(value: string, humanifyType: SummarizerHumanifyType | string): string {
    switch (humanifyType) {
      case SummarizerHumanifyType.minecraft:
      case "minecraft":
        return Utilities.humanifyMinecraftName(value) as string;

      case SummarizerHumanifyType.general:
      case "general":
        return Utilities.humanifyJsName(value);

      case SummarizerHumanifyType.sentence:
      case "sentence":
        return value.charAt(0).toUpperCase() + value.slice(1);

      default:
        return value;
    }
  }
}

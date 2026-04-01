// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ========================================================================
 * ARCHITECTURE: Summarizer.tsx
 * ========================================================================
 *
 * The Summarizer component renders natural language descriptions of
 * structured data based on summarizer definitions. It supports both
 * plain text and rich rendering with visual effects.
 *
 * KEY CONCEPTS:
 *
 * 1. PLAIN TEXT MODE:
 *    When `plainText={true}`, renders a simple string without styling.
 *    Good for export, copy/paste, or accessibility.
 *
 * 2. RICH MODE (default):
 *    Renders tokens with effects applied via CSS classes.
 *    Supports emphasis, sentiment (color), badges, and icons.
 *
 * 3. THEMING:
 *    Uses semantic CSS classes that adapt to light/dark themes.
 *    Colors are mapped: positive=green, negative=red, warning=yellow, info=blue.
 *
 * RELATED FILES:
 *    - src/dataform/ISummarizer.ts - Result interfaces
 *    - src/dataform/ISummarizerToken.ts - Token and effect definitions
 *    - src/dataform/SummarizerEvaluator.ts - Evaluation logic
 *    - src/dataformux/Summarizer.css - Styling
 *
 * ========================================================================
 */

import { Component } from "react";
import "./Summarizer.css";
import {
  ISummarizerEvaluatedPhrase,
  ISummarizerEvaluatedResult,
  ISummarizerEvaluatedToken,
} from "../dataform/ISummarizer";
import { ISummarizerEffects, SummarizerEmphasis, SummarizerSentiment } from "../dataform/ISummarizerToken";
import SummarizerEvaluator from "../dataform/SummarizerEvaluator";
import ISummarizer from "../dataform/ISummarizer";
import IProjectTheme from "../UX/types/IProjectTheme";
import IFormDefinition from "../dataform/IFormDefinition";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../app/CreatorToolsHost";

export interface ISummarizerProps {
  /**
   * The summarizer definition to use.
   * If not provided, the component renders nothing.
   */
  summarizer?: ISummarizer;

  /**
   * The data object to summarize.
   */
  data?: object;

  /**
   * Version counter that triggers re-evaluation when data changes.
   * Increment this when the data object is mutated in place.
   */
  dataVersion?: number;

  /**
   * Optional form definition for sample lookups.
   */
  formDefinition?: IFormDefinition;

  /**
   * If true, render as plain text without styling.
   * @default false
   */
  plainText?: boolean;

  /**
   * Literal prefix to prepend to the summary.
   * If specified, the output is: "<prefix> <summary>"
   * Example: prefix="The zombie" → "The zombie has high health"
   */
  prefix?: string;

  /**
   * Noun to use in "This <noun>" prefix.
   * If specified (and prefix is not), the output is: "This <noun> <summary>"
   * Example: noun="entity" → "This entity has high health"
   */
  noun?: string;

  /**
   * Maximum number of phrases to display.
   */
  maxPhrases?: number;

  /**
   * Visual style variant for the container.
   * - "card": Prominent card with background and border
   * - "inline": Inline text, no container styling
   * - "compact": Smaller text, minimal spacing
   * @default "card"
   */
  variant?: "card" | "inline" | "compact";

  /**
   * Optional CSS class name for the container.
   */
  className?: string;

  /**
   * Theme for styling.
   */
  theme?: IProjectTheme;
}

interface ISummarizerState {
  result?: ISummarizerEvaluatedResult;
}

/**
 * Renders a natural language summary of structured data.
 *
 * @example
 * // Basic usage (capitalizes first letter)
 * <Summarizer
 *   summarizer={healthSummarizer}
 *   data={{ max: 500, value: 500 }}
 * />
 * // Renders: "Has god-tier health (500 HP)"
 *
 * @example
 * // With noun (adds "This <noun>" prefix)
 * <Summarizer
 *   summarizer={healthSummarizer}
 *   data={{ max: 500, value: 500 }}
 *   noun="entity"
 * />
 * // Renders: "This entity has god-tier health (500 HP)"
 *
 * @example
 * // With custom prefix
 * <Summarizer
 *   summarizer={healthSummarizer}
 *   data={{ max: 500, value: 500 }}
 *   prefix="The zombie"
 * />
 * // Renders: "The zombie has god-tier health (500 HP)"
 *
 * @example
 * // Plain text mode
 * <Summarizer
 *   summarizer={healthSummarizer}
 *   data={{ max: 500, value: 500 }}
 *   plainText={true}
 * />
 * // Renders plain text without effects
 */
export default class Summarizer extends Component<ISummarizerProps, ISummarizerState> {
  private evaluator: SummarizerEvaluator;

  constructor(props: ISummarizerProps) {
    super(props);

    this.evaluator = new SummarizerEvaluator();
    this.state = {
      result: this.evaluateSummarizer(props),
    };
  }

  componentDidUpdate(prevProps: ISummarizerProps) {
    // Re-evaluate when summarizer, data, or relevant options change
    // Also check dataVersion for when data is mutated in place
    if (
      prevProps.summarizer !== this.props.summarizer ||
      prevProps.data !== this.props.data ||
      prevProps.dataVersion !== this.props.dataVersion ||
      prevProps.maxPhrases !== this.props.maxPhrases ||
      prevProps.formDefinition !== this.props.formDefinition
    ) {
      this.setState({
        result: this.evaluateSummarizer(this.props),
      });
    }
  }

  private evaluateSummarizer(props: ISummarizerProps): ISummarizerEvaluatedResult | undefined {
    if (!props.summarizer || !props.data) {
      return undefined;
    }

    return this.evaluator.evaluateWithEffects(props.summarizer, props.data, props.formDefinition, {
      maxPhrases: props.maxPhrases,
    });
  }

  /**
   * Get CSS class names for a token based on its effects.
   */
  private getTokenClasses(effects?: ISummarizerEffects): string {
    const classes: string[] = ["sum-token"];

    if (!effects) {
      return classes.join(" ");
    }

    // Emphasis
    if (effects.emphasis) {
      switch (effects.emphasis) {
        case SummarizerEmphasis.strong:
        case "strong":
          classes.push("sum-emphasis-strong");
          break;
        case SummarizerEmphasis.subtle:
        case "subtle":
          classes.push("sum-emphasis-subtle");
          break;
      }
    }

    // Sentiment (color)
    if (effects.sentiment) {
      switch (effects.sentiment) {
        case SummarizerSentiment.positive:
        case "positive":
          classes.push("sum-sentiment-positive");
          break;
        case SummarizerSentiment.negative:
        case "negative":
          classes.push("sum-sentiment-negative");
          break;
        case SummarizerSentiment.warning:
        case "warning":
          classes.push("sum-sentiment-warning");
          break;
        case SummarizerSentiment.info:
        case "info":
          classes.push("sum-sentiment-info");
          break;
      }
    }

    // Role
    if (effects.role) {
      classes.push(`sum-role-${effects.role}`);
    }

    // Badge
    if (effects.badge) {
      classes.push("sum-badge");
    }

    return classes.join(" ");
  }

  /**
   * Render a single token with effects.
   */
  private renderToken(token: ISummarizerEvaluatedToken, key: string): JSX.Element {
    const classes = this.getTokenClasses(token.effects);
    const icon = token.effects?.icon;
    const iconPosition = token.effects?.iconPosition || "before";

    if (icon) {
      const iconElement = (
        <span className="sum-icon" key={`${key}-icon`}>
          {icon}
        </span>
      );
      const textElement = <span key={`${key}-text`}>{token.text}</span>;

      return (
        <span className={classes} key={key}>
          {iconPosition === "before" ? (
            <>
              {iconElement}
              {textElement}
            </>
          ) : (
            <>
              {textElement}
              {iconElement}
            </>
          )}
        </span>
      );
    }

    return (
      <span className={classes} key={key}>
        {token.text}
      </span>
    );
  }

  /**
   * Render a phrase as a sequence of tokens.
   * @param capitalizeFirst If true, capitalize the first letter of the first token.
   */
  private renderPhrase(
    phrase: ISummarizerEvaluatedPhrase,
    phraseIndex: number,
    capitalizeFirst: boolean = false
  ): JSX.Element {
    return (
      <span className="sum-phrase" key={phrase.id || `phrase-${phraseIndex}`}>
        {phrase.tokens.map((token, tokenIndex) => {
          // Capitalize first letter of first token if requested
          if (capitalizeFirst && phraseIndex === 0 && tokenIndex === 0 && token.text) {
            const capitalizedToken = {
              ...token,
              text: this.capitalizeFirst(token.text),
            };
            return this.renderToken(capitalizedToken, `${phraseIndex}-${tokenIndex}`);
          }
          return this.renderToken(token, `${phraseIndex}-${tokenIndex}`);
        })}
      </span>
    );
  }

  /**
   * Render all phrases joined with proper grammar.
   * @param capitalizeFirst If true, capitalize the first letter of the first phrase.
   */
  private renderPhrases(result: ISummarizerEvaluatedResult, capitalizeFirst: boolean = false): JSX.Element[] {
    const elements: JSX.Element[] = [];
    const phrases = result.evaluatedPhrases;

    for (let i = 0; i < phrases.length; i++) {
      elements.push(this.renderPhrase(phrases[i], i, capitalizeFirst && i === 0));

      if (i < phrases.length - 1) {
        // Add separator
        if (phrases.length === 2) {
          elements.push(
            <span className="sum-separator" key={`sep-${i}`}>
              {" and "}
            </span>
          );
        } else if (i === phrases.length - 2) {
          elements.push(
            <span className="sum-separator" key={`sep-${i}`}>
              {", and "}
            </span>
          );
        } else {
          elements.push(
            <span className="sum-separator" key={`sep-${i}`}>
              {", "}
            </span>
          );
        }
      }
    }

    return elements;
  }

  /**
   * Capitalize the first letter of a string.
   */
  private capitalizeFirst(text: string): string {
    if (!text || text.length === 0) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Get the effective prefix based on props.
   * Returns: the prefix string to prepend, or undefined if we should capitalize instead.
   */
  private getEffectivePrefix(): string | undefined {
    const { prefix, noun } = this.props;

    if (prefix) {
      return prefix;
    }

    if (noun) {
      return `This ${noun}`;
    }

    return undefined;
  }

  render() {
    const { result } = this.state;
    const { plainText, variant, className } = this.props;

    // No summarizer or no data
    if (!result || result.phrases.length === 0) {
      return null;
    }

    const effectivePrefix = this.getEffectivePrefix();
    const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
    const themeClass = isDark ? "sum-dark" : "sum-light";

    // Plain text mode
    if (plainText) {
      let text = result.asSentence;
      if (effectivePrefix) {
        text = `${effectivePrefix} ${text}`;
      } else {
        text = this.capitalizeFirst(text);
      }
      return <span className={`sum-plain ${themeClass} ${className || ""}`}>{text}</span>;
    }

    // Determine container class
    const variantClass = `sum-${variant || "card"}`;
    const containerClass = `sum-container ${variantClass} ${themeClass} ${className || ""}`.trim();

    // Build the content
    // If we have a prefix, render it; otherwise capitalize the first token
    const shouldCapitalizeFirst = !effectivePrefix;
    const phraseElements = this.renderPhrases(result, shouldCapitalizeFirst);

    let content;
    if (effectivePrefix) {
      content = (
        <>
          <span className="sum-prefix">{effectivePrefix} </span>
          {phraseElements}
        </>
      );
    } else {
      // No prefix - phrases already have first letter capitalized
      content = <>{phraseElements}</>;
    }

    return <div className={containerClass}>{content}</div>;
  }
}

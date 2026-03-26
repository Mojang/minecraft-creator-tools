/**
 * ValueDecoratorProvider.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This provider adds visual decorations to JSON values in the Monaco editor.
 * It uses the IFieldValueSummarizer from IField to determine how each value
 * should be visualized.
 *
 * SUPPORTED DECORATION TYPES (from FieldValueSummarizerType):
 * - healthBar: Shows ❤️ icons scaled to value
 * - probabilityBar: Shows percentage bar 0-100%
 * - scale: Shows scale indicator with x multiplier
 * - time: Converts ticks to human-readable time
 * - distance: Shows distance in blocks
 * - color: Shows color swatch for color values
 * - comparison: Shows "faster than X" style comparisons
 * - qualitative: Shows "very low" / "high" etc. based on thresholds
 *
 * MONACO DECORATIONS:
 * We use afterContentClassName to inject CSS-styled pseudo-elements after values.
 * This allows us to show additional context without modifying the actual text.
 *
 * PERFORMANCE:
 * Decorations are debounced and only recalculated when:
 * - File context changes
 * - Editor content changes (with 250ms debounce)
 *
 * USAGE:
 * ```typescript
 * const decorator = new ValueDecoratorProvider(pathResolver, formCache);
 * decorator.updateContext(projectItem, project);
 * decorator.applyDecorations(editor);
 * // Later: decorator.dispose();
 * ```
 *
 * DATA FLOW:
 * 1. Parse JSON to find all value positions
 * 2. For each value, resolve JSON path
 * 3. Look up field definition in form
 * 4. If field has valueSummarizer, generate decoration
 * 5. Apply all decorations to Monaco editor
 */

import * as monaco from "monaco-editor";
import Utilities from "../../core/Utilities";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import { JsonPathResolver } from "./JsonPathResolver";
import { FormDefinitionCache } from "./FormDefinitionCache";
import IField, {
  FieldValueSummarizerType,
  IFieldValueSummarizer,
  IFieldValueReference,
  IFieldValueThreshold,
} from "../../dataform/IField";
import IFormDefinition from "../../dataform/IFormDefinition";

/**
 * Interface for a single decoration entry
 */
interface IValueDecoration {
  range: monaco.Range;
  fieldPath: string;
  value: unknown;
  summarizer: IFieldValueSummarizer;
  text: string;
  className: string;
}

/**
 * Provides visual value decorations for Minecraft JSON files
 */
export class ValueDecoratorProvider {
  private pathResolver: JsonPathResolver;
  private formCache: FormDefinitionCache;
  private projectItem?: ProjectItem;
  private project?: Project;

  // Monaco decoration collection ID
  private decorationIds: string[] = [];

  // Debounce timer for content changes
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 250;

  constructor(pathResolver: JsonPathResolver, formCache: FormDefinitionCache) {
    this.pathResolver = pathResolver;
    this.formCache = formCache;
  }

  /**
   * Update the file context for decoration generation
   */
  public updateContext(projectItem?: ProjectItem, project?: Project): void {
    this.projectItem = projectItem;
    this.project = project;
  }

  /**
   * Apply decorations to an editor (with debouncing)
   */
  public applyDecorations(editor: monaco.editor.IStandaloneCodeEditor): void {
    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce the decoration application
    this.debounceTimer = setTimeout(() => {
      this.doApplyDecorations(editor);
    }, this.DEBOUNCE_MS);
  }

  /**
   * Actually apply the decorations
   */
  private async doApplyDecorations(editor: monaco.editor.IStandaloneCodeEditor): Promise<void> {
    const model = editor.getModel();
    if (!model) {
      return;
    }

    const content = model.getValue();
    if (!content.trim()) {
      // Clear decorations if content is empty
      this.decorationIds = editor.deltaDecorations(this.decorationIds, []);
      return;
    }

    // Get form for this file type
    if (!this.projectItem) {
      return;
    }
    const form = await this.formCache.getFormForItemType(this.projectItem.itemType);
    if (!form) {
      return;
    }

    try {
      const json = JSON.parse(Utilities.fixJsonContent(content));
      const decorations = await this.generateDecorations(model, json, form);

      // Convert to Monaco decorations
      const monacoDecorations: monaco.editor.IModelDeltaDecoration[] = decorations.map((dec) => ({
        range: dec.range,
        options: {
          after: {
            content: ` ${dec.text}`,
            inlineClassName: `mct-value-decoration ${dec.className}`,
          },
          hoverMessage: {
            value: this.getDecorationHoverMessage(dec),
          },
        },
      }));

      // Apply decorations
      this.decorationIds = editor.deltaDecorations(this.decorationIds, monacoDecorations);
    } catch {
      // Invalid JSON - clear decorations
      this.decorationIds = editor.deltaDecorations(this.decorationIds, []);
    }
  }

  /**
   * Collect all JSON values with their paths
   */
  private collectJsonValues(obj: unknown, path: string[], results: Array<{ path: string[]; value: unknown }>): void {
    // Collect this value
    results.push({ path: [...path], value: obj });

    if (typeof obj !== "object" || obj === null) {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const itemPath = [...path, String(index)];
        this.collectJsonValues(item, itemPath, results);
      });
    } else {
      for (const [key, value] of Object.entries(obj)) {
        const keyPath = [...path, key];
        this.collectJsonValues(value, keyPath, results);
      }
    }
  }

  /**
   * Generate all decorations for the document
   */
  private async generateDecorations(
    model: monaco.editor.ITextModel,
    json: unknown,
    form: IFormDefinition
  ): Promise<IValueDecoration[]> {
    const decorations: IValueDecoration[] = [];

    // Collect all JSON values with their paths
    const jsonValues: Array<{ path: string[]; value: unknown }> = [];
    this.collectJsonValues(json, [], jsonValues);

    // Process each value - look up field definitions asynchronously
    for (const { path: pathArr, value } of jsonValues) {
      // Look up the field definition using async method that follows subFormId
      const field = await this.formCache.getFieldAtPathAsync(form, pathArr);
      if (!field || !field.valueSummarizer) {
        continue;
      }

      // Find the position of this value in the document
      const range = this.findValueRange(model, pathArr);
      if (!range) {
        continue;
      }

      // Generate the decoration
      const pathStr = pathArr.join(".");
      const decoration = this.generateDecoration(pathStr, value, field, range);
      if (decoration) {
        decorations.push(decoration);
      }
    }

    return decorations;
  }

  /**
   * Walk JSON tree calling callback for each value
   * @deprecated Use collectJsonValues for async-compatible processing
   */
  private walkJson(obj: unknown, path: string[], callback: (path: string[], value: unknown) => void): void {
    // Call for this value
    callback(path, obj);

    if (typeof obj !== "object" || obj === null) {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const itemPath = [...path, String(index)];
        this.walkJson(item, itemPath, callback);
      });
    } else {
      for (const [key, value] of Object.entries(obj)) {
        const keyPath = [...path, key];
        this.walkJson(value, keyPath, callback);
      }
    }
  }

  /**
   * Find the Monaco range for a value at a given path
   */
  private findValueRange(model: monaco.editor.ITextModel, path: string[]): monaco.Range | null {
    // Use path resolver to find the offset
    const content = model.getValue();
    const offsetResult = this.pathResolver.findPathOffset(content, path);
    if (!offsetResult) {
      return null;
    }

    const offset = offsetResult.start;
    // Find the value end by scanning forward
    let endOffset = offset;
    const ch = content[offset];

    if (ch === '"') {
      // String value - find closing quote
      endOffset = offset + 1;
      while (endOffset < content.length) {
        if (content[endOffset] === '"' && content[endOffset - 1] !== "\\") {
          endOffset++;
          break;
        }
        endOffset++;
      }
    } else if (ch === "{" || ch === "[") {
      // Object/array - find matching bracket
      let depth = 1;
      endOffset = offset + 1;
      while (endOffset < content.length && depth > 0) {
        const c = content[endOffset];
        if (c === "{" || c === "[") depth++;
        if (c === "}" || c === "]") depth--;
        endOffset++;
      }
    } else {
      // Number, boolean, null - scan until delimiter
      endOffset = offset;
      while (endOffset < content.length && !/[,}\]\s]/.test(content[endOffset])) {
        endOffset++;
      }
    }

    // Convert offsets to positions
    const startPos = model.getPositionAt(offset);
    const endPos = model.getPositionAt(endOffset);

    return new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
  }

  /**
   * Generate a decoration for a specific value
   */
  private generateDecoration(
    path: string,
    value: unknown,
    field: IField,
    range: monaco.Range
  ): IValueDecoration | null {
    const summarizer = field.valueSummarizer;
    if (!summarizer) return null;

    let text = "";
    let className = "";

    switch (summarizer.type) {
      case FieldValueSummarizerType.healthBar:
        ({ text, className } = this.formatHealthBar(value, summarizer));
        break;

      case FieldValueSummarizerType.probabilityBar:
        ({ text, className } = this.formatProbabilityBar(value, summarizer));
        break;

      case FieldValueSummarizerType.scale:
        ({ text, className } = this.formatScale(value, summarizer));
        break;

      case FieldValueSummarizerType.time:
        ({ text, className } = this.formatTime(value, summarizer));
        break;

      case FieldValueSummarizerType.distance:
        ({ text, className } = this.formatDistance(value, summarizer));
        break;

      case FieldValueSummarizerType.color:
        ({ text, className } = this.formatColor(value, summarizer));
        break;

      case FieldValueSummarizerType.comparison:
        ({ text, className } = this.formatComparison(value, summarizer));
        break;

      case FieldValueSummarizerType.qualitative:
        ({ text, className } = this.formatQualitative(value, summarizer));
        break;

      default:
        ({ text, className } = this.formatText(value, summarizer));
    }

    if (!text) return null;

    return {
      range,
      fieldPath: path,
      value,
      summarizer,
      text,
      className,
    };
  }

  /**
   * Format value as health bar (❤️ ❤️ ❤️)
   */
  private formatHealthBar(value: unknown, summarizer: IFieldValueSummarizer): { text: string; className: string } {
    const num = this.toNumber(value);
    if (num === null) return { text: "", className: "" };

    const maxRef = summarizer.maxReference || 100;
    const icon = summarizer.icon || "❤️";
    const unit = summarizer.unit || "HP";

    // Calculate number of hearts (max 5)
    const hearts = Math.min(5, Math.max(1, Math.round((num / maxRef) * 5)));
    const heartStr = icon.repeat(hearts);

    return {
      text: `${heartStr} (${num} ${unit})`,
      className: "mct-health-bar",
    };
  }

  /**
   * Format value as probability bar
   */
  private formatProbabilityBar(value: unknown, summarizer: IFieldValueSummarizer): { text: string; className: string } {
    const num = this.toNumber(value);
    if (num === null) return { text: "", className: "" };

    // Determine if it's 0-1 or 0-100 scale
    const isNormalized = num <= 1;
    const percentage = isNormalized ? num * 100 : num;
    const display = percentage.toFixed(1);

    // Generate visual bar
    const filled = Math.round(percentage / 10);
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);

    return {
      text: `${bar} ${display}%`,
      className:
        percentage > 75 ? "mct-probability-high" : percentage > 25 ? "mct-probability-med" : "mct-probability-low",
    };
  }

  /**
   * Format value as scale indicator
   */
  private formatScale(value: unknown, summarizer: IFieldValueSummarizer): { text: string; className: string } {
    const num = this.toNumber(value);
    if (num === null) return { text: "", className: "" };

    const format = summarizer.format || "{value}x";
    const display = format.replace("{value}", num.toFixed(2));

    let className = "mct-scale-normal";
    if (num > 1.5) className = "mct-scale-large";
    else if (num < 0.5) className = "mct-scale-small";

    return { text: display, className };
  }

  /**
   * Format value as time (ticks to seconds)
   */
  private formatTime(value: unknown, summarizer: IFieldValueSummarizer): { text: string; className: string } {
    const num = this.toNumber(value);
    if (num === null) return { text: "", className: "" };

    // Assume input is in ticks (20 ticks = 1 second)
    const seconds = num / 20;

    let display: string;
    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      display = `${minutes}m ${secs}s`;
    } else if (seconds >= 1) {
      display = `${seconds.toFixed(1)}s`;
    } else {
      display = `${num} ticks`;
    }

    return {
      text: `⏱️ ${display}`,
      className: "mct-time",
    };
  }

  /**
   * Format value as distance
   */
  private formatDistance(value: unknown, summarizer: IFieldValueSummarizer): { text: string; className: string } {
    const num = this.toNumber(value);
    if (num === null) return { text: "", className: "" };

    const unit = summarizer.unit || "blocks";

    return {
      text: `📏 ${num} ${unit}`,
      className: "mct-distance",
    };
  }

  /**
   * Format value as color swatch
   */
  private formatColor(value: unknown, summarizer: IFieldValueSummarizer): { text: string; className: string } {
    // Handle various color formats
    let colorStr = "";

    if (typeof value === "string") {
      colorStr = value;
    } else if (Array.isArray(value)) {
      // RGB or RGBA array
      if (value.length >= 3) {
        const [r, g, b] = value.map((v) => Math.round(Number(v) * (value[0] > 1 ? 1 : 255)));
        // Intentionally inline RGB — represents actual color values from JSON content
        colorStr = `rgb(${r},${g},${b})`;
      }
    }

    if (!colorStr) return { text: "", className: "" };

    // We can't actually show colors in Monaco inline decorations easily,
    // so we show a color emoji and the value
    return {
      text: `🎨 ${colorStr}`,
      className: "mct-color",
    };
  }

  /**
   * Format value with comparison to references
   */
  private formatComparison(value: unknown, summarizer: IFieldValueSummarizer): { text: string; className: string } {
    const num = this.toNumber(value);
    if (num === null || !summarizer.references) return { text: "", className: "" };

    // Sort references by value
    const refs = [...summarizer.references].sort((a, b) => a.value - b.value);

    // Find the closest reference
    let closest: IFieldValueReference | null = null;
    let comparison = "";

    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (num < ref.value * 0.9) {
        // Significantly less than this reference
        comparison = `slower than ${ref.label}`;
        closest = ref;
        break;
      } else if (num >= ref.value * 0.9 && num <= ref.value * 1.1) {
        // About equal
        comparison = `similar to ${ref.label}`;
        closest = ref;
        break;
      } else if (i === refs.length - 1) {
        // Greater than all references
        comparison = `faster than ${ref.label}`;
        closest = ref;
      }
    }

    if (!closest) return { text: "", className: "" };

    const icon = closest.icon || "";
    return {
      text: icon ? `${icon} ${comparison}` : comparison,
      className: "mct-comparison",
    };
  }

  /**
   * Format value with qualitative thresholds
   */
  private formatQualitative(value: unknown, summarizer: IFieldValueSummarizer): { text: string; className: string } {
    const num = this.toNumber(value);
    if (num === null || !summarizer.thresholds) return { text: "", className: "" };

    // Sort thresholds by maxValue
    const thresholds = [...summarizer.thresholds].sort((a, b) => a.maxValue - b.maxValue);

    // Find the applicable threshold
    let matched: IFieldValueThreshold | null = null;
    for (const threshold of thresholds) {
      if (num <= threshold.maxValue) {
        matched = threshold;
        break;
      }
    }

    // Use last threshold if value exceeds all
    if (!matched && thresholds.length > 0) {
      matched = thresholds[thresholds.length - 1];
    }

    if (!matched) return { text: "", className: "" };

    const sentimentClass = matched.sentiment ? `mct-sentiment-${matched.sentiment}` : "";

    return {
      text: matched.description,
      className: `mct-qualitative ${sentimentClass}`,
    };
  }

  /**
   * Default text formatting
   */
  private formatText(value: unknown, summarizer: IFieldValueSummarizer): { text: string; className: string } {
    const num = this.toNumber(value);
    const unit = summarizer.unit || "";

    if (num !== null && unit) {
      return {
        text: `${num} ${unit}`,
        className: "mct-text",
      };
    }

    return { text: "", className: "" };
  }

  /**
   * Convert value to number if possible
   */
  private toNumber(value: unknown): number | null {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }
    return null;
  }

  /**
   * Generate hover message for a decoration
   */
  private getDecorationHoverMessage(decoration: IValueDecoration): string {
    const summarizer = decoration.summarizer;
    let message = `**${decoration.fieldPath}**\n\n`;

    message += `Value: \`${JSON.stringify(decoration.value)}\`\n\n`;
    message += `Visualization: ${summarizer.type}\n`;

    if (summarizer.unit) {
      message += `Unit: ${summarizer.unit}\n`;
    }

    if (summarizer.references) {
      message += "\n**Reference values:**\n";
      for (const ref of summarizer.references) {
        message += `- ${ref.label}: ${ref.value}\n`;
      }
    }

    return message;
  }

  /**
   * Dispose of the decorator
   */
  public dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}

/**
 * CSS styles that should be added to the page for value decorations.
 * These can be injected via a style tag or included in a CSS file.
 */
export const VALUE_DECORATOR_STYLES = `
  .mct-value-decoration {
    font-size: 0.9em;
    opacity: 0.8;
    margin-left: 4px;
    font-family: monospace;
  }

  .mct-health-bar {
    color: #e74c3c;
  }

  .mct-probability-high {
    color: #27ae60;
  }

  .mct-probability-med {
    color: #f39c12;
  }

  .mct-probability-low {
    color: #e74c3c;
  }

  .mct-scale-normal {
    color: #3498db;
  }

  .mct-scale-large {
    color: #9b59b6;
  }

  .mct-scale-small {
    color: #95a5a6;
  }

  .mct-time {
    color: #1abc9c;
  }

  .mct-distance {
    color: #3498db;
  }

  .mct-color {
    color: #9b59b6;
  }

  .mct-comparison {
    color: #f39c12;
  }

  .mct-qualitative {
    font-style: italic;
  }

  .mct-sentiment-positive {
    color: #27ae60;
  }

  .mct-sentiment-negative {
    color: #e74c3c;
  }

  .mct-sentiment-warning {
    color: #f39c12;
  }

  .mct-sentiment-neutral {
    color: #95a5a6;
  }

  /* Component Summary Styles - subtle inline summaries for minecraft: components */
  /* These appear as visual "badges" to clearly distinguish from actual code */
  .mct-component-summary {
    color: #6b7785;
    font-style: normal;
    font-size: 0.82em;
    opacity: 0.65;
    background-color: rgba(100, 120, 140, 0.08);
    border: 1px solid rgba(100, 120, 140, 0.15);
    border-radius: 3px;
    padding: 1px 5px;
    margin-left: 8px;
    white-space: nowrap;
    display: inline-block;
  }

  .mct-component-summary-fallback {
    color: #8a939d;
    font-style: normal;
    font-size: 0.82em;
    opacity: 0.55;
    background-color: rgba(138, 147, 157, 0.06);
    border: 1px solid rgba(138, 147, 157, 0.12);
    border-radius: 3px;
    padding: 1px 5px;
    margin-left: 8px;
    white-space: nowrap;
    display: inline-block;
  }

  .mct-component-group-summary {
    color: #5a8e5a;
    font-style: normal;
    font-size: 0.85em;
    opacity: 0.7;
    background-color: rgba(90, 158, 74, 0.08);
    border: 1px solid rgba(90, 158, 74, 0.15);
    border-radius: 3px;
    padding: 1px 5px;
    margin-left: 8px;
    white-space: nowrap;
    display: inline-block;
  }

  .mct-event-summary {
    color: #8a6d3b;
    font-style: normal;
    font-size: 0.82em;
    opacity: 0.7;
    background-color: rgba(180, 140, 60, 0.08);
    border: 1px solid rgba(180, 140, 60, 0.15);
    border-radius: 3px;
    padding: 1px 5px;
    margin-left: 8px;
    white-space: nowrap;
    display: inline-block;
  }

  /* Dark theme adjustments */
  .monaco-editor.vs-dark .mct-component-summary,
  .monaco-editor.hc-black .mct-component-summary {
    color: #7a8b9a;
    background-color: rgba(122, 139, 154, 0.1);
    border-color: rgba(122, 139, 154, 0.2);
  }

  .monaco-editor.vs-dark .mct-component-summary-fallback,
  .monaco-editor.hc-black .mct-component-summary-fallback {
    color: #6a7580;
    background-color: rgba(106, 117, 128, 0.08);
    border-color: rgba(106, 117, 128, 0.15);
  }

  .monaco-editor.vs-dark .mct-component-group-summary,
  .monaco-editor.hc-black .mct-component-group-summary {
    color: #5a9955;
    background-color: rgba(90, 153, 85, 0.1);
    border-color: rgba(90, 153, 85, 0.2);
  }

  .monaco-editor.vs-dark .mct-event-summary,
  .monaco-editor.hc-black .mct-event-summary {
    color: #d4a944;
    background-color: rgba(212, 169, 68, 0.1);
    border-color: rgba(212, 169, 68, 0.2);
  }
`;

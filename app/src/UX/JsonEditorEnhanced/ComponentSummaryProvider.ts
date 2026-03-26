/**
 * ComponentSummaryProvider.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This provider displays concise, natural-language summaries for Minecraft
 * components inline in the Monaco editor. It creates subtle, non-intrusive
 * decorations that appear to the right of component keys.
 *
 * KEY CONCEPTS:
 * - Component Key Detection: Finds JSON keys like "minecraft:health": {...}
 * - Form-Based Summarization: Uses ISummarizer from form definitions
 * - Inline Decorations: Uses Monaco's decoration API with after.content
 *
 * VISUAL APPEARANCE:
 * - Summaries appear after the component key line in a subtle gray color
 * - Example: "minecraft:health": {    // has 20 health points
 * - Styled to be informative but not distracting
 *
 * DATA FLOW:
 * 1. Parse JSON to find component keys (minecraft:xxx)
 * 2. For each component, load its form definition (entity/minecraft_xxx.form.json)
 * 3. If form has a summarizer, evaluate it against the component data
 * 4. Create a Monaco decoration showing the summary after the key line
 *
 * RELATED FILES:
 * - ValueDecoratorProvider.ts - Similar decoration approach for field values
 * - FoldingSummaryProvider.ts - Has component summarization but for folded regions
 * - SummarizerEvaluator.ts - Evaluates summarizer definitions
 * - FormDefinitionCache.ts - Caches and provides form definitions
 *
 * PERFORMANCE CONSIDERATIONS:
 * - Uses async form loading with caching
 * - Only processes visible components (could be optimized further)
 * - Debounces updates when content changes
 */

import * as monaco from "monaco-editor";
import Database from "../../minecraft/Database";
import SummarizerEvaluator from "../../dataform/SummarizerEvaluator";
import { JsonPathResolver } from "./JsonPathResolver";
import Log from "../../core/Log";
import Utilities from "../../core/Utilities";

/**
 * A single component summary decoration
 */
export interface IComponentSummary {
  /** The component ID (e.g., "minecraft:health") */
  componentId: string;
  /** The line number where the component key appears */
  lineNumber: number;
  /** The summarized text to display */
  summaryText: string;
  /** The Monaco decoration */
  decoration: monaco.editor.IModelDeltaDecoration;
}

/**
 * Provides inline component summaries using Monaco decorations
 */
export class ComponentSummaryProvider {
  private pathResolver: JsonPathResolver;
  private currentDecorations: string[] = [];
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private readonly DEBOUNCE_MS = 300;

  constructor() {
    this.pathResolver = new JsonPathResolver();
  }

  /**
   * Check if model is still valid (not disposed)
   */
  private isModelValid(model: monaco.editor.ITextModel | null): model is monaco.editor.ITextModel {
    if (!model) {
      return false;
    }
    try {
      // isDisposed() is the standard Monaco API to check if model is disposed
      return !model.isDisposed();
    } catch {
      // If checking throws, model is definitely not usable
      return false;
    }
  }

  /**
   * Update component summaries for the given editor
   */
  public async update(editor: monaco.editor.IStandaloneCodeEditor): Promise<void> {
    const model = editor.getModel();
    if (!this.isModelValid(model)) {
      Log.verbose("[ComponentSummaryProvider] No model or model disposed");
      return;
    }

    const content = model.getValue();
    if (!content.trim()) {
      this.clearDecorations(editor);
      return;
    }

    // Parse JSON
    let json: unknown;
    try {
      json = JSON.parse(Utilities.fixJsonContent(content));
    } catch {
      // Invalid JSON, clear decorations
      this.clearDecorations(editor);
      return;
    }

    Log.verbose("[ComponentSummaryProvider] Finding component summaries...");

    // Find all component keys and generate summaries
    const summaries = await this.findComponentSummaries(model, json);

    // Check if model is still valid after async operations
    if (!this.isModelValid(model)) {
      Log.verbose("[ComponentSummaryProvider] Model disposed during async operation");
      return;
    }

    Log.verbose(`[ComponentSummaryProvider] Found ${summaries.length} summaries`);

    // Apply decorations
    this.applyDecorations(editor, summaries);
  }

  /**
   * Schedule a debounced update
   */
  public scheduleUpdate(editor: monaco.editor.IStandaloneCodeEditor): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.update(editor).catch((err) => {
        Log.debug("ComponentSummaryProvider update failed: " + err);
      });
    }, this.DEBOUNCE_MS);
  }

  /**
   * Clear all decorations
   */
  public clearDecorations(editor: monaco.editor.IStandaloneCodeEditor): void {
    this.currentDecorations = editor.deltaDecorations(this.currentDecorations, []);
  }

  /**
   * Find all component keys and generate summaries
   */
  private async findComponentSummaries(model: monaco.editor.ITextModel, json: unknown): Promise<IComponentSummary[]> {
    const summaries: IComponentSummary[] = [];

    // Check model validity before accessing
    if (!this.isModelValid(model)) {
      return summaries;
    }

    const content = model.getValue();

    // Find component containers: components, component_groups.*, and top-level minecraft: keys
    await this.searchForComponents(model, content, json, [], summaries);

    return summaries;
  }

  /**
   * Recursively search for component containers and generate summaries
   */
  private async searchForComponents(
    model: monaco.editor.ITextModel,
    content: string,
    obj: unknown,
    path: string[],
    summaries: IComponentSummary[]
  ): Promise<void> {
    // Early exit if model is disposed
    if (!this.isModelValid(model)) {
      return;
    }

    if (typeof obj !== "object" || obj === null) {
      return;
    }

    const record = obj as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      const keyPath = [...path, key];

      // Check if this is a component container
      if (this.isComponentContainer(keyPath)) {
        // Process components within this container
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          await this.processComponents(model, content, value as Record<string, unknown>, keyPath, summaries);
        }
      }

      // Check if this is an events container
      if (key === "events" && typeof value === "object" && value !== null && !Array.isArray(value)) {
        Log.debug(`[ComponentSummaryProvider] Found events at path: ${keyPath.join(".")}`);
        await this.processEvents(model, content, value as Record<string, unknown>, keyPath, summaries);
      }

      // Check if this is a component_groups container
      if (key === "component_groups" && typeof value === "object" && value !== null) {
        Log.debug(`[ComponentSummaryProvider] Found component_groups at path: ${keyPath.join(".")}`);
        // Each child is a component group containing components
        for (const [groupName, groupValue] of Object.entries(value as Record<string, unknown>)) {
          Log.debug(`[ComponentSummaryProvider] Processing group: ${groupName}`);
          if (typeof groupValue === "object" && groupValue !== null) {
            // Generate summary for the group itself
            await this.processComponentGroup(
              model,
              content,
              groupValue as Record<string, unknown>,
              [...keyPath, groupName],
              summaries
            );

            // Process components within the group
            await this.processComponents(
              model,
              content,
              groupValue as Record<string, unknown>,
              [...keyPath, groupName],
              summaries
            );
          }
        }
      }

      // Continue searching deeper
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        await this.searchForComponents(model, content, value, keyPath, summaries);
      }
    }
  }

  /**
   * Process events and generate summaries for each event
   */
  private async processEvents(
    model: monaco.editor.ITextModel,
    content: string,
    events: Record<string, unknown>,
    containerPath: string[],
    summaries: IComponentSummary[]
  ): Promise<void> {
    for (const [eventName, eventData] of Object.entries(events)) {
      if (typeof eventData !== "object" || eventData === null) {
        continue;
      }

      const eventPath = [...containerPath, eventName];
      const lineNumber = this.findKeyLine(model, content, eventPath);
      if (!lineNumber) {
        continue;
      }

      const summaryText = this.generateEventSummary(eventData as Record<string, unknown>);
      if (!summaryText) {
        continue;
      }

      summaries.push({
        componentId: eventName,
        lineNumber,
        summaryText,
        decoration: this.createDecoration(lineNumber, summaryText, "event-summary"),
      });
    }
  }

  /**
   * Generate a human-readable summary for an entity event.
   * Handles: add/remove, randomize, sequence, trigger.
   */
  private generateEventSummary(eventData: Record<string, unknown>): string {
    try {
      const parts: string[] = [];

      // Check for randomize
      if (Array.isArray(eventData.randomize)) {
        const summary = this.summarizeRandomize(eventData.randomize);
        if (summary) {
          return summary;
        }
      }

      // Check for sequence
      if (Array.isArray(eventData.sequence)) {
        const summary = this.summarizeSequence(eventData.sequence);
        if (summary) {
          return summary;
        }
      }

      // Check for direct add/remove
      const addRemove = this.summarizeAddRemove(eventData);
      if (addRemove) {
        parts.push(addRemove);
      }

      // Check for trigger
      if (typeof eventData.trigger === "string") {
        parts.push(`triggers ${eventData.trigger}`);
      } else if (typeof eventData.trigger === "object" && eventData.trigger !== null) {
        const triggerObj = eventData.trigger as Record<string, unknown>;
        if (typeof triggerObj.event === "string") {
          parts.push(`triggers ${triggerObj.event}`);
        }
      }

      // Check for set_property
      if (typeof eventData.set_property === "object" && eventData.set_property !== null) {
        const props = Object.keys(eventData.set_property as Record<string, unknown>);
        if (props.length > 0) {
          parts.push(`sets ${props.slice(0, 2).join(", ")}${props.length > 2 ? "…" : ""}`);
        }
      }

      if (parts.length > 0) {
        return parts.join(", ");
      }

      return "";
    } catch {
      return "";
    }
  }

  /**
   * Summarize a randomize array, e.g., "90% adult, 10% baby"
   */
  private summarizeRandomize(entries: unknown[]): string {
    if (entries.length === 0) {
      return "";
    }

    let totalWeight = 0;
    for (const entry of entries) {
      if (typeof entry === "object" && entry !== null) {
        const e = entry as Record<string, unknown>;
        totalWeight += typeof e.weight === "number" ? e.weight : 1;
      }
    }
    if (totalWeight === 0) {
      return "";
    }

    const parts: string[] = [];
    for (const entry of entries) {
      if (typeof entry !== "object" || entry === null) {
        continue;
      }
      const e = entry as Record<string, unknown>;
      const weight = typeof e.weight === "number" ? e.weight : 1;
      const pct = Math.round((weight / totalWeight) * 100);
      let action = this.describeAction(e);
      if (!action) {
        action = "option";
      }
      parts.push(`${pct}% ${action}`);
    }
    return parts.join(", ");
  }

  /**
   * Summarize a sequence array
   */
  private summarizeSequence(steps: unknown[]): string {
    const parts: string[] = [];
    for (const step of steps) {
      if (typeof step !== "object" || step === null) {
        continue;
      }
      const s = step as Record<string, unknown>;
      if (Array.isArray(s.randomize)) {
        const rSummary = this.summarizeRandomize(s.randomize);
        if (rSummary) {
          parts.push(rSummary);
        }
        continue;
      }
      const action = this.describeAction(s);
      if (action) {
        parts.push(action);
      }
    }
    if (parts.length > 0) {
      return parts.join(", then ");
    }
    return `${steps.length} steps`;
  }

  /**
   * Summarize add/remove component_groups
   */
  private summarizeAddRemove(data: Record<string, unknown>): string {
    const parts: string[] = [];

    if (typeof data.add === "object" && data.add !== null) {
      const addObj = data.add as Record<string, unknown>;
      const groups = addObj.component_groups;
      if (Array.isArray(groups) && groups.length > 0) {
        const names = groups.slice(0, 2).map((g) => this.stripNamespace(String(g)));
        let text = `adds ${names.join(", ")}`;
        if (groups.length > 2) {
          text += ` +${groups.length - 2}`;
        }
        parts.push(text);
      }
    }

    if (typeof data.remove === "object" && data.remove !== null) {
      const removeObj = data.remove as Record<string, unknown>;
      const groups = removeObj.component_groups;
      if (Array.isArray(groups) && groups.length > 0) {
        const names = groups.slice(0, 2).map((g) => this.stripNamespace(String(g)));
        let text = `removes ${names.join(", ")}`;
        if (groups.length > 2) {
          text += ` +${groups.length - 2}`;
        }
        parts.push(text);
      }
    }

    return parts.join(", ");
  }

  /**
   * Describe what a single action entry does (for randomize/sequence items)
   */
  private describeAction(entry: Record<string, unknown>): string {
    const parts: string[] = [];

    if (typeof entry.add === "object" && entry.add !== null) {
      const addObj = entry.add as Record<string, unknown>;
      const groups = addObj.component_groups;
      if (Array.isArray(groups) && groups.length > 0) {
        const names = groups.slice(0, 2).map((g) => this.stripNamespace(String(g)));
        let text = names.join(", ");
        if (groups.length > 2) {
          text += ` +${groups.length - 2}`;
        }
        parts.push(text);
      }
    }

    if (typeof entry.remove === "object" && entry.remove !== null) {
      const removeObj = entry.remove as Record<string, unknown>;
      const groups = removeObj.component_groups;
      if (Array.isArray(groups) && groups.length > 0) {
        const names = groups.slice(0, 2).map((g) => this.stripNamespace(String(g)));
        parts.push(`-${names.join(", ")}`);
      }
    }

    if (typeof entry.trigger === "string") {
      parts.push(entry.trigger);
    } else if (typeof entry.trigger === "object" && entry.trigger !== null) {
      const triggerObj = entry.trigger as Record<string, unknown>;
      if (typeof triggerObj.event === "string") {
        parts.push(triggerObj.event);
      }
    }

    return parts.join(", ");
  }

  /**
   * Strip namespace prefix (e.g., "minecraft:adult" → "adult")
   */
  private stripNamespace(name: string): string {
    const colonIndex = name.indexOf(":");
    return colonIndex >= 0 ? name.substring(colonIndex + 1) : name;
  }

  /**
   * Check if a path represents a component container
   */
  private isComponentContainer(path: string[]): boolean {
    const last = path[path.length - 1];
    // "components" at any level, or inside a component group
    return last === "components";
  }

  /**
   * Process components within a container and generate summaries
   */
  private async processComponents(
    model: monaco.editor.ITextModel,
    content: string,
    components: Record<string, unknown>,
    containerPath: string[],
    summaries: IComponentSummary[]
  ): Promise<void> {
    Log.verbose(
      `[ComponentSummaryProvider] Processing components at path: ${containerPath.join(".")} keys: ${Object.keys(
        components
      ).join(", ")}`
    );

    for (const [componentId, componentData] of Object.entries(components)) {
      // Support any namespaced component (minecraft:xxx, custom:xxx, etc.)
      if (!componentId.includes(":")) {
        continue;
      }

      if (typeof componentData !== "object" || componentData === null) {
        continue;
      }

      // Generate summary for this component
      const summary = await this.generateComponentSummary(
        model,
        content,
        componentId,
        componentData as Record<string, unknown>,
        [...containerPath, componentId]
      );

      if (summary) {
        summaries.push(summary);
      }
    }
  }

  /**
   * Process a component group and generate a summary of what's in it
   */
  private async processComponentGroup(
    model: monaco.editor.ITextModel,
    content: string,
    groupData: Record<string, unknown>,
    groupPath: string[],
    summaries: IComponentSummary[]
  ): Promise<void> {
    // Count components in this group (any namespaced component)
    const componentIds = Object.keys(groupData).filter((k) => k.includes(":"));

    Log.verbose(
      `[ComponentSummaryProvider] processComponentGroup for ${groupPath[groupPath.length - 1]}: ${
        componentIds.length
      } components found`
    );

    if (componentIds.length === 0) {
      return;
    }

    // Find the line where this group key appears
    const lineNumber = this.findKeyLine(model, content, groupPath);
    Log.verbose(`[ComponentSummaryProvider] Found line ${lineNumber} for group ${groupPath.join(".")}`);
    if (!lineNumber) {
      return;
    }

    // Create a simple summary showing component count
    // Remove namespace prefix for brevity
    const shortNames = componentIds.slice(0, 3).map((id) => {
      const parts = id.split(":");
      return parts.length > 1 ? parts[1] : id;
    });
    let summaryText = shortNames.join(", ");
    if (componentIds.length > 3) {
      summaryText += ` +${componentIds.length - 3}`;
    }

    Log.debug(`[ComponentSummaryProvider] Adding group summary: "${summaryText}" at line ${lineNumber}`);

    summaries.push({
      componentId: groupPath[groupPath.length - 1],
      lineNumber,
      summaryText,
      decoration: this.createDecoration(lineNumber, summaryText, "component-group-summary"),
    });
  }

  /**
   * Generate a summary for a single component
   */
  private async generateComponentSummary(
    model: monaco.editor.ITextModel,
    content: string,
    componentId: string,
    data: Record<string, unknown>,
    componentPath: string[]
  ): Promise<IComponentSummary | null> {
    try {
      Log.verbose("[ComponentSummaryProvider] Generating summary for: " + componentId);

      // Only load forms for minecraft: components (custom namespace components won't have forms)
      let form = null;
      if (componentId.startsWith("minecraft:")) {
        // Get the form name (e.g., "minecraft:health" -> "minecraft_health")
        const formName = componentId.replace(":", "_");

        // Try multiple form categories - components can appear in entity, block, item, or camera files
        const formCategories = ["entity", "block", "item", "camera"];
        for (const category of formCategories) {
          form = await Database.ensureFormLoaded(category, formName);
          if (form && form.summarizer) {
            break;
          }
        }
      }

      if (!form || !form.summarizer) {
        // No summarizer available, generate a simple fallback
        return this.generateFallbackSummary(model, content, componentId, data, componentPath);
      }

      // Use SummarizerEvaluator to generate the summary
      const evaluator = new SummarizerEvaluator();
      const result = evaluator.evaluate(form.summarizer, data, form);

      if (!result || !result.phrases || result.phrases.length === 0) {
        return this.generateFallbackSummary(model, content, componentId, data, componentPath);
      }

      // Get the summary text - use a condensed form if there are multiple phrases
      let summaryText: string;
      if (result.phrases.length === 1) {
        summaryText = result.phrases[0];
      } else {
        // For multiple phrases, join with commas (shorter than asSentence which uses "and")
        summaryText = result.phrases.slice(0, 2).join(", ");
        if (result.phrases.length > 2) {
          summaryText += "…";
        }
      }

      if (!summaryText || summaryText.trim() === "") {
        return null;
      }

      // Find the line where this component key appears
      const lineNumber = this.findKeyLine(model, content, componentPath);
      if (!lineNumber) {
        return null;
      }

      return {
        componentId,
        lineNumber,
        summaryText: summaryText.trim(),
        decoration: this.createDecoration(lineNumber, summaryText.trim(), "component-summary"),
      };
    } catch (err) {
      Log.debug(`Failed to generate summary for ${componentId}: ${err}`);
      return null;
    }
  }

  /**
   * Generate a simple fallback summary when no form summarizer is available
   */
  private generateFallbackSummary(
    model: monaco.editor.ITextModel,
    content: string,
    componentId: string,
    data: Record<string, unknown>,
    componentPath: string[]
  ): IComponentSummary | null {
    const keys = Object.keys(data);

    // Only create fallback for components with meaningful data
    if (keys.length === 0) {
      return null;
    }

    // Find the line
    const lineNumber = this.findKeyLine(model, content, componentPath);
    if (!lineNumber) {
      return null;
    }

    // Generate simple summary based on common patterns
    let summaryText = "";

    // Check for common value patterns
    if (typeof data.value === "number") {
      summaryText = `${data.value}`;
    } else if (typeof data.damage === "number") {
      summaryText = `${data.damage} dmg`;
    } else if (typeof data.range === "number") {
      summaryText = `range ${data.range}`;
    } else if (keys.length === 1 && typeof data[keys[0]] === "number") {
      summaryText = `${data[keys[0]]}`;
    } else {
      // Show key:value pairs for simple properties, or a count for larger objects
      const simpleProps = Object.entries(data)
        .filter(([_, v]) => typeof v === "number" || typeof v === "boolean" || typeof v === "string")
        .slice(0, 2)
        .map(([k, v]) => `${k}: ${v}`);

      if (simpleProps.length > 0) {
        summaryText = simpleProps.join(", ");
      } else {
        summaryText = `${keys.length} properties`;
      }
    }

    return {
      componentId,
      lineNumber,
      summaryText,
      decoration: this.createDecoration(lineNumber, summaryText, "component-summary-fallback"),
    };
  }

  /**
   * Find the line number where a JSON key appears
   */
  private findKeyLine(model: monaco.editor.ITextModel, content: string, path: string[]): number | null {
    if (path.length === 0) {
      Log.debug(`[ComponentSummaryProvider] findKeyLine: empty path`);
      return null;
    }

    // Check if model is still valid before accessing it
    if (!this.isModelValid(model)) {
      Log.debug(`[ComponentSummaryProvider] findKeyLine: model disposed`);
      return null;
    }

    const offsetResult = this.pathResolver.findPathOffset(content, path);
    if (!offsetResult) {
      Log.debug(`[ComponentSummaryProvider] findKeyLine: no offset found for path: ${path.join(".")}`);
      return null;
    }

    // The offset points to the value, we need the key line
    // Scan backwards from the offset to find the key
    let keyStart = offsetResult.start;

    // Skip backwards past colon and whitespace
    while (keyStart > 0 && (content[keyStart - 1] === " " || content[keyStart - 1] === "\t")) {
      keyStart--;
    }
    if (keyStart > 0 && content[keyStart - 1] === ":") {
      keyStart--;
    }
    while (keyStart > 0 && (content[keyStart - 1] === " " || content[keyStart - 1] === "\t")) {
      keyStart--;
    }
    // Now find the start of the quoted key
    if (keyStart > 0 && content[keyStart - 1] === '"') {
      keyStart--;
      while (keyStart > 0 && content[keyStart - 1] !== '"') {
        keyStart--;
      }
      if (keyStart > 0) {
        keyStart--;
      }
    }

    // Check again before calling getPositionAt, as async operations may have disposed the model
    if (!this.isModelValid(model)) {
      Log.debug(`[ComponentSummaryProvider] findKeyLine: model disposed before getPositionAt`);
      return null;
    }

    const position = model.getPositionAt(keyStart);
    return position.lineNumber;
  }

  // Max length for summary text to prevent overflow past editor viewport
  // Keep short to avoid Monaco clipping issues with inline decorations
  private readonly MAX_SUMMARY_LENGTH = 45;

  /**
   * Create a Monaco decoration for a component summary
   *
   * Note: Monaco's after.content only supports text, not HTML/images.
   * We use CSS styling (background, border, opacity) to make these
   * visually distinct from actual code comments.
   */
  private createDecoration(
    lineNumber: number,
    summaryText: string,
    className: string
  ): monaco.editor.IModelDeltaDecoration {
    // Truncate long summaries to prevent overflow issues
    let displayText = summaryText;
    if (displayText.length > this.MAX_SUMMARY_LENGTH) {
      // Find a good break point (space) near the limit
      const breakPoint = displayText.lastIndexOf(" ", this.MAX_SUMMARY_LENGTH);
      if (breakPoint > 20) {
        displayText = displayText.substring(0, breakPoint) + "…";
      } else {
        displayText = displayText.substring(0, this.MAX_SUMMARY_LENGTH) + "…";
      }
    }

    // Use a simple prefix - the badge styling already distinguishes from code
    return {
      range: new monaco.Range(lineNumber, 1, lineNumber, 1000),
      options: {
        after: {
          content: ` ${displayText}`,
          inlineClassName: `mct-${className}`,
        },
      },
    };
  }

  /**
   * Apply decorations to the editor
   */
  private applyDecorations(editor: monaco.editor.IStandaloneCodeEditor, summaries: IComponentSummary[]): void {
    const decorations = summaries.map((s) => s.decoration);
    this.currentDecorations = editor.deltaDecorations(this.currentDecorations, decorations);
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}

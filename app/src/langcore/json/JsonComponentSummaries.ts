// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * JsonComponentSummaries - Platform-agnostic component summary generation
 *
 * ARCHITECTURE
 * ============
 * This module provides the core logic for finding Minecraft components
 * in JSON files and generating human-readable summaries. It is designed
 * to be consumed by:
 * - Monaco editor (web app) via ComponentSummaryProvider
 * - VS Code extension via McDecorationProvider
 *
 * The platform-specific code handles decoration/rendering and line number
 * resolution, while this module handles the analysis and summary generation.
 *
 * KEY FEATURES:
 * - Finds component_groups and their child components
 * - Finds top-level components within minecraft:entity/block/item
 * - Uses form definitions with ISummarizer for rich summaries
 * - Falls back to property-based summaries when no form available
 *
 * SUMMARY FORMAT:
 * - Component groups: Lists child component names (e.g., "health, scale, ageable +2")
 * - Individual components: Uses summarizer or shows key properties
 */

import Database from "../../minecraft/Database";
import SummarizerEvaluator from "../../dataform/SummarizerEvaluator";
import Log from "../../core/Log";

/**
 * A component or component group that can be summarized
 */
export interface IComponentInfo {
  /** The component or group ID (e.g., "minecraft:health" or "minecraft:cat_baby") */
  id: string;
  /** The JSON path to this component */
  path: string[];
  /** The component data */
  data: Record<string, unknown>;
  /** Type of component entry */
  type: "component" | "component_group" | "event";
}

/**
 * A generated summary for a component
 */
export interface IComponentSummaryInfo {
  /** The component or group ID */
  id: string;
  /** The JSON path */
  path: string[];
  /** The summary text (without comment markers) */
  summaryText: string;
  /** Type of component entry */
  type: "component" | "component_group" | "event";
}

/**
 * Options for finding component summaries
 */
export interface IComponentSummaryOptions {
  /** Include individual components (default: true) */
  includeComponents?: boolean;
  /** Include component groups (default: true) */
  includeComponentGroups?: boolean;
  /** Include events (default: true) */
  includeEvents?: boolean;
  /** Maximum summary length before truncation (default: 60) */
  maxSummaryLength?: number;
}

const DEFAULT_OPTIONS: Required<IComponentSummaryOptions> = {
  includeComponents: true,
  includeComponentGroups: true,
  includeEvents: true,
  maxSummaryLength: 60,
};

/**
 * Find all components and component groups in a parsed JSON object
 */
export function findComponents(json: unknown, options?: IComponentSummaryOptions): IComponentInfo[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const components: IComponentInfo[] = [];

  searchForComponents(json, [], components, opts);

  return components;
}

/**
 * Recursively search for component containers
 */
function searchForComponents(
  obj: unknown,
  path: string[],
  components: IComponentInfo[],
  options: Required<IComponentSummaryOptions>
): void {
  if (typeof obj !== "object" || obj === null) {
    return;
  }

  const record = obj as Record<string, unknown>;

  for (const [key, value] of Object.entries(record)) {
    const keyPath = [...path, key];

    // Check if this is a components container
    if (key === "components" && options.includeComponents) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        processComponentsContainer(value as Record<string, unknown>, keyPath, components);
      }
    }

    // Check if this is a component_groups container
    if (key === "component_groups" && options.includeComponentGroups) {
      if (typeof value === "object" && value !== null) {
        for (const [groupName, groupValue] of Object.entries(value as Record<string, unknown>)) {
          if (typeof groupValue === "object" && groupValue !== null) {
            // Add the component group itself
            components.push({
              id: groupName,
              path: [...keyPath, groupName],
              data: groupValue as Record<string, unknown>,
              type: "component_group",
            });

            // Also add individual components within the group if enabled
            if (options.includeComponents) {
              processComponentsContainer(groupValue as Record<string, unknown>, [...keyPath, groupName], components);
            }
          }
        }
      }
    }

    // Check if this is an events container
    if (key === "events" && options.includeEvents) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        for (const [eventName, eventData] of Object.entries(value as Record<string, unknown>)) {
          if (typeof eventData === "object" && eventData !== null) {
            components.push({
              id: eventName,
              path: [...keyPath, eventName],
              data: eventData as Record<string, unknown>,
              type: "event",
            });
          }
        }
      }
    }

    // Continue searching deeper
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      searchForComponents(value, keyPath, components, options);
    }
  }
}

/**
 * Process components within a container (components object or component group)
 */
function processComponentsContainer(
  container: Record<string, unknown>,
  containerPath: string[],
  components: IComponentInfo[]
): void {
  for (const [componentId, componentData] of Object.entries(container)) {
    // Only process namespaced components (minecraft:xxx, custom:xxx, etc.)
    if (!componentId.includes(":")) {
      continue;
    }

    if (typeof componentData !== "object" || componentData === null) {
      continue;
    }

    components.push({
      id: componentId,
      path: [...containerPath, componentId],
      data: componentData as Record<string, unknown>,
      type: "component",
    });
  }
}

/**
 * Generate summaries for a list of components.
 * Note: This function generates summaries only. Line number resolution
 * should be done by the platform-specific consumer (Monaco/VS Code).
 */
export async function generateComponentSummaries(
  components: IComponentInfo[],
  options?: IComponentSummaryOptions
): Promise<IComponentSummaryInfo[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const summaries: IComponentSummaryInfo[] = [];

  for (const component of components) {
    let summaryText: string;

    if (component.type === "component_group") {
      summaryText = generateComponentGroupSummary(component.data, opts.maxSummaryLength);
    } else if (component.type === "event") {
      summaryText = generateEventSummary(component.data, opts.maxSummaryLength);
    } else {
      summaryText = await generateSingleComponentSummary(component.id, component.data, opts.maxSummaryLength);
    }

    if (!summaryText) {
      continue;
    }

    summaries.push({
      id: component.id,
      path: component.path,
      summaryText,
      type: component.type,
    });
  }

  return summaries;
}

/**
 * Generate a summary for a component group (lists child components)
 */
function generateComponentGroupSummary(groupData: Record<string, unknown>, maxLength: number): string {
  // Find all namespaced components in this group
  const componentIds = Object.keys(groupData).filter((k) => k.includes(":"));

  if (componentIds.length === 0) {
    return "";
  }

  // Create summary showing component names (without namespace)
  const shortNames = componentIds.slice(0, 3).map((id) => {
    const parts = id.split(":");
    return parts.length > 1 ? parts[1] : id;
  });

  let summaryText = shortNames.join(", ");
  if (componentIds.length > 3) {
    summaryText += ` +${componentIds.length - 3}`;
  }

  return truncateSummary(summaryText, maxLength);
}

/**
 * Generate a summary for a single component using form definition or fallback
 */
async function generateSingleComponentSummary(
  componentId: string,
  data: Record<string, unknown>,
  maxLength: number
): Promise<string> {
  try {
    // Only load forms for minecraft: components
    if (!componentId.startsWith("minecraft:")) {
      return generateFallbackSummary(componentId, data, maxLength);
    }

    // Try to load the form definition
    const componentName = componentId.replace("minecraft:", "");
    const formCategories = ["entity", "block", "item", "camera"];

    for (const category of formCategories) {
      const form = await Database.ensureFormLoaded(category, `minecraft_${componentName}`);

      if (form && form.summarizer) {
        // Use SummarizerEvaluator to generate the summary
        const evaluator = new SummarizerEvaluator();
        const result = evaluator.evaluate(form.summarizer, data, form);

        if (result && result.phrases && result.phrases.length > 0) {
          // Join multiple phrases or use single phrase
          let summaryText: string;
          if (result.phrases.length === 1) {
            summaryText = result.phrases[0];
          } else {
            summaryText = result.phrases.slice(0, 2).join(", ");
            if (result.phrases.length > 2) {
              summaryText += "…";
            }
          }
          if (summaryText && summaryText.trim() !== "") {
            return truncateSummary(summaryText, maxLength);
          }
        }
      }
    }

    // Fallback if no form or summarizer
    return generateFallbackSummary(componentId, data, maxLength);
  } catch (err) {
    Log.verbose(`Failed to generate summary for ${componentId}: ${err}`);
    return generateFallbackSummary(componentId, data, maxLength);
  }
}

/**
 * Generate a fallback summary by inspecting the component's properties
 */
function generateFallbackSummary(componentId: string, data: Record<string, unknown>, maxLength: number): string {
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return "";
  }

  // For simple single-value components, show the value
  if (entries.length === 1) {
    const [key, value] = entries[0];
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
      return truncateSummary(`${key}: ${value}`, maxLength);
    }
  }

  // For components with a few key properties, list them
  const keyProps = entries
    .filter(([_, v]) => typeof v === "number" || typeof v === "boolean" || typeof v === "string")
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${v}`);

  if (keyProps.length > 0) {
    return truncateSummary(keyProps.join(", "), maxLength);
  }

  // Just show property count
  return `${entries.length} properties`;
}

/**
 * Generate a human-readable summary for an entity event.
 *
 * Handles these patterns:
 * - add/remove component_groups
 * - randomize (weighted random selection)
 * - sequence (ordered steps)
 * - trigger (delegates to another event)
 */
export function generateEventSummary(eventData: Record<string, unknown>, maxLength: number): string {
  try {
    const parts: string[] = [];

    // Check for randomize
    if (Array.isArray(eventData.randomize)) {
      const randomizeSummary = summarizeRandomize(eventData.randomize);
      if (randomizeSummary) {
        return truncateSummary(randomizeSummary, maxLength);
      }
    }

    // Check for sequence
    if (Array.isArray(eventData.sequence)) {
      const seqSummary = summarizeSequence(eventData.sequence);
      if (seqSummary) {
        return truncateSummary(seqSummary, maxLength);
      }
    }

    // Check for direct add/remove
    const addRemove = summarizeAddRemove(eventData);
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
      return truncateSummary(parts.join(", "), maxLength);
    }

    return "";
  } catch {
    return "";
  }
}

/**
 * Summarize a randomize array, e.g. "90% adult, 10% baby"
 */
function summarizeRandomize(entries: unknown[]): string {
  if (entries.length === 0) {
    return "";
  }

  // Calculate total weight
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

    // What does this choice do?
    let action = describeAction(e);
    if (!action) {
      action = `option`;
    }

    parts.push(`${pct}% ${action}`);
  }

  return parts.join(", ");
}

/**
 * Summarize a sequence array
 */
function summarizeSequence(steps: unknown[]): string {
  const parts: string[] = [];
  for (const step of steps) {
    if (typeof step !== "object" || step === null) {
      continue;
    }
    const s = step as Record<string, unknown>;

    // Sequence step can contain randomize
    if (Array.isArray(s.randomize)) {
      const rSummary = summarizeRandomize(s.randomize);
      if (rSummary) {
        parts.push(rSummary);
      }
      continue;
    }

    const action = describeAction(s);
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
 * Summarize add/remove in an event or event step
 */
function summarizeAddRemove(data: Record<string, unknown>): string {
  const parts: string[] = [];

  if (typeof data.add === "object" && data.add !== null) {
    const addObj = data.add as Record<string, unknown>;
    const groups = addObj.component_groups;
    if (Array.isArray(groups) && groups.length > 0) {
      const names = groups.slice(0, 2).map((g) => stripNamespace(String(g)));
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
      const names = groups.slice(0, 2).map((g) => stripNamespace(String(g)));
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
 * Describe what an event entry does (for use inside randomize/sequence)
 */
function describeAction(entry: Record<string, unknown>): string {
  const parts: string[] = [];

  // Check add
  if (typeof entry.add === "object" && entry.add !== null) {
    const addObj = entry.add as Record<string, unknown>;
    const groups = addObj.component_groups;
    if (Array.isArray(groups) && groups.length > 0) {
      const names = groups.slice(0, 2).map((g) => stripNamespace(String(g)));
      let text = names.join(", ");
      if (groups.length > 2) {
        text += ` +${groups.length - 2}`;
      }
      parts.push(text);
    }
  }

  // Check remove
  if (typeof entry.remove === "object" && entry.remove !== null) {
    const removeObj = entry.remove as Record<string, unknown>;
    const groups = removeObj.component_groups;
    if (Array.isArray(groups) && groups.length > 0) {
      const names = groups.slice(0, 2).map((g) => stripNamespace(String(g)));
      parts.push(`-${names.join(", ")}`);
    }
  }

  // Check trigger
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
 * Strip namespace prefix from a component group name.
 * e.g., "minecraft:adult" → "adult"
 */
function stripNamespace(name: string): string {
  const colonIndex = name.indexOf(":");
  return colonIndex >= 0 ? name.substring(colonIndex + 1) : name;
}

/**
 * Truncate a summary to the max length
 */
function truncateSummary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Find the line number for a component key in the source text.
 * Uses a simple regex search for the key - works for most cases.
 *
 * @param content The JSON source text
 * @param componentId The component ID to find (e.g., "minecraft:health")
 * @returns Line number (1-based) or null if not found
 */
export function findComponentLineNumber(content: string, componentId: string): number | null {
  // Search for the component key in the JSON
  // Match: "componentId": (with possible whitespace)
  const pattern = new RegExp(`"${escapeRegex(componentId)}"\\s*:`);
  const match = pattern.exec(content);

  if (!match) {
    return null;
  }

  // Count lines up to the match
  const textBeforeMatch = content.substring(0, match.index);
  const lineNumber = (textBeforeMatch.match(/\n/g) || []).length + 1;

  return lineNumber;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

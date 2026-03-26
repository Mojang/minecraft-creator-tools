/**
 * MinecraftInlayHintsProvider.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This provider adds inlay hints (inline annotations) to Minecraft JSON files.
 * Inlay hints show additional context without modifying the actual text.
 *
 * INLAY HINT TYPES:
 *
 * 1. UNIT HINTS:
 *    - "20" → "20 ticks (1s)" for time values
 *    - "16" → "16 blocks" for distance values
 *    - "100" → "100 HP (50❤)" for health values
 *
 * 2. DEFAULT VALUE HINTS:
 *    - When a property uses the default value: "= default"
 *    - When a commonly-set property is missing: "implicit: true"
 *
 * 3. REFERENCE HINTS:
 *    - Entity references: "minecraft:pig" → "🐷 Pig"
 *    - Texture paths: show texture dimensions
 *
 * 4. COMPARISON HINTS:
 *    - Speed values: "0.25" → "(Player speed)"
 *    - Health: "20" → "(Player health)"
 *
 * 5. MOLANG HINTS:
 *    - Show evaluated result for simple Molang expressions
 *
 * MONACO INTEGRATION:
 * - Implements monaco.languages.InlayHintsProvider
 * - Uses InlayHint.kind for styling (Type, Parameter)
 *
 * PERFORMANCE:
 * - Only calculate hints for visible range
 * - Cache form lookups
 */

import * as monaco from "monaco-editor";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import { JsonPathResolver } from "./JsonPathResolver";
import { FormDefinitionCache } from "./FormDefinitionCache";
import IField, { FieldValueSummarizerType } from "../../dataform/IField";
import Utilities from "../../core/Utilities";

/**
 * Known reference values for comparisons
 */
const MINECRAFT_REFERENCES = {
  health: {
    20: "Player",
    10: "Chicken",
    30: "Cow",
    40: "Iron Golem",
    100: "Ender Dragon",
    200: "Wither",
    300: "Warden",
  },
  speed: {
    0.1: "Turtle",
    0.2: "Zombie",
    0.25: "Player",
    0.3: "Spider",
    0.43: "Horse",
  },
  damage: {
    1: "Zombie (Easy)",
    3: "Zombie (Normal)",
    4: "Zombie (Hard)",
    6: "Iron Golem",
    10: "Warden (melee)",
  },
};

/**
 * Provides inlay hints for Minecraft JSON files
 */
export class MinecraftInlayHintsProvider implements monaco.languages.InlayHintsProvider {
  private pathResolver: JsonPathResolver;
  private formCache: FormDefinitionCache;
  private projectItem?: ProjectItem;
  private project?: Project;

  constructor(pathResolver: JsonPathResolver, formCache: FormDefinitionCache) {
    this.pathResolver = pathResolver;
    this.formCache = formCache;
  }

  /**
   * Update the file context
   */
  public updateContext(projectItem?: ProjectItem, project?: Project): void {
    this.projectItem = projectItem;
    this.project = project;
  }

  /**
   * Provide inlay hints for the document
   */
  public async provideInlayHints(
    model: monaco.editor.ITextModel,
    range: monaco.Range,
    _token: monaco.CancellationToken
  ): Promise<monaco.languages.InlayHintList | null> {
    const content = model.getValue();
    const hints: monaco.languages.InlayHint[] = [];

    // Get form definition
    const form = this.projectItem ? await this.formCache.getFormForItemType(this.projectItem.itemType) : null;

    try {
      const json = JSON.parse(Utilities.fixJsonContent(content));

      // Walk the JSON and generate hints
      this.walkJsonWithPositions(content, json, [], (pathArr, value, startOffset, endOffset) => {
        // Check if this position is in the visible range
        const startPos = model.getPositionAt(startOffset);
        const endPos = model.getPositionAt(endOffset);

        if (endPos.lineNumber < range.startLineNumber || startPos.lineNumber > range.endLineNumber) {
          return; // Skip if outside visible range
        }

        // Get field definition
        const field = form ? this.formCache.getFieldAtPath(form, pathArr) : null;

        // Generate hints based on field type and value
        const pathStr = pathArr.join(".");
        const hint = this.generateHint(pathStr, value, endOffset, field, model);
        if (hint) {
          hints.push(hint);
        }
      });
    } catch {
      // Invalid JSON
    }

    return {
      hints,
      dispose: () => {},
    };
  }

  // =========================================================================
  // Hint Generation
  // =========================================================================

  /**
   * Generate a hint for a value
   */
  private generateHint(
    path: string,
    value: unknown,
    endOffset: number,
    field: IField | null,
    model: monaco.editor.ITextModel
  ): monaco.languages.InlayHint | null {
    const position = model.getPositionAt(endOffset);

    // Try different hint generators in order
    let hint: monaco.languages.InlayHint | null = null;

    // Check field-based hints first
    if (field) {
      hint = this.getFieldBasedHint(path, value, field, position);
      if (hint) return hint;
    }

    // Path-based hints (for when we don't have form data)
    hint = this.getPathBasedHint(path, value, position);
    if (hint) return hint;

    // Value-based hints (generic)
    hint = this.getValueBasedHint(value, position);
    if (hint) return hint;

    return null;
  }

  /**
   * Generate hint based on field definition
   */
  private getFieldBasedHint(
    path: string,
    value: unknown,
    field: IField,
    position: monaco.Position
  ): monaco.languages.InlayHint | null {
    // Check if field has a value summarizer
    if (field.valueSummarizer) {
      return this.getSummarizerHint(value, field, position);
    }

    // Check for default value
    if (field.defaultValue !== undefined && value === field.defaultValue) {
      return {
        position,
        label: " = default",
        kind: monaco.languages.InlayHintKind.Parameter,
        paddingLeft: true,
      };
    }

    // Unit-based hints - derive from valueSummarizer or dataType
    // (field.units property doesn't exist, but we can infer from other properties)

    return null;
  }

  /**
   * Generate hint based on value summarizer
   */
  private getSummarizerHint(
    value: unknown,
    field: IField,
    position: monaco.Position
  ): monaco.languages.InlayHint | null {
    const summarizer = field.valueSummarizer;
    if (!summarizer) return null;

    const num = typeof value === "number" ? value : null;

    switch (summarizer.type) {
      case FieldValueSummarizerType.time:
        if (num !== null) {
          const seconds = num / 20;
          const label = seconds >= 1 ? `${seconds.toFixed(1)}s` : `${num} ticks`;
          return {
            position,
            label: ` (${label})`,
            kind: monaco.languages.InlayHintKind.Type,
            paddingLeft: true,
          };
        }
        break;

      case FieldValueSummarizerType.distance:
        if (num !== null) {
          const unit = summarizer.unit || "blocks";
          return {
            position,
            label: ` ${unit}`,
            kind: monaco.languages.InlayHintKind.Type,
            paddingLeft: true,
          };
        }
        break;

      case FieldValueSummarizerType.healthBar:
        if (num !== null) {
          const hearts = Math.floor(num / 2);
          return {
            position,
            label: ` (${hearts}❤)`,
            kind: monaco.languages.InlayHintKind.Type,
            paddingLeft: true,
          };
        }
        break;

      case FieldValueSummarizerType.comparison:
        if (num !== null && summarizer.references) {
          const closest = this.findClosestReference(num, summarizer.references);
          if (closest) {
            return {
              position,
              label: ` ≈ ${closest.label}`,
              kind: monaco.languages.InlayHintKind.Type,
              paddingLeft: true,
            };
          }
        }
        break;

      case FieldValueSummarizerType.probabilityBar:
        if (num !== null) {
          const isNormalized = num <= 1;
          const percentage = isNormalized ? num * 100 : num;
          return {
            position,
            label: ` (${percentage.toFixed(0)}%)`,
            kind: monaco.languages.InlayHintKind.Type,
            paddingLeft: true,
          };
        }
        break;
    }

    return null;
  }

  /**
   * Find closest reference value
   */
  private findClosestReference(
    value: number,
    references: Array<{ value: number; label: string }>
  ): { value: number; label: string } | null {
    let closest: { value: number; label: string } | null = null;
    let minDiff = Infinity;

    for (const ref of references) {
      const diff = Math.abs(value - ref.value);
      const ratio = Math.abs(1 - value / ref.value);

      // Only match if within 20% of reference value
      if (ratio < 0.2 && diff < minDiff) {
        minDiff = diff;
        closest = ref;
      }
    }

    return closest;
  }

  /**
   * Generate hint based on JSON path patterns
   */
  private getPathBasedHint(path: string, value: unknown, position: monaco.Position): monaco.languages.InlayHint | null {
    const pathLower = path.toLowerCase();
    const num = typeof value === "number" ? value : null;

    // Health-related paths
    if (pathLower.includes("health") && num !== null) {
      return this.getComparisonHint(num, MINECRAFT_REFERENCES.health, position, "❤");
    }

    // Speed/movement paths
    if ((pathLower.includes("speed") || pathLower.includes("movement")) && num !== null) {
      return this.getComparisonHint(num, MINECRAFT_REFERENCES.speed, position);
    }

    // Damage paths
    if (pathLower.includes("damage") && num !== null) {
      return this.getComparisonHint(num, MINECRAFT_REFERENCES.damage, position, "⚔");
    }

    // Time-related paths (assuming ticks)
    if (
      (pathLower.includes("duration") || pathLower.includes("cooldown") || pathLower.includes("interval")) &&
      num !== null
    ) {
      if (num > 0) {
        const seconds = num / 20;
        const label = seconds >= 1 ? `${seconds.toFixed(1)}s` : `${num} ticks`;
        return {
          position,
          label: ` (${label})`,
          kind: monaco.languages.InlayHintKind.Type,
          paddingLeft: true,
        };
      }
    }

    // Range/distance paths
    if (
      (pathLower.includes("range") || pathLower.includes("radius") || pathLower.includes("distance")) &&
      num !== null
    ) {
      return {
        position,
        label: " blocks",
        kind: monaco.languages.InlayHintKind.Type,
        paddingLeft: true,
      };
    }

    // Probability paths
    if ((pathLower.includes("chance") || pathLower.includes("probability")) && num !== null) {
      const percentage = num <= 1 ? num * 100 : num;
      return {
        position,
        label: ` (${percentage.toFixed(0)}%)`,
        kind: monaco.languages.InlayHintKind.Type,
        paddingLeft: true,
      };
    }

    return null;
  }

  /**
   * Generate comparison hint against known values
   */
  private getComparisonHint(
    value: number,
    references: Record<number, string>,
    position: monaco.Position,
    icon?: string
  ): monaco.languages.InlayHint | null {
    // Find exact or closest match
    if (references[value]) {
      const prefix = icon ? `${icon} ` : "";
      return {
        position,
        label: ` (${prefix}${references[value]})`,
        kind: monaco.languages.InlayHintKind.Type,
        paddingLeft: true,
      };
    }

    // Find closest reference
    const refValues = Object.keys(references)
      .map(Number)
      .sort((a, b) => a - b);
    for (let i = 0; i < refValues.length; i++) {
      const refValue = refValues[i];
      const ratio = value / refValue;

      if (ratio >= 0.9 && ratio <= 1.1) {
        const prefix = icon ? `${icon} ` : "";
        return {
          position,
          label: ` (≈ ${prefix}${references[refValue]})`,
          kind: monaco.languages.InlayHintKind.Type,
          paddingLeft: true,
        };
      }
    }

    return null;
  }

  /**
   * Generate hint based on value alone
   */
  private getValueBasedHint(value: unknown, position: monaco.Position): monaco.languages.InlayHint | null {
    // Entity identifier with namespace
    if (typeof value === "string" && value.startsWith("minecraft:")) {
      const shortName = value.replace("minecraft:", "");
      const emoji = this.getEntityEmoji(shortName);
      if (emoji) {
        return {
          position,
          label: ` ${emoji}`,
          kind: monaco.languages.InlayHintKind.Type,
          paddingLeft: true,
        };
      }
    }

    return null;
  }

  /**
   * Get emoji for entity identifier
   */
  private getEntityEmoji(identifier: string): string | null {
    const entityEmojis: Record<string, string> = {
      pig: "🐷",
      cow: "🐄",
      sheep: "🐑",
      chicken: "🐔",
      horse: "🐴",
      wolf: "🐺",
      cat: "🐱",
      ocelot: "🐱",
      rabbit: "🐰",
      bat: "🦇",
      spider: "🕷️",
      zombie: "🧟",
      skeleton: "💀",
      creeper: "💥",
      enderman: "👾",
      slime: "🟢",
      ghast: "👻",
      blaze: "🔥",
      witch: "🧙",
      villager: "👨‍🌾",
      iron_golem: "🤖",
      bee: "🐝",
      fox: "🦊",
      panda: "🐼",
      dolphin: "🐬",
      turtle: "🐢",
      parrot: "🦜",
      squid: "🦑",
      salmon: "🐟",
      cod: "🐟",
      tropical_fish: "🐠",
      pufferfish: "🐡",
    };

    return entityEmojis[identifier] || null;
  }

  /**
   * Generate unit hint
   */
  private getUnitHint(value: unknown, unit: string, position: monaco.Position): monaco.languages.InlayHint | null {
    if (typeof value !== "number") return null;

    return {
      position,
      label: ` ${unit}`,
      kind: monaco.languages.InlayHintKind.Type,
      paddingLeft: true,
    };
  }

  // =========================================================================
  // JSON Walking
  // =========================================================================

  /**
   * Walk JSON tree with position tracking
   */
  private walkJsonWithPositions(
    content: string,
    obj: unknown,
    path: string[],
    callback: (path: string[], value: unknown, startOffset: number, endOffset: number) => void
  ): void {
    // Find position of this value
    const offsetResult = this.pathResolver.findPathOffset(content, path);
    if (!offsetResult) return;

    // Find end of value
    const endOffset = this.findValueEnd(content, offsetResult.start);

    // Callback for this value
    callback(path, obj, offsetResult.start, endOffset);

    // Recurse into children
    if (typeof obj === "object" && obj !== null) {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          const itemPath = [...path, String(index)];
          this.walkJsonWithPositions(content, item, itemPath, callback);
        });
      } else {
        for (const [key, value] of Object.entries(obj)) {
          const keyPath = [...path, key];
          this.walkJsonWithPositions(content, value, keyPath, callback);
        }
      }
    }
  }

  /**
   * Find the end offset of a JSON value
   */
  private findValueEnd(content: string, startOffset: number): number {
    const ch = content[startOffset];

    if (ch === '"') {
      // String
      let i = startOffset + 1;
      while (i < content.length) {
        if (content[i] === '"' && content[i - 1] !== "\\") {
          return i + 1;
        }
        i++;
      }
    } else if (ch === "{" || ch === "[") {
      // Object or array
      let depth = 1;
      let i = startOffset + 1;
      while (i < content.length && depth > 0) {
        if (content[i] === "{" || content[i] === "[") depth++;
        if (content[i] === "}" || content[i] === "]") depth--;
        i++;
      }
      return i;
    } else {
      // Number, boolean, null
      let i = startOffset;
      while (i < content.length && !/[,}\]\s]/.test(content[i])) {
        i++;
      }
      return i;
    }

    return startOffset;
  }
}

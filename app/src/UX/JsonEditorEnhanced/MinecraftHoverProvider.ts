/**
 * MinecraftHoverProvider.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * Provides rich hover documentation for Minecraft JSON files in Monaco editor.
 * When users hover over properties, values, or components, this provider
 * displays relevant documentation from form definitions.
 *
 * Uses langcore for platform-agnostic content generation.
 *
 * FEATURES:
 * 1. Property documentation - Shows description, type, constraints
 * 2. Component documentation - Shows component-specific help with properties summary
 * 3. Value documentation - Shows meaning of specific values
 * 4. Version information - Shows when features were introduced/deprecated
 * 5. Sample values - Shows examples from vanilla and sample content
 *
 * HOW IT WORKS:
 * 1. User hovers over a position in the JSON
 * 2. JsonPathResolver finds the path at that position
 * 3. FormDefinitionCache looks up field metadata for that path
 * 4. If field has subFormId, loads that form to get rich documentation
 *    (important for components where the intermediate definition has placeholder text)
 * 5. Provider formats and returns markdown hover content including:
 *    - Title and description from the actual component form
 *    - Type information and constraints
 *    - Sample values from form definitions
 *    - Summary of component properties when hovering on a component key
 *
 * SUBFORM RESOLUTION:
 * When hovering on a component like "minecraft:leashable":
 * - The path resolves to entity_component_definitions which has subFormId
 * - We load the actual component form (minecraft_leashable.form.json)
 * - Use its description/title instead of placeholder "Dynamic value"
 * - Show a summary of the component's fields with types and defaults
 *
 * RELATED FILES:
 * - JsonPathResolver.ts - Determines JSON path at cursor
 * - FormDefinitionCache.ts - Provides field metadata and loads subforms
 * - IField.ts - Field definition interface
 * - langcore/json/JsonHoverContent.ts - Platform-agnostic hover generation
 */

import * as monaco from "monaco-editor";
import IFormDefinition, { IFormSample } from "../../dataform/IFormDefinition";
import IField, { FieldDataType } from "../../dataform/IField";
import { JsonPathResolver, IJsonPathResult } from "./JsonPathResolver";
import { FormDefinitionCache } from "./FormDefinitionCache";
import { ProjectItemType } from "../../app/IProjectItemData";
import ProjectItem from "../../app/ProjectItem";
import Project from "../../app/Project";
import { molangHoverGenerator } from "../../langcore/molang/MolangHover";
import { toMonacoHover } from "./LangcoreAdapters";
import Log from "../../core/Log";

/**
 * File context for hover resolution
 */
interface IHoverContext {
  projectItem?: ProjectItem;
  project?: Project;
  form?: IFormDefinition;
  itemType?: ProjectItemType;
}

/**
 * Monaco hover provider for Minecraft JSON files
 */
export class MinecraftHoverProvider implements monaco.languages.HoverProvider {
  private pathResolver: JsonPathResolver;
  private formCache: FormDefinitionCache;
  private context: IHoverContext = {};

  constructor(pathResolver: JsonPathResolver, formCache: FormDefinitionCache) {
    this.pathResolver = pathResolver;
    this.formCache = formCache;
  }

  /**
   * Update the file context for hover resolution
   */
  public updateContext(projectItem?: ProjectItem, project?: Project): void {
    this.context.projectItem = projectItem;
    this.context.project = project;

    if (projectItem) {
      this.context.itemType = projectItem.itemType;

      // Pre-load form for this item type
      this.formCache.getFormForItemType(projectItem.itemType).then((form) => {
        if (form) {
          this.context.form = form;
        }
      });
    }
  }

  /**
   * Provide hover information for a position
   */
  public async provideHover(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.Hover | null> {
    try {
      // Check if request was cancelled
      if (token.isCancellationRequested) {
        return null;
      }

      // Get the JSON path at this position
      const pathResult = this.pathResolver.getPathAtPosition(model, position);

      if (pathResult.path.length === 0) {
        return null;
      }

      // Check if request was cancelled before async work
      if (token.isCancellationRequested) {
        return null;
      }

      // Build hover content
      const contents = await this.buildHoverContent(pathResult, model.getValue(), token);

      // Check if request was cancelled after async work
      if (token.isCancellationRequested) {
        return null;
      }

      if (contents.length === 0) {
        return null;
      }

      return {
        contents,
        range: new monaco.Range(
          position.lineNumber,
          pathResult.tokenStart + 1,
          position.lineNumber,
          pathResult.tokenEnd + 1
        ),
      };
    } catch (err) {
      // Silently fail - hover is not critical
      return null;
    }
  }

  /**
   * Build hover content for a path
   */
  private async buildHoverContent(
    pathResult: IJsonPathResult,
    jsonText: string,
    token?: monaco.CancellationToken
  ): Promise<monaco.IMarkdownString[]> {
    const contents: monaco.IMarkdownString[] = [];

    // Check cancellation before async work
    if (token?.isCancellationRequested) {
      return contents;
    }

    // Check for Molang expression hover (value contains query., math., or variable.)
    const valueHover = this.getMolangHover(pathResult, jsonText);
    if (valueHover) {
      contents.push(valueHover);
      return contents; // Molang hover is sufficient, no need for field docs
    }

    // Get field from form definition (using async to follow subFormId references)
    if (this.context.form) {
      // When cursor is on a key (inKeyPosition), pathResult.path contains the parent context
      // and currentKey contains the key being hovered. Include currentKey in the lookup path
      // so the form field for that key is found.
      const lookupPath = pathResult.inKeyPosition && pathResult.currentKey
        ? [...pathResult.path, pathResult.currentKey]
        : pathResult.path;

      // Try the full path first, then progressively shorter suffixes.
      // This handles cases where the form represents a subsection of the JSON
      // (e.g., behavior_pack_header_json covers content inside "header", so
      // path ["header", "name"] should fall back to ["name"]).
      let result = await this.formCache.getFieldWithFormAtPathAsync(this.context.form, lookupPath);
      if (!result && lookupPath.length > 1) {
        for (let i = 1; i < lookupPath.length; i++) {
          result = await this.formCache.getFieldWithFormAtPathAsync(this.context.form, lookupPath.slice(i));
          if (result) break;
        }
      }

      // Check cancellation after async work
      if (token?.isCancellationRequested) {
        return contents;
      }

      if (result) {
        // If the field references a subform, load it to get richer documentation
        // This is common for component definitions where the field in entity_component_definitions
        // has a placeholder description, but the actual component form has the real docs
        let effectiveField = result.field;
        let effectiveForm: IFormDefinition | undefined = result.form;
        let subFormFields: IField[] | undefined;

        if (result.field.subFormId) {
          Log.verbose(`[MinecraftHoverProvider] Field has subFormId: ${result.field.subFormId}`);
          const subForm = await this.formCache.getFormBySubFormId(result.field.subFormId);
          if (subForm) {
            Log.verbose(
              `[MinecraftHoverProvider] Loaded subForm: ${subForm.id || subForm.title}, fields: ${
                subForm.fields?.length || 0
              }`
            );
            effectiveForm = subForm;
            subFormFields = subForm.fields;
            // Use the subform's description if the current field has a placeholder
            if (subForm.description && (!result.field.description || result.field.description === "Dynamic value")) {
              // Create a synthetic field with the subform's documentation
              effectiveField = {
                ...result.field,
                description: subForm.description,
                title: subForm.title || result.field.title,
              };
            }
          }
        }

        contents.push(this.formatFieldDocumentation(effectiveField, pathResult, effectiveForm));

        // If we loaded a subform (component form), show a summary of its key properties
        if (subFormFields && subFormFields.length > 0) {
          Log.verbose(
            `[MinecraftHoverProvider] Loaded subform with ${subFormFields.length} fields for ${result.field.id}`
          );
          const propertiesSummary = this.formatComponentProperties(subFormFields);
          if (propertiesSummary) {
            contents.push({ value: propertiesSummary });
          } else {
            Log.verbose(`[MinecraftHoverProvider] formatComponentProperties returned null`);
          }
        } else {
          Log.verbose(
            `[MinecraftHoverProvider] No subFormFields for ${result.field.id}, subFormId: ${result.field.subFormId}`
          );
        }
      }
    }

    // Add path breadcrumb (include currentKey when in key position for a complete path)
    const displayPath = pathResult.inKeyPosition && pathResult.currentKey
      ? [...pathResult.path, pathResult.currentKey]
      : pathResult.path;
    if (displayPath.length > 0) {
      contents.push({
        value: `**Path:** \`${displayPath.join(" > ")}\``,
      });
    }

    // Add component-specific info for minecraft: properties
    const lastSegment = pathResult.path[pathResult.path.length - 1];
    if (lastSegment?.startsWith("minecraft:")) {
      const componentInfo = this.getComponentInfo(lastSegment);
      if (componentInfo) {
        contents.push({ value: componentInfo });
      }
    }

    return contents;
  }

  /**
   * Format a summary of component properties for the hover
   * Shows key properties with their types, defaults, and constraints
   */
  private formatComponentProperties(fields: IField[]): string | null {
    if (!fields || fields.length === 0) {
      return null;
    }

    // Show up to 6 most important properties
    const MAX_PROPERTIES = 6;
    const lines: string[] = ["", "**Properties:**"];
    let count = 0;

    for (const field of fields) {
      if (count >= MAX_PROPERTIES) {
        const remaining = fields.length - count;
        if (remaining > 0) {
          lines.push(`- *...and ${remaining} more*`);
        }
        break;
      }

      const propName = field.title || field.id;
      const parts: string[] = [`\`${propName}\``];

      // Add type info
      const typeInfo = this.getTypeDescription(field);
      if (typeInfo && typeInfo !== "Unknown") {
        parts.push(`(${typeInfo})`);
      }

      // Add default value
      if (field.defaultValue !== undefined) {
        parts.push(`= \`${JSON.stringify(field.defaultValue)}\``);
      }

      // Add constraints preview
      if (field.minValue !== undefined || field.maxValue !== undefined) {
        const range: string[] = [];
        if (field.minValue !== undefined) range.push(`min: ${field.minValue}`);
        if (field.maxValue !== undefined) range.push(`max: ${field.maxValue}`);
        parts.push(`[${range.join(", ")}]`);
      } else if (field.suggestedMinValue !== undefined || field.suggestedMaxValue !== undefined) {
        const range: string[] = [];
        if (field.suggestedMinValue !== undefined) range.push(`~${field.suggestedMinValue}`);
        if (field.suggestedMaxValue !== undefined) range.push(`~${field.suggestedMaxValue}`);
        parts.push(`[typical: ${range.join(" - ")}]`);
      }

      lines.push(`- ${parts.join(" ")}`);
      count++;
    }

    return lines.join("\n");
  }

  /**
   * Get Molang hover content for a value at a path
   */
  private getMolangHover(pathResult: IJsonPathResult, jsonText: string): monaco.IMarkdownString | null {
    // Try to extract the token/word at this position
    const tokenContent = pathResult.path[pathResult.path.length - 1] || "";

    // Check if the token looks like a Molang expression
    const molangPatterns = ["query.", "q.", "variable.", "v.", "math.", "context.", "c.", "temp.", "t."];
    const isMolang = molangPatterns.some((p) => tokenContent.startsWith(p));

    if (!isMolang) {
      // Also check the raw value at this position in the JSON
      // This handles cases where we're hovering over a string value containing Molang
      try {
        const parsed = JSON.parse(jsonText);
        const value = this.getValueAtPath(parsed, pathResult.path);
        if (typeof value === "string") {
          const hasMolang = molangPatterns.some((p) => value.includes(p));
          if (hasMolang) {
            // Extract the specific Molang token being hovered
            const molangToken = this.extractMolangToken(value, tokenContent);
            if (molangToken) {
              return this.formatMolangHover(molangToken);
            }
          }
        }
      } catch {
        // JSON parse failed, continue without Molang check
      }
      return null;
    }

    return this.formatMolangHover(tokenContent);
  }

  /**
   * Extract a Molang token from a string value
   */
  private extractMolangToken(value: string, hint: string): string | null {
    // Try to find query., variable., or math. expressions
    const tokenMatch = value.match(
      /(query\.\w+|q\.\w+|variable\.\w+|v\.\w+|math\.\w+|context\.\w+|c\.\w+|temp\.\w+|t\.\w+)/i
    );
    if (tokenMatch) {
      return tokenMatch[1];
    }
    return null;
  }

  /**
   * Format Molang hover using langcore
   */
  private formatMolangHover(token: string): monaco.IMarkdownString | null {
    const hoverContent = molangHoverGenerator.generateHover(token, 0);
    if (hoverContent) {
      const result = toMonacoHover(hoverContent);
      if (result && result.contents.length > 0) {
        // Flatten the hover contents into a single markdown string
        const markdown = result.contents
          .map((c) => (typeof c === "string" ? c : (c as monaco.IMarkdownString).value))
          .join("\n\n");
        return { value: markdown };
      }
    }
    return null;
  }

  /**
   * Get value at a path in a parsed JSON object
   */
  private getValueAtPath(obj: unknown, path: string[]): unknown {
    let current: unknown = obj;
    for (const segment of path) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === "object" && current !== null) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }
    return current;
  }

  /**
   * Format field documentation as markdown
   */
  private formatFieldDocumentation(
    field: IField,
    pathResult: IJsonPathResult,
    form?: IFormDefinition
  ): monaco.IMarkdownString {
    const lines: string[] = [];

    // Title
    const title = field.title || field.id || pathResult.path[pathResult.path.length - 1];
    lines.push(`### ${title}`);

    // Description
    if (field.description) {
      lines.push("");
      lines.push(field.description);
    }

    // Type information
    const typeInfo = this.getTypeDescription(field);
    if (typeInfo) {
      lines.push("");
      lines.push(`**Type:** ${typeInfo}`);
    }

    // Default value
    if (field.defaultValue !== undefined) {
      lines.push(`**Default:** \`${JSON.stringify(field.defaultValue)}\``);
    }

    // Constraints
    const constraints = this.getConstraintInfo(field);
    if (constraints.length > 0) {
      lines.push("");
      lines.push("**Constraints:**");
      for (const constraint of constraints) {
        lines.push(`- ${constraint}`);
      }
    }

    // Valid values (for enums)
    if (field.choices && field.choices.length > 0 && field.choices.length <= 10) {
      lines.push("");
      lines.push("**Valid values:**");
      for (const choice of field.choices) {
        const label = choice.title || String(choice.id);
        if (choice.description) {
          lines.push(`- \`${label}\` - ${choice.description}`);
        } else {
          lines.push(`- \`${label}\``);
        }
      }
    }

    // Sample values (from field and form)
    if (!field.hideSamples) {
      const samplesMarkdown = this.formatSamples(field, form);
      if (samplesMarkdown) {
        lines.push("");
        lines.push(samplesMarkdown);
      }
    }

    // Version info
    if (field.versionIntroduced) {
      lines.push("");
      lines.push(`*Introduced in version ${field.versionIntroduced}*`);
    }

    if (field.isDeprecated || field.versionDeprecated) {
      lines.push("");
      const deprecatedInfo = field.versionDeprecated
        ? `*⚠️ Deprecated since ${field.versionDeprecated}*`
        : "*⚠️ Deprecated*";
      lines.push(deprecatedInfo);
    }

    return { value: lines.join("\n") };
  }

  /**
   * Get type description for a field
   */
  private getTypeDescription(field: IField): string {
    switch (field.dataType) {
      case FieldDataType.int:
        return "Integer";
      case FieldDataType.float:
        return "Float";
      case FieldDataType.number:
        return "Number";
      case FieldDataType.string:
        return "String";
      case FieldDataType.boolean:
        return "Boolean";
      case FieldDataType.stringEnum:
        return "String (enumerated)";
      case FieldDataType.intEnum:
        return "Integer (enumerated)";
      case FieldDataType.stringArray:
        return "Array of strings";
      case FieldDataType.objectArray:
        return "Array of objects";
      case FieldDataType.object:
        return "Object";
      case FieldDataType.point3:
        return "3D Point [x, y, z]";
      case FieldDataType.intPoint3:
        return "3D Integer Point [x, y, z]";
      case FieldDataType.intRange:
        return "Integer range [min, max]";
      case FieldDataType.floatRange:
        return "Float range [min, max]";
      case FieldDataType.minecraftFilter:
        return "Minecraft Filter";
      case FieldDataType.minecraftEventTrigger:
        return "Minecraft Event Trigger";
      case FieldDataType.version:
        return "Version";
      case FieldDataType.uuid:
        return "UUID";
      default:
        return "";
    }
  }

  /**
   * Get constraint information for a field
   */
  private getConstraintInfo(field: IField): string[] {
    const constraints: string[] = [];

    if (field.minValue !== undefined) {
      constraints.push(`Minimum: ${field.minValue}`);
    }

    if (field.maxValue !== undefined) {
      constraints.push(`Maximum: ${field.maxValue}`);
    }

    if (field.minLength !== undefined) {
      constraints.push(`Minimum length: ${field.minLength}`);
    }

    if (field.maxLength !== undefined) {
      constraints.push(`Maximum length: ${field.maxLength}`);
    }

    if (field.isRequired) {
      constraints.push("Required");
    }

    return constraints;
  }

  /**
   * Format sample values for display in hover
   * Shows up to 5 diverse sample values from field and form samples
   */
  private formatSamples(field: IField, form: IFormDefinition | undefined): string | null {
    const allSamples: { source: string; sample: IFormSample }[] = [];

    // Collect samples from field.samples (field-level samples)
    if (field.samples) {
      for (const [sourceKey, samples] of Object.entries(field.samples)) {
        for (const sample of samples) {
          allSamples.push({ source: this.formatSourcePath(sourceKey), sample });
        }
      }
    }

    // Collect samples from form.samples (form-level samples)
    // These are relevant to any field in the form
    if (form?.samples) {
      for (const [sourceKey, samples] of Object.entries(form.samples)) {
        for (const sample of samples) {
          // Include samples from the form level - they apply to all fields in this form
          // Skip path relevance check for form-level samples since they represent the whole form
          allSamples.push({ source: this.formatSourcePath(sourceKey), sample });
        }
      }
    }

    if (allSamples.length === 0) {
      return null;
    }

    // Select top 5 most diverse samples
    const diverseSamples = this.selectDiverseSamples(allSamples, 5);

    if (diverseSamples.length === 0) {
      return null;
    }

    const lines: string[] = ["**Sample values:**"];

    for (const { source, sample } of diverseSamples) {
      const contentStr = this.formatSampleContent(sample.content);
      // Use source (file/path description) as label
      const label = source || sample.path;
      lines.push(`- ${label}: \`${contentStr}\``);
    }

    return lines.join("\n");
  }

  /**
   * Format source path for display (extract filename or use as-is)
   */
  private formatSourcePath(sourcePath: string): string {
    // If it's a file path, extract just the filename
    if (sourcePath.includes("/")) {
      const parts = sourcePath.split("/");
      const filename = parts[parts.length - 1];
      // Remove .json extension if present
      return filename.replace(/\.json$/, "").replace(/\.(block|entity|item)$/, "");
    }
    return sourcePath;
  }

  /**
   * Select diverse samples by choosing samples with different content values
   */
  private selectDiverseSamples(
    samples: { source: string; sample: IFormSample }[],
    maxCount: number
  ): { source: string; sample: IFormSample }[] {
    if (samples.length <= maxCount) {
      return samples;
    }

    const selected: { source: string; sample: IFormSample }[] = [];
    const seenContentHashes = new Set<string>();

    for (const item of samples) {
      // Create a simple hash of the content for diversity checking
      const contentHash = this.hashContent(item.sample.content);

      // Skip if we've seen very similar content
      if (!seenContentHashes.has(contentHash)) {
        selected.push(item);
        seenContentHashes.add(contentHash);

        if (selected.length >= maxCount) {
          break;
        }
      }
    }

    // If we still need more samples, add from remaining
    if (selected.length < maxCount) {
      for (const item of samples) {
        if (!selected.includes(item)) {
          selected.push(item);
          if (selected.length >= maxCount) {
            break;
          }
        }
      }
    }

    return selected;
  }

  /**
   * Create a simple hash of content for diversity comparison
   */
  private hashContent(content: object | string | number | boolean): string {
    if (typeof content === "object") {
      // For objects, use a simplified representation
      const keys = Object.keys(content).sort().slice(0, 3).join(",");
      const values = Object.values(content)
        .slice(0, 3)
        .map((v) => (typeof v === "object" ? "obj" : String(v).slice(0, 20)))
        .join(",");
      return `${keys}:${values}`;
    }
    return String(content);
  }

  /**
   * Format sample content for display (truncate if too long)
   */
  private formatSampleContent(content: object | string | number | boolean): string {
    if (typeof content === "object") {
      const str = JSON.stringify(content);
      // Truncate long objects
      if (str.length > 60) {
        return str.slice(0, 57) + "...";
      }
      return str;
    }
    return String(content);
  }

  /**
   * Get additional info for minecraft: components
   */
  private getComponentInfo(componentId: string): string | null {
    // Common component categories
    if (componentId.startsWith("minecraft:behavior.")) {
      return "🤖 **Behavior Component** - Controls entity AI behavior";
    }

    if (componentId.startsWith("minecraft:navigation.")) {
      return "🧭 **Navigation Component** - Controls entity pathfinding";
    }

    if (componentId.startsWith("minecraft:movement.")) {
      return "🏃 **Movement Component** - Controls entity movement style";
    }

    if (componentId.startsWith("minecraft:damage_sensor")) {
      return "💔 **Damage Sensor** - Handles damage events and reactions";
    }

    if (componentId.startsWith("minecraft:interact")) {
      return "👆 **Interaction** - Defines player interaction options";
    }

    if (componentId.startsWith("minecraft:loot")) {
      return "🎁 **Loot** - Defines drops when entity dies";
    }

    if (componentId.startsWith("minecraft:spawn")) {
      return "🥚 **Spawn Rules** - Controls where and when entity spawns";
    }

    return null;
  }
}

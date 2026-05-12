import { JSONSchema7, JSONSchema7Definition } from "json-schema";
import IFormDefinition, { IFormSample } from "../dataform/IFormDefinition";
import IField, { FieldDataType } from "../dataform/IField";
import DataFormUtilities from "../dataform/DataFormUtilities";
import { ComparisonType } from "../dataform/ICondition";
import Utilities from "../core/Utilities";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import Log from "../core/Log";
import SummarizerEvaluator from "../dataform/SummarizerEvaluator";
import * as PackageSchemaMapping from "./PackageSchemaMapping";

/**
 * Represents the content type for JSON samples.
 * Matches the IFormSample.content type for compatibility.
 */
export type SampleContent = IFormSample["content"];

/**
 * Represents a JSON object with string keys and arbitrary JSON values.
 * Used for snippet bodies and other dynamic JSON structures.
 * Note: This uses Record<string, unknown> for maximum flexibility with TypeScript's
 * structural typing, since snippet bodies can contain any valid JSON.
 */
export type JsonObject = Record<string, unknown>;

/**
 * JSON SCHEMA GENERATOR
 * ====================
 *
 * This class generates JSON Schema (Draft-07) files from .form.json form definitions.
 * It is the canonical, battle-tested implementation for converting form definitions to JSON Schema.
 *
 * ARCHITECTURE:
 * - Input: A folder containing .form.json files (recursively loaded)
 * - Output: A folder containing .schema.json files with matching structure
 * - Each .form.json file produces one .schema.json file
 *
 * USE CASES:
 * 1. CLI docgen: Generates .schema.json files for documentation
 * 2. UX FormSchemaGenerator: Uses this for Monaco hover tooltips (adds sample values)
 *
 * SUBFORM REFERENCES AND CYCLES:
 * - Fields can reference other forms via `subFormId` (e.g., "misc/floatrange")
 * - Referenced forms are loaded and included in a $defs section
 * - Uses $ref to reference definitions, enabling proper JSON Schema composition
 * - Cycle detection prevents infinite recursion when forms reference each other
 * - Cycles are handled by using $ref to already-registered definitions
 *
 * FIELD TYPE MAPPING:
 * The generator maps FieldDataType enum values to JSON Schema types:
 * - int, intEnum, intBoolean, intValueLookup, long -> "integer"
 * - float, number, percentRange -> "number"
 * - boolean -> "boolean"
 * - string, stringEnum, stringLookup, uuid, version, localizableString,
 *   minecraftEventReference, longFormString -> "string"
 * - molang -> anyOf: ["string", "number"] (Molang expressions can be either)
 * - point2, point3, intPoint3, location, locationOffset -> "array" of numbers with fixed length
 * - intRange, floatRange -> anyOf: [single value, array of 2 values]
 * - numberArray -> "array" of numbers
 * - stringArray, longFormStringArray, checkboxListAsStringArray -> "array" of strings
 * - molangArray -> "array" of anyOf: ["string", "number"]
 * - object -> "object" with properties
 * - minecraftEventTrigger -> anyOf: ["string", object] (event name OR event object with event/target/filters)
 * - minecraftFilter -> anyOf: [object, array of objects] (single filter OR array of filters)
 * - objectArray -> "array" of objects
 * - minecraftEventTriggerArray -> anyOf: [single trigger (string/object), array of triggers]
 * - keyedStringCollection, keyedNumberCollection, keyedBooleanCollection,
 *   keyedObjectCollection, etc. -> "object" with additionalProperties
 *
 * USAGE:
 * Via CLI: `npx mct docsgeneratejsonschema -i ./path/to/forms -o ./path/to/output`
 *
 * RELATED FILES:
 * - docgen/FormDefinitionTypeScriptGenerator.ts: Generates TypeScript interfaces from forms
 * - dataform/IField.ts: Defines FieldDataType enum with all supported types
 * - cli/ClUtils.ts: Contains TaskType enum for CLI commands
 * - cli/index.ts: CLI command definitions and implementations
 * - UX/JsonEditorEnhanced/FormSchemaGenerator.ts: Uses this for Monaco hover
 *
 * DEDUPLICATION:
 * When combining schemas in anyOf arrays (e.g., from alternates), we deduplicate
 * entries to avoid redundant options in intellisense. Two schemas are considered
 * duplicates if they have the same structure.
 *
 * WHY anyOf INSTEAD OF oneOf:
 * We use anyOf instead of oneOf for type alternates because:
 * - oneOf requires EXACTLY ONE schema to match, causing "Matches multiple schemas"
 *   warnings when a value like `true` or `{}` could match multiple type schemas
 * - anyOf allows ONE OR MORE schemas to match, which is semantically correct for
 *   "this field can be a boolean OR an object" scenarios
 * - Monaco still shows all options in intellisense with anyOf
 */

/**
 * Context object passed through schema generation to track definitions and cycles.
 */
export interface ISchemaGenerationContext {
  /** All loaded form definitions by their subFormId path */
  formsBySubFormId: { [subFormId: string]: IFormDefinition };
  /** The $defs section being built for the root schema */
  definitions: { [defName: string]: JSONSchema7 };
  /** Set of subFormIds currently being processed (for cycle detection) */
  processingStack: Set<string>;
  /** Set of subFormIds that have been fully processed */
  processedDefs: Set<string>;
}

/**
 * Extended context for package-mode schema generation.
 * Tracks file outputs and common schema routing.
 */
interface IPackageSchemaContext {
  formsBySubFormId: { [subFormId: string]: IFormDefinition };
  definitions: { [defName: string]: JSONSchema7 };
  processingStack: Set<string>;
  processedDefs: Set<string>;
  outputMode: "package";
  currentDocFolder: string;
  commonSubFormIds: Set<string>;
  writtenFiles: Map<string, string>;
  pendingWrites: Array<{ fileName: string; schema: JSONSchema7 }>;
}

/**
 * Entry in the package catalog.json that describes a document schema.
 */
interface ICatalogEntry {
  folder: string;
  schemaFile: string;
  packType: string;
  packFolder: string;
  title: string;
  description: string;
  componentCount: number;
}

/**
 * Represents a VS Code/Monaco defaultSnippet for JSON completion.
 * This is a VS Code-specific JSON Schema extension, not part of the JSON Schema spec.
 * The body can be any JSON value (string, number, boolean, object, array, null).
 */
interface IDefaultSnippet {
  label: string;
  description?: string;
  body: unknown;
}

export default class JsonSchemaGenerator {
  /**
   * Clean up a field ID by removing the special "<" syntax used in form.json files.
   * Form files sometimes encode enum values in the field ID like: `render_distance_type"<"fixed", "render"`
   * This extracts just the property name: `render_distance_type`
   *
   * @param fieldId The field ID to clean
   * @returns The cleaned field ID, or the original if no special syntax is found
   */
  static cleanFieldId(fieldId: string | undefined): string | undefined {
    if (!fieldId) return fieldId;

    // Look for the "<" delimiter that indicates embedded enum values
    const lessThanIndex = fieldId.indexOf('"<"');
    if (lessThanIndex > 0) {
      return fieldId.substring(0, lessThanIndex);
    }

    return fieldId;
  }

  /**
   * Generates a default snippet body object from a field's subForm.
   * This creates a template object with default values or placeholders for completion.
   */
  static generateSnippetBodyFromSubForm(subForm: IFormDefinition | undefined, field: IField): JsonObject | undefined {
    if (!subForm || !subForm.fields || subForm.fields.length === 0) {
      // No subForm, but if the field is an object type with an inline subForm, use that
      if (field.subForm && field.subForm.fields && field.subForm.fields.length > 0) {
        return JsonSchemaGenerator.generateSnippetBodyFromFields(field.subForm.fields);
      }
      return undefined;
    }
    return JsonSchemaGenerator.generateSnippetBodyFromFields(subForm.fields);
  }

  /**
   * Generates a snippet body from an array of fields.
   */
  static generateSnippetBodyFromFields(fields: IField[]): JsonObject | undefined {
    const body: JsonObject = {};

    for (const subField of fields) {
      if (!Utilities.isUsableAsObjectKey(subField.id)) continue;

      // Use defaultValue if available, otherwise use simple type-appropriate defaults
      // Note: We use simple static defaults instead of snippet tabstops to avoid
      // issues with Monaco's color picker and other language features.
      // Snippet syntax like ${1:value} can cause parsing issues.
      if (subField.defaultValue !== undefined) {
        body[subField.id] = subField.defaultValue;
      } else {
        // Create simple default values based on type
        switch (subField.dataType) {
          case FieldDataType.boolean:
            body[subField.id] = true;
            break;
          case FieldDataType.int:
          case FieldDataType.intEnum:
          case FieldDataType.long:
            body[subField.id] = 0;
            break;
          case FieldDataType.float:
          case FieldDataType.number:
            body[subField.id] = 0.0;
            break;
          case FieldDataType.string:
          case FieldDataType.stringEnum:
          case FieldDataType.localizableString:
            body[subField.id] = "";
            break;
          case FieldDataType.point3:
          case FieldDataType.intPoint3:
          case FieldDataType.location:
            body[subField.id] = [0, 0, 0];
            break;
          case FieldDataType.point2:
            body[subField.id] = [0, 0];
            break;
          default:
            // For complex types, skip if not required (to keep snippet minimal)
            // or use empty object/string placeholder
            if (subField.isRequired) {
              body[subField.id] = "";
            }
            break;
        }
      }
    }

    return Object.keys(body).length > 0 ? body : undefined;
  }

  /**
   * Checks if two JSON schemas are structurally equivalent for deduplication purposes.
   * This is used to prevent duplicate entries in oneOf arrays.
   */
  static schemasAreEquivalent(a: JSONSchema7, b: JSONSchema7): boolean {
    // Quick check: if they serialize to the same JSON, they're equivalent
    return JSON.stringify(a) === JSON.stringify(b);
  }

  /**
   * Deduplicates an array of JSON schemas, removing structurally equivalent entries.
   * This prevents validation errors where multiple schemas in oneOf match the same value.
   */
  static deduplicateSchemas(schemas: JSONSchema7[]): JSONSchema7[] {
    const unique: JSONSchema7[] = [];
    for (const schema of schemas) {
      if (!unique.some((existing) => JsonSchemaGenerator.schemasAreEquivalent(existing, schema))) {
        unique.push(schema);
      }
    }
    return unique;
  }

  /**
   * Builds a rich description string that includes the field description and sample values.
   * Sample values are formatted and appended to give context for the field's expected values.
   *
   * When a field has a placeholder description like "Dynamic value" and references another
   * form via subFormId, this method looks up the referenced form to get its description
   * and optionally extracts a static summary from its summarizer.
   *
   * @param field - The field to build a description for
   * @param context - Optional schema generation context for subFormId lookup
   * @returns A description string with samples, or undefined if no description or samples
   */
  static buildRichDescription(field: IField, context?: ISchemaGenerationContext): string | undefined {
    const parts: string[] = [];

    // Get the description, potentially looking up from referenced form
    let description = field.description;

    // If description is a placeholder and we have a subFormId reference, look it up
    if (JsonSchemaGenerator.isPlaceholderDescription(description) && field.subFormId && context) {
      const referencedForm = context.formsBySubFormId[field.subFormId];
      if (referencedForm) {
        // Use the referenced form's description if available
        if (referencedForm.description && !JsonSchemaGenerator.isPlaceholderDescription(referencedForm.description)) {
          description = referencedForm.description;
        }
        // Also try to extract a static description from the summarizer
        else if (referencedForm.summarizer) {
          const staticDesc = JsonSchemaGenerator.extractStaticDescriptionFromSummarizer(referencedForm);
          if (staticDesc) {
            description = staticDesc;
          }
        }
      }
    }

    // Add field description (skip placeholders)
    if (description && !JsonSchemaGenerator.isPlaceholderDescription(description)) {
      parts.push(description);
    }

    // Add version info
    if (field.versionIntroduced) {
      parts.push(`\n\n*Introduced in version ${field.versionIntroduced}*`);
    }

    if (field.isDeprecated || field.versionDeprecated) {
      const msg = field.versionDeprecated ? `⚠️ Deprecated since ${field.versionDeprecated}` : "⚠️ Deprecated";
      parts.push(`\n\n*${msg}*`);
    }

    // Add properties summary for object fields - show what THIS FIELD contains.
    // Only add if the field doesn't already have a meaningful description, to avoid
    // cluttering editor UIs with auto-generated property listings.
    const hasRealDescription = description && !JsonSchemaGenerator.isPlaceholderDescription(description);
    const childFields = DataFormUtilities.getFieldChildProperties(field, context?.formsBySubFormId);
    if (!hasRealDescription && childFields && childFields.length > 0) {
      const propsText = JsonSchemaGenerator.formatPropertiesSummary(childFields);
      if (propsText) {
        parts.push("\n\n" + propsText);
      }
    }

    // Add sample values if not hidden
    if (!field.hideSamples && field.samples) {
      const samplesText = JsonSchemaGenerator.formatSamples(field.samples);
      if (samplesText) {
        parts.push("\n\n" + samplesText);
      }
    }

    // Add choice descriptions if available
    if (field.choices && field.choices.length > 0 && !field.hideSamples) {
      const choiceDescriptions = field.choices
        .filter((c) => c.description)
        .map((c) => `• ${c.title || c.id}: ${c.description}`)
        .join("\n");

      if (choiceDescriptions) {
        parts.push("\n\nValues:\n" + choiceDescriptions);
      }
    }

    return parts.length > 0 ? parts.join("") : undefined;
  }

  /**
   * Checks if a description is a placeholder that should be replaced.
   * Placeholder descriptions are used in component definition forms where the actual
   * description comes from the referenced subform.
   *
   * @param description - The description to check
   * @returns True if the description is a placeholder
   */
  static isPlaceholderDescription(description: string | undefined): boolean {
    if (!description) return false;

    const placeholders = ["Dynamic value", "dynamic value", "TODO", "TBD", "Description pending", "No description"];

    return placeholders.some((p) => description === p || description.startsWith(p));
  }

  /**
   * Extracts a static description from a form's summarizer by evaluating it with empty data.
   * This captures unconditional literal tokens that describe what the component does.
   *
   * @param form - The form definition with a summarizer
   * @returns A static description string, or undefined if none can be extracted
   */
  static extractStaticDescriptionFromSummarizer(form: IFormDefinition): string | undefined {
    if (!form.summarizer || !form.summarizer.phrases || form.summarizer.phrases.length === 0) {
      return undefined;
    }

    try {
      const evaluator = new SummarizerEvaluator();
      // Evaluate with empty data to get only unconditional literal text
      const result = evaluator.evaluate(form.summarizer, {}, form);

      // Use the first phrase if we got any
      if (result.phrases && result.phrases.length > 0) {
        // Capitalize first letter and add context
        const phrase = result.phrases[0];
        const capitalized = phrase.charAt(0).toUpperCase() + phrase.slice(1);
        return capitalized;
      }
    } catch (e) {
      // Silently fail - summarizer evaluation is best-effort
      Log.verbose("Failed to extract description from summarizer: " + e);
    }

    return undefined;
  }

  /**
   * Formats sample values from a field's samples dictionary.
   * Selects diverse samples and formats them as a markdown list.
   *
   * @param samples - Dictionary of source paths to sample arrays
   * @returns Formatted string with sample values, or null if no samples
   */
  static formatSamples(samples: { [path: string]: IFormSample[] }): string | null {
    const allSamples: { source: string; content: SampleContent }[] = [];

    // Collect samples from all sources
    for (const [sourceKey, sampleArray] of Object.entries(samples)) {
      for (const sample of sampleArray) {
        allSamples.push({
          source: JsonSchemaGenerator.formatSourcePath(sourceKey),
          content: sample.content,
        });
      }
    }

    if (allSamples.length === 0) {
      return null;
    }

    // Select up to 3 diverse samples (keeping it concise for tooltips)
    const diverseSamples = JsonSchemaGenerator.selectDiverseSamples(allSamples, 3);

    if (diverseSamples.length === 0) {
      return null;
    }

    // Format as plain text (Monaco hover doesn't render markdown)
    const lines = ["Sample values:"];
    for (const { source, content } of diverseSamples) {
      const contentStr = JsonSchemaGenerator.formatSampleContent(content);
      lines.push(`• ${source}: ${contentStr}`);
    }

    return lines.join("\n");
  }

  /**
   * Format a summary of properties for component/object forms.
   * Shows property name, type, default value, and constraints for quick reference in hover.
   */
  static formatPropertiesSummary(fields: IField[]): string | null {
    if (!fields || fields.length === 0) {
      return null;
    }

    // Filter to significant properties (those with ids that aren't internal)
    const significantFields = fields.filter((f) => f.id && !f.id.startsWith("_") && !f.isInternal);

    if (significantFields.length === 0) {
      return null;
    }

    const lines: string[] = ["Properties:"];

    for (const f of significantFields.slice(0, 8)) {
      // Limit to 8 to keep hover manageable
      const propLine = JsonSchemaGenerator.formatPropertyLine(f);
      if (propLine) {
        lines.push(propLine);
      }
    }

    if (significantFields.length > 8) {
      lines.push(`• ... and ${significantFields.length - 8} more properties`);
    }

    return lines.join("\n");
  }

  /**
   * Format a single property line for the properties summary.
   */
  static formatPropertyLine(field: IField): string | null {
    if (!field.id) return null;

    // Clean up field ID - remove embedded enum syntax like `render_distance_type"<"fixed", "render"`
    const cleanId = JsonSchemaGenerator.cleanFieldId(field.id) || field.id;

    const parts: string[] = [`• ${cleanId}`];

    // Add type info
    const typeInfo = JsonSchemaGenerator.getFieldTypeString(field);
    if (typeInfo) {
      parts.push(`(${typeInfo})`);
    }

    // Add default value
    if (field.defaultValue !== undefined) {
      const defaultStr =
        typeof field.defaultValue === "object"
          ? JSON.stringify(field.defaultValue).substring(0, 20)
          : String(field.defaultValue);
      parts.push(`= ${defaultStr}`);
    }

    // Add constraints (ranges)
    const constraints = JsonSchemaGenerator.getFieldConstraints(field);
    if (constraints) {
      parts.push(constraints);
    }

    return parts.join(" ");
  }

  /**
   * Get a human-readable type string for a field.
   * For object types with known subfields, shows a preview of property names.
   */
  static getFieldTypeString(field: IField): string | null {
    if (field.dataType !== undefined) {
      const typeNames: { [key: string]: string } = {
        [FieldDataType.int]: "int",
        [FieldDataType.boolean]: "boolean",
        [FieldDataType.string]: "string",
        [FieldDataType.float]: "float",
        [FieldDataType.stringEnum]: "enum",
        [FieldDataType.intEnum]: "enum",
        [FieldDataType.number]: "number",
        [FieldDataType.object]: "object",
        [FieldDataType.stringArray]: "string[]",
      };

      // For object types, try to show a preview of properties
      if (field.dataType === FieldDataType.object) {
        const propertyPreview = DataFormUtilities.getObjectPropertyPreview(field);
        if (propertyPreview) {
          return propertyPreview;
        }
      }

      return typeNames[field.dataType] || null;
    }
    if (field.choices && field.choices.length > 0) {
      return "enum";
    }
    return null;
  }

  /**
   * Get constraint information (ranges, etc.) for a field.
   */
  static getFieldConstraints(field: IField): string | null {
    const constraints: string[] = [];

    if (field.suggestedMinValue !== undefined && field.suggestedMaxValue !== undefined) {
      constraints.push(`${field.suggestedMinValue}-${field.suggestedMaxValue}`);
    } else if (field.suggestedMinValue !== undefined) {
      constraints.push(`min: ${field.suggestedMinValue}`);
    } else if (field.suggestedMaxValue !== undefined) {
      constraints.push(`max: ${field.suggestedMaxValue}`);
    }

    if (field.maxLength !== undefined) {
      constraints.push(`maxLen: ${field.maxLength}`);
    }

    return constraints.length > 0 ? `[${constraints.join(", ")}]` : null;
  }

  /**
   * Formats a source path for display, extracting entity/item name.
   */
  static formatSourcePath(sourcePath: string): string {
    // Extract entity name from paths like "entities/sheep.json"
    const match = sourcePath.match(/\/([^\/]+?)\.json$/i);
    if (match) {
      return match[1]; // e.g., "sheep", "zombie", "chest"
    }
    // Fall back to last path segment
    const parts = sourcePath.split("/");
    return parts[parts.length - 1] || sourcePath;
  }

  /**
   * Formats sample content for display in a tooltip.
   */
  static formatSampleContent(content: SampleContent): string {
    if (content === null || content === undefined) {
      return "null";
    }
    if (typeof content === "object") {
      // For objects/arrays, show compact JSON (truncated if too long)
      const json = JSON.stringify(content);
      return json.length > 50 ? json.substring(0, 47) + "..." : json;
    }
    return String(content);
  }

  /**
   * Selects a diverse set of samples to show variety.
   * Prioritizes samples with different content values.
   */
  static selectDiverseSamples(
    samples: { source: string; content: SampleContent }[],
    maxCount: number
  ): { source: string; content: SampleContent }[] {
    const seen = new Set<string>();
    const result: { source: string; content: SampleContent }[] = [];

    for (const sample of samples) {
      const key = JsonSchemaGenerator.formatSampleContent(sample.content);
      if (!seen.has(key) && result.length < maxCount) {
        seen.add(key);
        result.push(sample);
      }
    }

    return result;
  }

  /**
   * Generate JSON Schema files from a folder of form.json files.
   * Recursively processes all .form.json files and creates matching .schema.json files.
   */
  public async generateSchemas(formJsonInputFolder: IFolder, outputFolder: IFolder): Promise<void> {
    const formsByPath: { [name: string]: IFormDefinition } = {};
    const formsBySubFormId: { [subFormId: string]: IFormDefinition } = {};

    await this.loadFormJsonFromFolder(formsByPath, formsBySubFormId, formJsonInputFolder);

    await outputFolder.ensureExists();

    Log.message(`Loaded ${Object.keys(formsByPath).length} form definitions`);
    Log.message(`Indexed ${Object.keys(formsBySubFormId).length} forms by subFormId`);

    for (const formPath in formsByPath) {
      const formDef = formsByPath[formPath];

      if (formDef) {
        try {
          // Create a fresh context for each root schema
          const context: ISchemaGenerationContext = {
            formsBySubFormId,
            definitions: {},
            processingStack: new Set(),
            processedDefs: new Set(),
          };

          const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef, formPath, context);

          // Create output path: replace .form.json with .schema.json
          let outputPath = formPath;
          if (outputPath.endsWith(".form.json")) {
            outputPath = outputPath.replace(/\.form\.json$/, ".schema.json");
          } else if (outputPath.endsWith(".json")) {
            outputPath = outputPath.replace(/\.json$/, ".schema.json");
          } else {
            outputPath = outputPath + ".schema.json";
          }

          // Create folder structure if needed
          const outputFile = await outputFolder.ensureFileFromRelativePath(outputPath);

          if (outputFile) {
            outputFile.setContent(JSON.stringify(schema, null, 2));
            await outputFile.saveContent();
            Log.verbose("Generated schema: " + outputPath);
          }
        } catch (e: unknown) {
          Log.error("Error generating schema for " + formPath + ": " + String(e));
        }
      }
    }
  }

  /**
   * Generate JSON Schema files in an organized package layout.
   *
   * Instead of mirroring the form folder structure, this organizes schemas into
   * bp_<folder>/rp_<folder> directories matching Minecraft pack paths, with each
   * document folder self-contained:
   *
   *   schemas/bp_entities/index.schema.json      (document entry point)
   *   schemas/bp_entities/actor_document.schema.json  (component)
   *   schemas/common/filter.schema.json           (shared type)
   *
   * Component schemas are written as separate files within the document folder
   * using relative $ref instead of inlined $defs.
   */
  public async generatePackageSchemas(formJsonInputFolder: IFolder, outputFolder: IFolder): Promise<void> {
    const formsByPath: { [name: string]: IFormDefinition } = {};
    const formsBySubFormId: { [subFormId: string]: IFormDefinition } = {};

    await this.loadFormJsonFromFolder(formsByPath, formsBySubFormId, formJsonInputFolder);
    await outputFolder.ensureExists();

    Log.message(`Package schema generation: Loaded ${Object.keys(formsByPath).length} form definitions`);

    // Pass 1: Identify which subFormIds are shared across multiple document folders.
    // These will go into common/ instead of being duplicated in each document folder.
    const subFormUsage = new Map<string, Set<string>>();

    for (const entry of PackageSchemaMapping.PACKAGE_SCHEMA_ENTRIES) {
      const formDef =
        formsBySubFormId[entry.formDocPath] ||
        Object.values(formsBySubFormId).find((_, __, arr) => {
          // Handle versioned form paths
          const keys = Object.keys(formsBySubFormId);
          return keys.some((k) => k.startsWith(entry.formDocPath));
        });

      if (!formDef) continue;

      const referencedSubForms = new Set<string>();
      this._collectSubFormReferences(formDef, formsBySubFormId, referencedSubForms, new Set());

      for (const subFormId of referencedSubForms) {
        if (!subFormUsage.has(subFormId)) {
          subFormUsage.set(subFormId, new Set());
        }
        subFormUsage.get(subFormId)!.add(entry.outputFolder);
      }
    }

    // SubFormIds used by 3+ document folders are "common"
    const commonSubFormIds = new Set<string>();
    for (const [subFormId, folders] of subFormUsage) {
      if (folders.size >= 3 || PackageSchemaMapping.isCommonSubForm(subFormId)) {
        commonSubFormIds.add(subFormId);
      }
    }

    // Also add explicitly listed common subforms
    for (const id of PackageSchemaMapping.COMMON_SUBFORM_IDS) {
      commonSubFormIds.add(id);
    }

    Log.message(`Identified ${commonSubFormIds.size} common schemas`);

    // Pass 2: Generate common/ schemas first
    const commonFolder = await outputFolder.ensureFolderFromRelativePath("./common");
    const generatedCommon = new Set<string>();

    for (const subFormId of commonSubFormIds) {
      const formDef = formsBySubFormId[subFormId];
      if (!formDef) continue;

      const context: IPackageSchemaContext = {
        formsBySubFormId,
        definitions: {},
        processingStack: new Set(),
        processedDefs: new Set(),
        outputMode: "package",
        currentDocFolder: "common",
        commonSubFormIds,
        writtenFiles: new Map(),
        pendingWrites: [],
      };

      const schema = await this._convertFormForPackage(formDef, subFormId, context);

      // Use leaf name for common files (e.g., "misc/floatrange" → "floatrange")
      const leafName = subFormId.includes("/") ? subFormId.substring(subFormId.lastIndexOf("/") + 1) : subFormId;
      const fileName = leafName + ".schema.json";

      // Skip if we already wrote a file with this leaf name (e.g., misc/floatrange and item_components/floatrange are the same)
      if (generatedCommon.has(leafName)) continue;

      const file = await commonFolder.ensureFile(fileName);
      if (file) {
        file.setContent(JSON.stringify(schema, null, 2));
        await file.saveContent();
        generatedCommon.add(leafName);
      }

      // Write any pending component files within common
      for (const pending of context.pendingWrites) {
        const pendingFile = await commonFolder.ensureFile(pending.fileName);
        if (pendingFile) {
          pendingFile.setContent(JSON.stringify(pending.schema, null, 2));
          await pendingFile.saveContent();
        }
      }
    }

    // Pass 3: Generate document schemas in their bp_/rp_ folders
    const catalogEntries: ICatalogEntry[] = [];

    for (const entry of PackageSchemaMapping.PACKAGE_SCHEMA_ENTRIES) {
      // Find the form definition — try exact match first, then prefix match for versioned paths
      let formDocId = entry.formDocPath;
      let formDef = formsBySubFormId[formDocId];

      if (!formDef) {
        // Try versioned paths (e.g., "visual/geometry" → "visual/geometry.v1.21.0")
        const matchingKey = Object.keys(formsBySubFormId).find((k) => k.startsWith(entry.formDocPath));
        if (matchingKey) {
          formDocId = matchingKey;
          formDef = formsBySubFormId[matchingKey];
        }
      }

      if (!formDef) {
        Log.verbose(`Package schema: No form found for ${entry.formDocPath}, skipping`);
        continue;
      }

      const docFolder = await outputFolder.ensureFolderFromRelativePath("./" + entry.outputFolder);

      const context: IPackageSchemaContext = {
        formsBySubFormId,
        definitions: {},
        processingStack: new Set(),
        processedDefs: new Set(),
        outputMode: "package",
        currentDocFolder: entry.outputFolder,
        commonSubFormIds,
        writtenFiles: new Map(),
        pendingWrites: [],
      };

      const schema = await this._convertFormForPackage(formDef, formDocId, context);

      // Write the document entry point
      const docFile = await docFolder.ensureFile(entry.outputFilename);
      if (docFile) {
        docFile.setContent(JSON.stringify(schema, null, 2));
        await docFile.saveContent();
      }

      // Write all component schema files for this document
      for (const pending of context.pendingWrites) {
        const compFile = await docFolder.ensureFile(pending.fileName);
        if (compFile) {
          compFile.setContent(JSON.stringify(pending.schema, null, 2));
          await compFile.saveContent();
        }
      }

      catalogEntries.push({
        folder: entry.outputFolder,
        schemaFile: entry.outputFilename,
        packType: entry.packType,
        packFolder: entry.packFolder,
        title: entry.title,
        description: formDef.description || "",
        componentCount: context.pendingWrites.length,
      });

      Log.verbose(
        `Generated package schema: ${entry.outputFolder}/${entry.outputFilename} ` +
          `(${context.pendingWrites.length} components)`
      );
    }

    // Write catalog.json
    const catalog = {
      $schema: "https://json-schema.org/draft-07/schema#",
      packageName: "@minecraft/bedrock-schemas",
      documents: catalogEntries,
    };

    const catalogFile = await outputFolder.ensureFile("catalog.json");
    if (catalogFile) {
      catalogFile.setContent(JSON.stringify(catalog, null, 2));
      await catalogFile.saveContent();
    }

    Log.message(
      `Package schema generation complete: ${catalogEntries.length} documents, ` +
        `${generatedCommon.size} common schemas`
    );
  }

  /**
   * Recursively collects all subFormId references reachable from a form definition.
   */
  private _collectSubFormReferences(
    formDef: IFormDefinition,
    formsBySubFormId: { [id: string]: IFormDefinition },
    collected: Set<string>,
    visited: Set<string>
  ): void {
    if (!formDef.fields) return;

    for (const field of formDef.fields) {
      this._collectSubFormRefsFromField(field, formsBySubFormId, collected, visited);
    }

    if (formDef.scalarField) {
      this._collectSubFormRefsFromField(formDef.scalarField, formsBySubFormId, collected, visited);
    }
  }

  private _collectSubFormRefsFromField(
    field: IField,
    formsBySubFormId: { [id: string]: IFormDefinition },
    collected: Set<string>,
    visited: Set<string>
  ): void {
    if (field.subFormId && !visited.has(field.subFormId)) {
      visited.add(field.subFormId);
      collected.add(field.subFormId);

      const subForm = formsBySubFormId[field.subFormId];
      if (subForm) {
        this._collectSubFormReferences(subForm, formsBySubFormId, collected, visited);
      }
    }

    if (field.subForm) {
      this._collectSubFormReferences(field.subForm, formsBySubFormId, collected, visited);
    }

    if (field.alternates) {
      for (const alt of field.alternates) {
        this._collectSubFormRefsFromField(alt, formsBySubFormId, collected, visited);
      }
    }
  }

  /**
   * Converts a form definition to a JSON Schema for package output.
   * Similar to convertFormDefinitionToJsonSchema but uses file-level $ref
   * instead of $defs for subform references.
   */
  private async _convertFormForPackage(
    formDef: IFormDefinition,
    formDocId: string,
    context: IPackageSchemaContext
  ): Promise<JSONSchema7> {
    // Use the standard conversion, but with a package-aware context
    // that will intercept subform resolution
    const stdContext: ISchemaGenerationContext = {
      formsBySubFormId: context.formsBySubFormId,
      definitions: {},
      processingStack: context.processingStack,
      processedDefs: context.processedDefs,
    };

    // Override the context to use package-mode ref resolution
    // We do this by processing the form normally, then post-processing
    // the $defs into separate files with relative $ref

    const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef, formDocId, stdContext);

    // Now convert $defs to separate files and rewrite $ref pointers
    if (schema.$defs && Object.keys(schema.$defs).length > 0) {
      const refRewrites = new Map<string, string>();

      for (const [defName, defSchema] of Object.entries(schema.$defs)) {
        // Find the original subFormId for this def
        const originalSubFormId = this._findSubFormIdForDefName(defName, context.formsBySubFormId);

        const isCommon =
          (originalSubFormId && context.commonSubFormIds.has(originalSubFormId)) ||
          PackageSchemaMapping.isCommonDefName(defName);

        if (isCommon) {
          // This belongs in common/ — use a normalized leaf-based filename
          const leafName = defName.includes("_") ? defName.substring(defName.lastIndexOf("_") + 1) : defName;
          const commonFileName = leafName + ".schema.json";
          // Compute relative path to common/ based on folder depth
          // e.g., "bp/entities" (depth 2) → "../../common/", "world" (depth 1) → "../common/"
          const folderDepth = context.currentDocFolder.split("/").length;
          const relativePath = "../".repeat(folderDepth) + "common/" + commonFileName;
          refRewrites.set("#/$defs/" + defName, relativePath);

          // Write the common schema if not already written
          if (!context.writtenFiles.has(commonFileName)) {
            context.writtenFiles.set(commonFileName, "common");
          }
        } else {
          // This belongs in the current document folder
          const componentFileName = defName + ".schema.json";
          refRewrites.set("#/$defs/" + defName, "./" + componentFileName);

          // Queue the component schema for writing
          const componentSchema: JSONSchema7 = {
            $schema: "http://json-schema.org/draft-07/schema#",
            ...(defSchema as JSONSchema7),
          };

          context.pendingWrites.push({
            fileName: componentFileName,
            schema: componentSchema,
          });
        }
      }

      // Rewrite all $ref pointers in the schema tree
      this._rewriteRefs(schema, refRewrites);

      // Also rewrite $ref in pending component schemas (they may reference each other)
      for (const pending of context.pendingWrites) {
        this._rewriteRefs(pending.schema, refRewrites);
      }

      // Remove $defs from the root schema (they're now separate files)
      delete schema.$defs;
    }

    // Pass 2: Extract deeply nested inline objects into separate files.
    // This handles schemas built from inline subForm definitions (not subFormId),
    // which don't go through $defs and remain inlined in the schema tree.
    this._extractInlineObjects(schema, context, formDocId);

    return schema;
  }

  /**
   * Find the original subFormId that produced a given defName.
   */
  private _findSubFormIdForDefName(
    defName: string,
    formsBySubFormId: { [id: string]: IFormDefinition }
  ): string | undefined {
    // defName is subFormId with / replaced by _ — reverse it
    for (const subFormId of Object.keys(formsBySubFormId)) {
      if (JsonSchemaGenerator.subFormIdToDefName(subFormId) === defName) {
        return subFormId;
      }
    }
    return undefined;
  }

  /**
   * Recursively rewrite $ref values in a JSON Schema tree.
   */
  private _rewriteRefs(obj: unknown, rewrites: Map<string, string>): void {
    if (obj === null || obj === undefined || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        this._rewriteRefs(item, rewrites);
      }
      return;
    }

    const record = obj as Record<string, unknown>;

    if (typeof record["$ref"] === "string") {
      const newRef = rewrites.get(record["$ref"]);
      if (newRef) {
        record["$ref"] = newRef;
      }
    }

    for (const key of Object.keys(record)) {
      if (key !== "$ref") {
        this._rewriteRefs(record[key], rewrites);
      }
    }
  }

  /**
   * Minimum number of properties an inline object must have to be extracted
   * into its own file. Objects with fewer properties are left inline.
   */
  private static readonly INLINE_EXTRACT_MIN_PROPS = 3;

  /**
   * Walks the schema tree and extracts complex inline objects into separate files.
   * An inline object is eligible for extraction if it has `type: "object"` with
   * a `title` and at least INLINE_EXTRACT_MIN_PROPS properties.
   *
   * This handles schemas generated from forms that use inline `subForm` definitions
   * rather than `subFormId` references — those never go through `$defs` and remain
   * inlined in the schema tree.
   */
  private _extractInlineObjects(schema: JSONSchema7, context: IPackageSchemaContext, docId: string): void {
    const extractedNames = new Set<string>();

    const wrapper: Record<string, unknown> = { root: schema };
    this._walkAndExtract(wrapper, "root", context, docId, extractedNames, 0);
  }

  /**
   * Recursively walks a schema node, extracting complex inline objects
   * into separate component files and replacing them with $ref.
   */
  private _walkAndExtract(
    parent: Record<string, unknown>,
    parentKey: string,
    context: IPackageSchemaContext,
    docId: string,
    extractedNames: Set<string>,
    depth: number
  ): void {
    const node = parent[parentKey];
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (node[i] && typeof node[i] === "object") {
          this._walkAndExtract(
            node as unknown as Record<string, unknown>,
            String(i),
            context,
            docId,
            extractedNames,
            depth
          );
        }
      }
      return;
    }

    const obj = node as Record<string, unknown>;

    // Skip nodes that are already $ref
    if (obj["$ref"]) return;

    // Check if this is an extractable object: has type "object", a title, and enough properties
    const shouldExtract =
      depth > 0 &&
      obj["type"] === "object" &&
      typeof obj["title"] === "string" &&
      obj["properties"] &&
      typeof obj["properties"] === "object" &&
      Object.keys(obj["properties"] as object).length >= JsonSchemaGenerator.INLINE_EXTRACT_MIN_PROPS;

    if (shouldExtract) {
      // Generate a unique filename from the title
      let baseName = JsonSchemaGenerator.subFormIdToDefName(
        (obj["title"] as string).toLowerCase().replace(/\s+/g, "_")
      );

      // Ensure unique name
      if (extractedNames.has(baseName)) {
        let counter = 2;
        while (extractedNames.has(baseName + "_" + counter)) counter++;
        baseName = baseName + "_" + counter;
      }
      extractedNames.add(baseName);

      const fileName = baseName + ".schema.json";

      // First, recursively extract from this object's children BEFORE extracting it
      this._walkAndExtractChildren(obj, context, docId, extractedNames, depth + 1);

      // Create the component schema
      const componentSchema: JSONSchema7 = {
        $schema: "http://json-schema.org/draft-07/schema#",
        ...(obj as JSONSchema7),
      };

      context.pendingWrites.push({ fileName, schema: componentSchema });

      // Replace this object with a $ref in the parent
      const refObj: Record<string, unknown> = { $ref: "./" + fileName };
      // Preserve title and description on the $ref for hover tooltips
      if (obj["title"]) refObj["title"] = obj["title"];
      if (obj["description"]) refObj["description"] = obj["description"];
      if (obj["defaultSnippets"]) refObj["defaultSnippets"] = obj["defaultSnippets"];

      parent[parentKey] = refObj;
    } else {
      // Not extractable — just recurse into children
      this._walkAndExtractChildren(obj, context, docId, extractedNames, depth + 1);
    }
  }

  /**
   * Recurses into the children of a schema node to extract inline objects.
   */
  private _walkAndExtractChildren(
    obj: Record<string, unknown>,
    context: IPackageSchemaContext,
    docId: string,
    extractedNames: Set<string>,
    depth: number
  ): void {
    // Walk into properties
    if (obj["properties"] && typeof obj["properties"] === "object") {
      const props = obj["properties"] as Record<string, unknown>;
      for (const propKey of Object.keys(props)) {
        this._walkAndExtract(props, propKey, context, docId, extractedNames, depth);
      }
    }

    // Walk into items (for arrays)
    if (obj["items"] && typeof obj["items"] === "object") {
      if (Array.isArray(obj["items"])) {
        for (let i = 0; i < obj["items"].length; i++) {
          this._walkAndExtract(
            obj["items"] as unknown as Record<string, unknown>,
            String(i),
            context,
            docId,
            extractedNames,
            depth
          );
        }
      } else {
        this._walkAndExtract(obj as Record<string, unknown>, "items", context, docId, extractedNames, depth);
      }
    }

    // Walk into anyOf / oneOf / allOf
    for (const combiner of ["anyOf", "oneOf", "allOf"]) {
      if (Array.isArray(obj[combiner])) {
        const arr = obj[combiner] as unknown[];
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] && typeof arr[i] === "object") {
            this._walkAndExtract(
              arr as unknown as Record<string, unknown>,
              String(i),
              context,
              docId,
              extractedNames,
              depth
            );
          }
        }
      }
    }

    // Walk into additionalProperties
    if (obj["additionalProperties"] && typeof obj["additionalProperties"] === "object") {
      this._walkAndExtract(obj, "additionalProperties", context, docId, extractedNames, depth);
    }
  }

  /**
   * Recursively loads all .form.json files from a folder into dictionaries.
   * @param formsByPath - Dictionary keyed by relative file path
   * @param formsBySubFormId - Dictionary keyed by subFormId (e.g., "misc/floatrange")
   * @param inputFolder - The folder to load from
   * @param basePath - Base path for subFormId calculation (internal use)
   */
  public async loadFormJsonFromFolder(
    formsByPath: { [name: string]: IFormDefinition },
    formsBySubFormId: { [subFormId: string]: IFormDefinition },
    inputFolder: IFolder,
    basePath: string = ""
  ): Promise<void> {
    if (!inputFolder.isLoaded) {
      await inputFolder.load();
    }

    for (const folderName in inputFolder.folders) {
      const folder = inputFolder.folders[folderName];

      if (folder) {
        const newBasePath = basePath ? basePath + "/" + folderName : folderName;
        await this.loadFormJsonFromFolder(formsByPath, formsBySubFormId, folder, newBasePath);
      }
    }

    for (const fileName in inputFolder.files) {
      const file = inputFolder.files[fileName];

      if (file && fileName.endsWith(".json")) {
        if (!file.isContentLoaded) {
          await file.loadContent();
        }

        const jsonO = StorageUtilities.getJsonObject(file);

        if (jsonO) {
          formsByPath[file.storageRelativePath] = jsonO as IFormDefinition;

          // Calculate subFormId: folder/filename without extension
          // e.g., "misc/floatrange" from "/misc/floatrange.form.json"
          let subFormId = basePath ? basePath + "/" : "";
          if (fileName.endsWith(".form.json")) {
            subFormId += fileName.replace(/\.form\.json$/, "");
          } else {
            subFormId += fileName.replace(/\.json$/, "");
          }

          formsBySubFormId[subFormId] = jsonO as IFormDefinition;
        }
      }
    }
  }

  /**
   * Converts a subFormId (e.g., "misc/floatrange") to a valid JSON Schema $ref definition name.
   * Replaces slashes with underscores and sanitizes for use as a JSON key.
   */
  static subFormIdToDefName(subFormId: string): string {
    return subFormId.replace(/\//g, "_").replace(/[^a-zA-Z0-9_]/g, "_");
  }

  /**
   * Checks if a subFormId refers to a range form (floatrange or intrange).
   * Returns the JSON Schema numeric type ("number" or "integer") if it is a range form,
   * or undefined if it is not.
   */
  static getRangeTypeFromSubFormId(subFormId: string): "number" | "integer" | undefined {
    const lower = subFormId.toLowerCase();
    if (lower.endsWith("/floatrange") || lower === "floatrange") {
      return "number";
    }
    if (lower.endsWith("/intrange") || lower === "intrange") {
      return "integer";
    }
    return undefined;
  }

  /**
   * Converts a form definition to a JSON Schema.
   * @param formDef - The form definition to convert
   * @param parentId - Optional ID for the schema
   * @param context - Optional context for tracking definitions (used for subFormId resolution)
   */
  static async convertFormDefinitionToJsonSchema(
    formDef: IFormDefinition,
    parentId?: string,
    context?: ISchemaGenerationContext
  ): Promise<JSONSchema7> {
    let id = "";

    if (parentId) {
      id = parentId;
    }

    if (!id && formDef.id) {
      id = formDef.id;
    }

    if (!id && formDef.title) {
      id = formDef.title;
    }

    const schema: JSONSchema7 = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: id,
      title: formDef.title ? formDef.title : formDef.id,
      description: formDef.description,
      type: "object",
      properties: {},
      required: [],
    };

    if (formDef.fields) {
      for (const field of formDef.fields) {
        schema.properties = schema.properties || {};

        // Clean field ID - remove embedded enum syntax like `render_distance_type"<"fixed", "render"`
        const cleanId = JsonSchemaGenerator.cleanFieldId(field.id);

        if (cleanId && Utilities.isUsableAsObjectKey(cleanId)) {
          schema.properties[cleanId] = await JsonSchemaGenerator.convertFieldToJsonSchema(field, context);

          if (field.isRequired) {
            schema.required = schema.required || [];
            (schema.required as string[]).push(cleanId);
          }
        }
      }
    }

    // Remove empty required array
    if (schema.required && (schema.required as string[]).length === 0) {
      delete schema.required;
    }

    // If the form has a scalarField, the component can also be used as a simple scalar value.
    // Generate anyOf with the scalar type and the full object type.
    if (formDef.scalarField) {
      const scalarSchema = await JsonSchemaGenerator.convertFieldToJsonSchema(formDef.scalarField, context);

      if (scalarSchema && typeof scalarSchema === "object") {
        // Build the object option from the existing schema
        const objectOption: JSONSchema7 = { type: "object" };
        if (schema.properties && Object.keys(schema.properties).length > 0) {
          objectOption.properties = schema.properties;
        }
        if (schema.required) {
          objectOption.required = schema.required;
        }

        // Replace schema internals with anyOf
        delete schema.type;
        delete schema.properties;
        delete schema.required;
        schema.anyOf = [scalarSchema as JSONSchema7, objectOption];
      }
    }

    // Add $defs if context was provided and definitions were collected
    if (context && Object.keys(context.definitions).length > 0) {
      schema.$defs = context.definitions;
    }

    return schema;
  }

  /**
   * Resolves a subFormId to a $ref, loading and processing the referenced form if needed.
   * Handles cycles by detecting when a form is already being processed.
   * @returns A $ref object pointing to the definition, or undefined if resolution fails
   */
  static async resolveSubFormIdToRef(
    subFormId: string,
    context: ISchemaGenerationContext
  ): Promise<JSONSchema7 | undefined> {
    const defName = JsonSchemaGenerator.subFormIdToDefName(subFormId);

    // If already processed, just return a $ref
    if (context.processedDefs.has(subFormId)) {
      return { $ref: "#/$defs/" + defName };
    }

    // Cycle detection: if we're already processing this form, return a $ref
    // This handles mutual recursion (A -> B -> A)
    if (context.processingStack.has(subFormId)) {
      // Register a placeholder definition if not already present
      if (!context.definitions[defName]) {
        context.definitions[defName] = {
          type: "object",
          description: `[Cyclic reference to ${subFormId}]`,
        };
      }
      return { $ref: "#/$defs/" + defName };
    }

    // Check if we have this form loaded
    const subFormDef = context.formsBySubFormId[subFormId];
    if (!subFormDef) {
      Log.verbose(`Could not resolve subFormId: ${subFormId}`);
      return undefined;
    }

    // Mark as processing (cycle detection)
    context.processingStack.add(subFormId);

    try {
      // Get description, using summarizer as fallback if description is placeholder or missing
      let defDescription = subFormDef.description;
      if (!defDescription || JsonSchemaGenerator.isPlaceholderDescription(defDescription)) {
        const summarizerDesc = JsonSchemaGenerator.extractStaticDescriptionFromSummarizer(subFormDef);
        if (summarizerDesc) {
          defDescription = summarizerDesc;
        }
      }

      // Build the definition schema
      const defSchema: JSONSchema7 = {
        type: "object",
        title: subFormDef.title || subFormId,
        description: defDescription,
        properties: {},
      };

      const requiredFields: string[] = [];

      if (subFormDef.fields) {
        for (const field of subFormDef.fields) {
          // Clean field ID - remove embedded enum syntax
          const cleanId = JsonSchemaGenerator.cleanFieldId(field.id);

          if (cleanId && Utilities.isUsableAsObjectKey(cleanId)) {
            defSchema.properties![cleanId] = await JsonSchemaGenerator.convertFieldToJsonSchema(field, context);

            if (field.isRequired) {
              requiredFields.push(cleanId);
            }
          }
        }
      }

      if (requiredFields.length > 0) {
        defSchema.required = requiredFields;
      }

      // If the sub-form has a scalarField, the definition should allow either a scalar or object.
      if (subFormDef.scalarField) {
        const scalarSchema = await JsonSchemaGenerator.convertFieldToJsonSchema(subFormDef.scalarField, context);

        if (scalarSchema && typeof scalarSchema === "object") {
          const objectOption: JSONSchema7 = { type: "object" };
          if (defSchema.properties && Object.keys(defSchema.properties).length > 0) {
            objectOption.properties = defSchema.properties;
          }
          if (defSchema.required) {
            objectOption.required = defSchema.required;
          }

          const wrapperSchema: JSONSchema7 = {
            title: defSchema.title,
            description: defSchema.description,
            anyOf: [scalarSchema as JSONSchema7, objectOption],
          };

          context.definitions[defName] = wrapperSchema;
          context.processedDefs.add(subFormId);

          return { $ref: "#/$defs/" + defName };
        }
      }

      // Store in definitions
      context.definitions[defName] = defSchema;

      // Mark as fully processed
      context.processedDefs.add(subFormId);

      return { $ref: "#/$defs/" + defName };
    } finally {
      // Remove from processing stack (we're done with this path)
      context.processingStack.delete(subFormId);
    }
  }

  static async convertFieldToJsonSchema(
    field: IField,
    context?: ISchemaGenerationContext
  ): Promise<JSONSchema7Definition> {
    let schema: JSONSchema7 = {};

    if (field.title) {
      schema.title = field.title;
    }

    // Build rich description with samples
    // Pass context so we can look up referenced form descriptions for placeholders
    const richDescription = JsonSchemaGenerator.buildRichDescription(field, context);
    if (richDescription) {
      schema.description = richDescription;
    }

    // Check for subFormId reference first (external form reference)
    // This takes precedence for object types
    const hasSubFormId = field.subFormId && context;

    // Use inline subform if available
    const subForm = field.subForm;

    switch (field.dataType) {
      // Integer types
      case FieldDataType.int:
      case FieldDataType.intEnum:
      case FieldDataType.intBoolean:
      case FieldDataType.intValueLookup:
      case FieldDataType.long:
        schema.type = "integer";
        break;

      // Floating-point types
      case FieldDataType.float:
      case FieldDataType.number:
        schema.type = "number";
        break;

      // Boolean type
      case FieldDataType.boolean:
        schema.type = "boolean";
        break;

      // String types
      case FieldDataType.string:
      case FieldDataType.stringEnum:
      case FieldDataType.stringLookup:
      case FieldDataType.longFormString:
      case FieldDataType.localizableString:
      case FieldDataType.minecraftEventReference:
      case FieldDataType.version:
      case FieldDataType.uuid:
        schema.type = "string";
        break;

      // Molang expressions can be either string OR number (e.g., "query.is_baby" or 1.5)
      case FieldDataType.molang:
        schema.oneOf = [{ type: "string" }, { type: "number" }];
        break;

      // String array types
      case FieldDataType.stringArray:
      case FieldDataType.longFormStringArray:
      case FieldDataType.checkboxListAsStringArray:
        schema.type = "array";
        schema.items = { type: "string" };
        break;

      // Molang array - items can be either string OR number
      case FieldDataType.molangArray:
        schema.type = "array";
        schema.items = { oneOf: [{ type: "string" }, { type: "number" }] };
        break;

      // Number array types
      case FieldDataType.numberArray:
        schema.type = "array";
        schema.items = { type: "number" };
        break;

      // 2D point (x, y) - array of 2 numbers
      case FieldDataType.point2:
        schema.type = "array";
        schema.items = { type: "number" };
        schema.minItems = 2;
        schema.maxItems = 2;
        break;

      // 3D point (x, y, z) - array of 3 numbers
      case FieldDataType.point3:
      case FieldDataType.location:
      case FieldDataType.locationOffset:
        schema.type = "array";
        schema.items = { type: "number" };
        schema.minItems = 3;
        schema.maxItems = 3;
        break;

      // 3D integer point
      case FieldDataType.intPoint3:
        schema.type = "array";
        schema.items = { type: "integer" };
        schema.minItems = 3;
        schema.maxItems = 3;
        break;

      // Range types - can be single value, array of 2 values, OR object with min/max properties
      // According to IField.ts: "{ "min": 0, "max": 100 } or [0, 100] or 50"
      case FieldDataType.intRange:
        schema.oneOf = [
          { type: "integer" },
          { type: "array", items: { type: "integer" }, minItems: 2, maxItems: 2 },
          {
            type: "object",
            properties: {
              min: { type: "integer", description: "Minimum value of the range" },
              max: { type: "integer", description: "Maximum value of the range" },
            },
          },
        ];
        break;

      case FieldDataType.floatRange:
      case FieldDataType.percentRange:
        schema.oneOf = [
          { type: "number" },
          { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
          {
            type: "object",
            properties: {
              min: { type: "number", description: "Minimum value of the range" },
              max: { type: "number", description: "Maximum value of the range" },
            },
          },
        ];
        break;

      // Object types with subform or subFormId reference
      case FieldDataType.object:
        if (hasSubFormId) {
          // Check if this subFormId refers to a range form (floatrange/intrange).
          // Range fields in Minecraft can be a single number, a 2-element array, or an object {min, max}.
          // The form source generator sometimes assigns dataType: 16 (object) for these,
          // but the schema should allow all three representations.
          const rangeType = JsonSchemaGenerator.getRangeTypeFromSubFormId(field.subFormId!);
          if (rangeType) {
            const numType = rangeType === "integer" ? "integer" : "number";
            const refSchema = await JsonSchemaGenerator.resolveSubFormIdToRef(field.subFormId!, context!);
            schema.anyOf = [
              { type: numType },
              { type: "array", items: { type: numType }, minItems: 2, maxItems: 2 },
              refSchema || { type: "object" },
            ];
            break;
          }

          // Use $ref to external form definition
          const refSchema = await JsonSchemaGenerator.resolveSubFormIdToRef(field.subFormId!, context!);
          if (refSchema) {
            // Merge $ref with any title/description from this field
            if (schema.title || schema.description) {
              schema = { ...schema, ...refSchema };
            } else {
              schema = refSchema;
            }

            // Generate defaultSnippet for this object type so Monaco offers a template
            // This is important for components that can be set to an object value
            const resolvedForm = context?.formsBySubFormId?.[field.subFormId!];
            if (resolvedForm) {
              const snippetBody = JsonSchemaGenerator.generateSnippetBodyFromSubForm(resolvedForm, field);
              if (snippetBody && Object.keys(snippetBody).length > 0) {
                const snippetLabel = resolvedForm.title || field.title || "Object";
                (schema as any).defaultSnippets = [
                  {
                    label: snippetLabel,
                    description: resolvedForm.description || field.description || `Create a ${snippetLabel}`,
                    body: snippetBody,
                  },
                ];
              }
            }
            break;
          }
          // Fall through to inline handling if resolution failed
        }

        schema.type = "object";
        if (subForm && subForm.fields) {
          schema.properties = {};
          for (const subField of subForm.fields) {
            // Clean field ID - remove embedded enum syntax
            const cleanSubId = JsonSchemaGenerator.cleanFieldId(subField.id);
            if (cleanSubId && Utilities.isUsableAsObjectKey(cleanSubId)) {
              schema.properties[cleanSubId] = await JsonSchemaGenerator.convertFieldToJsonSchema(subField, context);
            }
          }
          // Generate defaultSnippet for inline subForm objects too
          const snippetBody = JsonSchemaGenerator.generateSnippetBodyFromSubForm(subForm, field);
          if (snippetBody && Object.keys(snippetBody).length > 0) {
            const snippetLabel = subForm.title || field.title || "Object";
            (schema as any).defaultSnippets = [
              {
                label: snippetLabel,
                description: subForm.description || field.description || `Create a ${snippetLabel}`,
                body: snippetBody,
              },
            ];
          }
        }
        break;

      // Minecraft event triggers can be either a string (event name) or an object with event/target/filters
      case FieldDataType.minecraftEventTrigger: {
        const triggerObjectSchema: JSONSchema7 = { type: "object" };

        if (hasSubFormId) {
          const refSchema = await JsonSchemaGenerator.resolveSubFormIdToRef(field.subFormId!, context!);
          if (refSchema) {
            // Create oneOf with string and the referenced object schema
            schema.oneOf = [{ type: "string" }, refSchema];
            break;
          }
        }

        // Default object properties for event trigger
        if (subForm && subForm.fields) {
          triggerObjectSchema.properties = {};
          for (const subField of subForm.fields) {
            // Clean field ID - remove embedded enum syntax
            const cleanSubId = JsonSchemaGenerator.cleanFieldId(subField.id);
            if (cleanSubId && Utilities.isUsableAsObjectKey(cleanSubId)) {
              triggerObjectSchema.properties[cleanSubId] = await JsonSchemaGenerator.convertFieldToJsonSchema(
                subField,
                context
              );
            }
          }
        } else {
          // Fallback: basic event trigger structure
          triggerObjectSchema.properties = {
            event: { type: "string" },
            target: { type: "string" },
          };
        }

        schema.oneOf = [{ type: "string" }, triggerObjectSchema];
        break;
      }

      // Minecraft filters can be a single filter object or an array of filter objects
      // They can also be group objects with all_of, any_of, or none_of properties
      // We use anyOf instead of oneOf because a simple filter object will match both
      // the basic filter schema and the group schema (since group properties are optional)
      case FieldDataType.minecraftFilter: {
        const filterObjectSchema: JSONSchema7 = { type: "object" };

        if (hasSubFormId) {
          const refSchema = await JsonSchemaGenerator.resolveSubFormIdToRef(field.subFormId!, context!);
          if (refSchema) {
            // Filters can be a single object, an array, or a group (all_of/any_of/none_of)
            // Create a recursive reference for the group patterns
            const filterGroupSchema: JSONSchema7 = {
              type: "object",
              properties: {
                all_of: { type: "array", items: refSchema },
                any_of: { type: "array", items: refSchema },
                none_of: { type: "array", items: refSchema },
              },
            };
            // Use anyOf to allow matching multiple schemas (filter objects match both simple and group)
            schema.anyOf = [refSchema, { type: "array", items: refSchema }, filterGroupSchema];
            break;
          }
        }

        if (subForm && subForm.fields) {
          filterObjectSchema.properties = {};
          for (const subField of subForm.fields) {
            // Clean field ID - remove embedded enum syntax
            const cleanSubId = JsonSchemaGenerator.cleanFieldId(subField.id);
            if (cleanSubId && Utilities.isUsableAsObjectKey(cleanSubId)) {
              filterObjectSchema.properties[cleanSubId] = await JsonSchemaGenerator.convertFieldToJsonSchema(
                subField,
                context
              );
            }
          }
        }

        // Filters can be a single object, an array, or a group (all_of/any_of/none_of)
        const filterGroupSchemaInline: JSONSchema7 = {
          type: "object",
          properties: {
            all_of: { type: "array", items: filterObjectSchema },
            any_of: { type: "array", items: filterObjectSchema },
            none_of: { type: "array", items: filterObjectSchema },
          },
        };
        // Use anyOf to allow matching multiple schemas (filter objects match both simple and group)
        schema.anyOf = [filterObjectSchema, { type: "array", items: filterObjectSchema }, filterGroupSchemaInline];
        break;
      }

      // Object array types
      case FieldDataType.objectArray:
        schema.type = "array";

        if (hasSubFormId) {
          // Use $ref to external form definition for array items
          const refSchema = await JsonSchemaGenerator.resolveSubFormIdToRef(field.subFormId!, context!);
          if (refSchema) {
            schema.items = refSchema;
            break;
          }
          // Fall through to inline handling if resolution failed
        }

        const itemsSchema: JSONSchema7 = { type: "object" };
        if (subForm && subForm.fields) {
          itemsSchema.properties = {};
          for (const subField of subForm.fields) {
            // Clean field ID - remove embedded enum syntax
            const cleanSubId = JsonSchemaGenerator.cleanFieldId(subField.id);
            if (cleanSubId && Utilities.isUsableAsObjectKey(cleanSubId)) {
              itemsSchema.properties[cleanSubId] = await JsonSchemaGenerator.convertFieldToJsonSchema(
                subField,
                context
              );
            }
          }
        }
        schema.items = itemsSchema;
        break;

      // Minecraft event trigger arrays: an array where each item can be a string OR object trigger
      // Used for damage_sensor/triggers, etc. - always an array, items are flexible
      case FieldDataType.minecraftEventTriggerArray: {
        // Build the trigger object schema
        const triggerObjectSchemaForArray: JSONSchema7 = { type: "object" };

        if (hasSubFormId) {
          const refSchema = await JsonSchemaGenerator.resolveSubFormIdToRef(field.subFormId!, context!);
          if (refSchema) {
            // Array of triggers, each can be string or object
            schema.type = "array";
            schema.items = { oneOf: [{ type: "string" }, refSchema] };
            break;
          }
        }

        // Default object properties for event trigger
        if (subForm && subForm.fields) {
          triggerObjectSchemaForArray.properties = {};
          for (const subField of subForm.fields) {
            // Clean field ID - remove embedded enum syntax
            const cleanSubId = JsonSchemaGenerator.cleanFieldId(subField.id);
            if (cleanSubId && Utilities.isUsableAsObjectKey(cleanSubId)) {
              triggerObjectSchemaForArray.properties[cleanSubId] = await JsonSchemaGenerator.convertFieldToJsonSchema(
                subField,
                context
              );
            }
          }
        } else {
          // Fallback: basic event trigger structure
          triggerObjectSchemaForArray.properties = {
            event: { type: "string" },
            target: { type: "string" },
          };
        }

        // Array of triggers, each can be string or object
        schema.type = "array";
        schema.items = { oneOf: [{ type: "string" }, triggerObjectSchemaForArray] };
        break;
      }

      // Keyed collection types (object with additionalProperties)
      case FieldDataType.keyedStringCollection:
        schema.type = "object";
        schema.additionalProperties = { type: "string" };
        break;

      case FieldDataType.keyedNumberCollection:
        schema.type = "object";
        schema.additionalProperties = { type: "number" };
        break;

      case FieldDataType.keyedBooleanCollection:
        schema.type = "object";
        schema.additionalProperties = { type: "boolean" };
        break;

      case FieldDataType.keyedObjectCollection:
        schema.type = "object";

        if (hasSubFormId) {
          // Use $ref to external form definition for keyed objects
          const refSchema = await JsonSchemaGenerator.resolveSubFormIdToRef(field.subFormId!, context!);
          if (refSchema) {
            schema.additionalProperties = refSchema;
            break;
          }
          // Fall through to inline handling if resolution failed
        }

        if (subForm && subForm.fields) {
          const objSchema: JSONSchema7 = { type: "object", properties: {} };
          for (const subField of subForm.fields) {
            if (Utilities.isUsableAsObjectKey(subField.id)) {
              objSchema.properties![subField.id] = await JsonSchemaGenerator.convertFieldToJsonSchema(
                subField,
                context
              );
            }
          }
          schema.additionalProperties = objSchema;
        } else {
          schema.additionalProperties = { type: "object" };
        }
        break;

      case FieldDataType.keyedStringArrayCollection:
        schema.type = "object";
        schema.additionalProperties = { type: "array", items: { type: "string" } };
        break;

      case FieldDataType.keyedNumberArrayCollection:
        schema.type = "object";
        schema.additionalProperties = { type: "array", items: { type: "number" } };
        break;

      case FieldDataType.keyedKeyedStringArrayCollection:
        schema.type = "object";
        schema.additionalProperties = {
          type: "object",
          additionalProperties: { type: "array", items: { type: "string" } },
        };
        break;

      case FieldDataType.arrayOfKeyedStringCollection:
        schema.type = "array";
        schema.items = {
          type: "object",
          additionalProperties: { type: "string" },
        };
        break;

      case FieldDataType.twoDStringArray:
        schema.type = "array";
        schema.items = {
          type: "array",
          items: { type: "string" },
        };
        break;

      // Mixed-type array: items can be string OR object
      // Used for animation references like ["animation.walk", { "animation.jump": "query.is_jumping" }]
      case FieldDataType.stringOrObjectArray: {
        const itemObjectSchema: JSONSchema7 = { type: "object" };

        if (hasSubFormId) {
          const refSchema = await JsonSchemaGenerator.resolveSubFormIdToRef(field.subFormId!, context!);
          if (refSchema) {
            schema.type = "array";
            schema.items = { oneOf: [{ type: "string" }, refSchema] };
            break;
          }
        }

        if (subForm && subForm.fields) {
          itemObjectSchema.properties = {};
          for (const subField of subForm.fields) {
            // Clean field ID - remove embedded enum syntax
            const cleanSubId = JsonSchemaGenerator.cleanFieldId(subField.id);
            if (cleanSubId && Utilities.isUsableAsObjectKey(cleanSubId)) {
              itemObjectSchema.properties[cleanSubId] = await JsonSchemaGenerator.convertFieldToJsonSchema(
                subField,
                context
              );
            }
          }
        } else {
          // For animation-style objects, allow any string keys with Molang values
          itemObjectSchema.additionalProperties = { oneOf: [{ type: "string" }, { type: "number" }] };
        }

        schema.type = "array";
        schema.items = { oneOf: [{ type: "string" }, itemObjectSchema] };
        break;
      }

      // Tuple array: each item is [string, number] tuple
      // Used for weighted lists like generate_for_climates: [["medium", 1], ["cold", 2]]
      case FieldDataType.stringNumberTupleArray:
        schema.type = "array";
        schema.items = {
          type: "array",
          items: [{ type: "string" }, { type: "number" }],
          minItems: 2,
          maxItems: 2,
        };
        break;

      // Single item that can be string OR object (not an array)
      // Used when a field accepts "animation_name" OR { "animation_name": "condition" }
      case FieldDataType.stringOrObject: {
        const singleObjectSchema: JSONSchema7 = { type: "object" };

        if (hasSubFormId) {
          const refSchema = await JsonSchemaGenerator.resolveSubFormIdToRef(field.subFormId!, context!);
          if (refSchema) {
            schema.oneOf = [{ type: "string" }, refSchema];
            break;
          }
        }

        if (subForm && subForm.fields) {
          singleObjectSchema.properties = {};
          for (const subField of subForm.fields) {
            // Clean field ID - remove embedded enum syntax
            const cleanSubId = JsonSchemaGenerator.cleanFieldId(subField.id);
            if (cleanSubId && Utilities.isUsableAsObjectKey(cleanSubId)) {
              singleObjectSchema.properties[cleanSubId] = await JsonSchemaGenerator.convertFieldToJsonSchema(
                subField,
                context
              );
            }
          }
        } else {
          // Default: allow any string keys with Molang values
          singleObjectSchema.additionalProperties = { oneOf: [{ type: "string" }, { type: "number" }] };
        }

        schema.oneOf = [{ type: "string" }, singleObjectSchema];
        break;
      }

      // 2D Molang array: Array<Array<string | number>>
      // Used for gradient colors like: [[1.0, 0.5, 0.5, 1.0], ["variable.color", 0.5, 0.5, 1.0]]
      case FieldDataType.twoDMolangArray:
        schema.type = "array";
        schema.items = {
          type: "array",
          items: { oneOf: [{ type: "string" }, { type: "number" }] },
        };
        break;

      // Default fallback for unknown types
      default:
        schema.type = "string";
        break;
    }

    // Handle additionalPropertiesOf: override additionalProperties based on specified dataType
    // This allows defining a collection field where the value type is specified separately
    // For example: a keyedObjectCollection with additionalPropertiesOf: molangArray
    if (field.additionalPropertiesOf !== undefined && schema.type === "object") {
      // Create a synthetic field with the additionalPropertiesOf dataType to generate the schema
      const syntheticField: IField = {
        id: "_additionalProperties",
        dataType: field.additionalPropertiesOf,
      };
      const additionalPropsSchema = await JsonSchemaGenerator.convertFieldToJsonSchema(syntheticField, context);
      if (additionalPropsSchema && typeof additionalPropsSchema === "object") {
        // Remove title from the synthetic schema (it's just "_additionalProperties")
        const cleanSchema = { ...additionalPropsSchema } as JSONSchema7;
        delete cleanSchema.title;
        schema.additionalProperties = cleanSchema;
      }
    }

    // Add enum values if choices or enumValues are defined and mustMatchChoices is not explicitly false
    // When mustMatchChoices is false, the choices are just examples/suggestions, not restrictions
    // enumValues is a shorthand for simple enum lists without labels; choices takes precedence if both exist
    const hasChoices = field.choices && field.choices.length > 0;
    const hasEnumValues = field.enumValues && field.enumValues.length > 0;
    if ((hasChoices || hasEnumValues) && field.mustMatchChoices !== false) {
      const enumValues = hasChoices ? field.choices!.map((choice) => choice.id) : field.enumValues!;

      // Special handling for boolean fields with string choices
      // This happens when a field can be true/false OR a string like "yes"/"no"/"maybe"
      if (field.dataType === FieldDataType.boolean) {
        // Check if the choices are string values (not just "true"/"false")
        const hasNonBooleanChoices = enumValues.some((v) => typeof v === "string" && v !== "true" && v !== "false");
        if (hasNonBooleanChoices) {
          // Create a oneOf with boolean type and string type with enum
          schema = {
            oneOf: [{ type: "boolean" }, { type: "string", enum: enumValues }],
            title: schema.title,
            description: schema.description,
          };
          // Clean up undefined properties
          if (!schema.title) delete schema.title;
          if (!schema.description) delete schema.description;
        }
        // If choices are just boolean values, skip adding enum (redundant)
      } else if (
        // For array types, the enum applies to the items, not the array itself
        field.dataType === FieldDataType.stringArray ||
        field.dataType === FieldDataType.molangArray ||
        field.dataType === FieldDataType.longFormStringArray ||
        field.dataType === FieldDataType.checkboxListAsStringArray ||
        field.dataType === FieldDataType.numberArray
      ) {
        // Ensure items exists and add enum to it
        if (!schema.items) {
          schema.items = { type: "string" };
        }
        (schema.items as JSONSchema7).enum = enumValues;
      } else {
        schema.enum = enumValues;
      }
    }

    // Add numeric constraints if defined
    if (field.minValue !== undefined) {
      schema.minimum = field.minValue;
    }
    if (field.maxValue !== undefined) {
      schema.maximum = field.maxValue;
    }

    // Extract constraints from validity conditions
    if (field.validity && field.validity.length > 0) {
      for (const condition of field.validity) {
        if (typeof condition.value === "number") {
          switch (condition.comparison) {
            case ComparisonType.greaterThanOrEqualTo:
              if (schema.minimum === undefined) {
                schema.minimum = condition.value;
              }
              break;
            case ComparisonType.greaterThan:
              if (schema.exclusiveMinimum === undefined) {
                schema.exclusiveMinimum = condition.value;
              }
              break;
            case ComparisonType.lessThanOrEqualTo:
              if (schema.maximum === undefined) {
                schema.maximum = condition.value;
              }
              break;
            case ComparisonType.lessThan:
              if (schema.exclusiveMaximum === undefined) {
                schema.exclusiveMaximum = condition.value;
              }
              break;
          }
        } else if (typeof condition.value === "string" && condition.comparison === ComparisonType.matchesPattern) {
          if (schema.pattern === undefined) {
            schema.pattern = condition.value;
          }
        }
      }
    }

    // Add string length constraints if defined
    if (field.minLength !== undefined) {
      schema.minLength = field.minLength;
    }
    if (field.maxLength !== undefined) {
      schema.maxLength = field.maxLength;
    }

    // Add array length constraints if defined
    if (field.fixedLength !== undefined) {
      schema.minItems = field.fixedLength;
      schema.maxItems = field.fixedLength;
    }

    // Add default value if specified (only for primitive types that fit JSONSchema7Type)
    if (field.defaultValue !== undefined) {
      const defaultVal = field.defaultValue;
      if (typeof defaultVal === "string") {
        schema.default = defaultVal;
      } else if (typeof defaultVal === "number") {
        schema.default = defaultVal;
      } else if (typeof defaultVal === "boolean") {
        schema.default = defaultVal;
      } else if (defaultVal === null) {
        schema.default = null;
      }
      // Skip object/array defaults as they require complex type casting
    }

    // Add deprecated flag (using description suffix, since deprecated isn't in draft-07)
    // Note: JSON Schema draft-07 doesn't have a deprecated keyword, so we use a convention
    if (field.isDeprecated) {
      const deprecatedNote = "[DEPRECATED] ";
      schema.description = schema.description ? deprecatedNote + schema.description : deprecatedNote;
      // Also add the deprecated keyword for tools that support it (draft 2019-09+, OpenAPI)
      (schema as any).deprecated = true;
    }

    // Add technical description as x-runtime-constraint-description if present
    if (field.technicalDescription) {
      (schema as any)["x-runtime-constraint-description"] = field.technicalDescription;
    }

    // Handle alternates: if this field has alternate representations, generate oneOf
    // For example, a field that can be a string OR a number would have an alternate
    if (field.alternates && field.alternates.length > 0) {
      // Build schemas for all alternates, and track snippets for object alternates
      const alternateSchemas: JSONSchema7[] = [];
      const defaultSnippets: IDefaultSnippet[] = [];

      for (const alternate of field.alternates) {
        const altSchema = await JsonSchemaGenerator.convertFieldToJsonSchema(alternate, context);
        if (altSchema && typeof altSchema === "object") {
          // Generate a defaultSnippet for object alternates so Monaco offers object completion
          if (alternate.dataType === FieldDataType.object) {
            // Resolve the subForm - either inline or from subFormId reference
            let resolvedSubForm = alternate.subForm;
            if (!resolvedSubForm && alternate.subFormId && context?.formsBySubFormId) {
              resolvedSubForm = context.formsBySubFormId[alternate.subFormId];
            }

            if (resolvedSubForm) {
              const snippetBody = JsonSchemaGenerator.generateSnippetBodyFromSubForm(resolvedSubForm, alternate);
              if (snippetBody && Object.keys(snippetBody).length > 0) {
                const snippetLabel = resolvedSubForm.title || alternate.title || field.title || "Object";
                const snippet: IDefaultSnippet = {
                  label: `${snippetLabel} (object)`,
                  description:
                    resolvedSubForm.description || alternate.description || `Use ${snippetLabel} as an object`,
                  body: snippetBody,
                };
                defaultSnippets.push(snippet);

                // Also add the snippet directly to the alternate schema so Monaco
                // can offer it when the user is inside this alternative
                (altSchema as any).defaultSnippets = [snippet];
              }
            }
          }
          alternateSchemas.push(altSchema as JSONSchema7);
        }
      }

      // Heuristic: If the main type is keyedStringCollection but alternates include number types,
      // this is likely a Molang expression field that should also accept plain strings.
      // Add plain string type to cover Molang string expressions like "math.random(0, 1)".
      const hasNumericAlternate = field.alternates.some(
        (alt) =>
          alt.dataType === FieldDataType.float ||
          alt.dataType === FieldDataType.number ||
          alt.dataType === FieldDataType.int
      );
      const isKeyedCollection = field.dataType === FieldDataType.keyedStringCollection;
      if (isKeyedCollection && hasNumericAlternate) {
        // Add plain string type for Molang expression support
        alternateSchemas.unshift({ type: "string" });
      }

      if (alternateSchemas.length > 0) {
        // If the main schema already has oneOf or anyOf (like for molang, ranges, or filters), merge it
        const existingCombinator = schema.oneOf ? "oneOf" : schema.anyOf ? "anyOf" : null;
        if (existingCombinator) {
          // Combine existing options with alternate schemas, then deduplicate
          const existingOptions = (schema.oneOf || schema.anyOf) as JSONSchema7[];

          // Filter out bare type alternates (like {type: "object"}) that would cause ambiguity
          // when we already have more specific schemas of that type in the existing options
          const existingTypes = new Set<string>();
          for (const opt of existingOptions) {
            if (opt.type && typeof opt.type === "string") {
              // Only count as "specific" if it has more than just type
              const hasSpecificProperties = opt.properties || opt.items || opt.enum || opt.$ref;
              if (hasSpecificProperties) {
                existingTypes.add(opt.type);
              }
            }
          }

          // Remove alternates that are just bare types that would conflict
          const filteredAlternates = alternateSchemas.filter((alt) => {
            // A bare type schema has type and nothing else meaningful
            const isBareType = alt.type && !alt.properties && !alt.items && !alt.enum && !alt.$ref;
            if (isBareType && typeof alt.type === "string") {
              // Don't add if we already have a specific schema of this type
              return !existingTypes.has(alt.type);
            }
            return true;
          });

          const combinedOptions = JsonSchemaGenerator.deduplicateSchemas([...existingOptions, ...filteredAlternates]);
          const wrappedSchema: JSONSchema7 = {
            [existingCombinator]: combinedOptions,
          };
          // Preserve metadata on the wrapper
          if (schema.title) wrappedSchema.title = schema.title;
          if (schema.description) wrappedSchema.description = schema.description;

          // Add defaultSnippets for Monaco object completion (VS Code extension to JSON Schema)
          if (defaultSnippets.length > 0) {
            (wrappedSchema as any).defaultSnippets = defaultSnippets;
          }

          return wrappedSchema;
        } else {
          // Create an anyOf with the main schema type and all alternates
          // Extract type-related properties for the primary option
          const primaryOption: JSONSchema7 = {};
          if (schema.type) primaryOption.type = schema.type;
          if (schema.items) primaryOption.items = schema.items;
          if (schema.properties) primaryOption.properties = schema.properties;
          if (schema.required) primaryOption.required = schema.required;
          if (schema.additionalProperties) primaryOption.additionalProperties = schema.additionalProperties;
          if (schema.enum) primaryOption.enum = schema.enum;
          if (schema.minimum !== undefined) primaryOption.minimum = schema.minimum;
          if (schema.maximum !== undefined) primaryOption.maximum = schema.maximum;
          if (schema.minItems !== undefined) primaryOption.minItems = schema.minItems;
          if (schema.maxItems !== undefined) primaryOption.maxItems = schema.maxItems;
          if (schema.$ref) primaryOption.$ref = schema.$ref;

          // Generate default snippets for the primary type so Monaco offers completions
          // This ensures boolean fields show true/false options alongside object alternates
          if (field.dataType === FieldDataType.boolean) {
            const boolLabel = field.title || field.id || "Boolean";
            defaultSnippets.push({
              label: `${boolLabel}: true (enable)`,
              description: field.description || `Enable ${boolLabel}`,
              body: true,
            });
            defaultSnippets.push({
              label: `${boolLabel}: false (disable)`,
              description: field.description || `Disable ${boolLabel}`,
              body: false,
            });
          } else if (field.dataType === FieldDataType.string && field.defaultValue !== undefined) {
            const strLabel = field.title || field.id || "String";
            defaultSnippets.push({
              label: `${strLabel} (default)`,
              description: `Use default value: ${field.defaultValue}`,
              body: field.defaultValue,
            });
          }

          // Skip empty primary option - it would match everything and cause oneOf conflicts
          // An empty schema {} in oneOf will match any value, causing "must match exactly one" errors
          const isPrimaryEmpty = Object.keys(primaryOption).length === 0;

          // Build the combined oneOf array
          let combinedOptions: JSONSchema7[];
          if (isPrimaryEmpty) {
            // If primary is empty, just use the alternates (don't include empty schema)
            combinedOptions = JsonSchemaGenerator.deduplicateSchemas(alternateSchemas);
          } else {
            // Deduplicate the combined oneOf array
            combinedOptions = JsonSchemaGenerator.deduplicateSchemas([primaryOption, ...alternateSchemas]);
          }

          // Only wrap in anyOf if we have multiple options
          // Note: We use anyOf instead of oneOf because oneOf requires EXACTLY one schema to match.
          // When a value like "true" or {} could potentially match multiple schemas, oneOf shows
          // a warning "Matches multiple schemas when only one must validate". anyOf allows
          // one or more matches, which is the semantically correct behavior for "can be X or Y".
          if (combinedOptions.length === 1) {
            // Single option - return it directly with metadata
            const singleSchema = { ...combinedOptions[0] };
            if (schema.title) singleSchema.title = schema.title;
            if (schema.description) singleSchema.description = schema.description;
            return singleSchema;
          }

          const wrappedSchema: JSONSchema7 = {
            anyOf: combinedOptions,
          };
          // Preserve metadata on the wrapper
          if (schema.title) wrappedSchema.title = schema.title;
          if (schema.description) wrappedSchema.description = schema.description;

          // Add defaultSnippets for Monaco object completion (VS Code extension to JSON Schema)
          if (defaultSnippets.length > 0) {
            (wrappedSchema as any).defaultSnippets = defaultSnippets;
          }

          return wrappedSchema;
        }
      }
    }

    return schema;
  }
}

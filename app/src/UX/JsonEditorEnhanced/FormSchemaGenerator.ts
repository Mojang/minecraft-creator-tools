/**
 * FormSchemaGenerator.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * Generates JSON Schema from our .form.json definitions for Monaco's JSON editor.
 * This allows Monaco's built-in JSON language service to use our rich form metadata for:
 * - Hover documentation (including sample values!)
 * - Autocompletion
 * - Validation
 *
 * WHY THIS APPROACH:
 * Monaco's JSON language service is tightly integrated with JSON Schema.
 * Rather than fighting it with registerHoverProvider (which gets bypassed),
 * we generate schemas FROM our form definitions, injecting:
 * - Descriptions with sample values
 * - Type constraints (min/max, enum values)
 * - Nested structure from subFormId references
 *
 * RELATIONSHIP TO JsonSchemaGenerator:
 * This class uses the battle-tested JsonSchemaGenerator from src/schema/ for the
 * core field-to-schema conversion logic. We wrap it to add UX-specific features:
 * - Sample values in descriptions (for hover tooltips)
 * - markdownDescription for richer formatting
 * - Runtime caching for editor performance
 *
 * RELATED FILES:
 * - schema/JsonSchemaGenerator.ts - Core schema generation (used by this class)
 * - dataform/IField.ts - Source field definitions
 * - dataform/IFormDefinition.ts - Form structure and samples
 * - FormDefinitionCache.ts - Loads form definitions
 * - JsonEditor.tsx - Uses generated schemas
 */

import IFormDefinition from "../../dataform/IFormDefinition";
import IField, { FieldDataType } from "../../dataform/IField";
import DataFormUtilities from "../../dataform/DataFormUtilities";
import { FormDefinitionCache } from "./FormDefinitionCache";
import { ProjectItemType } from "../../app/IProjectItemData";
import JsonSchemaGenerator, { ISchemaGenerationContext } from "../../schema/JsonSchemaGenerator";
import { JSONSchema7 } from "json-schema";

/**
 * JSON Schema structure for Monaco (compatible with JSONSchema7 but with markdownDescription)
 */
interface IJsonSchema extends JSONSchema7 {
  markdownDescription?: string;
}

/**
 * Generates JSON Schemas from form definitions for Monaco editor.
 * Wraps JsonSchemaGenerator to add sample values for rich hover tooltips.
 */
export class FormSchemaGenerator {
  private formCache: FormDefinitionCache;
  private schemaCache: Map<string, IJsonSchema> = new Map();
  private generatingForms: Set<string> = new Set(); // Prevent circular references

  constructor(formCache: FormDefinitionCache) {
    this.formCache = formCache;
  }

  /**
   * Generate a JSON Schema for a project item type
   */
  public async generateSchemaForItemType(itemType: ProjectItemType): Promise<IJsonSchema | null> {
    const cacheKey = `itemType:${itemType}`;

    if (this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey)!;
    }

    const form = await this.formCache.getFormForItemType(itemType);
    if (!form) {
      return null;
    }

    const schema = await this.generateSchemaFromForm(form);
    this.schemaCache.set(cacheKey, schema);
    return schema;
  }

  /**
   * Generate a JSON Schema from a form definition
   */
  public async generateSchemaFromForm(form: IFormDefinition): Promise<IJsonSchema> {
    const formId = form.id || "unknown";

    // Check cache
    if (this.schemaCache.has(formId)) {
      return this.schemaCache.get(formId)!;
    }

    // Prevent circular reference during generation
    if (this.generatingForms.has(formId)) {
      return { type: "object" }; // Return simple schema to break cycle
    }
    this.generatingForms.add(formId);

    try {
      // Create a context for subFormId resolution
      const context: ISchemaGenerationContext = {
        formsBySubFormId: {},
        definitions: {},
        processingStack: new Set(),
        processedDefs: new Set(),
      };

      // Pre-populate context with loadable forms
      await this.preloadFormsForContext(form, context);

      // Use core generator to convert form to schema
      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(form, formId, context);

      // Enrich with samples for each field, passing context for subFormId resolution
      await this.enrichSchemaWithSamples(schema as IJsonSchema, form, context);

      this.schemaCache.set(formId, schema as IJsonSchema);
      return schema as IJsonSchema;
    } finally {
      this.generatingForms.delete(formId);
    }
  }

  /**
   * Pre-load forms referenced by subFormId into the context
   */
  private async preloadFormsForContext(form: IFormDefinition, context: ISchemaGenerationContext): Promise<void> {
    if (!form.fields) return;

    for (const field of form.fields) {
      await this.preloadFieldSubForms(field, context);
    }
  }

  /**
   * Recursively preload subforms for a field
   */
  private async preloadFieldSubForms(field: IField, context: ISchemaGenerationContext): Promise<void> {
    if (field.subFormId && !context.formsBySubFormId[field.subFormId]) {
      const subForm = await this.loadSubForm(field.subFormId);
      if (subForm) {
        context.formsBySubFormId[field.subFormId] = subForm;
        await this.preloadFormsForContext(subForm, context);
      }
    }

    if (field.subForm && field.subForm.fields) {
      for (const subField of field.subForm.fields) {
        await this.preloadFieldSubForms(subField, context);
      }
    }

    if (field.alternates) {
      for (const alt of field.alternates) {
        await this.preloadFieldSubForms(alt, context);
      }
    }
  }

  /**
   * Enrich a schema with sample values from the form
   */
  private async enrichSchemaWithSamples(
    schema: IJsonSchema,
    form: IFormDefinition,
    context: ISchemaGenerationContext
  ): Promise<void> {
    if (!schema.properties || !form.fields) {
      return;
    }

    for (const field of form.fields) {
      if (field.id && schema.properties[field.id]) {
        const fieldSchema = schema.properties[field.id] as IJsonSchema;
        await this.enrichFieldSchemaWithSamples(fieldSchema, field, form, context);
      }
    }
  }

  /**
   * Enrich a field schema with sample values.
   * When a field has subFormId, we look up the referenced form to get its richer description
   * and property information.
   */
  private async enrichFieldSchemaWithSamples(
    schema: IJsonSchema,
    field: IField,
    form: IFormDefinition,
    context: ISchemaGenerationContext
  ): Promise<void> {
    // If field has subFormId, use the referenced form's description and fields
    let effectiveForm = form;
    let effectiveField = field;

    if (field.subFormId) {
      if (context.formsBySubFormId[field.subFormId]) {
        const subForm = context.formsBySubFormId[field.subFormId];
        effectiveForm = subForm;
        // Create a synthetic field with subform's metadata for description building
        effectiveField = {
          ...field,
          description: subForm.description || field.description,
          samples: subForm.samples || field.samples,
        };
      }
    }

    // Build enhanced description with samples
    const enhancedDescription = this.buildDescriptionWithSamples(effectiveField, effectiveForm, context);

    if (enhancedDescription) {
      schema.description = enhancedDescription;
      schema.markdownDescription = enhancedDescription;
    }

    // Get fields to iterate - either from subFormId reference or inline subForm
    const subFormFields =
      field.subFormId && context.formsBySubFormId[field.subFormId]
        ? context.formsBySubFormId[field.subFormId].fields
        : field.subForm?.fields;

    // Recursively enrich nested properties
    if (schema.properties && subFormFields) {
      for (const subField of subFormFields) {
        if (subField.id && schema.properties[subField.id]) {
          const subFormForField =
            field.subFormId && context.formsBySubFormId[field.subFormId]
              ? context.formsBySubFormId[field.subFormId]
              : form;
          await this.enrichFieldSchemaWithSamples(
            schema.properties[subField.id] as IJsonSchema,
            subField,
            subFormForField,
            context
          );
        }
      }
    }

    // Handle items for arrays
    if (schema.items && typeof schema.items === "object" && !Array.isArray(schema.items)) {
      const itemsSchema = schema.items as IJsonSchema;
      if (itemsSchema.properties && subFormFields) {
        for (const subField of subFormFields) {
          if (subField.id && itemsSchema.properties[subField.id]) {
            const subFormForField =
              field.subFormId && context.formsBySubFormId[field.subFormId]
                ? context.formsBySubFormId[field.subFormId]
                : form;
            await this.enrichFieldSchemaWithSamples(
              itemsSchema.properties[subField.id] as IJsonSchema,
              subField,
              subFormForField,
              context
            );
          }
        }
      }
    }
  }

  /**
   * Build description text with sample values included.
   * For object fields, includes a summary of the field's own child properties.
   * NOTE: We show properties that THIS FIELD contains, not sibling or parent properties.
   */
  private buildDescriptionWithSamples(field: IField, form: IFormDefinition, context: ISchemaGenerationContext): string {
    const parts: string[] = [];

    // Add field description
    if (field.description) {
      parts.push(field.description);
    }

    // Add version info
    if (field.versionIntroduced) {
      parts.push(`\n*Introduced in version ${field.versionIntroduced}*`);
    }

    if (field.isDeprecated || field.versionDeprecated) {
      const msg = field.versionDeprecated ? `⚠️ Deprecated since ${field.versionDeprecated}` : "⚠️ Deprecated";
      parts.push(`\n*${msg}*`);
    }

    // Add properties summary for object fields - show what THIS FIELD contains
    // Get the field's own child properties, not parent/sibling properties
    const fieldChildProperties = DataFormUtilities.getFieldChildProperties(field, context.formsBySubFormId);
    if (fieldChildProperties && fieldChildProperties.length > 0) {
      const propsText = this.formatPropertiesSummary(fieldChildProperties);
      if (propsText) {
        parts.push("\n\n" + propsText);
      }
    }

    // Add sample values
    if (!field.hideSamples) {
      const samplesText = this.formatSamples(field, form);
      if (samplesText) {
        parts.push("\n\n" + samplesText);
      }
    }

    // Add choice descriptions
    if (field.choices && field.choices.length > 0 && !field.hideSamples) {
      const choiceDescriptions = field.choices
        .filter((c) => c.description)
        .map((c) => `• \`${c.title || c.id}\`: ${c.description}`)
        .join("\n");

      if (choiceDescriptions) {
        parts.push("\n\n**Values:**\n" + choiceDescriptions);
      }
    }

    return parts.join("");
  }

  /**
   * Format a summary of properties for component forms.
   * Shows property name, type, default value, and constraints.
   */
  private formatPropertiesSummary(fields: IField[]): string | null {
    if (!fields || fields.length === 0) {
      return null;
    }

    // Filter to significant properties (those with ids that aren't internal)
    const significantFields = fields.filter((f) => f.id && !f.id.startsWith("_") && !f.isInternal);

    if (significantFields.length === 0) {
      return null;
    }

    const lines: string[] = ["**Properties:**"];

    for (const f of significantFields.slice(0, 8)) {
      // Limit to 8 to keep hover manageable
      const propLine = this.formatPropertyLine(f);
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
   * Format a single property for the properties summary
   */
  private formatPropertyLine(field: IField): string | null {
    if (!field.id) return null;

    const parts: string[] = [`• \`${field.id}\``];

    // Add type info
    const typeInfo = this.getFieldTypeString(field);
    if (typeInfo) {
      parts.push(`(${typeInfo})`);
    }

    // Add default value
    if (field.defaultValue !== undefined) {
      parts.push(`= \`${JSON.stringify(field.defaultValue)}\``);
    }

    // Add constraints (ranges)
    const constraints = this.getFieldConstraints(field);
    if (constraints) {
      parts.push(constraints);
    }

    return parts.join(" ");
  }

  /**
   * Get a human-readable type string for a field.
   * For object types with known subfields, shows a preview of property names.
   */
  private getFieldTypeString(field: IField): string | null {
    if (field.dataType !== undefined) {
      // For object types, try to show a preview of properties
      if (field.dataType === FieldDataType.object) {
        const propertyNames = DataFormUtilities.getObjectPropertyPreview(field);
        if (propertyNames) {
          return propertyNames;
        }
        return "object";
      }
      // Convert FieldDataType enum to a human-readable string
      return FieldDataType[field.dataType] || `type:${field.dataType}`;
    }
    if (field.choices && field.choices.length > 0) {
      return "enum";
    }
    return null;
  }

  /**
   * Get constraint information (ranges, etc.) for a field
   */
  private getFieldConstraints(field: IField): string | null {
    const constraints: string[] = [];

    if (field.suggestedMinValue !== undefined && field.suggestedMaxValue !== undefined) {
      constraints.push(`range: ${field.suggestedMinValue}-${field.suggestedMaxValue}`);
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
   * Format sample values for inclusion in description
   */
  private formatSamples(field: IField, form: IFormDefinition): string | null {
    const samples: { source: string; content: any }[] = [];

    // Collect from field.samples
    if (field.samples) {
      for (const [sourceKey, sampleArray] of Object.entries(field.samples)) {
        for (const sample of sampleArray) {
          samples.push({
            source: this.formatSourcePath(sourceKey),
            content: sample.content,
          });
        }
      }
    }

    // Collect from form.samples
    if (form.samples) {
      for (const [sourceKey, sampleArray] of Object.entries(form.samples)) {
        for (const sample of sampleArray) {
          samples.push({
            source: this.formatSourcePath(sourceKey),
            content: sample.content,
          });
        }
      }
    }

    if (samples.length === 0) {
      return null;
    }

    // Select up to 5 diverse samples
    const diverseSamples = this.selectDiverseSamples(samples, 5);

    if (diverseSamples.length === 0) {
      return null;
    }

    // Format as markdown
    const lines = ["**Sample values:**"];
    for (const { source, content } of diverseSamples) {
      const contentStr = this.formatContent(content);
      lines.push(`• ${source}: \`${contentStr}\``);
    }

    return lines.join("\n");
  }

  /**
   * Format source path for display
   */
  private formatSourcePath(sourcePath: string): string {
    if (sourcePath.includes("/")) {
      const parts = sourcePath.split("/");
      const filename = parts[parts.length - 1];
      return filename.replace(/\.json$/, "").replace(/\.(block|entity|item)$/, "");
    }
    return sourcePath;
  }

  /**
   * Format content value for display
   */
  private formatContent(content: any): string {
    if (typeof content === "object") {
      const str = JSON.stringify(content);
      return str.length > 60 ? str.slice(0, 57) + "..." : str;
    }
    return String(content);
  }

  /**
   * Select diverse samples
   */
  private selectDiverseSamples(
    samples: { source: string; content: any }[],
    maxCount: number
  ): { source: string; content: any }[] {
    if (samples.length <= maxCount) {
      return samples;
    }

    const selected: { source: string; content: any }[] = [];
    const seenHashes = new Set<string>();

    for (const sample of samples) {
      const hash = JSON.stringify(sample.content).slice(0, 50);
      if (!seenHashes.has(hash)) {
        selected.push(sample);
        seenHashes.add(hash);
        if (selected.length >= maxCount) break;
      }
    }

    return selected;
  }

  /**
   * Load a subform by its subFormId
   */
  private async loadSubForm(subFormId: string): Promise<IFormDefinition | null> {
    const parts = subFormId.split("/");
    if (parts.length !== 2) {
      return null;
    }
    return this.formCache.getForm(parts[0], parts[1]);
  }

  /**
   * Clear the schema cache
   */
  public clearCache(): void {
    this.schemaCache.clear();
  }
}

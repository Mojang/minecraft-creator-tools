/**
 * SchemaEnhancer.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * Enhances JSON schemas with additional information from form definitions,
 * including sample values. This allows Monaco's built-in JSON hover to display
 * our custom documentation alongside schema-based validation.
 *
 * WHY THIS APPROACH:
 * Monaco's JSON language service controls hover through its internal worker,
 * and registerHoverProvider() for "json" is effectively bypassed. Instead of
 * fighting this, we enhance the schema that Monaco uses, adding our sample
 * values and descriptions to the schema's `description` or `markdownDescription`
 * fields.
 *
 * HOW IT WORKS:
 * 1. Take a JSON schema
 * 2. Look up corresponding form definition
 * 3. Walk the schema and inject sample values into descriptions
 * 4. Return enhanced schema for Monaco to use
 *
 * RELATED FILES:
 * - JsonEditor.tsx - Uses this to enhance schemas before passing to Monaco
 * - FormDefinitionCache.ts - Source of form definitions and samples
 * - Database.ts - Loads raw schemas
 */

import IFormDefinition from "../../dataform/IFormDefinition";
import IField from "../../dataform/IField";
import { FormDefinitionCache } from "./FormDefinitionCache";
import { ProjectItemType } from "../../app/IProjectItemData";

/**
 * Enhances JSON schemas with form definition data (samples, descriptions)
 */
export class SchemaEnhancer {
  private formCache: FormDefinitionCache;

  constructor(formCache: FormDefinitionCache) {
    this.formCache = formCache;
  }

  /**
   * Enhance a schema with sample values from form definitions
   */
  public async enhanceSchema(schema: object, itemType: ProjectItemType): Promise<object> {
    // Get the form for this item type
    const form = await this.formCache.getFormForItemType(itemType);
    if (!form) {
      return schema;
    }

    // Deep clone the schema to avoid mutating the original
    const enhancedSchema = JSON.parse(JSON.stringify(schema));

    // Enhance the schema recursively
    await this.enhanceSchemaNode(enhancedSchema, form, []);

    return enhancedSchema;
  }

  /**
   * Recursively enhance schema nodes with form data
   */
  private async enhanceSchemaNode(node: any, form: IFormDefinition, path: string[]): Promise<void> {
    if (!node || typeof node !== "object") {
      return;
    }

    // If this is a property definition, try to enhance it
    if (node.description !== undefined || node.type !== undefined) {
      await this.enhancePropertyNode(node, form, path);
    }

    // Process properties
    if (node.properties && typeof node.properties === "object") {
      for (const [key, value] of Object.entries(node.properties)) {
        await this.enhanceSchemaNode(value, form, [...path, key]);
      }
    }

    // Process definitions
    if (node.definitions && typeof node.definitions === "object") {
      for (const [key, value] of Object.entries(node.definitions)) {
        await this.enhanceSchemaNode(value, form, ["definitions", key]);
      }
    }

    // Process $defs (JSON Schema draft-07+)
    if (node.$defs && typeof node.$defs === "object") {
      for (const [key, value] of Object.entries(node.$defs)) {
        await this.enhanceSchemaNode(value, form, ["$defs", key]);
      }
    }

    // Process items (for arrays)
    if (node.items) {
      if (Array.isArray(node.items)) {
        for (let i = 0; i < node.items.length; i++) {
          await this.enhanceSchemaNode(node.items[i], form, [...path, String(i)]);
        }
      } else {
        await this.enhanceSchemaNode(node.items, form, path);
      }
    }

    // Process allOf, anyOf, oneOf
    for (const combiner of ["allOf", "anyOf", "oneOf"]) {
      if (node[combiner] && Array.isArray(node[combiner])) {
        for (const subSchema of node[combiner]) {
          await this.enhanceSchemaNode(subSchema, form, path);
        }
      }
    }
  }

  /**
   * Enhance a single property node with form data
   */
  private async enhancePropertyNode(node: any, form: IFormDefinition, path: string[]): Promise<void> {
    // Try to find the field in the form
    const field = await this.formCache.getFieldAtPathAsync(form, path);

    if (!field) {
      return;
    }

    // Build enhanced description
    const enhancedParts: string[] = [];

    // Start with existing description if any
    if (node.description) {
      enhancedParts.push(node.description);
    } else if (field.description) {
      enhancedParts.push(field.description);
    }

    // Add sample values if available
    const samplesText = this.formatSamplesForSchema(field, form);
    if (samplesText) {
      enhancedParts.push("");
      enhancedParts.push(samplesText);
    }

    // Update description if we have enhancements
    if (enhancedParts.length > 0) {
      node.description = enhancedParts.join("\n");
    }

    // Also set markdownDescription for richer formatting
    if (enhancedParts.length > 0) {
      node.markdownDescription = enhancedParts.join("\n\n");
    }
  }

  /**
   * Format sample values for inclusion in schema description
   */
  private formatSamplesForSchema(field: IField, form: IFormDefinition): string | null {
    const samples: { source: string; content: any }[] = [];

    // Collect from field.samples
    if (field.samples && !field.hideSamples) {
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
    if (form.samples && !field.hideSamples) {
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

    // Format as text
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
      return str.length > 50 ? str.slice(0, 47) + "..." : str;
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
}

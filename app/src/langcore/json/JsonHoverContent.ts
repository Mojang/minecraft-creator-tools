// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * JsonHoverContent - Platform-agnostic hover content generation
 *
 * This module generates hover documentation content for Minecraft JSON files.
 * The content is returned as structured data that can be converted to
 * vscode.MarkdownString or monaco.IMarkdownString by the platform adapter.
 */

import IField, { FieldDataType } from "../../dataform/IField";
import IFormDefinition from "../../dataform/IFormDefinition";
import DataFormUtilities from "../../dataform/DataFormUtilities";
import { FormMetadataProvider } from "../shared/FormMetadataProvider";
import { IJsonPathResult } from "./JsonPathResolver";

/**
 * Hover content structure (platform-agnostic)
 */
export interface IHoverContent {
  /** Markdown content sections */
  sections: IHoverSection[];
}

/**
 * A section of hover content
 */
export interface IHoverSection {
  /** Markdown content */
  markdown: string;
  /** Whether this is code (should be formatted in a code block) */
  isCode?: boolean;
  /** Language for code blocks */
  language?: string;
}

/**
 * Generate hover content for a position in a Minecraft JSON file
 */
export class JsonHoverContentGenerator {
  /**
   * Generate hover content for a field
   */
  public generateFieldHover(field: IField, pathResult: IJsonPathResult, form?: IFormDefinition): IHoverContent {
    const sections: IHoverSection[] = [];

    // Title
    const title = field.title || field.id || pathResult.path[pathResult.path.length - 1];
    const titleSection = `### ${title}`;

    // Build main content
    const lines: string[] = [titleSection];

    // Description
    if (field.description) {
      lines.push("");
      lines.push(field.description);
    }

    // Type information
    let typeInfo = FormMetadataProvider.formatFieldType(field.dataType);
    if (typeInfo && typeInfo !== "Unknown") {
      // For object types, add property preview if available
      if (field.dataType === FieldDataType.object) {
        const propertyPreview = DataFormUtilities.getObjectPropertyPreview(field);
        if (propertyPreview) {
          typeInfo = `Object ${propertyPreview}`;
        }
      }
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

    sections.push({ markdown: lines.join("\n") });

    // Sample values
    if (!field.hideSamples) {
      const samplesMarkdown = this.formatSamples(field, form);
      if (samplesMarkdown) {
        sections.push({ markdown: samplesMarkdown });
      }
    }

    // Version info
    const versionLines: string[] = [];
    if (field.versionIntroduced) {
      versionLines.push(`*Introduced in version ${field.versionIntroduced}*`);
    }
    if (field.isDeprecated || field.versionDeprecated) {
      const deprecatedInfo = field.versionDeprecated
        ? `*⚠️ Deprecated since ${field.versionDeprecated}*`
        : "*⚠️ Deprecated*";
      versionLines.push(deprecatedInfo);
    }
    if (versionLines.length > 0) {
      sections.push({ markdown: versionLines.join("\n") });
    }

    // Path breadcrumb
    if (pathResult.path.length > 0) {
      sections.push({
        markdown: `**Path:** \`${pathResult.path.join(" > ")}\``,
      });
    }

    return { sections };
  }

  /**
   * Generate hover content for a minecraft: component
   */
  public generateComponentHover(componentName: string): IHoverContent {
    const sections: IHoverSection[] = [];

    // Component title
    sections.push({
      markdown: `### ${componentName}\n\nMinecraft component`,
    });

    // Add category-specific info
    if (componentName.includes(":behavior.")) {
      sections.push({
        markdown: "**Category:** AI Goal / Behavior",
      });
    } else if (componentName.includes(":navigation.")) {
      sections.push({
        markdown: "**Category:** Navigation",
      });
    } else if (componentName.includes(":movement.")) {
      sections.push({
        markdown: "**Category:** Movement",
      });
    } else if (componentName.includes(":rideable")) {
      sections.push({
        markdown: "**Category:** Interaction",
      });
    }

    return { sections };
  }

  /**
   * Generate hover content for format_version
   */
  public generateFormatVersionHover(version: string): IHoverContent {
    const sections: IHoverSection[] = [];

    sections.push({
      markdown: `### format_version\n\nSpecifies the format version of this file.\n\n**Current:** \`${version}\``,
    });

    // Version-specific notes
    const majorMinor = version.split(".").slice(0, 2).join(".");
    const versionNotes: { [key: string]: string } = {
      "1.21": "Latest stable version with full feature support",
      "1.20": "Stable version with entity components and events",
      "1.19": "Introduced many block and item components",
      "1.18": "Added new entity components",
      "1.17": "Script API improvements",
      "1.16": "Base format for most modern content",
    };

    if (versionNotes[majorMinor]) {
      sections.push({
        markdown: `*${versionNotes[majorMinor]}*`,
      });
    }

    return { sections };
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
   * Format sample values for display
   */
  private formatSamples(field: IField, form: IFormDefinition | undefined): string | null {
    const samples: Array<{ source: string; value: string }> = [];

    // Collect from field samples
    if (field.samples) {
      for (const [sourceKey, sourceSamples] of Object.entries(field.samples)) {
        for (const sample of sourceSamples) {
          samples.push({
            source: this.formatSourcePath(sourceKey),
            value: this.formatSampleContent(sample.content),
          });
        }
      }
    }

    // Collect from form samples
    if (form?.samples) {
      const formSamplesForField = form.samples[field.id];
      if (formSamplesForField) {
        for (const sample of formSamplesForField) {
          samples.push({
            source: sample.path || "Example",
            value: this.formatSampleContent(sample.content),
          });
        }
      }
    }

    if (samples.length === 0) {
      return null;
    }

    // Limit to 5 diverse samples
    const uniqueSamples = this.selectDiverseSamples(samples, 5);

    const lines: string[] = ["**Examples:**"];
    for (const sample of uniqueSamples) {
      lines.push(`- \`${sample.value}\` *(${sample.source})*`);
    }

    return lines.join("\n");
  }

  /**
   * Format a source path for display
   */
  private formatSourcePath(path: string): string {
    // Extract entity/block/item name from path
    const parts = path.split("/");
    const fileName = parts[parts.length - 1];
    return fileName.replace(/\.json$/, "").replace(/_/g, " ");
  }

  /**
   * Format a sample content for display
   */
  private formatSampleContent(content: object | string | number | boolean | undefined): string {
    if (content === undefined) {
      return "undefined";
    }

    if (typeof content === "object") {
      return JSON.stringify(content);
    }

    return String(content);
  }

  /**
   * Select diverse samples (different values)
   */
  private selectDiverseSamples(
    samples: Array<{ source: string; value: string }>,
    maxCount: number
  ): Array<{ source: string; value: string }> {
    const seen = new Set<string>();
    const result: Array<{ source: string; value: string }> = [];

    for (const sample of samples) {
      if (!seen.has(sample.value) && result.length < maxCount) {
        seen.add(sample.value);
        result.push(sample);
      }
    }

    return result;
  }
}

// Singleton instance
export const jsonHoverContentGenerator = new JsonHoverContentGenerator();

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE DOCUMENTATION: ValidationRulesMarkdownGenerator
 * ==============================================================
 *
 * This module generates detailed markdown documentation for MCTools validation rules.
 * Unlike the general FormMarkdownDocumentationGenerator, this is specifically designed
 * to explain validation rules in a user-friendly way that helps creators understand:
 *
 * 1. What each validation rule checks for
 * 2. Why the rule matters (the problem it catches)
 * 3. How to fix issues when the rule triggers
 * 4. Technical details for advanced users
 *
 * ## Input Structure
 *
 * Validation form files (mctoolsval/*.form.json) contain:
 * - Form-level: id, title, description, technicalDescription
 * - Field-level (each field = one validation rule):
 *   - id: The topic ID (numeric string like "100", "110")
 *   - title: Rule name (e.g., "Format Version Undefined")
 *   - description: What the rule checks
 *   - howToUse: How to fix the issue
 *   - technicalDescription: Technical details
 *   - messageType: error | warning | recommendation | info
 *   - matchedValues: Auto-fix actions available
 *   - note, note2, note3: Additional notes
 *
 * ## Output Structure
 *
 * For each validation category (form file), generates:
 * 1. Overview page with all rules listed
 * 2. Detailed sections for each rule with:
 *    - Rule ID and severity badge
 *    - Description of what's being checked
 *    - "How to Fix" section (from howToUse)
 *    - Technical details (from technicalDescription)
 *    - Auto-fix availability indicator
 *
 * ## Related Files
 *
 * - FormMarkdownDocumentationGenerator.ts: General form documentation (parent class)
 * - IFormDefinition.ts: Form structure interface
 * - IField.ts: Field structure including messageType, howToUse
 * - public/data/forms/mctoolsval/: Validation rule form definitions
 */

import Utilities from "../core/Utilities";
import IFormDefinition from "../dataform/IFormDefinition";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import IField from "../dataform/IField";

export const ValidationDocMarkdownTop = `---
author: mammerla
ms.author: mikeam
title: "{0}"
description: "{1}"
ai-usage: ai-assisted
ms.service: minecraft-bedrock-edition
ms.date: 02/11/2025 
---
`;

/**
 * Severity levels for validation rules, with associated styling/icons.
 */
interface ISeverityInfo {
  label: string;
  emoji: string;
  cssClass: string;
}

const SEVERITY_MAP: { [key: string]: ISeverityInfo } = {
  error: { label: "Error", emoji: "🔴", cssClass: "error" },
  warning: { label: "Warning", emoji: "🟡", cssClass: "warning" },
  recommendation: { label: "Recommendation", emoji: "🔵", cssClass: "recommendation" },
  info: { label: "Info", emoji: "ℹ️", cssClass: "info" },
};

/**
 * Generates detailed markdown documentation for MCTools validation rules.
 * This provides a more user-friendly format than the general form documentation,
 * with emphasis on explaining what each rule checks and how to fix issues.
 */
export default class ValidationRulesMarkdownGenerator {
  /**
   * Generate validation rule documentation from form JSON files.
   *
   * @param formJsonInputFolder Folder containing mctoolsval form JSON files
   * @param outputFolder Folder to write markdown documentation to
   */
  public async generateValidationDocs(formJsonInputFolder: IFolder, outputFolder: IFolder) {
    const formsByPath: { [name: string]: IFormDefinition } = {};

    await this.loadFormJsonFromFolder(formsByPath, formJsonInputFolder);

    // Generate individual rule category pages
    await this.exportValidationRuleDocs(formsByPath, outputFolder, "/MCToolsValReference/");

    // Generate overview/index page
    await this.exportValidationRulesIndex(formsByPath, outputFolder, "/MCToolsValReference/");
  }

  /**
   * Load all form JSON files from a folder into a dictionary.
   */
  private async loadFormJsonFromFolder(formsByPath: { [name: string]: IFormDefinition }, inputFolder: IFolder) {
    if (!inputFolder.isLoaded) {
      await inputFolder.load();
    }

    for (const folderName in inputFolder.folders) {
      const folder = inputFolder.folders[folderName];

      if (folder) {
        await this.loadFormJsonFromFolder(formsByPath, folder);
      }
    }

    for (const fileName in inputFolder.files) {
      const file = inputFolder.files[fileName];

      if (file && fileName.endsWith(".form.json")) {
        if (!file.isContentLoaded) {
          await file.loadContent();
        }

        const jsonO = StorageUtilities.getJsonObject(file);

        if (jsonO) {
          formsByPath[file.storageRelativePath] = jsonO;
        }

        // Unload file content after extracting JSON to save memory during bulk processing
        file.unload();
      }
    }
  }

  /**
   * Export individual validation rule category documentation pages.
   */
  private async exportValidationRuleDocs(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    subFolderPath: string
  ) {
    const targetFolder = await outputFolder.ensureFolderFromRelativePath(subFolderPath);

    if (!targetFolder) {
      return;
    }

    await targetFolder.ensureExists();

    // Filter to only mctoolsval forms
    const validationForms = this.getValidationForms(formsByPath);

    for (const formPath in validationForms) {
      const form = validationForms[formPath];

      if (form && form.fields && form.fields.length > 0) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        const fileName = baseName.toLowerCase().replace(/ /g, "-");
        const markdownFile = targetFolder.ensureFile(fileName + ".md");

        await this.saveValidationRuleDoc(markdownFile, form, baseName);
      }
    }
  }

  /**
   * Export the validation rules index/overview page.
   */
  private async exportValidationRulesIndex(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    subFolderPath: string
  ) {
    const targetFolder = await outputFolder.ensureFolderFromRelativePath(subFolderPath);

    if (!targetFolder) {
      return;
    }

    await targetFolder.ensureExists();

    const indexFile = targetFolder.ensureFile("ValidationRulesIndex.md");
    const content: string[] = [];

    content.push(
      Utilities.stringFormat(
        ValidationDocMarkdownTop,
        "MCTools Validation Rules Reference",
        "Complete reference for all validation rules in Minecraft Creator Tools"
      )
    );

    content.push("# MCTools Validation Rules Reference\n");
    content.push(
      "This reference documents all validation rules used by Minecraft Creator Tools to check your add-on content.\n"
    );
    content.push("Each rule helps identify potential issues in your Minecraft content before deployment.\n");

    content.push("## Validation Categories\n");
    content.push("| Category | Description | Rules |\n");
    content.push("|:---------|:------------|:------|\n");

    const validationForms = this.getValidationForms(formsByPath);
    const sortedPaths = Object.keys(validationForms).sort();

    for (const formPath of sortedPaths) {
      const form = validationForms[formPath];

      if (form) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));
        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        const title = form.title || Utilities.humanifyMinecraftName(baseName);
        const description = form.description ? this.truncateDescription(form.description, 80) : "";
        const ruleCount = form.fields ? form.fields.length : 0;
        const linkName = baseName.toLowerCase().replace(/ /g, "-");

        content.push(`| [${title}](${linkName}.md) | ${description} | ${ruleCount} |\n`);
      }
    }

    content.push("\n## Understanding Severity Levels\n");
    content.push("Validation rules have different severity levels:\n");
    content.push("- 🔴 **Error**: Must be fixed. These issues will cause problems in Minecraft.\n");
    content.push("- 🟡 **Warning**: Should be reviewed. These may cause issues or indicate problems.\n");
    content.push("- 🔵 **Recommendation**: Consider addressing. These are best practices.\n");
    content.push("- ℹ️ **Info**: Informational. Aggregated data or neutral status.\n");

    indexFile.setContent(content.join(""));
    await indexFile.saveContent();
  }

  /**
   * Save a single validation rule category documentation page.
   */
  private async saveValidationRuleDoc(markdownFile: IFile, form: IFormDefinition, baseName: string) {
    const content: string[] = [];

    const title = form.title || Utilities.humanifyMinecraftName(baseName);

    content.push(
      Utilities.stringFormat(
        ValidationDocMarkdownTop,
        `Validation Rules - ${title}`,
        `Documentation for ${title} validation rules in Minecraft Creator Tools`
      )
    );

    content.push(`# ${title} Validation Rules\n`);

    // Form-level description
    if (form.description) {
      content.push(`${this.sanitizeDescription(form.description)}\n`);
    }

    // Form-level technical description
    if (form.technicalDescription) {
      content.push("> [!TIP]\n");
      content.push(`> **Technical Details**: ${this.sanitizeDescription(form.technicalDescription)}\n`);
    }

    // Get ruleset name from baseName (uppercase)
    const rulesetName = baseName.toUpperCase();

    // Summary table of all rules
    content.push("## Rules Summary\n");
    content.push("| Rule ID | Rule | Severity | Auto-Fix |\n");
    content.push("|:--------|:-----|:---------|:---------|\n");

    if (form.fields) {
      // Sort fields by ID (numerically if possible)
      const sortedFields = [...form.fields].sort((a, b) => {
        const aNum = parseInt(a.id, 10);
        const bNum = parseInt(b.id, 10);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        return a.id.localeCompare(b.id);
      });

      for (const field of sortedFields) {
        const severity = this.getSeverityInfo(field.messageType);
        const hasAutoFix = this.hasAutoFix(field) ? "✅" : "";
        const ruleTitle = field.title || field.id;
        const ruleId = `${rulesetName}${field.id}`;
        const anchor = ruleId.toLowerCase();

        content.push(
          `| [${ruleId}](#${anchor}) | ${ruleTitle} | ${severity.emoji} ${severity.label} | ${hasAutoFix} |\n`
        );
      }

      // Detailed documentation for each rule
      content.push("\n---\n");
      content.push("## Rule Details\n");

      for (const field of sortedFields) {
        await this.appendValidationRuleDetail(field, content, rulesetName);
      }
    }

    markdownFile.setContent(content.join(""));
    await markdownFile.saveContent();
  }

  /**
   * Append detailed documentation for a single validation rule.
   * @param field The field/rule to document
   * @param content The content array to append to
   * @param rulesetName The uppercase ruleset name (e.g., "SHARING", "JSONF")
   */
  private async appendValidationRuleDetail(field: IField, content: string[], rulesetName: string) {
    const severity = this.getSeverityInfo(field.messageType);
    const ruleTitle = field.title || field.id;

    // Use format: ### RULESETNAME<id>
    content.push(`\n### ${rulesetName}${field.id}\n`);
    content.push(`**${severity.emoji} ${ruleTitle}**  \n`);
    content.push(`**Severity**: ${severity.label}\n`);

    // Description - what does this rule check?
    if (field.description) {
      content.push(`\n#### What This Checks\n`);
      content.push(`${this.sanitizeDescription(field.description)}\n`);
    }

    // How to fix - this is the key user-focused content
    if (field.howToUse) {
      content.push(`\n#### How to Fix\n`);
      content.push(`${this.sanitizeDescription(field.howToUse)}\n`);
    }

    // Auto-fix availability
    const autoFixActions = this.getAutoFixActions(field);
    if (autoFixActions.length > 0) {
      content.push(`\n> [!TIP]\n`);
      content.push(`> **Auto-Fix Available**: This issue can be automatically fixed.\n`);

      for (const action of autoFixActions) {
        content.push(`> - ${action}\n`);
      }
    }

    // Technical description for advanced users
    if (field.technicalDescription) {
      content.push(`\n#### Technical Details\n`);
      content.push(`${this.sanitizeDescription(field.technicalDescription)}\n`);
    }

    // Additional notes
    if (field.note) {
      content.push(`\n> [!NOTE]\n`);
      content.push(`> ${this.sanitizeDescription(field.note)}\n`);
    }

    if (field.note2) {
      content.push(`\n> [!NOTE]\n`);
      content.push(`> ${this.sanitizeDescription(field.note2)}\n`);
    }

    if (field.note3) {
      content.push(`\n> [!NOTE]\n`);
      content.push(`> ${this.sanitizeDescription(field.note3)}\n`);
    }
  }

  /**
   * Filter forms to only include validation rule forms.
   */
  private getValidationForms(formsByPath: { [name: string]: IFormDefinition }): { [name: string]: IFormDefinition } {
    const validationForms: { [name: string]: IFormDefinition } = {};

    for (const formPath in formsByPath) {
      // Check if this is a mctoolsval form
      if (
        formPath.toLowerCase().includes("/mctoolsval/") &&
        !formPath.includes("index") &&
        !formPath.includes("overview")
      ) {
        validationForms[formPath] = formsByPath[formPath];
      }
    }

    return validationForms;
  }

  /**
   * Get severity information from messageType.
   */
  private getSeverityInfo(messageType: string | number | undefined): ISeverityInfo {
    if (messageType === undefined) {
      return SEVERITY_MAP["info"];
    }

    // Handle numeric messageType (0 = info, 1 = warning, 2 = error, 3 = recommendation)
    if (typeof messageType === "number") {
      switch (messageType) {
        case 0:
          return SEVERITY_MAP["info"];
        case 1:
          return SEVERITY_MAP["warning"];
        case 2:
          return SEVERITY_MAP["error"];
        case 3:
          return SEVERITY_MAP["recommendation"];
        default:
          return SEVERITY_MAP["info"];
      }
    }

    // Handle string messageType
    const key = messageType.toLowerCase();
    return SEVERITY_MAP[key] || SEVERITY_MAP["info"];
  }

  /**
   * Check if a field has auto-fix capabilities.
   * Handles both object-style matchedValues { [key: string]: string } and
   * array-style matchedValues from JSON forms [{ updaterId, updaterIndex, action }].
   */
  private hasAutoFix(field: IField): boolean {
    if (!field.matchedValues) {
      return false;
    }

    // Check if it's an object with any keys
    if (typeof field.matchedValues === "object") {
      return Object.keys(field.matchedValues).length > 0;
    }

    return false;
  }

  /**
   * Get auto-fix action descriptions from a field.
   * Handles both object-style and array-style matchedValues.
   */
  private getAutoFixActions(field: IField): string[] {
    const actions: string[] = [];

    if (!field.matchedValues) {
      return actions;
    }

    // The matchedValues could be { [key: string]: string } or parsed from JSON as an array
    // When loaded from JSON, it might be an array of objects with 'action' property
    const matchedValues = field.matchedValues as unknown;

    if (Array.isArray(matchedValues)) {
      // Array style: [{ updaterId, updaterIndex, action }]
      for (const item of matchedValues) {
        if (item && typeof item === "object" && "action" in item) {
          const actionItem = item as { action?: string };
          if (actionItem.action) {
            actions.push(actionItem.action);
          }
        }
      }
    } else if (typeof matchedValues === "object" && matchedValues !== null) {
      // Object style: { [key: string]: string }
      for (const key in matchedValues as { [key: string]: string }) {
        const value = (matchedValues as { [key: string]: string })[key];
        if (value) {
          actions.push(value);
        }
      }
    }

    return actions;
  }

  /**
   * Create a markdown anchor from rule ID and title.
   */
  private getAnchor(id: string, title: string): string {
    // Use a combination of emoji representation and title for unique anchor
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
  }

  /**
   * Sanitize description text for markdown.
   */
  private sanitizeDescription(description: string): string {
    description = description.trim();

    if (description.length > 10 && !description.endsWith(".") && !description.endsWith(":")) {
      description += ".";
    }

    return description;
  }

  /**
   * Truncate a description to a maximum length.
   */
  private truncateDescription(description: string, maxLength: number): string {
    description = description.trim();

    if (description.length <= maxLength) {
      return description;
    }

    // Find a good break point
    const truncated = description.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + "...";
    }

    return truncated + "...";
  }
}

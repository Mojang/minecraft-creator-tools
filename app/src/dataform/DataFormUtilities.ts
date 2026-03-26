// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ========================================================================
 * ARCHITECTURE: DataFormUtilities
 * ========================================================================
 *
 * DataFormUtilities provides static utility functions for the DataForm
 * system, including field selection, type checking, and form manipulation.
 *
 * This file is a key part of the "upscale/downscale" UI layer pattern.
 * See FormPropertyManager.ts for the complete architecture documentation.
 *
 * KEY FUNCTION: selectFieldForValue()
 *
 *   This function implements the UI-layer part of the upscale pattern.
 *   When a field has multiple "alternates" (different type representations),
 *   this function selects the variant that best matches the actual data.
 *
 *   Example: A repair_items field might have:
 *     - Primary: stringArray (for simple item list)
 *     - Alternate: objectArray with subForm (for complex items with amounts)
 *
 *   If the data is an array of objects, selectFieldForValue returns the
 *   objectArray alternate so the UI renders the appropriate editor.
 *
 * RELATED FILES:
 *    - src/dataform/FormPropertyManager.ts - Data-layer upscale/downscale
 *    - src/dataformux/DataForm.tsx - Uses selectFieldForValue() in render
 *    - src/dataform/IField.ts - Field definitions with alternates
 *
 * ========================================================================
 */

import Utilities from "../core/Utilities";
import Database from "../minecraft/Database";
import CreatorToolsHost from "../app/CreatorToolsHost";
import IField, { FieldDataType } from "./IField";
import IFormDefinition, { IFormSample } from "./IFormDefinition";
import ISummarizer, { ISummarizerOptions, ISummarizerResult } from "./ISummarizer";
import SummarizerEvaluator from "./SummarizerEvaluator";

export default class DataFormUtilities {
  public static generateDefaultItem(formDefinition: IFormDefinition) {
    const newDataObject: any = {};

    for (let i = 0; i < formDefinition.fields.length; i++) {
      const field = formDefinition.fields[i];

      if (field.defaultValue !== undefined) {
        if (
          typeof field.defaultValue === "string" &&
          DataFormUtilities.isObjectFieldType(field.dataType) &&
          Utilities.isUsableAsObjectKey(field.id)
        ) {
          // sometimes our docs say the default value for an object is "N/A", which is not awesome
          newDataObject[field.id] = {};
        } else {
          newDataObject[field.id] = field.defaultValue;
        }
      }
    }

    return newDataObject;
  }

  public static selectSubForm(form: IFormDefinition, select: string) {
    const selectors = select.split("/");

    for (const selector of selectors) {
      if (selector.length > 0) {
        const field = DataFormUtilities.getFieldById(form, selector);

        if (!field || !field.subForm) {
          throw new Error("Unable to find field " + selector + " in form " + form.id);
        }

        form = field.subForm;
      }
    }

    return form;
  }

  public static mergeFields(form: IFormDefinition) {
    let fields: IField[] = [];
    const fieldsByName: { [name: string]: IField } = {};

    for (const field of form.fields) {
      if (fieldsByName[field.id]) {
        const origField = fieldsByName[field.id];

        if (!origField.alternates) {
          origField.alternates = [];
        }

        origField.alternates.push(field);

        if (field.alternates) {
          for (const subField of field.alternates) {
            origField.alternates.push(subField);
          }

          field.alternates = undefined;
        }
      } else {
        fields.push(field);
        if (Utilities.isUsableAsObjectKey(field.id)) {
          fieldsByName[field.id] = field;
        }
      }
    }

    form.fields = fields;

    for (const field of fields) {
      if (field.subForm) {
        DataFormUtilities.mergeFields(field.subForm);
      }

      if (field.alternates) {
        for (let addField of field.alternates) {
          if (addField.subForm) {
            DataFormUtilities.mergeFields(addField.subForm);
          }
        }
      }
    }

    DataFormUtilities.sortAndCleanAlternateFields(form);
  }

  /**
   * Selects the most appropriate field definition (primary or alternate) based on the actual value type.
   *
   * This is the UI-layer component of the "upscale/downscale" pattern. It ensures that
   * when rendering a form, the correct editor is used for the actual data type.
   *
   * BACKGROUND:
   *   Minecraft JSON often supports multiple representations of the same field:
   *   - A scalar: "hello"
   *   - An array: ["a", "b"]
   *   - An object: { items: ["a"], amount: 5 }
   *
   *   Field definitions can have "alternates" - additional field definitions that
   *   represent the same logical field but with different dataTypes and potentially
   *   different subForms.
   *
   * HOW IT WORKS:
   *   1. Collects all field variants (primary + alternates)
   *   2. Scores each variant based on how well its dataType matches the value
   *   3. Returns the highest-scoring variant
   *
   * SCORING RULES:
   *   - Array values prefer stringArray, numberArray, objectArray types
   *   - Object values prefer object types, especially with subForms
   *   - Scalar values prefer matching primitive types (string, int, boolean)
   *
   * USAGE IN DataForm.tsx:
   *   const effectiveField = DataFormUtilities.selectFieldForValue(field, curVal);
   *   // effectiveField is now the variant that best represents curVal
   *   // Use effectiveField.dataType, effectiveField.subForm, etc.
   *
   * RELATED:
   *   - FormPropertyManager.upscaleDirectObject() - Data-layer scalar→object
   *   - FormPropertyManager.downscaleDirectObject() - Data-layer object→scalar
   *
   * @param field - The primary field definition (may have alternates)
   * @param value - The actual value to match against
   * @returns The best-matching field definition (primary or an alternate)
   */
  public static selectFieldForValue(field: IField, value: any): IField {
    if (value === undefined || value === null) {
      return field;
    }

    // Collect all field variants (primary + alternates)
    const allFields = [field];
    if (field.alternates) {
      allFields.push(...field.alternates);
    }

    // If only one field, return it
    if (allFields.length === 1) {
      return field;
    }

    const valueType = typeof value;
    const isArray = Array.isArray(value);
    const isObject = valueType === "object" && !isArray;

    // Score each field based on how well it matches the value type
    let bestField = field;
    let bestScore = -1;

    for (const candidate of allFields) {
      let score = 0;
      const dt = candidate.dataType;

      if (isArray) {
        // Value is an array - prefer array types
        if (
          dt === FieldDataType.stringArray ||
          dt === FieldDataType.numberArray ||
          dt === FieldDataType.objectArray ||
          dt === FieldDataType.longFormStringArray
        ) {
          score = 10;
        }
      } else if (isObject) {
        // Value is an object - prefer object types (especially those with subForms)
        if (DataFormUtilities.isObjectFieldType(dt)) {
          score = 10;
          if (candidate.subForm || candidate.subFormId) {
            score = 15; // Prefer objects with subForms
          }
        } else if (dt === FieldDataType.keyedObjectCollection || dt === FieldDataType.keyedStringCollection) {
          score = 8;
        }
      } else if (valueType === "string") {
        // Value is a string - prefer string types
        // Note: isString includes stringEnum, so it gets score 10
        if (DataFormUtilities.isString(dt)) {
          score = 10;
        }
      } else if (valueType === "number") {
        // Value is a number - prefer numeric types
        if (
          dt === FieldDataType.int ||
          dt === FieldDataType.float ||
          dt === FieldDataType.number ||
          dt === FieldDataType.long
        ) {
          score = 10;
        } else if (dt === FieldDataType.intEnum) {
          score = 9;
        }
      } else if (valueType === "boolean") {
        // Value is a boolean - prefer boolean types
        if (dt === FieldDataType.boolean || dt === FieldDataType.intBoolean) {
          score = 10;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestField = candidate;
      }
    }

    return bestField;
  }

  public static isObjectFieldType(fieldDataType: FieldDataType) {
    return (
      fieldDataType === FieldDataType.object ||
      fieldDataType === FieldDataType.minecraftFilter ||
      fieldDataType === FieldDataType.minecraftEventTrigger
    );
  }

  public static isScalarFieldType(fieldDataType: FieldDataType) {
    return (
      fieldDataType === FieldDataType.boolean ||
      fieldDataType === FieldDataType.float ||
      fieldDataType === FieldDataType.int ||
      fieldDataType === FieldDataType.intBoolean ||
      fieldDataType === FieldDataType.intEnum ||
      fieldDataType === FieldDataType.string ||
      fieldDataType === FieldDataType.molang
    );
  }

  public static sortFieldsBySignificance(fieldA: IField, fieldB: IField): number {
    if (fieldA.subForm && !fieldB.subForm) {
      return -1;
    }

    if (!fieldA.subForm && fieldB.subForm) {
      return 1;
    }

    const isAComplex = !DataFormUtilities.isScalarFieldType(fieldA.dataType);
    const isBComplex = !DataFormUtilities.isScalarFieldType(fieldB.dataType);

    if (isAComplex && !isBComplex) {
      return -1;
    }

    if (!isAComplex && isBComplex) {
      return 1;
    }

    if (fieldA.dataType < fieldB.dataType) {
      return -1;
    }
    if (fieldA.dataType > fieldB.dataType) {
      return 1;
    }
    return 0;
  }

  public static sortFieldsByPriority(fieldA: IField, fieldB: IField): number {
    if (fieldA.isDeprecated && !fieldB.isDeprecated) {
      return 1;
    }

    if (!fieldA.isDeprecated && fieldB.isDeprecated) {
      return -1;
    }

    if (fieldA.priority && !fieldB.priority) {
      return -1;
    }

    if (fieldB.priority && !fieldA.priority) {
      return 1;
    }

    if (fieldA.priority && fieldB.priority) {
      return fieldA.priority - fieldB.priority;
    }

    if (fieldA.title && fieldB.title) {
      return fieldA.title.localeCompare(fieldB.title);
    }

    if (fieldA.id && fieldB.id) {
      return Utilities.staticCompare(fieldA.id, fieldB.id);
    }

    return 0;
  }

  public static async loadSubForms(
    form: IFormDefinition,
    loadedForms?: string | undefined
  ): Promise<string | undefined> {
    if (!loadedForms) {
      loadedForms = "";
    }

    if (form && form.fields) {
      for (const field of form.fields) {
        let subForm: IFormDefinition | undefined = undefined;

        if (field.subForm) {
          subForm = field.subForm;
        } else if (field.subFormId) {
          if (loadedForms.indexOf("|" + field.subFormId + "|") < 0) {
            subForm = await Database.ensureFormLoadedByPath(field.subFormId);

            loadedForms += "|" + field.subFormId + "|";
          }
        }

        if (subForm) {
          await this.loadSubForms(subForm, loadedForms);
        }
      }
    }

    if (loadedForms === "") {
      return undefined;
    }

    return loadedForms;
  }

  public static sortAndCleanAlternateFields(form: IFormDefinition) {
    let fields: IField[] = [];

    for (const field of form.fields) {
      if (field.alternates) {
        const allFields: IField[] = [];
        allFields.push(field);
        allFields.push(...field.alternates);
        field.alternates = undefined;

        allFields.sort(DataFormUtilities.sortFieldsBySignificance);

        allFields[0].alternates = [];

        fields.push(allFields[0]);

        for (let i = 1; i < allFields.length; i++) {
          if (allFields[i].title === allFields[0].title) {
            allFields[i].title = undefined;
          }
          allFields[0].alternates.push(allFields[i]);
        }
      } else {
        fields.push(field);
      }
    }

    form.fields = fields;

    for (const field of fields) {
      if (field.subForm) {
        DataFormUtilities.sortAndCleanAlternateFields(field.subForm);
      }

      if (field.alternates) {
        for (let addField of field.alternates) {
          if (addField.subForm) {
            DataFormUtilities.sortAndCleanAlternateFields(addField.subForm);
          }
        }
      }
    }
  }

  public static fixupFields(form: IFormDefinition, parentField?: IField) {
    let fields: IField[] = [];

    for (const field of form.fields) {
      if (
        (field.dataType === FieldDataType.stringArray || field.dataType === FieldDataType.numberArray) &&
        field.subForm &&
        field.subForm.fields &&
        field.subForm.fields.length >= 1
      ) {
        const subField = field.subForm.fields[0];

        if (subField.id.indexOf("<") >= 0) {
          if (subField.dataType === FieldDataType.molang) {
            field.dataType = FieldDataType.molangArray;
          }

          field.subForm = undefined;
        }

        fields.push(field);
      } else if (field.id.startsWith("<") && parentField) {
        if (!parentField.alternates) {
          parentField.alternates = [];
        }
        field.keyDescription = field.id;
        field.id = parentField.id;

        if (field.dataType === FieldDataType.molangArray || field.dataType === FieldDataType.stringArray) {
          field.dataType = FieldDataType.keyedStringCollection;
        }

        parentField.alternates.push(field);
      } else {
        fields.push(field);
      }
    }

    form.fields = fields;

    for (const field of fields) {
      if (field.subForm) {
        DataFormUtilities.fixupFields(field.subForm, field);
      }

      if (field.alternates) {
        for (let addField of field.alternates) {
          if (addField.subForm) {
            DataFormUtilities.fixupFields(addField.subForm, field);
          }
        }
      }
    }
  }

  static generateFormFromObject(id: string, obj: object, exampleSourcePath?: string) {
    let fields: IField[] = [];

    for (const fieldName in obj) {
      const fieldData = (obj as any)[fieldName];

      let fieldType = FieldDataType.string;

      if (typeof fieldData === "number") {
        fieldType = FieldDataType.number;
      }

      const samples: { [name: string]: IFormSample[] } = {};

      samples[exampleSourcePath ? exampleSourcePath : "generated_doNotEdit"] = [
        {
          path: fieldName,
          content: fieldData,
        },
      ];

      fields.push({
        id: fieldName,
        title: Utilities.humanifyJsName(fieldName),
        dataType: fieldType,
        samples: samples,
      });
    }

    return {
      id: id,
      title: Utilities.humanifyJsName(id),
      fields: fields,
    };
  }

  static getFieldAndAlternates(fieldDefinition: IField) {
    const fields = [fieldDefinition];

    if (fieldDefinition.alternates) {
      for (const altField of fieldDefinition.alternates) {
        fields.push(...DataFormUtilities.getFieldAndAlternates(altField));
      }
    }

    return fields;
  }

  static getScalarField(formDefinition: IFormDefinition) {
    if (formDefinition.scalarField) {
      return formDefinition.scalarField;
    }

    if (formDefinition.scalarFieldUpgradeName && formDefinition.fields) {
      for (const field of formDefinition.fields) {
        if (field.id === formDefinition.scalarFieldUpgradeName) {
          return field;
        }
      }
    }

    return undefined;
  }

  static isString(fieldType: FieldDataType) {
    return (
      fieldType === FieldDataType.string ||
      fieldType === FieldDataType.molang ||
      fieldType === FieldDataType.longFormString ||
      fieldType === FieldDataType.stringLookup ||
      fieldType === FieldDataType.stringEnum ||
      fieldType === FieldDataType.localizableString
    );
  }

  static getFieldById(formDefinition: IFormDefinition, fieldId: string) {
    if (!formDefinition.fields) {
      return undefined;
    }

    for (const field of formDefinition.fields) {
      if (field.id === fieldId) {
        return field;
      }
    }

    return undefined;
  }

  static getFieldTypeDescription(fieldType: FieldDataType) {
    switch (fieldType) {
      case FieldDataType.int:
        return "Integer number";
      case FieldDataType.boolean:
        return "Boolean true/false";
      case FieldDataType.float:
        return "Decimal number";
      case FieldDataType.stringEnum:
        return "String from a list of choices";
      case FieldDataType.intEnum:
        return "Integer number from a list of choices";
      case FieldDataType.intBoolean:
        return "Boolean 0/1";
      case FieldDataType.number:
        return "Decimal number";
      case FieldDataType.long:
        return "Large number";
      case FieldDataType.stringLookup:
        return "String from a list of choices";
      case FieldDataType.intValueLookup:
        return "Integer number from a list of choices";
      case FieldDataType.point3:
        return "x, y, z coordinate array";
      case FieldDataType.intPoint3:
        return "integer x, y, z coordinate array";
      case FieldDataType.longFormString:
        return "Longer descriptive text";
      case FieldDataType.keyedObjectCollection:
        return "Named set of objects";
      case FieldDataType.objectArray:
        return "Array of objects";
      case FieldDataType.object:
        return "Object";
      case FieldDataType.stringArray:
        return "Array of strings";
      case FieldDataType.intRange:
        return "Range of integers";
      case FieldDataType.floatRange:
        return "Range of floats";
      case FieldDataType.minecraftFilter:
        return "Minecraft filter";
      case FieldDataType.minecraftEventTriggerArray:
        return "Array of Minecraft Event Triggers";
      case FieldDataType.percentRange:
        return "Percent Range";
      case FieldDataType.minecraftEventTrigger:
        return "Minecraft Event Trigger";
      case FieldDataType.minecraftEventReference:
        return "Minecraft Event Reference";
      case FieldDataType.longFormStringArray:
        return "Array of longer descriptive text";
      case FieldDataType.keyedStringCollection:
        return "Keyed set of strings";
      case FieldDataType.version:
        return "Version";
      case FieldDataType.uuid:
        return "Unique Id";
      case FieldDataType.keyedBooleanCollection:
        return "Keyed collection of boolean values";
      case FieldDataType.keyedStringArrayCollection:
        return "Keyed collection of string arrays";
      case FieldDataType.arrayOfKeyedStringCollection:
        return "Array of keyed string sets";
      case FieldDataType.keyedKeyedStringArrayCollection:
        return "Keyed set of keyed string sets";
      case FieldDataType.keyedNumberCollection:
        return "Keyed set of numbers";
      case FieldDataType.numberArray:
        return "Array of numbers";
      case FieldDataType.point2:
        return "a, b coordinate array";
      case FieldDataType.localizableString:
        return "Localizable String";
      case FieldDataType.string:
        return "String";
      case FieldDataType.molang:
        return "Molang";
      case FieldDataType.molangArray:
        return "Molang array";
      default:
        return "String";
    }
  }

  /**
   * Generate a natural language summary of an object based on its form definition.
   *
   * This method loads the summarizer associated with the form (if one exists)
   * and evaluates it against the provided data to produce human-readable phrases.
   *
   * @param data The data object to summarize
   * @param formPath Path to the form definition (e.g., "entity/minecraft_health")
   * @param options Optional evaluation options
   * @returns Result containing phrases and formatted output
   *
   * @example
   * const result = await DataFormUtilities.generateSummary(
   *   { max: 500, value: 500 },
   *   "entity/minecraft_health"
   * );
   * console.log(result.asCompleteSentence);
   * // "This entity has god-tier health (500 HP)."
   */
  static async generateSummary(
    data: object,
    formPath: string,
    options?: ISummarizerOptions
  ): Promise<ISummarizerResult> {
    // Load the form definition
    const form = await Database.ensureFormLoadedByPath(formPath);

    // Extract category from the path (e.g., "entity" from "entity/minecraft_health.form.json")
    let category: string | undefined;
    const lastSlash = formPath.lastIndexOf("/");
    if (lastSlash > 0) {
      category = formPath.substring(0, lastSlash);
    }

    // Derive the summarizer ID from the form path (same name, different extension)
    const summarizerName = formPath.substring(lastSlash + 1).replace(".form.json", "");

    // Try to load the summarizer
    const summarizer = await DataFormUtilities.loadSummarizerById(summarizerName, category);

    if (!summarizer) {
      // No summarizer defined, return empty result
      return {
        phrases: [],
        asSentence: "",
        asCompleteSentence: "",
      };
    }

    const evaluator = new SummarizerEvaluator();
    return evaluator.evaluate(summarizer, data, form, options);
  }

  /**
   * Generate a summary and format it as a complete sentence.
   *
   * @param data The data object to summarize
   * @param formPath Path to the form definition
   * @param prefix Optional prefix for the sentence (default: "This entity ")
   * @returns A complete sentence describing the object, or empty string if no summarizer
   *
   * @example
   * const sentence = await DataFormUtilities.generateSummaryAsSentence(
   *   { max: 100 },
   *   "entity/minecraft_health",
   *   "This mob "
   * );
   * // "This mob has extremely high health, on par with an Iron Golem (100 HP)."
   */
  static async generateSummaryAsSentence(
    data: object,
    formPath: string,
    prefix: string = "This entity "
  ): Promise<string> {
    const result = await DataFormUtilities.generateSummary(data, formPath);

    if (result.phrases.length === 0) {
      return "";
    }

    return `${prefix}${result.asSentence}.`;
  }

  /**
   * Load a summarizer definition by ID.
   *
   * The ID format matches subFormId: "category/name" or just "name".
   * Does NOT include the .summarizer.json suffix.
   *
   * @param summarizerId ID of the summarizer (e.g., "entity/minecraft_health" or "minecraft_health")
   * @param category Optional category subfolder (e.g., "entity", "block") - used if ID doesn't include category
   * @returns The summarizer definition, or undefined if not found
   *
   * @example
   * // These are equivalent:
   * loadSummarizerById("entity/minecraft_health")
   * loadSummarizerById("minecraft_health", "entity")
   */
  static async loadSummarizerById(summarizerId: string, category?: string): Promise<ISummarizer | undefined> {
    try {
      // Parse the ID to extract category and name
      const lastSlash = summarizerId.lastIndexOf("/");
      let resolvedCategory: string | undefined;
      let name: string;

      if (lastSlash >= 0) {
        // ID includes category: "entity/minecraft_health"
        resolvedCategory = summarizerId.substring(0, lastSlash);
        name = summarizerId.substring(lastSlash + 1);
      } else {
        // ID is just name: "minecraft_health"
        resolvedCategory = category;
        name = summarizerId;
      }

      // Build the full path - use contentWebRoot for Electron compatibility
      let relativePath = "data/forms/";
      if (resolvedCategory) {
        relativePath += resolvedCategory + "/";
      }
      relativePath += name + ".summarizer.json";

      const fullPath = CreatorToolsHost.contentWebRoot + relativePath;

      // Load the summarizer JSON
      const response = await fetch(fullPath);
      if (!response.ok) {
        return undefined;
      }

      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !Array.isArray((data as ISummarizer).phrases)) {
        return undefined;
      }

      return data as ISummarizer;
    } catch (e) {
      // Summarizer not found or invalid
      return undefined;
    }
  }

  /**
   * Evaluate a summarizer directly against data.
   *
   * Use this when you already have the summarizer loaded and want to
   * avoid the overhead of loading it from disk.
   *
   * @param summarizer The summarizer definition
   * @param data The data object to summarize
   * @param form Optional form definition for sample lookup
   * @param options Optional evaluation options
   * @returns Result containing phrases and formatted output
   */
  static evaluateSummarizer(
    summarizer: ISummarizer,
    data: object,
    form?: IFormDefinition,
    options?: ISummarizerOptions
  ): ISummarizerResult {
    const evaluator = new SummarizerEvaluator();
    return evaluator.evaluate(summarizer, data, form, options);
  }

  // ========================================================================
  // FIELD PROPERTY UTILITIES
  // These are shared utilities for inspecting field structures, used by
  // JSON schema generators, hover providers, and other field-analysis code.
  // ========================================================================

  /**
   * Get a preview of property names for an object field.
   * Returns a string like "{ description, components, events, ... }" for objects with many properties,
   * or "{ prop1, prop2 }" for objects with few properties.
   *
   * This is useful for displaying concise type information in hovers and tooltips.
   *
   * @param field The field to inspect
   * @returns A formatted string preview of property names, or null if not applicable
   */
  static getObjectPropertyPreview(field: IField): string | null {
    let fieldNames: string[] = [];

    // Helper to clean field IDs - removes embedded enum syntax like `render_distance_type"<"fixed", "render"`
    const cleanFieldId = (id: string): string => {
      const lessThanIndex = id.indexOf('"<"');
      if (lessThanIndex > 0) {
        return id.substring(0, lessThanIndex);
      }
      return id;
    };

    // Check subFields (direct field definitions)
    if (field.subFields) {
      fieldNames = Object.keys(field.subFields)
        .filter((k) => !k.startsWith("_"))
        .map(cleanFieldId);
    }
    // Check subForm (embedded form definition)
    else if (field.subForm?.fields) {
      fieldNames = field.subForm.fields.filter((f) => f.id && !f.id.startsWith("_")).map((f) => cleanFieldId(f.id!));
    }

    if (fieldNames.length === 0) {
      return null;
    }

    // Show up to 3 property names with ellipsis if more
    const maxToShow = 3;
    if (fieldNames.length <= maxToShow) {
      return `{ ${fieldNames.join(", ")} }`;
    }
    const shown = fieldNames.slice(0, maxToShow).join(", ");
    return `{ ${shown}, ... }`;
  }

  /**
   * Get the child properties of a field (what this field contains).
   * Returns the field's own subForm/subFields, or the referenced subFormId's fields.
   * Returns null if the field doesn't have child properties.
   *
   * This supports multiple resolution strategies:
   * 1. subFormId reference - looks up in the provided forms dictionary
   * 2. Inline subForm - embedded form definition
   * 3. subFields - dictionary-style field definitions
   *
   * @param field The field to inspect
   * @param formsBySubFormId Optional dictionary of forms keyed by subFormId for resolving references
   * @returns Array of child fields, or null if none found
   */
  static getFieldChildProperties(field: IField, formsBySubFormId?: Record<string, IFormDefinition>): IField[] | null {
    // First check if field references a subFormId
    if (field.subFormId && formsBySubFormId && formsBySubFormId[field.subFormId]) {
      const referencedForm = formsBySubFormId[field.subFormId];
      if (referencedForm.fields && referencedForm.fields.length > 0) {
        return referencedForm.fields;
      }
    }

    // Check inline subForm
    if (field.subForm?.fields && field.subForm.fields.length > 0) {
      return field.subForm.fields;
    }

    // Check subFields (dictionary style)
    if (field.subFields) {
      const subFieldsArray: IField[] = [];
      for (const [key, subField] of Object.entries(field.subFields)) {
        if (!key.startsWith("_")) {
          subFieldsArray.push({ ...subField, id: key } as IField);
        }
      }
      if (subFieldsArray.length > 0) {
        return subFieldsArray;
      }
    }

    return null;
  }
}

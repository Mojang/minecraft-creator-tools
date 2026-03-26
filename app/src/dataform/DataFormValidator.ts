import Utilities from "../core/Utilities";
import DataFormUtilities from "./DataFormUtilities";
import FieldUtilities from "./FieldUtilities";
import { ComparisonType } from "./ICondition";
import IField, { FieldDataType } from "./IField";
import IFormDefinition from "./IFormDefinition";

/**
 * Cleans a field ID by removing the embedded enum syntax that appears in some form files.
 * For example: 'render_distance_type"<"fixed", "render"' becomes 'render_distance_type'
 * This syntax is used in forms to specify enum choices but should not appear in property names.
 */
function cleanFieldId(fieldId: string): string {
  const quoteIndex = fieldId.indexOf('"<"');
  if (quoteIndex !== -1) {
    return fieldId.substring(0, quoteIndex);
  }
  return fieldId;
}

/**
 * Maximum recursion depth for validation to prevent exponential time complexity
 * when validating deeply nested structures. Beyond this depth, validation will
 * skip recursive subForm validation.
 */
const MAX_VALIDATION_DEPTH = 10;

/**
 * Cache for subForm lookups during a single validation call chain.
 * This prevents repeated async lookups for the same subFormId during recursive validation.
 * Exported so it can be shared across items with the same formPath for performance.
 */
export interface IValidationContext {
  depth: number;
  subFormCache: Map<string, IFormDefinition | null>;
}

export enum DataFormIssueType {
  unexpectedStringUsedWhenObjectExpected = 101,
  unexpectedBooleanUsedWhenObjectExpected = 102,
  unexpectedNumberUsedWhenObjectExpected = 103,
  dataTypeMismatch = 110,
  valueBelowMinimum = 111,
  valueAboveMaximum = 112,
  stringTooShort = 113,
  stringTooLong = 114,
  valueNotInChoices = 115,
  patternMismatch = 116,
  arrayLengthMismatch = 117,
  pointSizeMismatch = 118,
  keyNotAllowed = 119,
  unexpectedProperty = 120,
  missingRequiredField = 121,
}

export interface IDataFormValidationIssue {
  message: string;
  type: DataFormIssueType;
}

export default class DataFormValidator {
  static async validate(
    data: object | string | number | boolean,
    form: IFormDefinition,
    issues?: IDataFormValidationIssue[],
    path?: string,
    context?: IValidationContext
  ): Promise<IDataFormValidationIssue[]> {
    // Initialize context on first call (top-level validation)
    if (!context) {
      context = {
        depth: 0,
        subFormCache: new Map<string, IFormDefinition | null>(),
      };
    }

    // Check recursion depth limit - skip deep validation to prevent exponential complexity
    if (context.depth >= MAX_VALIDATION_DEPTH) {
      return issues || [];
    }

    if (path === undefined) {
      path = "";
    } else {
      path = path + ".";
    }

    if (!issues) {
      issues = [];
    }

    if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
      const scalarField = DataFormUtilities.getScalarField(form);

      if (!scalarField) {
        if (typeof data === "string") {
          issues.push(DataFormValidator.getValidationIssue(DataFormIssueType.unexpectedStringUsedWhenObjectExpected));
        } else if (typeof data === "number") {
          issues.push(DataFormValidator.getValidationIssue(DataFormIssueType.unexpectedNumberUsedWhenObjectExpected));
        } else if (typeof data === "boolean") {
          issues.push(DataFormValidator.getValidationIssue(DataFormIssueType.unexpectedBooleanUsedWhenObjectExpected));
        }

        return issues;
      }

      await this.validateField(data, scalarField, issues, path + "<default value>", context);
    }

    const fields = form.fields;

    // Guard against forms with undefined or null fields array
    if (fields && Array.isArray(fields)) {
      for (const field of fields) {
        if (field.id) {
          // Clean the field ID to remove embedded enum syntax like 'render_distance_type"<"fixed", "render"'
          const cleanedFieldId = cleanFieldId(field.id);

          // Check if the cleaned field ID is a regex pattern (contains metacharacters like [, ], +, *, etc.)
          if (
            this.isPatternFieldId(cleanedFieldId) &&
            typeof data === "object" &&
            data !== null &&
            !Array.isArray(data)
          ) {
            // For pattern-based field IDs, find all matching keys in the data
            await this.validatePatternField(data, field, issues, path, context, cleanedFieldId);
          } else {
            // Use the cleaned field ID for data lookup
            const fieldData = (data as any)[cleanedFieldId];
            await this.validateField(fieldData, field, issues, path + cleanedFieldId, context);
          }
        }
      }
    }

    // Check for unexpected properties not defined in the form
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      await this.validateUnexpectedProperties(data, form, issues, path);
    }

    return issues;
  }

  /**
   * Validates that an object doesn't have properties not defined in the form.
   * This check only runs when form.strictAdditionalProperties is true, as most Minecraft
   * content formats allow additional properties not explicitly defined in the schema.
   */
  static async validateUnexpectedProperties(
    data: object,
    form: IFormDefinition,
    issues: IDataFormValidationIssue[],
    path: string
  ): Promise<void> {
    // Skip if the form allows additional properties (default behavior for Minecraft content)
    if (!form.strictAdditionalProperties) {
      return;
    }

    // Skip if the form explicitly allows custom fields
    if (form.customField) {
      return;
    }

    // Skip if form.fields is not available
    if (!form.fields || !Array.isArray(form.fields)) {
      return;
    }

    const definedFieldIds = new Set<string>();

    for (const field of form.fields) {
      if (field.id) {
        definedFieldIds.add(field.id);
      }
      if (field.altId) {
        definedFieldIds.add(field.altId);
      }
    }

    const dataKeys = Object.keys(data);
    for (const key of dataKeys) {
      if (!definedFieldIds.has(key)) {
        issues.push({
          message: `At ${path}${key}, unexpected property '${key}' is not defined in the schema.`,
          type: DataFormIssueType.unexpectedProperty,
        });
      }
    }
  }

  static async validateField(
    data: object | string | number | boolean | undefined | null,
    field: IField,
    issues: IDataFormValidationIssue[],
    path: string,
    context: IValidationContext
  ) {
    const allFields = DataFormUtilities.getFieldAndAlternates(field);

    let dataMismatchErrors = "";
    let hasOneMatch = false;
    let isRequired = false;
    let matchingField: IField | undefined;

    for (const altField of allFields) {
      if (data !== undefined && data !== null) {
        const mismatchError = DataFormValidator.getDataMismatchError(data, altField.dataType);

        if (!mismatchError) {
          hasOneMatch = true;
          matchingField = altField;
        } else {
          dataMismatchErrors += mismatchError;
        }
      }

      if (altField.isRequired) {
        isRequired = true;
      }
    }

    if (data === undefined || data === null) {
      if (isRequired) {
        // Use cleaned field ID in error message
        const cleanedId = field.id ? cleanFieldId(field.id) : field.id;
        issues.push({
          message: "At " + path + ", data is missing required field '" + cleanedId + "'.",
          type: DataFormIssueType.missingRequiredField,
        });
      }

      return;
    }

    if (!hasOneMatch) {
      if (allFields.length > 1) {
        issues.push({
          message: "At " + path + ", data does not match any one of the expected types: " + dataMismatchErrors,
          type: DataFormIssueType.dataTypeMismatch,
        });
      } else {
        issues.push({
          message: "At " + path + ", data does not match expected type. " + dataMismatchErrors,
          type: DataFormIssueType.dataTypeMismatch,
        });
      }
      return; // Don't continue validation if type doesn't match
    }

    // Use the matching field for remaining validations
    const activeField = matchingField || field;

    // Validate numeric ranges
    if (typeof data === "number") {
      this.validateNumericRange(data, activeField, issues, path);
    }

    // Validate string length
    if (typeof data === "string") {
      this.validateStringLength(data, activeField, issues, path);
    }

    // Validate choices/enum values
    this.validateChoices(data, activeField, issues, path);

    // Validate patterns from validity conditions
    this.validatePatterns(data, activeField, issues, path);

    // Validate array lengths
    if (Array.isArray(data)) {
      this.validateArrayLength(data, activeField, issues, path);
    }

    // Validate point sizes (point2, point3, etc.)
    this.validatePointSize(data, activeField, issues, path);

    // Validate keyed collection keys
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      await this.validateKeyedCollection(data, activeField, issues, path, context);
    }

    if (typeof data === "object" && data === null && field.id && Utilities.isUsableAsObjectKey(field.id)) {
      const fieldData = (data as any)[field.id];

      const subForm = await this.getCachedSubForm(field, context);

      if (subForm && fieldData !== undefined && fieldData !== null) {
        await this.validate(fieldData, subForm, issues, path, {
          depth: context.depth + 1,
          subFormCache: context.subFormCache,
        });
      }
    }
  }

  static getDataMismatchError(data: object | string | number | boolean | string[] | number[], type: FieldDataType) {
    if (Array.isArray(data)) {
      // Determine array element type by checking first element
      const elementType = data.length > 0 ? typeof data[0] : undefined;

      if (elementType === "string") {
        if (
          type === FieldDataType.stringArray ||
          type === FieldDataType.checkboxListAsStringArray ||
          type === FieldDataType.longFormStringArray
        ) {
          return undefined;
        }

        return (
          "Data '" +
          data +
          "' is of type string array, which does not match type '" +
          DataFormUtilities.getFieldTypeDescription(type) +
          "'."
        );
      } else if (elementType === "number") {
        // Number arrays can match numberArray, floatRange, intRange, percentRange, point2, point3, intPoint3, version
        if (
          type === FieldDataType.numberArray ||
          type === FieldDataType.floatRange ||
          type === FieldDataType.intRange ||
          type === FieldDataType.percentRange ||
          type === FieldDataType.point2 ||
          type === FieldDataType.point3 ||
          type === FieldDataType.intPoint3 ||
          type === FieldDataType.version ||
          type === FieldDataType.location ||
          type === FieldDataType.locationOffset
        ) {
          return undefined;
        }

        return (
          "Data '" +
          data +
          "' is of type number array, which does not match type '" +
          DataFormUtilities.getFieldTypeDescription(type) +
          "'."
        );
      } else if (elementType === "object") {
        // Array of objects - valid for objectArray, minecraftEventTriggerArray, etc.
        if (
          type === FieldDataType.objectArray ||
          type === FieldDataType.minecraftEventTriggerArray ||
          type === FieldDataType.arrayOfKeyedStringCollection
        ) {
          return undefined;
        }

        return (
          "Data is of type object array, which does not match type '" +
          DataFormUtilities.getFieldTypeDescription(type) +
          "'."
        );
      } else if (Array.isArray(data[0])) {
        // Two-dimensional array
        if (type === FieldDataType.twoDStringArray) {
          return undefined;
        }

        return (
          "Data is of type 2D array, which does not match type '" +
          DataFormUtilities.getFieldTypeDescription(type) +
          "'."
        );
      }

      // Empty array - allow it for any array type
      if (data.length === 0) {
        return undefined;
      }
    } else if (typeof data === "string") {
      // Strings can match many types including enums, molang expressions, UUIDs, etc.
      if (
        type === FieldDataType.localizableString ||
        type === FieldDataType.longFormString ||
        type === FieldDataType.version ||
        type === FieldDataType.stringLookup ||
        type === FieldDataType.string ||
        type === FieldDataType.stringEnum ||
        type === FieldDataType.molang ||
        type === FieldDataType.uuid ||
        type === FieldDataType.minecraftEventReference
      ) {
        return undefined;
      }

      return (
        "Data '" +
        data +
        "' is of type string, which does not match type '" +
        DataFormUtilities.getFieldTypeDescription(type) +
        "'."
      );
    } else if (typeof data === "number") {
      // A single number can match many types including range types (collapsed ranges)
      // According to IField.ts docs, intRange/floatRange/percentRange can be a single number
      if (
        type === FieldDataType.float ||
        type === FieldDataType.intBoolean ||
        type === FieldDataType.int ||
        type === FieldDataType.intEnum ||
        type === FieldDataType.intValueLookup ||
        type === FieldDataType.number ||
        type === FieldDataType.long ||
        type === FieldDataType.intRange ||
        type === FieldDataType.floatRange ||
        type === FieldDataType.percentRange
      ) {
        return undefined;
      }

      return (
        "Data '" +
        data +
        "' is of type number, which does not match type '" +
        DataFormUtilities.getFieldTypeDescription(type) +
        "'."
      );
    } else if (typeof data === "boolean") {
      if (type === FieldDataType.boolean) {
        return undefined;
      }

      return (
        "Data '" +
        data +
        "' is of type boolean, which does not match type '" +
        DataFormUtilities.getFieldTypeDescription(type) +
        "'."
      );
    } else if (typeof data === "object") {
      // Objects can match many types - keyed collections, range types (with min/max), filters, event triggers, etc.
      if (
        type === FieldDataType.object ||
        type === FieldDataType.keyedBooleanCollection ||
        type === FieldDataType.keyedKeyedStringArrayCollection ||
        type === FieldDataType.keyedNumberArrayCollection ||
        type === FieldDataType.keyedNumberCollection ||
        type === FieldDataType.keyedObjectCollection ||
        type === FieldDataType.keyedStringArrayCollection ||
        type === FieldDataType.keyedStringCollection ||
        // Range types can also be objects with min/max properties
        type === FieldDataType.intRange ||
        type === FieldDataType.floatRange ||
        type === FieldDataType.percentRange ||
        // Minecraft-specific object types
        type === FieldDataType.minecraftFilter ||
        type === FieldDataType.minecraftEventTrigger ||
        type === FieldDataType.minecraftEventReference ||
        // Point types can be objects with x/y/z properties
        type === FieldDataType.point2 ||
        type === FieldDataType.point3 ||
        type === FieldDataType.intPoint3 ||
        type === FieldDataType.location ||
        type === FieldDataType.locationOffset
      ) {
        return undefined;
      }

      let dataStr = JSON.stringify(data);

      if (dataStr.length > 60) {
        dataStr = dataStr.substring(0, 60) + "...";
      }

      return (
        "Data '" +
        dataStr +
        "' is an object, which does not match type '" +
        DataFormUtilities.getFieldTypeDescription(type) +
        "'."
      );
    }

    return undefined;
  }

  /**
   * Validates that a numeric value is within the allowed range.
   */
  static validateNumericRange(data: number, field: IField, issues: IDataFormValidationIssue[], path: string): void {
    if (field.minValue !== undefined && data < field.minValue) {
      issues.push({
        message: `At ${path}, value ${data} is below minimum value ${field.minValue}.`,
        type: DataFormIssueType.valueBelowMinimum,
      });
    }

    if (field.maxValue !== undefined && data > field.maxValue) {
      issues.push({
        message: `At ${path}, value ${data} is above maximum value ${field.maxValue}.`,
        type: DataFormIssueType.valueAboveMaximum,
      });
    }
  }

  /**
   * Validates that a string value is within the allowed length.
   */
  static validateStringLength(data: string, field: IField, issues: IDataFormValidationIssue[], path: string): void {
    if (field.minLength !== undefined && data.length < field.minLength) {
      issues.push({
        message: `At ${path}, string length ${data.length} is below minimum length ${field.minLength}.`,
        type: DataFormIssueType.stringTooShort,
      });
    }

    if (field.maxLength !== undefined && data.length > field.maxLength) {
      issues.push({
        message: `At ${path}, string length ${data.length} is above maximum length ${field.maxLength}.`,
        type: DataFormIssueType.stringTooLong,
      });
    }
  }

  /**
   * Validates that a value matches one of the allowed choices.
   */
  static validateChoices(data: unknown, field: IField, issues: IDataFormValidationIssue[], path: string): void {
    // If no choices defined or mustMatchChoices is explicitly false, skip
    if (!field.choices || field.choices.length === 0) {
      return;
    }

    // If mustMatchChoices is explicitly false, skip validation
    if (field.mustMatchChoices === false) {
      return;
    }

    // For lookup fields without mustMatchChoices explicitly set, skip by default
    // since lookups may have dynamic values
    if (
      field.mustMatchChoices === undefined &&
      (field.dataType === FieldDataType.stringLookup || field.dataType === FieldDataType.intValueLookup)
    ) {
      return;
    }

    const dataValue = typeof data === "string" || typeof data === "number" ? data : undefined;
    if (dataValue === undefined) {
      return;
    }

    const validChoiceIds = field.choices.map((choice) => choice.id);
    const valueStr = String(dataValue);

    if (!validChoiceIds.includes(valueStr)) {
      const choiceList = validChoiceIds.slice(0, 5).join(", ") + (validChoiceIds.length > 5 ? ", ..." : "");
      issues.push({
        message: `At ${path}, value '${valueStr}' is not one of the allowed choices: ${choiceList}.`,
        type: DataFormIssueType.valueNotInChoices,
      });
    }
  }

  /**
   * Validates that a value matches patterns defined in field.validity conditions.
   */
  static validatePatterns(data: unknown, field: IField, issues: IDataFormValidationIssue[], path: string): void {
    if (!field.validity || field.validity.length === 0) {
      return;
    }

    if (typeof data !== "string") {
      return;
    }

    for (const condition of field.validity) {
      if (condition.comparison === ComparisonType.matchesPattern && condition.value !== undefined) {
        try {
          const pattern = new RegExp(String(condition.value));
          if (!pattern.test(data)) {
            issues.push({
              message: `At ${path}, value '${data}' does not match required pattern '${condition.value}'.`,
              type: DataFormIssueType.patternMismatch,
            });
          }
        } catch (e) {
          // Invalid regex pattern - skip validation but don't crash
        }
      }
    }
  }

  /**
   * Validates that an array has the correct length if fixedLength is specified.
   */
  static validateArrayLength(data: unknown[], field: IField, issues: IDataFormValidationIssue[], path: string): void {
    if (field.fixedLength !== undefined && data.length !== field.fixedLength) {
      issues.push({
        message: `At ${path}, array has ${data.length} elements but expected exactly ${field.fixedLength}.`,
        type: DataFormIssueType.arrayLengthMismatch,
      });
    }
  }

  /**
   * Validates that point arrays (point2, point3, etc.) have the correct number of elements.
   */
  static validatePointSize(data: unknown, field: IField, issues: IDataFormValidationIssue[], path: string): void {
    if (!Array.isArray(data)) {
      return;
    }

    let expectedSize: number | undefined;

    switch (field.dataType) {
      case FieldDataType.point2:
        expectedSize = 2;
        break;
      case FieldDataType.point3:
        expectedSize = 3;
        break;
      case FieldDataType.floatRange:
        expectedSize = 2;
        break;
      case FieldDataType.intRange:
        expectedSize = 2;
        break;
    }

    if (expectedSize !== undefined && data.length !== expectedSize) {
      const typeName = DataFormUtilities.getFieldTypeDescription(field.dataType);
      issues.push({
        message: `At ${path}, ${typeName} has ${data.length} elements but expected exactly ${expectedSize}.`,
        type: DataFormIssueType.pointSizeMismatch,
      });
    }
  }

  /**
   * Gets a subForm for a field, using the validation context cache to avoid repeated lookups.
   * This significantly improves performance when validating deeply nested structures.
   */
  static async getCachedSubForm(field: IField, context: IValidationContext): Promise<IFormDefinition | null> {
    // If there's an inline subForm, return it directly (no caching needed)
    if (field.subForm) {
      return field.subForm;
    }

    // If there's no subFormId, nothing to look up
    if (!field.subFormId) {
      return null;
    }

    const cacheKey = field.subFormId;

    if (context.subFormCache.has(cacheKey)) {
      return context.subFormCache.get(cacheKey) || null;
    }

    const subForm = await FieldUtilities.getSubForm(field);
    context.subFormCache.set(cacheKey, subForm || null);
    return subForm || null;
  }

  /**
   * Validates that keys in a keyed collection are allowed if allowedKeys is specified.
   */
  static async validateKeyedCollection(
    data: object,
    field: IField,
    issues: IDataFormValidationIssue[],
    path: string,
    context: IValidationContext
  ): Promise<void> {
    const isKeyedCollection =
      field.dataType === FieldDataType.keyedObjectCollection ||
      field.dataType === FieldDataType.keyedStringCollection ||
      field.dataType === FieldDataType.keyedNumberCollection ||
      field.dataType === FieldDataType.keyedBooleanCollection ||
      field.dataType === FieldDataType.keyedStringArrayCollection ||
      field.dataType === FieldDataType.keyedNumberArrayCollection ||
      field.dataType === FieldDataType.keyedKeyedStringArrayCollection;

    if (!isKeyedCollection) {
      // For regular objects, validate subForm if available
      const subForm = await this.getCachedSubForm(field, context);
      if (subForm) {
        await this.validate(data, subForm, issues, path, {
          depth: context.depth + 1,
          subFormCache: context.subFormCache,
        });
      }
      return;
    }

    // Validate allowedKeys if specified
    if (field.allowedKeys && field.allowedKeys.length > 0) {
      const dataKeys = Object.keys(data);
      for (const key of dataKeys) {
        if (!field.allowedKeys.includes(key)) {
          issues.push({
            message: `At ${path}, key '${key}' is not in the allowed keys list.`,
            type: DataFormIssueType.keyNotAllowed,
          });
        }
      }
    }

    // If there's a subForm, validate each value in the keyed collection
    if (field.dataType === FieldDataType.keyedObjectCollection) {
      const subForm = await this.getCachedSubForm(field, context);
      if (subForm) {
        for (const key of Object.keys(data)) {
          const value = (data as Record<string, unknown>)[key];
          if (value !== undefined && value !== null && typeof value === "object") {
            await this.validate(value as object, subForm, issues, `${path}.${key}`, {
              depth: context.depth + 1,
              subFormCache: context.subFormCache,
            });
          }
        }
      }
    }
  }

  /**
   * Checks if a field ID contains regex metacharacters, indicating it's a pattern
   * that should be matched against data keys rather than used as a literal property name.
   * Common patterns in Minecraft forms: "geometry.[a-zA-Z0-9_.'-:]+" for legacy geometry.
   */
  static isPatternFieldId(fieldId: string): boolean {
    // Check for common regex metacharacters that indicate a pattern
    return /[[\]{}()*+?\\^$|]/.test(fieldId);
  }

  /**
   * Validates a pattern-based field ID against the data object.
   * For pattern fields, iterates through all data keys and validates those matching the pattern.
   * If the field is required, at least one matching key must exist.
   * @param cleanedFieldId - The field ID after cleaning (removing embedded enum syntax)
   */
  static async validatePatternField(
    data: object,
    field: IField,
    issues: IDataFormValidationIssue[],
    path: string,
    context: IValidationContext,
    cleanedFieldId?: string
  ): Promise<void> {
    const fieldIdToUse = cleanedFieldId || (field.id ? cleanFieldId(field.id) : undefined);
    if (!fieldIdToUse) {
      return;
    }

    let pattern: RegExp;
    try {
      // Anchor the pattern to match the full key
      pattern = new RegExp("^" + fieldIdToUse + "$");
    } catch (e) {
      // Invalid regex - treat as literal field ID (fallback)
      const fieldData = (data as any)[fieldIdToUse];
      await this.validateField(fieldData, field, issues, path + fieldIdToUse, context);
      return;
    }

    const dataKeys = Object.keys(data);
    const matchingKeys = dataKeys.filter((key) => pattern.test(key));

    if (matchingKeys.length === 0) {
      if (field.isRequired) {
        issues.push({
          message: `At ${path}${fieldIdToUse}, data is missing required field matching pattern '${fieldIdToUse}'.`,
          type: DataFormIssueType.missingRequiredField,
        });
      }
      return;
    }

    // Validate each matching key against the field's subForm or validation rules
    for (const matchingKey of matchingKeys) {
      const fieldData = (data as any)[matchingKey];
      await this.validateField(fieldData, field, issues, path + matchingKey, context);
    }
  }

  static getValidationIssue(type: DataFormIssueType): IDataFormValidationIssue {
    return {
      message: Utilities.getTitleFromEnum(DataFormIssueType, type),
      type: type,
    };
  }
}

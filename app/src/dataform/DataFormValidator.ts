import Utilities from "../core/Utilities";
import DataFormUtilities from "./DataFormUtilities";
import FieldUtilities from "./FieldUtilities";
import IField, { FieldDataType } from "./IField";
import IFormDefinition from "./IFormDefinition";

export enum DataFormIssueType {
  unexpectedStringUsedWhenObjectExpected = 101,
  unexpectedBooleanUsedWhenObjectExpected = 102,
  unexpectedNumberUsedWhenObjectExpected = 103,
  dataTypeMismatch = 110,
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
    path?: string
  ): Promise<IDataFormValidationIssue[]> {
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

      await this.validateField(data, scalarField, issues, path + "<default value>");
    }

    const fields = form.fields;

    for (const field of fields) {
      if (field.id) {
        const fieldData = (data as any)[field.id];
        await this.validateField(fieldData, field, issues, path + FieldUtilities.getFieldId(field));
      }
    }

    return issues;
  }

  static async validateField(
    data: object | string | number | boolean | undefined | null,
    field: IField,
    issues: IDataFormValidationIssue[],
    path: string
  ) {
    const allFields = DataFormUtilities.getFieldAndAlternates(field);

    let dataMismatchErrors = "";
    let hasOneMatch = false;
    let isRequired = false;

    for (const field of allFields) {
      if (data !== undefined && data !== null) {
        const mismatchError = DataFormValidator.getDataMismatchError(data, field.dataType);

        if (!mismatchError) {
          hasOneMatch = true;
        } else {
          dataMismatchErrors += mismatchError;
        }

        if (field.isRequired) {
          isRequired = true;
        }
      }
    }

    if (data === undefined || data === null) {
      if (isRequired) {
        issues.push({
          message: "At " + path + ", data is missing required field '" + field.id + "'.",
          type: DataFormIssueType.dataTypeMismatch,
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
    }

    if (typeof data === "object" && data === null && field.id && Utilities.isUsableAsObjectKey(field.id)) {
      const fieldData = (data as any)[field.id];

      const subForm = await FieldUtilities.getSubForm(field);

      if (subForm && fieldData !== undefined && fieldData !== null) {
        await this.validate(fieldData, subForm, issues, path);
      }
    }
  }

  static getDataMismatchError(data: object | string | number | boolean | string[] | number[], type: FieldDataType) {
    if (Array.isArray(data)) {
      if (typeof data === "string") {
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
      } else if (typeof data === "number") {
        if (type === FieldDataType.numberArray || type === FieldDataType.floatRange) {
          return undefined;
        }

        return (
          "Data '" +
          data +
          "' is of type number array, which does not match type '" +
          DataFormUtilities.getFieldTypeDescription(type) +
          "'."
        );
      }
    } else if (typeof data === "string") {
      if (
        type === FieldDataType.localizableString ||
        type === FieldDataType.longFormString ||
        type === FieldDataType.version ||
        type === FieldDataType.stringLookup ||
        type === FieldDataType.string
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
      if (
        type === FieldDataType.float ||
        type === FieldDataType.intBoolean ||
        type === FieldDataType.int ||
        type === FieldDataType.intEnum ||
        type === FieldDataType.intValueLookup
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
      if (
        type === FieldDataType.object ||
        type === FieldDataType.keyedBooleanCollection ||
        type === FieldDataType.keyedKeyedStringArrayCollection ||
        type === FieldDataType.keyedNumberArrayCollection ||
        type === FieldDataType.keyedNumberCollection ||
        type === FieldDataType.keyedObjectCollection ||
        type === FieldDataType.keyedStringArrayCollection ||
        type === FieldDataType.keyedStringCollection
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

  static getValidationIssue(type: DataFormIssueType): IDataFormValidationIssue {
    return {
      message: Utilities.getTitleFromEnum(DataFormIssueType, type),
      type: type,
    };
  }
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Log from "../core/Log";
import Utilities from "../core/Utilities";
import Database from "../minecraft/Database";
import ICondition, { ComparisonType } from "./ICondition";
import IDataContainer from "./IDataContainer";
import IField, { FieldDataType } from "./IField";
import IFormDefinition from "./IFormDefinition";

export default class FieldUtilities {
  static getFieldValueAsBoolean(name: string, defaultValue: boolean, container: IDataContainer) {
    let value = undefined;

    if (container.dataPropertyObject !== undefined) {
      const prop = container.dataPropertyObject.getProperty(name);

      if (prop !== undefined) {
        value = prop.value;
      }
    }

    if (container.getsetPropertyObject !== undefined) {
      value = container.getsetPropertyObject.getProperty(name);
    }

    if (container.directObject !== undefined) {
      value = container.directObject[name];
    }

    if (value === undefined) {
      return defaultValue;
    }

    if (typeof value === "boolean") {
      return value;
    } else if (typeof value === "number") {
      if (value === 0) {
        return false;
      } else {
        return true;
      }
    } else if (typeof value === "string") {
      if (value === "false") {
        return false;
      } else {
        return true;
      }
    }

    return defaultValue;
  }

  static async getSubForm(field: IField): Promise<IFormDefinition | undefined> {
    if (field.subForm) {
      return field.subForm;
    }

    if (field.subFormId) {
      const subForm = await Database.ensureFormLoadedByPath(field.subFormId);
      return subForm;
    }

    return undefined;
  }

  static getFieldValue(field: IField, container: IDataContainer) {
    let curVal = undefined;

    const dataObj = container.dataPropertyObject;

    if (dataObj !== undefined) {
      let prop = dataObj.getProperty(field.id);

      if (prop === undefined && field.altId !== undefined) {
        prop = dataObj.getProperty(field.altId);
      }

      if (prop !== undefined) {
        curVal = prop.value;
      }
    }

    const gsObj = container.getsetPropertyObject;

    if (gsObj !== undefined) {
      if (field.id === "__scalar") {
        const res = gsObj.getBaseValue();

        if (typeof res === "object") {
          return undefined;
        }

        return res;
      }

      curVal = gsObj.getProperty(field.id);

      if (curVal === undefined && field.altId !== undefined) {
        curVal = gsObj.getProperty(field.altId);
      }
    }

    const dirObj = container.directObject;

    if (dirObj !== undefined) {
      if (field.id === "__scalar") {
        if (typeof dirObj === "object") {
          return undefined;
        }

        return dirObj;
      }

      curVal = dirObj[field.id];
    }

    return curVal;
  }

  static getFieldTitle(field: IField) {
    let title = field.id;

    if (field.title !== undefined) {
      title = field.title;
    } else {
      title = Utilities.humanifyMinecraftName(title);
    }

    if (title === undefined) {
      title = "Untitled";
    }

    return title;
  }

  static getFieldId(field: IField) {
    if (field.id) {
      return field.id;
    }

    if (field.title) {
      return field.title;
    }

    return "<no id>";
  }

  static getFieldById(id: string, form: IFormDefinition) {
    const fields = form.fields;

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      if (field.id === id) {
        return field;
      }
    }

    return undefined;
  }

  /**
   * Legacy numeric-to-string mapping for FieldDataType.
   * Some form.json files still contain numeric dataType values from that era. 
   * This map converts them to the current string-based FieldDataType values.
   */
  private static readonly _legacyNumericDataTypeMap: { [key: number]: FieldDataType } = {
    0: FieldDataType.int,
    1: FieldDataType.boolean,
    2: FieldDataType.string,
    3: FieldDataType.float,
    4: FieldDataType.stringEnum,
    5: FieldDataType.intEnum,
    6: FieldDataType.intBoolean,
    7: FieldDataType.number,
    8: FieldDataType.stringLookup,
    9: FieldDataType.intValueLookup,
    10: FieldDataType.long,
    11: FieldDataType.point3,
    12: FieldDataType.intPoint3,
    13: FieldDataType.longFormString,
    14: FieldDataType.keyedObjectCollection,
    15: FieldDataType.objectArray,
    16: FieldDataType.object,
    17: FieldDataType.stringArray,
    18: FieldDataType.intRange,
    19: FieldDataType.floatRange,
    20: FieldDataType.minecraftFilter,
    21: FieldDataType.percentRange,
    22: FieldDataType.minecraftEventTrigger,
    23: FieldDataType.longFormStringArray,
    24: FieldDataType.keyedStringCollection,
    25: FieldDataType.version,
    26: FieldDataType.uuid,
    27: FieldDataType.keyedBooleanCollection,
    28: FieldDataType.keyedStringArrayCollection,
    29: FieldDataType.arrayOfKeyedStringCollection,
    30: FieldDataType.keyedKeyedStringArrayCollection,
    31: FieldDataType.keyedNumberCollection,
    32: FieldDataType.numberArray,
    33: FieldDataType.checkboxListAsStringArray,
    34: FieldDataType.molang,
    35: FieldDataType.molangArray,
    36: FieldDataType.point2,
    37: FieldDataType.localizableString,
    38: FieldDataType.keyedNumberArrayCollection,
    39: FieldDataType.minecraftEventReference,
  };

  /**
   * Converts a legacy numeric FieldDataType value to its string equivalent.
   * If the value is already a string, returns it as-is.
   */
  static normalizeFieldDataType(dataType: FieldDataType | number): FieldDataType {
    if (typeof dataType === "number") {
      return FieldUtilities._legacyNumericDataTypeMap[dataType] ?? FieldDataType.string;
    }
    return dataType;
  }

  /**
   * Normalizes all numeric dataType values in a form definition (and its nested
   * subForms/alternates) to string-based FieldDataType values.
   */
  static normalizeFormFieldDataTypes(form: IFormDefinition) {
    if (!form.fields) {
      return;
    }

    for (const field of form.fields) {
      FieldUtilities.normalizeFieldDataTypes(field);
    }

    if (form.scalarField) {
      FieldUtilities.normalizeFieldDataTypes(form.scalarField);
    }
  }

  private static normalizeFieldDataTypes(field: IField) {
    if (field.dataType !== undefined) {
      field.dataType = FieldUtilities.normalizeFieldDataType(field.dataType);
    }

    if (field.alternates) {
      for (const alt of field.alternates) {
        FieldUtilities.normalizeFieldDataTypes(alt);
      }
    }

    if (field.subForm) {
      FieldUtilities.normalizeFormFieldDataTypes(field.subForm);
    }
  }

  static getStringKeyedFieldType(fieldType: FieldDataType) {
    switch (fieldType) {
      case FieldDataType.string:
        return FieldDataType.keyedStringCollection;
      case FieldDataType.number:
        return FieldDataType.keyedNumberCollection;
      case FieldDataType.stringArray:
        return FieldDataType.keyedStringArrayCollection;
      case FieldDataType.numberArray:
        return FieldDataType.keyedNumberArrayCollection;
      case FieldDataType.boolean:
        return FieldDataType.keyedBooleanCollection;
      case FieldDataType.object:
        return FieldDataType.keyedObjectCollection;
    }

    return fieldType;
  }

  static evaluate(form: IFormDefinition, conditions: ICondition[], container: IDataContainer, defaultField?: IField) {
    for (let condition of conditions) {
      let field: IField | undefined;

      if (condition.field) {
        field = FieldUtilities.getFieldById(condition.field, form);
      }

      if (!field && defaultField) {
        field = defaultField;
      }

      if (!field) {
        Log.fail("Could not find field '" + condition.field + "'");
        return false;
      }

      const actualVal = FieldUtilities.getFieldValue(field, container);

      if (condition.comparison) {
        const comp = condition.comparison.toLowerCase();

        if (comp === ComparisonType.equals) {
          if (condition.value !== undefined && actualVal !== condition.value) {
            return false;
          }

          if (condition.anyValues !== undefined) {
            let foundMatch = false;

            for (const val of condition.anyValues) {
              if (val === actualVal) {
                foundMatch = true;
              }
            }

            if (!foundMatch) {
              return false;
            }
          }
        } else if (comp === ComparisonType.isDefined && (actualVal === undefined || actualVal === null)) {
          return false;
        } else if (
          comp === ComparisonType.isNonEmpty &&
          (actualVal === undefined || actualVal === null || (typeof actualVal === "string" && actualVal.length <= 0))
        ) {
          return false;
        }
      }
    }

    return true;
  }
}

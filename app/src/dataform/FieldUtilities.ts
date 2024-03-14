// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Log from "../core/Log";
import Utilities from "../core/Utilities";
import ICondition, { ComparisonType } from "./ICondition";
import IDataContainer from "./IDataContainer";
import IField from "./IField";
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
      curVal = gsObj.getProperty(field.id);

      if (curVal === undefined && field.altId !== undefined) {
        curVal = gsObj.getProperty(field.altId);
      }
    }

    const dirObj = container.directObject;

    if (dirObj !== undefined) {
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

    return title;
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

  static evaluate(form: IFormDefinition, conditions: ICondition[], container: IDataContainer, defaultField?: IField) {
    for (let condition of conditions) {
      let field: IField | undefined = undefined;

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

    return true;
  }
}

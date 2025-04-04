// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Utilities from "../core/Utilities";
import Database from "../minecraft/Database";
import IField, { FieldDataType } from "./IField";
import IFormDefinition, { IFormSample } from "./IFormDefinition";

export default class DataFormUtilities {
  static generateDefaultItem(formDefinition: IFormDefinition) {
    const newDataObject: any = {};

    for (let i = 0; i < formDefinition.fields.length; i++) {
      const field = formDefinition.fields[i];

      if (field.defaultValue !== undefined) {
        if (typeof field.defaultValue === "string" && DataFormUtilities.isObjectFieldType(field.dataType)) {
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
        fieldsByName[field.id] = field;
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

    return fieldA.dataType - fieldB.dataType;
  }

  public static async loadSubForms(
    form: IFormDefinition,
    loadedForms?: string | undefined
  ): Promise<string | undefined> {
    if (!loadedForms) {
      loadedForms = "";
    }

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
      case FieldDataType.percentRange:
        return "Percent Range";
      case FieldDataType.minecraftEventTrigger:
        return "Minecraft Event Trigger";
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
}

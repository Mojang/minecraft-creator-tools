import { JSONSchema7, JSONSchema7Definition } from "json-schema";
import IFormDefinition from "../dataform/IFormDefinition";
import IField, { FieldDataType } from "../dataform/IField";
import Database from "../minecraft/Database";

export default class JsonSchemaGenerator {
  static async convertFormDefinitionToJsonSchema(formDef: IFormDefinition, parentId?: string): Promise<JSONSchema7> {
    let id = "";

    if (parentId) {
      id = parentId + "/";
    }

    if (formDef.id) {
      id += formDef.id;
    }

    if (id.length === 0) {
      if (formDef.title) {
        id = formDef.title;
      }
    }

    const schema: JSONSchema7 = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: id,
      title: formDef.title ? formDef.title : formDef.id,
      description: formDef.description,
      type: "object",
      properties: {},
      required: [],
    };

    for (const field of formDef.fields) {
      schema.properties = schema.properties || {};
      schema.properties[field.id] = await JsonSchemaGenerator.convertFieldToJsonSchema(field);

      if (field.isRequired) {
        schema.required = schema.required || [];
        schema.required.push(field.id);
      }
    }

    return schema;
  }

  static async convertFieldToJsonSchema(field: IField): Promise<JSONSchema7Definition> {
    let schema: JSONSchema7 = {
      title: field.title,
      description: field.description,
    };

    let subForm = field.subForm;

    if (!subForm && field.subFormId) {
      subForm = await Database.ensureFormLoadedByPath(field.subFormId);
    }

    switch (field.dataType) {
      case FieldDataType.int:
        schema.type = "integer";
        break;
      case FieldDataType.boolean:
        schema.type = "boolean";
        break;
      case FieldDataType.string:
      case FieldDataType.localizableString:
      case FieldDataType.molang:
      case FieldDataType.minecraftEventReference:
        schema.type = "string";
        break;
      case FieldDataType.stringArray:
        schema.type = "array";
        schema.items = { type: "string" };
        break;
      case FieldDataType.minecraftEventTrigger:
      case FieldDataType.object:
        schema.type = "object";
        schema.properties = {};
        if (field.subForm) {
          for (const subField of field.subForm?.fields || []) {
            schema.properties = schema.properties || {};
            schema.properties[subField.id] = await JsonSchemaGenerator.convertFieldToJsonSchema(subField);
          }
        }
        break;
      case FieldDataType.objectArray:
        schema.type = "array";
        schema.items = {
          type: "object",
          properties: {},
        };
        for (const subField of field.subForm?.fields || []) {
          (schema.items as JSONSchema7).properties = (schema.items as JSONSchema7).properties || {};
          (schema.items as JSONSchema7).properties![subField.id] = await JsonSchemaGenerator.convertFieldToJsonSchema(
            subField
          );
        }
        break;
      case FieldDataType.intRange:
      case FieldDataType.point3:
        schema.type = "array";
        schema.items = { type: "number" };
        break;
      case FieldDataType.keyedStringCollection:
        schema.type = "object";
        schema.additionalProperties = { type: "string" };
        break;
      case FieldDataType.keyedNumberCollection:
        schema.type = "object";
        schema.additionalProperties = { type: "number" };
        break;
      case FieldDataType.keyedObjectCollection:
        schema.type = "object";
        schema.additionalProperties = { type: "object" };
        break;
      case FieldDataType.float:
      case FieldDataType.number:
        schema.type = "number";
        break;
      default:
        schema.type = "string";
        break;
    }

    if (field.description) {
      schema.description = field.description;
    }

    if (field.choices && field.choices.length > 0) {
      schema.enum = field.choices.map((choice) => choice.id);
    }

    return schema;
  }
}

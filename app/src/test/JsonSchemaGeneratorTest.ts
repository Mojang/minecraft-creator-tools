// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * JSON SCHEMA GENERATOR TESTS
 * ===========================
 *
 * These tests validate the quality and precision of our JSON Schema generation
 * from .form.json files, comparing against official Minecraft JSON schemas
 * where possible.
 *
 * ARCHITECTURE:
 * - Tests cover all FieldDataType mappings
 * - Tests verify constraint propagation (min/max, required, etc.)
 * - Tests compare with official Minecraft schemas for accuracy
 *
 * RELATED FILES:
 * - src/schema/JsonSchemaGenerator.ts - The generator being tested
 * - public/data/forms/ - Source form definitions
 * - public/res/latest/van/preview/metadata/json_schemas/ - Official Minecraft schemas
 */

import { expect } from "chai";
import { FieldDataType } from "../dataform/IField";
import IFormDefinition from "../dataform/IFormDefinition";
import JsonSchemaGenerator from "../schema/JsonSchemaGenerator";
import { ComparisonType } from "../dataform/ICondition";

describe("JsonSchemaGenerator", () => {
  describe("Basic Type Mappings", () => {
    it("should map integer types correctly", async () => {
      const formDef: IFormDefinition = {
        id: "test_int",
        fields: [
          { id: "int_field", dataType: FieldDataType.int },
          { id: "intEnum_field", dataType: FieldDataType.intEnum },
          { id: "intBoolean_field", dataType: FieldDataType.intBoolean },
          { id: "intValueLookup_field", dataType: FieldDataType.intValueLookup },
          { id: "long_field", dataType: FieldDataType.long },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).int_field.type).to.equal("integer");
      expect((schema.properties as any).intEnum_field.type).to.equal("integer");
      expect((schema.properties as any).intBoolean_field.type).to.equal("integer");
      expect((schema.properties as any).intValueLookup_field.type).to.equal("integer");
      expect((schema.properties as any).long_field.type).to.equal("integer");
    });

    it("should map floating-point types correctly", async () => {
      const formDef: IFormDefinition = {
        id: "test_float",
        fields: [
          { id: "float_field", dataType: FieldDataType.float },
          { id: "number_field", dataType: FieldDataType.number },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).float_field.type).to.equal("number");
      expect((schema.properties as any).number_field.type).to.equal("number");
    });

    it("should map boolean type correctly", async () => {
      const formDef: IFormDefinition = {
        id: "test_bool",
        fields: [{ id: "bool_field", dataType: FieldDataType.boolean }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).bool_field.type).to.equal("boolean");
    });

    it("should map string types correctly", async () => {
      const formDef: IFormDefinition = {
        id: "test_string",
        fields: [
          { id: "string_field", dataType: FieldDataType.string },
          { id: "stringEnum_field", dataType: FieldDataType.stringEnum },
          { id: "stringLookup_field", dataType: FieldDataType.stringLookup },
          { id: "longFormString_field", dataType: FieldDataType.longFormString },
          { id: "molang_field", dataType: FieldDataType.molang },
          { id: "localizableString_field", dataType: FieldDataType.localizableString },
          { id: "minecraftEventReference_field", dataType: FieldDataType.minecraftEventReference },
          { id: "version_field", dataType: FieldDataType.version },
          { id: "uuid_field", dataType: FieldDataType.uuid },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).string_field.type).to.equal("string");
      expect((schema.properties as any).stringEnum_field.type).to.equal("string");
      expect((schema.properties as any).stringLookup_field.type).to.equal("string");
      expect((schema.properties as any).longFormString_field.type).to.equal("string");
      // molang generates oneOf: [string, number] since Molang can be either
      expect((schema.properties as any).molang_field.oneOf).to.deep.equal([{ type: "string" }, { type: "number" }]);
      expect((schema.properties as any).localizableString_field.type).to.equal("string");
      expect((schema.properties as any).minecraftEventReference_field.type).to.equal("string");
      expect((schema.properties as any).version_field.type).to.equal("string");
      expect((schema.properties as any).uuid_field.type).to.equal("string");
    });
  });

  describe("Array Type Mappings", () => {
    it("should map string array types correctly", async () => {
      const formDef: IFormDefinition = {
        id: "test_string_array",
        fields: [
          { id: "stringArray_field", dataType: FieldDataType.stringArray },
          { id: "molangArray_field", dataType: FieldDataType.molangArray },
          { id: "longFormStringArray_field", dataType: FieldDataType.longFormStringArray },
          { id: "checkboxListAsStringArray_field", dataType: FieldDataType.checkboxListAsStringArray },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      // These are pure string arrays
      for (const fieldId of ["stringArray_field", "longFormStringArray_field", "checkboxListAsStringArray_field"]) {
        const prop = (schema.properties as any)[fieldId];
        expect(prop.type).to.equal("array");
        expect(prop.items.type).to.equal("string");
      }

      // molangArray has items that can be string OR number (Molang expressions)
      const molangArrayProp = (schema.properties as any).molangArray_field;
      expect(molangArrayProp.type).to.equal("array");
      expect(molangArrayProp.items.oneOf).to.deep.equal([{ type: "string" }, { type: "number" }]);
    });

    it("should map number array types correctly", async () => {
      const formDef: IFormDefinition = {
        id: "test_number_array",
        fields: [{ id: "numberArray_field", dataType: FieldDataType.numberArray }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).numberArray_field.type).to.equal("array");
      expect((schema.properties as any).numberArray_field.items.type).to.equal("number");
    });

    it("should map point types with correct array constraints", async () => {
      const formDef: IFormDefinition = {
        id: "test_points",
        fields: [
          { id: "point2_field", dataType: FieldDataType.point2 },
          { id: "point3_field", dataType: FieldDataType.point3 },
          { id: "intPoint3_field", dataType: FieldDataType.intPoint3 },
          { id: "location_field", dataType: FieldDataType.location },
          { id: "locationOffset_field", dataType: FieldDataType.locationOffset },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      // point2 should be array of 2 numbers
      expect((schema.properties as any).point2_field.type).to.equal("array");
      expect((schema.properties as any).point2_field.items.type).to.equal("number");
      expect((schema.properties as any).point2_field.minItems).to.equal(2);
      expect((schema.properties as any).point2_field.maxItems).to.equal(2);

      // point3 types should be array of 3 numbers
      for (const fieldId of ["point3_field", "location_field", "locationOffset_field"]) {
        const prop = (schema.properties as any)[fieldId];
        expect(prop.type).to.equal("array");
        expect(prop.items.type).to.equal("number");
        expect(prop.minItems).to.equal(3);
        expect(prop.maxItems).to.equal(3);
      }

      // intPoint3 should be array of 3 integers
      expect((schema.properties as any).intPoint3_field.type).to.equal("array");
      expect((schema.properties as any).intPoint3_field.items.type).to.equal("integer");
      expect((schema.properties as any).intPoint3_field.minItems).to.equal(3);
      expect((schema.properties as any).intPoint3_field.maxItems).to.equal(3);
    });
  });

  describe("Range Type Mappings", () => {
    it("should map intRange with oneOf for single value, array, or object", async () => {
      const formDef: IFormDefinition = {
        id: "test_range",
        fields: [{ id: "intRange_field", dataType: FieldDataType.intRange }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).intRange_field;
      expect(prop.oneOf).to.exist;
      expect(prop.oneOf.length).to.equal(3);

      // First option: single integer
      expect(prop.oneOf[0].type).to.equal("integer");

      // Second option: array of 2 integers
      expect(prop.oneOf[1].type).to.equal("array");
      expect(prop.oneOf[1].items.type).to.equal("integer");
      expect(prop.oneOf[1].minItems).to.equal(2);
      expect(prop.oneOf[1].maxItems).to.equal(2);

      // Third option: object with min/max properties
      expect(prop.oneOf[2].type).to.equal("object");
      expect(prop.oneOf[2].properties.min.type).to.equal("integer");
      expect(prop.oneOf[2].properties.max.type).to.equal("integer");
    });

    it("should map floatRange and percentRange with oneOf for single value, array, or object", async () => {
      const formDef: IFormDefinition = {
        id: "test_float_range",
        fields: [
          { id: "floatRange_field", dataType: FieldDataType.floatRange },
          { id: "percentRange_field", dataType: FieldDataType.percentRange },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      for (const fieldId of ["floatRange_field", "percentRange_field"]) {
        const prop = (schema.properties as any)[fieldId];
        expect(prop.oneOf).to.exist;
        expect(prop.oneOf.length).to.equal(3);

        // First option: single number
        expect(prop.oneOf[0].type).to.equal("number");

        // Second option: array of 2 numbers
        expect(prop.oneOf[1].type).to.equal("array");
        expect(prop.oneOf[1].items.type).to.equal("number");
        expect(prop.oneOf[1].minItems).to.equal(2);
        expect(prop.oneOf[1].maxItems).to.equal(2);

        // Third option: object with min/max properties
        expect(prop.oneOf[2].type).to.equal("object");
        expect(prop.oneOf[2].properties.min.type).to.equal("number");
        expect(prop.oneOf[2].properties.max.type).to.equal("number");
      }
    });
  });

  describe("Object and Collection Types", () => {
    it("should map object types correctly", async () => {
      const formDef: IFormDefinition = {
        id: "test_objects",
        fields: [{ id: "object_field", dataType: FieldDataType.object }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).object_field.type).to.equal("object");
    });

    it("should map minecraftEventTrigger to oneOf with string and object", async () => {
      const formDef: IFormDefinition = {
        id: "test_event_trigger",
        fields: [{ id: "trigger_field", dataType: FieldDataType.minecraftEventTrigger }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).trigger_field;
      expect(prop.oneOf).to.exist;
      expect(prop.oneOf.length).to.equal(2);
      expect(prop.oneOf[0].type).to.equal("string");
      expect(prop.oneOf[1].type).to.equal("object");
    });

    it("should map minecraftFilter to anyOf with object, array, and filter groups", async () => {
      const formDef: IFormDefinition = {
        id: "test_filter",
        fields: [{ id: "filter_field", dataType: FieldDataType.minecraftFilter }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).filter_field;
      // Use anyOf instead of oneOf to avoid ambiguity when filter objects match multiple schemas
      expect(prop.anyOf).to.exist;
      expect(prop.anyOf.length).to.equal(3);
      expect(prop.anyOf[0].type).to.equal("object");
      expect(prop.anyOf[1].type).to.equal("array");
      expect(prop.anyOf[1].items.type).to.equal("object");
      // Third option is the filter group pattern with all_of, any_of, none_of
      expect(prop.anyOf[2].type).to.equal("object");
      expect(prop.anyOf[2].properties.all_of).to.exist;
      expect(prop.anyOf[2].properties.any_of).to.exist;
      expect(prop.anyOf[2].properties.none_of).to.exist;
    });

    it("should map object array types correctly", async () => {
      const formDef: IFormDefinition = {
        id: "test_object_arrays",
        fields: [{ id: "objectArray_field", dataType: FieldDataType.objectArray }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).objectArray_field;
      expect(prop.type).to.equal("array");
      expect(prop.items.type).to.equal("object");
    });

    it("should map minecraftEventTriggerArray to array with oneOf items (string | object)", async () => {
      const formDef: IFormDefinition = {
        id: "test_event_trigger_array",
        fields: [{ id: "trigger_array_field", dataType: FieldDataType.minecraftEventTriggerArray }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).trigger_array_field;
      // Should be an array type (not oneOf at top level)
      expect(prop.type).to.equal("array");
      expect(prop.items).to.exist;
      // Items can be string or object
      expect(prop.items.oneOf).to.exist;
      expect(prop.items.oneOf.length).to.equal(2);
      expect(prop.items.oneOf[0].type).to.equal("string");
      expect(prop.items.oneOf[1].type).to.equal("object");
    });

    it("should map keyed collection types correctly", async () => {
      const formDef: IFormDefinition = {
        id: "test_keyed_collections",
        fields: [
          { id: "keyedStringCollection_field", dataType: FieldDataType.keyedStringCollection },
          { id: "keyedNumberCollection_field", dataType: FieldDataType.keyedNumberCollection },
          { id: "keyedBooleanCollection_field", dataType: FieldDataType.keyedBooleanCollection },
          { id: "keyedObjectCollection_field", dataType: FieldDataType.keyedObjectCollection },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).keyedStringCollection_field.type).to.equal("object");
      expect((schema.properties as any).keyedStringCollection_field.additionalProperties.type).to.equal("string");

      expect((schema.properties as any).keyedNumberCollection_field.type).to.equal("object");
      expect((schema.properties as any).keyedNumberCollection_field.additionalProperties.type).to.equal("number");

      expect((schema.properties as any).keyedBooleanCollection_field.type).to.equal("object");
      expect((schema.properties as any).keyedBooleanCollection_field.additionalProperties.type).to.equal("boolean");

      expect((schema.properties as any).keyedObjectCollection_field.type).to.equal("object");
      expect((schema.properties as any).keyedObjectCollection_field.additionalProperties.type).to.equal("object");
    });

    it("should map nested keyed array collections correctly", async () => {
      const formDef: IFormDefinition = {
        id: "test_nested_collections",
        fields: [
          { id: "keyedStringArrayCollection_field", dataType: FieldDataType.keyedStringArrayCollection },
          { id: "keyedNumberArrayCollection_field", dataType: FieldDataType.keyedNumberArrayCollection },
          { id: "keyedKeyedStringArrayCollection_field", dataType: FieldDataType.keyedKeyedStringArrayCollection },
          { id: "arrayOfKeyedStringCollection_field", dataType: FieldDataType.arrayOfKeyedStringCollection },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      // keyedStringArrayCollection: { key: string[] }
      const stringArr = (schema.properties as any).keyedStringArrayCollection_field;
      expect(stringArr.type).to.equal("object");
      expect(stringArr.additionalProperties.type).to.equal("array");
      expect(stringArr.additionalProperties.items.type).to.equal("string");

      // keyedNumberArrayCollection: { key: number[] }
      const numArr = (schema.properties as any).keyedNumberArrayCollection_field;
      expect(numArr.type).to.equal("object");
      expect(numArr.additionalProperties.type).to.equal("array");
      expect(numArr.additionalProperties.items.type).to.equal("number");

      // keyedKeyedStringArrayCollection: { key: { key: string[] } }
      const nestedArr = (schema.properties as any).keyedKeyedStringArrayCollection_field;
      expect(nestedArr.type).to.equal("object");
      expect(nestedArr.additionalProperties.type).to.equal("object");
      expect(nestedArr.additionalProperties.additionalProperties.type).to.equal("array");
      expect(nestedArr.additionalProperties.additionalProperties.items.type).to.equal("string");

      // arrayOfKeyedStringCollection: [{ key: string }]
      const arrOfKeyed = (schema.properties as any).arrayOfKeyedStringCollection_field;
      expect(arrOfKeyed.type).to.equal("array");
      expect(arrOfKeyed.items.type).to.equal("object");
      expect(arrOfKeyed.items.additionalProperties.type).to.equal("string");
    });

    it("should map 2D string array correctly", async () => {
      const formDef: IFormDefinition = {
        id: "test_2d_array",
        fields: [{ id: "twoDStringArray_field", dataType: FieldDataType.twoDStringArray }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).twoDStringArray_field;
      expect(prop.type).to.equal("array");
      expect(prop.items.type).to.equal("array");
      expect(prop.items.items.type).to.equal("string");
    });
  });

  describe("Constraint Propagation", () => {
    it("should include numeric min/max constraints", async () => {
      const formDef: IFormDefinition = {
        id: "test_constraints",
        fields: [
          {
            id: "constrained_number",
            dataType: FieldDataType.number,
            minValue: 0,
            maxValue: 100,
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).constrained_number.minimum).to.equal(0);
      expect((schema.properties as any).constrained_number.maximum).to.equal(100);
    });

    it("should include string length constraints", async () => {
      const formDef: IFormDefinition = {
        id: "test_string_constraints",
        fields: [
          {
            id: "constrained_string",
            dataType: FieldDataType.string,
            minLength: 1,
            maxLength: 50,
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).constrained_string.minLength).to.equal(1);
      expect((schema.properties as any).constrained_string.maxLength).to.equal(50);
    });

    it("should include fixed length array constraints", async () => {
      const formDef: IFormDefinition = {
        id: "test_fixed_array",
        fields: [
          {
            id: "fixed_array",
            dataType: FieldDataType.stringArray,
            fixedLength: 5,
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).fixed_array.minItems).to.equal(5);
      expect((schema.properties as any).fixed_array.maxItems).to.equal(5);
    });

    it("should include required field in required array", async () => {
      const formDef: IFormDefinition = {
        id: "test_required",
        fields: [
          { id: "required_field", dataType: FieldDataType.string, isRequired: true },
          { id: "optional_field", dataType: FieldDataType.string },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect(schema.required).to.deep.equal(["required_field"]);
    });

    it("should include default values for primitive types", async () => {
      const formDef: IFormDefinition = {
        id: "test_defaults",
        fields: [
          { id: "string_default", dataType: FieldDataType.string, defaultValue: "hello" },
          { id: "number_default", dataType: FieldDataType.number, defaultValue: 42 },
          { id: "boolean_default", dataType: FieldDataType.boolean, defaultValue: true },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).string_default.default).to.equal("hello");
      expect((schema.properties as any).number_default.default).to.equal(42);
      expect((schema.properties as any).boolean_default.default).to.equal(true);
    });

    it("should include enum values from choices", async () => {
      const formDef: IFormDefinition = {
        id: "test_enum",
        fields: [
          {
            id: "enum_field",
            dataType: FieldDataType.stringEnum,
            choices: [
              { id: "option1", title: "Option 1" },
              { id: "option2", title: "Option 2" },
              { id: "option3", title: "Option 3" },
            ],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).enum_field.enum).to.deep.equal(["option1", "option2", "option3"]);
    });

    it("should include enum values from enumValues array (shorthand for choices)", async () => {
      // This tests the enumValues shorthand that form.json files use
      // instead of the more verbose choices array
      const formDef: IFormDefinition = {
        id: "test_enumValues",
        fields: [
          {
            id: "render_distance_type",
            dataType: FieldDataType.stringEnum,
            enumValues: ["fixed", "render"],
          },
          {
            id: "category",
            dataType: FieldDataType.stringEnum,
            enumValues: ["ambient", "block", "hostile", "music", "player"],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).render_distance_type.enum).to.deep.equal(["fixed", "render"]);
      expect((schema.properties as any).category.enum).to.deep.equal([
        "ambient",
        "block",
        "hostile",
        "music",
        "player",
      ]);
    });

    it("should prefer choices over enumValues when both are present", async () => {
      const formDef: IFormDefinition = {
        id: "test_choices_priority",
        fields: [
          {
            id: "mode",
            dataType: FieldDataType.stringEnum,
            choices: [
              { id: "alpha", title: "Alpha Mode" },
              { id: "beta", title: "Beta Mode" },
            ],
            enumValues: ["ignored1", "ignored2"], // Should be ignored
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      // choices should take precedence
      expect((schema.properties as any).mode.enum).to.deep.equal(["alpha", "beta"]);
    });

    it("should include enum values on array items when array type has choices", async () => {
      // This tests the pattern used by official Minecraft schemas like:
      // "control_flags": { "type": "array", "items": { "enum": ["move", "look", "jump"] } }
      const formDef: IFormDefinition = {
        id: "test_array_enum",
        fields: [
          {
            id: "control_flags",
            dataType: FieldDataType.stringArray,
            choices: [
              { id: "move", title: "Move" },
              { id: "look", title: "Look" },
              { id: "jump", title: "Jump" },
            ],
          },
          {
            id: "number_options",
            dataType: FieldDataType.numberArray,
            choices: [
              { id: "1", title: "One" },
              { id: "2", title: "Two" },
              { id: "3", title: "Three" },
            ],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      // For stringArray with choices, enum should be on items, not on the array itself
      const controlFlags = (schema.properties as any).control_flags;
      expect(controlFlags.type).to.equal("array");
      expect(controlFlags.items).to.exist;
      expect(controlFlags.items.enum).to.deep.equal(["move", "look", "jump"]);
      expect(controlFlags.enum).to.be.undefined;

      // For numberArray with choices, enum should also be on items
      const numberOptions = (schema.properties as any).number_options;
      expect(numberOptions.type).to.equal("array");
      expect(numberOptions.items).to.exist;
      expect(numberOptions.items.enum).to.deep.equal(["1", "2", "3"]);
      expect(numberOptions.enum).to.be.undefined;
    });

    it("should not include enum when mustMatchChoices is false", async () => {
      // When mustMatchChoices: false, choices are just examples, not restrictions
      const formDef: IFormDefinition = {
        id: "test_no_enum",
        fields: [
          {
            id: "flexible_field",
            dataType: FieldDataType.string,
            mustMatchChoices: false,
            choices: [
              { id: "example1", title: "Example 1" },
              { id: "example2", title: "Example 2" },
            ],
          },
          {
            id: "strict_field",
            dataType: FieldDataType.string,
            mustMatchChoices: true,
            choices: [
              { id: "only1", title: "Only 1" },
              { id: "only2", title: "Only 2" },
            ],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      // Field with mustMatchChoices: false should not have enum restriction
      expect((schema.properties as any).flexible_field.enum).to.be.undefined;
      expect((schema.properties as any).flexible_field.type).to.equal("string");

      // Field with mustMatchChoices: true should have enum restriction
      expect((schema.properties as any).strict_field.enum).to.deep.equal(["only1", "only2"]);
    });

    it("should include deprecated flag in description", async () => {
      const formDef: IFormDefinition = {
        id: "test_deprecated",
        fields: [{ id: "deprecated_field", dataType: FieldDataType.string, isDeprecated: true }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).deprecated_field.description).to.include("[DEPRECATED]");
    });

    it("should set deprecated boolean for deprecated fields", async () => {
      const formDef: IFormDefinition = {
        id: "test_deprecated_bool",
        fields: [{ id: "old_field", dataType: FieldDataType.string, isDeprecated: true }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).old_field.deprecated).to.equal(true);
    });

    it("should output technicalDescription as x-runtime-constraint-description", async () => {
      const formDef: IFormDefinition = {
        id: "test_tech_desc",
        fields: [
          {
            id: "weight_field",
            dataType: FieldDataType.number,
            technicalDescription: "Must be a positive value that represents weight.",
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).weight_field["x-runtime-constraint-description"]).to.equal(
        "Must be a positive value that represents weight."
      );
    });

    it("should output exclusiveMinimum from validity conditions", async () => {
      const formDef: IFormDefinition = {
        id: "test_exclusive_min",
        fields: [
          {
            id: "positive_number",
            dataType: FieldDataType.number,
            validity: [{ comparison: ComparisonType.greaterThan, value: 0 }],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).positive_number.exclusiveMinimum).to.equal(0);
    });

    it("should output exclusiveMaximum from validity conditions", async () => {
      const formDef: IFormDefinition = {
        id: "test_exclusive_max",
        fields: [
          {
            id: "less_than_one",
            dataType: FieldDataType.number,
            validity: [{ comparison: ComparisonType.lessThan, value: 1 }],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).less_than_one.exclusiveMaximum).to.equal(1);
    });

    it("should output pattern from validity conditions", async () => {
      const formDef: IFormDefinition = {
        id: "test_pattern",
        fields: [
          {
            id: "identifier_field",
            dataType: FieldDataType.string,
            validity: [{ comparison: ComparisonType.matchesPattern, value: "^[a-z_][a-z0-9_]*$" }],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).identifier_field.pattern).to.equal("^[a-z_][a-z0-9_]*$");
    });

    it("should output minimum from greaterThanOrEqualTo validity condition", async () => {
      const formDef: IFormDefinition = {
        id: "test_min",
        fields: [
          {
            id: "non_negative",
            dataType: FieldDataType.int,
            validity: [{ comparison: ComparisonType.greaterThanOrEqualTo, value: 0 }],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).non_negative.minimum).to.equal(0);
    });

    it("should output maximum from lessThanOrEqualTo validity condition", async () => {
      const formDef: IFormDefinition = {
        id: "test_max",
        fields: [
          {
            id: "max_100",
            dataType: FieldDataType.int,
            validity: [{ comparison: ComparisonType.lessThanOrEqualTo, value: 100 }],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect((schema.properties as any).max_100.maximum).to.equal(100);
    });
  });

  describe("Subform Handling", () => {
    it("should expand inline subform for object types", async () => {
      const formDef: IFormDefinition = {
        id: "test_inline_subform",
        fields: [
          {
            id: "object_with_subform",
            dataType: FieldDataType.object,
            subForm: {
              id: "subform",
              fields: [
                { id: "sub_string", dataType: FieldDataType.string },
                { id: "sub_number", dataType: FieldDataType.number },
              ],
            },
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const objProp = (schema.properties as any).object_with_subform;
      expect(objProp.type).to.equal("object");
      expect(objProp.properties).to.exist;
      expect(objProp.properties.sub_string.type).to.equal("string");
      expect(objProp.properties.sub_number.type).to.equal("number");
    });

    it("should expand inline subform for objectArray types", async () => {
      const formDef: IFormDefinition = {
        id: "test_array_subform",
        fields: [
          {
            id: "array_with_subform",
            dataType: FieldDataType.objectArray,
            subForm: {
              id: "subform",
              fields: [
                { id: "item_id", dataType: FieldDataType.string },
                { id: "item_count", dataType: FieldDataType.int },
              ],
            },
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const arrProp = (schema.properties as any).array_with_subform;
      expect(arrProp.type).to.equal("array");
      expect(arrProp.items.type).to.equal("object");
      expect(arrProp.items.properties).to.exist;
      expect(arrProp.items.properties.item_id.type).to.equal("string");
      expect(arrProp.items.properties.item_count.type).to.equal("integer");
    });
  });

  describe("Schema Metadata", () => {
    it("should include schema version and id", async () => {
      const formDef: IFormDefinition = {
        id: "test_metadata",
        title: "Test Schema",
        description: "A test schema for metadata validation",
        fields: [],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef, "/test/path.form.json");

      expect(schema.$schema).to.equal("http://json-schema.org/draft-07/schema#");
      expect(schema.$id).to.equal("/test/path.form.json");
      expect(schema.title).to.equal("Test Schema");
      expect(schema.description).to.equal("A test schema for metadata validation");
      expect(schema.type).to.equal("object");
    });

    it("should not include empty required array", async () => {
      const formDef: IFormDefinition = {
        id: "test_no_required",
        fields: [
          { id: "optional1", dataType: FieldDataType.string },
          { id: "optional2", dataType: FieldDataType.number },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect(schema.required).to.be.undefined;
    });
  });

  describe("SubFormId Resolution with $ref", () => {
    it("should resolve subFormId to $ref for object types", async () => {
      // Create a context with a mock form definition
      const formsBySubFormId: { [key: string]: IFormDefinition } = {
        "misc/floatrange": {
          id: "floatrange",
          title: "Float Range",
          fields: [
            { id: "min", dataType: FieldDataType.float },
            { id: "max", dataType: FieldDataType.float },
          ],
        },
      };

      const context = {
        formsBySubFormId,
        definitions: {},
        processingStack: new Set<string>(),
        processedDefs: new Set<string>(),
      };

      const formDef: IFormDefinition = {
        id: "test_subformid",
        fields: [
          {
            id: "damage_range",
            dataType: FieldDataType.object,
            subFormId: "misc/floatrange",
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef, undefined, context);

      // Should have $defs with the referenced form
      expect(schema.$defs).to.exist;
      expect(schema.$defs!["misc_floatrange"]).to.exist;
      expect((schema.$defs!["misc_floatrange"] as any).properties).to.exist;
      expect((schema.$defs!["misc_floatrange"] as any).properties.min.type).to.equal("number");
      expect((schema.$defs!["misc_floatrange"] as any).properties.max.type).to.equal("number");

      // Range subFormIds should generate anyOf with number, array, and $ref variants
      const damageRange = (schema.properties as any).damage_range;
      expect(damageRange.anyOf).to.exist;
      expect(damageRange.anyOf).to.have.length(3);
      expect(damageRange.anyOf[0].type).to.equal("number");
      expect(damageRange.anyOf[1].type).to.equal("array");
      expect(damageRange.anyOf[2].$ref).to.equal("#/$defs/misc_floatrange");
    });

    it("should resolve intrange subFormId to anyOf with integer variants", async () => {
      const formsBySubFormId: { [key: string]: IFormDefinition } = {
        "entity/intrange": {
          id: "intrange",
          title: "Int Range",
          fields: [
            { id: "min", dataType: FieldDataType.int },
            { id: "max", dataType: FieldDataType.int },
          ],
        },
      };

      const context = {
        formsBySubFormId,
        definitions: {},
        processingStack: new Set<string>(),
        processedDefs: new Set<string>(),
      };

      const formDef: IFormDefinition = {
        id: "test_intrange",
        fields: [
          {
            id: "count",
            dataType: FieldDataType.object,
            subFormId: "entity/intrange",
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef, undefined, context);

      const countField = (schema.properties as any).count;
      expect(countField.anyOf).to.exist;
      expect(countField.anyOf).to.have.length(3);
      expect(countField.anyOf[0].type).to.equal("integer");
      expect(countField.anyOf[1].type).to.equal("array");
      expect(countField.anyOf[1].items.type).to.equal("integer");
      expect(countField.anyOf[2].$ref).to.equal("#/$defs/entity_intrange");
    });

    it("should resolve subFormId to $ref for objectArray types", async () => {
      const formsBySubFormId: { [key: string]: IFormDefinition } = {
        "item/effect": {
          id: "effect",
          title: "Effect",
          fields: [
            { id: "effect_id", dataType: FieldDataType.string },
            { id: "duration", dataType: FieldDataType.int },
          ],
        },
      };

      const context = {
        formsBySubFormId,
        definitions: {},
        processingStack: new Set<string>(),
        processedDefs: new Set<string>(),
      };

      const formDef: IFormDefinition = {
        id: "test_array_subformid",
        fields: [
          {
            id: "effects",
            dataType: FieldDataType.objectArray,
            subFormId: "item/effect",
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef, undefined, context);

      // Should have $defs with the referenced form
      expect(schema.$defs).to.exist;
      expect(schema.$defs!["item_effect"]).to.exist;

      // Field should be array with items $ref
      const effectsProp = (schema.properties as any).effects;
      expect(effectsProp.type).to.equal("array");
      expect(effectsProp.items.$ref).to.equal("#/$defs/item_effect");
    });

    it("should reuse existing $defs for multiple references to same subFormId", async () => {
      const formsBySubFormId: { [key: string]: IFormDefinition } = {
        "misc/point": {
          id: "point",
          fields: [
            { id: "x", dataType: FieldDataType.float },
            { id: "y", dataType: FieldDataType.float },
          ],
        },
      };

      const context = {
        formsBySubFormId,
        definitions: {},
        processingStack: new Set<string>(),
        processedDefs: new Set<string>(),
      };

      const formDef: IFormDefinition = {
        id: "test_multiple_refs",
        fields: [
          { id: "start_point", dataType: FieldDataType.object, subFormId: "misc/point" },
          { id: "end_point", dataType: FieldDataType.object, subFormId: "misc/point" },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef, undefined, context);

      // Should have only one entry in $defs
      expect(schema.$defs).to.exist;
      expect(Object.keys(schema.$defs!).length).to.equal(1);
      expect(schema.$defs!["misc_point"]).to.exist;

      // Both fields should reference the same $def
      expect((schema.properties as any).start_point.$ref).to.equal("#/$defs/misc_point");
      expect((schema.properties as any).end_point.$ref).to.equal("#/$defs/misc_point");
    });

    it("should handle nested subFormId references", async () => {
      const formsBySubFormId: { [key: string]: IFormDefinition } = {
        "misc/inner": {
          id: "inner",
          fields: [{ id: "value", dataType: FieldDataType.string }],
        },
        "misc/outer": {
          id: "outer",
          fields: [{ id: "nested", dataType: FieldDataType.object, subFormId: "misc/inner" }],
        },
      };

      const context = {
        formsBySubFormId,
        definitions: {},
        processingStack: new Set<string>(),
        processedDefs: new Set<string>(),
      };

      const formDef: IFormDefinition = {
        id: "test_nested",
        fields: [{ id: "outer_field", dataType: FieldDataType.object, subFormId: "misc/outer" }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef, undefined, context);

      // Should have both inner and outer in $defs
      expect(schema.$defs).to.exist;
      expect(schema.$defs!["misc_outer"]).to.exist;
      expect(schema.$defs!["misc_inner"]).to.exist;

      // Outer should reference inner via $ref
      const outerDef = schema.$defs!["misc_outer"] as any;
      expect(outerDef.properties.nested.$ref).to.equal("#/$defs/misc_inner");
    });

    it("should resolve subFormId for keyedObjectCollection (entity component_groups pattern)", async () => {
      // This tests the pattern used by entity component_groups:
      // Each group (keyed by name) contains an object with component definitions
      const formsBySubFormId: { [key: string]: IFormDefinition } = {
        "entity/entity_component_definitions": {
          id: "component_definitions",
          title: "Entity Component Definitions",
          fields: [
            { id: "minecraft:health", dataType: FieldDataType.object, subFormId: "entity/minecraft_health" },
            { id: "minecraft:rideable", dataType: FieldDataType.object, subFormId: "entity/minecraft_rideable" },
          ],
        },
        "entity/minecraft_health": {
          id: "minecraft_health",
          title: "Health Component",
          fields: [
            { id: "value", dataType: FieldDataType.int },
            { id: "max", dataType: FieldDataType.int },
          ],
        },
        "entity/minecraft_rideable": {
          id: "minecraft_rideable",
          title: "Rideable Component",
          fields: [
            { id: "seat_count", dataType: FieldDataType.int },
            { id: "family_types", dataType: FieldDataType.stringArray },
          ],
        },
      };

      const context = {
        formsBySubFormId,
        definitions: {},
        processingStack: new Set<string>(),
        processedDefs: new Set<string>(),
      };

      const formDef: IFormDefinition = {
        id: "actor_document",
        fields: [
          {
            id: "component_groups",
            title: "Component Groups",
            dataType: FieldDataType.keyedObjectCollection,
            subFormId: "entity/entity_component_definitions",
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef, undefined, context);

      // component_groups should be object with additionalProperties pointing to $ref
      const componentGroupsProp = (schema.properties as any).component_groups;
      expect(componentGroupsProp.type).to.equal("object");
      expect(componentGroupsProp.additionalProperties).to.exist;
      expect(componentGroupsProp.additionalProperties.$ref).to.equal("#/$defs/entity_entity_component_definitions");

      // Should have the component definitions in $defs
      expect(schema.$defs).to.exist;
      expect(schema.$defs!["entity_entity_component_definitions"]).to.exist;

      // The component definitions should have properties for each component
      const componentDefsDef = schema.$defs!["entity_entity_component_definitions"] as any;
      expect(componentDefsDef.properties).to.exist;
      expect(componentDefsDef.properties["minecraft:health"]).to.exist;
      expect(componentDefsDef.properties["minecraft:rideable"]).to.exist;

      // Each component should reference its detailed form via $ref
      expect(componentDefsDef.properties["minecraft:health"].$ref).to.equal("#/$defs/entity_minecraft_health");
      expect(componentDefsDef.properties["minecraft:rideable"].$ref).to.equal("#/$defs/entity_minecraft_rideable");

      // The detailed component forms should be in $defs
      expect(schema.$defs!["entity_minecraft_health"]).to.exist;
      expect(schema.$defs!["entity_minecraft_rideable"]).to.exist;

      // Verify the health component structure
      const healthDef = schema.$defs!["entity_minecraft_health"] as any;
      expect(healthDef.properties.value.type).to.equal("integer");
      expect(healthDef.properties.max.type).to.equal("integer");

      // Verify the rideable component structure
      const rideableDef = schema.$defs!["entity_minecraft_rideable"] as any;
      expect(rideableDef.properties.seat_count.type).to.equal("integer");
      expect(rideableDef.properties.family_types.type).to.equal("array");
      expect(rideableDef.properties.family_types.items.type).to.equal("string");
    });
  });

  describe("Cycle Detection", () => {
    it("should handle direct self-reference cycles", async () => {
      // A form that references itself (e.g., a tree node)
      const formsBySubFormId: { [key: string]: IFormDefinition } = {
        "misc/treenode": {
          id: "treenode",
          title: "Tree Node",
          fields: [
            { id: "value", dataType: FieldDataType.string },
            { id: "children", dataType: FieldDataType.objectArray, subFormId: "misc/treenode" },
          ],
        },
      };

      const context = {
        formsBySubFormId,
        definitions: {},
        processingStack: new Set<string>(),
        processedDefs: new Set<string>(),
      };

      const formDef: IFormDefinition = {
        id: "test_self_ref",
        fields: [{ id: "root", dataType: FieldDataType.object, subFormId: "misc/treenode" }],
      };

      // Should not throw or loop infinitely
      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef, undefined, context);

      // Should have the definition
      expect(schema.$defs).to.exist;
      expect(schema.$defs!["misc_treenode"]).to.exist;

      // The children field in the definition should use $ref
      const treenodeDef = schema.$defs!["misc_treenode"] as any;
      expect(treenodeDef.properties.children.type).to.equal("array");
      expect(treenodeDef.properties.children.items.$ref).to.equal("#/$defs/misc_treenode");
    });

    it("should handle mutual reference cycles (A -> B -> A)", async () => {
      // Two forms that reference each other
      const formsBySubFormId: { [key: string]: IFormDefinition } = {
        "misc/person": {
          id: "person",
          fields: [
            { id: "name", dataType: FieldDataType.string },
            { id: "employer", dataType: FieldDataType.object, subFormId: "misc/company" },
          ],
        },
        "misc/company": {
          id: "company",
          fields: [
            { id: "company_name", dataType: FieldDataType.string },
            { id: "employees", dataType: FieldDataType.objectArray, subFormId: "misc/person" },
          ],
        },
      };

      const context = {
        formsBySubFormId,
        definitions: {},
        processingStack: new Set<string>(),
        processedDefs: new Set<string>(),
      };

      const formDef: IFormDefinition = {
        id: "test_mutual_ref",
        fields: [{ id: "person", dataType: FieldDataType.object, subFormId: "misc/person" }],
      };

      // Should not throw or loop infinitely
      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef, undefined, context);

      // Should have both definitions
      expect(schema.$defs).to.exist;
      expect(schema.$defs!["misc_person"]).to.exist;
      expect(schema.$defs!["misc_company"]).to.exist;

      // Both should use $ref for the circular reference
      const personDef = schema.$defs!["misc_person"] as any;
      const companyDef = schema.$defs!["misc_company"] as any;

      expect(personDef.properties.employer.$ref).to.equal("#/$defs/misc_company");
      expect(companyDef.properties.employees.items.$ref).to.equal("#/$defs/misc_person");
    });

    it("should handle triple cycle (A -> B -> C -> A)", async () => {
      const formsBySubFormId: { [key: string]: IFormDefinition } = {
        "misc/a": {
          id: "a",
          fields: [{ id: "next", dataType: FieldDataType.object, subFormId: "misc/b" }],
        },
        "misc/b": {
          id: "b",
          fields: [{ id: "next", dataType: FieldDataType.object, subFormId: "misc/c" }],
        },
        "misc/c": {
          id: "c",
          fields: [{ id: "next", dataType: FieldDataType.object, subFormId: "misc/a" }],
        },
      };

      const context = {
        formsBySubFormId,
        definitions: {},
        processingStack: new Set<string>(),
        processedDefs: new Set<string>(),
      };

      const formDef: IFormDefinition = {
        id: "test_triple_cycle",
        fields: [{ id: "start", dataType: FieldDataType.object, subFormId: "misc/a" }],
      };

      // Should not throw or loop infinitely
      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef, undefined, context);

      // Should have all three definitions
      expect(schema.$defs).to.exist;
      expect(schema.$defs!["misc_a"]).to.exist;
      expect(schema.$defs!["misc_b"]).to.exist;
      expect(schema.$defs!["misc_c"]).to.exist;

      // C should reference back to A via $ref
      const cDef = schema.$defs!["misc_c"] as any;
      expect(cDef.properties.next.$ref).to.equal("#/$defs/misc_a");
    });
  });

  describe("Alternates Handling", () => {
    it("should generate anyOf when field has alternates", async () => {
      // A field with alternates should generate an anyOf containing all variants
      // (We use anyOf instead of oneOf to avoid "matches multiple schemas" warnings)
      const formDef: IFormDefinition = {
        id: "test_alternates",
        fields: [
          {
            id: "flexible_value",
            dataType: FieldDataType.string,
            alternates: [{ id: "flexible_value", dataType: FieldDataType.int }],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).flexible_value;
      expect(prop.anyOf).to.exist;
      expect(prop.anyOf).to.have.length(2);
      expect(prop.anyOf[0].type).to.equal("string");
      expect(prop.anyOf[1].type).to.equal("integer");
    });

    it("should handle multiple alternates generating anyOf with all variants", async () => {
      const formDef: IFormDefinition = {
        id: "test_multi_alternates",
        fields: [
          {
            id: "multi_type",
            dataType: FieldDataType.string,
            alternates: [
              { id: "multi_type", dataType: FieldDataType.int },
              { id: "multi_type", dataType: FieldDataType.boolean },
            ],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).multi_type;
      expect(prop.anyOf).to.exist;
      expect(prop.anyOf).to.have.length(3);
      expect(prop.anyOf[0].type).to.equal("string");
      expect(prop.anyOf[1].type).to.equal("integer");
      expect(prop.anyOf[2].type).to.equal("boolean");
    });

    it("should handle alternates with object types", async () => {
      const formDef: IFormDefinition = {
        id: "test_object_alternates",
        fields: [
          {
            id: "value_or_object",
            dataType: FieldDataType.number,
            alternates: [{ id: "value_or_object", dataType: FieldDataType.object }],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).value_or_object;
      expect(prop.anyOf).to.exist;
      expect(prop.anyOf).to.have.length(2);
      expect(prop.anyOf[0].type).to.equal("number");
      expect(prop.anyOf[1].type).to.equal("object");
    });

    it("should deduplicate anyOf entries when alternates produce duplicates", async () => {
      // When alternates include types that already exist, they should be deduplicated
      const formDef: IFormDefinition = {
        id: "test_dedup_alternates",
        fields: [
          {
            id: "dup_field",
            dataType: FieldDataType.number,
            alternates: [
              { id: "dup_field", dataType: FieldDataType.number }, // duplicate
              { id: "dup_field", dataType: FieldDataType.string },
            ],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).dup_field;
      expect(prop.anyOf).to.exist;
      // Should only have 2 options (number and string), not 3
      expect(prop.anyOf).to.have.length(2);
      expect(prop.anyOf[0].type).to.equal("number");
      expect(prop.anyOf[1].type).to.equal("string");
    });

    it("should add string type for keyedStringCollection with numeric alternates (Molang heuristic)", async () => {
      // When a keyedStringCollection has numeric alternates, add string type for Molang support
      const formDef: IFormDefinition = {
        id: "test_molang_heuristic",
        fields: [
          {
            id: "num_particles",
            dataType: FieldDataType.keyedStringCollection,
            alternates: [{ id: "num_particles", dataType: FieldDataType.float }],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).num_particles;
      expect(prop.anyOf).to.exist;
      // Should have: keyedStringCollection (object), string (Molang), and float (number)
      const types = prop.anyOf.map((s: any) => s.type);
      expect(types).to.include("object"); // keyedStringCollection
      expect(types).to.include("string"); // Molang string support
      expect(types).to.include("number"); // float alternate
    });
  });

  describe("Boolean with String Choices", () => {
    it("should create oneOf for boolean field with non-boolean string choices", async () => {
      // When a boolean field has string choices like "yes"/"no"/"maybe",
      // it should create a oneOf with boolean and string with enum
      const formDef: IFormDefinition = {
        id: "test_bool_string_choices",
        fields: [
          {
            id: "deals_damage",
            dataType: FieldDataType.boolean,
            choices: [
              { id: "yes", title: "Yes" },
              { id: "no", title: "No" },
              { id: "no_but_side_effects_apply", title: "No But Side Effects Apply" },
            ],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).deals_damage;
      expect(prop.oneOf).to.exist;
      expect(prop.oneOf).to.have.length(2);
      expect(prop.oneOf[0].type).to.equal("boolean");
      expect(prop.oneOf[1].type).to.equal("string");
      expect(prop.oneOf[1].enum).to.deep.equal(["yes", "no", "no_but_side_effects_apply"]);
    });

    it("should not create oneOf for boolean with only true/false choices", async () => {
      // When choices are just "true"/"false", don't wrap in oneOf
      const formDef: IFormDefinition = {
        id: "test_bool_only_choices",
        fields: [
          {
            id: "simple_bool",
            dataType: FieldDataType.boolean,
            choices: [
              { id: "true", title: "True" },
              { id: "false", title: "False" },
            ],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).simple_bool;
      // Should be simple boolean type without oneOf
      expect(prop.type).to.equal("boolean");
      expect(prop.oneOf).to.be.undefined;
    });
  });

  describe("SubFormId Helper Functions", () => {
    it("should convert subFormId to valid definition name", () => {
      expect(JsonSchemaGenerator.subFormIdToDefName("misc/floatrange")).to.equal("misc_floatrange");
      expect(JsonSchemaGenerator.subFormIdToDefName("entity/components/health")).to.equal("entity_components_health");
      expect(JsonSchemaGenerator.subFormIdToDefName("block-types/stone")).to.equal("block_types_stone");
    });
  });

  describe("ScalarField Handling", () => {
    it("should emit anyOf with scalar number type for forms with scalarField", async () => {
      const formDef: IFormDefinition = {
        id: "minecraft:friction",
        title: "Friction",
        description: "Describes the friction for this block.",
        fields: [],
        scalarField: {
          id: "number",
          title: "Friction value",
          dataType: FieldDataType.number,
        },
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect(schema.anyOf).to.exist;
      expect(schema.anyOf).to.have.length(2);
      expect((schema.anyOf![0] as any).type).to.equal("number");
      expect((schema.anyOf![1] as any).type).to.equal("object");
      // Should not have top-level type since we're using anyOf
      expect(schema.type).to.be.undefined;
    });

    it("should emit anyOf with scalar string type for forms with string scalarField", async () => {
      const formDef: IFormDefinition = {
        id: "minecraft:loot",
        title: "Loot",
        fields: [],
        scalarField: {
          id: "loot_table",
          title: "Loot table path",
          dataType: FieldDataType.string,
        },
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      expect(schema.anyOf).to.exist;
      expect(schema.anyOf).to.have.length(2);
      expect((schema.anyOf![0] as any).type).to.equal("string");
      expect((schema.anyOf![1] as any).type).to.equal("object");
    });
  });

  describe("New Mixed-Type Array Types", () => {
    it("should map stringOrObjectArray to array with oneOf items (string or object)", async () => {
      // Used for animation references like ["animation.walk", { "animation.jump": "query.is_jumping" }]
      const formDef: IFormDefinition = {
        id: "test_string_or_object_array",
        fields: [
          {
            id: "animate",
            dataType: FieldDataType.stringOrObjectArray,
            subForm: {
              id: "animation_ref",
              fields: [{ id: "animation_name", dataType: FieldDataType.string }],
            },
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).animate;
      expect(prop.type).to.equal("array");
      expect(prop.items).to.exist;
      expect(prop.items.oneOf).to.exist;
      expect(prop.items.oneOf).to.have.length(2);

      // First option should be string
      expect(prop.items.oneOf[0].type).to.equal("string");
      // Second option should be object
      expect(prop.items.oneOf[1].type).to.equal("object");
    });

    it("should map stringOrObjectArray with default additionalProperties when no subForm", async () => {
      const formDef: IFormDefinition = {
        id: "test_string_or_object_array_default",
        fields: [{ id: "animate", dataType: FieldDataType.stringOrObjectArray }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).animate;
      expect(prop.type).to.equal("array");
      expect(prop.items.oneOf).to.exist;
      expect(prop.items.oneOf[1].type).to.equal("object");
      // Should have additionalProperties for Molang-style objects
      expect(prop.items.oneOf[1].additionalProperties).to.exist;
    });

    it("should map stringNumberTupleArray to array of [string, number] tuples", async () => {
      // Used for weighted lists like generate_for_climates: [["medium", 1], ["cold", 2]]
      const formDef: IFormDefinition = {
        id: "test_tuple_array",
        fields: [{ id: "generate_for_climates", dataType: FieldDataType.stringNumberTupleArray }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).generate_for_climates;
      expect(prop.type).to.equal("array");
      expect(prop.items).to.exist;
      expect(prop.items.type).to.equal("array");
      expect(prop.items.items).to.be.an("array");
      expect(prop.items.items).to.have.length(2);
      expect(prop.items.items[0].type).to.equal("string");
      expect(prop.items.items[1].type).to.equal("number");
      expect(prop.items.minItems).to.equal(2);
      expect(prop.items.maxItems).to.equal(2);
    });

    it("should map stringOrObject to oneOf with string and object", async () => {
      const formDef: IFormDefinition = {
        id: "test_string_or_object",
        fields: [
          {
            id: "animation_ref",
            dataType: FieldDataType.stringOrObject,
            subForm: {
              id: "conditional_animation",
              fields: [{ id: "condition", dataType: FieldDataType.molang }],
            },
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).animation_ref;
      expect(prop.oneOf).to.exist;
      expect(prop.oneOf).to.have.length(2);
      expect(prop.oneOf[0].type).to.equal("string");
      expect(prop.oneOf[1].type).to.equal("object");
    });
  });

  describe("Event Trigger Array Flattening", () => {
    it("should create flattened oneOf for minecraftEventTriggerArray (string | object | array)", async () => {
      // minecraftEventTriggerArray should produce: string | object | array
      // NOT: oneOf[oneOf[string, object], array] which confuses validators
      const formDef: IFormDefinition = {
        id: "test_trigger_array",
        fields: [
          {
            id: "triggers",
            dataType: FieldDataType.minecraftEventTriggerArray,
            subForm: {
              id: "trigger",
              fields: [
                { id: "event", dataType: FieldDataType.string },
                { id: "target", dataType: FieldDataType.string },
              ],
            },
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).triggers;
      // Should be an array with items that can be string or object
      expect(prop.type).to.equal("array");
      expect(prop.items).to.exist;
      expect(prop.items.oneOf).to.exist;
      expect(prop.items.oneOf).to.have.length(2);

      // First option: string (event name directly)
      expect(prop.items.oneOf[0].type).to.equal("string");

      // Second option: object (trigger object with event/target)
      expect(prop.items.oneOf[1].type).to.equal("object");
      expect(prop.items.oneOf[1].properties).to.exist;
      expect(prop.items.oneOf[1].properties.event).to.exist;
    });

    it("should map twoDMolangArray to array of arrays with mixed string/number items", async () => {
      // Used for gradient colors like: [[1.0, 0.5, 0.5, 1.0], ["variable.color", 0.5, 0.5, 1.0]]
      const formDef: IFormDefinition = {
        id: "test_2d_molang_array",
        fields: [{ id: "gradient", dataType: FieldDataType.twoDMolangArray }],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).gradient;
      expect(prop.type).to.equal("array");
      expect(prop.items).to.exist;
      expect(prop.items.type).to.equal("array");
      expect(prop.items.items).to.exist;
      expect(prop.items.items.oneOf).to.exist;
      expect(prop.items.items.oneOf).to.have.length(2);
      expect(prop.items.items.oneOf[0].type).to.equal("string");
      expect(prop.items.items.oneOf[1].type).to.equal("number");
    });
  });

  describe("additionalPropertiesOf Support", () => {
    it("should override additionalProperties based on additionalPropertiesOf dataType", async () => {
      // This tests the additionalPropertiesOf property which allows specifying the value type
      // for keyed collections separately from the collection type.
      // Example use case: particle events where keys are event names and values are Molang arrays
      const formDef: IFormDefinition = {
        id: "test_additional_properties_of",
        fields: [
          {
            id: "events",
            dataType: FieldDataType.keyedObjectCollection, // dataType 14
            additionalPropertiesOf: FieldDataType.molangArray, // dataType 35
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).events;
      expect(prop.type).to.equal("object");
      expect(prop.additionalProperties).to.exist;
      // additionalPropertiesOf should override the default additionalProperties
      // molangArray generates array with oneOf items
      expect(prop.additionalProperties.type).to.equal("array");
      expect(prop.additionalProperties.items).to.exist;
      expect(prop.additionalProperties.items.oneOf).to.exist;
      expect(prop.additionalProperties.items.oneOf).to.have.length(2);
      expect(prop.additionalProperties.items.oneOf[0].type).to.equal("string");
      expect(prop.additionalProperties.items.oneOf[1].type).to.equal("number");
    });

    it("should work with additionalPropertiesOf for various value types", async () => {
      const formDef: IFormDefinition = {
        id: "test_additional_properties_of_types",
        fields: [
          {
            id: "string_values",
            dataType: FieldDataType.keyedObjectCollection,
            additionalPropertiesOf: FieldDataType.string,
          },
          {
            id: "number_values",
            dataType: FieldDataType.keyedObjectCollection,
            additionalPropertiesOf: FieldDataType.number,
          },
          {
            id: "boolean_values",
            dataType: FieldDataType.keyedObjectCollection,
            additionalPropertiesOf: FieldDataType.boolean,
          },
          {
            id: "string_array_values",
            dataType: FieldDataType.keyedObjectCollection,
            additionalPropertiesOf: FieldDataType.stringArray,
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      // String values
      const strProp = (schema.properties as any).string_values;
      expect(strProp.type).to.equal("object");
      expect(strProp.additionalProperties.type).to.equal("string");

      // Number values
      const numProp = (schema.properties as any).number_values;
      expect(numProp.type).to.equal("object");
      expect(numProp.additionalProperties.type).to.equal("number");

      // Boolean values
      const boolProp = (schema.properties as any).boolean_values;
      expect(boolProp.type).to.equal("object");
      expect(boolProp.additionalProperties.type).to.equal("boolean");

      // String array values
      const strArrProp = (schema.properties as any).string_array_values;
      expect(strArrProp.type).to.equal("object");
      expect(strArrProp.additionalProperties.type).to.equal("array");
      expect(strArrProp.additionalProperties.items.type).to.equal("string");
    });

    it("should not apply additionalPropertiesOf to non-object types", async () => {
      // additionalPropertiesOf should only affect schema.type === "object"
      const formDef: IFormDefinition = {
        id: "test_additional_properties_of_non_object",
        fields: [
          {
            id: "string_with_additional",
            dataType: FieldDataType.string,
            additionalPropertiesOf: FieldDataType.molangArray, // Should be ignored
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).string_with_additional;
      expect(prop.type).to.equal("string");
      expect(prop.additionalProperties).to.not.exist;
    });
  });

  describe("Rich Descriptions with Samples", () => {
    it("should include sample values in field descriptions", async () => {
      const formDef: IFormDefinition = {
        id: "test_samples_in_description",
        fields: [
          {
            id: "speed_multiplier",
            title: "Speed Multiplier",
            description: "Movement speed multiplier applied to the mob.",
            dataType: FieldDataType.float,
            samples: {
              "/entities/sheep.json": [{ path: "/components/speed_multiplier", content: 1.0 }],
              "/entities/wolf.json": [{ path: "/components/speed_multiplier", content: 1.5 }],
            },
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).speed_multiplier;
      expect(prop.description).to.exist;
      expect(prop.description).to.include("Movement speed multiplier");
      expect(prop.description).to.include("Sample values");
      expect(prop.description).to.include("sheep");
      expect(prop.description).to.include("1");
    });

    it("should include version and deprecation info in descriptions", async () => {
      const formDef: IFormDefinition = {
        id: "test_version_deprecated",
        fields: [
          {
            id: "new_feature",
            description: "A new feature.",
            dataType: FieldDataType.boolean,
            versionIntroduced: "1.20.0",
          },
          {
            id: "old_feature",
            description: "An old feature.",
            dataType: FieldDataType.boolean,
            versionDeprecated: "1.19.0",
            isDeprecated: true,
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const newProp = (schema.properties as any).new_feature;
      expect(newProp.description).to.include("Introduced in version 1.20.0");

      const oldProp = (schema.properties as any).old_feature;
      expect(oldProp.description).to.include("Deprecated since 1.19.0");
    });

    it("should hide samples when hideSamples is true", async () => {
      const formDef: IFormDefinition = {
        id: "test_hide_samples",
        fields: [
          {
            id: "priority",
            description: "The AI goal priority.",
            dataType: FieldDataType.int,
            hideSamples: true,
            samples: {
              "/entities/sheep.json": [{ path: "/priority", content: 5 }],
            },
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).priority;
      expect(prop.description).to.equal("The AI goal priority.");
      expect(prop.description).to.not.include("Sample values");
    });

    it("should include choice descriptions in field description", async () => {
      const formDef: IFormDefinition = {
        id: "test_choice_descriptions",
        fields: [
          {
            id: "difficulty",
            description: "The game difficulty.",
            dataType: FieldDataType.stringEnum,
            choices: [
              { id: "peaceful", title: "Peaceful", description: "No hostile mobs spawn" },
              { id: "easy", title: "Easy", description: "Mobs deal less damage" },
              { id: "normal", title: "Normal", description: "Standard difficulty" },
            ],
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      const prop = (schema.properties as any).difficulty;
      expect(prop.description).to.include("Values:");
      expect(prop.description).to.include("Peaceful");
      expect(prop.description).to.include("No hostile mobs spawn");
    });

    it("should replace 'Dynamic value' placeholder with description from referenced subform", async () => {
      // Create a context with a referenced form that has a real description
      const formsBySubFormId: { [key: string]: IFormDefinition } = {
        "entity/minecraft_rideable": {
          id: "minecraft_rideable",
          description: "This entity can be ridden",
          fields: [{ id: "seat_count", dataType: FieldDataType.int }],
        },
      };

      const context = {
        formsBySubFormId,
        definitions: {},
        processingStack: new Set<string>(),
        processedDefs: new Set<string>(),
      };

      const formDef: IFormDefinition = {
        id: "test_dynamic_value_placeholder",
        fields: [
          {
            id: "minecraft:rideable",
            description: "Dynamic value",
            dataType: FieldDataType.object,
            subFormId: "entity/minecraft_rideable",
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef, undefined, context);

      // The property should have the referenced form's description, not "Dynamic value"
      const prop = (schema.properties as any)["minecraft:rideable"];
      expect(prop.$ref).to.equal("#/$defs/entity_minecraft_rideable");

      // The definition should have the description from the referenced form
      const def = (schema.$defs as any)["entity_minecraft_rideable"];
      expect(def.description).to.equal("This entity can be ridden");
    });

    it("should extract description from summarizer when form has no description", async () => {
      // Create a context with a referenced form that has a summarizer but no description
      const formsBySubFormId: { [key: string]: IFormDefinition } = {
        "entity/minecraft_physics": {
          id: "minecraft_physics",
          summarizer: {
            phrases: [
              {
                tokens: [{ type: "literal", text: "has physical properties" }],
              },
            ],
          },
          fields: [{ id: "has_collision", dataType: FieldDataType.boolean }],
        },
      };

      const context = {
        formsBySubFormId,
        definitions: {},
        processingStack: new Set<string>(),
        processedDefs: new Set<string>(),
      };

      const formDef: IFormDefinition = {
        id: "test_summarizer_description",
        fields: [
          {
            id: "minecraft:physics",
            description: "Dynamic value",
            dataType: FieldDataType.object,
            subFormId: "entity/minecraft_physics",
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef, undefined, context);

      // The definition should have a description extracted from the summarizer
      const def = (schema.$defs as any)["entity_minecraft_physics"];
      expect(def.description).to.equal("Has physical properties");
    });

    it("should identify placeholder descriptions correctly", () => {
      expect(JsonSchemaGenerator.isPlaceholderDescription("Dynamic value")).to.be.true;
      expect(JsonSchemaGenerator.isPlaceholderDescription("TODO")).to.be.true;
      expect(JsonSchemaGenerator.isPlaceholderDescription("TBD")).to.be.true;
      expect(JsonSchemaGenerator.isPlaceholderDescription("This entity can be ridden")).to.be.false;
      expect(JsonSchemaGenerator.isPlaceholderDescription("")).to.be.false;
      expect(JsonSchemaGenerator.isPlaceholderDescription(undefined)).to.be.false;
    });
  });

  describe("cleanFieldId", () => {
    it("should extract clean property name from embedded enum syntax", () => {
      // Form.json files sometimes encode enum values in field IDs like:
      // render_distance_type"<"fixed", "render"
      expect(JsonSchemaGenerator.cleanFieldId('render_distance_type"<"fixed", "render"')).to.equal(
        "render_distance_type"
      );
      expect(JsonSchemaGenerator.cleanFieldId('type"<"a", "b", "c"')).to.equal("type");
    });

    it("should return the original ID when no embedded syntax exists", () => {
      expect(JsonSchemaGenerator.cleanFieldId("normal_property")).to.equal("normal_property");
      expect(JsonSchemaGenerator.cleanFieldId("identifier")).to.equal("identifier");
      expect(JsonSchemaGenerator.cleanFieldId("minecraft:component")).to.equal("minecraft:component");
    });

    it("should handle undefined and empty strings", () => {
      expect(JsonSchemaGenerator.cleanFieldId(undefined)).to.be.undefined;
      expect(JsonSchemaGenerator.cleanFieldId("")).to.equal("");
    });

    it("should use cleaned field IDs when generating schema properties", async () => {
      // Test that schema properties are generated with cleaned field IDs
      const formDef: IFormDefinition = {
        id: "test_clean_ids",
        fields: [
          {
            id: 'render_distance_type"<"fixed", "render"',
            dataType: FieldDataType.string,
            title: "Render Distance Type",
          },
        ],
      };

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(formDef);

      // Property key should be cleaned
      expect((schema.properties as any)["render_distance_type"]).to.exist;
      expect((schema.properties as any)['render_distance_type"<"fixed", "render"']).to.not.exist;
    });
  });
});

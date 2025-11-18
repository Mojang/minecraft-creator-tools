// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z, ZodTypeAny } from "zod";
import Utilities from "../core/Utilities";
import Database from "../minecraft/Database";
import IField, { FieldDataType } from "./IField";
import IFormDefinition from "./IFormDefinition";
import DataFormUtilities from "./DataFormUtilities";

export default class DataFormZod {
  public static getZodSchema(formDefinition: IFormDefinition) {
    const cache = new WeakMap<IFormDefinition, ZodTypeAny>();

    return DataFormZod.buildZodSchema(formDefinition, cache);
  }

  private static buildZodSchema(
    formDefinition: IFormDefinition,
    cache: WeakMap<IFormDefinition, ZodTypeAny>
  ): ZodTypeAny {
    if (cache.has(formDefinition)) {
      return cache.get(formDefinition)!;
    }

    const placeholder = z.lazy(() => cache.get(formDefinition) ?? z.unknown());
    cache.set(formDefinition, placeholder);

    const fieldSchemas: { [key: string]: ZodTypeAny } = {};

    if (Array.isArray(formDefinition.fields)) {
      for (const field of formDefinition.fields) {
        if (
          !field ||
          !field.id ||
          !Utilities.isUsableAsObjectKey(field.id) ||
          field.id === "__scalar" ||
          field.id.indexOf("<") >= 0 ||
          field.id.indexOf(">") >= 0
        ) {
          continue;
        }

        fieldSchemas[field.id] = DataFormZod.getFieldSchema(field, cache);
      }
    }

    const baseObject = z.object(fieldSchemas);

    const objectSchema: ZodTypeAny = formDefinition.customField
      ? baseObject.catchall(
          DataFormZod.getFieldSchema(formDefinition.customField, cache, {
            skipOptionalWrap: true,
          })
        )
      : baseObject.passthrough();

    let finalSchema: ZodTypeAny = objectSchema;

    if (formDefinition.scalarField && !formDefinition.scalarFieldUpgradeName) {
      const scalarSchema = DataFormZod.getFieldSchema(formDefinition.scalarField, cache, {
        skipOptionalWrap: true,
      });
      finalSchema = finalSchema.or(scalarSchema);
    }

    cache.set(formDefinition, finalSchema);

    return finalSchema;
  }

  private static getFieldSchema(
    field: IField,
    cache: WeakMap<IFormDefinition, ZodTypeAny>,
    options?: { skipOptionalWrap?: boolean }
  ): ZodTypeAny {
    const variants = DataFormUtilities.getFieldAndAlternates(field);
    const schemas: ZodTypeAny[] = [];

    for (const variant of variants) {
      const schema = DataFormZod.getSingleFieldSchema(variant, cache);

      if (schema) {
        schemas.push(schema);
      }
    }

    let combined = DataFormZod.combineSchemas(schemas);

    if (!options?.skipOptionalWrap) {
      const isRequired = variants.some((variant) => variant.isRequired);

      if (!isRequired) {
        combined = combined.optional();
      }
    }

    return combined;
  }

  private static combineSchemas(schemas: ZodTypeAny[]): ZodTypeAny {
    if (!schemas.length) {
      return z.unknown();
    }

    let combined = schemas[0];

    for (let i = 1; i < schemas.length; i++) {
      combined = combined.or(schemas[i]);
    }

    return combined;
  }

  private static getSingleFieldSchema(field: IField, cache: WeakMap<IFormDefinition, ZodTypeAny>): ZodTypeAny {
    switch (field.dataType) {
      case FieldDataType.boolean:
        return z.boolean();
      case FieldDataType.intBoolean: {
        const booleanNumber = DataFormZod.createNumberSchema(field, { integer: true }).min(0).max(1);
        return booleanNumber.or(z.boolean());
      }
      case FieldDataType.int:
      case FieldDataType.intEnum:
      case FieldDataType.intValueLookup: {
        if (field.dataType === FieldDataType.intEnum && field.choices && field.choices.length > 0) {
          const numericChoices = field.choices
            .map((choice) => choice.id)
            .filter((id): id is number => typeof id === "number");

          if (numericChoices.length > 0) {
            let literalSchema: ZodTypeAny = z.literal(numericChoices[0]);

            for (let i = 1; i < numericChoices.length; i++) {
              literalSchema = literalSchema.or(z.literal(numericChoices[i]));
            }

            return literalSchema;
          }
        }

        return DataFormZod.createNumberSchema(field, { integer: true });
      }
      case FieldDataType.float:
      case FieldDataType.number:
      case FieldDataType.long:
        return DataFormZod.createNumberSchema(field);
      case FieldDataType.percentRange:
        return DataFormZod.createRangeSchema(field, { clamp01: true });
      case FieldDataType.intRange:
        return DataFormZod.createRangeSchema(field, { integer: true });
      case FieldDataType.floatRange:
        return DataFormZod.createRangeSchema(field);
      case FieldDataType.stringEnum: {
        if (field.choices && field.choices.length > 0) {
          const stringChoices = field.choices
            .map((choice) => choice.id)
            .filter((id): id is string => typeof id === "string");

          if (stringChoices.length > 0) {
            return z.enum(stringChoices as [string, ...string[]]);
          }
        }

        return DataFormZod.createStringSchema(field);
      }
      case FieldDataType.string:
      case FieldDataType.stringLookup:
      case FieldDataType.longFormString:
      case FieldDataType.molang:
      case FieldDataType.localizableString:
        return DataFormZod.createStringSchema(field);
      case FieldDataType.uuid:
        return DataFormZod.createStringSchema(field).uuid();
      case FieldDataType.longFormStringArray:
      case FieldDataType.stringArray:
      case FieldDataType.checkboxListAsStringArray:
      case FieldDataType.molangArray:
        return DataFormZod.createArraySchema(z.string(), field);
      case FieldDataType.twoDStringArray:
        return DataFormZod.createArraySchema(z.array(z.string()), field);
      case FieldDataType.numberArray:
        return DataFormZod.createArraySchema(z.number(), field);
      case FieldDataType.point2:
        return DataFormZod.createVectorSchema(2, field);
      case FieldDataType.point3:
        return DataFormZod.createVectorSchema(3, field);
      case FieldDataType.intPoint3:
      case FieldDataType.location:
      case FieldDataType.locationOffset:
        return DataFormZod.createVectorSchema(3, field, { integer: field.dataType === FieldDataType.intPoint3 });
      case FieldDataType.keyedStringCollection:
        return z.record(z.string());
      case FieldDataType.keyedBooleanCollection:
        return z.record(z.boolean());
      case FieldDataType.keyedStringArrayCollection:
        return z.record(z.array(z.string()));
      case FieldDataType.keyedNumberCollection:
        return z.record(z.number());
      case FieldDataType.keyedNumberArrayCollection:
        return z.record(z.array(z.number()));
      case FieldDataType.arrayOfKeyedStringCollection:
        return DataFormZod.createArraySchema(z.record(z.string()), field);
      case FieldDataType.keyedKeyedStringArrayCollection:
        return z.record(z.record(z.array(z.string())));
      case FieldDataType.keyedObjectCollection: {
        const subSchema = DataFormZod.getSubFormSchema(field, cache) ?? z.record(z.unknown());
        return z.record(subSchema);
      }
      case FieldDataType.objectArray: {
        const subSchema = DataFormZod.getSubFormSchema(field, cache) ?? z.record(z.unknown());
        return DataFormZod.createArraySchema(subSchema, field);
      }
      case FieldDataType.object: {
        return DataFormZod.getSubFormSchema(field, cache) ?? z.record(z.unknown());
      }
      case FieldDataType.minecraftFilter:
      case FieldDataType.minecraftEventTrigger:
        return z.record(z.unknown());
      case FieldDataType.minecraftEventTriggerArray:
        return DataFormZod.createArraySchema(z.record(z.unknown()), field);
      case FieldDataType.minecraftEventReference:
        return DataFormZod.createStringSchema(field);
      case FieldDataType.version: {
        const tupleSchema = z.tuple([z.number().int(), z.number().int(), z.number().int()]);
        return z.string().or(z.number()).or(tupleSchema);
      }
      default:
        return z.unknown();
    }
  }

  private static createNumberSchema(field: IField, options?: { integer?: boolean; clamp01?: boolean }) {
    let schema = options?.integer ? z.number().int() : z.number();

    if (options?.clamp01) {
      schema = schema.min(0).max(1);
    }

    if (field.minValue !== undefined) {
      schema = schema.min(field.minValue);
    }

    if (field.maxValue !== undefined) {
      schema = schema.max(field.maxValue);
    }

    return schema;
  }

  private static createStringSchema(field: IField) {
    let schema = z.string();

    if (field.minLength !== undefined) {
      schema = schema.min(field.minLength);
    }

    if (field.maxLength !== undefined) {
      schema = schema.max(field.maxLength);
    }

    return schema;
  }

  private static createArraySchema(elementType: ZodTypeAny, field: IField) {
    let schema = z.array(elementType);

    if (field.fixedLength !== undefined) {
      schema = schema.length(field.fixedLength);
    } else {
      if (field.minLength !== undefined) {
        schema = schema.min(field.minLength);
      }

      if (field.maxLength !== undefined) {
        schema = schema.max(field.maxLength);
      }
    }

    return schema;
  }

  private static createRangeSchema(field: IField, options?: { integer?: boolean; clamp01?: boolean }) {
    const numberSchema = DataFormZod.createNumberSchema(field, options);
    const tupleSchema = z.tuple([numberSchema, numberSchema]);
    const objectSchema = z.object({
      min: numberSchema.optional(),
      max: numberSchema.optional(),
    });

    return numberSchema.or(tupleSchema).or(objectSchema);
  }

  private static createVectorSchema(dimension: number, field: IField, options?: { integer?: boolean }): ZodTypeAny {
    const numberFactory = () => DataFormZod.createNumberSchema(field, { integer: options?.integer });

    if (dimension === 2) {
      const tupleSchema = z.tuple([numberFactory(), numberFactory()]);
      const objectSchema = z
        .object({
          x: numberFactory(),
          y: numberFactory(),
        })
        .passthrough();
      const altObjectSchema = z
        .object({
          a: numberFactory(),
          b: numberFactory(),
        })
        .passthrough();

      return tupleSchema.or(objectSchema).or(altObjectSchema);
    }

    if (dimension === 3) {
      const tupleSchema = z.tuple([numberFactory(), numberFactory(), numberFactory()]);
      const objectSchema = z
        .object({
          x: numberFactory(),
          y: numberFactory(),
          z: numberFactory(),
        })
        .passthrough();

      return tupleSchema.or(objectSchema);
    }

    return z.array(numberFactory()).length(dimension);
  }

  private static getSubFormSchema(field: IField, cache: WeakMap<IFormDefinition, ZodTypeAny>): ZodTypeAny | undefined {
    let subForm = field.subForm;

    if (!subForm && field.subFormId) {
      subForm = Database.getFormByPath(field.subFormId);
    }

    if (!subForm) {
      return undefined;
    }

    return DataFormZod.buildZodSchema(subForm, cache);
  }
}

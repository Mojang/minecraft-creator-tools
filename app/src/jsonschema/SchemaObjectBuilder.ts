import { JSONSchema6, JSONSchema7 } from "json-schema";
import {
  Definition,
  findBestOneOf,
  Reference,
  resolveReferenceFromPath,
} from "../UX/shared/components/SchemaForm/SchemaParser";
import { UIDefinition } from "../UX/shared/components/SchemaForm/UISchema";

type JsonSchema = JSONSchema7 | JSONSchema6;
type DynamicObject = Record<string, unknown>;

export const buildObjectFromSchema = (schema: JsonSchema, initialValues?: DynamicObject) => {
  const definitions = Object.entries(schema.definitions || []);
  const obj: DynamicObject = buildObject(schema, definitions, initialValues);

  return obj;
};

function buildObject(schema: JsonSchema, references: Reference[], initialValues?: DynamicObject): DynamicObject {
  if (schema.type !== "object") {
    throw new Error("Only objects supported at this time.");
  }

  const obj: DynamicObject = {};

  const properties = Object.entries(schema.properties || []);

  for (const [name, prop] of properties) {
    obj[name] = buildProperty(prop, references);
  }

  if (initialValues) {
    Object.assign(obj, initialValues);
  }

  return obj;
}

export function buildProperty(
  prop: Definition | null,
  references: Reference[],
  parent?: Definition,
  uiDef?: UIDefinition | null
): unknown {
  if (!!prop?.$ref) {
    const resolved = resolveReferenceFromPath(prop.$ref, references);
    prop = resolved?.definition || null;
  }

  const options = prop?.oneOf || prop?.anyOf;
  if (!!options) {
    const bestOneOf = findBestOneOf(options, references, parent);
    if (!!bestOneOf) {
      const { definition: oneOfDef } = bestOneOf;
      return buildProperty(oneOfDef, references);
    }
  }

  if (!prop) {
    return {
      error: true,
      message: `[buildProperty]  Unexpected Failure determining type | prop is null`,
    };
  }

  if (!!prop.enum) {
    return prop.default ?? prop.enum[0];
  }

  if (!prop.type) {
    //This helps handle the MC specific case where we do the bool as object pattern, which does not get a type in schema
    return undefined;
  }

  switch (prop.type) {
    case "string":
    case "number":
    case "integer":
    case "boolean":
      return prop.default;
    case "array":
      return [];
    case "object":
      return buildObject(prop, references);
  }

  return { error: true, message: `[buildProperty] Failure | type: ${prop?.type} | ref: ${prop.$ref}` };
}

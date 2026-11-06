// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { JSONSchema7 } from "json-schema";

/**
 * Adapts JSON schemas for the "json-schema" package validator, which implements draft-03.
 * The official and community schemas are written for later drafts, and two keywords behave
 * differently there:
 *
 * - "default": the validator writes defaults into the instance it checks. That throws when
 *   an object schema meets a value of another type (for example a string entry in a sound
 *   definition's "sounds" list) and stops validation of the rest of the file.
 * - "required": draft-03 treats any truthy "required" as "this property must be present", so
 *   a later-draft list such as `"required": ["offset", "scale"]` on an optional object
 *   reports that object as missing. The listed names have never been checked: draft-03 has no
 *   list form. Enforcing them would add errors on valid content, because some official lists
 *   are stricter than the game (vanilla trade tiers omit "groups", and some vanilla render
 *   controllers omit "materials").
 *
 * Neither keyword is used to report real problems, so both are removed.
 */

const validatorSchemas = new WeakMap<object, JSONSchema7>();

// Keywords whose value maps names to schemas, so a keyword-named key there is a property name.
const SCHEMA_MAP_KEYWORDS = new Set(["properties", "patternProperties", "definitions", "$defs", "dependencies"]);

// Keywords whose value is literal data rather than a schema.
const LITERAL_KEYWORDS = new Set(["enum", "const", "examples"]);

function adaptSchema(value: any, isSchemaMap: boolean): any {
  if (Array.isArray(value)) {
    return value.map((entry) => adaptSchema(entry, false));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const result: { [key: string]: any } = {};

  for (const key of Object.keys(value)) {
    if (isSchemaMap) {
      result[key] = adaptSchema(value[key], false);
    } else if (LITERAL_KEYWORDS.has(key)) {
      result[key] = value[key];
    } else if (key === "default" || (key === "required" && Array.isArray(value[key]))) {
      continue;
    } else {
      result[key] = adaptSchema(value[key], SCHEMA_MAP_KEYWORDS.has(key));
    }
  }

  return result;
}

/**
 * Returns a cached copy of the schema that the json-schema validator checks correctly.
 */
export function getValidatorSchema(schema: JSONSchema7): JSONSchema7 {
  let adapted = validatorSchemas.get(schema);

  if (!adapted) {
    adapted = adaptSchema(schema, false) as JSONSchema7;
    validatorSchemas.set(schema, adapted);
  }

  return adapted;
}

import { JSONSchema4, JSONSchema6, JSONSchema7, validate } from "json-schema";

export type ValidationError = {
  message: string;
};

type UnvalidatedJson = any | undefined | null;
type AcceptedSchemas = JSONSchema4 | JSONSchema6 | JSONSchema7;

type ValidationSuccess<T> = [T, null];
type ValidationFail = [null, ValidationError[]];
/*
  uses schema to validate a json object and if valid, returns it with the type asserted

  returns a tuple of [value, errors].
  If errors is null, then value will be a valid value with type T
  otherwise errors will be an array and value will be null
*/
export function validateJsonAndAssert<T>(
  json: UnvalidatedJson,
  schema: AcceptedSchemas
): ValidationSuccess<T> | ValidationFail {
  if (!json || typeof json !== "object") {
    return [null, [{ message: "Could not parse json" }]];
  }

  const validation = validate(json, schema);

  return validation.valid ? [json, null] : [null, validation.errors];
}

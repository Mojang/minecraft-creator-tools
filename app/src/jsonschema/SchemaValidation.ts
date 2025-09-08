import { JSONSchema4, JSONSchema6, JSONSchema7, validate } from "json-schema";
import { ZodType } from "zod";

export type ValidationError = {
  message: string;
  propertyName?: string;
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
  schema: AcceptedSchemas | ZodType,
  transforms: ((jsonObj: any) => any)[] = []
): ValidationSuccess<T> | ValidationFail {
  const [result, errors] =
    schema instanceof ZodType ? zodValidateSchema<T>(json, schema) : jsonschemaValidateSchema<T>(json, schema);

  if (errors) {
    return [null, errors];
  }

  let obj = result;
  for (const transform of transforms) {
    obj = transform(obj);
  }

  return [obj, null];
}

function jsonschemaValidateSchema<T>(
  json: UnvalidatedJson,
  schema: AcceptedSchemas,
  transforms: ((jsonObj: any) => any)[] = []
): ValidationSuccess<T> | ValidationFail {
  if (!json || typeof json !== "object") {
    return [null, [{ message: "Could not parse json" }]];
  }

  const validation = validate(json, schema);

  return validation.valid ? [json, null] : [null, validation.errors];
}

function zodValidateSchema<T>(json: any, schema: ZodType): ValidationSuccess<T> | ValidationFail {
  const parseResult = schema.safeParse(json);
  if (!parseResult.success) {
    const errors = parseResult.error.errors.map((error) => ({
      message: error.message,
      propertyName: error.path.join("/"),
    }));
    return [null, errors];
  }

  return [parseResult.data, null];
}

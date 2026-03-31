import {
  JSONSchema6,
  JSONSchema6Definition,
  JSONSchema6TypeName,
  JSONSchema7,
  JSONSchema7Definition,
  JSONSchema7TypeName,
} from "json-schema";
import Log from "../../../../core/Log";
import DynamicObject from "./DynamicObject";

// This supports the most crucial (for our purposes) feature of the 2020 schema (https://json-schema.org/draft/2020-12)
// TODO: consider importing a package with a more complete definition, for now this is sufficient
type JsonSchema2020Draft = { $defs: Definition[] };

export type JsonSchema = (JSONSchema7 | JSONSchema6) & JsonSchema2020Draft;
export type HierarchyEntry = { key: string; title?: string; isArrayItem?: boolean; schemaKey?: string };
export type Hierarchy = HierarchyEntry[];
export type KeyedDefinition = [string, Definition];
export type Definition = JSONSchema7 | JSONSchema6;
// Similiar to definition but more complete (i.e. includes booleans),
// Full schema definition including boolean schemas, we generally want to strip out booleans when possible
export type FullDefinition = Definition | boolean;
export type Property = [string, Definition];
// represents the cursive context, will expand
export type Context = {
  hierarchy: Hierarchy;
  required: Map<string, boolean>;
  references: KeyedDefinition[];
  size?: "default" | "small";
};

const retryLimit = 10;

export type OneOfType = number | "uichoice" | "object" | "array" | "string" | "number";
// A definition stored stored in the "definitions" section of the schema and referenced via .$ref
// using the name Reference to differentiate between "normal" defintions and because they are (almost?) always used as an indirect reference
export type Reference = [string, Definition];

export function getValueByHierarchy(object: DynamicObject, hierarchy: Hierarchy) {
  return hierarchy.reduce<any>((prev, entry) => prev && descend(prev, entry), object);
}

function descend(object: any, entry: HierarchyEntry): unknown {
  if (!object) {
    Log.debug("[descend]: attempted to descend into undefined object: " + entry);
    return undefined;
  }

  return object[entry.key];
}

export const updateObjectByHierarchy = (object: DynamicObject, value: unknown, hierarchy: Hierarchy) => {
  const ref = hierarchy.slice(0, hierarchy.length - 1).reduce<any>((obj, entry) => obj[entry.key], object);

  const key = hierarchy[hierarchy.length - 1]?.key;
  if (!key) {
    throw new Error("[updateObjectByHierarchy]: Failed to find valid key when updating object by hierarchy");
  }

  ref[key] = value;
};

/*
  Similar to update but will insert objects as necessary
*/
export function insertIntoObjectByHierarchy(object: DynamicObject, value: unknown, hierarchy: Hierarchy) {
  let current: any = object;
  for (let i = 0; i < hierarchy.length; ++i) {
    const entry = hierarchy[i];
    if (i === hierarchy.length - 1) {
      current[entry.key] = value;
      return;
    }

    if (current[entry.key] === undefined) {
      const hasItems = hierarchy[i + 1]?.isArrayItem;
      current[entry.key] = hasItems ? [] : {};
    }

    current = current[entry.key];
  }
}

export const minimize = (input: object | unknown[]) => {
  return Array.isArray(input) ? minimizeArray(input) : minimizeObject(input);
};

const minimizeArray = (input: unknown[]) => {
  if (!input || !input.length) {
    return undefined;
  }

  const output: unknown[] = [];
  input.forEach((item, index) => {
    if (Array.isArray(item)) {
      output[index] = minimizeArray(item);
    } else if (typeof item === "object") {
      output[index] = minimizeObject(item);
    } else {
      output[index] = item;
    }
  });

  return output;
};

const minimizeObject = (input: object | null, removeEmptyObjects: boolean = false) => {
  if (!input) {
    return undefined;
  }

  // short-circuit the check if N/A
  const removeRemoveDueToEmpty =
    removeEmptyObjects &&
    Object.values(input).every((value) => value === undefined || (Array.isArray(value) && !value.length));

  if (removeRemoveDueToEmpty) {
    return undefined;
  }

  const output: DynamicObject = {};
  Object.entries(input).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      output[key] = minimizeArray(value);
    } else if (typeof value === "object") {
      output[key] = minimizeObject(value);
    } else {
      output[key] = value;
    }
  });

  return output;
};

export function arrayToLookup<TValue>(arr: TValue[]) {
  return arr.reduce((dic, val) => dic.set(val, true), new Map<TValue, boolean>());
}

export function expandContext(context: Context, options?: { entry?: HierarchyEntry; required?: string[] }): Context {
  return {
    ...context,
    hierarchy: !!options?.entry ? [...context.hierarchy, options?.entry] : context.hierarchy,
    required: options?.required ? arrayToLookup(options?.required || []) : context.required,
  };
}

export const getFullKey = (hierarchy: Hierarchy, limit?: number) => {
  return hierarchy
    .slice(0, (limit ?? hierarchy.length) + 1)
    .reduce((value, entry) => value + (value && ".") + entry.key, "");
};

export const resolveProperty = (property: Property, context: Context): Property => {
  const [key, definition] = property;
  const resolved = resolveDefinition(definition, context.references);

  return [key, resolved.definition];
};

// resolves references without choosing from oneOfs, will instead return a list of definitions based on oneOfs
export const resolveReferences = (definition: FullDefinition, references: Reference[]) => {
  const narrowedDef = definition;
  if (typeof narrowedDef === "boolean") {
    throw new Error("bools not supported");
  }

  let lookupDefinition = narrowedDef;
  let lookupKey = undefined;
  for (let tries = 0; !!lookupDefinition.$ref; tries += 1) {
    const reference = lookupReference(lookupDefinition.$ref, references);
    if (!!reference) {
      const [key, def] = reference;
      lookupKey = key;
      lookupDefinition = def;
    }

    if (tries++ >= retryLimit) {
      throw new Error(`Failed to resolve references`);
    }
  }

  let lookupOneOfs: Definition[] = [];
  const options = lookupDefinition.oneOf || lookupDefinition.anyOf;
  if (!!options?.length) {
    lookupOneOfs = options.map((def) => resolveReferences(def, references)).map((x) => x.definition);
  }

  return {
    definition: lookupDefinition,
    schemaKey: lookupKey,
    oneOfs: lookupOneOfs,
  };
};

// attempts to resolve to one definition, by choosing the best available oneOfs where applicable
export const resolveDefinition = (definition: FullDefinition, references: Reference[], oneOfChoice?: number) => {
  let counter = 0;

  // const lets us narrow the type
  const narrowedDef = definition;
  if (typeof narrowedDef === "boolean") {
    throw new Error("bools not supported");
  }

  let lookupDefinition = narrowedDef;
  let lookupKey = undefined;
  while (!!lookupDefinition.oneOf || !!lookupDefinition.$ref) {
    if (!!lookupDefinition.oneOf?.length) {
      let foundDefinition: FullDefinition | undefined;
      if (oneOfChoice) {
        foundDefinition = lookupDefinition.oneOf[oneOfChoice];
      } else {
        const result = findBestOneOf(lookupDefinition.oneOf, references);
        foundDefinition = result?.definition;
      }

      if (!!foundDefinition) {
        if (typeof foundDefinition === "boolean") {
          throw new Error("boolean not supported", { cause: foundDefinition });
        }

        lookupDefinition = foundDefinition;
      }
    }

    // try get ref
    if (!!lookupDefinition.$ref) {
      if (lookupDefinition.$ref.endsWith(".json")) {
        throw new Error("external references not supported: " + lookupDefinition.$ref);
      }

      const reference = lookupReference(lookupDefinition.$ref, references);
      if (!!reference) {
        const [key, def] = reference;
        lookupKey = key;
        lookupDefinition = def;
      }
    }

    if (counter++ >= retryLimit) {
      throw new Error(`Failed to resolve references`);
    }
  }

  return {
    schemaKey: lookupKey,
    definition: lookupDefinition,
  };
};

// OBSOLETE: replaced by `determineOneOf` - still used in a couple cases, those should be removed soon
//
// sorts OneOf options to return the single 'best' option.
//
// More versatile, comprehensive options are preferred
// e.g. `int[]` is preferred over a single `int`, since int can be represented as a list of one
export function findBestOneOf(
  oneOfs: JSONSchema7Definition[] | JSONSchema6Definition[] | undefined,
  references: Reference[],
  parent?: Definition
) {
  if (!oneOfs) {
    return null;
  }

  const sorted = oneOfs
    .map((item) => resolveDefinition(item, references))
    .map((ref) => ({ rank: rankOneOf(ref.definition, parent), ref }))
    .sort((refA, refB) => refB.rank - refA.rank)
    .map((value) => value.ref);

  return sorted[0];
}

//removes bools
export function isSchemaDefinition(definition: FullDefinition): definition is Definition {
  return typeof definition !== "boolean";
}

function rankOneOf(definition: JSONSchema7Definition | JSONSchema6Definition, parent?: Definition) {
  if (typeof definition === "boolean") {
    return 0;
  }

  if (!!definition && definition === parent) {
    return 1;
  }

  let score = 0;

  if (definition.type === "array") {
    score += 1000;
    score += rankType(definition.items);
  } else {
    score = rankType(definition.type);
  }

  return score;
}

function rankType(
  type:
    | boolean
    | undefined
    | string
    | JSONSchema6TypeName
    | JSONSchema7TypeName
    | JSONSchema6TypeName[]
    | JSONSchema7TypeName[]
    | JSONSchema7
    | JSONSchema6
    | JSONSchema7Definition[]
    | JSONSchema6Definition[]
) {
  // an array of types in this context likely means an array with mixed types allowed
  // we want to avoid these (for now)...
  if (!type || type === "boolean" || Array.isArray(type)) {
    return 0;
  }
  if (type === "object") {
    return 100;
  }
  if (type === "string") {
    return 80;
  }

  return 10;
}

export function resolveReferenceFromPath(referencePath: string, references: Reference[]) {
  const reference = lookupReference(referencePath, references);
  if (!reference) {
    return null;
  }

  const [, def] = reference;
  const resolved = resolveDefinition(def, references);

  return resolved;
}

function lookupReference(referencePath: string, references: Reference[]): Property | null {
  const definitionName = extractNameFromReferencePath(referencePath);

  const reference = references.find(([name]) => name === definitionName) || null;
  return reference;
}

function extractNameFromReferencePath(referencePath: string) {
  const index = referencePath.lastIndexOf("/");
  return index < 0 ? null : referencePath.substring(index + 1);
}

/* 
Picks a single definition from among supplied `oneOfs` based on a static set of criteria.

The criteria attempts to determine the flexible definition, for example if oneOfs allow for an object or an array of objects,
then the array should be preferred as the array as it is more versatile option - an array of one item is roughly equivalent to the single item, 
but a single object does not allow for multiple items. 

*/
export function pickBestOneOf(oneOfs: Definition[]) {
  let bestDef = oneOfs.find((candidate) => candidate.type === "array");
  if (!!bestDef) {
    return bestDef;
  }

  bestDef = oneOfs.find((candidate) => candidate.type === "object");
  if (!!bestDef) {
    return bestDef;
  }

  bestDef = oneOfs.find((candidate) => candidate.type === "string");
  if (!!bestDef) {
    return bestDef;
  }

  bestDef = oneOfs.find((candidate) => candidate.type === "number");
  if (!!bestDef) {
    return bestDef;
  }

  bestDef = oneOfs.find(
    (candidate) => typeof candidate.type === "string" && candidate.type !== "null" && candidate.type !== "any"
  );
  if (!!bestDef) {
    return bestDef;
  }

  Log.debug("Defaulting oneOf type.");
  return oneOfs[0];
}

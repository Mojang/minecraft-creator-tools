/*
  search in given object for property names, returns first property name not found, or undefined if nothing found
*/
export function findMissingProperty<TObject>(obj: TObject, keys: (keyof TObject)[]): keyof TObject | undefined {
  return keys.find((key) => !obj[key]);
}

/*
  search in given object for property names, returns all property names not found
*/
export function allMissingProperties<TObject>(obj: TObject, keys: (keyof TObject)[]): (keyof TObject)[] {
  return keys.filter((key) => !obj[key]);
}

/*
 return true if the given value is truthey, while asserting the type
 can be used in filters etc to remove nulls in a way the compiler accepts
*/
export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return !!value;
}

// Convert a single snake_case string to camelCase at the type level
type SnakeToCamelCase<S extends string> = S extends `${infer T}_${infer U}`
  ? `${Lowercase<T>}${Capitalize<SnakeToCamelCase<U>>}`
  : Lowercase<S>;

/*
    Converts a type to a similar type, but with snake_case property names converted to camelCase
    handles primitives, nested objects, arrays, and optional arrays
  */
export type CamelCase<T> = {
  [K in keyof T as K extends string ? SnakeToCamelCase<K> : K]: T[K] extends Array<infer U> | undefined // optional array case
    ? Array<CamelCase<U>> | undefined
    : T[K] extends Array<infer U> // regular array
    ? Array<CamelCase<U>>
    : T[K] extends object // nested object
    ? CamelCase<T[K]>
    : T[K];
};

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

//modifies an object such that its property names are converted from snake_case to camelCase
export function convertKeysToCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  } else if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [toCamelCase(key), convertKeysToCamelCase(value)])
    );
  }
  return obj;
}

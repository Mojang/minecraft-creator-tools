// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface IAnnotatedValue {
  value: string;
  annotation: string | undefined;
}

export class AnnotatedValueSet {
  static includes(values: IAnnotatedValue[], search: string) {
    for (const val of values) {
      if (val.value === search) {
        return true;
      }
    }

    return false;
  }
  static getValues(values: IAnnotatedValue[] | undefined) {
    if (values === undefined) {
      return undefined;
    }

    const vals: string[] = [];

    for (const val of values) {
      vals.push(val.value);
    }

    return vals;
  }
}

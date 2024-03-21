// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default class ComponentBase {
  id?: string;
  [propertyId: string]: string | number | number[] | bigint | bigint[] | boolean | object | undefined;
}

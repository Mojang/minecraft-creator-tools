// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IComponent {
  [propertyId: string]:
    | IComponent
    | IComponent[]
    | string[]
    | string
    | number
    | number[]
    | bigint
    | bigint[]
    | boolean
    | object
    | undefined;
}

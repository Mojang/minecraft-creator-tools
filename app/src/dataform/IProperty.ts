// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IProperty {
  id: string | undefined;
  value: string | number | number[] | bigint | bigint[] | boolean | undefined;
}

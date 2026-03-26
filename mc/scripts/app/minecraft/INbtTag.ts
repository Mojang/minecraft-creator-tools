// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default class INbtTag {
  type?: number = 99;
  name?: string;
  value?: string | number | bigint | bigint[] | number[] | boolean | null;
  childTagType?: number;
  children?: INbtTag[];
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IBlockTypeDescription {
  identifier: string;
  category?: string;
  register_to_creative_menu?: boolean;
  properties?: { [id: string]: number[] };
  components?: { [id: string]: object };
  permutations?: { [id: string]: object };
}

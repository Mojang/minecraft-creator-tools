// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IBlockTraits from "./IBlockTraits";

export default interface IBlockTypeDescription {
  identifier: string;
  category?: string;
  register_to_creative_menu?: boolean;
  properties?: { [id: string]: number[] | string[] | boolean[] | undefined };
  components?: { [id: string]: object };
  permutations?: { [id: string]: object };
  states?: { [id: string]: number[] | string[] | boolean[] | undefined };
  traits?: IBlockTraits;
}

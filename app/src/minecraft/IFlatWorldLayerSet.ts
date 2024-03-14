// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFlatWorldLayer from "./IBlockLayer";

export default interface IFlatWorldLayerSet {
  biome_id: number;
  block_layers: IFlatWorldLayer[];
  encoding_version: number;
  structure_options: any | null;
  world_version: string;
}

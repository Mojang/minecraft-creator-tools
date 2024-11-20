// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface ISoundDefinitionCatalog {
  format_version: string;
  sound_definitions: { [name: string]: ISoundDefinition };

  // note there is a format that is just:
  // {
  //   "ns:mysound.foo" : {
  //     "sounds": [
  //        "name": "sounds/foo"
  //     ]
  //   }
  // }
}

export interface ISoundDefinition {
  category?: string;
  __use_legacy_max_distance?: string; // but it's boolean values in a string: "true", "false"
  max_distance?: number;
  min_distance?: number;
  sounds: (ISoundReference | string)[];
}

export interface ISoundReference {
  name: string;
  is3D?: boolean;
  stream?: boolean;
  volume?: number;
  weight?: number;
  pitch?: number;
  load_on_low_memory?: boolean;
}

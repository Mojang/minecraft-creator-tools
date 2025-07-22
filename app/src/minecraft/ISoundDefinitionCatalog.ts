// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { z } from "zod";

export interface ISoundDefinitionCatalog {
  format_version: string;
  sound_definitions: { [name: string]: ISoundDefinition };

  // note there is a format that is just:
  // {
  //   "ns:mysound.foo" : {
  //     "category": "foo",
  //     "sounds": [
  //        "name": "sounds/foo"
  //     ]
  //   }
  // }
}

export interface ISoundDefinition {
  category?: string;
  __use_legacy_max_distance?: string | boolean; // when it's a string, it's boolean values in a string: "true", "false"
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

// SoundReference zod schema
const SoundReferenceSchema = z.object({
  name: z.string(),
  is3D: z.boolean().optional(),
  stream: z.boolean().optional(),
  volume: z.number().optional(),
  weight: z.number().optional(),
  pitch: z.number().optional(),
  load_on_low_memory: z.boolean().optional(),
});

// SoundDefinition zod schema
const SoundDefinitionSchema = z.object({
  category: z.string().optional(),
  __use_legacy_max_distance: z.union([z.literal("true"), z.literal("false"), z.boolean()]).optional(),
  max_distance: z.number().optional(),
  min_distance: z.number().optional(),
  sounds: z.array(z.union([z.string(), SoundReferenceSchema])),
});

// Catalog w/ format_version zod schema
const CatalogWithFormatVersionSchema = z.object({
  format_version: z.string(),
  sound_definitions: z.record(z.string(), SoundDefinitionSchema),
});

// Flat Catalog zod Schema
const FlatCatalogEntrySchema = z.object({
  sounds: z.array(
    z.union([
      z.string(),
      z.object({
        name: z.string(),
      }),
    ])
  ),
});

// Catalog w/o format_version
const CatalogWithoutFormatVersionSchema = z.record(z.string(), FlatCatalogEntrySchema);

// Union of both forms for runtime validation
export const SoundDefinitionCatalogSchema = z.union([
  CatalogWithFormatVersionSchema,
  CatalogWithoutFormatVersionSchema,
]);

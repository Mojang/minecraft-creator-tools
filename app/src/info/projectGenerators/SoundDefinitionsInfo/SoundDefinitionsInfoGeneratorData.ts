// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** A valid sound_definitions.json using the versioned format. */
export const VALID_SOUND_DEFINITIONS_JSON = JSON.stringify({
  format_version: "1.17.20",
  sound_definitions: {
    "mob.creeper.say": {
      category: "neutral",
      sounds: ["sounds/mob/creeper/say1", "sounds/mob/creeper/say2"],
    },
  },
});

/**
 * A JSON string that parses successfully but fails both Zod catalog schemas.
 * The value for "bad_sound" is a string instead of a FlatCatalogEntry object.
 */
export const INVALID_SCHEMA_SOUND_DEFINITIONS_JSON = JSON.stringify({ bad_sound: "not_an_object" });

/** A string that is not valid JSON — triggers soundsDefinitionManifestInvalidJson. */
export const UNPARSEABLE_SOUND_DEFINITIONS_CONTENT = "this is not valid json {{{{";

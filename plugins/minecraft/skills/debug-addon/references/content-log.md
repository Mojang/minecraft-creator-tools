# Reading the Content Log

Validation checks files; the Content Log shows what Minecraft itself rejected while loading a world. When the user says something "doesn't work" in game and validation is clean, ask them to turn it on and paste what it shows:

1. In Minecraft, open **Settings > Creator** and turn on **Content Log GUI** (and **Content Log File** to keep a copy).
2. Re-open the world. Errors appear on screen; the full list is under **Settings > Creator > Content Log History**.
3. Copy the lines that mention their namespace or pack and paste them into the chat.

## How to read a line

Lines look roughly like `[Category][severity]-<file or identifier> | <location in the JSON> | <message>`. The category says which system complained, and the middle part usually points at the exact file and property. Fix errors before warnings, and fix the first error for a file first; later ones are often side effects.

| What the line says                                               | Usual cause                                                                                                   | Fix                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `child 'minecraft:xyz' not valid here`                           | Component misspelled, in the wrong section, or not supported by the file's `format_version`                   | Check spelling and placement against the Learn reference for that component; raise `format_version` only if the component needs it |
| Geometry `... not found` / `unable to find geometry`             | `geometry.default` (or `minecraft:geometry`) doesn't match any `.geo.json` identifier                         | Make the names match exactly                                                                                                       |
| Texture missing / `could not find texture`                       | Path wrong, has a `.png` extension, or the key isn't in `item_texture.json`/`terrain_texture.json`            | Use a path relative to the resource pack root without extension; register the key                                                  |
| `[Molang]` error                                                 | Expression syntax (quotes, `q.`/`v.` prefixes, missing semicolons in multi-statement scripts)                 | Fix the expression at the location shown                                                                                           |
| `[Recipes]` error                                                | Unknown item in `key`/`result`, or pattern rows of different lengths                                          | Check identifiers and pattern shape                                                                                                |
| `[Scripting]` module/version errors                              | Manifest script dependency version doesn't match what the game provides, or it needs the Beta APIs experiment | Match the `@minecraft/server` version to the game; for beta versions, enable **Beta APIs** in the world's experiments              |
| Something `requires the experimental toggle` / is experimental   | The content uses a feature that's only on with an experiment                                                  | Turn on that experiment in the world settings, or avoid the feature for release                                                    |
| `Unknown ... identifier` in a loot table, spawn rule, or feature | Typo or wrong namespace                                                                                       | Correct the identifier; confirm the referenced file exists                                                                         |

## Works in Minecraft Preview but not in the regular game

Preview runs a newer version. Check `min_engine_version` in each manifest and any `format_version` or script module version that's newer than the player's game version, and lower them to what the regular release supports.

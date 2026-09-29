# Common validation issues and how to fix them

Each entry uses the check ID shown in brackets by `validate-summary.mjs` (for example `[CPACKICON]`). For checks not listed here, open `https://learn.microsoft.com/minecraft/creator/reference/content/mctoolsvalreference/<check id in lowercase>`.

## Errors

### CPACKICON - pack icon missing or wrong size

- **"pack_icon image file not found"**: every pack needs `pack_icon.png` next to its `manifest.json`. Run `scripts/make-pack-icon.mjs <pack-folder>` for a placeholder, or save a real image there.
- **"pack_icon must be square with size 2, 4, ... 256"**: the icon must be square with a power-of-two size. Replace it (`make-pack-icon.mjs <pack-folder> --overwrite`) or resize the user's image. Copying a mob texture as the icon usually fails this check because entity textures are rarely square.
- **"Found multiple pack icon files"**: keep one `pack_icon.png` per pack.

### CHKMANIF - manifest problems

- **"must conform to format version [2]"**: the message doesn't name the file, so check every `manifest.json` in the project and set `"format_version": 2`. Keep `header.version`, `header.min_engine_version`, and each `modules[].version` as three-number arrays such as `[1, 0, 0]`.
- Duplicate or invalid UUIDs: every `header.uuid` and `modules[].uuid` must be a valid, unique UUID across all packs. Generate new ones rather than copying from another pack.
- Dependencies: a behavior pack that needs its resource pack lists it under `dependencies` with the resource pack's `header.uuid` and `header.version`. Only add the dependency in that direction; don't make the resource pack depend back on the behavior pack.

## Warnings

### PACKDEP - pack dependency points at nothing (checked by validate-summary.mjs, not the CLI)

- A `dependencies[].uuid` in a manifest doesn't match any pack's `header.uuid` in the project, so enabling the behavior pack no longer brings its resource pack along. Set the dependency's `uuid` (and `version`) to the other pack's `header.uuid` and `header.version`.
- This happens when manifests are copied between projects, and when `createMinecraftContent` adds content to an existing project (it rewrites the behavior pack's dependency).

### UNLINK - reference to something that isn't in the project

- Pointing at your own namespace (for example `geometry.demo.goblin`, `demo:shell`): real bug. Common causes are a typo, a file that was renamed, or a geometry identifier that doesn't match. Compare the name in the message with the `identifier` inside the target file and make them match.
- Pointing at `minecraft:...`: usually expected, because vanilla items and blocks live outside the project. The summary script lists these under "vanilla references". Check the spelling of each one; a typo such as `minecraft:stik` produces the same warning and is a real bug.
- "Link to item type is not found" for one of your own blocks (for example a block used in a recipe): expected, since blocks can be used as items. The summary script lists these as likely noise too.

### COMJSON / JSON - file doesn't match the schema

- Read the `detail` line; it names the property and what was expected. Fix typos, wrong types (number vs string), and misplaced properties.
- `(format_version) does not have a value in the enumeration ...`: set `format_version` to one of the listed values.
- Likely noise (Bedrock accepts these): `textures` as a single string in `item_texture.json`/`terrain_texture.json`, and a missing `uv_anim` in render controllers.

### FORMATVER - format_version newer than this file type supports

- For example spawn rules only accept `1.8.0`, `1.10.0`, or `1.12.0`. Use the expected version from the message.

## Recommendations (optional)

### MINENGINEVER, FORMATVER, ENTITYTYPE, ITEMTYPE - older versions

- The file uses an older `format_version` or `min_engine_version` than current Minecraft. Content still loads.
- `fix setnewestminengineversion` updates manifests. Update other files' `format_version` by hand only when upgrading, one file type at a time, and re-validate, since newer formats sometimes rename or restructure components.

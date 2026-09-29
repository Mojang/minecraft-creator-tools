---
name: design-model
description: Design or change how things look in a Minecraft Bedrock Edition add-on - 3D models and textures for mobs, and pixel-art icons for items and textures for blocks. Use this whenever someone wants to reshape, restyle, recolor, or retexture a mob, or redraw an item icon or block texture, for example "make my goblin look like a mushroom", "give the dragon bigger wings", "draw a purple hammer icon", or "make my ore texture look more sparkly". Also use it after create-mob, create-item, or create-block when the user described a specific look. Custom 3D shapes for blocks and held items aren't supported yet. Not for Minecraft Java Edition models or Blockbench plugin work.
---

# Design a model or texture

Minecraft Creator Tools can build a mob model and its texture from a JSON design, save both into the resource pack, and return a preview image you can look at. Iterate on the design until it matches what the user asked for, then connect the mob to it: the tool writes files but doesn't update the content that should use them. For items and blocks, this skill covers flat textures (icons and block faces) only.

Custom 3D block shapes and 3D held items need extra wiring (block `minecraft:geometry` and material instances, item attachables) that this skill doesn't cover yet. If the user asks for one, say so and offer a textured regular block or a flat item icon instead.

## 1. Find the target

- **Existing content:** find its identifier and pack. For a mob, open `resource_packs/<pack>/entity/<id>.entity.json` and note `geometry.default` and `textures.default`. For an item icon or block texture, note its path in `textures/item_texture.json` or `textures/terrain_texture.json` and skip to step 5.
- **New content:** create it first with create-mob, create-item, or create-block, then come back here.

## 2. Start from a template (mobs)

Call `getModelTemplates` with the closest mob `templateType` (for example `humanoid`, `small_animal`, `large_animal`, `bird`, `insect`, `golem`, `wizard`, `ghost`, `robot`; the tool lists them all). Templates have Minecraft-correct proportions, and adjusting one is far more reliable than writing geometry from scratch.

Things to know when editing a design:

- Set the design's `identifier` to the mob's ID without the namespace (`swamp_goblin`). The geometry is named `geometry.<identifier>`; templates start with placeholders such as `custom_humanoid`.
- 16 units = 1 block. A player is about 32 units tall.
- `textures` is a dictionary of named materials (a generated background such as `stipple_noise` plus colors). Cubes refer to them by name, so recoloring usually means changing these colors only.
- `bones` hold cubes (`origin`, `size`, optional `pivot` and `rotation`). If the mob already has animations, keep existing bone names so they still apply.

## 3. Build it with `designModel`

Pass:

- `projectPath`: the project root (the folder with `resource_packs/`).
- `modelId`: the mob's ID without the namespace (`swamp_goblin`). It sets the file names, so they land next to the existing ones.
- `usage`: `entity`.
- `design`: your edited template, with `identifier` set as above.

The tool writes the `.geo.json` and texture, then returns a preview image. Look at it critically: proportions, colors, missing parts. Call `designModel` again with the same `modelId` to update in place. Two or three rounds is usually enough; show the user the preview and ask before going further.

The tool also saves the editable design under `<project>/design_packs/` and preview images under `<project>/.mct/previews/`. Leave `design_packs/` in place so later edits update the same model (the previews can be deleted or ignored in git). Neither folder is included when the add-on is exported.

## 4. Make sure the content uses the new model

`designModel` doesn't update the mob, and mobs made by `createMinecraftContent` refer to `geometry.<namespace>.<id>`, while the new model is named `geometry.<identifier>`. Check the client entity file:

- `geometry.default` must equal the `identifier` in the new `.geo.json`. If it doesn't, the mob is invisible in game. Validation reports this as an `UNLINK` warning.
- `textures.default` must point at the texture path the tool reported (no `.png` extension).

Fix whichever side is easier; usually changing `geometry.default` in the client entity.

## 5. Icons and flat textures (pixel art)

For item icons and block faces, draw pixel art with `writeImageFileFromPixelArt`: 16 strings of 16 characters, a palette mapping each character to a color, and spaces for transparency. Save over the existing texture path (`textures/items/<id>.png` or `textures/blocks/<id>.png`) so nothing else needs to change. `writeImageFileFromSvg` suits crisp geometric designs.

These image tools only write inside folders the user has allowed. If a tool says image writing isn't authorized, explain that it needs `<project>/.mct/mcp/prefs.json` containing:

```json
{ "allowImageFileWritesInDescendentFolders": true }
```

Ask the user before creating that file; it's their permission switch. Pass fully resolved absolute paths: the tools reject paths that go through a symlink, such as `/tmp` on macOS (use `/private/tmp`).

## 6. Check existing models without editing them

To see a model that wasn't made with `designModel`:

```bash
npx -y @minecraft/creator-tools@latest rendermodel <file>.geo.json <output>.png -i <project-folder> --no-vanilla
```

This uses a headless browser and takes a few seconds. If it fails because no browser is available, skip it and rely on the file contents.

## 7. Validate

Follow the debug-addon skill to run validation and fix anything the new files broke. Pay attention to `UNLINK` warnings about geometry or textures.

## 8. Tell the user

Show the final preview, list the files written or changed, and say what you'd tweak next if they want more detail. To browse the model in 3D themselves, they can run `npx -y @minecraft/creator-tools@latest view -i <project-folder>`.

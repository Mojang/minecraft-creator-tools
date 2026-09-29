---
name: create-block
description: Create a new placeable block for a Minecraft Bedrock Edition add-on from a plain description, or change an existing one, such as a decorative, glowing, ore, crate, slab, stairs, or light-source block, including its texture, sounds, mining time, drops, which way it faces, and whether it generates in the world. Use this whenever someone wants a new block or wants to change one of their blocks, for example "make a glowing mushroom block you can harvest", "add a ruby ore that generates underground", "create a stone brick variant", or "make my crate face the player". For mobs use create-mob, for handheld items use create-item, for redrawing a block's texture use design-model, and for structures built out of blocks use Minecraft Creator Tools' designStructure tool directly. Custom 3D block shapes aren't supported yet. Not for Minecraft Java Edition mods.
---

# Create or change a block

A block needs a behavior pack definition, a texture registered in `terrain_texture.json`, an entry in the resource pack's `blocks.json`, and often a loot table. For a new block, the Minecraft Creator Tools MCP tool `createMinecraftContent` writes these from one definition; your job is to translate the request, then check and finish what it produces. For a block that already exists, skip to "Changing an existing block".

## 1. Understand the request

Work out, or choose sensible defaults for:

- Name and a short lowercase ID (`glow_mushroom_block`).
- Shape: full cube (default), slab, stairs, fence, wall, cross (plant-like), or custom.
- Behavior: light level (0-15), how long it takes to mine, explosion resistance, flammable, falls like sand, faces the player when placed.
- What it drops when mined: itself (default), other items, or nothing.
- Whether it generates naturally (ores, plants) and where.
- Look: color or pixel-art texture, and sound set (`stone`, `wood`, `gravel`, `grass`, `sand`, `glass`, `metal`, `cloth`, `snow`, `coral`).

Only ask when an answer would change the design a lot; otherwise pick defaults and say what you chose. Blocks that _do_ something custom when clicked or stepped on need the Script API, which these skills don't cover yet; create the block and tell the user that part needs scripting.

## 2. Pick the project folder and namespace

- Existing project: reuse its namespace from existing `identifier` values.
- New project: an empty folder and a short lowercase namespace (letters, digits, underscores). Never `minecraft`.

## 3. Generate with `createMinecraftContent`

Pass `outputPath` as the project folder itself. Put blocks in `blockTypes`, and world generation in `features`:

```json
{
  "schemaVersion": "1.0.0",
  "namespace": "gems",
  "itemTypes": [{ "id": "ruby", "displayName": "Ruby", "color": "#D01C3A" }],
  "blockTypes": [
    {
      "id": "ruby_ore",
      "displayName": "Ruby Ore",
      "traits": ["solid"],
      "destroyTime": 3,
      "mapColor": "#8C3A4A",
      "sounds": "stone",
      "drops": [{ "item": "gems:ruby" }]
    }
  ],
  "features": [
    {
      "id": "ruby_ore_feature",
      "spread": {
        "places": [
          {
            "type": "ore",
            "id": "gems:ruby_ore",
            "replacesBlocks": ["minecraft:stone", "minecraft:deepslate"],
            "count": 4
          }
        ],
        "count": 3,
        "heightPlacement": { "type": "range", "min": -32, "max": 16 },
        "biomes": ["overworld"]
      }
    }
  ]
}
```

Useful traits: `solid`, `transparent`, `leaves`, `log`, `slab`, `stairs`, `fence`, `wall`, `door`, `trapdoor`, `container`, `workstation`, `light_source`, `gravity`, `button`, `lever`, `pressure_plate`, `redstone_signal`. Use `states` and `permutations` for blocks that change (growth stages, on/off); those take native Minecraft JSON. `references/placement-and-worldgen.md` covers blocks that face the player and world generation. `spread` only works for ores; plants, trees, and other placements need raw feature JSON.

## 4. Check what was generated

Open `behavior_packs/<pack>/blocks/<id>.json` and compare it with the request. Known gaps as of Creator Tools 0.17:

- **Unknown fields are silently dropped, even in `features`.** A feature with the wrong shape is counted in the summary but produces no files. Confirm `features/` and `feature_rules/` files exist for each feature. Fix blocks by editing the generated file; running the tool again won't update a file that already exists.
- **Only ore world generation is complete.** Other `spread` placement types, `scatter`, count ranges, and heights of exactly 0 aren't handled; see `references/placement-and-worldgen.md`.
- **Scatter features use an older layout** that validation flags with a `JSONF` warning about a missing `distribution` field. `references/placement-and-worldgen.md` shows the current layout.
- **Custom drops aren't wired up.** A loot table is written to `loot_tables/blocks/<id>.json`, but the block doesn't point to it, so it drops itself. Add to the block's `components`:

  ```json
  "minecraft:loot": "loot_tables/blocks/ruby_ore.json"
  ```

- **Adding to an existing project rewrites both manifests.** The behavior pack's dependency on its resource pack gets a new UUID that points at nothing, and `header.name` is reset. Check `git diff` (or compare with a copy you made first) and restore the original manifest values. The debug-addon validation script reports a broken dependency as `[PACKDEP]`.
- **Sounds** live in `resource_packs/<pack>/blocks.json`, not the behavior file. That's expected.

## 5. Give it a readable name

Creator Tools doesn't create localization, so the block shows as `tile.<namespace>:<id>.name`. Run the debug-addon skill's names script with the display names the user asked for:

```bash
node "<debug-addon-skill-folder>/scripts/add-missing-names.mjs" <project-folder> --name "gems:ruby_ore=Ruby Ore"
```

## 6. Texture

Without a `texture`, the block gets a placeholder generated from `mapColor`. For a specific look, pass `texture.all` (or per-face `up`/`down`/`side`) with `pixelArt` in the definition, or use the design-model skill's pixel-art step to draw a 16x16 `resource_packs/<pack>/textures/blocks/<id>.png`. Keep the file path and the key in `terrain_texture.json` unchanged so the block keeps finding its texture.

## 7. Validate

Follow the debug-addon skill: run its validation script, add pack icons (new projects don't have them), and fix errors until none remain.

## 8. Tell the user

Summarize the blocks created, the defaults you picked, and how to try it: find it in the creative inventory (Construction tab by default) or use `/give @s <namespace>:<id>`, then place and mine it. World generation only happens in newly generated chunks, so they need a new world or unexplored area to see ores. To look at it without Minecraft, they can run `npx -y @minecraft/creator-tools@latest view -i <project-folder>`.

## Changing an existing block

1. Find the block's file (`behavior_packs/<pack>/blocks/*.json`, matched by `identifier`) and edit its components directly. Running `createMinecraftContent` again won't change a file that already exists.
2. Common changes: `minecraft:light_emission`, `minecraft:destructible_by_mining` (`seconds_to_destroy`), `minecraft:destructible_by_explosion`, `minecraft:friction`, `minecraft:loot`, `minecraft:map_color`, and `menu_category` in the description. Sounds are in the resource pack's `blocks.json`.
3. Validate with the debug-addon skill, and tell the user what changed.

## If the MCP tools aren't available

This skill needs the Minecraft Creator Tools MCP server (`npx -y @minecraft/creator-tools@latest mcp`). If its tools are missing, tell the user and suggest adding that server. As a fallback, `npx -y @minecraft/creator-tools@latest add --help` lists template-based commands; these need the user to have accepted the Minecraft EULA themselves (`npx -y @minecraft/creator-tools@latest eula`). Never accept it on their behalf.

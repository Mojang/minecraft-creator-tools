# Problems validation can't see

Work through the section that matches the symptom. Paths are relative to the pack root (the folder with `manifest.json`).

## The pack doesn't show up in Minecraft

- `manifest.json` must sit directly in the pack folder, not one level deeper. This is the most common mistake when zipping packs by hand; `exportaddon` gets it right.
- Two packs with the same `header.uuid`: Minecraft shows only one. Give each pack its own UUID.
- `min_engine_version` newer than the player's game version hides the pack. Lower it or update the game.
- During development, packs must be in the game's `development_behavior_packs` / `development_resource_packs` folders. On Windows, `npx -y @minecraft/creator-tools@latest deploy mcuwp -i <folder>` copies them there.

## The behavior pack works but the mob, item, or block has no look (or vice versa)

- Both packs must be active on the world. Add the resource pack's `header.uuid` and `header.version` to the behavior pack's `dependencies`, so enabling the behavior pack also enables its resources. Don't add the reverse dependency as well; a behavior pack depending on its resource pack is enough, and circular dependencies between packs can stop them from loading.

## A mob is invisible

- The resource pack needs `entity/<name>.entity.json` whose `identifier` exactly matches the behavior pack entity's `identifier`.
- `geometry.default` in that file must match the `identifier` inside the `.geo.json` (look under `minecraft:geometry[0].description.identifier`). Validation reports a mismatch as an `UNLINK` warning; don't skip it.
- The render controller named in `render_controllers` must exist and use `Geometry.default`, `Material.default`, and `Texture.default` (or names defined in the client entity).

## Purple-and-black checkerboard texture

- Texture paths are relative to the resource pack root and have no file extension: `textures/entity/goblin`, not `textures/entity/goblin.png` or `resource_packs/x/textures/...`.
- Items: the key in `textures/item_texture.json` must match the item's `minecraft:icon` value.
- Blocks: the key in `textures/terrain_texture.json` must match what the block's `minecraft:material_instances` (or `blocks.json`) refers to.

## Names show as raw keys, like `entity.demo:goblin.name` or `item.demo:hammer`

Creator Tools doesn't generate localization. Run `scripts/add-missing-names.mjs <project-folder>` to add them all, or add them by hand: a `texts/en_US.lang` file in the resource pack (plus `texts/languages.json` containing `["en_US"]` if the pack doesn't have one):

```
entity.demo:goblin.name=Swamp Goblin
item.spawn_egg.entity.demo:goblin.name=Swamp Goblin Spawn Egg
tile.demo:glow_mushroom.name=Glowing Mushroom
```

For items, the simplest fix is a `minecraft:display_name` component in the item's behavior file: `"minecraft:display_name": { "value": "Magic Hammer" }`.

## An item or block isn't in the creative inventory

- Check `menu_category` in the definition's `description`. A `category` of `none` hides it.

## A mob never spawns naturally, but /summon works

- The spawn rule's `identifier` must match the entity's identifier.
- `minecraft:biome_filter` tests biome tags (for example `forest`, `swamp`, `desert`); a misspelled tag matches nothing.
- Brightness, height, and population limits all have to be satisfied at once, so loosen them one at a time to find the one blocking spawns.
- The entity needs `"is_spawnable": true` in its description to get a spawn egg.

## Changes don't appear in game

- Minecraft caches packs per world. Leave and re-enter the world after changing files; for resource packs, sometimes restart the game.
- If the pack was imported from a `.mcaddon`, the world uses the imported copy, not your project folder. Bump `header.version` and re-import, or develop from the development pack folders instead.

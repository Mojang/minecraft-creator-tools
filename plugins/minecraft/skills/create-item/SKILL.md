---
name: create-item
description: Create a new item for a Minecraft Bedrock Edition add-on from a plain description, or change an existing one, such as a weapon, tool, food, armor piece, throwable, or collectible, including its icon and crafting recipe. Use this whenever someone wants a new item or wants to change one of their items, for example "add a magic hammer", "make a food that restores lots of hunger", "create ruby armor", "add a crafting recipe for my sword", or "make my sword do more damage". For mobs use create-mob, for placeable blocks use create-block, and for custom icon art use design-model. Not for Minecraft Java Edition mods.
---

# Create or change an item

An item needs a behavior pack definition, an icon texture registered in `item_texture.json`, and usually a recipe. For a new item, the Minecraft Creator Tools MCP tool `createMinecraftContent` writes all of these from one definition; your job is to translate the request, then check and finish what it produces. For an item that already exists, skip to "Changing an existing item".

## 1. Understand the request

Work out, or choose sensible defaults for:

- Name and a short lowercase ID (`magic_hammer`).
- What it is: weapon, tool (and which blocks it mines), food, armor (which slot), throwable, bow, or a plain material.
- Numbers that matter to the user: damage, durability, mining tier, nutrition, stack size.
- How players get it: a crafting recipe, a mob drop (see create-mob), or creative inventory only.
- Icon look (colors, or pixel art if they describe it).

Only ask when an answer would change the design a lot; otherwise pick defaults and say what you chose.

If the item should _do_ something custom when used (right-click to teleport, heal nearby players, place a structure), that needs the Script API, which these skills don't cover yet. Create the item itself, and tell the user the custom behavior needs scripting.

## 2. Pick the project folder and namespace

- Existing project: reuse its namespace from existing `identifier` values.
- New project: an empty folder and a short lowercase namespace (letters, digits, underscores). Never `minecraft`.

## 3. Generate with `createMinecraftContent`

Pass `outputPath` as the project folder itself. Put items in `itemTypes` and recipes in `recipes`:

```json
{
  "schemaVersion": "1.0.0",
  "namespace": "fungi",
  "itemTypes": [
    {
      "id": "magic_hammer",
      "displayName": "Magic Hammer",
      "traits": ["pickaxe"],
      "tool": { "durability": 500 },
      "weapon": { "damage": 7 },
      "glint": true,
      "color": "#8A5CFF"
    },
    {
      "id": "deluxe_stew",
      "displayName": "Deluxe Stew",
      "traits": ["food"],
      "maxStackSize": 1,
      "food": { "nutrition": 8, "saturation": 1.2 }
    },
    {
      "id": "vine_bow",
      "displayName": "Vine Bow",
      "traits": ["bow"],
      "projectile": { "projectile": "minecraft:arrow", "chargeable": true }
    }
  ],
  "recipes": [
    {
      "id": "magic_hammer",
      "type": "shaped",
      "pattern": ["III", " S ", " S "],
      "key": { "I": "minecraft:iron_ingot", "S": "minecraft:stick" },
      "result": "fungi:magic_hammer"
    }
  ]
}
```

Pick traits by what the item does: `sword`, `pickaxe`, `axe`, `shovel`, `hoe`, `bow`, `crossbow`, `food`, `armor_helmet`, `armor_chestplate`, `armor_leggings`, `armor_boots`, `throwable`, `placeable`. Numbers go in their sub-objects (`weapon.damage`, `tool.durability`, `armor.defense`, `food.nutrition`), not at the top level. Bows, crossbows, and throwables only work with a `projectile` entry (`chargeable: true` for bows and crossbows).

## 4. Check what was generated

Open `behavior_packs/<pack>/items/<id>.json` and compare it with the request. Known gaps as of Creator Tools 0.17:

- **Unknown fields are silently dropped.** A top-level `"damage": 7` is ignored, and the trait default is used instead. Fix the component in the generated file directly; running the tool again won't update a file that already exists.
- **Tool tiers aren't applied.** `tool.miningLevel` is accepted but ignored, and the generated `minecraft:digger` uses a low `speed`. Raise the speed to fit the tier the user expects (roughly: wood 2, stone 4, iron 6, diamond 8, netherite 9), and tag the item with its tool type and tier using `"minecraft:tags": { "tags": ["minecraft:is_pickaxe", "minecraft:iron_tier"] }`. Ask the user to confirm in game that blocks needing that tier (such as diamond ore for iron) drop their items.
- **Food status effects don't work.** The generator writes `effects` inside `minecraft:food`, but current item formats don't support effects there, and it sets `saturation_modifier` to `"custom"` instead of a number. Remove `effects`, set `saturation_modifier` to a number (0.6 is typical), and tell the user that effects on eating need the Script API, which these skills don't cover yet.
- **Bows and crossbows need `projectile`.** The trait alone doesn't make the item shoot. If an item was already generated without it, generate the same definition with `projectile` into an empty scratch folder and copy its `minecraft:shooter` and related components into the real item file.
- **Armor is invisible when worn.** The item gets `minecraft:wearable`, but nothing draws it on the player. Add an attachable and an armor texture as described in `references/armor.md`. Validation doesn't catch this.
- **Adding to an existing project rewrites both manifests.** The behavior pack's dependency on its resource pack gets a new UUID that points at nothing, and `header.name` is reset. Check `git diff` (or compare with a copy you made first) and restore the original manifest values. The debug-addon validation script reports a broken dependency as `[PACKDEP]`.
- **A recipe that uses one of your own blocks** can show an `UNLINK` "item type not found" warning. That's fine; blocks can be crafting ingredients, and the debug-addon summary script files it under likely noise.

## 5. Give it a readable name

Creator Tools doesn't create localization, so the item shows a raw key in game. Run the debug-addon skill's names script with the display names the user asked for; it adds a `minecraft:display_name` component to each item that lacks one:

```bash
node "<debug-addon-skill-folder>/scripts/add-missing-names.mjs" <project-folder> --name "fungi:magic_hammer=Magic Hammer"
```

## 6. Icon

The icon is a generated placeholder based on the traits and `color`. For a specific look, either pass `icon` with `pixelArt` in the definition, or use the design-model skill's pixel-art step to draw `resource_packs/<pack>/textures/items/<id>.png` (16x16). Keep the file path and the key in `item_texture.json` unchanged so the item keeps finding its icon.

## 7. Validate

Follow the debug-addon skill: run its validation script, add pack icons (new projects don't have them), and fix errors until none remain.

## 8. Tell the user

Summarize the items and recipes created, the numbers and defaults you picked, and how to get it in game: find it in the creative inventory, craft it, or use `/give @s <namespace>:<id>`. To look at it without Minecraft, they can run `npx -y @minecraft/creator-tools@latest view -i <project-folder>`.

## Changing an existing item

1. Find the item's file (`behavior_packs/<pack>/items/*.json`, matched by `identifier`) and edit its components directly. Running `createMinecraftContent` again won't change a file that already exists.
2. Common changes: `minecraft:damage`, `minecraft:durability` (`max_durability`), `minecraft:max_stack_size`, `minecraft:food` (`nutrition`, `saturation_modifier`), `minecraft:digger` (`destroy_speeds`), `minecraft:glint`, and `menu_category` in the description.
3. Recipes live in `behavior_packs/<pack>/recipes/`; change the `pattern`, `key`, or `result` there.
4. Validate with the debug-addon skill, and tell the user what changed.

## If the MCP tools aren't available

This skill needs the Minecraft Creator Tools MCP server (`npx -y @minecraft/creator-tools@latest mcp`). If its tools are missing, tell the user and suggest adding that server. As a fallback, `npx -y @minecraft/creator-tools@latest add --help` lists template-based commands; these need the user to have accepted the Minecraft EULA themselves (`npx -y @minecraft/creator-tools@latest eula`). Never accept it on their behalf.

---
name: create-mob
description: Create a new mob (custom entity) for a Minecraft Bedrock Edition add-on from a plain description, or change an existing one, including its health, attacks, AI behavior, taming, riding, drops, and natural spawning. Use this whenever someone wants a new creature, monster, animal, pet, boss, or NPC, or wants to change how one of their mobs behaves, for example "make a rideable red panda", "add a goblin that spawns in swamps at night", "make my goblin scared of zombies", or "give the goblin more health". For items use create-item, for blocks use create-block, and for changing how a mob looks use design-model. Not for Minecraft Java Edition mods.
---

# Create or change a mob

A working mob spans several files across two packs: the behavior pack entity, a client entity, geometry, texture, render controller, and optionally a loot table and spawn rule. For a new mob, the Minecraft Creator Tools MCP tool `createMinecraftContent` writes all of them in one call; your job is to translate the request into its definition, then check and finish what it produces. For a mob that already exists, skip to "Changing an existing mob".

## 1. Understand the request

Work out, or choose sensible defaults for:

- Name and a short lowercase ID (`swamp_goblin`).
- Attitude: hostile, neutral, or passive. How it fights, if at all.
- Size and rough look (body type, colors).
- Special behaviors: tameable, rideable, breedable, flies, swims, avoids or hunts certain mobs.
- Drops, and where and when it spawns (or summon-only).

Only ask the user when an answer would change the design a lot. Otherwise pick defaults and say what you chose at the end.

## 2. Pick the project folder and namespace

- Existing project (has `behavior_packs/`): reuse its namespace. Look at the `identifier` values in existing files (`goblins:...`).
- New project: use an empty folder and a short lowercase namespace made of letters, digits, and underscores, such as the creator's name or the add-on's theme. Never use `minecraft`.

## 3. Generate with `createMinecraftContent`

Pass `outputPath` as the project folder itself; don't add a subfolder. The tool's input schema lists every field, and `references/behaviors.md` maps common requests to traits, behavior presets, and native components.

A typical entity entry:

```json
{
  "id": "swamp_goblin",
  "displayName": "Swamp Goblin",
  "traits": ["humanoid", "hostile", "melee_attacker"],
  "behaviors": ["wander", "hide_from_sun", "look_at_player"],
  "health": 16,
  "attackDamage": 3,
  "scale": 0.5,
  "families": ["goblin", "monster"],
  "appearance": {
    "primaryColor": "#4F7A3A",
    "secondaryColor": "#6B4E2E",
    "textureStyle": "organic",
    "eyes": "glowing"
  },
  "drops": [{ "item": "minecraft:brown_mushroom", "count": { "min": 1, "max": 2 } }],
  "spawning": { "biomes": ["swamp"], "lightLevel": { "max": 7 }, "weight": 20, "groupSize": { "min": 1, "max": 3 } }
}
```

Use `components` for anything traits don't cover; they're native Minecraft components and override trait defaults.

## 4. Check what was generated

The generator doesn't report everything it skipped, so open the files and compare them with the request. Known gaps as of Creator Tools 0.17:

- **Unknown fields are silently dropped.** If a value you passed isn't in the output, check the field name against the tool's input schema.
- **The summary can say "0 loot tables / 0 spawn rules"** even when inline `drops` and `spawning` created them. Trust the files, not the summary.
- **`drops[].chance` isn't applied.** Add a condition to the entry in `loot_tables/entities/<id>.json`: `"conditions": [{ "condition": "random_chance", "chance": 0.3 }]`. For player-kill-only drops add `{ "condition": "killed_by_player" }`.
- **`spawning.timeOfDay` isn't applied.** For night or dark-only spawning use `"lightLevel": { "max": 7 }`, which produces a `minecraft:brightness_filter`.
- **`population_control` is always `animal`.** Change it to `monster` in `spawn_rules/<id>.json` for hostile mobs, or `water_animal` for aquatic ones, so they share the right mob cap.
- **Adding to an existing project rewrites both manifests.** The behavior pack's dependency on its resource pack gets a new UUID that points at nothing, and `header.name` is reset. Check `git diff` (or compare with a copy you made first) and restore the original manifest values. The debug-addon validation script reports a broken dependency as `[PACKDEP]`.
- **`tameable`, `rideable`, and `breedable` configuration objects are ignored.** The traits always use bones to tame, wheat to breed, and a saddle to ride. Edit the generated `minecraft:tameable`, `minecraft:breedable`, and `minecraft:rideable` components as described in `references/behaviors.md`.
- **Trait component groups can override your components.** For example, the `hostile` trait adds a `hostile_angry` group with its own `minecraft:behavior.nearest_attackable_target` (targeting players) when the mob spawns, replacing a targeting component you put in `components`. Merge your targets into the group's `entity_types` list instead of defining the component twice.

## 5. Give it a readable name

Creator Tools doesn't create localization, so in game the mob shows as `entity.<namespace>:<id>.name`. Run the debug-addon skill's names script, passing the display name the user asked for:

```bash
node "<debug-addon-skill-folder>/scripts/add-missing-names.mjs" <project-folder> --name "swampy:swamp_goblin=Swamp Goblin"
```

It writes `entity.swampy:swamp_goblin.name` and the spawn egg name to `resource_packs/<pack>/texts/en_US.lang`, creating the file if needed.

## 6. Make it look right

The default geometry is a generic body for the chosen type, with a generated texture. If the user described a specific look, use the design-model skill with `modelId` set to the mob's ID. Afterwards, make sure `geometry.default` in `resource_packs/<pack>/entity/<id>.entity.json` matches the new `.geo.json` identifier; otherwise the mob is invisible.

## 7. Validate

Follow the debug-addon skill: run its validation script, add pack icons (new projects don't have them), and fix errors until none remain.

## 8. Tell the user

Summarize the files created, the defaults you picked, and anything you couldn't do. Explain how to try it: enable both packs on a world with cheats on, then use `/summon <namespace>:<id>` or the spawn egg from the creative inventory. To look at it without Minecraft, they can run `npx -y @minecraft/creator-tools@latest view -i <project-folder>`.

## Changing an existing mob

Most requests in an existing project are changes: "more health", "make it scared of zombies", "tame it with fish instead". If the mob is a vanilla one (such as `minecraft:wolf`) that isn't in the project, say that changing vanilla mobs isn't covered by these skills yet, and offer to make a custom mob based on it instead.

1. Find the mob's behavior pack file (`behavior_packs/<pack>/entities/*.json`, matched by `identifier`). For a quick overview of what it already does, `getEffectiveContentSchema` on the project folder summarizes each mob as traits and properties.
2. Edit the JSON directly. Running `createMinecraftContent` again won't help: it leaves files that already exist untouched, so new values never reach the mob.
3. Look at `components`, then `component_groups` and `events`. A component in an active group replaces the one of the same name in `components`, so change it where it's actually in effect. `references/behaviors.md` has native components for common requests (targeting, fleeing, protecting the owner).
4. Keep `priority` values sensible: lower numbers win, so a "flee" behavior must have a lower number than "wander" to interrupt it.
5. Validate with the debug-addon skill, and tell the user what changed and how to see it in game.

## If the MCP tools aren't available

This skill needs the Minecraft Creator Tools MCP server (`npx -y @minecraft/creator-tools@latest mcp`). If its tools are missing, tell the user and suggest adding that server. As a fallback, `npx -y @minecraft/creator-tools@latest add --help` lists template-based commands; these need the user to have accepted the Minecraft EULA themselves (`npx -y @minecraft/creator-tools@latest eula`). Never accept it on their behalf.

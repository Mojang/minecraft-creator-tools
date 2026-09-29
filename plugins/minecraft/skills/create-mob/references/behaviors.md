# Turning mob requests into a definition

Start with traits and behavior presets; they bundle the right native components and priorities. Reach for native `components` only for what they don't cover. The `createMinecraftContent` input schema is the source of truth for field names.

## Attitude and combat

| Request                   | Traits                       | Behavior presets           | Notes                                                 |
| ------------------------- | ---------------------------- | -------------------------- | ----------------------------------------------------- |
| Attacks players on sight  | `hostile`, `melee_attacker`  | `target_players`           | Add `"monster"` to `families` so iron golems fight it |
| Shoots from range         | `hostile`, `ranged_attacker` | `ranged_attack`            |                                                       |
| Explodes like a creeper   | `hostile`, `exploder`        |                            |                                                       |
| Fights back only when hit | `neutral`                    | `retaliate`                |                                                       |
| Harmless, runs when hurt  | `passive`                    | `wander`, `flee_when_hurt` |                                                       |
| Boss fight                | `boss`                       |                            | Raise `health` and `attackDamage`                     |

## Movement and body

| Request                    | Traits / fields                                       | Behavior presets |
| -------------------------- | ----------------------------------------------------- | ---------------- |
| Walks around               | `wanders` or preset                                   | `wander`         |
| Flies                      | `flying`                                              | `fly_around`     |
| Swims / lives in water     | `aquatic` (or `aquatic_only` if it can't leave water) | `swim`           |
| Climbs walls               | `arthropod`                                           | `climb`          |
| Small / large              | `scale` (0.5 = half size)                             |                  |
| Hides or burns in daylight | `undead`, `flees_daylight`                            | `hide_from_sun`  |
| Teleports                  | `teleporter`                                          |                  |

## Relationships with players

Use the trait, then adjust the native component it generates. The definition also accepts `tameable`, `rideable`, and `breedable` configuration objects, but Creator Tools 0.17 ignores them and always uses the defaults below.

| Request              | Trait       | Behavior presets              | Then check in the generated entity                                                                                                                                                                                                |
| -------------------- | ----------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tameable pet         | `tameable`  | `follow_owner`, `sit_command` | `minecraft:tameable`: set `tame_items` (defaults to bone) and `probability`. The `tamed` component group adds following, sitting, and protecting the owner.                                                                       |
| Rideable             | `rideable`  |                               | Riding needs a saddle by default: `minecraft:rideable` and `minecraft:input_ground_controlled` sit in a `saddled` group. To ride without a saddle, move both into `components`. Set `seats[].position` to fit the model's height. |
| Breeds               | `breedable` | `follow_parent`, `tempt`      | `minecraft:breedable`: set `breed_items` (defaults to wheat), and set `breeds_with.mate_type` and `baby_type` to the mob's own identifier (the generator writes `self`, which isn't a documented value).                          |
| Can be put on a lead | `leasable`  |                               |                                                                                                                                                                                                                                   |
| Trades               | `trader`    |                               |                                                                                                                                                                                                                                   |
| Avoids players       |             | `avoid_players`               |                                                                                                                                                                                                                                   |

## Native components for common requests traits don't cover

Add these under `components` (or edit them into the generated entity file). A lower `priority` number wins when behaviors compete.

**Hunts a specific mob family** (villagers here):

```json
"minecraft:behavior.nearest_attackable_target": {
  "priority": 2,
  "must_see": true,
  "entity_types": [
    { "filters": { "test": "is_family", "subject": "other", "value": "villager" }, "max_dist": 16 }
  ]
}
```

If the mob also has the `hostile` trait, merge this filter into the `hostile_angry` component group's `entity_types` rather than adding a second copy; the group's version replaces the base component while it's active.

**Scared of a mob family** (zombies here):

```json
"minecraft:behavior.avoid_mob_type": {
  "priority": 1,
  "entity_types": [
    { "filters": { "test": "is_family", "subject": "other", "value": "zombie" }, "max_dist": 10, "walk_speed_multiplier": 1.2, "sprint_speed_multiplier": 1.5 }
  ]
}
```

**Protects its owner** (tamed mobs, like wolves):

```json
"minecraft:behavior.owner_hurt_by_target": { "priority": 1 },
"minecraft:behavior.owner_hurt_target": { "priority": 2 }
```

**Burns in sunlight:** `"minecraft:burns_in_daylight": {}`.

## Spawning

`spawning` on the entity creates `spawn_rules/<id>.json`:

- `biomes` are biome tags such as `forest`, `plains`, `swamp`, `desert`, `taiga`, `ocean`, `jungle`, `mesa`.
- Night or darkness only: `"lightLevel": { "max": 7 }`. (`timeOfDay` isn't applied yet.)
- `weight` controls how common it is relative to other mobs; `groupSize` controls how many spawn together.
- After generating, set `population_control` to `monster` for hostile mobs or `water_animal` for aquatic ones.

Leave `spawning` out for mobs that should only appear via `/summon` or a spawn egg.

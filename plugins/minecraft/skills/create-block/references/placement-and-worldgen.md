# Block placement and world generation

## Blocks that face the player when placed

Add the `minecraft:placement_direction` trait to the block's `description`, then rotate the block per direction with permutations. The block's `format_version` must be `1.20.20` or newer (generated blocks already are).

```json
"description": {
  "identifier": "demo:crate",
  "traits": {
    "minecraft:placement_direction": {
      "enabled_states": ["minecraft:cardinal_direction"],
      "y_rotation_offset": 180
    }
  }
},
"permutations": [
  { "condition": "q.block_state('minecraft:cardinal_direction') == 'north'",
    "components": { "minecraft:transformation": { "rotation": [0, 0, 0] } } },
  { "condition": "q.block_state('minecraft:cardinal_direction') == 'west'",
    "components": { "minecraft:transformation": { "rotation": [0, 90, 0] } } },
  { "condition": "q.block_state('minecraft:cardinal_direction') == 'south'",
    "components": { "minecraft:transformation": { "rotation": [0, 180, 0] } } },
  { "condition": "q.block_state('minecraft:cardinal_direction') == 'east'",
    "components": { "minecraft:transformation": { "rotation": [0, -90, 0] } } }
]
```

`y_rotation_offset: 180` makes the block's front face the player. Rotation is only visible if the faces differ, so give the front its own texture in `minecraft:material_instances` (for example a `north` entry alongside `*`).

## World generation with `features[].spread`

In Creator Tools 0.17, `spread` only produces a complete, working feature for **ores** (`places[].type: "ore"`). Other `type` values (`block`, `vegetation`, `tree`, `structure`) create a scatter feature that points at a feature file that's never written. For those, write the feature and feature rule yourself with `nativeFeature` and `nativeFeatureRule` on the same feature entry, or by hand in `features/` and `feature_rules/`.

Ore fields that work:

- `places`: `[{ "type": "ore", "id": "<block>", "replacesBlocks": ["minecraft:stone", "minecraft:deepslate"], "count": <vein size> }]`.
- `count`: attempts per chunk. Use a single number; for a `{ "min", "max" }` range only `max` is used.
- `heightPlacement`: `{ "type": "range", "min": -32, "max": 16 }`. Avoid `0` as a bound or as a `fixed` height, because the generator replaces 0 with its default; use `-1` or `1` instead.
- `biomes`: biome tags such as `overworld`.
- `scatter` is accepted but ignored.

As a rough guide, rare ores use a low `count` (1-2) and small veins (4-8 blocks) deep underground, while common ores use higher counts. Replace both `minecraft:stone` and `minecraft:deepslate` for ores that span Y=0.

After generating, check that `behavior_packs/<pack>/features/` and `feature_rules/` contain files for each feature, then validate. Treat any `JSONF` warnings on feature files as real.

The generated `minecraft:scatter_feature` also uses an older layout, and validation reports `missing required field 'distribution'`. Current versions wrap the scatter settings in a `distribution` object. Set a recent `format_version` such as `1.21.20` and move `iterations`, `scatter_chance`, `x`, `y`, and `z` inside it, keeping `description` and `places_feature` where they are. Keep x and z within the chunk with `[0, 15]`:

```json
{
  "format_version": "1.21.20",
  "minecraft:scatter_feature": {
    "description": { "identifier": "gems:ruby_ore_feature" },
    "places_feature": "gems:ruby_ore_feature_placed",
    "distribution": {
      "iterations": 3,
      "scatter_chance": 100,
      "x": { "distribution": "uniform", "extent": [0, 15] },
      "y": { "distribution": "uniform", "extent": [-32, 16] },
      "z": { "distribution": "uniform", "extent": [0, 15] }
    }
  }
}
```

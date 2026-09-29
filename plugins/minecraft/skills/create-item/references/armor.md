# Making custom armor visible when worn

`createMinecraftContent` gives armor items `minecraft:wearable` and `minecraft:armor`, which make them equippable and protective. To draw the armor on the player, each piece also needs an **attachable** in the resource pack and an **armor texture**.

## 1. Armor textures

Bedrock armor uses two 64x32 textures laid out like the vanilla armor textures:

- Layer 1 (`<material>_1.png`): helmet, chestplate, and boots.
- Layer 2 (`<material>_2.png`): leggings.

Save them in `resource_packs/<pack>/textures/models/armor/`. For a quick placeholder, a solid-color 64x32 PNG works (for example with `writeImageFileFromSvg` and a single `<rect>`). For a proper look, start from Mojang's vanilla textures in the `Mojang/bedrock-samples` GitHub repository (`resource_pack/textures/models/armor/iron_1.png` and `iron_2.png`) and recolor them, so the pixels line up with the armor geometry.

## 2. One attachable per armor piece

Create `resource_packs/<pack>/attachables/<item id>.json`. Example for a chestplate:

```json
{
  "format_version": "1.10.0",
  "minecraft:attachable": {
    "description": {
      "identifier": "gems:ruby_chestplate",
      "materials": { "default": "armor", "enchanted": "armor_enchanted" },
      "textures": {
        "default": "textures/models/armor/ruby_1",
        "enchanted": "textures/misc/enchanted_actor_glint"
      },
      "geometry": { "default": "geometry.humanoid.armor.chestplate" },
      "scripts": { "parent_setup": "variable.chest_layer_visible = 0.0;" },
      "render_controllers": ["controller.render.armor"]
    }
  }
}
```

Change these per piece:

| Piece      | `geometry.default`                   | `parent_setup`                         | Texture layer |
| ---------- | ------------------------------------ | -------------------------------------- | ------------- |
| Helmet     | `geometry.humanoid.armor.helmet`     | `variable.helmet_layer_visible = 0.0;` | `_1`          |
| Chestplate | `geometry.humanoid.armor.chestplate` | `variable.chest_layer_visible = 0.0;`  | `_1`          |
| Leggings   | `geometry.humanoid.armor.leggings`   | `variable.leg_layer_visible = 0.0;`    | `_2`          |
| Boots      | `geometry.humanoid.armor.boots`      | `variable.boot_layer_visible = 0.0;`   | `_1`          |

The `identifier` must match the item's identifier exactly. The geometry, materials, render controller, and glint texture are vanilla, so they don't need to exist in the pack.

## 3. Check it

Run the debug-addon validation script. Then tell the user to equip the piece in game (or in `npx -y @minecraft/creator-tools@latest view`) to confirm it shows up; validation can't confirm the look.

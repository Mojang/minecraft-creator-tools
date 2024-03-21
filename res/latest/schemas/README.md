# Minecraft-bedrock-json-schemas

[![Compress Json Schemas](https://github.com/Blockception/Minecraft-bedrock-json-schemas/actions/workflows/compress-json-schemas.yml/badge.svg?branch=main&event=push)](https://github.com/Blockception/Minecraft-bedrock-json-schemas/actions/workflows/compress-json-schemas.yml)
[![Format json files](https://github.com/Blockception/Minecraft-bedrock-json-schemas/actions/workflows/format-json-files.yml/badge.svg?branch=main&event=push)](https://github.com/Blockception/Minecraft-bedrock-json-schemas/actions/workflows/format-json-files.yml)
[![Unit Test](https://github.com/Blockception/Minecraft-bedrock-json-schemas/actions/workflows/pull-request.yml/badge.svg)](https://github.com/Blockception/Minecraft-bedrock-json-schemas/actions/workflows/pull-request.yml)

The JSON validation schema files for Minecraft bedrock

- [Minecraft-bedrock-json-schemas](#minecraft-bedrock-json-schemas)
  - [Contributing](#contributing)
  - [Manual Usage](#manual-usage)
    - [Vscode](#vscode)
- [Contents](#contents)
  - [behavior files](#behavior-files)
  - [Resource files](#resource-files)
  - [License](#license)

## Contributing

Any changes to the schemas are to be done through the source files in the folder source. These get converted and compressed through an action into
smaller schemas. On other matters follow the [Contribution guide](CONTRIBUTING.md).

This project could use help in filling in descriptions, titles and giving snippets!

JSON validation can give snippets for sub items, as well as description, but this hasn't always been filled out!

## Manual Usage

### Vscode

- Copy the `vscode-settings.json` file into the `.vscode` folder in your project and rename it to: `settings.json`  
  OR
- Copy the contents of `vscode-settings.json` into your `.code-workspace` file under the property settings:

```JSON
{
  "folders": [ { "path": "." } ],
  "settings": {
    "json.schemas": [
      ...
    ]
  }
}
```

---

# Contents

## Behavior files

- [Animation Controllers](behavior/animation_controllers/animation_controller.json)
- [Animations](behavior/animations/animations.json)
- [Blocks](behavior/blocks/blocks.json)
- [Entities](behavior/entities/entities.json)
- [Items](behavior/items/items.json)
- [Loot tables](behavior/loot_tables/loot_tables.json)
- [Recipes](behavior/recipes/recipes.json)
- [Spawn rules](behavior/spawn_rules/spawn_rules.json)
- [Trading](behavior/trading/trading.json)

## Resource files

- [Animations](resource/animations/animations.json)
- [Animation Controllers](resource/animation_controllers/animation_controller.json)
- [Attachables](resource/attachables/attachables.json)
- [Biomes client](resource/biomes_client.json)
- [Blocks](resource/blocks.json)
- [Entity](resource/entity/entities.json)
- [Flipbook texture](resource/textures/flipbook_textures.json)
- [Fog](resource/fog/fog.json)
- [Item texture](resource/textures/item_texture.json)
- [Items](resource/items/items.json)
- [Materials](resource/materials/materials.json)
- [Models](resource/models/entity/model_entity.json)
- [Music](resource/sounds/music_definitions.json)
- [Particles](resource/particles/particles.json)
- [Render Controllers](resource/render_controllers/render_controllers.json)
- [Sounds](resource/sounds/sound_definitions.json)
- [Terrain texture](resource/textures/terrain_texture.json)
- [Terrain list](resource/textures/texture_list.json)

## License

This project makes use of Microsoft open source license:
[CC-BY-4.0, MIT licenses](https://github.com/MicrosoftDocs/minecraft-creator/blob/main/LICENSE).

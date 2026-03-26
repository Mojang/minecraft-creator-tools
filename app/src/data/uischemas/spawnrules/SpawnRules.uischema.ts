import { UISchema } from "../../../UX/shared/components/SchemaForm/UISchema";

export const SpawnRulesUISchema: UISchema = {
  children: {
    description: {
      children: {
        identifier: {
          description: "A minecraft entity identifier.",
          pattern: "^[0-9a-zA-Z:_\\.\\-]+$",
          regexErrorMessage: "Identifiers can only contain letters and numbers.",
        },
        population_control: {
          description: "example: ambient",
        },
      },
      order: 10,
    },
    conditions: {
      items: {
        children: {
          "minecraft:biome_filter": {
            title: "Biome Filter",
            oneOf: "array",
            items: {
              oneOf: "object",
            },
          },
          "minecraft:distance_filter": {
            title: "Distance Filter",
            displayHorizontal: true,
            children: {
              min: { order: 10 },
              max: { order: 20 },
            },
          },
          "minecraft:brightness_filter": {
            title: "Brightness Filter",
            displayHorizontal: false,
            children: {
              min: { order: 10 },
              max: { order: 20 },
              adjust_for_weather: { title: "Adjust for weather", order: 30 },
            },
          },
          "minecraft:delay_filter": {
            title: "Delay Filter",
            displayHorizontal: true,
            children: {
              identifier: {
                regexErrorMessage: "Identifiers can only contain letters and numbers.",
              },
            },
          },
          "minecraft:density_limit": {
            title: "Density Limit",
            displayHorizontal: true,
          },
          "minecraft:difficulty_filter": {
            title: "Difficulty Filter",
            displayHorizontal: true,
          },
          "minecraft:height_filter": {
            title: "Height Filter",
            displayHorizontal: true,
            children: {
              min: { order: 10 },
              max: { order: 20 },
            },
          },
          "minecraft:spawns_above_block_filter": {
            title: "Spawns Above Block Filter",
            children: {
              blocks: {
                order: 100,
                items: {
                  title: "block",
                  oneOf: "uichoice",
                  choices: [{ title: "Block Descriptor " }, {}, { hidden: true }],
                },
              },
            },
          },
          "minecraft:disallow_spawns_in_bubble": {
            isObjectAsBool: true,
            order: 100,
          },
          "minecraft:spawns_lava": {
            isObjectAsBool: true,
            order: 100,
          },
          "minecraft:spawns_on_surface": {
            isObjectAsBool: true,
            order: 100,
          },
          "minecraft:spawns_underground": {
            isObjectAsBool: true,
            order: 100,
          },
          "minecraft:spawns_underwater": {
            isObjectAsBool: true,
            order: 100,
          },
          "minecraft:is_experimental": {
            isObjectAsBool: true,
            order: 100,
          },
          "minecraft:is_persistent": {
            isObjectAsBool: true,
            order: 100,
          },
          "minecraft:spawn_event": {
            children: {},
          },
        },
      },
      order: 20,
    },
  },
};

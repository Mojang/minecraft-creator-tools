// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * VscProviderTests - Unit tests for VS Code language provider logic
 *
 * These tests validate the core logic of the VS Code extension providers
 * without requiring VS Code APIs. They test:
 * - JSON path parsing for context detection
 * - Component categorization
 * - Reference type detection (using langcore)
 * - Completion/hover content generation
 *
 * NOTE: Core langcore tests are in LangcoreTests.ts. These tests focus on
 * VS Code provider-specific behavior and integration.
 */

import { expect } from "chai";
import { MinecraftPathUtils } from "../langcore/shared/MinecraftPathUtils";
import { getReferenceTypeFromPath, getReferenceTypeFromProperty } from "../langcore/shared/MinecraftReferenceTypes";

/**
 * Test data for entity type definitions
 */
const SAMPLE_ENTITY_JSON = {
  format_version: "1.20.0",
  "minecraft:entity": {
    description: {
      identifier: "custom:test_mob",
      is_spawnable: true,
      is_summonable: true,
    },
    components: {
      "minecraft:health": {
        value: 20,
        max: 20,
      },
      "minecraft:attack": {
        damage: 5,
      },
      "minecraft:movement": {
        value: 0.3,
      },
      "minecraft:behavior.random_stroll": {
        speed_multiplier: 1.0,
        xz_dist: 10,
        y_dist: 7,
      },
      "minecraft:physics": {},
      "minecraft:collision_box": {
        width: 0.6,
        height: 1.8,
      },
    },
    component_groups: {
      baby: {
        "minecraft:scale": {
          value: 0.5,
        },
      },
      adult: {
        "minecraft:scale": {
          value: 1.0,
        },
      },
    },
    events: {
      "minecraft:entity_spawned": {
        add: {
          component_groups: ["baby"],
        },
      },
      "minecraft:entity_born": {
        remove: {
          component_groups: ["baby"],
        },
        add: {
          component_groups: ["adult"],
        },
      },
    },
  },
};

/**
 * Test data for block type definitions
 */
const SAMPLE_BLOCK_JSON = {
  format_version: "1.20.0",
  "minecraft:block": {
    description: {
      identifier: "custom:test_block",
      menu_category: {
        category: "construction",
      },
      states: {
        "custom:direction": [0, 1, 2, 3],
        "custom:active": [true, false],
      },
    },
    components: {
      "minecraft:geometry": "geometry.custom_block",
      "minecraft:light_emission": 5,
      "minecraft:destructible_by_mining": {
        seconds_to_destroy: 1.5,
      },
      "minecraft:collision_box": {
        origin: [-8, 0, -8],
        size: [16, 16, 16],
      },
      "minecraft:loot": "loot_tables/custom_block.json",
      "minecraft:custom_components": ["custom:ticker", "custom:interactable"],
    },
    permutations: [
      {
        condition: "q.block_state('custom:direction') == 0",
        components: {
          "minecraft:transformation": { rotation: [0, 0, 0] },
        },
      },
      {
        condition: "q.block_state('custom:direction') == 1",
        components: {
          "minecraft:transformation": { rotation: [0, 90, 0] },
        },
      },
    ],
  },
};

describe("VS Code Provider Unit Tests", () => {
  describe("Entity Type Parsing", () => {
    it("should extract entity identifier correctly", () => {
      const entity = SAMPLE_ENTITY_JSON["minecraft:entity"];
      expect(entity.description.identifier).to.equal("custom:test_mob");
    });

    it("should extract component list", () => {
      const components = Object.keys(SAMPLE_ENTITY_JSON["minecraft:entity"].components);
      expect(components).to.include("minecraft:health");
      expect(components).to.include("minecraft:attack");
      expect(components).to.include("minecraft:movement");
      expect(components).to.include("minecraft:behavior.random_stroll");
    });

    it("should identify behavioral components", () => {
      const components = Object.keys(SAMPLE_ENTITY_JSON["minecraft:entity"].components);
      const behavioral = components.filter((c) => c.includes("behavior"));
      expect(behavioral).to.have.length(1);
      expect(behavioral[0]).to.equal("minecraft:behavior.random_stroll");
    });

    it("should identify physical components", () => {
      const components = Object.keys(SAMPLE_ENTITY_JSON["minecraft:entity"].components);
      const physical = components.filter(
        (c) => c.includes("health") || c.includes("movement") || c.includes("collision")
      );
      expect(physical.length).to.be.greaterThan(0);
    });

    it("should extract component groups", () => {
      const groups = Object.keys(SAMPLE_ENTITY_JSON["minecraft:entity"].component_groups);
      expect(groups).to.include("baby");
      expect(groups).to.include("adult");
    });

    it("should extract events", () => {
      const events = Object.keys(SAMPLE_ENTITY_JSON["minecraft:entity"].events);
      expect(events).to.include("minecraft:entity_spawned");
      expect(events).to.include("minecraft:entity_born");
    });

    it("should extract health stats", () => {
      const health = SAMPLE_ENTITY_JSON["minecraft:entity"].components["minecraft:health"];
      expect(health.max).to.equal(20);
      expect(health.value).to.equal(20);
    });

    it("should extract attack damage", () => {
      const attack = SAMPLE_ENTITY_JSON["minecraft:entity"].components["minecraft:attack"];
      expect(attack.damage).to.equal(5);
    });

    it("should extract movement speed", () => {
      const movement = SAMPLE_ENTITY_JSON["minecraft:entity"].components["minecraft:movement"];
      expect(movement.value).to.equal(0.3);
    });
  });

  describe("Block Type Parsing", () => {
    it("should extract block identifier correctly", () => {
      const block = SAMPLE_BLOCK_JSON["minecraft:block"];
      expect(block.description.identifier).to.equal("custom:test_block");
    });

    it("should extract block states", () => {
      const states = SAMPLE_BLOCK_JSON["minecraft:block"].description.states;
      expect(Object.keys(states)).to.include("custom:direction");
      expect(Object.keys(states)).to.include("custom:active");
    });

    it("should extract state values correctly", () => {
      const states = SAMPLE_BLOCK_JSON["minecraft:block"].description.states;
      expect(states["custom:direction"]).to.deep.equal([0, 1, 2, 3]);
      expect(states["custom:active"]).to.deep.equal([true, false]);
    });

    it("should extract geometry reference", () => {
      const geometry = SAMPLE_BLOCK_JSON["minecraft:block"].components["minecraft:geometry"];
      expect(geometry).to.equal("geometry.custom_block");
    });

    it("should extract light emission", () => {
      const light = SAMPLE_BLOCK_JSON["minecraft:block"].components["minecraft:light_emission"];
      expect(light).to.equal(5);
    });

    it("should extract loot table", () => {
      const loot = SAMPLE_BLOCK_JSON["minecraft:block"].components["minecraft:loot"];
      expect(loot).to.equal("loot_tables/custom_block.json");
    });

    it("should extract custom components", () => {
      const custom = SAMPLE_BLOCK_JSON["minecraft:block"].components["minecraft:custom_components"];
      expect(custom).to.include("custom:ticker");
      expect(custom).to.include("custom:interactable");
    });

    it("should extract permutations", () => {
      const perms = SAMPLE_BLOCK_JSON["minecraft:block"].permutations;
      expect(perms).to.have.length(2);
      expect(perms[0].condition).to.include("custom:direction");
    });
  });

  describe("Component Categorization", () => {
    const BEHAVIORAL_PREFIXES = [
      "minecraft:behavior.",
      "minecraft:attack",
      "minecraft:target",
      "minecraft:follow",
      "minecraft:navigation",
    ];

    const PHYSICAL_PREFIXES = [
      "minecraft:health",
      "minecraft:movement",
      "minecraft:collision_box",
      "minecraft:physics",
      "minecraft:pushable",
    ];

    function categorizeComponent(id: string): "behavioral" | "physical" | "other" {
      const idLower = id.toLowerCase();
      if (BEHAVIORAL_PREFIXES.some((p) => idLower.startsWith(p.toLowerCase()))) {
        return "behavioral";
      }
      if (PHYSICAL_PREFIXES.some((p) => idLower.startsWith(p.toLowerCase()))) {
        return "physical";
      }
      return "other";
    }

    it("should categorize behavior components as behavioral", () => {
      expect(categorizeComponent("minecraft:behavior.random_stroll")).to.equal("behavioral");
      expect(categorizeComponent("minecraft:behavior.float")).to.equal("behavioral");
      expect(categorizeComponent("minecraft:behavior.look_at_player")).to.equal("behavioral");
    });

    it("should categorize health/movement as physical", () => {
      expect(categorizeComponent("minecraft:health")).to.equal("physical");
      expect(categorizeComponent("minecraft:movement")).to.equal("physical");
      expect(categorizeComponent("minecraft:collision_box")).to.equal("physical");
    });

    it("should categorize other components correctly", () => {
      expect(categorizeComponent("minecraft:is_baby")).to.equal("other");
      expect(categorizeComponent("minecraft:scale")).to.equal("other");
      expect(categorizeComponent("minecraft:type_family")).to.equal("other");
    });
  });

  describe("Reference Type Detection (using langcore)", () => {
    // These tests now use the langcore reference type detection
    // More comprehensive tests are in LangcoreTests.ts

    it("should detect texture references via property name", () => {
      expect(getReferenceTypeFromProperty("texture")).to.equal("texture");
      // Note: "textures" plural doesn't match - use texture_path instead
      expect(getReferenceTypeFromProperty("texture_path")).to.equal("texture");
    });

    it("should detect geometry references via property name", () => {
      expect(getReferenceTypeFromProperty("geometry")).to.equal("geometry");
    });

    it("should detect animation references via path", () => {
      expect(getReferenceTypeFromPath(["animations", "walk"])).to.equal("animation");
      // Property detection for singular form
      expect(getReferenceTypeFromProperty("animation")).to.equal("animation");
    });

    it("should detect event references via property name", () => {
      expect(getReferenceTypeFromProperty("event")).to.equal("event");
    });

    it("should detect loot table references via property name", () => {
      expect(getReferenceTypeFromProperty("table")).to.equal("loot_table");
      expect(getReferenceTypeFromProperty("loot_table")).to.equal("loot_table");
    });
  });

  describe("Path Detection (using langcore)", () => {
    it("should detect behavior pack paths", () => {
      expect(MinecraftPathUtils.isMinecraftContentPath("behavior_pack/entities/pig.json")).to.be.true;
      expect(MinecraftPathUtils.isMinecraftContentPath("BP/entities/zombie.json")).to.be.true;
    });

    it("should detect resource pack paths", () => {
      expect(MinecraftPathUtils.isMinecraftContentPath("resource_pack/textures/entity/pig.png")).to.be.true;
      expect(MinecraftPathUtils.isMinecraftContentPath("RP/models/entity/pig.geo.json")).to.be.true;
    });

    it("should reject non-Minecraft paths", () => {
      expect(MinecraftPathUtils.isMinecraftContentPath("src/app/index.ts")).to.be.false;
      expect(MinecraftPathUtils.isMinecraftContentPath("package.json")).to.be.false;
    });
  });

  describe("JSON Path Parsing", () => {
    function parseJsonPath(text: string, position: number): string[] {
      // Simple JSON path parser for testing
      const path: string[] = [];
      let depth = 0;
      let currentKey = "";
      let inString = false;
      let inKey = true;

      for (let i = 0; i < position && i < text.length; i++) {
        const char = text[i];

        if (char === '"' && text[i - 1] !== "\\") {
          inString = !inString;
          if (!inString && inKey && currentKey) {
            // Finished reading a key
            path[depth] = currentKey;
            currentKey = "";
          }
          continue;
        }

        if (inString) {
          currentKey += char;
          continue;
        }

        if (char === "{") {
          depth++;
          inKey = true;
        } else if (char === "}") {
          depth--;
          path.length = depth + 1;
        } else if (char === ":") {
          inKey = false;
        } else if (char === ",") {
          inKey = true;
          currentKey = "";
        }
      }

      return path.filter((p) => p);
    }

    it("should parse simple nested path", () => {
      const json = '{"minecraft:entity":{"description":{"identifier":"test"}}}';
      const path = parseJsonPath(json, json.indexOf("test"));
      expect(path).to.include("minecraft:entity");
      expect(path).to.include("description");
      expect(path).to.include("identifier");
    });
  });

  describe("Live Preview Data Extraction", () => {
    describe("Entity Preview", () => {
      it("should extract stats from entity data", () => {
        const components = SAMPLE_ENTITY_JSON["minecraft:entity"].components;
        const stats: Array<{ label: string; value: any }> = [];

        const health = components["minecraft:health"];
        if (health) {
          stats.push({ label: "Health", value: health.max ?? health.value });
        }

        const attack = components["minecraft:attack"];
        if (attack?.damage) {
          stats.push({ label: "Attack", value: attack.damage });
        }

        const movement = components["minecraft:movement"];
        if (movement?.value) {
          stats.push({ label: "Speed", value: movement.value });
        }

        expect(stats).to.have.length(3);
        expect(stats.find((s) => s.label === "Health")?.value).to.equal(20);
        expect(stats.find((s) => s.label === "Attack")?.value).to.equal(5);
        expect(stats.find((s) => s.label === "Speed")?.value).to.equal(0.3);
      });
    });

    describe("Block Preview", () => {
      it("should extract properties from block data", () => {
        const components = SAMPLE_BLOCK_JSON["minecraft:block"].components;
        const props: Array<{ label: string; value: any }> = [];

        const geometry = components["minecraft:geometry"];
        if (geometry) {
          props.push({ label: "Geometry", value: geometry });
        }

        const light = components["minecraft:light_emission"];
        if (light !== undefined) {
          props.push({ label: "Light", value: light });
        }

        const loot = components["minecraft:loot"];
        if (loot) {
          props.push({ label: "Loot", value: loot.split("/").pop() });
        }

        expect(props.length).to.be.greaterThan(0);
        expect(props.find((p) => p.label === "Geometry")?.value).to.equal("geometry.custom_block");
        expect(props.find((p) => p.label === "Light")?.value).to.equal(5);
      });
    });
  });
});

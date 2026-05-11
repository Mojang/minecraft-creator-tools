// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * BlockTraitTest - Tests for block content trait implementations.
 *
 * Validates:
 * 1. All block traits register correctly with the TraitRegistry
 * 2. Each trait produces valid getData() output with correct components
 * 3. Traits only use non-deprecated Minecraft block components
 * 4. TraitDetector correctly identifies traits from components
 * 5. New traits (flammable, explosion_resistant, slippery, redstone_signal, fence) work correctly
 */

import { expect } from "chai";
import "mocha";
import { TraitRegistry, BlockContentTrait, IBlockTraitData } from "../minecraft/traits/ContentTraits";
import {
  registerAllBlockTraits,
  FlammableBlockTrait,
  ExplosionResistantBlockTrait,
  SlipperyBlockTrait,
  RedstoneProducerBlockTrait,
  FenceBlockTrait,
  LightSourceBlockTrait,
  CraftingStationBlockTrait,
  StoneMaterialBlockTrait,
  WoodMaterialBlockTrait,
  MetalMaterialBlockTrait,
  SoftMaterialBlockTrait,
  PassableBlockTrait,
  TransparentBlockTrait,
  RotatableHorizontalBlockTrait,
  RotatableAllBlockTrait,
  SlabBlockTrait,
  StairsBlockTrait,
} from "../minecraft/traits";

/**
 * Components that are deprecated in the bedrock-schemas and should NOT
 * appear in any trait output.
 */
const DEPRECATED_BLOCK_COMPONENTS = [
  "minecraft:on_interact",
  "minecraft:on_fall_on",
  "minecraft:on_placed",
  "minecraft:on_player_destroyed",
  "minecraft:on_player_placing",
  "minecraft:on_step_off",
  "minecraft:on_step_on",
  "minecraft:queued_ticking",
  "minecraft:random_ticking",
  "minecraft:unit_cube",
  "minecraft:breathability",
];

/**
 * Components that are entity-only and should NOT appear in block traits.
 */
const ENTITY_ONLY_COMPONENTS = [
  "minecraft:inventory",
  "minecraft:health",
  "minecraft:movement",
  "minecraft:attack",
  "minecraft:navigation.walk",
  "minecraft:behavior.melee_attack",
];

// ============================================================================
// REGISTRY TESTS
// ============================================================================

describe("Block Trait Registry", () => {
  before(() => {
    registerAllBlockTraits();
  });

  it("should register all expected block traits", () => {
    const expectedIds = [
      "stone_material",
      "wood_material",
      "metal_material",
      "soft_material",
      "door",
      "trapdoor",
      "button",
      "lever",
      "crafting_station",
      "redstone_signal",
      "rotatable_horizontal",
      "rotatable_all",
      "slab",
      "stairs",
      "fence",
      "light_source",
      "variable_light",
      "passable",
      "transparent",
      "gravity_affected",
      "crop",
      "flammable",
      "explosion_resistant",
      "slippery",
    ];

    for (const id of expectedIds) {
      const trait = TraitRegistry.getBlockTrait(id);
      expect(trait, `Trait '${id}' should be registered`).to.not.be.undefined;
    }
  });

  it("should not have a container trait registered", () => {
    const trait = TraitRegistry.getBlockTrait("container");
    expect(trait).to.be.undefined;
  });
});

// ============================================================================
// TRAIT DATA VALIDATION - TABLE-DRIVEN
// ============================================================================

interface ITraitTestCase {
  name: string;
  trait: BlockContentTrait;
  expectedId: string;
  expectedComponents: string[];
  forbiddenComponents?: string[];
  config?: Record<string, any>;
}

const TRAIT_TEST_CASES: ITraitTestCase[] = [
  // Materials
  {
    name: "StoneMaterialBlockTrait",
    trait: new StoneMaterialBlockTrait(),
    expectedId: "stone_material",
    expectedComponents: [
      "minecraft:destructible_by_mining",
      "minecraft:destructible_by_explosion",
      "minecraft:map_color",
    ],
  },
  {
    name: "WoodMaterialBlockTrait",
    trait: new WoodMaterialBlockTrait(),
    expectedId: "wood_material",
    expectedComponents: [
      "minecraft:destructible_by_mining",
      "minecraft:destructible_by_explosion",
      "minecraft:flammable",
      "minecraft:map_color",
    ],
  },
  {
    name: "MetalMaterialBlockTrait",
    trait: new MetalMaterialBlockTrait(),
    expectedId: "metal_material",
    expectedComponents: [
      "minecraft:destructible_by_mining",
      "minecraft:destructible_by_explosion",
      "minecraft:map_color",
    ],
  },
  {
    name: "SoftMaterialBlockTrait",
    trait: new SoftMaterialBlockTrait(),
    expectedId: "soft_material",
    expectedComponents: [
      "minecraft:destructible_by_mining",
      "minecraft:destructible_by_explosion",
      "minecraft:map_color",
    ],
  },

  // Interactive
  {
    name: "CraftingStationBlockTrait",
    trait: new CraftingStationBlockTrait(),
    expectedId: "crafting_station",
    expectedComponents: ["minecraft:crafting_table"],
  },
  {
    name: "RedstoneProducerBlockTrait",
    trait: new RedstoneProducerBlockTrait(),
    expectedId: "redstone_signal",
    expectedComponents: ["minecraft:redstone_producer", "minecraft:redstone_conductivity"],
  },

  // Placement
  {
    name: "RotatableHorizontalBlockTrait",
    trait: new RotatableHorizontalBlockTrait(),
    expectedId: "rotatable_horizontal",
    expectedComponents: ["minecraft:transformation"],
  },
  {
    name: "RotatableAllBlockTrait",
    trait: new RotatableAllBlockTrait(),
    expectedId: "rotatable_all",
    expectedComponents: ["minecraft:transformation"],
  },
  {
    name: "SlabBlockTrait",
    trait: new SlabBlockTrait(),
    expectedId: "slab",
    expectedComponents: ["minecraft:geometry", "minecraft:collision_box", "minecraft:selection_box"],
  },
  {
    name: "StairsBlockTrait",
    trait: new StairsBlockTrait(),
    expectedId: "stairs",
    expectedComponents: ["minecraft:geometry", "minecraft:transformation"],
  },
  {
    name: "FenceBlockTrait",
    trait: new FenceBlockTrait(),
    expectedId: "fence",
    expectedComponents: [
      "minecraft:geometry",
      "minecraft:collision_box",
      "minecraft:selection_box",
      "minecraft:support",
      "minecraft:connection_rule",
    ],
  },

  // Special / Properties
  {
    name: "LightSourceBlockTrait",
    trait: new LightSourceBlockTrait(),
    expectedId: "light_source",
    expectedComponents: ["minecraft:light_emission"],
  },
  {
    name: "PassableBlockTrait",
    trait: new PassableBlockTrait(),
    expectedId: "passable",
    expectedComponents: ["minecraft:collision_box"],
  },
  {
    name: "TransparentBlockTrait",
    trait: new TransparentBlockTrait(),
    expectedId: "transparent",
    expectedComponents: ["minecraft:light_dampening"],
  },
  {
    name: "FlammableBlockTrait",
    trait: new FlammableBlockTrait(),
    expectedId: "flammable",
    expectedComponents: ["minecraft:flammable"],
  },
  {
    name: "ExplosionResistantBlockTrait",
    trait: new ExplosionResistantBlockTrait(),
    expectedId: "explosion_resistant",
    expectedComponents: ["minecraft:destructible_by_explosion"],
  },
  {
    name: "SlipperyBlockTrait",
    trait: new SlipperyBlockTrait(),
    expectedId: "slippery",
    expectedComponents: ["minecraft:friction"],
  },
];

describe("Block Trait getData()", () => {
  for (const tc of TRAIT_TEST_CASES) {
    describe(tc.name, () => {
      let data: IBlockTraitData;

      before(() => {
        data = tc.trait.getData(tc.config);
      });

      it(`should have id '${tc.expectedId}'`, () => {
        expect(data.id).to.equal(tc.expectedId);
        expect(tc.trait.id).to.equal(tc.expectedId);
      });

      it("should have displayName and description", () => {
        expect(data.displayName).to.be.a("string").and.not.be.empty;
        expect(data.description).to.be.a("string").and.not.be.empty;
      });

      it("should have a valid category", () => {
        expect(data.category).to.be.a("string").and.not.be.empty;
      });

      for (const comp of tc.expectedComponents) {
        it(`should include component '${comp}'`, () => {
          expect(data.components).to.have.property(comp);
        });
      }

      it("should not use any deprecated components", () => {
        for (const dep of DEPRECATED_BLOCK_COMPONENTS) {
          expect(data.components, `Should not have deprecated component '${dep}'`).to.not.have.property(dep);
        }
      });

      it("should not use any entity-only components", () => {
        for (const entComp of ENTITY_ONLY_COMPONENTS) {
          expect(data.components, `Should not have entity-only component '${entComp}'`).to.not.have.property(entComp);
        }
      });
    });
  }
});

// ============================================================================
// SPECIFIC COMPONENT VALUE TESTS
// ============================================================================

describe("FlammableBlockTrait component values", () => {
  it("should use default catch/destroy chances", () => {
    const data = new FlammableBlockTrait().getData();
    const flammable = data.components["minecraft:flammable"];
    expect(flammable.catch_chance_modifier).to.equal(5);
    expect(flammable.destroy_chance_modifier).to.equal(20);
  });

  it("should accept custom catch/destroy chances via config", () => {
    const data = new FlammableBlockTrait().getData({
      catchChanceModifier: 10,
      destroyChanceModifier: 50,
    });
    const flammable = data.components["minecraft:flammable"];
    expect(flammable.catch_chance_modifier).to.equal(10);
    expect(flammable.destroy_chance_modifier).to.equal(50);
  });
});

describe("ExplosionResistantBlockTrait component values", () => {
  it("should use high default resistance", () => {
    const data = new ExplosionResistantBlockTrait().getData();
    const explosion = data.components["minecraft:destructible_by_explosion"];
    expect(explosion.explosion_resistance).to.be.at.least(1000);
  });

  it("should accept custom resistance via config", () => {
    const data = new ExplosionResistantBlockTrait().getData({ explosionResistance: 500 });
    const explosion = data.components["minecraft:destructible_by_explosion"];
    expect(explosion.explosion_resistance).to.equal(500);
  });
});

describe("SlipperyBlockTrait component values", () => {
  it("should default to very low friction (0.1)", () => {
    const data = new SlipperyBlockTrait().getData();
    expect(data.components["minecraft:friction"]).to.equal(0.1);
  });

  it("should accept custom friction via config", () => {
    const data = new SlipperyBlockTrait().getData({ friction: 0.05 });
    expect(data.components["minecraft:friction"]).to.equal(0.05);
  });
});

describe("RedstoneProducerBlockTrait component values", () => {
  it("should default to full power (15)", () => {
    const data = new RedstoneProducerBlockTrait().getData();
    const producer = data.components["minecraft:redstone_producer"];
    expect(producer.power).to.equal(15);
    expect(producer.connected_faces).to.have.lengthOf(6);
  });

  it("should accept custom power via config", () => {
    const data = new RedstoneProducerBlockTrait().getData({ redstonePower: 7 });
    expect(data.components["minecraft:redstone_producer"].power).to.equal(7);
  });

  it("should include redstone_conductivity", () => {
    const data = new RedstoneProducerBlockTrait().getData();
    const conductivity = data.components["minecraft:redstone_conductivity"];
    expect(conductivity.redstone_conductor).to.be.true;
    expect(conductivity.allows_wire_to_step_down).to.be.true;
  });
});

describe("FenceBlockTrait component values", () => {
  it("should include fence geometry with bone_visibility", () => {
    const data = new FenceBlockTrait().getData();
    const geo = data.components["minecraft:geometry"];
    expect(geo.identifier).to.equal("geometry.fence");
    expect(geo.bone_visibility).to.have.property("arm_north");
    expect(geo.bone_visibility).to.have.property("arm_south");
    expect(geo.bone_visibility).to.have.property("arm_east");
    expect(geo.bone_visibility).to.have.property("arm_west");
  });

  it("should include support shape 'fence'", () => {
    const data = new FenceBlockTrait().getData();
    expect(data.components["minecraft:support"].shape).to.equal("fence");
  });

  it("should include connection_rule accepting all connections", () => {
    const data = new FenceBlockTrait().getData();
    const rule = data.components["minecraft:connection_rule"];
    expect(rule.accepts_connections_from).to.equal("all");
    expect(rule.enabled_directions).to.have.lengthOf(4);
  });

  it("should use minecraft:connection trait for cardinal states", () => {
    const data = new FenceBlockTrait().getData();
    expect(data.minecraftTraits).to.have.property("minecraft:connection");
    expect(data.minecraftTraits!["minecraft:connection"].enabled_states).to.include("minecraft:cardinal_connections");
  });

  it("should include fence geometry file", () => {
    const data = new FenceBlockTrait().getData();
    expect(data.geometryFiles).to.have.lengthOf(1);
    expect(data.geometryFiles![0].path).to.include("fence");
  });
});

// ============================================================================
// GEOMETRY FILE TESTS
// ============================================================================

describe("Block traits with geometry files", () => {
  const traitsWithGeometry: { name: string; trait: BlockContentTrait }[] = [
    { name: "SlabBlockTrait", trait: new SlabBlockTrait() },
    { name: "StairsBlockTrait", trait: new StairsBlockTrait() },
    { name: "FenceBlockTrait", trait: new FenceBlockTrait() },
  ];

  for (const { name, trait } of traitsWithGeometry) {
    it(`${name} should have valid geometry files`, () => {
      const data = trait.getData();
      expect(data.geometryFiles).to.be.an("array").and.not.be.empty;

      for (const geoFile of data.geometryFiles!) {
        expect(geoFile.path).to.be.a("string").and.not.be.empty;
        expect(geoFile.content).to.be.an("object");
        expect(geoFile.content).to.have.property("format_version");
        expect(geoFile.content).to.have.property("minecraft:geometry");
      }
    });
  }
});

// ============================================================================
// MINECRAFT NATIVE TRAITS TESTS
// ============================================================================

describe("Block traits with minecraftTraits", () => {
  it("SlabBlockTrait should use placement_position with vertical_half", () => {
    const data = new SlabBlockTrait().getData();
    expect(data.minecraftTraits).to.have.property("minecraft:placement_position");
    expect(data.minecraftTraits!["minecraft:placement_position"].enabled_states).to.include("minecraft:vertical_half");
  });

  it("StairsBlockTrait should use placement_position and connection", () => {
    const data = new StairsBlockTrait().getData();
    expect(data.minecraftTraits).to.have.property("minecraft:placement_position");
    expect(data.minecraftTraits).to.have.property("minecraft:connection");
  });

  it("FenceBlockTrait should use connection trait", () => {
    const data = new FenceBlockTrait().getData();
    expect(data.minecraftTraits).to.have.property("minecraft:connection");
  });
});

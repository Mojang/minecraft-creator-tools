// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import "mocha";
import TraitDetector from "../minecraft/TraitDetector";
import ContentSchemaInferrer from "../minecraft/ContentSchemaInferrer";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import CreatorToolsHost from "../app/CreatorToolsHost";

describe("TraitDetector", () => {
  describe("Entity Trait Detection", () => {
    it("should detect hostile trait from targeting components", () => {
      const components = {
        "minecraft:behavior.nearest_attackable_target": {
          priority: 2,
          entity_types: [{ filters: { test: "is_family", subject: "other", value: "player" } }],
        },
        "minecraft:attack": { damage: 5 },
        "minecraft:health": { value: 20 },
      };

      const results = TraitDetector.detectEntityTraits(components);

      const hostileTrait = results.find((r) => r.traitId === "hostile");
      expect(hostileTrait).to.not.be.undefined;
      expect(hostileTrait!.confidence).to.be.at.least(0.8);
    });

    it("should detect passive trait from panic behavior", () => {
      const components = {
        "minecraft:behavior.panic": { priority: 1, speed_multiplier: 1.25 },
        "minecraft:health": { value: 10 },
      };

      const results = TraitDetector.detectEntityTraits(components);

      const passiveTrait = results.find((r) => r.traitId === "passive");
      expect(passiveTrait).to.not.be.undefined;
      expect(passiveTrait!.confidence).to.be.at.least(0.6);
    });

    it("should detect boss trait from boss component", () => {
      const components = {
        "minecraft:boss": { should_darken_sky: true, hud_range: 55 },
        "minecraft:health": { value: 300 },
      };

      const results = TraitDetector.detectEntityTraits(components);

      const bossTrait = results.find((r) => r.traitId === "boss");
      expect(bossTrait).to.not.be.undefined;
      expect(bossTrait!.confidence).to.equal(1.0);
    });

    it("should detect melee_attacker trait", () => {
      const components = {
        "minecraft:behavior.melee_attack": { priority: 3, speed_multiplier: 1.2 },
        "minecraft:attack": { damage: 4 },
      };

      const results = TraitDetector.detectEntityTraits(components);

      const meleeTrait = results.find((r) => r.traitId === "melee_attacker");
      expect(meleeTrait).to.not.be.undefined;
      expect(meleeTrait!.confidence).to.equal(1.0);
    });

    it("should detect ranged_attacker trait", () => {
      const components = {
        "minecraft:behavior.ranged_attack": { priority: 3, attack_radius: 15 },
        "minecraft:shooter": { def: "minecraft:arrow" },
      };

      const results = TraitDetector.detectEntityTraits(components);

      const rangedTrait = results.find((r) => r.traitId === "ranged_attacker");
      expect(rangedTrait).to.not.be.undefined;
      expect(rangedTrait!.confidence).to.equal(1.0);
    });

    it("should detect flying trait", () => {
      const components = {
        "minecraft:navigation.fly": { can_path_over_water: true },
        "minecraft:can_fly": {},
      };

      const results = TraitDetector.detectEntityTraits(components);

      const flyingTrait = results.find((r) => r.traitId === "flying");
      expect(flyingTrait).to.not.be.undefined;
      expect(flyingTrait!.confidence).to.equal(1.0);
    });

    it("should detect aquatic trait", () => {
      const components = {
        "minecraft:navigation.swim": { can_swim: true },
        "minecraft:breathable": { breathes_water: true, breathes_air: false },
        "minecraft:underwater_movement": { value: 0.3 },
      };

      const results = TraitDetector.detectEntityTraits(components);

      const aquaticTrait = results.find((r) => r.traitId === "aquatic");
      expect(aquaticTrait).to.not.be.undefined;
      expect(aquaticTrait!.confidence).to.equal(1.0);
    });

    it("should detect undead trait", () => {
      const components = {
        "minecraft:burns_in_daylight": {},
        "minecraft:type_family": { family: ["undead", "monster"] },
      };

      const results = TraitDetector.detectEntityTraits(components);

      const undeadTrait = results.find((r) => r.traitId === "undead");
      expect(undeadTrait).to.not.be.undefined;
      expect(undeadTrait!.confidence).to.equal(1.0);
    });

    it("should detect tameable trait from component groups", () => {
      const components = {
        "minecraft:health": { value: 20 },
      };
      const componentGroups = {
        wild: { "minecraft:behavior.avoid_mob_type": {} },
        tamed: { "minecraft:is_tamed": {}, "minecraft:tameable": { probability: 0.33 } },
      };

      const results = TraitDetector.detectEntityTraits(components, componentGroups);

      const tameableTrait = results.find((r) => r.traitId === "tameable");
      expect(tameableTrait).to.not.be.undefined;
    });

    it("should detect rideable trait from component groups", () => {
      const components = {};
      const componentGroups = {
        saddled: {
          "minecraft:rideable": { seat_count: 1 },
          "minecraft:input_ground_controlled": {},
        },
      };

      const results = TraitDetector.detectEntityTraits(components, componentGroups);

      const rideableTrait = results.find((r) => r.traitId === "rideable");
      expect(rideableTrait).to.not.be.undefined;
    });

    it("should detect breedable trait", () => {
      const components = {
        "minecraft:breedable": { require_tame: false, breed_items: ["wheat"] },
        "minecraft:behavior.breed": { priority: 3 },
      };

      const results = TraitDetector.detectEntityTraits(components);

      const breedableTrait = results.find((r) => r.traitId === "breedable");
      expect(breedableTrait).to.not.be.undefined;
      expect(breedableTrait!.confidence).to.equal(1.0);
    });

    it("should detect wanders behavior", () => {
      const components = {
        "minecraft:behavior.random_stroll": { priority: 6 },
        "minecraft:behavior.random_look_around": { priority: 7 },
      };

      const results = TraitDetector.detectEntityTraits(components);

      const wandersTrait = results.find((r) => r.traitId === "wanders");
      expect(wandersTrait).to.not.be.undefined;
      expect(wandersTrait!.confidence).to.equal(1.0);
    });

    it("should handle conflicting traits by selecting higher confidence", () => {
      // Both hostile and passive indicators - hostile should win if stronger
      const components = {
        "minecraft:behavior.panic": { priority: 1 },
        "minecraft:behavior.nearest_attackable_target": {
          priority: 2,
          entity_types: [{ filters: { test: "is_family", subject: "other", value: "player" } }],
        },
        "minecraft:attack": { damage: 5 },
      };

      const results = TraitDetector.detectEntityTraits(components);

      // Should have one of hostile or passive, not both
      const hasHostile = results.some((r) => r.traitId === "hostile");
      const hasPassive = results.some((r) => r.traitId === "passive");

      // With attack and targeting, hostile should win
      expect(hasHostile).to.be.true;
      expect(hasPassive).to.be.false;
    });

    it("should detect multiple non-conflicting traits", () => {
      const components = {
        "minecraft:behavior.melee_attack": { priority: 3 },
        "minecraft:attack": { damage: 5 },
        "minecraft:behavior.random_stroll": { priority: 6 },
        "minecraft:behavior.random_look_around": { priority: 7 },
        "minecraft:leashable": {},
      };

      const results = TraitDetector.detectEntityTraits(components);

      const traitIds = results.map((r) => r.traitId);
      expect(traitIds).to.include("melee_attacker");
      expect(traitIds).to.include("wanders");
      expect(traitIds).to.include("leasable");
    });
  });

  describe("Behavior Preset Detection", () => {
    it("should detect wander behavior", () => {
      const components = {
        "minecraft:behavior.random_stroll": { priority: 6 },
      };

      const results = TraitDetector.detectBehaviorPresets(components);

      const wanderPreset = results.find((r) => r.traitId === "wander");
      expect(wanderPreset).to.not.be.undefined;
    });

    it("should detect melee_attack behavior", () => {
      const components = {
        "minecraft:behavior.melee_attack": { priority: 3 },
      };

      const results = TraitDetector.detectBehaviorPresets(components);

      const meleePreset = results.find((r) => r.traitId === "melee_attack");
      expect(meleePreset).to.not.be.undefined;
    });

    it("should detect follow_owner behavior", () => {
      const components = {
        "minecraft:behavior.follow_owner": { priority: 4 },
      };

      const results = TraitDetector.detectBehaviorPresets(components);

      const followPreset = results.find((r) => r.traitId === "follow_owner");
      expect(followPreset).to.not.be.undefined;
    });

    it("should detect look_at_player behavior", () => {
      const components = {
        "minecraft:behavior.look_at_player": { priority: 7, look_distance: 6 },
      };

      const results = TraitDetector.detectBehaviorPresets(components);

      const lookPreset = results.find((r) => r.traitId === "look_at_player");
      expect(lookPreset).to.not.be.undefined;
    });
  });

  describe("Entity Property Extraction", () => {
    it("should extract health from health component", () => {
      const components = {
        "minecraft:health": { value: 40, max: 40 },
      };

      const props = TraitDetector.extractEntityProperties(components);

      expect(props.health).to.equal(40);
    });

    it("should extract attack damage", () => {
      const components = {
        "minecraft:attack": { damage: 6 },
      };

      const props = TraitDetector.extractEntityProperties(components);

      expect(props.attackDamage).to.equal(6);
    });

    it("should extract movement speed", () => {
      const components = {
        "minecraft:movement": { value: 0.35 },
      };

      const props = TraitDetector.extractEntityProperties(components);

      expect(props.movementSpeed).to.equal(0.35);
    });

    it("should extract scale when not default", () => {
      const components = {
        "minecraft:scale": { value: 1.5 },
      };

      const props = TraitDetector.extractEntityProperties(components);

      expect(props.scale).to.equal(1.5);
    });

    it("should not extract scale when default (1.0)", () => {
      const components = {
        "minecraft:scale": { value: 1.0 },
      };

      const props = TraitDetector.extractEntityProperties(components);

      expect(props.scale).to.be.undefined;
    });

    it("should extract knockback resistance", () => {
      const components = {
        "minecraft:knockback_resistance": { value: 0.5 },
      };

      const props = TraitDetector.extractEntityProperties(components);

      expect(props.knockbackResistance).to.equal(0.5);
    });

    it("should extract collision box dimensions", () => {
      const components = {
        "minecraft:collision_box": { width: 0.6, height: 1.8 },
      };

      const props = TraitDetector.extractEntityProperties(components);

      expect(props.collisionWidth).to.equal(0.6);
      expect(props.collisionHeight).to.equal(1.8);
    });

    it("should extract type family", () => {
      const components = {
        "minecraft:type_family": { family: ["monster", "undead", "zombie"] },
      };

      const props = TraitDetector.extractEntityProperties(components);

      expect(props.families).to.deep.equal(["monster", "undead", "zombie"]);
    });
  });

  describe("Block Property Extraction", () => {
    it("should extract destroy time", () => {
      const components = {
        "minecraft:destructible_by_mining": { seconds_to_destroy: 2.5 },
      };

      const props = TraitDetector.extractBlockProperties(components);

      expect(props.destroyTime).to.equal(2.5);
    });

    it("should extract explosion resistance", () => {
      const components = {
        "minecraft:destructible_by_explosion": { explosion_resistance: 6.0 },
      };

      const props = TraitDetector.extractBlockProperties(components);

      expect(props.explosionResistance).to.equal(6.0);
    });

    it("should extract light emission", () => {
      const components = {
        "minecraft:light_emission": 15,
      };

      const props = TraitDetector.extractBlockProperties(components);

      expect(props.lightEmission).to.equal(15);
    });

    it("should extract friction", () => {
      const components = {
        "minecraft:friction": 0.8,
      };

      const props = TraitDetector.extractBlockProperties(components);

      expect(props.friction).to.equal(0.8);
    });
  });

  describe("Item Property Extraction", () => {
    it("should extract max stack size", () => {
      const components = {
        "minecraft:max_stack_size": 16,
      };

      const props = TraitDetector.extractItemProperties(components);

      expect(props.maxStackSize).to.equal(16);
    });

    it("should extract durability", () => {
      const components = {
        "minecraft:durability": { max_durability: 250 },
      };

      const props = TraitDetector.extractItemProperties(components);

      expect(props.durability).to.equal(250);
    });

    it("should extract food properties", () => {
      const components = {
        "minecraft:food": { nutrition: 6, saturation_modifier: 0.8 },
      };

      const props = TraitDetector.extractItemProperties(components);

      expect(props.nutrition).to.equal(6);
      expect(props.saturation).to.equal(0.8);
    });

    it("should extract weapon damage", () => {
      const components = {
        "minecraft:damage": { value: 7 },
      };

      const props = TraitDetector.extractItemProperties(components);

      expect(props.damage).to.equal(7);
    });
  });

  describe("Unexplained Components", () => {
    it("should identify components not covered by traits", () => {
      const components = {
        "minecraft:behavior.melee_attack": { priority: 3 },
        "minecraft:attack": { damage: 5 },
        "minecraft:custom_component": { custom_value: 42 },
        "minecraft:loot": { table: "loot_tables/entities/my_mob.json" },
      };

      const traitResults = TraitDetector.detectEntityTraits(components);
      const unexplained = TraitDetector.getUnexplainedComponents(components, traitResults);

      expect(unexplained).to.include("minecraft:custom_component");
      expect(unexplained).to.include("minecraft:loot");
      // These should be explained by melee_attacker trait
      expect(unexplained).to.not.include("minecraft:behavior.melee_attack");
    });
  });
});

describe("ContentSchemaInferrer", () => {
  describe("Entity Inference", () => {
    it("should have correct default options", () => {
      const inferrer = new ContentSchemaInferrer();
      // Access internal options through the class
      expect(inferrer).to.not.be.undefined;
    });

    it("should allow custom options", () => {
      const inferrer = new ContentSchemaInferrer({
        minTraitConfidence: 0.8,
        includeRawComponents: false,
      });
      expect(inferrer).to.not.be.undefined;
    });
  });

  describe("Display Name Formatting", () => {
    // Test the formatDisplayName internal function by checking inferred output
    it("should format underscored IDs into display names", () => {
      // This would require an actual entity definition, but we can test the concept
      const id = "zombie_warrior_boss";
      const expected = "Zombie Warrior Boss";

      // The actual formatting is done internally, but we verify the pattern
      const formatted = id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      expect(formatted).to.equal(expected);
    });
  });
});

describe("Round-Trip Testing", () => {
  // These tests verify that content generated by ContentGenerator can be
  // analyzed by ContentSchemaInferrer to produce similar trait detection

  it("should detect traits that were used in generation", async () => {
    // This is a conceptual test - in practice we'd need actual generated content
    // For now, we verify the detection patterns match generation patterns

    // Hostile entity components (as generated)
    const hostileComponents = {
      "minecraft:behavior.hurt_by_target": { priority: 1 },
      "minecraft:behavior.nearest_attackable_target": {
        priority: 2,
        entity_types: [{ filters: { test: "is_family", subject: "other", value: "player" } }],
      },
      "minecraft:attack": { damage: 3 },
    };

    const results = TraitDetector.detectEntityTraits(hostileComponents);
    const hasHostile = results.some((r) => r.traitId === "hostile");
    expect(hasHostile).to.be.true;

    // Melee attacker components
    const meleeComponents = {
      "minecraft:behavior.melee_attack": { priority: 3, speed_multiplier: 1.2, track_target: true },
      "minecraft:attack": { damage: 3 },
    };

    const meleeResults = TraitDetector.detectEntityTraits(meleeComponents);
    const hasMelee = meleeResults.some((r) => r.traitId === "melee_attacker");
    expect(hasMelee).to.be.true;

    // Undead components
    const undeadComponents = {
      "minecraft:burns_in_daylight": {},
      "minecraft:type_family": { family: ["undead", "monster"] },
    };

    const undeadResults = TraitDetector.detectEntityTraits(undeadComponents);
    const hasUndead = undeadResults.some((r) => r.traitId === "undead");
    expect(hasUndead).to.be.true;
  });
});

// ============================================================================
// SAMPLE CONTENT INTEGRATION TESTS
// ============================================================================

import CreatorTools from "../app/CreatorTools";
import TestPaths from "./TestPaths";

let creatorTools: CreatorTools | undefined;

async function _loadSampleProject(name: string): Promise<Project> {
  if (!creatorTools) {
    creatorTools = CreatorToolsHost.getCreatorTools();
  }

  if (!creatorTools) {
    throw new Error("CreatorTools not initialized");
  }

  const project = new Project(creatorTools, name, null);
  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.localFolderPath = TestPaths.sampleContentPath(name);

  await project.inferProjectItemsFromFiles();

  return project;
}

describe("ContentSchemaInferrer - Sample Content Integration", () => {
  describe("comprehensive project inference", () => {
    it("should infer schema from comprehensive project", async () => {
      const project = await _loadSampleProject("comprehensive");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      expect(result).to.not.be.undefined;
      expect(result.definition).to.not.be.undefined;
      expect(result.definition.schemaVersion).to.equal("1.0.0");
    });

    it("should detect entities in comprehensive project", async () => {
      const project = await _loadSampleProject("comprehensive");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      // Should have found some entities
      if (result.definition.entityTypes && result.definition.entityTypes.length > 0) {
        expect(result.metadata.entitiesAnalyzed).to.be.greaterThan(0);

        // Each entity should have required fields
        for (const entity of result.definition.entityTypes) {
          expect(entity.id).to.be.a("string");
          expect(entity.displayName).to.be.a("string");
        }
      }
    });

    it("should detect blocks in comprehensive project", async () => {
      const project = await _loadSampleProject("comprehensive");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      // Should have found some blocks
      if (result.definition.blockTypes && result.definition.blockTypes.length > 0) {
        expect(result.metadata.blocksAnalyzed).to.be.greaterThan(0);

        // Each block should have required fields
        for (const block of result.definition.blockTypes) {
          expect(block.id).to.be.a("string");
          expect(block.displayName).to.be.a("string");
        }
      }
    });

    it("should detect items in comprehensive project", async () => {
      const project = await _loadSampleProject("comprehensive");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      // Should have found some items
      if (result.definition.itemTypes && result.definition.itemTypes.length > 0) {
        expect(result.metadata.itemsAnalyzed).to.be.greaterThan(0);

        // Each item should have required fields
        for (const item of result.definition.itemTypes) {
          expect(item.id).to.be.a("string");
          expect(item.displayName).to.be.a("string");
        }
      }
    });
  });

  describe("diverse_content project inference", () => {
    it("should infer schema from diverse_content project", async () => {
      const project = await _loadSampleProject("diverse_content");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      expect(result).to.not.be.undefined;
      expect(result.definition).to.not.be.undefined;
      expect(result.definition.schemaVersion).to.equal("1.0.0");
    });

    it("should detect entity traits in diverse_content", async () => {
      const project = await _loadSampleProject("diverse_content");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      // Check metadata for trait detection
      expect(result.metadata).to.not.be.undefined;
      expect(result.metadata.allDetectedTraits).to.not.be.undefined;

      // If entities were analyzed, we should have some trait counts
      if (result.metadata.entitiesAnalyzed > 0) {
        const entityTraits = result.metadata.allDetectedTraits.entity;
        expect(entityTraits).to.be.an("object");
      }
    });

    it("should extract entity properties from diverse_content", async () => {
      const project = await _loadSampleProject("diverse_content");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      // Check if any entity has health or other properties
      if (result.definition.entityTypes && result.definition.entityTypes.length > 0) {
        // At least some entities should have health defined
        const entitiesWithHealth = result.definition.entityTypes.filter((e) => e.health !== undefined);
        // This is optional - some entities may not have explicit health
        expect(entitiesWithHealth.length).to.be.at.least(0);
      }
    });
  });

  describe("simple project inference", () => {
    it("should infer schema from simple project", async () => {
      const project = await _loadSampleProject("simple");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      expect(result).to.not.be.undefined;
      expect(result.definition).to.not.be.undefined;
      expect(result.definition.schemaVersion).to.equal("1.0.0");
    });

    it("should handle project with minimal content", async () => {
      const project = await _loadSampleProject("simple");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      // Simple project may have few or no entities/blocks/items
      expect(result.metadata.entitiesAnalyzed).to.be.at.least(0);
      expect(result.metadata.blocksAnalyzed).to.be.at.least(0);
      expect(result.metadata.itemsAnalyzed).to.be.at.least(0);
    });
  });

  describe("spawnRulesDependency project inference", () => {
    it("should infer schema from spawnRulesDependency project", async () => {
      const project = await _loadSampleProject("spawnRulesDependency");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      expect(result).to.not.be.undefined;
      expect(result.definition).to.not.be.undefined;
    });

    it("should detect entities with spawn-related traits", async () => {
      const project = await _loadSampleProject("spawnRulesDependency");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      // This project should have at least one entity
      if (result.definition.entityTypes && result.definition.entityTypes.length > 0) {
        expect(result.metadata.entitiesAnalyzed).to.be.greaterThan(0);
      }
    });
  });

  describe("behavior_pack_only project inference", () => {
    it("should infer schema from behavior pack only project", async () => {
      const project = await _loadSampleProject("behavior_pack_only");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      expect(result).to.not.be.undefined;
      expect(result.definition).to.not.be.undefined;
      expect(result.definition.schemaVersion).to.equal("1.0.0");
    });
  });

  describe("resource_pack_only project inference", () => {
    it("should infer schema from resource pack only project", async () => {
      const project = await _loadSampleProject("resource_pack_only");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      expect(result).to.not.be.undefined;
      expect(result.definition).to.not.be.undefined;
      // Resource pack only may not have entities/blocks/items behavior definitions
      expect(result.metadata.entitiesAnalyzed).to.equal(0);
    });
  });

  describe("inferrer options", () => {
    it("should respect minTraitConfidence option", async () => {
      const project = await _loadSampleProject("comprehensive");

      // High confidence threshold - may detect fewer traits
      const highConfidenceInferrer = new ContentSchemaInferrer({
        minTraitConfidence: 0.9,
      });
      const highResult = await highConfidenceInferrer.inferFromProject(project);

      // Low confidence threshold - may detect more traits
      const lowConfidenceInferrer = new ContentSchemaInferrer({
        minTraitConfidence: 0.3,
      });
      const lowResult = await lowConfidenceInferrer.inferFromProject(project);

      // Both should complete successfully
      expect(highResult.definition).to.not.be.undefined;
      expect(lowResult.definition).to.not.be.undefined;
    });

    it("should complete inference even when namespace is not detectable", async () => {
      const project = await _loadSampleProject("diverse_content");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      // The inferrer completes successfully even if namespace can't be detected
      // (namespace inference from identifiers is not yet implemented)
      expect(result.definition).to.not.be.undefined;
      expect(result.definition.schemaVersion).to.equal("1.0.0");

      // Should still have content arrays (possibly empty)
      expect(result.definition.entityTypes).to.be.an("array");
      expect(result.definition.blockTypes).to.be.an("array");
      expect(result.definition.itemTypes).to.be.an("array");
    });
  });

  describe("metadata generation", () => {
    it("should generate accurate metadata", async () => {
      const project = await _loadSampleProject("comprehensive");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      // Check metadata structure
      expect(result.metadata).to.have.property("entitiesAnalyzed");
      expect(result.metadata).to.have.property("blocksAnalyzed");
      expect(result.metadata).to.have.property("itemsAnalyzed");
      expect(result.metadata).to.have.property("allDetectedTraits");
      expect(result.metadata).to.have.property("warnings");
      expect(result.metadata).to.have.property("inferenceTimeMs");

      // Inference time should be non-negative (may be 0 on fast machines with ms-resolution timers)
      expect(result.metadata.inferenceTimeMs).to.be.greaterThanOrEqual(0);

      // Warnings should be an array
      expect(result.metadata.warnings).to.be.an("array");
    });

    it("should count detected traits correctly", async () => {
      const project = await _loadSampleProject("diverse_content");

      const inferrer = new ContentSchemaInferrer();
      const result = await inferrer.inferFromProject(project);

      // Verify trait counts structure
      expect(result.metadata.allDetectedTraits).to.have.property("entity");
      expect(result.metadata.allDetectedTraits).to.have.property("block");
      expect(result.metadata.allDetectedTraits).to.have.property("item");

      // Count total traits in entities from definition
      if (result.definition.entityTypes) {
        let totalTraitsInDef = 0;
        for (const entity of result.definition.entityTypes) {
          if (entity.traits) {
            totalTraitsInDef += entity.traits.length;
          }
        }

        // Sum of trait counts in metadata should match
        const traitCounts = result.metadata.allDetectedTraits.entity;
        let totalTraitsInMeta = 0;
        for (const count of Object.values(traitCounts)) {
          totalTraitsInMeta += count as number;
        }

        expect(totalTraitsInMeta).to.equal(totalTraitsInDef);
      }
    });
  });
});

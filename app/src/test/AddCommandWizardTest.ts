// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * AddCommandWizardTest - Tests for the content wizard integration in AddCommand.
 *
 * Validates:
 * 1. buildDefinitionFromFlags produces correct IMinecraftContentDefinition for entity/block/item
 * 2. validateWizardFlags rejects out-of-range values and invalid traits
 * 3. shouldUseWizardMode correctly detects when to use wizard vs gallery mode
 * 4. ContentWriter can write generated content to a project (integration)
 */

import { expect } from "chai";
import "mocha";
import {
  buildDefinitionFromFlags,
  validateWizardFlags,
  shouldUseWizardMode,
} from "../app/toolcommands/commands/AddCommand";

// ============================================================================
// buildDefinitionFromFlags
// ============================================================================

describe("buildDefinitionFromFlags", () => {
  // --- Entity ---

  it("should build a default entity definition with minimal flags", () => {
    const def = buildDefinitionFromFlags("entity", "my_mob", undefined, {});
    expect(def.schemaVersion).to.equal("1.0.0");
    expect(def.namespace).to.equal("custom");
    expect(def.entityTypes).to.have.lengthOf(1);

    const entity = def.entityTypes![0];
    expect(entity.id).to.equal("my_mob");
    expect(entity.displayName).to.equal("My Mob");
    expect(entity.health).to.equal(20);
    expect(entity.attackDamage).to.equal(3);
    expect(entity.movementSpeed).to.equal(0.25);
    expect(entity.appearance?.bodyType).to.equal("humanoid");
    expect(entity.appearance?.primaryColor).to.equal("#4A7BA5");
  });

  it("should apply entity traits and custom properties", () => {
    const def = buildDefinitionFromFlags("entity", "orc", ["hostile", "melee_attacker", "humanoid"], {
      health: "30",
      damage: "6",
      speed: "0.4",
      color: "#FF0000",
      "secondary-color": "#00FF00",
      namespace: "dungeon",
      "display-name": "Mighty Orc",
    } as any);

    const entity = def.entityTypes![0];
    expect(def.namespace).to.equal("dungeon");
    expect(entity.displayName).to.equal("Mighty Orc");
    expect(entity.traits).to.deep.include("hostile");
    expect(entity.traits).to.deep.include("melee_attacker");
    expect(entity.traits).to.deep.include("humanoid");
    expect(entity.health).to.equal(30);
    expect(entity.attackDamage).to.equal(6);
    expect(entity.movementSpeed).to.equal(0.4);
    expect(entity.appearance?.primaryColor).to.equal("#FF0000");
    expect(entity.appearance?.secondaryColor).to.equal("#00FF00");
  });

  it("should prioritize --body-type flag over traits for body type", () => {
    const def = buildDefinitionFromFlags("entity", "bird", ["humanoid", "flying"], {
      "body-type": "flying",
    } as any);

    const entity = def.entityTypes![0];
    // "humanoid" should be removed, "flying" should remain
    expect(entity.traits).to.include("flying");
    expect(entity.traits).to.not.include("humanoid");
    expect(entity.appearance?.bodyType).to.equal("flying");
  });

  // --- Block ---

  it("should build a default block definition with minimal flags", () => {
    const def = buildDefinitionFromFlags("block", "my_brick", undefined, {});
    expect(def.blockTypes).to.have.lengthOf(1);

    const block = def.blockTypes![0];
    expect(block.id).to.equal("my_brick");
    expect(block.displayName).to.equal("My Brick");
    expect(block.destroyTime).to.equal(3);
    expect(block.lightEmission).to.equal(0);
  });

  it("should apply block traits and properties", () => {
    const def = buildDefinitionFromFlags("block", "glowstone_brick", ["solid", "light_source"], {
      "destroy-time": "5",
      "light-emission": "12",
      color: "#FFAA00",
    } as any);

    const block = def.blockTypes![0];
    expect(block.traits).to.deep.equal(["solid", "light_source"]);
    expect(block.destroyTime).to.equal(5);
    expect(block.lightEmission).to.equal(12);
    expect(block.mapColor).to.equal("#FFAA00");
  });

  // --- Item ---

  it("should build a default item definition with minimal flags", () => {
    const def = buildDefinitionFromFlags("item", "my_gem", undefined, {});
    expect(def.itemTypes).to.have.lengthOf(1);

    const item = def.itemTypes![0];
    expect(item.id).to.equal("my_gem");
    expect(item.displayName).to.equal("My Gem");
    expect(item.maxStackSize).to.equal(64);
    expect(item.durability).to.be.undefined;
  });

  it("should apply item traits and properties", () => {
    const def = buildDefinitionFromFlags("item", "flamebrand", ["sword"], {
      durability: "800",
      "max-stack": "1",
      color: "#FF4400",
    } as any);

    const item = def.itemTypes![0];
    expect(item.traits).to.deep.equal(["sword"]);
    expect(item.durability).to.equal(800);
    expect(item.maxStackSize).to.equal(1);
    expect(item.color).to.equal("#FF4400");
  });

  it("should filter out 'custom' trait from items", () => {
    const def = buildDefinitionFromFlags("item", "thing", ["custom", "food"], {});
    const item = def.itemTypes![0];
    expect(item.traits).to.deep.equal(["food"]);
  });

  it("should auto-format display name from underscored id", () => {
    const def = buildDefinitionFromFlags("entity", "dark_elf_warrior", undefined, {});
    expect(def.entityTypes![0].displayName).to.equal("Dark Elf Warrior");
  });
});

// ============================================================================
// validateWizardFlags
// ============================================================================

describe("validateWizardFlags", () => {
  it("should return no errors for valid entity flags", () => {
    const errors = validateWizardFlags("entity", {
      health: "20",
      damage: "5",
      speed: "0.3",
      color: "#FF0000",
      traits: ["hostile", "melee_attacker"],
    } as any);
    expect(errors).to.have.lengthOf(0);
  });

  it("should reject health out of range", () => {
    const errors = validateWizardFlags("entity", { health: "200" } as any);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].flag).to.equal("health");
  });

  it("should reject negative damage", () => {
    const errors = validateWizardFlags("entity", { damage: "-1" } as any);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].flag).to.equal("damage");
  });

  it("should reject speed out of range", () => {
    const errors = validateWizardFlags("entity", { speed: "5.0" } as any);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].flag).to.equal("speed");
  });

  it("should reject invalid hex color", () => {
    const errors = validateWizardFlags("entity", { color: "red" } as any);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].flag).to.equal("color");
  });

  it("should accept valid hex color", () => {
    const errors = validateWizardFlags("entity", { color: "#AB12CD" } as any);
    expect(errors).to.have.lengthOf(0);
  });

  it("should reject block destroy-time out of range", () => {
    const errors = validateWizardFlags("block", { "destroy-time": "15" } as any);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].flag).to.equal("destroy-time");
  });

  it("should reject block light-emission out of range", () => {
    const errors = validateWizardFlags("block", { "light-emission": "20" } as any);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].flag).to.equal("light-emission");
  });

  it("should reject item max-stack out of range", () => {
    const errors = validateWizardFlags("item", { "max-stack": "100" } as any);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].flag).to.equal("max-stack");
  });

  it("should reject item durability out of range", () => {
    const errors = validateWizardFlags("item", { durability: "5000" } as any);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].flag).to.equal("durability");
  });

  it("should reject entity trait used for block type", () => {
    const errors = validateWizardFlags("block", {
      traits: ["hostile"],
    } as any);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].message).to.include("hostile");
    expect(errors[0].message).to.include("block");
  });

  it("should reject multiple body type traits", () => {
    const errors = validateWizardFlags("entity", {
      traits: ["humanoid", "quadruped"],
    } as any);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].message).to.include("body type");
  });

  it("should return multiple errors for multiple invalid flags", () => {
    const errors = validateWizardFlags("entity", {
      health: "999",
      damage: "999",
      color: "notacolor",
    } as any);
    expect(errors.length).to.be.greaterThanOrEqual(3);
  });
});

// ============================================================================
// shouldUseWizardMode
// ============================================================================

describe("shouldUseWizardMode", () => {
  it("should return true when traits are provided for entity", () => {
    expect(shouldUseWizardMode("entity", ["hostile"], {})).to.be.true;
  });

  it("should return true when wizard flags are provided", () => {
    expect(shouldUseWizardMode("entity", undefined, { health: "30" } as any)).to.be.true;
  });

  it("should return false for non-wizard content types", () => {
    expect(shouldUseWizardMode("script", ["hostile"], {})).to.be.false;
  });

  it("should return false with no traits and no wizard flags", () => {
    expect(shouldUseWizardMode("entity", undefined, {})).to.be.false;
  });

  it("should return true for block with traits", () => {
    expect(shouldUseWizardMode("block", ["solid"], {})).to.be.true;
  });

  it("should return true for item with durability flag", () => {
    expect(shouldUseWizardMode("item", undefined, { durability: "100" } as any)).to.be.true;
  });
});

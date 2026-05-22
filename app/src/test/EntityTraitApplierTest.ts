// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * EntityTraitApplierTest — Validates that toggling entity traits in the
 * Traits tab actually mutates the underlying entity definition (so changes
 * persist across saves).
 *
 * Regression coverage for the bug where toggling traits on an existing
 * entity appeared to take effect in the picker but reverted after
 * navigating away because the UX never wired the change back to the
 * entity. See EntityTraitApplier.ts and EntityTypeEditor.tsx.
 */

import { expect } from "chai";
import "mocha";

import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import { applyEntityTraitChanges } from "../minecraft/EntityTraitApplier";
import { EntityTraitId } from "../minecraft/IContentMetaSchema";
import { registerAllEntityTraits, TraitRegistry } from "../minecraft/traits";
import TraitDetector from "../minecraft/TraitDetector";

describe("EntityTraitApplier", () => {
  before(() => {
    registerAllEntityTraits();
  });

  function buildEntity(): EntityTypeDefinition {
    const et = new EntityTypeDefinition();
    et._ensureBehaviorPackDataInitialized();
    return et;
  }

  it("adds trait components when a trait is toggled on", () => {
    const et = buildEntity();

    applyEntityTraitChanges(et, [], ["humanoid"] as EntityTraitId[]);

    const trait = TraitRegistry.getEntityTrait("humanoid")!;
    const data = trait.getData();
    for (const id of Object.keys(data.components || {})) {
      expect(et._data!.components, `expected component ${id} after adding humanoid`).to.have.property(id);
    }
  });

  it("removes trait components when a trait is toggled off", () => {
    const et = buildEntity();

    applyEntityTraitChanges(et, [], ["humanoid"] as EntityTraitId[]);
    applyEntityTraitChanges(et, ["humanoid"] as EntityTraitId[], []);

    const trait = TraitRegistry.getEntityTrait("humanoid")!;
    const data = trait.getData();
    for (const id of Object.keys(data.components || {})) {
      expect(et._data!.components, `expected component ${id} removed after dropping humanoid`).to.not.have.property(id);
    }
  });

  it("swapping body type removes the old body type's components and adds the new one's", () => {
    const et = buildEntity();

    applyEntityTraitChanges(et, [], ["humanoid"] as EntityTraitId[]);
    applyEntityTraitChanges(et, ["humanoid"] as EntityTraitId[], ["quadruped"] as EntityTraitId[]);

    const humanoid = TraitRegistry.getEntityTrait("humanoid")!.getData();
    const quadruped = TraitRegistry.getEntityTrait("quadruped")!.getData();

    // Components unique to humanoid should be gone.
    for (const id of Object.keys(humanoid.components || {})) {
      if (!(quadruped.components && id in quadruped.components)) {
        expect(et._data!.components, `expected old humanoid-only component ${id} removed`).to.not.have.property(id);
      }
    }

    // Quadruped's components should be present.
    for (const id of Object.keys(quadruped.components || {})) {
      expect(et._data!.components, `expected quadruped component ${id} present`).to.have.property(id);
    }
  });

  it("adds component groups and events contributed by a trait", () => {
    const et = buildEntity();

    // Find any registered entity trait that contributes component groups
    // or events so the test stays decoupled from the specific trait list.
    const candidate = TraitRegistry.getAllEntityTraits().find((t) => {
      const data = t.getData();
      return (
        (data.componentGroups && Object.keys(data.componentGroups).length > 0) ||
        (data.events && Object.keys(data.events).length > 0)
      );
    });

    if (!candidate) {
      // No trait currently contributes groups/events; nothing to assert.
      return;
    }

    applyEntityTraitChanges(et, [], [candidate.id as EntityTraitId]);
    const data = candidate.getData();

    if (data.componentGroups) {
      for (const name of Object.keys(data.componentGroups)) {
        expect(et._data!.component_groups, `expected component group ${name}`).to.have.property(name);
      }
    }

    if (data.events) {
      for (const name of Object.keys(data.events)) {
        expect(et._data!.events, `expected event ${name}`).to.have.property(name);
      }
    }
  });

  // Regression: toggling a behavior trait (Neutral) on an existing entity used
  // to revert on tab switch because the detector ignored the component groups
  // contributed by the trait.
  const roundTripTraits: EntityTraitId[] = ["neutral", "hostile", "passive"] as EntityTraitId[];

  for (const traitId of roundTripTraits) {
    it(`detects ${traitId} after it is applied to a fresh entity`, () => {
      const et = buildEntity();
      applyEntityTraitChanges(et, [], [traitId]);

      const components = et._data!.components || {};
      const groups: Record<string, Record<string, any>> = {};
      for (const [name, g] of Object.entries(et._data!.component_groups || {})) {
        if (g && typeof g === "object") groups[name] = g as Record<string, any>;
      }

      const detected = TraitDetector.detectEntityTraits(components, groups, 0.6).map((r) => r.traitId);
      expect(detected, `expected ${traitId} in ${JSON.stringify(detected)}`).to.include(traitId);
    });
  }

  it("does not also detect hostile when neutral is applied to a mob with minecraft:attack", () => {
    const et = buildEntity();
    // Many real entities already carry minecraft:attack (damage stat); the
    // earlier bug was that this caused both hostile and neutral to flag at
    // once because conflict resolution wasn't symmetric.
    et._data!.components["minecraft:attack"] = { damage: 3 };
    applyEntityTraitChanges(et, [], ["neutral"] as EntityTraitId[]);

    const groups: Record<string, Record<string, any>> = {};
    for (const [name, g] of Object.entries(et._data!.component_groups || {})) {
      if (g && typeof g === "object") groups[name] = g as Record<string, any>;
    }
    const detected = TraitDetector.detectEntityTraits(et._data!.components || {}, groups, 0.6).map((r) => r.traitId);

    expect(detected).to.include("neutral");
    expect(detected).to.not.include("hostile");
    expect(detected).to.not.include("passive");
  });
});

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * EntityTraitApplierTest — Validates that toggling entity traits in the
 * Traits tab actually mutates the underlying entity definition (so changes
 * persist across saves) without rewriting content the creator authored.
 *
 * Regression coverage for the bug where toggling traits on an existing
 * entity appeared to take effect in the picker but reverted after
 * navigating away because the UX never wired the change back to the
 * entity. See EntityTraitApplier.ts and EntityTypeEditor.tsx.
 */

import { expect } from "chai";
import "mocha";
import * as fs from "fs";

import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import {
  applyEntityTraitChanges,
  resolveEntityTraits,
  IEntityTraitChangeReport,
  IEntityTraitOverrides,
} from "../minecraft/EntityTraitApplier";
import { EntityTraitId } from "../minecraft/IContentMetaSchema";
import { registerAllEntityTraits, TraitRegistry } from "../minecraft/traits";
import { hasCommentMetadata, parseJsonWithComments, stringifyJsonWithComments } from "../core/JsonUtilities";
import { ENTITY_TRAITS, toggleEntityTrait } from "../UX/types/TraitData";
import NodeStorage from "../local/NodeStorage";
import TestPaths, { ITestEnvironment } from "./TestPaths";
import IFile, { FileUpdateType } from "../storage/IFile";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import ProjectItemVariantCreateManager from "../app/ProjectItemVariantCreateManager";
import { ProjectItemType } from "../app/IProjectItemData";

/** The Full Add-On sample's biceson: a hand-authored neutral bear-like mob. */
const bicesonPath =
  TestPaths.publicRoot +
  "res/samples/microsoft/samples/addon_starter/complete/behavior_packs/aop_mobs/entities/biceson.behavior.json";

const vanillaEntitiesRoot = TestPaths.publicRoot + "res/latest/van/release/behavior_pack/entities/";

const scratchRoot = TestPaths.appRoot + "debugoutput/entityTraitApplier/";

const temperamentTraits: EntityTraitId[] = ["hostile", "passive", "neutral"] as EntityTraitId[];
const bodyShapeTraits: EntityTraitId[] = ["humanoid", "quadruped"] as EntityTraitId[];

/** Raw `minecraft:entity` data of a pinned vanilla entity (several carry comments). */
function loadVanillaEntityData(name: string): any {
  const wrapper = parseJsonWithComments(fs.readFileSync(vanillaEntitiesRoot + name + ".json", "utf8")) as any;
  return JSON.parse(JSON.stringify(wrapper["minecraft:entity"]));
}

function entityFromData(data: any): EntityTypeDefinition {
  const et = new EntityTypeDefinition();
  et._ensureBehaviorPackDataInitialized();
  et._data = JSON.parse(JSON.stringify(data));
  return et;
}

function detectTraits(et: EntityTypeDefinition, overrides?: IEntityTraitOverrides): EntityTraitId[] {
  return resolveEntityTraits(et, overrides, 0.6).map((r) => r.traitId);
}

/** Mirrors what the Traits tab does for one click: resolve, toggle, apply. */
function click(
  et: EntityTypeDefinition,
  traitId: EntityTraitId,
  overrides?: IEntityTraitOverrides
): IEntityTraitChangeReport {
  const current = detectTraits(et, overrides);
  return applyEntityTraitChanges(et, current, toggleEntityTrait(current, traitId), overrides);
}

/** The component-group lists added by each branch of an event (top level, randomize and sequence). */
function addedGroupLists(event: any): string[][] {
  const lists: string[][] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node.randomize)) node.randomize.forEach(walk);
    if (Array.isArray(node.sequence)) node.sequence.forEach(walk);
    if (Array.isArray(node.add?.component_groups)) lists.push(node.add.component_groups);
  };
  walk(event);
  return lists;
}

/** Every group name any event adds or removes. */
function referencedGroups(et: EntityTypeDefinition): string[] {
  const names = new Set<string>();
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node.randomize)) node.randomize.forEach(walk);
    if (Array.isArray(node.sequence)) node.sequence.forEach(walk);
    for (const key of ["add", "remove"]) {
      for (const name of node[key]?.component_groups || []) names.add(name);
    }
  };
  for (const event of Object.values(et._data!.events || {})) walk(event);
  return [...names];
}

/** The components a mob has once the given groups have been added on top of its base components. */
function effectiveComponents(et: EntityTypeDefinition, groups: string[]): Record<string, any> {
  const result: Record<string, any> = { ...(et._data!.components || {}) };
  for (const name of groups) {
    Object.assign(result, et._data!.component_groups?.[name] || {});
  }
  return result;
}

function families(et: EntityTypeDefinition): string[] {
  return ((et._data!.components["minecraft:type_family"] as any)?.family as string[]) || [];
}

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

    applyEntityTraitChanges(et, [], ["wanders"] as EntityTraitId[]);
    applyEntityTraitChanges(et, ["wanders"] as EntityTraitId[], []);

    const trait = TraitRegistry.getEntityTrait("wanders")!;
    const data = trait.getData();
    for (const id of Object.keys(data.components || {})) {
      expect(et._data!.components, `expected component ${id} removed after dropping wanders`).to.not.have.property(id);
    }
  });

  it("swapping body type keeps the shared locomotion components and records the choice", () => {
    const et = buildEntity();
    const overrides: IEntityTraitOverrides = {};

    applyEntityTraitChanges(et, [], ["humanoid"] as EntityTraitId[], overrides);
    expect(overrides.bodyShape).to.equal("humanoid");

    applyEntityTraitChanges(et, ["humanoid"] as EntityTraitId[], ["quadruped"] as EntityTraitId[], overrides);
    expect(overrides.bodyShape).to.equal("quadruped");

    const quadruped = TraitRegistry.getEntityTrait("quadruped")!.getData();
    for (const id of Object.keys(quadruped.components || {})) {
      expect(et._data!.components, `expected quadruped component ${id} present`).to.have.property(id);
    }
    expect(et._data!.components).to.not.have.property("minecraft:type_family");
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

  it("activates a trait's spawn groups on a fresh entity and drops them again on removal", () => {
    const et = buildEntity();

    applyEntityTraitChanges(et, [], ["hostile"] as EntityTraitId[]);

    const spawned = et._data!.events?.["minecraft:entity_spawned"];
    expect(spawned, "spawn event created from the trait's spawnEvent").to.exist;
    expect(addedGroupLists(spawned).some((list) => list.includes("hostile_angry"))).to.equal(true);

    applyEntityTraitChanges(et, ["hostile"] as EntityTraitId[], []);

    expect(et._data!.component_groups).to.not.have.property("hostile_angry");
    expect(referencedGroups(et)).to.not.include("hostile_angry");
  });

  it("does not overwrite a component the mob already configures", () => {
    const et = buildEntity();
    et._data!.components["minecraft:attack"] = { damage: 9 };

    applyEntityTraitChanges(et, [], ["hostile"] as EntityTraitId[]);

    expect(et._data!.components["minecraft:attack"]).to.deep.equal({ damage: 9 });
  });

  // Regression: toggling a behavior trait (Neutral) on an existing entity used
  // to revert on tab switch because the detector ignored the component groups
  // contributed by the trait.
  const roundTripTraits: EntityTraitId[] = ["neutral", "hostile", "passive"] as EntityTraitId[];

  for (const traitId of roundTripTraits) {
    it(`detects ${traitId} after it is applied to a fresh entity`, () => {
      const et = buildEntity();
      applyEntityTraitChanges(et, [], [traitId]);

      expect(detectTraits(et), `expected ${traitId}`).to.include(traitId);
    });
  }

  it("does not also detect hostile when neutral is applied to a mob with minecraft:attack", () => {
    const et = buildEntity();
    // Many real entities already carry minecraft:attack (damage stat); the
    // earlier bug was that this caused both hostile and neutral to flag at
    // once because conflict resolution wasn't symmetric.
    et._data!.components["minecraft:attack"] = { damage: 3 };
    applyEntityTraitChanges(et, [], ["neutral"] as EntityTraitId[]);

    const detected = detectTraits(et);

    expect(detected).to.include("neutral");
    expect(detected).to.not.include("hostile");
    expect(detected).to.not.include("passive");
  });

  // Regression for the Full Add-On biceson (ADO #1591764): the Traits tab
  // showed no Body Shape, and picking a different Temperament never survived
  // a re-detection because biceson keeps its own minecraft:angry / attack
  // inside hand-written component groups that the canonical trait removal
  // did not touch. Saving therefore appeared to lose the chosen traits.
  //
  // The fix must not trade that for silently rewriting the mob: biceson's
  // authored groups and events form a state machine (wild -> anger -> calm),
  // and a temperament change has to keep it coherent and be reversible.
  describe("Full Add-On biceson", () => {
    const original = JSON.parse(fs.readFileSync(bicesonPath, "utf8"))["minecraft:entity"];
    const authoredGroupNames = Object.keys(original.component_groups);

    function loadBiceson(): EntityTypeDefinition {
      return entityFromData(original);
    }

    function expectAuthoredGroupsIntact(et: EntityTypeDefinition, names: string[] = authoredGroupNames) {
      for (const name of names) {
        expect(et._data!.component_groups?.[name], "authored group " + name).to.deep.equal(
          original.component_groups[name]
        );
      }
    }

    function expectEventsReferenceExistingGroups(et: EntityTypeDefinition) {
      for (const name of referencedGroups(et)) {
        expect(et._data!.component_groups, "event references missing group " + name).to.have.property(name);
      }
    }

    it("detects exactly one body shape and exactly one temperament", () => {
      const detected = detectTraits(loadBiceson());

      expect(detected.filter((t) => bodyShapeTraits.includes(t))).to.deep.equal(["quadruped"]);
      expect(detected.filter((t) => temperamentTraits.includes(t))).to.deep.equal(["neutral"]);
      expect(detected).to.include("wanders");
    });

    for (const target of temperamentTraits) {
      it("picking " + target + " in the Traits tab survives re-detection", () => {
        const et = loadBiceson();

        // biceson starts out neutral; move it elsewhere first so that picking
        // the target is always a selection rather than a deselection.
        if (detectTraits(et).includes(target)) {
          click(et, temperamentTraits.find((t) => t !== target)!);
        }

        click(et, target);
        const after = detectTraits(et);

        expect(after.filter((t) => temperamentTraits.includes(t))).to.deep.equal([target]);
        expect(after, "unrelated traits must not be dropped by a temperament change").to.include("wanders");
        expect(after.filter((t) => bodyShapeTraits.includes(t))).to.deep.equal(["quadruped"]);
        expectEventsReferenceExistingGroups(et);
      });
    }

    it("can move through every temperament in one session", () => {
      const et = loadBiceson();

      for (const target of ["hostile", "passive", "neutral", "hostile"] as EntityTraitId[]) {
        click(et, target);
        expect(
          detectTraits(et).filter((t) => temperamentTraits.includes(t)),
          "after picking " + target
        ).to.deep.equal([target]);
        expectEventsReferenceExistingGroups(et);
      }
    });

    it("switching to Hostile keeps the authored targeting and only removes the anger timers", () => {
      const et = loadBiceson();
      const report = click(et, "hostile" as EntityTraitId);

      // The mob's own on-sight targeting (players for babies, foxes for
      // adults) and its adult attack are compatible with Hostile and stay.
      expectAuthoredGroupsIntact(et, [
        "minecraft:baby",
        "minecraft:baby_wild",
        "minecraft:adult",
        "minecraft:adult_wild",
      ]);
      expect(et._data!.component_groups["minecraft:adult_hostile"]).to.have.property("minecraft:attack");
      expect(et._data!.component_groups["minecraft:adult_hostile"]).to.have.property("minecraft:behavior.stomp_attack");

      // What made it neutral — the provoked-anger timers — is what goes, and
      // the change is reported rather than silent.
      for (const name of authoredGroupNames) {
        expect(et._data!.component_groups[name], name).to.not.have.property("minecraft:angry");
      }
      expect(report.removedAuthored).to.deep.equal([
        {
          kind: "component",
          group: "minecraft:baby_scared",
          id: "minecraft:angry",
          value: original.component_groups["minecraft:baby_scared"]["minecraft:angry"],
        },
        {
          kind: "component",
          group: "minecraft:adult_hostile",
          id: "minecraft:angry",
          value: original.component_groups["minecraft:adult_hostile"]["minecraft:angry"],
        },
      ]);
      expect(report.unrestoredAuthored).to.deep.equal([]);
    });

    it("switching to Hostile activates on-sight player targeting in every spawn branch", () => {
      const et = loadBiceson();
      click(et, "hostile" as EntityTraitId);

      const spawnBranches = addedGroupLists(et._data!.events["minecraft:entity_spawned"]);
      expect(spawnBranches.length, "both randomize branches of the authored spawn event").to.equal(2);

      for (const branch of spawnBranches) {
        expect(branch, "spawn branch " + branch.join(",")).to.include("hostile_angry");

        const targeting = effectiveComponents(et, branch)["minecraft:behavior.nearest_attackable_target"];
        expect(targeting, "a spawned biceson has a targeter").to.exist;
        expect(JSON.stringify(targeting)).to.include("player");
      }

      for (const branch of addedGroupLists(et._data!.events["minecraft:entity_born"])) {
        expect(branch, "born biceson").to.include("hostile_angry");
      }
    });

    it("switching back to Neutral restores the authored anger groups and drops the hostile ones", () => {
      const et = loadBiceson();
      click(et, "hostile" as EntityTraitId);
      const report = click(et, "neutral" as EntityTraitId);

      expectAuthoredGroupsIntact(et);
      expect(et._data!.components["minecraft:behavior.hurt_by_target"]).to.deep.equal(
        original.components["minecraft:behavior.hurt_by_target"]
      );
      expect(et._data!.components).to.not.have.property("minecraft:attack");
      expect(Object.keys(et._data!.component_groups).filter((n) => n.startsWith("hostile_"))).to.deep.equal([]);
      expect(referencedGroups(et)).to.not.include("hostile_angry");
      expectEventsReferenceExistingGroups(et);

      expect(report.restoredAuthored.map((e) => e.group + "/" + e.id)).to.include.members([
        "minecraft:baby_scared/minecraft:angry",
        "minecraft:adult_hostile/minecraft:angry",
      ]);
      expect(detectTraits(et).filter((t) => temperamentTraits.includes(t))).to.deep.equal(["neutral"]);
    });

    it("switching to Passive removes retaliation and targeting, and Neutral brings them back", () => {
      const et = loadBiceson();
      click(et, "passive" as EntityTraitId);

      expect(et._data!.components).to.not.have.property("minecraft:behavior.hurt_by_target");
      for (const [name, group] of Object.entries(et._data!.component_groups)) {
        expect(group, name).to.not.have.property("minecraft:angry");
        expect(group, name).to.not.have.property("minecraft:behavior.nearest_attackable_target");
      }
      expect(detectTraits(et).filter((t) => temperamentTraits.includes(t))).to.deep.equal(["passive"]);

      click(et, "neutral" as EntityTraitId);

      expectAuthoredGroupsIntact(et);
      expect(et._data!.components["minecraft:behavior.hurt_by_target"]).to.deep.equal(
        original.components["minecraft:behavior.hurt_by_target"]
      );
    });

    // The journal travels with the project item, not with the editor
    // session: Passive deletes the authored targeting, the file is saved and
    // closed, and picking Neutral after reopening still brings it back.
    it("Passive then Neutral restores the authored targeting across a save, close and reopen", async () => {
      fs.mkdirSync(scratchRoot, { recursive: true });
      const fileName = "biceson_session.json";
      fs.writeFileSync(scratchRoot + fileName, fs.readFileSync(bicesonPath, "utf8"));

      async function openFromDisk() {
        const storage = new NodeStorage(scratchRoot, "");
        const file = storage.rootFolder.ensureFile(fileName);
        await file.loadContent(false);
        const et = (await EntityTypeDefinition.ensureOnFile(file, undefined, true))!;
        return { file, et };
      }

      // First session: the project item's data is a plain object here.
      const item: IEntityTraitOverrides = {};
      const { file: firstFile, et: first } = await openFromDisk();
      const report = click(first, "passive" as EntityTraitId, item);
      expect(report.removedAuthored.map((e) => e.group + "/" + e.id)).to.include.members([
        "minecraft:baby_wild/minecraft:behavior.nearest_attackable_target",
        "minecraft:adult_wild/minecraft:behavior.nearest_attackable_target",
      ]);
      expect(first.persist(), "the click already wrote the definition into the file").to.equal(false);
      expect(firstFile.needsSave, "and the file is waiting to be saved").to.equal(true);
      await firstFile.saveContent();
      expect(item.traitJournal, "the deletions are journaled on the item").to.exist;

      // What is on disk no longer has the targeting.
      const saved = JSON.parse(fs.readFileSync(scratchRoot + fileName, "utf8"))["minecraft:entity"];
      expect(saved.component_groups["minecraft:adult_wild"]).to.not.have.property(
        "minecraft:behavior.nearest_attackable_target"
      );

      // Second session: a fresh definition from disk, and the item's data as
      // it comes back out of the project file.
      const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
      const { et: second } = await openFromDisk();
      expect(detectTraits(second, reopenedItem).filter((t) => temperamentTraits.includes(t))).to.deep.equal([
        "passive",
      ]);

      const restore = click(second, "neutral" as EntityTraitId, reopenedItem);

      expectAuthoredGroupsIntact(second);
      expect(second._data!.components["minecraft:behavior.hurt_by_target"]).to.deep.equal(
        original.components["minecraft:behavior.hurt_by_target"]
      );
      expect(restore.unrestoredAuthored).to.deep.equal([]);
      expect(
        reopenedItem.traitJournal?.removedByTrait["neutral"],
        "everything Neutral's removal took is back"
      ).to.equal(undefined);
      expect(detectTraits(second, reopenedItem).filter((t) => temperamentTraits.includes(t))).to.deep.equal([
        "neutral",
      ]);
    });

    // A journaled entry whose slot has since been filled is not dropped: it
    // is reported as unrestored, stays in the journal, and comes back on a
    // later round trip once the slot is free again.
    it("keeps an entry it could not put back and restores it on a later round trip", () => {
      const et = loadBiceson();
      const item: IEntityTraitOverrides = {};
      const scared = () => et._data!.component_groups["minecraft:baby_scared"] as Record<string, any>;

      // The selection is tracked explicitly here (as the picker's externally
      // managed mode does) because the creator's refill below makes the mob
      // detect as neutral again, and a detection-driven click would then
      // deselect Neutral rather than switch away from Hostile.
      let selection = detectTraits(et, item);
      const pick = (traitId: EntityTraitId): IEntityTraitChangeReport => {
        const next = toggleEntityTrait(selection, traitId);
        const report = applyEntityTraitChanges(et, selection, next, item);
        selection = next;
        return report;
      };

      pick("hostile" as EntityTraitId);
      expect(scared()).to.not.have.property("minecraft:angry");

      // The creator writes their own anger timer into the now-empty slot.
      scared()["minecraft:angry"] = { duration: 3 };

      const blocked = pick("neutral" as EntityTraitId);
      expect(scared()["minecraft:angry"], "the creator's newer value wins").to.deep.equal({ duration: 3 });
      expect(blocked.unrestoredAuthored.map((e) => e.group + "/" + e.id)).to.deep.equal([
        "minecraft:baby_scared/minecraft:angry",
      ]);
      expect(blocked.restoredAuthored.map((e) => e.group + "/" + e.id)).to.deep.equal([
        "minecraft:adult_hostile/minecraft:angry",
      ]);
      expect(item.traitJournal!.removedByTrait["neutral"].map((e) => e.group + "/" + e.id)).to.deep.equal([
        "minecraft:baby_scared/minecraft:angry",
      ]);

      // Free the slot and go round again.
      delete scared()["minecraft:angry"];
      pick("hostile" as EntityTraitId);
      const recovered = pick("neutral" as EntityTraitId);

      expect(recovered.unrestoredAuthored).to.deep.equal([]);
      expectAuthoredGroupsIntact(et);
      // What is left in the journal is Hostile's own spawn wiring, kept for
      // its positions while Hostile is off; nothing of the creator's.
      expect(item.traitJournal?.removedByTrait).to.not.have.property("neutral");
      expect(
        Object.values(item.traitJournal?.removedByTrait || {})
          .flat()
          .filter((e) => !e.traitOwn)
      ).to.deep.equal([]);
    });

    // Journaled values are the authored objects themselves, so comments a
    // creator wrote inside them survive a round trip.
    it("a Neutral -> Hostile -> Neutral round trip keeps the comments inside the authored anger timer", () => {
      const commented = fs
        .readFileSync(bicesonPath, "utf8")
        .replace(
          '"minecraft:angry": {\n          "duration": 1,',
          '"minecraft:angry": {\n          // scared babies calm down almost at once\n          "duration": 1,'
        );
      expect(commented).to.include("scared babies calm down");

      const et = new EntityTypeDefinition();
      et._ensureBehaviorPackDataInitialized();
      et._data = (parseJsonWithComments(commented) as any)["minecraft:entity"];
      const angry = () => et._data!.component_groups["minecraft:baby_scared"]["minecraft:angry"];
      expect(hasCommentMetadata(angry()), "fixture carries the comment").to.equal(true);

      click(et, "hostile" as EntityTraitId);
      click(et, "neutral" as EntityTraitId);

      expect(hasCommentMetadata(angry())).to.equal(true);
      expect(stringifyJsonWithComments(et._data)).to.include("scared babies calm down almost at once");
    });
  });

  // A trait's event names are shared with what a mob may already define
  // (minecraft:on_hurt is a built-in trigger name). Selecting the trait adds
  // its transitions to the mob's event instead of replacing it, and
  // deselecting takes only those back out.
  describe("authored event with a canonical name", () => {
    function mobWithOwnOnHurt(): EntityTypeDefinition {
      const et = new EntityTypeDefinition();
      et._ensureBehaviorPackDataInitialized();
      et._data!.component_groups = {
        my_hurt: { "minecraft:knockback_resistance": { value: 1 } },
      } as any;
      et._data!.events = {
        "minecraft:on_hurt": { add: { component_groups: ["my_hurt"] }, trigger: "my_hurt_sound" },
      } as any;
      return et;
    }

    it("selecting Neutral merges its transitions into the mob's own minecraft:on_hurt", () => {
      const et = mobWithOwnOnHurt();
      const report = click(et, "neutral" as EntityTraitId);

      const onHurt = et._data!.events["minecraft:on_hurt"] as any;
      expect(onHurt.add.component_groups).to.deep.equal(["my_hurt", "neutral_angry"]);
      expect(onHurt.trigger, "the mob's own trigger stays").to.equal("my_hurt_sound");
      expect(report.removedAuthored).to.deep.equal([]);
    });

    it("deselecting Neutral leaves the mob's own minecraft:on_hurt exactly as it was", () => {
      const et = mobWithOwnOnHurt();
      const before = JSON.stringify(et._data!.events["minecraft:on_hurt"]);

      click(et, "neutral" as EntityTraitId);
      const report = click(et, "neutral" as EntityTraitId);

      expect(JSON.stringify(et._data!.events["minecraft:on_hurt"])).to.equal(before);
      expect(et._data!.component_groups).to.have.property("my_hurt");
      expect(et._data!.component_groups).to.not.have.property("neutral_angry");
      expect(referencedGroups(et)).to.not.include("neutral_angry");
      expect(report.removedAuthored).to.deep.equal([]);
      expect(detectTraits(et)).to.not.include("neutral");
    });
  });

  // A generated group the creator has since edited is their content: it
  // still goes when the trait is deselected (it is what keeps the trait
  // detected), but it is journaled and comes back edited, not as the template.
  describe("edited canonical group", () => {
    it("deselecting and re-selecting Neutral brings back the creator's edited neutral_angry group", () => {
      const et = new EntityTypeDefinition();
      et._ensureBehaviorPackDataInitialized();
      const item: IEntityTraitOverrides = {};

      click(et, "neutral" as EntityTraitId, item);
      const angry = et._data!.component_groups["neutral_angry"]["minecraft:angry"] as any;
      angry.duration = 42;
      const edited = JSON.parse(JSON.stringify(et._data!.component_groups["neutral_angry"]));

      const removal = click(et, "neutral" as EntityTraitId, item);
      expect(et._data!.component_groups).to.not.have.property("neutral_angry");
      expect(removal.removedAuthored).to.deep.equal([{ kind: "componentGroup", id: "neutral_angry", value: edited }]);
      expect(detectTraits(et)).to.not.include("neutral");

      const restore = click(et, "neutral" as EntityTraitId, item);
      expect(et._data!.component_groups["neutral_angry"]).to.deep.equal(edited);
      expect(restore.restoredAuthored.map((e) => e.kind + "/" + e.id)).to.deep.equal(["componentGroup/neutral_angry"]);
      expect(detectTraits(et)).to.include("neutral");
    });

    it("a pristine generated group is removed without being reported", () => {
      const et = new EntityTypeDefinition();
      et._ensureBehaviorPackDataInitialized();

      click(et, "neutral" as EntityTraitId);
      const report = click(et, "neutral" as EntityTraitId);

      expect(et._data!.component_groups).to.not.have.property("neutral_angry");
      expect(report.removedAuthored).to.deep.equal([]);
    });
  });

  it("deselecting neutral keeps components that a still-selected trait contributes", () => {
    const et = buildEntity();
    applyEntityTraitChanges(et, [], ["neutral", "wanders"] as EntityTraitId[]);
    applyEntityTraitChanges(et, ["neutral", "wanders"] as EntityTraitId[], ["wanders"] as EntityTraitId[]);

    const wanders = TraitRegistry.getEntityTrait("wanders")!.getData();
    for (const id of Object.keys(wanders.components || {})) {
      expect(et._data!.components, "expected shared component " + id + " to survive").to.have.property(id);
    }
    expect(detectTraits(et)).to.include("wanders");
    expect(detectTraits(et)).to.not.include("neutral");
  });

  // A kept trait only protects what the detector needs to keep reporting it,
  // not everything its generator happens to ship. Passive and Neutral both
  // ship wandering components, but deselecting Wanders must still stick.
  for (const kept of ["passive", "neutral"] as EntityTraitId[]) {
    it(`deselecting wanders while ${kept} stays selected stops the mob wandering`, () => {
      const et = buildEntity();
      applyEntityTraitChanges(et, [], [kept, "wanders"] as EntityTraitId[]);
      applyEntityTraitChanges(et, [kept, "wanders"] as EntityTraitId[], [kept]);

      const detected = detectTraits(et);
      expect(detected).to.not.include("wanders");
      expect(detected).to.include(kept);
    });
  }

  // A trait's creation template is not a claim of ownership over every
  // component id it happens to contain. The vanilla wolf keeps an
  // avoid_mob_type of its own (it avoids llamas) next to its tameable
  // component; turning Tameable off must not take the llama avoidance with it.
  describe("vanilla wolf", () => {
    const original = loadVanillaEntityData("wolf");

    it("turning Tameable off keeps the wolf's own llama avoidance", () => {
      const et = entityFromData(original);
      expect(detectTraits(et)).to.include("tameable");

      const report = click(et, "tameable" as EntityTraitId);

      expect(detectTraits(et)).to.not.include("tameable");
      expect(et._data!.component_groups["minecraft:wolf_wild"]["minecraft:behavior.avoid_mob_type"]).to.deep.equal(
        original.component_groups["minecraft:wolf_wild"]["minecraft:behavior.avoid_mob_type"]
      );
      expect(et._data!.component_groups["minecraft:wolf_wild"]).to.not.have.property("minecraft:tameable");
      expect(report.removedAuthored.map((e) => e.id)).to.not.include("minecraft:behavior.avoid_mob_type");
    });

    it("turning Tameable back on restores the wolf's own tameable settings", () => {
      const et = entityFromData(original);
      click(et, "tameable" as EntityTraitId);
      click(et, "tameable" as EntityTraitId);

      expect(et._data!.component_groups["minecraft:wolf_wild"]).to.deep.equal(
        original.component_groups["minecraft:wolf_wild"]
      );
      expect(detectTraits(et)).to.include("tameable");
    });
  });

  // Families are gameplay classifications (filters and selectors match on
  // them). A trait only owns the memberships it introduced itself.
  describe("family ownership", () => {
    it("turning Undead on and off on the vanilla spider keeps it a monster", () => {
      const et = entityFromData(loadVanillaEntityData("spider"));
      const before = [...families(et)];
      expect(before).to.include("monster");

      click(et, "undead" as EntityTraitId);
      expect(families(et)).to.include.members([...before, "undead"]);

      click(et, "undead" as EntityTraitId);
      expect(families(et)).to.deep.equal(before);
      expect(detectTraits(et)).to.not.include("undead");
    });

    // The record of what Undead introduced travels with the project item, so
    // deselecting after the project was saved and reopened still removes
    // only "undead" and keeps the spider's own "monster".
    it("turning Undead off after a save and reopen still keeps the spider a monster", () => {
      const original = loadVanillaEntityData("spider");
      const before = [...original.components["minecraft:type_family"].family];

      const item: IEntityTraitOverrides = {};
      const first = entityFromData(original);
      click(first, "undead" as EntityTraitId, item);
      expect(item.traitJournal?.familiesAddedByTrait["undead"]).to.deep.equal(["undead"]);

      // Reopen: the entity as saved, the item data as it comes out of the project file.
      const second = entityFromData(first._data);
      const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
      expect(detectTraits(second, reopenedItem)).to.include("undead");

      click(second, "undead" as EntityTraitId, reopenedItem);

      expect(families(second)).to.deep.equal(before);
      expect(detectTraits(second, reopenedItem)).to.not.include("undead");
      expect(reopenedItem.traitJournal).to.equal(undefined);
    });

    // A project saved before the journal existed has no record at all. The
    // deselection still has to stick, so the family the detector keys on
    // goes, while "monster" (which Undead also ships) is left alone.
    it("turning Undead off with no ownership record drops only the family that keeps it detected", () => {
      const original = loadVanillaEntityData("spider");
      const before = [...original.components["minecraft:type_family"].family];

      const earlier = entityFromData(original);
      click(earlier, "undead" as EntityTraitId);
      const et = entityFromData(earlier._data);
      const item: IEntityTraitOverrides = {};

      click(et, "undead" as EntityTraitId, item);

      expect(families(et)).to.deep.equal(before);
      expect(families(et)).to.include("monster");
      expect(detectTraits(et, item)).to.not.include("undead");
    });

    // The horses ship "undead" but not "monster". The first deselection
    // journals their own "undead"; re-selecting puts it back and records
    // only the "monster" the template adds. That partial record must not
    // stop the next deselection from taking "undead" out again.
    for (const name of ["skeleton_horse", "zombie_horse"]) {
      it(`turning Undead off, on and off again on the vanilla ${name} sticks every time`, () => {
        const item: IEntityTraitOverrides = {};
        const et = entityFromData(loadVanillaEntityData(name));
        const before = [...families(et)];
        expect(before).to.include("undead");
        expect(before).to.not.include("monster");
        expect(detectTraits(et, item)).to.include("undead");

        click(et, "undead" as EntityTraitId, item);
        expect(families(et)).to.deep.equal(before.filter((f) => f !== "undead"));
        expect(detectTraits(et, item)).to.not.include("undead");

        click(et, "undead" as EntityTraitId, item);
        expect(families(et)).to.include.members([...before, "monster"]);
        expect(item.traitJournal?.familiesAddedByTrait["undead"]).to.deep.equal(["monster"]);
        expect(detectTraits(et, item)).to.include("undead");

        const off = click(et, "undead" as EntityTraitId, item);
        expect(families(et)).to.deep.equal(before.filter((f) => f !== "undead"));
        expect(off.removedAuthored.map((e) => e.kind + "/" + e.id)).to.include("family/undead");
        expect(detectTraits(et, item)).to.not.include("undead");

        // And once more, after a save and reopen in between.
        click(et, "undead" as EntityTraitId, item);
        const second = entityFromData(et._data);
        const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
        expect(detectTraits(second, reopenedItem)).to.include("undead");

        click(second, "undead" as EntityTraitId, reopenedItem);
        expect(families(second)).to.deep.equal(before.filter((f) => f !== "undead"));
        expect(detectTraits(second, reopenedItem)).to.not.include("undead");
      });
    }
  });

  // A trait only ever inserts families at the top level, so that is the only
  // place its removal may take them from. A family list inside one of the
  // mob's own component groups is authored, even when it names a family the
  // trait ships.
  describe("group-level family ownership", () => {
    function mobWithMonsterGroup(): EntityTypeDefinition {
      const et = buildEntity();
      et._data!.components["minecraft:type_family"] = { family: ["biceson", "mob"] };
      et._data!.component_groups = {
        "minecraft:enraged": { "minecraft:type_family": { family: ["biceson", "monster"] } },
      } as any;
      return et;
    }

    it("turning Undead on and off leaves an authored group's monster family alone", () => {
      const et = mobWithMonsterGroup();
      const item: IEntityTraitOverrides = {};

      click(et, "undead" as EntityTraitId, item);
      expect(families(et)).to.deep.equal(["biceson", "mob", "undead", "monster"]);
      expect(item.traitJournal?.familiesAddedByTrait["undead"]).to.deep.equal(["undead", "monster"]);

      click(et, "undead" as EntityTraitId, item);

      expect(families(et)).to.deep.equal(["biceson", "mob"]);
      expect(et._data!.component_groups["minecraft:enraged"]["minecraft:type_family"]).to.deep.equal({
        family: ["biceson", "monster"],
      });
      expect(detectTraits(et, item)).to.not.include("undead");
    });

    it("turning Undead off with no ownership record still leaves the group's families alone", () => {
      const earlier = mobWithMonsterGroup();
      click(earlier, "undead" as EntityTraitId);
      const et = entityFromData(earlier._data);

      click(et, "undead" as EntityTraitId, {});

      expect(families(et)).to.not.include("undead");
      expect(et._data!.component_groups["minecraft:enraged"]["minecraft:type_family"]).to.deep.equal({
        family: ["biceson", "monster"],
      });
    });

    // A shipped undead mob was never selected through the Traits tab, so
    // nothing recorded what Undead introduced. Its baby and rider groups say
    // `undead` in their own right, so for the deselection to stick those
    // memberships have to go too: as the mob's own, journaled and reported,
    // and back where they were once Undead is selected again.
    it("turning Undead off on the vanilla zombie sticks, keeps monster, and Undead brings its families back", () => {
      const original = loadVanillaEntityData("zombie");
      const et = entityFromData(original);
      const item: IEntityTraitOverrides = {};
      const groupFamilies = (name: string) =>
        (et._data!.component_groups[name]["minecraft:type_family"] as any)?.family as string[];
      expect(detectTraits(et, item)).to.include("undead");
      expect(families(et)).to.include.members(["zombie", "undead", "monster"]);
      expect(groupFamilies("minecraft:zombie_baby")).to.include.members(["baby_undead", "undead", "monster"]);

      const report = click(et, "undead" as EntityTraitId, item);

      expect(families(et)).to.deep.equal(["zombie", "monster", "mob"]);
      expect(groupFamilies("minecraft:zombie_baby")).to.deep.equal(["zombie", "monster", "mob"]);
      expect(groupFamilies("minecraft:zombie_rider")).to.deep.equal(["zombie_rider", "zombie", "monster", "mob"]);
      expect(report.removedAuthored.map((e) => e.kind + "/" + (e.group || "") + "/" + e.id)).to.have.members([
        "family//undead",
        "family/minecraft:zombie_baby/baby_undead",
        "family/minecraft:zombie_baby/undead",
        "family/minecraft:zombie_rider/undead",
      ]);
      expect(detectTraits(et, item)).to.not.include("undead");

      const restore = click(et, "undead" as EntityTraitId, item);

      expect(families(et)).to.have.members(original.components["minecraft:type_family"].family);
      for (const name of ["minecraft:zombie_baby", "minecraft:zombie_rider"]) {
        expect(groupFamilies(name), name).to.have.members(
          original.component_groups[name]["minecraft:type_family"].family
        );
      }
      expect(restore.unrestoredAuthored).to.deep.equal([]);
      expect(item.traitJournal?.removedByTrait["undead"]).to.equal(undefined);
      expect(detectTraits(et, item)).to.include("undead");
    });
  });

  // A comment inside `minecraft:type_family` is the creator's. Taking the
  // trait's family out must not take the comment with it: the component is
  // emptied rather than deleted, and the membership goes back with the
  // comment that sat on it, in this session and after a save and reopen.
  describe("commented family lists", () => {
    const componentText = '{ // restless spirits, the lot of them\n "family": [ "undead" /* sole family */ ] }';

    function undeadMobWithCommentedFamily(group?: string): EntityTypeDefinition {
      const et = buildEntity();
      const component = parseJsonWithComments(componentText) as any;
      if (group === undefined) {
        et._data!.components["minecraft:type_family"] = component;
      } else {
        et._data!.components["minecraft:type_family"] = { family: ["biceson"] };
        et._data!.component_groups[group] = { "minecraft:type_family": component } as any;
      }
      return et;
    }

    const holderOf = (et: EntityTypeDefinition, group?: string): any =>
      group === undefined ? et._data!.components : et._data!.component_groups[group];
    const familyList = (et: EntityTypeDefinition, group?: string): string[] | undefined =>
      holderOf(et, group)["minecraft:type_family"]?.family;
    const holderText = (et: EntityTypeDefinition, group?: string) => stringifyJsonWithComments(holderOf(et, group));

    /** The entity as it comes back from a comment-preserving entity file. */
    function reopenWithComments(et: EntityTypeDefinition): EntityTypeDefinition {
      const second = buildEntity();
      second._data = parseJsonWithComments(stringifyJsonWithComments(et._data)) as any;
      return second;
    }

    for (const group of [undefined, "minecraft:enraged"]) {
      const where = group === undefined ? "at the top level" : "inside a component group";

      it(`Undead off ${where} empties the commented list rather than deleting it, and Undead on brings undead back with its comment`, () => {
        const item: IEntityTraitOverrides = {};
        const et = undeadMobWithCommentedFamily(group);
        expect(detectTraits(et, item)).to.include("undead");

        const off = click(et, "undead" as EntityTraitId, item);

        expect(familyList(et, group)).to.deep.equal([]);
        expect(holderText(et, group)).to.include("restless spirits");
        expect(holderText(et, group)).to.not.include("sole family");
        expect(off.removedAuthored.map((e) => e.kind + "/" + (e.group || "") + "/" + e.id)).to.deep.equal([
          "family/" + (group || "") + "/undead",
        ]);
        expect(
          Object.values(off.removedAuthored[0].comments || {})
            .flat()
            .map((c) => c.value),
          "the comment on the membership travels with the entry"
        ).to.deep.equal([" sole family "]);
        expect(detectTraits(et, item)).to.not.include("undead");

        const on = click(et, "undead" as EntityTraitId, item);

        expect(familyList(et, group)).to.deep.equal(group === undefined ? ["undead", "monster"] : ["undead"]);
        expect(holderText(et, group)).to.include("restless spirits");
        expect(holderText(et, group)).to.include("sole family");
        expect(on.unrestoredAuthored).to.deep.equal([]);
        expect(item.traitJournal?.removedByTrait["undead"]).to.equal(undefined);
        expect(detectTraits(et, item)).to.include("undead");
      });

      it(`the comments ${where} also come back after a save and reopen`, () => {
        const item: IEntityTraitOverrides = {};
        const first = undeadMobWithCommentedFamily(group);
        click(first, "undead" as EntityTraitId, item);

        const second = reopenWithComments(first);
        const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
        expect(holderText(second, group), "the component and its comment are still in the file").to.include(
          "restless spirits"
        );
        expect(
          reopenedItem.traitJournal!.removedByTrait["undead"][0].comments,
          "the membership's comment travels through the project file"
        ).to.exist;
        expect(detectTraits(second, reopenedItem)).to.not.include("undead");

        const on = click(second, "undead" as EntityTraitId, reopenedItem);

        expect(familyList(second, group)).to.include("undead");
        expect(holderText(second, group)).to.include("restless spirits");
        expect(holderText(second, group)).to.include("sole family");
        expect(on.unrestoredAuthored).to.deep.equal([]);
        expect(reopenedItem.traitJournal?.removedByTrait["undead"]).to.equal(undefined);
        expect(detectTraits(second, reopenedItem)).to.include("undead");
      });
    }

    it("a comment on a family that stays keeps its place when undead is taken out next to it", () => {
      const item: IEntityTraitOverrides = {};
      const et = buildEntity();
      et._data!.components["minecraft:type_family"] = parseJsonWithComments(
        '{ "family": [ "undead",\n // the species comes first in spirit\n "biceson" ] }'
      ) as any;

      click(et, "undead" as EntityTraitId, item);
      expect(familyList(et)).to.deep.equal(["biceson"]);
      expect(holderText(et)).to.include("comes first in spirit");

      click(et, "undead" as EntityTraitId, item);
      expect(familyList(et)).to.deep.equal(["undead", "biceson", "monster"]);
      const text = holderText(et);
      expect(text.indexOf('"undead"')).to.be.lessThan(text.indexOf("comes first in spirit"));
      expect(text.indexOf("comes first in spirit")).to.be.lessThan(text.indexOf('"biceson"'));
    });

    // The horses ship "undead"; Undead on adds "monster" after it. Taking
    // "monster" out again must not shift the comment off the creator's
    // "undead" before that one is journaled with it.
    it("a commented authored undead on the vanilla skeleton horse survives Undead off, on and off again", () => {
      const item: IEntityTraitOverrides = {};
      const et = buildEntity();
      const original = loadVanillaEntityData("skeleton_horse");
      et._data = parseJsonWithComments(
        JSON.stringify(original).replace('"undead"', '"undead" /* bones and all */')
      ) as any;
      expect(holderText(et)).to.include("bones and all");

      click(et, "undead" as EntityTraitId, item);
      expect(families(et)).to.not.include("undead");
      expect(holderText(et)).to.not.include("bones and all");

      click(et, "undead" as EntityTraitId, item);
      expect(families(et)).to.include.members(["undead", "monster"]);
      expect(holderText(et)).to.include("bones and all");

      click(et, "undead" as EntityTraitId, item);
      expect(families(et)).to.not.include.members(["undead", "monster"]);
      expect(detectTraits(et, item)).to.not.include("undead");

      click(et, "undead" as EntityTraitId, item);
      expect(holderText(et)).to.include("bones and all");
      expect(families(et)).to.deep.equal([...original.components["minecraft:type_family"].family, "monster"]);
    });

    // A membership the trait introduced is on record as the trait's own,
    // but a comment the creator then wrote on it makes it theirs: it is
    // journaled with the comment rather than spliced out with the record,
    // which would leave the comment behind to be lost on save.
    it("a comment the creator wrote on a family Undead introduced survives Undead off, a save and reopen, and Undead on", () => {
      const item: IEntityTraitOverrides = {};
      const et = buildEntity();
      et._data!.components["minecraft:type_family"] = { family: ["cow"] };

      click(et, "undead" as EntityTraitId, item);
      expect(familyList(et)).to.deep.equal(["cow", "undead", "monster"]);
      expect(item.traitJournal?.familiesAddedByTrait["undead"]).to.deep.equal(["undead", "monster"]);
      et._data!.components["minecraft:type_family"] = parseJsonWithComments(
        '{ "family": [ "cow", "undead" /* risen, not born */, "monster" ] }'
      ) as any;

      const off = click(et, "undead" as EntityTraitId, item);

      expect(familyList(et)).to.deep.equal(["cow"]);
      expect(holderText(et)).to.not.include("risen");
      expect(off.removedAuthored.map((e) => e.kind + "/" + e.id)).to.deep.equal(["family/undead"]);
      expect(
        Object.values(off.removedAuthored[0].comments || {})
          .flat()
          .map((c) => c.value)
      ).to.deep.equal([" risen, not born "]);
      expect(detectTraits(et, item)).to.not.include("undead");

      const second = reopenWithComments(et);
      const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
      expect(holderText(second)).to.not.include("risen");

      const on = click(second, "undead" as EntityTraitId, reopenedItem);

      expect(familyList(second)).to.deep.equal(["cow", "undead", "monster"]);
      expect(holderText(second)).to.include("risen, not born");
      expect(on.unrestoredAuthored).to.deep.equal([]);
      expect(reopenedItem.traitJournal?.removedByTrait["undead"]).to.equal(undefined);
      expect(
        reopenedItem.traitJournal?.familiesAddedByTrait["undead"],
        "undead is the creator's now; only monster is still the trait's"
      ).to.deep.equal(["monster"]);
      expect(detectTraits(second, reopenedItem)).to.include("undead");

      click(second, "undead" as EntityTraitId, reopenedItem);
      expect(familyList(second)).to.deep.equal(["cow"]);
      click(second, "undead" as EntityTraitId, reopenedItem);
      expect(holderText(second), "and the comment is still there a round trip later").to.include("risen, not born");
    });

    it("a family Undead introduced that nobody commented still goes quietly", () => {
      const item: IEntityTraitOverrides = {};
      const et = buildEntity();
      et._data!.components["minecraft:type_family"] = { family: ["cow"] };
      click(et, "undead" as EntityTraitId, item);

      const off = click(et, "undead" as EntityTraitId, item);

      expect(familyList(et)).to.deep.equal(["cow"]);
      expect(off.removedAuthored).to.deep.equal([]);
      expect(item.traitJournal).to.equal(undefined);
    });
  });

  // The mob's own event transitions into a trait's canonical groups are its
  // wiring, not the trait's, even where they name the same group the trait's
  // own event or spawn activation would. Only what the applier itself
  // inserted, at the place it inserted it, is the trait's. Deselecting the
  // trait has to scrub the mob's own transitions (the group is gone) but
  // re-selecting it must wire them up again, in the same branch they were in.
  describe("authored event transitions into a canonical group", () => {
    function neutralMobWithOwnWiring(item: IEntityTraitOverrides): EntityTypeDefinition {
      const et = buildEntity();
      click(et, "neutral" as EntityTraitId, item);

      // The creator adds their own way into the anger state and a spawn
      // branch that starts out angry.
      et._data!.events["my:enrage"] = { add: { component_groups: ["neutral_angry"] } } as any;
      et._data!.events["minecraft:entity_spawned"] = {
        randomize: [
          { weight: 9, add: { component_groups: ["neutral_calm"] } },
          { weight: 1, add: { component_groups: ["neutral_angry"] }, trigger: "my:roar" },
        ],
      } as any;
      return et;
    }

    it("deselecting Neutral scrubs and journals the creator's own transitions, not the trait's", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithOwnWiring(item);

      const report = click(et, "neutral" as EntityTraitId, item);

      expect(referencedGroups(et)).to.not.include.members(["neutral_angry", "neutral_calm"]);
      expect(et._data!.events).to.not.have.property("my:enrage");
      expect(et._data!.events["minecraft:entity_spawned"]).to.deep.equal({
        randomize: [{ weight: 9 }, { weight: 1, trigger: "my:roar" }],
      });

      const scrubbed = report.removedAuthored.filter((e) => e.kind === "eventGroup");
      expect(
        scrubbed.map((e) => e.event + ":" + e.action + ":" + e.id + "@" + (e.branch || []).join("/"))
      ).to.have.members([
        "my:enrage:add:neutral_angry@",
        // neutral_calm is what the trait's spawn activation would add, but
        // the creator rewrote the spawn event: this reference is theirs.
        "minecraft:entity_spawned:add:neutral_calm@randomize/0",
        "minecraft:entity_spawned:add:neutral_angry@randomize/1",
      ]);
      expect(item.traitJournal?.removedByTrait["neutral"]).to.deep.equal(scrubbed);
      expect(detectTraits(et, item)).to.not.include("neutral");
    });

    it("re-selecting Neutral wires the creator's own transitions up again in the same branches", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithOwnWiring(item);
      const before = JSON.parse(JSON.stringify(et._data!.events));

      click(et, "neutral" as EntityTraitId, item);
      const report = click(et, "neutral" as EntityTraitId, item);

      expect(et._data!.events["my:enrage"]).to.deep.equal(before["my:enrage"]);
      // The creator's wiring comes back where it was. The outcome they set
      // up to spawn angry is already in one of the trait's states, so spawn
      // activation leaves it angry rather than also making it calm.
      expect(addedGroupLists(et._data!.events["minecraft:entity_spawned"])).to.deep.equal([
        ["neutral_calm"],
        ["neutral_angry"],
      ]);
      expect((et._data!.events["minecraft:entity_spawned"] as any).randomize[1].trigger).to.equal("my:roar");
      expect(report.restoredAuthored.filter((e) => e.kind === "eventGroup").map((e) => e.event)).to.include.members([
        "my:enrage",
        "minecraft:entity_spawned",
      ]);
      expect(report.unrestoredAuthored).to.deep.equal([]);
      expect(item.traitJournal?.removedByTrait).to.deep.equal({});
      expect(detectTraits(et, item)).to.include("neutral");
    });

    it("the round trip also works after a save and reopen", () => {
      const item: IEntityTraitOverrides = {};
      const first = neutralMobWithOwnWiring(item);
      click(first, "neutral" as EntityTraitId, item);

      const second = entityFromData(first._data);
      const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
      click(second, "neutral" as EntityTraitId, reopenedItem);

      expect(second._data!.events["my:enrage"]).to.deep.equal({ add: { component_groups: ["neutral_angry"] } });
      expect(addedGroupLists(second._data!.events["minecraft:entity_spawned"])).to.deep.equal([
        ["neutral_calm"],
        ["neutral_angry"],
      ]);
      expect(reopenedItem.traitJournal?.removedByTrait).to.deep.equal({});
    });

    it("a branch that is gone keeps its transition journaled as unrestored", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithOwnWiring(item);

      click(et, "neutral" as EntityTraitId, item);
      (et._data!.events["minecraft:entity_spawned"] as any).randomize.pop();
      const report = click(et, "neutral" as EntityTraitId, item);

      expect(report.unrestoredAuthored.map((e) => e.event)).to.deep.equal(["minecraft:entity_spawned"]);
      expect(item.traitJournal?.removedByTrait["neutral"]?.map((e) => e.event)).to.deep.equal([
        "minecraft:entity_spawned",
      ]);
    });
  });

  // Later groups in a transition override earlier ones, so where a restored
  // group goes back in the list is behavior, not formatting.
  describe("position of a restored group inside an authored transition", () => {
    /** Neutral, with the anger state slowed down and a creator's own faster group listed after it. */
    function neutralMobWithFastOverride(item: IEntityTraitOverrides): EntityTypeDefinition {
      const et = buildEntity();
      click(et, "neutral" as EntityTraitId, item);
      et._data!.component_groups["neutral_angry"]["minecraft:movement"] = { value: 0.1 };
      et._data!.component_groups["my:fast"] = { "minecraft:movement": { value: 1 } } as any;
      et._data!.events["my:enrage"] = { add: { component_groups: ["neutral_angry", "my:fast"] } } as any;
      return et;
    }

    const enrageGroups = (et: EntityTypeDefinition): string[] =>
      (et._data!.events["my:enrage"] as any).add.component_groups;
    const movementAfterEnrage = (et: EntityTypeDefinition): number =>
      effectiveComponents(et, enrageGroups(et))["minecraft:movement"].value;

    it("Neutral off and on puts neutral_angry back ahead of my:fast, so the faster group still wins", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithFastOverride(item);
      expect(movementAfterEnrage(et)).to.equal(1);

      click(et, "neutral" as EntityTraitId, item);
      expect(enrageGroups(et)).to.deep.equal(["my:fast"]);
      const journaled = item.traitJournal?.removedByTrait["neutral"]?.find((e) => e.event === "my:enrage");
      expect(journaled?.index).to.equal(0);
      expect(journaled?.siblings).to.deep.equal(["neutral_angry", "my:fast"]);

      const report = click(et, "neutral" as EntityTraitId, item);
      expect(enrageGroups(et)).to.deep.equal(["neutral_angry", "my:fast"]);
      expect(movementAfterEnrage(et)).to.equal(1);
      expect(report.unrestoredAuthored).to.deep.equal([]);
    });

    it("the position also survives a save and reopen", () => {
      const item: IEntityTraitOverrides = {};
      const first = neutralMobWithFastOverride(item);
      click(first, "neutral" as EntityTraitId, item);

      const second = entityFromData(first._data);
      const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
      click(second, "neutral" as EntityTraitId, reopenedItem);

      expect(enrageGroups(second)).to.deep.equal(["neutral_angry", "my:fast"]);
      expect(movementAfterEnrage(second)).to.equal(1);
    });

    it("a group between two of the creator's goes back between them wherever they now sit", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithFastOverride(item);
      et._data!.events["my:enrage"] = {
        add: { component_groups: ["my:slow", "neutral_angry", "my:fast"] },
      } as any;

      click(et, "neutral" as EntityTraitId, item);
      // The creator adds a group at the front while Neutral is off.
      enrageGroups(et).unshift("my:loud");
      click(et, "neutral" as EntityTraitId, item);

      expect(enrageGroups(et)).to.deep.equal(["my:loud", "my:slow", "neutral_angry", "my:fast"]);
    });

    it("when the creator reordered the groups around its slot, the group stays journaled as unrestored", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithFastOverride(item);
      et._data!.events["my:enrage"] = {
        add: { component_groups: ["my:slow", "neutral_angry", "my:fast"] },
      } as any;

      click(et, "neutral" as EntityTraitId, item);
      (et._data!.events["my:enrage"] as any).add.component_groups = ["my:fast", "my:slow"];
      const report = click(et, "neutral" as EntityTraitId, item);

      expect(enrageGroups(et)).to.deep.equal(["my:fast", "my:slow"]);
      expect(report.unrestoredAuthored.map((e) => e.event + ":" + e.id)).to.deep.equal(["my:enrage:neutral_angry"]);
      expect(item.traitJournal?.removedByTrait["neutral"]?.map((e) => e.id)).to.deep.equal(["neutral_angry"]);
    });

    it("a group the creator put back by hand while Neutral was off stays where they put it, not listed twice", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithFastOverride(item);

      click(et, "neutral" as EntityTraitId, item);
      (et._data!.events["my:enrage"] as any).add.component_groups = ["my:fast", "neutral_angry"];
      const report = click(et, "neutral" as EntityTraitId, item);

      expect(enrageGroups(et)).to.deep.equal(["my:fast", "neutral_angry"]);
      expect(movementAfterEnrage(et)).to.equal(0.1);
      expect(report.restoredAuthored.filter((e) => e.kind === "eventGroup").map((e) => e.id)).to.deep.equal([
        "neutral_angry",
      ]);
      expect(report.unrestoredAuthored).to.deep.equal([]);
      expect(item.traitJournal?.removedByTrait).to.deep.equal({});
    });
  });

  // A branch is identified by what it is (its filters, weight, trigger),
  // not by where it happens to sit in the list, so a transition never comes
  // back on a different condition than the one it was written for.
  describe("identity of the branch a transition goes back to", () => {
    const babyBranch = { filters: { test: "is_baby", value: true }, add: { component_groups: ["neutral_angry"] } };
    const adultBranch = { filters: { test: "is_baby", value: false }, queue_command: { command: "say adult" } };

    function neutralMobWithConditionalEnrage(item: IEntityTraitOverrides): EntityTypeDefinition {
      const et = buildEntity();
      click(et, "neutral" as EntityTraitId, item);
      et._data!.events["my:enrage"] = JSON.parse(JSON.stringify({ sequence: [babyBranch, adultBranch] })) as any;
      return et;
    }

    const sequence = (et: EntityTypeDefinition): any[] => (et._data!.events["my:enrage"] as any).sequence;

    it("deleting the baby branch while Neutral is off leaves its transition unrestored, not on the adult branch", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithConditionalEnrage(item);

      click(et, "neutral" as EntityTraitId, item);
      expect(sequence(et)[0]).to.deep.equal({ filters: babyBranch.filters });
      sequence(et).shift();

      const report = click(et, "neutral" as EntityTraitId, item);

      expect(sequence(et)).to.deep.equal([adultBranch]);
      expect(report.restoredAuthored.filter((e) => e.event === "my:enrage")).to.deep.equal([]);
      expect(report.unrestoredAuthored.map((e) => e.event + ":" + e.id)).to.deep.equal(["my:enrage:neutral_angry"]);
      expect(item.traitJournal?.removedByTrait["neutral"]?.map((e) => e.event)).to.deep.equal(["my:enrage"]);
    });

    it("moving the branches around while Neutral is off still puts the transition back on the baby branch", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithConditionalEnrage(item);

      click(et, "neutral" as EntityTraitId, item);
      sequence(et).reverse();
      const report = click(et, "neutral" as EntityTraitId, item);

      expect(sequence(et)).to.deep.equal([adultBranch, babyBranch]);
      expect(report.unrestoredAuthored).to.deep.equal([]);
    });

    it("a branch whose condition the creator changed while Neutral was off does not take the transition", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithConditionalEnrage(item);

      click(et, "neutral" as EntityTraitId, item);
      sequence(et)[0].filters = { test: "is_baby", value: false };
      const report = click(et, "neutral" as EntityTraitId, item);

      expect(sequence(et)[0]).to.deep.equal({ filters: { test: "is_baby", value: false } });
      expect(report.unrestoredAuthored.map((e) => e.event)).to.deep.equal(["my:enrage"]);
    });

    it("branch identity is journaled and still checked after a save and reopen", () => {
      const item: IEntityTraitOverrides = {};
      const first = neutralMobWithConditionalEnrage(item);
      click(first, "neutral" as EntityTraitId, item);

      const journaled = item.traitJournal?.removedByTrait["neutral"]?.find((e) => e.event === "my:enrage");
      expect(journaled?.branch).to.deep.equal(["sequence", 0]);
      expect(journaled?.branchIdentity).to.have.length(2);

      const second = entityFromData(first._data);
      const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
      sequence(second).shift();
      const report = click(second, "neutral" as EntityTraitId, reopenedItem);

      expect(sequence(second)).to.deep.equal([adultBranch]);
      expect(report.unrestoredAuthored.map((e) => e.event)).to.deep.equal(["my:enrage"]);
    });
  });

  // A mob may wire a canonical event into a canonical group itself, in a
  // shape of its own: a hand-written minecraft:on_hurt that goes angry in
  // only one randomize branch. Matching Neutral's names does not make that
  // wiring Neutral's. Only what the applier inserted is, and that is
  // recorded rather than inferred, so an off/on round trip (in-session or
  // across a save) puts the branch back as it was instead of spreading
  // neutral_angry into every branch.
  describe("authored branched minecraft:on_hurt into a canonical group", () => {
    const authoredOnHurt = {
      randomize: [
        { weight: 3, add: { component_groups: ["neutral_angry"] } },
        { weight: 1, add: { component_groups: ["my_brace"] }, trigger: "my:yelp" },
      ],
    };

    /** Written by hand to be neutral, under Neutral's own group names, with its own minecraft:on_hurt. */
    function handWrittenNeutralMob(): EntityTypeDefinition {
      const neutral = TraitRegistry.getEntityTrait("neutral")!.getData();
      const et = buildEntity();
      et._data!.components = JSON.parse(JSON.stringify(neutral.components));
      et._data!.component_groups = {
        ...JSON.parse(JSON.stringify(neutral.componentGroups)),
        my_brace: { "minecraft:knockback_resistance": { value: 1 } },
      } as any;
      et._data!.events = {
        "minecraft:on_hurt": JSON.parse(JSON.stringify(authoredOnHurt)),
        on_calm: JSON.parse(JSON.stringify(neutral.events!["on_calm"])),
      } as any;
      return et;
    }

    it("is detected as neutral to begin with", () => {
      expect(detectTraits(handWrittenNeutralMob())).to.include("neutral");
    });

    it("Neutral off scrubs the branch and journals it as the mob's own, and Neutral on puts it back there", () => {
      const item: IEntityTraitOverrides = {};
      const et = handWrittenNeutralMob();

      const off = click(et, "neutral" as EntityTraitId, item);

      expect(referencedGroups(et)).to.not.include("neutral_angry");
      expect(addedGroupLists(et._data!.events["minecraft:on_hurt"])).to.deep.equal([["my_brace"]]);
      expect(
        off.removedAuthored
          .filter((e) => e.kind === "eventGroup")
          .map((e) => e.event + ":" + e.action + ":" + e.id + "@" + (e.branch || []).join("/"))
      ).to.deep.equal(["minecraft:on_hurt:add:neutral_angry@randomize/0"]);
      expect(detectTraits(et, item)).to.not.include("neutral");

      const on = click(et, "neutral" as EntityTraitId, item);

      expect(et._data!.events["minecraft:on_hurt"]).to.deep.equal(authoredOnHurt);
      expect(on.unrestoredAuthored).to.deep.equal([]);
      expect(item.traitJournal?.removedByTrait).to.deep.equal({});
      expect(detectTraits(et, item)).to.include("neutral");
    });

    it("the round trip also holds across a save and reopen", () => {
      const item: IEntityTraitOverrides = {};
      const first = handWrittenNeutralMob();
      click(first, "neutral" as EntityTraitId, item);

      const second = entityFromData(first._data);
      const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
      click(second, "neutral" as EntityTraitId, reopenedItem);

      expect(second._data!.events["minecraft:on_hurt"]).to.deep.equal(authoredOnHurt);
      expect(reopenedItem.traitJournal?.removedByTrait).to.deep.equal({});
      expect(detectTraits(second, reopenedItem)).to.include("neutral");
    });

    it("selecting Neutral on a mob whose own on_hurt already goes angry in one branch leaves that wiring alone", () => {
      const item: IEntityTraitOverrides = {};
      const et = buildEntity();
      et._data!.component_groups = {
        my_brace: { "minecraft:knockback_resistance": { value: 1 } },
      } as any;
      et._data!.events = { "minecraft:on_hurt": JSON.parse(JSON.stringify(authoredOnHurt)) } as any;

      click(et, "neutral" as EntityTraitId, item);

      expect(et._data!.events["minecraft:on_hurt"]).to.deep.equal(authoredOnHurt);
      expect(et._data!.component_groups).to.have.property("neutral_angry");
      expect(detectTraits(et, item)).to.include("neutral");

      // And since the trait never inserted that reference, taking the trait
      // off again treats it as the mob's own rather than dropping it quietly.
      const off = click(et, "neutral" as EntityTraitId, item);
      expect(off.removedAuthored.filter((e) => e.kind === "eventGroup").map((e) => e.event)).to.deep.equal([
        "minecraft:on_hurt",
      ]);
      expect(addedGroupLists(et._data!.events["minecraft:on_hurt"])).to.deep.equal([["my_brace"]]);
    });
  });

  // A comment is the creator's content. A canonical group that differs from
  // the template only by a comment is journaled rather than discarded, and
  // the comment survives both an in-session round trip and the plain-JSON
  // project file.
  describe("commented canonical group", () => {
    function neutralMobWithCommentedGroup(item: IEntityTraitOverrides): EntityTypeDefinition {
      const et = buildEntity();
      click(et, "neutral" as EntityTraitId, item);

      const text = stringifyJsonWithComments(et._data!.component_groups["neutral_angry"]).replace(
        '"duration": 25',
        '// stays cross for a good while\n    "duration": 25'
      );
      expect(text).to.include("stays cross");
      et._data!.component_groups["neutral_angry"] = parseJsonWithComments(text) as any;
      return et;
    }

    const angryText = (et: EntityTypeDefinition) => stringifyJsonWithComments(et._data!.component_groups);

    it("deselecting Neutral journals the commented group instead of treating it as pristine", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithCommentedGroup(item);

      const report = click(et, "neutral" as EntityTraitId, item);

      expect(et._data!.component_groups).to.not.have.property("neutral_angry");
      expect(report.removedAuthored.map((e) => e.kind + "/" + e.id)).to.deep.equal(["componentGroup/neutral_angry"]);
      expect(report.removedAuthored[0].text, "comment-preserving text travels with the entry").to.include(
        "stays cross for a good while"
      );
    });

    it("re-selecting Neutral in the same session brings the comment back", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithCommentedGroup(item);

      click(et, "neutral" as EntityTraitId, item);
      click(et, "neutral" as EntityTraitId, item);

      expect(angryText(et)).to.include("stays cross for a good while");
      expect((et._data!.component_groups["neutral_angry"]["minecraft:angry"] as any).duration).to.equal(25);
      expect(item.traitJournal?.removedByTrait).to.deep.equal({});
    });

    it("re-selecting Neutral after a save and reopen brings the comment back from the project file", () => {
      const item: IEntityTraitOverrides = {};
      const first = neutralMobWithCommentedGroup(item);
      click(first, "neutral" as EntityTraitId, item);

      // The project file is plain JSON: the journaled object loses its
      // comment on the way through, the text copy does not.
      const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
      expect(hasCommentMetadata(reopenedItem.traitJournal!.removedByTrait["neutral"][0].value)).to.equal(false);
      const second = entityFromData(first._data);

      const report = click(second, "neutral" as EntityTraitId, reopenedItem);

      expect(angryText(second)).to.include("stays cross for a good while");
      expect((second._data!.component_groups["neutral_angry"]["minecraft:angry"] as any).duration).to.equal(25);
      expect(report.unrestoredAuthored).to.deep.equal([]);
      expect(reopenedItem.traitJournal?.removedByTrait).to.deep.equal({});
      expect(detectTraits(second, reopenedItem)).to.include("neutral");
    });

    it("a commented canonical event is kept rather than deleted", () => {
      const item: IEntityTraitOverrides = {};
      const et = buildEntity();
      click(et, "neutral" as EntityTraitId, item);
      et._data!.events["on_calm"] = parseJsonWithComments(
        '{ // back to grazing\n "remove": { "component_groups": ["neutral_angry"] }, "add": { "component_groups": ["neutral_calm"] } }'
      ) as any;

      click(et, "neutral" as EntityTraitId, item);
      expect(et._data!.events).to.have.property("on_calm");
      expect(referencedGroups(et)).to.not.include.members(["neutral_angry", "neutral_calm"]);

      click(et, "neutral" as EntityTraitId, item);
      expect(stringifyJsonWithComments(et._data!.events["on_calm"])).to.include("back to grazing");
      expect((et._data!.events["on_calm"] as any).remove.component_groups).to.deep.equal(["neutral_angry"]);
    });

    // The comment sits inside the group list this time, so the container
    // that carries it is the very thing scrubbing empties. The transition is
    // journaled whole before that, comments included, and comes back whole.
    describe("comment inside a canonical event's group list", () => {
      const onCalmText =
        '{ "remove": { "component_groups": [\n // creator: return from the anger state\n "neutral_angry" ] },' +
        ' "add": { "component_groups": ["neutral_calm"] } }';

      function neutralMobWithCommentedOnCalm(item: IEntityTraitOverrides): EntityTypeDefinition {
        const et = buildEntity();
        click(et, "neutral" as EntityTraitId, item);
        et._data!.events["on_calm"] = parseJsonWithComments(onCalmText) as any;
        expect(stringifyJsonWithComments(et._data!.events["on_calm"])).to.include("return from the anger state");
        return et;
      }

      const onCalm = (et: EntityTypeDefinition): any => et._data!.events["on_calm"];

      it("deselecting Neutral keeps the comment with the journaled reference and reports it as the creator's", () => {
        const item: IEntityTraitOverrides = {};
        const et = neutralMobWithCommentedOnCalm(item);

        const report = click(et, "neutral" as EntityTraitId, item);

        expect(referencedGroups(et)).to.not.include.members(["neutral_angry", "neutral_calm"]);
        // The trait put that reference there, but the creator commented it,
        // which makes it theirs: it is reported, the uncommented one is not.
        expect(report.removedAuthored.map((e) => e.kind + "/" + e.event + "/" + e.action + "/" + e.id)).to.deep.equal([
          "eventGroup/on_calm/remove/neutral_angry",
        ]);
        expect(report.removedAuthored[0].comments?.before?.map((c) => c.value)).to.deep.equal([
          " creator: return from the anger state",
        ]);
        expect(
          item.traitJournal?.removedByTrait["neutral"]?.filter((e) => e.event === "on_calm").map((e) => e.id)
        ).to.have.members(["neutral_angry", "neutral_calm"]);
      });

      it("re-selecting Neutral in the same session brings the comment back where it was", () => {
        const item: IEntityTraitOverrides = {};
        const et = neutralMobWithCommentedOnCalm(item);

        click(et, "neutral" as EntityTraitId, item);
        const report = click(et, "neutral" as EntityTraitId, item);

        expect(stringifyJsonWithComments(onCalm(et))).to.include("return from the anger state");
        expect(onCalm(et).remove.component_groups).to.deep.equal(["neutral_angry"]);
        expect(onCalm(et).add.component_groups).to.deep.equal(["neutral_calm"]);
        expect(report.unrestoredAuthored).to.deep.equal([]);
        expect(item.traitJournal?.removedByTrait).to.deep.equal({});
      });

      it("re-selecting Neutral after a save and reopen brings the comment back from the project file", () => {
        const item: IEntityTraitOverrides = {};
        const first = neutralMobWithCommentedOnCalm(item);
        click(first, "neutral" as EntityTraitId, item);

        const second = entityFromData(first._data);
        const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
        const journaled = reopenedItem.traitJournal!.removedByTrait["neutral"].find((e) => e.id === "neutral_angry");
        expect(journaled?.comments?.before?.length, "the comment travels through the project file").to.equal(1);

        const report = click(second, "neutral" as EntityTraitId, reopenedItem);

        expect(stringifyJsonWithComments(onCalm(second))).to.include("return from the anger state");
        expect(onCalm(second).remove.component_groups).to.deep.equal(["neutral_angry"]);
        expect(onCalm(second).add.component_groups).to.deep.equal(["neutral_calm"]);
        expect(report.unrestoredAuthored).to.deep.equal([]);
        expect(detectTraits(second, reopenedItem)).to.include("neutral");
      });

      it("a comment on a group that stays keeps its place when a neighbour is scrubbed", () => {
        const item: IEntityTraitOverrides = {};
        const et = buildEntity();
        click(et, "neutral" as EntityTraitId, item);
        et._data!.component_groups["my:calm_down"] = {} as any;
        et._data!.events["on_calm"] = parseJsonWithComments(
          '{ "remove": { "component_groups": [ "neutral_angry",\n // creator: and stop sulking\n "my:calm_down" ] } }'
        ) as any;

        click(et, "neutral" as EntityTraitId, item);
        expect(onCalm(et).remove.component_groups).to.deep.equal(["my:calm_down"]);
        expect(stringifyJsonWithComments(onCalm(et))).to.include("and stop sulking");

        click(et, "neutral" as EntityTraitId, item);
        expect(onCalm(et).remove.component_groups).to.deep.equal(["neutral_angry", "my:calm_down"]);
        const text = stringifyJsonWithComments(onCalm(et));
        expect(text.indexOf("and stop sulking"), "the comment still precedes my:calm_down").to.be.lessThan(
          text.indexOf('"my:calm_down"')
        );
        expect(text.indexOf('"neutral_angry"')).to.be.lessThan(text.indexOf("and stop sulking"));
      });

      // comment-json leaves the comments of a spliced-out element behind,
      // where they would land on whatever moves into its place. A comment
      // that trails the scrubbed reference goes with it, not onto its
      // neighbour, and comes back trailing it.
      it("a comment trailing a scrubbed group goes with it rather than onto the group that moves into its place", () => {
        const item: IEntityTraitOverrides = {};
        const et = buildEntity();
        click(et, "neutral" as EntityTraitId, item);
        et._data!.component_groups["my:calm_down"] = {} as any;
        et._data!.events["on_calm"] = parseJsonWithComments(
          '{ "remove": { "component_groups": [ "neutral_angry" /* creator: out of the anger state */, "my:calm_down" ] } }'
        ) as any;

        click(et, "neutral" as EntityTraitId, item);
        expect(onCalm(et).remove.component_groups).to.deep.equal(["my:calm_down"]);
        expect(stringifyJsonWithComments(onCalm(et))).to.not.include("out of the anger state");

        click(et, "neutral" as EntityTraitId, item);
        expect(onCalm(et).remove.component_groups).to.deep.equal(["neutral_angry", "my:calm_down"]);
        const text = stringifyJsonWithComments(onCalm(et));
        expect(text.indexOf('"neutral_angry"')).to.be.lessThan(text.indexOf("out of the anger state"));
        expect(text.indexOf("out of the anger state")).to.be.lessThan(text.indexOf('"my:calm_down"'));
      });

      // Restoring puts one reference back and touches nothing else, so a
      // comment the creator changed on another entry while the trait was
      // off is not rolled back to what the journal remembers.
      it("a comment the creator changed while Neutral was off stays changed when Neutral comes back", () => {
        const item: IEntityTraitOverrides = {};
        const et = buildEntity();
        click(et, "neutral" as EntityTraitId, item);
        et._data!.component_groups["my:fast"] = {} as any;
        et._data!.events["my:enrage"] = parseJsonWithComments(
          '{ "add": { "component_groups": [ "neutral_angry",\n // old note\n "my:fast" ] } }'
        ) as any;

        click(et, "neutral" as EntityTraitId, item);
        expect(stringifyJsonWithComments(et._data!.events["my:enrage"])).to.include("old note");

        // The creator rewrites the note in the JSON editor while Neutral is off.
        et._data!.events["my:enrage"] = parseJsonWithComments(
          '{ "add": { "component_groups": [\n // new note\n "my:fast" ] } }'
        ) as any;

        const report = click(et, "neutral" as EntityTraitId, item);

        const text = stringifyJsonWithComments(et._data!.events["my:enrage"]);
        expect((et._data!.events["my:enrage"] as any).add.component_groups).to.deep.equal(["neutral_angry", "my:fast"]);
        expect(text).to.include("new note");
        expect(text).to.not.include("old note");
        expect(text.indexOf('"neutral_angry"')).to.be.lessThan(text.indexOf("new note"));
        expect(report.unrestoredAuthored).to.deep.equal([]);
      });
    });

    // Two traits can name groups in one commented list. Each puts back only
    // its own references, so their off/on cycles do not block each other,
    // the list keeps its order and its comments, and nothing accumulates.
    describe("two traits in one commented spawn list", () => {
      function cowWithCommentedSpawn(): EntityTypeDefinition {
        const et = entityFromData(loadVanillaEntityData("cow"));
        const spawnText = JSON.stringify(et._data!.events["minecraft:entity_spawned"], null, 1).replace(
          '"minecraft:cow_baby"',
          '// keep the calves\n "minecraft:cow_baby"'
        );
        expect(spawnText).to.include("keep the calves");
        et._data!.events["minecraft:entity_spawned"] = parseJsonWithComments(spawnText) as any;
        return et;
      }

      const babyList = (et: EntityTypeDefinition): string[] =>
        (et._data!.events["minecraft:entity_spawned"] as any).sequence[0].randomize[1].add.component_groups;
      const babyMovement = (et: EntityTypeDefinition): number =>
        effectiveComponents(et, babyList(et))["minecraft:movement"].value;

      function neutralTameableCow(item: IEntityTraitOverrides): EntityTypeDefinition {
        const et = cowWithCommentedSpawn();
        click(et, "neutral" as EntityTraitId, item);
        click(et, "tameable" as EntityTraitId, item);
        et._data!.component_groups["neutral_calm"]["minecraft:movement"] = { value: 0.1 };
        et._data!.component_groups["my:fast"] = { "minecraft:movement": { value: 1 } } as any;
        babyList(et).push("my:fast");
        expect(babyList(et)).to.deep.equal(["minecraft:cow_baby", "neutral_calm", "wild", "my:fast"]);
        expect(babyMovement(et)).to.equal(1);
        return et;
      }

      it("Neutral off, Tameable off, Neutral on, Tameable on leaves the list as it was", () => {
        const item: IEntityTraitOverrides = {};
        const et = neutralTameableCow(item);

        click(et, "neutral" as EntityTraitId, item);
        click(et, "tameable" as EntityTraitId, item);
        expect(babyList(et)).to.deep.equal(["minecraft:cow_baby", "my:fast"]);

        const neutralBack = click(et, "neutral" as EntityTraitId, item);
        const tameableBack = click(et, "tameable" as EntityTraitId, item);

        expect(babyList(et)).to.deep.equal(["minecraft:cow_baby", "neutral_calm", "wild", "my:fast"]);
        expect(babyMovement(et)).to.equal(1);
        expect(neutralBack.unrestoredAuthored).to.deep.equal([]);
        expect(tameableBack.unrestoredAuthored).to.deep.equal([]);
        expect(Object.keys(item.traitJournal?.removedByTrait || {})).to.not.include.members(["neutral", "tameable"]);
        expect(stringifyJsonWithComments(et._data!.events["minecraft:entity_spawned"])).to.include("keep the calves");
        expect(detectTraits(et, item)).to.include.members(["neutral", "tameable"]);
      });

      it("the same cycle holds with a save and reopen between every toggle", () => {
        let item: IEntityTraitOverrides = {};
        let et = neutralTameableCow(item);

        for (const trait of ["neutral", "tameable", "neutral", "tameable"] as EntityTraitId[]) {
          et = entityFromData(et._data);
          item = JSON.parse(JSON.stringify(item));
          click(et, trait, item);
        }

        expect(babyList(et)).to.deep.equal(["minecraft:cow_baby", "neutral_calm", "wild", "my:fast"]);
        expect(babyMovement(et)).to.equal(1);
        expect(Object.keys(item.traitJournal?.removedByTrait || {})).to.not.include.members(["neutral", "tameable"]);
      });

      it("repeated cycles do not pile up journal entries", () => {
        const item: IEntityTraitOverrides = {};
        const et = neutralTameableCow(item);

        for (let i = 0; i < 4; i++) {
          for (const trait of ["neutral", "tameable", "neutral", "tameable"] as EntityTraitId[]) {
            click(et, trait, item);
          }
        }

        expect(babyList(et)).to.deep.equal(["minecraft:cow_baby", "neutral_calm", "wild", "my:fast"]);
        expect(Object.keys(item.traitJournal?.removedByTrait || {})).to.not.include.members(["neutral", "tameable"]);
      });
    });
  });

  // A reference the trait inserted itself is still subject to whatever the
  // creator did to the list afterwards: if they put their own group after
  // it, the trait's group has to come back ahead of that group, not at the
  // end, or the creator's override stops winning.
  describe("position of a reference the trait inserted itself", () => {
    function hostileMobWithFastOverride(item: IEntityTraitOverrides): EntityTypeDefinition {
      const et = buildEntity();
      click(et, "hostile" as EntityTraitId, item);
      et._data!.component_groups["hostile_angry"]["minecraft:movement"] = { value: 0.1 };
      et._data!.component_groups["my:fast"] = { "minecraft:movement": { value: 1 } } as any;
      (et._data!.events["become_hostile"] as any).add.component_groups.push("my:fast");
      return et;
    }

    const becomeHostileGroups = (et: EntityTypeDefinition): string[] =>
      (et._data!.events["become_hostile"] as any).add.component_groups;
    const movement = (et: EntityTypeDefinition): number =>
      effectiveComponents(et, becomeHostileGroups(et))["minecraft:movement"].value;

    it("Hostile off and on puts hostile_angry back ahead of the creator's my:fast", () => {
      const item: IEntityTraitOverrides = {};
      const et = hostileMobWithFastOverride(item);
      expect(movement(et)).to.equal(1);

      const off = click(et, "hostile" as EntityTraitId, item);
      expect(becomeHostileGroups(et)).to.deep.equal(["my:fast"]);
      expect(
        off.removedAuthored.filter((e) => e.event === "become_hostile"),
        "the trait's own reference is not reported as the creator's"
      ).to.deep.equal([]);

      const on = click(et, "hostile" as EntityTraitId, item);
      expect(becomeHostileGroups(et)).to.deep.equal(["hostile_angry", "my:fast"]);
      expect(movement(et)).to.equal(1);
      expect(on.unrestoredAuthored).to.deep.equal([]);
    });

    it("the position also survives a save and reopen", () => {
      const item: IEntityTraitOverrides = {};
      const first = hostileMobWithFastOverride(item);
      click(first, "hostile" as EntityTraitId, item);

      const second = entityFromData(first._data);
      const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
      click(second, "hostile" as EntityTraitId, reopenedItem);

      expect(becomeHostileGroups(second)).to.deep.equal(["hostile_angry", "my:fast"]);
      expect(movement(second)).to.equal(1);
    });
  });

  // The game adds groups in list order and adding one again is not a no-op,
  // so a name that appears twice is two references with two positions.
  describe("a group named twice in one transition", () => {
    function neutralMobWithEnrage(item: IEntityTraitOverrides, groups: string[]): EntityTypeDefinition {
      const et = buildEntity();
      click(et, "neutral" as EntityTraitId, item);
      et._data!.component_groups["neutral_angry"]["minecraft:movement"] = { value: 0.1 };
      et._data!.component_groups["my:fast"] = { "minecraft:movement": { value: 1 } } as any;
      et._data!.events["my:enrage"] = { add: { component_groups: [...groups] } } as any;
      return et;
    }

    const enrageGroups = (et: EntityTypeDefinition): string[] =>
      (et._data!.events["my:enrage"] as any).add.component_groups;
    const movement = (et: EntityTypeDefinition): number =>
      effectiveComponents(et, enrageGroups(et))["minecraft:movement"].value;

    it("both occurrences of neutral_angry come back, so the later one still wins", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithEnrage(item, ["neutral_angry", "my:fast", "neutral_angry"]);
      expect(movement(et)).to.equal(0.1);

      click(et, "neutral" as EntityTraitId, item);
      expect(enrageGroups(et)).to.deep.equal(["my:fast"]);
      const report = click(et, "neutral" as EntityTraitId, item);

      expect(enrageGroups(et)).to.deep.equal(["neutral_angry", "my:fast", "neutral_angry"]);
      expect(movement(et)).to.equal(0.1);
      expect(report.restoredAuthored.filter((e) => e.event === "my:enrage").length).to.equal(2);
      expect(report.unrestoredAuthored).to.deep.equal([]);
    });

    it("both occurrences also come back after a save and reopen", () => {
      const item: IEntityTraitOverrides = {};
      const first = neutralMobWithEnrage(item, ["neutral_angry", "my:fast", "neutral_angry"]);
      click(first, "neutral" as EntityTraitId, item);

      const second = entityFromData(first._data);
      const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
      click(second, "neutral" as EntityTraitId, reopenedItem);

      expect(enrageGroups(second)).to.deep.equal(["neutral_angry", "my:fast", "neutral_angry"]);
    });

    it("a creator's group named twice around the slot does not count as a reordering", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithEnrage(item, ["my:fast", "neutral_angry", "my:fast"]);

      click(et, "neutral" as EntityTraitId, item);
      expect(enrageGroups(et)).to.deep.equal(["my:fast", "my:fast"]);
      const report = click(et, "neutral" as EntityTraitId, item);

      expect(enrageGroups(et)).to.deep.equal(["my:fast", "neutral_angry", "my:fast"]);
      expect(report.unrestoredAuthored).to.deep.equal([]);
    });
  });

  // Two outcomes of a randomize can be identical in everything but their
  // transitions (two weight-1 children). What they still hold once the
  // trait's groups are out tells them apart; when even that is the same,
  // the entry is not put on a guess.
  describe("siblings that share an identity", () => {
    function neutralMobWithTwoOutcomes(item: IEntityTraitOverrides, second: string[]): EntityTypeDefinition {
      const et = buildEntity();
      click(et, "neutral" as EntityTraitId, item);
      et._data!.component_groups["my:fast"] = {} as any;
      et._data!.component_groups["my:slow"] = {} as any;
      et._data!.events["my:enrage"] = {
        randomize: [
          { weight: 1, add: { component_groups: ["neutral_angry", "my:fast"] } },
          { weight: 1, add: { component_groups: second } },
        ],
      } as any;
      return et;
    }

    const outcomes = (et: EntityTypeDefinition): any[] => (et._data!.events["my:enrage"] as any).randomize;

    it("after the creator swaps the two outcomes, anger goes back on the my:fast outcome", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithTwoOutcomes(item, ["my:slow"]);

      click(et, "neutral" as EntityTraitId, item);
      outcomes(et).reverse();
      const report = click(et, "neutral" as EntityTraitId, item);

      expect(outcomes(et)).to.deep.equal([
        { weight: 1, add: { component_groups: ["my:slow"] } },
        { weight: 1, add: { component_groups: ["neutral_angry", "my:fast"] } },
      ]);
      expect(report.unrestoredAuthored).to.deep.equal([]);
    });

    it("the swap is also seen through after a save and reopen", () => {
      const item: IEntityTraitOverrides = {};
      const first = neutralMobWithTwoOutcomes(item, ["my:slow"]);
      click(first, "neutral" as EntityTraitId, item);

      const second = entityFromData(first._data);
      const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
      outcomes(second).reverse();
      click(second, "neutral" as EntityTraitId, reopenedItem);

      expect(outcomes(second)[1].add.component_groups).to.deep.equal(["neutral_angry", "my:fast"]);
      expect(outcomes(second)[0].add.component_groups).to.deep.equal(["my:slow"]);
    });

    it("after the creator deletes the angry outcome, anger does not land on the my:slow outcome", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithTwoOutcomes(item, ["my:slow"]);

      click(et, "neutral" as EntityTraitId, item);
      outcomes(et).shift();
      const report = click(et, "neutral" as EntityTraitId, item);

      expect(outcomes(et)).to.deep.equal([{ weight: 1, add: { component_groups: ["my:slow"] } }]);
      expect(report.unrestoredAuthored.map((e) => e.event + ":" + e.id)).to.deep.equal(["my:enrage:neutral_angry"]);
      expect(item.traitJournal?.removedByTrait["neutral"]?.map((e) => e.id)).to.deep.equal(["neutral_angry"]);
    });

    it("the deleted outcome is not mistaken for its sibling after a save and reopen either", () => {
      const item: IEntityTraitOverrides = {};
      const first = neutralMobWithTwoOutcomes(item, ["my:slow"]);
      click(first, "neutral" as EntityTraitId, item);

      const second = entityFromData(first._data);
      const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
      outcomes(second).shift();
      const report = click(second, "neutral" as EntityTraitId, reopenedItem);

      expect(outcomes(second)).to.deep.equal([{ weight: 1, add: { component_groups: ["my:slow"] } }]);
      expect(report.unrestoredAuthored.map((e) => e.id)).to.deep.equal(["neutral_angry"]);
    });

    it("an outcome that never had a lookalike is still found on its own after the creator edited it", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithTwoOutcomes(item, ["my:slow"]);
      outcomes(et)[1].weight = 2;

      click(et, "neutral" as EntityTraitId, item);
      outcomes(et)[0].add.component_groups.push("my:loud");
      const report = click(et, "neutral" as EntityTraitId, item);

      expect(outcomes(et)[0].add.component_groups).to.deep.equal(["neutral_angry", "my:fast", "my:loud"]);
      expect(report.unrestoredAuthored).to.deep.equal([]);
    });

    it("two outcomes that cannot be told apart leave the entry journaled as unrestored", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithTwoOutcomes(item, ["my:fast"]);

      click(et, "neutral" as EntityTraitId, item);
      expect(outcomes(et)).to.deep.equal([
        { weight: 1, add: { component_groups: ["my:fast"] } },
        { weight: 1, add: { component_groups: ["my:fast"] } },
      ]);
      const report = click(et, "neutral" as EntityTraitId, item);

      expect(outcomes(et).map((o: any) => o.add.component_groups)).to.deep.equal([["my:fast"], ["my:fast"]]);
      expect(report.unrestoredAuthored.map((e) => e.event + ":" + e.id)).to.deep.equal(["my:enrage:neutral_angry"]);
      expect(item.traitJournal?.removedByTrait["neutral"]?.map((e) => e.event)).to.deep.equal(["my:enrage"]);
    });
  });

  // The trait's canonical minecraft:on_hurt is merged into the mob's own.
  // A reference of the mob's own that could not go back (its outcome was
  // deleted while Neutral was off) is still the mob's wiring for that
  // group, so the default is not spread into the surviving outcome instead.
  describe("the trait's own event merged into the mob's after an outcome was deleted", () => {
    function neutralMobWithBranchedOnHurt(item: IEntityTraitOverrides): EntityTypeDefinition {
      const et = buildEntity();
      click(et, "neutral" as EntityTraitId, item);
      et._data!.component_groups["my:fast"] = {} as any;
      et._data!.component_groups["my:slow"] = {} as any;
      et._data!.events["minecraft:on_hurt"] = {
        randomize: [
          { weight: 1, add: { component_groups: ["neutral_angry", "my:fast"] } },
          { weight: 1, add: { component_groups: ["my:slow"] } },
        ],
      } as any;
      return et;
    }

    const onHurt = (et: EntityTypeDefinition): any => et._data!.events["minecraft:on_hurt"];
    const outcomes = (et: EntityTypeDefinition): any[] => onHurt(et).randomize;

    it("Neutral on after the angry outcome was deleted leaves the surviving outcome alone and reports the entry unrestored", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithBranchedOnHurt(item);

      click(et, "neutral" as EntityTraitId, item);
      expect(outcomes(et)).to.deep.equal([
        { weight: 1, add: { component_groups: ["my:fast"] } },
        { weight: 1, add: { component_groups: ["my:slow"] } },
      ]);
      outcomes(et).shift();

      const report = click(et, "neutral" as EntityTraitId, item);

      expect(outcomes(et)).to.deep.equal([{ weight: 1, add: { component_groups: ["my:slow"] } }]);
      expect(onHurt(et)).to.not.have.property("add");
      expect(report.unrestoredAuthored.map((e) => e.event + ":" + e.id)).to.deep.equal([
        "minecraft:on_hurt:neutral_angry",
      ]);
      expect(item.traitJournal?.removedByTrait["neutral"]?.map((e) => e.event + ":" + e.id)).to.deep.equal([
        "minecraft:on_hurt:neutral_angry",
      ]);
      expect(detectTraits(et, item)).to.include("neutral");
    });

    it("the same holds after a save and reopen, and the entry still goes back once its outcome is there again", () => {
      const item: IEntityTraitOverrides = {};
      const first = neutralMobWithBranchedOnHurt(item);
      click(first, "neutral" as EntityTraitId, item);

      const second = entityFromData(first._data);
      const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));
      outcomes(second).shift();

      const report = click(second, "neutral" as EntityTraitId, reopenedItem);

      expect(outcomes(second)).to.deep.equal([{ weight: 1, add: { component_groups: ["my:slow"] } }]);
      expect(onHurt(second)).to.not.have.property("add");
      expect(report.unrestoredAuthored.map((e) => e.id)).to.deep.equal(["neutral_angry"]);

      // Neutral off again, the creator recreates the outcome, Neutral on:
      // the waiting entry goes back there, and the default still stays out.
      click(second, "neutral" as EntityTraitId, reopenedItem);
      outcomes(second).unshift({ weight: 1, add: { component_groups: ["my:fast"] } });
      const again = click(second, "neutral" as EntityTraitId, reopenedItem);

      expect(outcomes(second)).to.deep.equal([
        { weight: 1, add: { component_groups: ["neutral_angry", "my:fast"] } },
        { weight: 1, add: { component_groups: ["my:slow"] } },
      ]);
      expect(onHurt(second)).to.not.have.property("add");
      expect(again.unrestoredAuthored).to.deep.equal([]);
      expect(reopenedItem.traitJournal?.removedByTrait["neutral"]).to.equal(undefined);
      expect(detectTraits(second, reopenedItem)).to.include("neutral");
    });

    it("a mob whose own on_hurt is gone altogether gets the trait's event back whole", () => {
      const item: IEntityTraitOverrides = {};
      const et = neutralMobWithBranchedOnHurt(item);

      click(et, "neutral" as EntityTraitId, item);
      delete et._data!.events["minecraft:on_hurt"];
      const report = click(et, "neutral" as EntityTraitId, item);

      expect(onHurt(et)).to.deep.equal({ add: { component_groups: ["neutral_angry"] } });
      expect(report.unrestoredAuthored.map((e) => e.id)).to.deep.equal(["neutral_angry"]);
    });
  });

  // Activation has to reach every spawn outcome. A mob that already names
  // the trait's group on one random sibling has not activated it on the
  // others, so those still get it.
  describe("spawn activation on a mob that already names the group on one outcome", () => {
    it("selecting Hostile on the cow activates hostile_angry on the baby outcome too", () => {
      const et = entityFromData(loadVanillaEntityData("cow"));
      et._data!.component_groups["hostile_angry"] = { "minecraft:movement": { value: 0.12 } } as any;
      const adult = (et._data!.events["minecraft:entity_spawned"] as any).sequence[0].randomize[0];
      adult.add = { component_groups: ["hostile_angry"] };
      expect(adult.trigger).to.equal("minecraft:spawn_adult");

      click(et, "hostile" as EntityTraitId);

      const spawn = (et._data!.events["minecraft:entity_spawned"] as any).sequence[0].randomize;
      expect(spawn[0].add.component_groups).to.deep.equal(["hostile_angry"]);
      expect(spawn[0].trigger).to.equal("minecraft:spawn_adult");
      expect(spawn[1].add.component_groups).to.deep.equal(["minecraft:cow_baby", "hostile_angry"]);

      const babyComponents = effectiveComponents(et, spawn[1].add.component_groups);
      expect(babyComponents).to.have.property("minecraft:behavior.nearest_attackable_target");
      expect(babyComponents["minecraft:movement"]).to.deep.equal({ value: 0.12 });
      expect(detectTraits(et)).to.include("hostile");
    });

    // An outcome the creator set up to spawn in one of the trait's states is
    // already activated; adding the calm group after it would make the
    // calm group win and undo the state they chose.
    it("selecting Neutral leaves an outcome the creator set up to spawn angry in that state", () => {
      const et = buildEntity();
      et._data!.component_groups["neutral_calm"] = { "minecraft:movement": { value: 0.1 } } as any;
      et._data!.component_groups["neutral_angry"] = { "minecraft:movement": { value: 0.3 } } as any;
      et._data!.events["minecraft:entity_spawned"] = {
        randomize: [{ weight: 9 }, { weight: 1, add: { component_groups: ["neutral_angry"] }, trigger: "my:roar" }],
      } as any;

      click(et, "neutral" as EntityTraitId);

      const spawn = (et._data!.events["minecraft:entity_spawned"] as any).randomize;
      expect(spawn[0].add.component_groups).to.deep.equal(["neutral_calm"]);
      expect(spawn[1].add.component_groups).to.deep.equal(["neutral_angry"]);
      expect(spawn[1].trigger).to.equal("my:roar");
      const angryComponents = effectiveComponents(et, spawn[1].add.component_groups);
      expect(angryComponents["minecraft:movement"]).to.deep.equal({ value: 0.3 });
      expect(angryComponents).to.have.property("minecraft:behavior.nearest_attackable_target");
      expect(detectTraits(et)).to.include("neutral");
    });

    it("a state the creator enters above a fan-out covers every outcome under it", () => {
      const et = buildEntity();
      et._data!.events["minecraft:entity_spawned"] = {
        sequence: [{ add: { component_groups: ["neutral_angry"] }, randomize: [{ weight: 9 }, { weight: 1 }] }],
      } as any;

      click(et, "neutral" as EntityTraitId);

      expect(addedGroupLists(et._data!.events["minecraft:entity_spawned"])).to.deep.equal([["neutral_angry"]]);
    });

    // The steps of a sequence all run, in order, on one spawn. A state an
    // earlier step enters holds for the later ones, so a default added to
    // a later step would come last and override the creator's choice.
    describe("sequence steps", () => {
      function neutralStates(et: EntityTypeDefinition): void {
        et._data!.component_groups["neutral_calm"] = { "minecraft:movement": { value: 0.1 } } as any;
        et._data!.component_groups["neutral_angry"] = { "minecraft:movement": { value: 0.3 } } as any;
      }
      const spawn = (et: EntityTypeDefinition): any => et._data!.events["minecraft:entity_spawned"];
      /** The components a spawn ends up with after every step of a sequence has run. */
      const afterSequence = (et: EntityTypeDefinition, steps: any[]) =>
        effectiveComponents(
          et,
          steps.flatMap((step: any) => step.add?.component_groups || [])
        );

      it("a step after one that enters the angry state is left alone, so the spawn stays angry", () => {
        const et = buildEntity();
        neutralStates(et);
        et._data!.events["minecraft:entity_spawned"] = {
          sequence: [{ add: { component_groups: ["neutral_angry"] } }, { queue_command: { command: "say roar" } }],
        } as any;

        click(et, "neutral" as EntityTraitId);

        expect(spawn(et).sequence[1]).to.deep.equal({ queue_command: { command: "say roar" } });
        expect(addedGroupLists(spawn(et))).to.deep.equal([["neutral_angry"]]);
        expect(afterSequence(et, spawn(et).sequence)["minecraft:movement"]).to.deep.equal({ value: 0.3 });
        expect(detectTraits(et)).to.include("neutral");
      });

      it("an earlier fan-out that only sometimes goes angry gets calm on its other outcomes, and the later step nothing", () => {
        const et = buildEntity();
        neutralStates(et);
        et._data!.events["minecraft:entity_spawned"] = {
          sequence: [
            { randomize: [{ weight: 9 }, { weight: 1, add: { component_groups: ["neutral_angry"] } }] },
            { queue_command: { command: "say roar" } },
          ],
        } as any;

        click(et, "neutral" as EntityTraitId);

        const steps = spawn(et).sequence;
        expect(steps[0].randomize[0].add.component_groups).to.deep.equal(["neutral_calm"]);
        expect(steps[0].randomize[1].add.component_groups).to.deep.equal(["neutral_angry"]);
        expect(steps[1]).to.deep.equal({ queue_command: { command: "say roar" } });
        expect(afterSequence(et, [steps[0].randomize[1], steps[1]])["minecraft:movement"]).to.deep.equal({
          value: 0.3,
        });
        expect(afterSequence(et, [steps[0].randomize[0], steps[1]])["minecraft:movement"]).to.deep.equal({
          value: 0.1,
        });
      });

      it("a state entered by a later step still wins over the default an earlier step gets", () => {
        const et = buildEntity();
        neutralStates(et);
        et._data!.events["minecraft:entity_spawned"] = {
          sequence: [{ queue_command: { command: "say hello" } }, { add: { component_groups: ["neutral_angry"] } }],
        } as any;

        click(et, "neutral" as EntityTraitId);

        const steps = spawn(et).sequence;
        expect(steps[0].add.component_groups).to.deep.equal(["neutral_calm"]);
        expect(steps[1].add.component_groups).to.deep.equal(["neutral_angry"]);
        expect(afterSequence(et, steps)["minecraft:movement"]).to.deep.equal({ value: 0.3 });
      });

      it("random outcomes are still each given the default: the vanilla cow's adult and baby both go hostile", () => {
        const et = entityFromData(loadVanillaEntityData("cow"));

        click(et, "hostile" as EntityTraitId);

        const steps = spawn(et).sequence;
        expect(steps[0].randomize.map((o: any) => o.add.component_groups)).to.deep.equal([
          ["hostile_angry"],
          ["minecraft:cow_baby", "hostile_angry"],
        ]);
        expect(steps[1], "the climate step after the fan-out needs no copy of its own").to.not.have.property("add");
      });

      // A step that runs only under a filter enters its state only on the
      // spawns the filter lets through. The others still need the default,
      // but not in the step after it, where it would come last and override
      // the state on the spawns that did run the filtered step.
      describe("a filtered earlier step", () => {
        const babyOnly = { test: "is_baby", value: true };
        const babiesSpawnAngry = () => ({
          sequence: [
            { filters: babyOnly, add: { component_groups: ["neutral_angry"] } },
            { queue_command: { command: "say roar" } },
          ],
        });
        const babiesAngryAdultsCalm = [
          { filters: babyOnly, add: { component_groups: ["neutral_angry"] } },
          { filters: { none_of: [babyOnly] }, add: { component_groups: ["neutral_calm"] } },
          { queue_command: { command: "say roar" } },
        ];

        function mobWhoseBabiesSpawnAngry(): EntityTypeDefinition {
          const et = buildEntity();
          neutralStates(et);
          et._data!.components["minecraft:movement"] = { value: 0.8 } as any;
          et._data!.events["minecraft:entity_spawned"] = babiesSpawnAngry() as any;
          return et;
        }

        it("keeps its spawns angry and the spawns that skip it still get calm, in a step of their own", () => {
          const et = mobWhoseBabiesSpawnAngry();

          const report = click(et, "neutral" as EntityTraitId);

          const steps = spawn(et).sequence;
          expect(steps).to.deep.equal(babiesAngryAdultsCalm);
          expect(afterSequence(et, [steps[0], steps[2]])["minecraft:movement"], "a baby").to.deep.equal({ value: 0.3 });
          expect(afterSequence(et, [steps[1], steps[2]])["minecraft:movement"], "an adult").to.deep.equal({
            value: 0.1,
          });
          expect(report.removedAuthored).to.deep.equal([]);
          expect(detectTraits(et)).to.include("neutral");
        });

        it("the step the default got is the trait's own: it leaves with Neutral and comes back with it after a save and reopen", () => {
          const item: IEntityTraitOverrides = {};
          const et = mobWhoseBabiesSpawnAngry();
          click(et, "neutral" as EntityTraitId, item);

          const off = click(et, "neutral" as EntityTraitId, item);

          expect(spawn(et).sequence).to.deep.equal([{ filters: babyOnly }, { queue_command: { command: "say roar" } }]);
          expect(
            off.removedAuthored.filter((e) => e.kind === "eventGroup").map((e) => e.id + "@" + e.branch!.join("/")),
            "only the creator's angry reference is theirs"
          ).to.deep.equal(["neutral_angry@sequence/0"]);
          expect(detectTraits(et, item)).to.not.include("neutral");

          const second = buildEntity();
          second._data = JSON.parse(JSON.stringify(et._data));
          const reopenedItem: IEntityTraitOverrides = JSON.parse(JSON.stringify(item));

          const on = click(second, "neutral" as EntityTraitId, reopenedItem);

          expect(spawn(second).sequence).to.deep.equal(babiesAngryAdultsCalm);
          expect(
            on.restoredAuthored.filter((e) => e.kind === "eventGroup").map((e) => e.id + "@" + e.branch!.join("/"))
          ).to.deep.equal(["neutral_angry@sequence/0"]);
          expect(on.unrestoredAuthored).to.deep.equal([]);
          expect(reopenedItem.traitJournal?.removedByTrait["neutral"]).to.equal(undefined);

          click(second, "neutral" as EntityTraitId, reopenedItem);
          expect(spawn(second).sequence, "and the same again").to.deep.equal([
            { filters: babyOnly },
            { queue_command: { command: "say roar" } },
          ]);
        });

        it("a complement the creator wrote themselves already settles every spawn, so nothing is added", () => {
          const et = mobWhoseBabiesSpawnAngry();
          spawn(et).sequence.splice(1, 0, {
            filters: { none_of: [babyOnly] },
            add: { component_groups: ["neutral_calm"] },
          });

          click(et, "neutral" as EntityTraitId);

          expect(spawn(et).sequence).to.deep.equal(babiesAngryAdultsCalm);
        });

        // A filter written as a bare list of tests means all of them. The
        // guard wraps it as `all_of` so `none_of` can hold it, and has to
        // be recognized as the complement of the bare list on the next
        // look, or the walk puts a guard in front of the same step on
        // every pass and never ends.
        it("a bare-list filter on the angry step gets calm in a guard step of its own, and the walk ends", () => {
          const et = mobWhoseBabiesSpawnAngry();
          spawn(et).sequence[0].filters = [babyOnly];
          const guarded = [
            { filters: [babyOnly], add: { component_groups: ["neutral_angry"] } },
            { filters: { none_of: [{ all_of: [babyOnly] }] }, add: { component_groups: ["neutral_calm"] } },
            { queue_command: { command: "say roar" } },
          ];
          const item: IEntityTraitOverrides = {};

          click(et, "neutral" as EntityTraitId, item);

          const steps = spawn(et).sequence;
          expect(steps).to.deep.equal(guarded);
          expect(afterSequence(et, [steps[0], steps[2]])["minecraft:movement"], "a baby").to.deep.equal({ value: 0.3 });
          expect(afterSequence(et, [steps[1], steps[2]])["minecraft:movement"], "an adult").to.deep.equal({
            value: 0.1,
          });

          click(et, "neutral" as EntityTraitId, item);
          expect(spawn(et).sequence, "off").to.deep.equal([
            { filters: [babyOnly] },
            { queue_command: { command: "say roar" } },
          ]);

          click(et, "neutral" as EntityTraitId, item);
          expect(spawn(et).sequence, "and on again").to.deep.equal(guarded);
        });

        it("a complement the creator wrote over a bare-list filter already settles every spawn, so nothing is added", () => {
          const et = mobWhoseBabiesSpawnAngry();
          spawn(et).sequence[0].filters = [babyOnly];
          spawn(et).sequence.splice(1, 0, {
            filters: { none_of: [{ all_of: [babyOnly] }] },
            add: { component_groups: ["neutral_calm"] },
          });
          const before = JSON.parse(JSON.stringify(spawn(et).sequence));

          click(et, "neutral" as EntityTraitId);

          expect(spawn(et).sequence).to.deep.equal(before);
        });

        it("two filtered angry steps: the default goes right before the step that needs it, and a spawn both steps skip gets it", () => {
          const et = mobWhoseBabiesSpawnAngry();
          const sheared = { test: "is_sheared", value: true };
          spawn(et).sequence.splice(1, 0, { filters: sheared, add: { component_groups: ["neutral_angry"] } });

          click(et, "neutral" as EntityTraitId);

          const steps = spawn(et).sequence;
          expect(steps).to.deep.equal([
            { filters: babyOnly, add: { component_groups: ["neutral_angry"] } },
            { filters: sheared, add: { component_groups: ["neutral_angry"] } },
            { filters: { none_of: [babyOnly, sheared] }, add: { component_groups: ["neutral_calm"] } },
            { queue_command: { command: "say roar" } },
          ]);
          expect(afterSequence(et, [steps[0], steps[3]])["minecraft:movement"], "a baby").to.deep.equal({ value: 0.3 });
          expect(afterSequence(et, [steps[1], steps[3]])["minecraft:movement"], "a sheared adult").to.deep.equal({
            value: 0.3,
          });
          expect(afterSequence(et, [steps[2], steps[3]])["minecraft:movement"], "any other adult").to.deep.equal({
            value: 0.1,
          });
        });

        it("a filtered fan-out that only sometimes goes angry gets calm on its other outcomes, and the spawns that skip it get calm too", () => {
          const et = buildEntity();
          neutralStates(et);
          et._data!.events["minecraft:entity_spawned"] = {
            sequence: [
              {
                filters: babyOnly,
                randomize: [{ weight: 9 }, { weight: 1, add: { component_groups: ["neutral_angry"] } }],
              },
              { queue_command: { command: "say roar" } },
            ],
          } as any;

          click(et, "neutral" as EntityTraitId);

          const steps = spawn(et).sequence;
          expect(steps).to.have.length(3);
          expect(steps[0].randomize.map((o: any) => o.add.component_groups)).to.deep.equal([
            ["neutral_calm"],
            ["neutral_angry"],
          ]);
          expect(steps[1]).to.deep.equal({
            filters: { none_of: [babyOnly] },
            add: { component_groups: ["neutral_calm"] },
          });
          expect(steps[2]).to.deep.equal({ queue_command: { command: "say roar" } });
        });
      });
    });
  });

  // A reference the trait inserted is recorded at the branch it actually
  // went back to, so a branch the creator moved while the trait was off does
  // not turn the trait's own reference into the creator's on the next removal.
  describe("a reference the trait inserted on a branch the creator later moved", () => {
    it("is still the trait's own on the next removal", () => {
      const item: IEntityTraitOverrides = {};
      const et = buildEntity();
      et._data!.component_groups["hostile_calm"] = {} as any;
      et._data!.events["minecraft:entity_spawned"] = {
        randomize: [{ weight: 9, add: { component_groups: ["hostile_calm"] } }, { weight: 1 }],
      } as any;
      const spawn = (): any[] => (et._data!.events["minecraft:entity_spawned"] as any).randomize;
      const spawnRecords = (): string[] =>
        (item.traitJournal?.eventGroupsAddedByTrait["hostile"] || [])
          .filter((r) => r.event === "minecraft:entity_spawned")
          .map((r) => r.id + "@" + r.branch.join("/"));

      click(et, "hostile" as EntityTraitId, item);
      expect(spawn().map((o) => o.add.component_groups)).to.deep.equal([["hostile_calm"], ["hostile_angry"]]);
      expect(spawnRecords()).to.deep.equal(["hostile_angry@randomize/1"]);

      click(et, "hostile" as EntityTraitId, item);
      spawn().reverse();
      click(et, "hostile" as EntityTraitId, item);
      expect(spawn().map((o) => o.add.component_groups)).to.deep.equal([["hostile_angry"], ["hostile_calm"]]);
      expect(spawnRecords()).to.deep.equal(["hostile_angry@randomize/0"]);

      const off = click(et, "hostile" as EntityTraitId, item);
      expect(off.removedAuthored.filter((e) => e.kind === "eventGroup").map((e) => e.id)).to.deep.equal([
        "hostile_calm",
      ]);
      expect(spawn().map((o) => o.add?.component_groups)).to.deep.equal([undefined, undefined]);
    });
  });

  // The explicit body shape choice lives in tool-only metadata, never in
  // minecraft:type_family, and wins over species inference even when
  // component groups carry their own family lists (zombie babies, villager
  // professions) that used to shadow anything written at the top level.
  describe("body shape choice", () => {
    for (const name of ["zombie", "villager_v2"]) {
      it(`picking Four-legged on the vanilla ${name} sticks without touching its families`, () => {
        const original = loadVanillaEntityData(name);
        const et = entityFromData(original);
        const overrides: IEntityTraitOverrides = {};

        expect(detectTraits(et, overrides).filter((t) => bodyShapeTraits.includes(t))).to.deep.equal(["humanoid"]);

        click(et, "quadruped" as EntityTraitId, overrides);

        expect(overrides.bodyShape).to.equal("quadruped");
        expect(detectTraits(et, overrides).filter((t) => bodyShapeTraits.includes(t))).to.deep.equal(["quadruped"]);
        expect(et._data!.components["minecraft:type_family"]).to.deep.equal(
          original.components["minecraft:type_family"]
        );
        for (const [groupName, group] of Object.entries(original.component_groups)) {
          if ((group as any)["minecraft:type_family"]) {
            expect(et._data!.component_groups[groupName]["minecraft:type_family"], groupName).to.deep.equal(
              (group as any)["minecraft:type_family"]
            );
          }
        }

        click(et, "humanoid" as EntityTraitId, overrides);

        expect(overrides.bodyShape).to.equal("humanoid");
        expect(detectTraits(et, overrides).filter((t) => bodyShapeTraits.includes(t))).to.deep.equal(["humanoid"]);
      });
    }

    it("a creator-authored humanoid family survives picking Four-legged", () => {
      const et = buildEntity();
      et._data!.components["minecraft:type_family"] = { family: ["humanoid", "mob"] };
      const overrides: IEntityTraitOverrides = {};

      click(et, "quadruped" as EntityTraitId, overrides);

      expect(families(et)).to.deep.equal(["humanoid", "mob"]);
      expect(detectTraits(et, overrides).filter((t) => bodyShapeTraits.includes(t))).to.deep.equal(["quadruped"]);
    });

    it("clicking the selected body shape again is a no-op for the selection and the entity", () => {
      const et = entityFromData(loadVanillaEntityData("cow"));
      const overrides: IEntityTraitOverrides = {};
      const before = JSON.stringify(et._data);

      const current = detectTraits(et, overrides);
      expect(current).to.include("quadruped");
      expect(toggleEntityTrait(current, "quadruped" as EntityTraitId)).to.deep.equal(current);

      // Even if a caller applies that unchanged selection, nothing moves.
      applyEntityTraitChanges(et, current, toggleEntityTrait(current, "quadruped" as EntityTraitId), overrides);

      expect(JSON.stringify(et._data)).to.equal(before);
      expect(et._data!.components).to.have.property("minecraft:navigation.walk");
      expect(et._data!.components).to.have.property("minecraft:movement.basic");
      expect(et._data!.components).to.have.property("minecraft:jump.static");
    });

    it("swapping shapes keeps a creator's group-level navigation override", () => {
      const original = loadVanillaEntityData("cow");
      original.component_groups["minecraft:cow_baby"]["minecraft:navigation.walk"] = { can_path_over_water: false };
      const et = entityFromData(original);
      const overrides: IEntityTraitOverrides = {};

      click(et, "humanoid" as EntityTraitId, overrides);
      click(et, "quadruped" as EntityTraitId, overrides);

      expect(et._data!.component_groups["minecraft:cow_baby"]["minecraft:navigation.walk"]).to.deep.equal({
        can_path_over_water: false,
      });
      expect(et._data!.components["minecraft:navigation.walk"]).to.deep.equal(
        original.components["minecraft:navigation.walk"]
      );
    });
  });
});

/**
 * Regression coverage for "Traits changes don't save": toggling a trait on a
 * mob added from the vanilla gallery (the cow) looked applied but reverted on
 * the next visit to the tab, and Save wrote nothing for files with comments.
 */
describe("EntityTraitApplier round trips", () => {
  const vanillaCowPath = vanillaEntitiesRoot + "cow.json";
  before(() => {
    registerAllEntityTraits();
  });

  function vanillaCow(): EntityTypeDefinition {
    return entityFromData(loadVanillaEntityData("cow"));
  }

  for (const trait of ENTITY_TRAITS) {
    const traitId = trait.id as EntityTraitId;

    it(`${traitId} is detected after being applied to a fresh entity and gone after removal`, () => {
      const et = new EntityTypeDefinition();
      et._ensureBehaviorPackDataInitialized();
      const overrides: IEntityTraitOverrides = {};

      applyEntityTraitChanges(et, [], [traitId], overrides);
      expect(detectTraits(et, overrides), `expected ${traitId} detected after add`).to.include(traitId);

      applyEntityTraitChanges(et, [traitId], [], overrides);
      expect(detectTraits(et, overrides), `expected ${traitId} gone after remove`).to.not.include(traitId);
    });
  }

  it("vanilla cow starts out four-legged, passive, rideable, breedable and wandering", () => {
    expect(detectTraits(vanillaCow())).to.include.members(["quadruped", "passive", "rideable", "breedable", "wanders"]);
  });

  it("turning Rideable off on the vanilla cow sticks even though rideable lives in a component group", () => {
    const et = vanillaCow();
    click(et, "rideable" as EntityTraitId);

    expect(detectTraits(et)).to.not.include("rideable");
    for (const group of Object.values(et._data!.component_groups || {})) {
      expect(group).to.not.have.property("minecraft:rideable");
    }
  });

  it("turning Breedable off on the vanilla cow sticks", () => {
    const et = vanillaCow();
    click(et, "breedable" as EntityTraitId);

    expect(detectTraits(et)).to.not.include("breedable");
  });

  it("switching the vanilla cow to Two-legged sticks and switching back restores Four-legged", () => {
    const et = vanillaCow();
    const overrides: IEntityTraitOverrides = {};

    click(et, "humanoid" as EntityTraitId, overrides);
    let detected = detectTraits(et, overrides);
    expect(detected).to.include("humanoid");
    expect(detected).to.not.include("quadruped");
    expect(et._data!.components["minecraft:navigation.walk"], "walk navigation survives the swap").to.exist;

    click(et, "quadruped" as EntityTraitId, overrides);
    detected = detectTraits(et, overrides);
    expect(detected).to.include("quadruped");
    expect(detected).to.not.include("humanoid");

    expect(families(et), "families are gameplay data and stay untouched").to.deep.equal(["cow", "mob"]);
  });

  it("turning Wanders off on a passive mob stops it wandering but keeps it passive", () => {
    const et = vanillaCow();
    click(et, "wanders" as EntityTraitId);

    const detected = detectTraits(et);
    expect(detected).to.not.include("wanders");
    expect(detected).to.include("passive");
  });

  it("turning Undead on and off keeps the cow's own families and body shape", () => {
    const et = vanillaCow();

    click(et, "undead" as EntityTraitId);
    expect(families(et)).to.include.members(["cow", "undead"]);
    expect(detectTraits(et)).to.include.members(["undead", "quadruped"]);

    click(et, "undead" as EntityTraitId);
    expect(families(et)).to.include("cow");
    expect(families(et)).to.not.include("undead");
    expect(detectTraits(et)).to.not.include("undead");
    expect(detectTraits(et)).to.include("quadruped");
  });

  /** A scratch copy of the vanilla cow with a leading comment, loaded into a Node-backed file. */
  async function scratchCowFile(fileName: string): Promise<IFile> {
    fs.mkdirSync(scratchRoot, { recursive: true });
    fs.writeFileSync(scratchRoot + fileName, "// vanilla cow\n" + fs.readFileSync(vanillaCowPath, "utf8"));

    const storage = new NodeStorage(scratchRoot, "");
    const file = storage.rootFolder.ensureFile(fileName);
    await file.loadContent(false);

    return file;
  }

  /** The file's text with `minecraft:is_shaking` added at the top level, the way a Raw-view edit would. */
  function withShaking(content: string): string {
    const edited = parseJsonWithComments(content) as any;
    edited["minecraft:entity"].components["minecraft:is_shaking"] = {};
    return stringifyJsonWithComments(edited);
  }

  it("a trait click on a comment-preserving entity file lands in the file's content right away", async () => {
    const file = await scratchCowFile("cow_with_comment.json");

    const et = (await EntityTypeDefinition.ensureOnFile(file, undefined, true))!;
    click(et, "flying" as EntityTraitId);

    expect(file.content, "file content carries the new trait").to.include("minecraft:navigation.fly");
    expect(file.content, "comments are preserved").to.match(/^\/\/ vanilla cow/);
    expect(et.isLoaded, "the definition stays loaded through its own write").to.equal(true);
    expect(et.persist(), "nothing is left for the editor's own persist to write").to.equal(false);
  });

  // Form view, then Raw view where the creator edits the text, then back to
  // the Form view and a trait click. The entity manager is reset by the raw
  // edit, but the file's comment-json cache was not, so the manager reloaded
  // the old parse and the click wrote it back over the creator's edit.
  it("a raw edit made between two visits to the Traits tab survives the next trait click", async () => {
    const fileName = "cow_raw_edit.json";
    const file = await scratchCowFile(fileName);
    const et = (await EntityTypeDefinition.ensureOnFile(file, undefined, true))!;

    // The Raw view hands Monaco's text to setContent under the code editor's source id.
    file.setContent(withShaking(file.content as string), FileUpdateType.regularEdit, "JSONEditor|" + fileName);

    const reopened = (await EntityTypeDefinition.ensureOnFile(file, undefined, true))!;
    expect(reopened, "the file keeps one manager").to.equal(et);
    expect(et._data!.components, "the Traits tab works on the edited text").to.have.property("minecraft:is_shaking");

    click(et, "flying" as EntityTraitId);

    expect(file.content).to.include("minecraft:navigation.fly");
    expect(file.content, "the raw edit is still there").to.include("minecraft:is_shaking");
    expect(file.content, "and so is the comment").to.match(/^\/\/ vanilla cow/);
  });

  // A forced reload from disk replaces the file's content without the
  // content-updated event, so the manager never hears that it is now older
  // than its file. Each of the three paths that can meet it has to notice on
  // its own: a read, a write, and a trait click.
  async function cowReloadedBehindItsBack(fileName: string) {
    const file = await scratchCowFile(fileName);
    const et = (await EntityTypeDefinition.ensureOnFile(file, undefined, true))!;
    expect(et._data!.components).to.not.have.property("minecraft:is_shaking");

    fs.writeFileSync(scratchRoot + fileName, withShaking(file.content as string));
    await file.loadContent(true);
    expect(et.isOlderThanFile).to.equal(true);

    return { file, et };
  }

  it("a read of a definition whose file was reloaded behind its back parses the newer text, with no write in between", async () => {
    const { file, et } = await cowReloadedBehindItsBack("cow_reloaded_read.json");

    const reloaded = (await EntityTypeDefinition.ensureOnFile(file, undefined, true))!;

    expect(reloaded, "the file keeps one manager").to.equal(et);
    expect(reloaded.isOlderThanFile).to.equal(false);
    expect(reloaded._data!.components, "the load sees the newer text").to.have.property("minecraft:is_shaking");
    expect(file.content, "and nothing was written").to.include("minecraft:is_shaking");
  });

  it("a write of a definition whose file was reloaded behind its back is refused, and the definition reloads itself", async () => {
    const { file, et } = await cowReloadedBehindItsBack("cow_reloaded_write.json");
    let loadedEvents = 0;
    et.onLoaded.subscribe(() => loadedEvents++);

    expect(et.persist(), "the older definition is not written").to.equal(false);

    expect(file.content, "the newer text is untouched").to.include("minecraft:is_shaking");
    expect(et.isLoaded, "the definition is loaded again rather than left empty").to.equal(true);
    expect(et._data!.components, "with the file's current text").to.have.property("minecraft:is_shaking");
    expect(loadedEvents, "and its listeners heard about it").to.equal(1);

    click(et, "flying" as EntityTraitId);
    expect(file.content).to.include("minecraft:navigation.fly");
    expect(file.content).to.include("minecraft:is_shaking");
  });

  it("a trait click on a definition whose file was reloaded behind its back changes and records nothing", async () => {
    const { file, et } = await cowReloadedBehindItsBack("cow_reloaded_click.json");
    const item: IEntityTraitOverrides = {};

    const report = click(et, "humanoid" as EntityTraitId, item);

    expect(report.staleDefinition).to.equal(true);
    expect(report.added).to.deep.equal([]);
    expect(report.removed).to.deep.equal([]);
    expect(item.bodyShape, "no body shape was recorded on the item").to.equal(undefined);
    expect(item.traitJournal, "no journal was recorded on the item").to.equal(undefined);
    expect(file.content, "the file was not written").to.include("minecraft:is_shaking");
    expect(detectTraits(et, item), "the definition shows what the file holds").to.include("quadruped");
    expect(et._data!.components).to.have.property("minecraft:is_shaking");

    const second = click(et, "humanoid" as EntityTraitId, item);
    expect(second.staleDefinition).to.equal(undefined);
    expect(item.bodyShape, "the next click goes through").to.equal("humanoid");
    expect(file.content).to.include("minecraft:is_shaking");
  });
});

/**
 * A trait click changes two things: the entity file and the project item's
 * bodyShape/traitJournal. They have to reach disk together through whichever
 * save path comes next, or reopening restores journal entries against an
 * entity file that never had the removal.
 */
describe("EntityTraitApplier and project saves", () => {
  const projectsRoot = scratchRoot + "projects/";
  let env: ITestEnvironment;

  before(async function () {
    this.timeout(60000);
    env = await TestPaths.createTestEnvironment();
    registerAllEntityTraits();
  });

  /** A folder project with one behavior pack holding a commented copy of the vanilla cow. */
  async function cowProject(name: string): Promise<{ project: Project; item: ProjectItem; et: EntityTypeDefinition }> {
    const root = projectsRoot + name + "/";
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root + "behavior_packs/bp/entities/", { recursive: true });
    fs.writeFileSync(
      root + "behavior_packs/bp/manifest.json",
      JSON.stringify(
        {
          format_version: 2,
          header: {
            name: name,
            description: "",
            uuid: "7a4c0d2e-5b1f-4e8a-9c3d-1b2a3c4d5e6f",
            version: [1, 0, 0],
            min_engine_version: [1, 21, 0],
          },
          modules: [{ type: "data", uuid: "0f1e2d3c-4b5a-4697-8877-665544332211", version: [1, 0, 0] }],
        },
        null,
        2
      )
    );
    fs.writeFileSync(
      root + "behavior_packs/bp/entities/cow.behavior.json",
      "// vanilla cow\n" + fs.readFileSync(vanillaEntitiesRoot + "cow.json", "utf8")
    );

    const storage = new NodeStorage(root, "");
    const preferences = await storage.rootFolder.ensureFileFromRelativePath("/.mct/prefs.mctp.json");
    const project = new Project(env.creatorTools, name, preferences);
    project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
    project.localFolderPath = root;
    await project.inferProjectItemsFromFiles();

    const entities = project.items.filter((candidate) => candidate.itemType === ProjectItemType.entityTypeBehavior);
    expect(entities, "the cow is the project's one entity").to.have.length(1);
    const item = entities[0];
    await item.loadContent();
    const et = (await EntityTypeDefinition.ensureOnFile(item.primaryFile!, undefined, true))!;

    return { project, item, et };
  }

  function cowAdultOnDisk(item: ProjectItem): any {
    const wrapper = parseJsonWithComments(fs.readFileSync(item.primaryFile!.fullPath, "utf8")) as any;
    return wrapper["minecraft:entity"].component_groups["minecraft:cow_adult"];
  }

  function savedJournalFor(name: string): any {
    const prefs = JSON.parse(fs.readFileSync(projectsRoot + name + "/.mct/prefs.mctp.json", "utf8"));
    return prefs.items.find((saved: any) => saved.traitJournal)?.traitJournal;
  }

  // ProjectEditor._handleNewVariantOK saves the project straight after
  // creating the variant, with no persist of the active editor in between.
  it("creating a variant right after a trait click saves the entity, the variant and the journal together", async function () {
    this.timeout(30000);
    const name = "variant_after_click";
    const { project, item, et } = await cowProject(name);

    click(et, "rideable" as EntityTraitId, item);
    expect(item.traitJournal?.removedByTrait["rideable"], "the removal is journaled on the item").to.exist;

    await ProjectItemVariantCreateManager.createVariant(item, { label: "1.26.50" });
    await project.save();

    expect(cowAdultOnDisk(item), "the entity file on disk has the removal").to.not.have.property("minecraft:rideable");
    expect(fs.readFileSync(item.primaryFile!.fullPath, "utf8")).to.match(/^\/\/ vanilla cow/);

    const variant = item.getVariant("1.26.50");
    expect(variant?.file, "the variant was created").to.exist;
    const variantCowAdult = (parseJsonWithComments(fs.readFileSync(variant!.file!.fullPath, "utf8")) as any)[
      "minecraft:entity"
    ].component_groups["minecraft:cow_adult"];
    expect(variantCowAdult, "the variant is a copy of the clicked entity").to.not.have.property("minecraft:rideable");

    expect(savedJournalFor(name)?.removedByTrait?.rideable, "the journal reached disk with the entity").to.exist;
  });

  // The Save path persists the active editor first and then saves the project;
  // a click in between used to reach the preferences but not the entity file.
  it("a trait click after the editor's persist and before the project save still reaches disk with its journal", async function () {
    this.timeout(30000);
    const name = "click_before_save";
    const { project, item, et } = await cowProject(name);
    expect(et.persist(), "nothing pending at the editor's initial persist").to.equal(false);

    click(et, "rideable" as EntityTraitId, item);
    await project.save();

    expect(cowAdultOnDisk(item)).to.not.have.property("minecraft:rideable");
    expect(savedJournalFor(name)?.removedByTrait?.rideable).to.exist;
  });

  it("a save participant runs before the items are written, whichever path asks for the save", async function () {
    this.timeout(30000);
    const { project, item, et } = await cowProject("save_participant");
    const entityPath = item.primaryFile!.fullPath;

    // An edit held in memory the way a form editor holds one until its persist runs.
    et._data!.components["minecraft:is_shaking"] = {};
    let diskHadEditWhenParticipantRan: boolean | undefined;
    let runs = 0;
    const participant = () => {
      runs++;
      diskHadEditWhenParticipantRan = fs.readFileSync(entityPath, "utf8").includes("minecraft:is_shaking");
      et.persist();
    };
    project.addSaveParticipant(participant);
    project.addSaveParticipant(participant);

    await project.save();
    expect(runs, "registering the same participant twice registers it once").to.equal(1);
    expect(diskHadEditWhenParticipantRan, "the participant ran before the entity was written").to.equal(false);
    expect(fs.readFileSync(entityPath, "utf8"), "and its persist made the save").to.include("minecraft:is_shaking");

    project.removeSaveParticipant(participant);
    await project.save();
    expect(runs, "a removed participant no longer runs").to.equal(1);
  });

  it("a participant that throws is skipped and the save still happens, and one that saves does not recurse", async function () {
    this.timeout(30000);
    const { project, item, et } = await cowProject("save_participant_faults");
    const entityPath = item.primaryFile!.fullPath;

    let runs = 0;
    const throwing = () => {
      runs++;
      throw new Error("this editor is broken");
    };
    let nestedSaves = 0;
    const saving = async () => {
      runs++;
      nestedSaves++;
      await project.save();
    };
    project.addSaveParticipant(throwing);
    project.addSaveParticipant(saving);

    et._data!.components["minecraft:is_shaking"] = {};
    et.persist();
    await project.save();

    expect(runs, "both participants ran exactly once").to.equal(2);
    expect(nestedSaves, "the nested save did not run the participants again").to.equal(1);
    expect(fs.readFileSync(entityPath, "utf8"), "the project was saved past the broken participant").to.include(
      "minecraft:is_shaking"
    );
  });
});

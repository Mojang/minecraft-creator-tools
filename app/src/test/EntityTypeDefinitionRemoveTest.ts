// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * EntityTypeDefinitionRemoveTest — Covers removing a component group (a
 * "state" in the mob editor) or an event (an "action") from an entity
 * definition. Either removal has to take its references with it: a removed
 * group must leave no event adding or removing it, and a removed event must
 * leave no component trigger firing it, or the file stops loading in game.
 */

import { expect } from "chai";
import "mocha";

import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";

function entityFromData(data: any): EntityTypeDefinition {
  const et = new EntityTypeDefinition();
  et._ensureBehaviorPackDataInitialized();
  et._data = JSON.parse(JSON.stringify(data));
  return et;
}

function mobWithGroups(): EntityTypeDefinition {
  return entityFromData({
    description: { identifier: "test:mob" },
    components: {
      "minecraft:health": { value: 10, max: 10 },
      "minecraft:type_family": { family: ["mob"] },
    },
    component_groups: {
      "test:baby": { "minecraft:is_baby": {}, "minecraft:scale": { value: 0.5 } },
      "test:adult": { "minecraft:scale": { value: 1 } },
      "test:angry": { "minecraft:angry": { duration: 25 } },
    },
    events: {
      "minecraft:entity_born": { add: { component_groups: ["test:baby"] } },
      "minecraft:ageable_grow_up": {
        remove: { component_groups: ["test:baby"] },
        add: { component_groups: ["test:adult"] },
      },
      "minecraft:entity_spawned": {
        randomize: [
          { weight: 1, add: { component_groups: ["test:baby"] } },
          { weight: 4, add: { component_groups: ["test:adult"] } },
        ],
      },
      "test:calm_down": {
        sequence: [
          { remove: { component_groups: ["test:angry"] } },
          { randomize: [{ remove: { component_groups: ["test:baby", "test:angry"] } }] },
        ],
      },
      "test:unrelated": { add: { component_groups: ["test:angry"] } },
      "test:empty": {},
    },
  });
}

function mobWithTriggers(): EntityTypeDefinition {
  return entityFromData({
    description: { identifier: "test:mob" },
    components: {
      "minecraft:health": { value: 10, max: 10 },
      "minecraft:timer": {
        time: 30,
        looping: false,
        time_down_event: { event: "test:timer_done", target: "self" },
      },
      "minecraft:environment_sensor": {
        triggers: [
          { filters: { test: "is_underwater", value: true }, event: "test:went_under" },
          { filters: { test: "is_underwater", value: false }, event: "test:surfaced" },
        ],
      },
      "minecraft:on_hurt": { event: "test:got_hurt", target: "self" },
    },
    component_groups: {
      "test:tamed": {
        "minecraft:interact": {
          interactions: [
            {
              on_interact: { filters: { test: "has_equipment", value: "bone" }, event: "test:fed" },
              use_item: true,
            },
          ],
        },
        "minecraft:timer": { time: 5, time_down_event: { event: "test:timer_done" } },
      },
    },
    events: {
      "test:timer_done": { add: { component_groups: ["test:tamed"] } },
      "test:went_under": {},
      "test:surfaced": {},
      "test:got_hurt": {},
      "test:fed": {},
    },
  });
}

/**
 * A cow-style mob: the milking interaction has eligibility filters, an item
 * transform and a sound next to its event, several triggers name the same
 * event with different targets, and the events call each other via trigger.
 */
function mobWithInvocations(): EntityTypeDefinition {
  const milkFilters = {
    all_of: [
      { test: "is_family", subject: "other", value: "player" },
      { test: "has_equipment", domain: "hand", subject: "other", value: "bucket:0" },
    ],
  };

  return entityFromData({
    description: { identifier: "test:mob" },
    components: {
      "minecraft:interact": {
        interactions: [
          {
            on_interact: { filters: milkFilters, event: "test:milked" },
            use_item: true,
            transform_to_item: "bucket:1",
            play_sounds: "milk",
          },
          { on_interact: { filters: { test: "has_equipment", value: "stick" }, event: "test:reset", target: "other" } },
          { on_interact: { event: "test:reset" }, use_item: true },
        ],
      },
      "minecraft:on_hurt": { event: "test:reset", target: "other" },
      "minecraft:on_death": { event: "test:reset", target: "self" },
    },
    component_groups: {
      "test:active": { "minecraft:is_tamed": {} },
    },
    events: {
      "test:milked": {},
      "test:reset": {},
      "test:finish": { remove: { component_groups: ["test:active"] } },
      "test:start": {
        sequence: [{ trigger: "test:finish" }, { add: { component_groups: ["test:active"] } }],
      },
      "test:restart": {
        randomize: [
          { weight: 1, trigger: { event: "test:finish", target: "self" } },
          { weight: 1, trigger: { event: "test:finish", target: "other" } },
        ],
      },
      "test:chain": { trigger: "test:finish", filters: { test: "is_baby", value: false } },
      "test:after_milk": { trigger: "test:milked" },
    },
  });
}

describe("EntityTypeDefinition.removeComponentGroup", () => {
  it("lists the events that reference the group, including nested ones", () => {
    const et = mobWithGroups();

    expect(et.getComponentGroupReferences("test:baby")).to.have.members([
      "minecraft:entity_born",
      "minecraft:ageable_grow_up",
      "minecraft:entity_spawned",
      "test:calm_down",
    ]);
    expect(et.getComponentGroupReferences("test:adult")).to.have.members([
      "minecraft:ageable_grow_up",
      "minecraft:entity_spawned",
    ]);
    expect(et.getComponentGroupReferences("test:missing")).to.deep.equal([]);
  });

  it("removes the group and strips it from top-level and nested add/remove lists", () => {
    const et = mobWithGroups();

    const affected = et.removeComponentGroup("test:baby");

    expect(affected).to.have.members([
      "minecraft:entity_born",
      "minecraft:ageable_grow_up",
      "minecraft:entity_spawned",
      "test:calm_down",
    ]);
    expect(et._data!.component_groups).to.not.have.property("test:baby");
    expect(et.getComponentGroupReferences("test:baby")).to.deep.equal([]);

    const events = et._data!.events as any;
    expect(events["minecraft:ageable_grow_up"]).to.deep.equal({ add: { component_groups: ["test:adult"] } });
    expect(events["minecraft:entity_spawned"].randomize).to.deep.equal([
      { weight: 1 },
      { weight: 4, add: { component_groups: ["test:adult"] } },
    ]);
    expect(events["test:calm_down"].sequence).to.deep.equal([
      { remove: { component_groups: ["test:angry"] } },
      { randomize: [{ remove: { component_groups: ["test:angry"] } }] },
    ]);
  });

  it("drops add/remove objects that end up empty", () => {
    const et = mobWithGroups();

    et.removeComponentGroup("test:baby");

    const events = et._data!.events as any;
    expect(events["minecraft:entity_born"]).to.deep.equal({});
    expect(events["minecraft:entity_born"]).to.not.have.property("add");
    expect(events["minecraft:ageable_grow_up"]).to.not.have.property("remove");
  });

  it("leaves events that do not reference the group alone", () => {
    const et = mobWithGroups();
    const unrelatedBefore = JSON.stringify(et._data!.events["test:unrelated"]);

    const affected = et.removeComponentGroup("test:baby");

    expect(affected).to.not.include("test:unrelated");
    expect(affected).to.not.include("test:empty");
    expect(JSON.stringify(et._data!.events["test:unrelated"])).to.equal(unrelatedBefore);
    expect(et._data!.events["test:empty"]).to.deep.equal({});
  });

  it("is a no-op for a group that does not exist", () => {
    const et = mobWithGroups();
    const before = JSON.stringify(et._data);

    expect(et.removeComponentGroup("test:missing")).to.deep.equal([]);
    expect(JSON.stringify(et._data)).to.equal(before);
  });

  it("stops handing out the removed group", () => {
    const et = mobWithGroups();

    const cached = et.getComponentGroup("test:baby");
    expect(cached).to.not.equal(undefined);
    expect(et.getComponentGroups().map((cg) => cg.id)).to.include("test:baby");

    et.removeComponentGroup("test:baby");

    expect(et.getComponentGroup("test:baby")).to.equal(undefined);
    expect(et.getComponentGroups().map((cg) => cg.id)).to.have.members(["test:adult", "test:angry"]);
  });

  it("never touches the base components", () => {
    const et = mobWithGroups();
    const componentsBefore = JSON.stringify(et._data!.components);

    et.removeComponentGroup("test:baby");
    et.removeComponentGroup("test:angry");

    expect(JSON.stringify(et._data!.components)).to.equal(componentsBefore);
    expect(et.getComponents().map((c) => c.id)).to.have.members(["minecraft:health", "minecraft:type_family"]);
  });
});

describe("EntityTypeDefinition.removeEvent", () => {
  it("describes the components whose triggers fire the event", () => {
    const et = mobWithTriggers();

    expect(et.getEventReferences("test:timer_done")).to.have.members([
      "minecraft:timer",
      "group test:tamed > minecraft:timer",
    ]);
    expect(et.getEventReferences("test:went_under")).to.deep.equal(["minecraft:environment_sensor"]);
    expect(et.getEventReferences("test:fed")).to.deep.equal(["group test:tamed > minecraft:interact"]);
    expect(et.getEventReferences("test:got_hurt")).to.deep.equal(["minecraft:on_hurt"]);
    expect(et.getEventReferences("test:missing")).to.deep.equal([]);
  });

  it("removes the event and the trigger property that fired it", () => {
    const et = mobWithTriggers();

    const cleaned = et.removeEvent("test:timer_done");

    expect(cleaned).to.have.members(["minecraft:timer", "group test:tamed > minecraft:timer"]);
    expect(et._data!.events).to.not.have.property("test:timer_done");
    expect(et.getEvent("test:timer_done")).to.equal(undefined);
    expect(et.getEvents().map((e) => e.id)).to.not.include("test:timer_done");

    const components = et._data!.components as any;
    expect(components["minecraft:timer"]).to.deep.equal({ time: 30, looping: false });

    const tamed = et._data!.component_groups["test:tamed"] as any;
    expect(tamed["minecraft:timer"]).to.deep.equal({ time: 5 });
  });

  it("removes a trigger held in an array without disturbing its siblings", () => {
    const et = mobWithTriggers();

    const cleaned = et.removeEvent("test:went_under");

    expect(cleaned).to.deep.equal(["minecraft:environment_sensor"]);

    const sensor = (et._data!.components as any)["minecraft:environment_sensor"];
    expect(sensor.triggers).to.deep.equal([
      { filters: { test: "is_underwater", value: false }, event: "test:surfaced" },
    ]);
    expect(et.getEventReferences("test:surfaced")).to.deep.equal(["minecraft:environment_sensor"]);
  });

  it("removes a trigger from a component inside a component group", () => {
    const et = mobWithTriggers();

    const cleaned = et.removeEvent("test:fed");

    expect(cleaned).to.deep.equal(["group test:tamed > minecraft:interact"]);

    // The interaction keeps its eligibility filters; only the event invocation goes.
    const tamed = et._data!.component_groups["test:tamed"] as any;
    expect(tamed["minecraft:interact"].interactions).to.deep.equal([
      { on_interact: { filters: { test: "has_equipment", value: "bone" } }, use_item: true },
    ]);
    expect(tamed["minecraft:timer"]).to.deep.equal({ time: 5, time_down_event: { event: "test:timer_done" } });
  });

  it("keeps the filters and sibling effects of an interaction when only its event is removed", () => {
    const et = mobWithInvocations();

    const cleaned = et.removeEvent("test:milked");

    expect(cleaned).to.have.members(["minecraft:interact", "action test:after_milk"]);

    const interactions = (et._data!.components as any)["minecraft:interact"].interactions;
    expect(interactions[0]).to.deep.equal({
      on_interact: {
        filters: {
          all_of: [
            { test: "is_family", subject: "other", value: "player" },
            { test: "has_equipment", domain: "hand", subject: "other", value: "bucket:0" },
          ],
        },
      },
      use_item: true,
      transform_to_item: "bucket:1",
      play_sounds: "milk",
    });
    expect(interactions).to.have.length(3);
    expect(et.getEventReferences("test:milked")).to.deep.equal([]);
  });

  it("leaves triggers aimed at another entity alone, even for the same event name", () => {
    const et = mobWithInvocations();

    expect(et.getEventReferences("test:reset")).to.have.members(["minecraft:interact", "minecraft:on_death"]);

    const cleaned = et.removeEvent("test:reset");

    expect(cleaned).to.have.members(["minecraft:interact", "minecraft:on_death"]);
    expect(et._data!.events).to.not.have.property("test:reset");

    const components = et._data!.components as any;
    expect(
      components["minecraft:interact"].interactions[1],
      "the interaction targeting the other entity"
    ).to.deep.equal({
      on_interact: { filters: { test: "has_equipment", value: "stick" }, event: "test:reset", target: "other" },
    });
    expect(components["minecraft:interact"].interactions[2], "the local interaction").to.deep.equal({
      use_item: true,
    });
    expect(components["minecraft:on_hurt"], "the component targeting the other entity").to.deep.equal({
      event: "test:reset",
      target: "other",
    });
    expect(components).to.not.have.property("minecraft:on_death");
  });

  it("describes the actions that trigger the event, at the root and inside sequence/randomize", () => {
    const et = mobWithInvocations();

    expect(et.getEventReferences("test:finish")).to.have.members([
      "action test:start",
      "action test:restart",
      "action test:chain",
    ]);
    expect(et.getEventReferences("test:milked")).to.have.members(["minecraft:interact", "action test:after_milk"]);
  });

  it("removes only the local trigger from the actions that call the event, keeping their other responses", () => {
    const et = mobWithInvocations();

    const cleaned = et.removeEvent("test:finish");

    expect(cleaned).to.have.members(["action test:start", "action test:restart", "action test:chain"]);
    expect(et._data!.events).to.not.have.property("test:finish");

    const events = et._data!.events as any;
    expect(events["test:start"].sequence).to.deep.equal([{}, { add: { component_groups: ["test:active"] } }]);
    expect(events["test:restart"].randomize).to.deep.equal([
      { weight: 1 },
      { weight: 1, trigger: { event: "test:finish", target: "other" } },
    ]);
    expect(events["test:chain"]).to.deep.equal({ filters: { test: "is_baby", value: false } });
    expect(events["test:after_milk"]).to.deep.equal({ trigger: "test:milked" });
    expect(et.getEventReferences("test:finish")).to.deep.equal([]);
  });

  it("removes a component that is itself the trigger", () => {
    const et = mobWithTriggers();

    const cleaned = et.removeEvent("test:got_hurt");

    expect(cleaned).to.deep.equal(["minecraft:on_hurt"]);
    expect(et._data!.components).to.not.have.property("minecraft:on_hurt");
    expect(et.getComponent("minecraft:on_hurt")).to.equal(undefined);
    expect(et.getComponents().map((c) => c.id)).to.have.members([
      "minecraft:health",
      "minecraft:timer",
      "minecraft:environment_sensor",
    ]);
  });

  it("is a no-op for an event that does not exist", () => {
    const et = mobWithTriggers();
    const before = JSON.stringify(et._data);

    expect(et.removeEvent("test:missing")).to.deep.equal([]);
    expect(JSON.stringify(et._data)).to.equal(before);
  });

  it("leaves the component groups themselves in place", () => {
    const et = mobWithTriggers();

    et.removeEvent("test:timer_done");
    et.removeEvent("test:fed");

    expect(et.getComponentGroups().map((cg) => cg.id)).to.deep.equal(["test:tamed"]);
  });
});

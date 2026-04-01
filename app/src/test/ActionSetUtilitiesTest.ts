// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ActionSetUtilitiesTest.ts
 *
 * Roundtrip tests for ActionSetUtilities: entity event JSON → ActionSet → event JSON.
 * Also validates entity event form definitions for Blockly block completeness.
 * Validates that:
 *   - Leaf actions (add, remove, trigger, queue_command, etc.) are preserved
 *   - Sequence and randomize group structures are preserved
 *   - Nested groups (randomize→sequence→leaf) roundtrip correctly
 *   - Flat events (no sequence/randomize wrapper) roundtrip
 *   - Weight values are preserved
 *   - Empty events produce empty ActionSets
 *   - All leaf action verb types survive the roundtrip
 *   - Entity event form definitions have required fields and tags for Blockly blocks
 */

import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import ActionSetUtilities from "../UX/editors/action/ActionSetUtilities";
import IEventAction from "../minecraft/IEventAction";
import IEventActionSet from "../minecraft/IEventActionSet";
import IFormDefinition from "../dataform/IFormDefinition";
import { FieldDataType } from "../dataform/IField";
import ActionGroup from "../actions/ActionGroup";
import Action from "../actions/Action";

describe("ActionSetUtilities", function () {
  describe("createActionSetFromEvent — leaf action conversion", () => {
    const leafActionCases: {
      name: string;
      event: IEventActionSet;
      expectedActionTypes: string[];
    }[] = [
      {
        name: "sequence with add_component_group",
        event: {
          sequence: [{ add: { component_groups: ["adult"] } } as IEventAction],
        },
        expectedActionTypes: ["add_component_group"],
      },
      {
        name: "sequence with remove_component_group",
        event: {
          sequence: [{ remove: { component_groups: ["baby"] } } as IEventAction],
        },
        expectedActionTypes: ["remove_component_group"],
      },
      {
        name: "sequence with trigger (string form)",
        event: {
          sequence: [{ trigger: "my_event" } as IEventAction],
        },
        expectedActionTypes: ["trigger"],
      },
      {
        name: "sequence with queue_command",
        event: {
          sequence: [{ queue_command: { command: "say hello" } } as IEventAction],
        },
        expectedActionTypes: ["queue_command"],
      },
      {
        name: "sequence with set_property",
        event: {
          sequence: [{ set_property: { "minecraft:variant": 1 } } as IEventAction],
        },
        expectedActionTypes: ["set_property"],
      },
      {
        name: "sequence with play_sound",
        event: {
          sequence: [{ play_sound: { sound: "mob.cow.say" } } as IEventAction],
        },
        expectedActionTypes: ["play_sound"],
      },
      {
        name: "sequence with emit_vibration",
        event: {
          sequence: [{ emit_vibration: { vibration: "entity_act" } } as IEventAction],
        },
        expectedActionTypes: ["emit_vibration"],
      },
      {
        name: "sequence with emit_particle",
        event: {
          sequence: [{ emit_particle: { particle: "minecraft:heart_particle" } } as IEventAction],
        },
        expectedActionTypes: ["emit_particle"],
      },
      {
        name: "sequence with reset_target",
        event: {
          sequence: [{ reset_target: {} } as IEventAction],
        },
        expectedActionTypes: ["reset_target"],
      },
      {
        name: "sequence with multiple leaf actions",
        event: {
          sequence: [
            { add: { component_groups: ["grown"] } } as IEventAction,
            { remove: { component_groups: ["baby"] } } as IEventAction,
            { trigger: "on_grown" } as IEventAction,
          ],
        },
        expectedActionTypes: ["add_component_group", "remove_component_group", "trigger"],
      },
    ];

    for (const tc of leafActionCases) {
      it(`should convert leaf actions in ${tc.name}`, () => {
        const actionSet = ActionSetUtilities.createActionSetFromEvent(tc.event, "test_event");

        expect(actionSet).to.not.be.undefined;
        expect(actionSet.actionSetData.actions.length).to.equal(tc.expectedActionTypes.length);

        for (let i = 0; i < tc.expectedActionTypes.length; i++) {
          // Each entry is now wrapped in a sub-group (IActionGroup)
          const subGroup = actionSet.actionSetData.actions[i];
          expect((subGroup as any).actions).to.not.be.undefined;
          expect((subGroup as any).actions[0].type).to.equal(tc.expectedActionTypes[i]);
        }
      });
    }
  });

  describe("createActionSetFromEvent — flat events", () => {
    it("should handle a flat event with no sequence/randomize wrapper", () => {
      const flatEvent: IEventAction = {
        add: { component_groups: ["adult"] },
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(flatEvent, "flat_event");

      expect(actionSet.actionSetData.actions.length).to.equal(1);
      expect((actionSet.actionSetData.actions[0] as any).type).to.equal("add_component_group");
    });

    it("should return empty ActionSet for event with no recognizable properties", () => {
      const emptyEvent = {} as IEventAction;

      const actionSet = ActionSetUtilities.createActionSetFromEvent(emptyEvent, "empty_event");

      expect(actionSet.actionSetData.actions.length).to.equal(0);
    });
  });

  describe("createActionSetFromEvent — group structure", () => {
    it("should set groupActionType to randomize for randomize events", () => {
      const event: IEventActionSet = {
        randomize: [{ add: { component_groups: ["variant_a"] } } as IEventAction],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(event, "rand_event");

      expect(actionSet.actionSetData.groupActionType).to.equal("randomize");
    });

    it("should set groupActionType to sequence for sequence events", () => {
      const event: IEventActionSet = {
        sequence: [{ trigger: "step1" } as IEventAction],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(event, "seq_event");

      expect(actionSet.actionSetData.groupActionType).to.equal("sequence");
    });

    it("should handle nested randomize inside sequence", () => {
      const event: IEventActionSet = {
        sequence: [
          { add: { component_groups: ["setup"] } } as IEventAction,
          {
            randomize: [
              { add: { component_groups: ["variant_a"] } } as IEventAction,
              { add: { component_groups: ["variant_b"] } } as IEventAction,
            ],
          } as IEventActionSet,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(event, "nested_event");

      expect(actionSet.actionSetData.groupActionType).to.equal("sequence");
      expect(actionSet.actionSetData.actions.length).to.equal(2);

      // First child is a sub-group wrapping a leaf action
      const firstChild = actionSet.actionSetData.actions[0];
      expect((firstChild as any).groupActionType).to.equal("sequence");
      expect((firstChild as any).actions[0].type).to.equal("add_component_group");

      // Second child is a nested randomize group
      const secondChild = actionSet.actionSetData.actions[1];
      expect((secondChild as any).groupActionType).to.equal("randomize");
      expect((secondChild as any).actions.length).to.equal(2);
    });
  });

  describe("createActionSetFromEvent — weight preservation", () => {
    it("should preserve weight on leaf actions in randomize groups", () => {
      const event: IEventActionSet = {
        randomize: [
          { weight: 3, add: { component_groups: ["common"] } } as IEventAction,
          { weight: 1, add: { component_groups: ["rare"] } } as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(event, "weighted_event");

      expect(actionSet.actionSetData.actions.length).to.equal(2);
      expect((actionSet.actionSetData.actions[0] as any).groupActionData.weight).to.equal(3);
      expect((actionSet.actionSetData.actions[1] as any).groupActionData.weight).to.equal(1);
    });

    it("should preserve weight on nested groups", () => {
      const event: IEventActionSet = {
        randomize: [
          {
            weight: 5,
            sequence: [{ trigger: "path_a" } as IEventAction],
          } as IEventActionSet & IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(event, "weighted_group");

      expect(actionSet.actionSetData.actions.length).to.equal(1);
      const child = actionSet.actionSetData.actions[0] as any;
      expect(child.groupActionType).to.equal("sequence");
      expect(child.groupActionData.weight).to.equal(5);
    });
  });

  describe("Roundtrip: event → ActionSet → event", () => {
    it("should roundtrip a simple sequence with add and remove", () => {
      const original: IEventActionSet = {
        sequence: [
          { add: { component_groups: ["adult"] } } as IEventAction,
          { remove: { component_groups: ["baby"] } } as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "roundtrip1");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      expect((result as IEventActionSet).sequence).to.not.be.undefined;
      const seq = (result as IEventActionSet).sequence!;
      expect(seq.length).to.equal(2);

      expect((seq[0] as IEventAction).add).to.not.be.undefined;
      expect((seq[0] as IEventAction).add!.component_groups).to.deep.equal(["adult"]);

      expect((seq[1] as IEventAction).remove).to.not.be.undefined;
      expect((seq[1] as IEventAction).remove!.component_groups).to.deep.equal(["baby"]);
    });

    it("should roundtrip a randomize with weighted branches", () => {
      const original: IEventActionSet = {
        randomize: [
          { weight: 3, add: { component_groups: ["common"] } } as IEventAction,
          { weight: 1, add: { component_groups: ["rare"] } } as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "roundtrip2");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      expect((result as IEventActionSet).randomize).to.not.be.undefined;
      const rand = (result as IEventActionSet).randomize!;
      expect(rand.length).to.equal(2);

      expect((rand[0] as IEventAction).weight).to.equal(3);
      expect((rand[0] as IEventAction).add!.component_groups).to.deep.equal(["common"]);

      expect((rand[1] as IEventAction).weight).to.equal(1);
      expect((rand[1] as IEventAction).add!.component_groups).to.deep.equal(["rare"]);
    });

    it("should roundtrip a flat event with trigger", () => {
      const original: IEventAction = {
        trigger: "spawn_child",
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "roundtrip3");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      expect((result as IEventAction).trigger).to.equal("spawn_child");
    });

    it("should roundtrip a sequence with queue_command", () => {
      const original: IEventActionSet = {
        sequence: [{ queue_command: { command: "say hello world" } } as IEventAction],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "roundtrip4");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      expect((result as IEventActionSet).sequence).to.not.be.undefined;
      const seq = (result as IEventActionSet).sequence!;
      expect(seq.length).to.equal(1);
      expect((seq[0] as IEventAction).queue_command!.command).to.equal("say hello world");
    });

    it("should roundtrip nested randomize inside sequence", () => {
      const original: IEventActionSet = {
        sequence: [
          { add: { component_groups: ["setup"] } } as IEventAction,
          {
            randomize: [
              { add: { component_groups: ["variant_a"] } } as IEventAction,
              { add: { component_groups: ["variant_b"] } } as IEventAction,
            ],
          } as IEventActionSet,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "roundtrip5");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      expect((result as IEventActionSet).sequence).to.not.be.undefined;
      const seq = (result as IEventActionSet).sequence!;
      expect(seq.length).to.equal(2);

      // First: leaf add action
      expect((seq[0] as IEventAction).add).to.not.be.undefined;
      expect((seq[0] as IEventAction).add!.component_groups).to.deep.equal(["setup"]);

      // Second: nested randomize group
      expect((seq[1] as IEventActionSet).randomize).to.not.be.undefined;
      const nested = (seq[1] as IEventActionSet).randomize!;
      expect(nested.length).to.equal(2);
      expect((nested[0] as IEventAction).add!.component_groups).to.deep.equal(["variant_a"]);
      expect((nested[1] as IEventAction).add!.component_groups).to.deep.equal(["variant_b"]);
    });

    it("should roundtrip emit_vibration", () => {
      const original: IEventActionSet = {
        sequence: [{ emit_vibration: { vibration: "entity_act" } } as IEventAction],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "roundtrip6");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      const seq = (result as IEventActionSet).sequence!;
      expect(seq.length).to.equal(1);
      expect((seq[0] as IEventAction).emit_vibration!.vibration).to.equal("entity_act");
    });

    it("should roundtrip play_sound", () => {
      const original: IEventActionSet = {
        sequence: [{ play_sound: { sound: "mob.cow.say" } } as IEventAction],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "roundtrip7");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      const seq = (result as IEventActionSet).sequence!;
      expect((seq[0] as IEventAction).play_sound!.sound).to.equal("mob.cow.say");
    });

    it("should roundtrip emit_particle", () => {
      const original: IEventActionSet = {
        sequence: [{ emit_particle: { particle: "minecraft:heart_particle" } } as IEventAction],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "roundtrip8");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      const seq = (result as IEventActionSet).sequence!;
      expect((seq[0] as IEventAction).emit_particle!.particle).to.equal("minecraft:heart_particle");
    });

    it("should roundtrip set_property", () => {
      const original: IEventActionSet = {
        sequence: [{ set_property: { "minecraft:variant": 2, "minecraft:is_baby": false } } as IEventAction],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "roundtrip9");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      const seq = (result as IEventActionSet).sequence!;
      const props = (seq[0] as IEventAction).set_property;
      expect(props).to.not.be.undefined;
      expect(props!["minecraft:variant"]).to.equal(2);
      expect(props!["minecraft:is_baby"]).to.equal(false);
    });
  });

  describe("createEventFromActionSet — edge cases", () => {
    it("should handle empty ActionSet", () => {
      const event = {} as IEventAction;
      const actionSet = ActionSetUtilities.createActionSetFromEvent(event, "empty");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      // Empty actionSet should produce empty event
      expect(result).to.deep.equal({});
    });
  });

  describe("isActionGroup type guard", () => {
    it("should identify IActionGroup by actions array", () => {
      expect(ActionSetUtilities.isActionGroup({ actions: [], groupActionType: "sequence" })).to.be.true;
    });

    it("should identify IAction as not a group", () => {
      expect(ActionSetUtilities.isActionGroup({ type: "add" })).to.be.false;
    });
  });

  // ---------------------------------------------------------------------------
  // Entity event form definitions — block completeness validation
  // ---------------------------------------------------------------------------
  describe("entity event form definitions — block completeness", () => {
    const catalogPath = require.resolve("@minecraft/bedrock-schemas/catalog.json");
    const formsDir = path.resolve(path.dirname(catalogPath), "forms/entityevents");

    function loadForm(fileName: string): IFormDefinition {
      const filePath = path.join(formsDir, fileName);
      return JSON.parse(fs.readFileSync(filePath, "utf-8")) as IFormDefinition;
    }

    // Every entity event form must have the "entityevent" tag for toolbox inclusion
    const formFiles = [
      "add_component_group.form.json",
      "remove_component_group.form.json",
      "play_sound.form.json",
      "set_property.form.json",
      "trigger.form.json",
      "queue_command.form.json",
      "set_entity_property.form.json",
      "emit_vibration.form.json",
      "emit_particle.form.json",
      "reset_target.form.json",
    ];

    for (const file of formFiles) {
      it(`${file} should have the 'entityevent' tag`, () => {
        const form = loadForm(file);
        expect(form.tags).to.be.an("array").that.includes("entityevent");
      });

      it(`${file} should have a non-empty id`, () => {
        const form = loadForm(file);
        expect(form.id).to.be.a("string").and.not.be.empty;
      });

      it(`${file} should have a title`, () => {
        const form = loadForm(file);
        expect(form.title).to.be.a("string").and.not.be.empty;
      });
    }

    // Forms with fields should have valid FieldDataType values for getBlockFromForm()
    const formsWithFields: { file: string; expectedFieldIds: string[] }[] = [
      { file: "add_component_group.form.json", expectedFieldIds: ["component_groups"] },
      { file: "remove_component_group.form.json", expectedFieldIds: ["component_groups"] },
      { file: "play_sound.form.json", expectedFieldIds: ["sound"] },
      { file: "set_property.form.json", expectedFieldIds: ["property", "value"] },
      { file: "trigger.form.json", expectedFieldIds: ["event", "target"] },
      { file: "queue_command.form.json", expectedFieldIds: ["command", "target"] },
      { file: "emit_vibration.form.json", expectedFieldIds: ["vibration"] },
      { file: "emit_particle.form.json", expectedFieldIds: ["particle"] },
    ];

    for (const { file, expectedFieldIds } of formsWithFields) {
      it(`${file} should contain expected fields: ${expectedFieldIds.join(", ")}`, () => {
        const form = loadForm(file);
        const fieldIds = form.fields.map((f) => f.id);
        for (const expectedId of expectedFieldIds) {
          expect(fieldIds, `missing field '${expectedId}'`).to.include(expectedId);
        }
      });

      it(`${file} fields should have valid FieldDataType for Blockly mapping`, () => {
        const form = loadForm(file);
        // Valid data types that getBlockFromForm() can map to Blockly fields
        const validBlocklyTypes = [
          FieldDataType.int,
          FieldDataType.boolean,
          FieldDataType.string,
          FieldDataType.number,
          FieldDataType.float,
          FieldDataType.point3,
          FieldDataType.intPoint3,
          FieldDataType.location,
          FieldDataType.locationOffset,
        ];

        for (const field of form.fields) {
          // Fields with choices or lookupId don't need a specific data type for mapping
          if (field.choices || field.lookupId) continue;
          expect(validBlocklyTypes, `field '${field.id}' has unmappable dataType ${field.dataType}`).to.include(
            field.dataType
          );
        }
      });
    }

    // trigger.form.json has both regular fields AND a scalarField fallback
    it("trigger.form.json should have a scalarField for simple string usage", () => {
      const form = loadForm("trigger.form.json");
      expect(form.scalarField).to.not.be.undefined;
      expect(form.scalarField!.dataType).to.equal(FieldDataType.string);
    });

    // trigger.form.json 'target' field should have dropdown choices
    it("trigger.form.json 'target' field should have dropdown choices", () => {
      const form = loadForm("trigger.form.json");
      const targetField = form.fields.find((f) => f.id === "target");
      expect(targetField).to.not.be.undefined;
      expect(targetField!.choices).to.be.an("array").with.length.greaterThan(0);
      const choiceIds = targetField!.choices!.map((c) => c.id);
      expect(choiceIds).to.include("self");
      expect(choiceIds).to.include("other");
    });

    // emit_vibration.form.json 'vibration' field should have dropdown choices
    it("emit_vibration.form.json 'vibration' field should have dropdown choices", () => {
      const form = loadForm("emit_vibration.form.json");
      const vibField = form.fields.find((f) => f.id === "vibration");
      expect(vibField).to.not.be.undefined;
      expect(vibField!.choices).to.be.an("array").with.length.greaterThan(0);
    });

    // reset_target has no fields (it's a no-arg action) — verify it still loads
    it("reset_target.form.json should have empty fields array", () => {
      const form = loadForm("reset_target.form.json");
      expect(form.fields).to.be.an("array").that.is.empty;
    });

    // Stage 3: trigger.form.json should have both 'entityevent' and 'trigger' tags
    it("trigger.form.json should have the 'trigger' tag for toolbox categorization", () => {
      const form = loadForm("trigger.form.json");
      expect(form.tags).to.be.an("array").that.includes("trigger");
    });

    // Stage 3: verify block style assignment rules — entity verb forms
    const eventVerbForms = [
      "add_component_group.form.json",
      "remove_component_group.form.json",
      "set_property.form.json",
      "set_entity_property.form.json",
    ];

    for (const file of eventVerbForms) {
      it(`${file} should be assigned event_style (entity verb)`, () => {
        const form = loadForm(file);
        // These forms' ids should match the eventVerbIds list in getBlockFromForm
        const eventVerbIds = ["add_component_group", "remove_component_group", "set_property", "set_entity_property"];
        expect(eventVerbIds).to.include(form.id);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Blockly static block definitions — structural validation
  // ---------------------------------------------------------------------------
  describe("blocklydefs.json — static block structure", () => {
    const defsPath = path.resolve(__dirname, "../../public/data/blocklydefs.json");

    interface IBlocklyDefs {
      items: Array<{
        definition: {
          type: string;
          message0: string;
          args0?: Array<{ type: string; name: string; value?: number; min?: number }>;
          style?: string;
          tooltip?: string;
          previousStatement?: null;
          nextStatement?: null;
        };
        targetType: number;
      }>;
    }

    let defs: IBlocklyDefs;
    before(() => {
      defs = JSON.parse(fs.readFileSync(defsPath, "utf-8")) as IBlocklyDefs;
    });

    it("should contain action_group, action_group_nonrecursive, randomize, sequence", () => {
      const types = defs.items.map((i) => i.definition.type);
      expect(types).to.include("action_group");
      expect(types).to.include("action_group_nonrecursive");
      expect(types).to.include("randomize");
      expect(types).to.include("sequence");
    });

    it("randomize block should have a weight field_number", () => {
      const randomize = defs.items.find((i) => i.definition.type === "randomize")!;
      const weightArg = randomize.definition.args0?.find((a) => a.name === "weight");
      expect(weightArg, "randomize should have a weight arg").to.not.be.undefined;
      expect(weightArg!.type).to.equal("field_number");
      expect(weightArg!.min).to.equal(0);
    });

    it("sequence block should have a weight field_number", () => {
      const sequence = defs.items.find((i) => i.definition.type === "sequence")!;
      const weightArg = sequence.definition.args0?.find((a) => a.name === "weight");
      expect(weightArg, "sequence should have a weight arg").to.not.be.undefined;
      expect(weightArg!.type).to.equal("field_number");
      expect(weightArg!.min).to.equal(0);
    });

    it("randomize and sequence blocks should have filter and actions inputs", () => {
      for (const blockType of ["randomize", "sequence"]) {
        const block = defs.items.find((i) => i.definition.type === blockType)!;
        const filterArg = block.definition.args0?.find((a) => a.name === "filters");
        expect(filterArg, `${blockType} should have filters input`).to.not.be.undefined;
        expect(filterArg!.type).to.equal("input_value");

        const actionsArg = block.definition.args0?.find((a) => a.name === "actions");
        expect(actionsArg, `${blockType} should have actions statement`).to.not.be.undefined;
        expect(actionsArg!.type).to.equal("input_statement");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Weight roundtrip tests
  // ---------------------------------------------------------------------------
  describe("weight roundtrip", () => {
    it("should preserve weight on leaf actions inside randomize", () => {
      const original: IEventActionSet = {
        randomize: [
          { weight: 75, add: { component_groups: ["adult"] } } as IEventAction,
          { weight: 25, add: { component_groups: ["baby"] } } as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "weightLeaf");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);
      const randomized = (result as IEventActionSet).randomize!;
      expect(randomized).to.have.length(2);
      expect((randomized[0] as IEventAction).weight).to.equal(75);
      expect((randomized[1] as IEventAction).weight).to.equal(25);
    });

    it("should preserve weight on nested sequence inside randomize", () => {
      const original: IEventActionSet = {
        randomize: [
          {
            weight: 60,
            sequence: [{ trigger: "event_a" } as IEventAction],
          } as unknown as IEventAction,
          {
            weight: 40,
            sequence: [{ trigger: "event_b" } as IEventAction],
          } as unknown as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "weightNested");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);
      const randomized = (result as IEventActionSet).randomize!;
      expect(randomized).to.have.length(2);
      expect((randomized[0] as IEventAction).weight).to.equal(60);
      expect((randomized[1] as IEventAction).weight).to.equal(40);
    });

    it("should default weight to 1 when not specified", () => {
      const original: IEventActionSet = {
        sequence: [{ add: { component_groups: ["test"] } } as IEventAction],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "noWeight");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);
      const seq = (result as IEventActionSet).sequence!;
      expect((seq[0] as IEventAction).weight).to.equal(1);
    });

    it("should preserve weight of 0 on leaf actions", () => {
      const original: IEventActionSet = {
        randomize: [
          { weight: 0, add: { component_groups: ["disabled"] } } as IEventAction,
          { weight: 1, add: { component_groups: ["enabled"] } } as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "weightZero");
      expect((actionSet.actionSetData.actions[0] as any).groupActionData.weight).to.equal(0);

      const result = ActionSetUtilities.createEventFromActionSet(actionSet);
      const rand = (result as IEventActionSet).randomize!;
      expect((rand[0] as IEventAction).weight).to.equal(0);
      expect((rand[1] as IEventAction).weight).to.equal(1);
    });

    it("should preserve weight of 0 on nested groups", () => {
      const original: IEventActionSet = {
        randomize: [
          {
            weight: 0,
            sequence: [{ trigger: "never" } as IEventAction],
          } as unknown as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "weightZeroGroup");
      const child = actionSet.actionSetData.actions[0] as any;
      expect(child.groupActionData.weight).to.equal(0);

      const result = ActionSetUtilities.createEventFromActionSet(actionSet);
      const rand = (result as IEventActionSet).randomize!;
      expect((rand[0] as IEventAction).weight).to.equal(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Stage 4: Edge case roundtrip tests
  // ---------------------------------------------------------------------------
  describe("edge case roundtrips", () => {
    it("should roundtrip empty sequence", () => {
      const original: IEventActionSet = {
        sequence: [],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "emptySeq");
      expect(actionSet.actionSetData.groupActionType).to.equal("sequence");
      expect(actionSet.actionSetData.actions).to.have.length(0);

      const result = ActionSetUtilities.createEventFromActionSet(actionSet);
      // Empty group produces empty object
      expect(result).to.deep.equal({});
    });

    it("should roundtrip empty randomize", () => {
      const original: IEventActionSet = {
        randomize: [],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "emptyRand");
      expect(actionSet.actionSetData.groupActionType).to.equal("randomize");
      expect(actionSet.actionSetData.actions).to.have.length(0);

      const result = ActionSetUtilities.createEventFromActionSet(actionSet);
      expect(result).to.deep.equal({});
    });

    it("should roundtrip deeply nested groups (3 levels: randomize→sequence→randomize→leaf)", () => {
      const original: IEventActionSet = {
        randomize: [
          {
            weight: 10,
            sequence: [
              {
                randomize: [
                  { weight: 1, add: { component_groups: ["deep_variant_a"] } } as IEventAction,
                  { weight: 2, add: { component_groups: ["deep_variant_b"] } } as IEventAction,
                ],
              } as IEventActionSet,
            ],
          } as unknown as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "deepNest");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      // Level 1: randomize
      expect((result as IEventActionSet).randomize).to.not.be.undefined;
      const level1 = (result as IEventActionSet).randomize!;
      expect(level1).to.have.length(1);
      expect((level1[0] as IEventAction).weight).to.equal(10);

      // Level 2: sequence
      expect((level1[0] as IEventActionSet).sequence).to.not.be.undefined;
      const level2 = (level1[0] as IEventActionSet).sequence!;
      expect(level2).to.have.length(1);

      // Level 3: randomize with leaves
      expect((level2[0] as IEventActionSet).randomize).to.not.be.undefined;
      const level3 = (level2[0] as IEventActionSet).randomize!;
      expect(level3).to.have.length(2);
      expect((level3[0] as IEventAction).weight).to.equal(1);
      expect((level3[0] as IEventAction).add!.component_groups).to.deep.equal(["deep_variant_a"]);
      expect((level3[1] as IEventAction).weight).to.equal(2);
      expect((level3[1] as IEventAction).add!.component_groups).to.deep.equal(["deep_variant_b"]);
    });

    it("should roundtrip single-element sequence (unwraps to leaf on output)", () => {
      const original: IEventActionSet = {
        sequence: [{ trigger: "only_one" } as IEventAction],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "singleSeq");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      // A sequence with one element should still reproduce as sequence
      expect((result as IEventActionSet).sequence).to.not.be.undefined;
      const seq = (result as IEventActionSet).sequence!;
      expect(seq).to.have.length(1);
      expect((seq[0] as IEventAction).trigger).to.equal("only_one");
    });

    it("should roundtrip trigger with object form (event + target)", () => {
      const original: IEventActionSet = {
        sequence: [{ trigger: { event: "spawn_child", target: "other" } } as unknown as IEventAction],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "triggerObj");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      const seq = (result as IEventActionSet).sequence!;
      const trig = (seq[0] as IEventAction).trigger;
      expect(trig).to.not.be.undefined;
      if (typeof trig === "object") {
        expect(trig.event).to.equal("spawn_child");
        expect(trig.target).to.equal("other");
      } else {
        // If converted back as string, it should still contain the event name
        expect(trig).to.equal("spawn_child");
      }
    });

    it("should roundtrip special characters in string values", () => {
      const original: IEventActionSet = {
        sequence: [
          { queue_command: { command: 'say "hello world" & goodbye <test>' } } as IEventAction,
          { play_sound: { sound: "mob.entity:special/sound_1" } } as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "specialChars");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      const seq = (result as IEventActionSet).sequence!;
      expect((seq[0] as IEventAction).queue_command!.command).to.equal('say "hello world" & goodbye <test>');
      expect((seq[1] as IEventAction).play_sound!.sound).to.equal("mob.entity:special/sound_1");
    });

    it("should roundtrip multiple component groups in add/remove", () => {
      const original: IEventActionSet = {
        sequence: [
          { add: { component_groups: ["group_a", "group_b", "group_c"] } } as IEventAction,
          { remove: { component_groups: ["old_a", "old_b"] } } as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "multiGroups");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      const seq = (result as IEventActionSet).sequence!;
      expect((seq[0] as IEventAction).add!.component_groups).to.deep.equal(["group_a", "group_b", "group_c"]);
      expect((seq[1] as IEventAction).remove!.component_groups).to.deep.equal(["old_a", "old_b"]);
    });

    it("should roundtrip all 9 leaf action types in a single randomize", () => {
      const original: IEventActionSet = {
        randomize: [
          { weight: 1, add: { component_groups: ["cg1"] } } as IEventAction,
          { weight: 1, remove: { component_groups: ["cg2"] } } as IEventAction,
          { weight: 1, trigger: "evt1" } as IEventAction,
          { weight: 1, queue_command: { command: "say hi" } } as IEventAction,
          { weight: 1, set_property: { "minecraft:variant": 3 } } as IEventAction,
          { weight: 1, play_sound: { sound: "mob.cat.meow" } } as IEventAction,
          { weight: 1, emit_vibration: { vibration: "entity_interact" } } as IEventAction,
          { weight: 1, emit_particle: { particle: "minecraft:crop_growth_emitter" } } as IEventAction,
          { weight: 1, reset_target: {} } as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "all9");
      expect(actionSet.actionSetData.actions).to.have.length(9);

      const result = ActionSetUtilities.createEventFromActionSet(actionSet);
      const rand = (result as IEventActionSet).randomize!;
      expect(rand).to.have.length(9);

      // Verify each type survived
      expect((rand[0] as IEventAction).add).to.not.be.undefined;
      expect((rand[1] as IEventAction).remove).to.not.be.undefined;
      expect((rand[2] as IEventAction).trigger).to.not.be.undefined;
      expect((rand[3] as IEventAction).queue_command).to.not.be.undefined;
      expect((rand[4] as IEventAction).set_property).to.not.be.undefined;
      expect((rand[5] as IEventAction).play_sound).to.not.be.undefined;
      expect((rand[6] as IEventAction).emit_vibration).to.not.be.undefined;
      expect((rand[7] as IEventAction).emit_particle).to.not.be.undefined;
      expect((rand[8] as IEventAction).reset_target).to.not.be.undefined;

      // All weights should be preserved
      for (let i = 0; i < 9; i++) {
        expect((rand[i] as IEventAction).weight).to.equal(1);
      }
    });

    it("should roundtrip set_property with multiple property types (string, number, boolean)", () => {
      const original: IEventActionSet = {
        sequence: [
          {
            set_property: {
              "minecraft:variant": 5,
              "minecraft:is_baby": false,
              "minecraft:skin_id": "blue",
            },
          } as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "propTypes");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      const seq = (result as IEventActionSet).sequence!;
      const props = (seq[0] as IEventAction).set_property!;
      expect(props["minecraft:variant"]).to.equal(5);
      expect(props["minecraft:is_baby"]).to.equal(false);
      expect(props["minecraft:skin_id"]).to.equal("blue");
    });

    it("should roundtrip mixed sequence and randomize siblings", () => {
      const original: IEventActionSet = {
        sequence: [
          { add: { component_groups: ["init"] } } as IEventAction,
          {
            randomize: [
              { weight: 2, trigger: "path_a" } as IEventAction,
              { weight: 1, trigger: "path_b" } as IEventAction,
            ],
          } as IEventActionSet,
          { trigger: "cleanup" } as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "mixed");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      const seq = (result as IEventActionSet).sequence!;
      expect(seq).to.have.length(3);
      expect((seq[0] as IEventAction).add).to.not.be.undefined;
      expect((seq[1] as IEventActionSet).randomize).to.not.be.undefined;
      expect((seq[1] as IEventActionSet).randomize!).to.have.length(2);
      expect((seq[2] as IEventAction).trigger).to.equal("cleanup");
    });

    it("should handle large action count (20 leaf actions in sequence)", () => {
      const actions: IEventAction[] = [];
      for (let i = 0; i < 20; i++) {
        actions.push({ add: { component_groups: [`group_${i}`] } } as IEventAction);
      }
      const original: IEventActionSet = { sequence: actions };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "large");
      expect(actionSet.actionSetData.actions).to.have.length(20);

      const result = ActionSetUtilities.createEventFromActionSet(actionSet);
      const seq = (result as IEventActionSet).sequence!;
      expect(seq).to.have.length(20);

      for (let i = 0; i < 20; i++) {
        expect((seq[i] as IEventAction).add!.component_groups).to.deep.equal([`group_${i}`]);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Stage 4: Real-world Minecraft entity event patterns
  // ---------------------------------------------------------------------------
  describe("real-world entity event patterns", () => {
    it("should roundtrip cow grow-up event pattern (add adult, remove baby)", () => {
      const original: IEventActionSet = {
        sequence: [
          { add: { component_groups: ["minecraft:cow_adult"] } } as IEventAction,
          { remove: { component_groups: ["minecraft:cow_baby"] } } as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "minecraft:cow_grow_up");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      const seq = (result as IEventActionSet).sequence!;
      expect(seq).to.have.length(2);
      expect((seq[0] as IEventAction).add!.component_groups).to.deep.equal(["minecraft:cow_adult"]);
      expect((seq[1] as IEventAction).remove!.component_groups).to.deep.equal(["minecraft:cow_baby"]);
    });

    it("should roundtrip cat variant selection pattern (weighted randomize)", () => {
      const original: IEventActionSet = {
        randomize: [
          { weight: 3, add: { component_groups: ["minecraft:cat_tabby"] } } as IEventAction,
          { weight: 3, add: { component_groups: ["minecraft:cat_tuxedo"] } } as IEventAction,
          { weight: 3, add: { component_groups: ["minecraft:cat_red_tabby"] } } as IEventAction,
          { weight: 3, add: { component_groups: ["minecraft:cat_siamese"] } } as IEventAction,
          { weight: 3, add: { component_groups: ["minecraft:cat_british_shorthair"] } } as IEventAction,
          { weight: 3, add: { component_groups: ["minecraft:cat_calico"] } } as IEventAction,
          { weight: 3, add: { component_groups: ["minecraft:cat_persian"] } } as IEventAction,
          { weight: 3, add: { component_groups: ["minecraft:cat_ragdoll"] } } as IEventAction,
          { weight: 3, add: { component_groups: ["minecraft:cat_white"] } } as IEventAction,
          { weight: 3, add: { component_groups: ["minecraft:cat_jellie"] } } as IEventAction,
          { weight: 3, add: { component_groups: ["minecraft:cat_all_black"] } } as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "minecraft:entity_spawned");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      const rand = (result as IEventActionSet).randomize!;
      expect(rand).to.have.length(11);
      for (let i = 0; i < 11; i++) {
        expect((rand[i] as IEventAction).weight).to.equal(3);
        expect((rand[i] as IEventAction).add!.component_groups).to.have.length(1);
      }
    });

    it("should roundtrip spawn event with sequence→randomize nesting", () => {
      // Pattern: spawn event that sets up base entity then randomly picks variant
      const original: IEventActionSet = {
        sequence: [
          { add: { component_groups: ["minecraft:entity_base"] } } as IEventAction,
          { trigger: "minecraft:select_variant" } as IEventAction,
          {
            randomize: [
              { weight: 1, add: { component_groups: ["minecraft:variant_0"] } } as IEventAction,
              { weight: 1, add: { component_groups: ["minecraft:variant_1"] } } as IEventAction,
              { weight: 1, add: { component_groups: ["minecraft:variant_2"] } } as IEventAction,
            ],
          } as IEventActionSet,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "minecraft:entity_spawned");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      const seq = (result as IEventActionSet).sequence!;
      expect(seq).to.have.length(3);
      expect((seq[0] as IEventAction).add!.component_groups).to.deep.equal(["minecraft:entity_base"]);
      expect((seq[1] as IEventAction).trigger).to.equal("minecraft:select_variant");

      const nestedRand = (seq[2] as IEventActionSet).randomize!;
      expect(nestedRand).to.have.length(3);
    });

    it("should roundtrip tame event with trigger (object form with target)", () => {
      const original: IEventActionSet = {
        sequence: [
          { add: { component_groups: ["minecraft:tamed"] } } as IEventAction,
          { remove: { component_groups: ["minecraft:wild"] } } as IEventAction,
          { trigger: { event: "minecraft:on_tame", target: "self" } } as unknown as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "minecraft:on_tame");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      const seq = (result as IEventActionSet).sequence!;
      expect(seq).to.have.length(3);
      expect((seq[0] as IEventAction).add!.component_groups).to.deep.equal(["minecraft:tamed"]);
      expect((seq[1] as IEventAction).remove!.component_groups).to.deep.equal(["minecraft:wild"]);
      // trigger may roundtrip as string or object depending on structure
      expect((seq[2] as IEventAction).trigger).to.not.be.undefined;
    });

    it("should roundtrip entity death event with set_property and queue_command", () => {
      const original: IEventActionSet = {
        sequence: [
          { set_property: { "minecraft:is_alive": false } } as IEventAction,
          { queue_command: { command: "scoreboard players add @s deaths 1" } } as IEventAction,
          { emit_vibration: { vibration: "entity_die" } } as IEventAction,
        ],
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "minecraft:on_death");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      const seq = (result as IEventActionSet).sequence!;
      expect(seq).to.have.length(3);
      expect((seq[0] as IEventAction).set_property!["minecraft:is_alive"]).to.equal(false);
      expect((seq[1] as IEventAction).queue_command!.command).to.equal("scoreboard players add @s deaths 1");
      expect((seq[2] as IEventAction).emit_vibration!.vibration).to.equal("entity_die");
    });

    it("should roundtrip flat trigger event (no wrapper)", () => {
      // Many vanilla events are just a flat trigger
      const original: IEventAction = {
        trigger: "minecraft:become_adult",
      };

      const actionSet = ActionSetUtilities.createActionSetFromEvent(original, "minecraft:ageable_grow_up");
      const result = ActionSetUtilities.createEventFromActionSet(actionSet);

      expect((result as IEventAction).trigger).to.equal("minecraft:become_adult");
    });
  });

  // ---------------------------------------------------------------------------
  // Stage 4: createLeafAction comprehensive verb coverage
  // ---------------------------------------------------------------------------
  describe("createLeafAction — comprehensive verb coverage", () => {
    it("should handle add with empty component_groups array", () => {
      const leaf = ActionSetUtilities.createLeafAction({ add: { component_groups: [] } } as IEventAction);
      expect(leaf).to.not.be.undefined;
      expect(leaf!.type).to.equal("add_component_group");
      expect(leaf!.args).to.deep.equal({ component_groups: [] });
    });

    it("should handle trigger string form", () => {
      const leaf = ActionSetUtilities.createLeafAction({ trigger: "my_event" } as IEventAction);
      expect(leaf).to.not.be.undefined;
      expect(leaf!.type).to.equal("trigger");
      expect(leaf!.args).to.deep.equal({ value: "my_event" });
    });

    it("should handle trigger object form", () => {
      const leaf = ActionSetUtilities.createLeafAction({
        trigger: { event: "spawn", target: "other" },
      } as unknown as IEventAction);
      expect(leaf).to.not.be.undefined;
      expect(leaf!.type).to.equal("trigger");
      expect(leaf!.args).to.have.property("event", "spawn");
      expect(leaf!.args).to.have.property("target", "other");
    });

    it("should handle reset_target with empty object", () => {
      const leaf = ActionSetUtilities.createLeafAction({ reset_target: {} } as IEventAction);
      expect(leaf).to.not.be.undefined;
      expect(leaf!.type).to.equal("reset_target");
    });

    it("should return undefined for completely unrecognized event", () => {
      const leaf = ActionSetUtilities.createLeafAction({} as IEventAction);
      expect(leaf).to.be.undefined;
    });

    it("should use first matching verb key when multiple are present", () => {
      // Edge case: event with multiple verb keys (unusual but possible)
      const event = {
        add: { component_groups: ["first"] },
        remove: { component_groups: ["second"] },
      } as IEventAction;

      const leaf = ActionSetUtilities.createLeafAction(event);
      expect(leaf).to.not.be.undefined;
      // Should pick "add" since it appears first in LEAF_ACTION_KEYS, mapped to form ID
      expect(leaf!.type).to.equal("add_component_group");
    });
  });

  // ---------------------------------------------------------------------------
  // Stage 4: createEventActionFromLeaf — reverse conversion edge cases
  // ---------------------------------------------------------------------------
  describe("createEventActionFromLeaf — reverse conversion edge cases", () => {
    it("should produce add with empty component_groups when args is undefined (form ID)", () => {
      const result = ActionSetUtilities.createEventActionFromLeaf({ type: "add_component_group" } as any);
      expect(result.add).to.not.be.undefined;
      expect(result.add!.component_groups).to.deep.equal([]);
    });

    it("should produce trigger empty string when args has no event or value", () => {
      const result = ActionSetUtilities.createEventActionFromLeaf({ type: "trigger", args: {} } as any);
      expect(result.trigger).to.equal("");
    });

    it("should produce queue_command with empty command when args is undefined", () => {
      const result = ActionSetUtilities.createEventActionFromLeaf({ type: "queue_command" } as any);
      expect(result.queue_command).to.not.be.undefined;
      expect(result.queue_command!.command).to.equal("");
    });

    it("should handle unknown action type gracefully", () => {
      const result = ActionSetUtilities.createEventActionFromLeaf({
        type: "custom_modded_action",
        args: { data: 42 },
      } as any);
      expect((result as any).custom_modded_action).to.deep.equal({ data: 42 });
    });

    it("should produce play_sound with empty sound when args is undefined", () => {
      const result = ActionSetUtilities.createEventActionFromLeaf({ type: "play_sound" } as any);
      expect(result.play_sound).to.not.be.undefined;
      expect(result.play_sound!.sound).to.equal("");
    });

    it("should produce emit_vibration with empty vibration when args is undefined", () => {
      const result = ActionSetUtilities.createEventActionFromLeaf({ type: "emit_vibration" } as any);
      expect(result.emit_vibration).to.not.be.undefined;
      expect(result.emit_vibration!.vibration).to.equal("");
    });

    it("should produce emit_particle with empty particle when args is undefined", () => {
      const result = ActionSetUtilities.createEventActionFromLeaf({ type: "emit_particle" } as any);
      expect(result.emit_particle).to.not.be.undefined;
      expect(result.emit_particle!.particle).to.equal("");
    });

    it("should produce reset_target with empty object when args is undefined", () => {
      const result = ActionSetUtilities.createEventActionFromLeaf({ type: "reset_target" } as any);
      expect(result.reset_target).to.deep.equal({});
    });
  });

  // ---------------------------------------------------------------------------
  // Stage 4: isActionGroup additional edge cases
  // ---------------------------------------------------------------------------
  describe("isActionGroup — additional edge cases", () => {
    it("should return true for group with empty actions array", () => {
      expect(ActionSetUtilities.isActionGroup({ actions: [] })).to.be.true;
    });

    it("should return false for action with args but no actions array", () => {
      expect(ActionSetUtilities.isActionGroup({ type: "add", args: { component_groups: [] } })).to.be.false;
    });

    it("should return true for group with groupActionType and actions", () => {
      expect(
        ActionSetUtilities.isActionGroup({
          actions: [{ type: "trigger" }],
          groupActionType: "randomize",
        })
      ).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // Stage 4: createEventFromGroup — structural edge cases
  // ---------------------------------------------------------------------------
  describe("createEventFromGroup — structural edge cases", () => {
    it("should wrap multiple children without groupType in sequence", () => {
      const group = {
        actions: [
          { type: "add_component_group", args: { component_groups: ["a"] } },
          { type: "remove_component_group", args: { component_groups: ["b"] } },
        ],
      };

      const result = ActionSetUtilities.createEventFromGroup(group as any);
      expect((result as IEventActionSet).sequence).to.not.be.undefined;
      expect((result as IEventActionSet).sequence!).to.have.length(2);
    });

    it("should unwrap single child without groupType directly", () => {
      const group = {
        actions: [{ type: "trigger", args: { value: "test_event" } }],
      };

      const result = ActionSetUtilities.createEventFromGroup(group as any);
      // Single child without group type is returned directly
      expect((result as IEventAction).trigger).to.not.be.undefined;
    });

    it("should return empty object for group with empty actions array", () => {
      const group = { actions: [] };
      const result = ActionSetUtilities.createEventFromGroup(group as any);
      expect(result).to.deep.equal({});
    });

    it("should return empty object for group with undefined actions", () => {
      const group = {} as any;
      const result = ActionSetUtilities.createEventFromGroup(group);
      expect(result).to.deep.equal({});
    });
  });

  describe("hydration — actionSet.actions matches actionSetData.actions", () => {
    // These tests verify the *hydrated* actions array (Action/ActionGroup class instances)
    // that getBlocklyStateFromActionSet() iterates. Previously a bug caused the hydrated
    // array to stay empty even though raw data was correctly populated.

    it("should have hydrated Action instances for a flat leaf event", () => {
      const event: IEventAction = { trigger: "test_event" } as IEventAction;
      const actionSet = ActionSetUtilities.createActionSetFromEvent(event, "flat_leaf");

      // Raw data should have 1 action
      expect(actionSet.actionSetData.actions).to.have.length(1);

      // Hydrated array must also have 1 entry, as an Action instance
      expect(actionSet.actions).to.have.length(1);
      expect(actionSet.actions[0]).to.be.instanceOf(Action);
    });

    it("should have hydrated ActionGroup instances for a sequence event", () => {
      const event: IEventActionSet = {
        sequence: [
          { add: { component_groups: ["adult"] } } as IEventAction,
          { remove: { component_groups: ["baby"] } } as IEventAction,
        ],
      };
      const actionSet = ActionSetUtilities.createActionSetFromEvent(event, "seq");

      // Raw data: 2 sub-groups (each wrapping a leaf action)
      expect(actionSet.actionSetData.actions).to.have.length(2);

      // Hydrated: 2 ActionGroup instances, each containing an Action
      expect(actionSet.actions).to.have.length(2);
      for (const a of actionSet.actions) {
        expect(a).to.be.instanceOf(ActionGroup);
        expect((a as ActionGroup).actions[0]).to.be.instanceOf(Action);
      }
    });

    it("should have hydrated ActionGroup instances for nested groups", () => {
      const event: IEventActionSet = {
        sequence: [
          {
            randomize: [
              { add: { component_groups: ["variant_a"] }, weight: 3 } as IEventAction,
              { add: { component_groups: ["variant_b"] }, weight: 1 } as IEventAction,
            ],
          } as any,
          { trigger: "after_variant" } as IEventAction,
        ],
      };
      const actionSet = ActionSetUtilities.createActionSetFromEvent(event, "nested");

      // Top level: 2 items (a nested group + a sub-group wrapping a leaf)
      expect(actionSet.actions).to.have.length(2);
      expect(actionSet.actions[0]).to.be.instanceOf(ActionGroup);
      expect(actionSet.actions[1]).to.be.instanceOf(ActionGroup);

      // Second item is a sub-group wrapping the trigger leaf
      const triggerGroup = actionSet.actions[1] as ActionGroup;
      expect(triggerGroup.actions[0]).to.be.instanceOf(Action);

      // Nested randomize group should be hydrated with sub-group children
      const nestedGroup = actionSet.actions[0] as ActionGroup;
      expect(nestedGroup.actions).to.have.length(2);
      for (const a of nestedGroup.actions) {
        expect(a).to.be.instanceOf(ActionGroup);
        expect((a as ActionGroup).actions[0]).to.be.instanceOf(Action);
      }
    });

    it("should produce empty hydrated array for an empty event", () => {
      const event = {} as IEventAction;
      const actionSet = ActionSetUtilities.createActionSetFromEvent(event, "empty");

      expect(actionSet.actionSetData.actions).to.have.length(0);
      expect(actionSet.actions).to.have.length(0);
    });

    it("hydrated actions should have correct typeId matching raw data type", () => {
      const event: IEventActionSet = {
        sequence: [
          { add: { component_groups: ["g1"] } } as IEventAction,
          { trigger: "ev1" } as IEventAction,
          { queue_command: { command: "/say hi" } } as IEventAction,
        ],
      };
      const actionSet = ActionSetUtilities.createActionSetFromEvent(event, "types");

      expect(actionSet.actions).to.have.length(3);

      const expectedTypes = ["add_component_group", "trigger", "queue_command"];
      for (let i = 0; i < expectedTypes.length; i++) {
        // Each entry is now a sub-group wrapping the leaf action
        const group = actionSet.actions[i] as ActionGroup;
        expect(group).to.be.instanceOf(ActionGroup);
        const leafAction = group.actions[0] as Action;
        expect(leafAction).to.be.instanceOf(Action);
        expect(leafAction.typeId).to.equal(expectedTypes[i]);
      }
    });

    it("hydrated actions length should always equal actionSetData.actions length", () => {
      // Test with multiple different structures to ensure consistency
      const cases: { event: IEventActionSet | IEventAction; name: string }[] = [
        { event: { trigger: "e1" } as IEventAction, name: "flat" },
        { event: { sequence: [{ add: { component_groups: ["a"] } } as IEventAction] }, name: "seq1" },
        { event: { randomize: [{ trigger: "e2", weight: 1 } as IEventAction] }, name: "rand1" },
        {
          event: {
            sequence: [
              { add: { component_groups: ["a"] } } as IEventAction,
              { remove: { component_groups: ["b"] } } as IEventAction,
              { trigger: "c" } as IEventAction,
              { play_sound: { sound: "s" } } as IEventAction,
              { queue_command: { command: "/cmd" } } as IEventAction,
            ],
          },
          name: "seq5",
        },
      ];

      for (const tc of cases) {
        const actionSet = ActionSetUtilities.createActionSetFromEvent(tc.event, tc.name);
        expect(actionSet.actions.length, `hydrated length should match raw length for "${tc.name}"`).to.equal(
          actionSet.actionSetData.actions.length
        );
      }
    });
  });
});

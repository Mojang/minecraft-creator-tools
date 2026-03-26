// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ActionSetGeneratorTest.ts
 *
 * Tests for ActionSetScriptGenerator and ActionSetCommandGenerator, covering:
 * - Null-safe name handling when actionSet.name is undefined
 * - Child action name generation with fallbacks
 * - Script generation basics
 *
 * These tests validate the fixes for null/undefined name references
 * that could produce "undefinedGameTest" or "undefined_1" in generated scripts.
 */

import { expect } from "chai";
import ActionSet from "../actions/ActionSet";
import ActionGroup from "../actions/ActionGroup";
import ActionSetScriptGenerator from "../script/ActionSetScriptGenerator";
import { ActionSetTarget } from "../actions/IActionSetData";

/**
 * Creates a minimal ActionSet with optional name for testing.
 */
function createTestActionSet(name?: string): ActionSet {
  const data = {
    name: name ?? "",
    targetType: ActionSetTarget.general,
    actions: [],
  };
  const actionSet = new ActionSet(data);
  if (name === undefined) {
    // Clear the name to simulate undefined name scenario
    (actionSet as any).name = undefined;
  }
  return actionSet;
}

describe("ActionSetScriptGenerator", function () {
  describe("Null-safe Name Handling", () => {
    it("should use fallback name when actionSet.name is undefined", () => {
      const actionSet = createTestActionSet(undefined);
      // name should be undefined/falsy, so the ?? "action_set" fallback should be used
      const script = ActionSetScriptGenerator.generateScript(actionSet, {
        typeScript: false,
      });
      // The generated script should contain a valid function name, not "undefined"
      expect(script).to.not.include("gt_undefined");
      // The fallback should produce something like "gt_action_set"
      expect(script.length).to.be.greaterThan(0);
    });

    it("should use actual name when actionSet.name is provided", () => {
      const actionSet = createTestActionSet("my_test");
      const script = ActionSetScriptGenerator.generateScript(actionSet, {
        typeScript: false,
      });
      expect(script).to.include("my_test");
    });
  });

  describe("Child Action Name Generation", () => {
    it("should generate child action names with fallback when parent name is undefined", () => {
      const actionSet = createTestActionSet(undefined);

      // Add a child ActionGroup without a name
      const childGroup = new ActionGroup({
        actions: [],
      });
      actionSet.actions.push(childGroup);

      // When generating script with sub-groups, child names should use fallback
      const script = ActionSetScriptGenerator.generateScript(actionSet, {
        typeScript: false,
      });
      // Should not contain "undefined_1" as the child name
      expect(script).to.not.include("undefined_1");
    });
  });
});

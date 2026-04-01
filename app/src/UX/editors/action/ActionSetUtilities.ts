/**
 * ActionSetUtilities.ts
 *
 * ARCHITECTURE:
 * Converts between Minecraft entity event JSON (IEventAction / IEventActionSet)
 * and the internal ActionSet / ActionGroup / IAction data model used by the
 * Blockly Action Designer.
 *
 * Entity event JSON structure:
 *   - Top level can be a flat IEventAction (single action) or an IEventActionSet
 *     containing a `sequence` or `randomize` array of nested actions/groups.
 *   - Leaf actions have properties like: add, remove, trigger, queue_command,
 *     set_property, play_sound, emit_vibration, emit_particle, reset_target.
 *   - Each leaf or group can also carry `filters` and `weight`.
 *
 * Internal ActionSet model:
 *   - ActionSet extends ActionGroup, contains (Action | ActionGroup)[] children.
 *   - ActionGroup has groupActionType ("sequence" | "randomize") and nested actions.
 *   - Action (IAction) has type (string) and arbitrary args bag.
 *   - Each entry in a randomize/sequence array is wrapped in its own sub-group
 *     (IActionGroup) so that its weight appears on a separate Blockly block.
 *     The weight is stored on groupActionData.weight.
 *
 * Conversion:
 *   createActionSetFromEvent()  — entity event JSON → ActionSet (for Blockly display)
 *   createEventFromActionSet()  — ActionSet → entity event JSON (for save-back)
 *
 * Type ID mapping:
 *   The Blockly block types are derived from form filenames (e.g. "add_component_group"),
 *   while the entity event JSON keys are short ("add", "remove"). The EVENT_KEY_TO_FORM_ID
 *   and FORM_ID_TO_EVENT_KEY maps bridge this gap so that:
 *     - createLeafAction() stores form-compatible IDs (Blockly can render them)
 *     - createEventActionFromLeaf() maps back to JSON keys (save produces valid JSON)
 *
 * Key pitfalls (fixed):
 *   - Leaf actions inside sequence/randomize were previously silently dropped.
 *   - Flat events (no sequence/randomize wrapper) were previously ignored.
 *   - The reverse path (ActionSet → event JSON) was previously missing entirely.
 *   - Action type "add"/"remove" mismatched Blockly block IDs "add_component_group"/
 *     "remove_component_group", causing blocks to silently not render in the workspace.
 */

import IEventActionSet from "../../../minecraft/IEventActionSet";
import IEventAction from "../../../minecraft/IEventAction";
import ActionSet from "../../../actions/ActionSet";
import { ActionSetTarget } from "../../../actions/IActionSetData";
import IAction from "../../../actions/IAction";
import IActionGroup from "../../../actions/IActionGroup";

/** Property keys on IEventAction that represent leaf action verbs. */
const LEAF_ACTION_KEYS = [
  "add",
  "remove",
  "trigger",
  "queue_command",
  "set_property",
  "play_sound",
  "emit_vibration",
  "emit_particle",
  "reset_target",
] as const;

/**
 * Maps entity event JSON property keys to form-compatible IDs used by Blockly.
 * The Blockly block types are derived from form filenames (e.g. "add_component_group.form.json"
 * → block type "add_component_group"), while the JSON keys are short ("add", "remove").
 * Types that already match their form ID (trigger, queue_command, etc.) are not listed.
 */
const EVENT_KEY_TO_FORM_ID: Record<string, string> = {
  add: "add_component_group",
  remove: "remove_component_group",
};

/** Reverse mapping: form ID → event JSON key. */
const FORM_ID_TO_EVENT_KEY: Record<string, string> = {
  add_component_group: "add",
  remove_component_group: "remove",
};

export default class ActionSetUtilities {
  /**
   * Convert a Minecraft entity event JSON object into an ActionSet.
   * Handles three shapes:
   *   1. { randomize: [...] }  → ActionSet with groupActionType "randomize"
   *   2. { sequence: [...] }   → ActionSet with groupActionType "sequence"
   *   3. Flat event (leaf)     → ActionSet wrapping a single leaf action
   */
  static createActionSetFromEvent(event: IEventAction | IEventActionSet, name: string): ActionSet {
    const acts = new ActionSet({ name: name, targetType: ActionSetTarget.entityEvent, actions: [] });

    const randomize = (event as IEventActionSet).randomize;
    const sequence = (event as IEventActionSet).sequence;

    if (randomize) {
      this.addGroup(acts.actionSetData, randomize, true);
    } else if (sequence) {
      this.addGroup(acts.actionSetData, sequence, false);
    } else {
      // Flat event with no sequence/randomize wrapper — treat as a single leaf action.
      const leafAction = this.createLeafAction(event as IEventAction);
      if (leafAction) {
        acts.actionSetData.actions.push(leafAction);
      }
    }

    // Re-hydrate so the raw IAction/IActionGroup data objects pushed above are
    // converted into proper Action/ActionGroup class instances.  Without this,
    // acts.actions (the hydrated array) stays empty because the constructor's
    // initial _hydrate() ran before we populated actionSetData.actions.
    acts._hydrate();

    return acts;
  }

  /**
   * Recursively convert a sequence/randomize list of events into IActionGroup children.
   * Each child is either a nested group (if it has randomize/sequence) or a leaf IAction.
   */
  static addGroup(acts: IActionGroup, list: (IEventAction | IEventActionSet)[], isRandomize: boolean) {
    if (isRandomize) {
      acts.groupActionType = "randomize";
    } else {
      acts.groupActionType = "sequence";
    }

    for (const eventOrActionSet of list) {
      const randomize = (eventOrActionSet as IEventActionSet).randomize;
      const sequence = (eventOrActionSet as IEventActionSet).sequence;

      if (randomize) {
        const newGroup: IActionGroup = { actions: [] };
        ActionSetUtilities.addGroup(newGroup, randomize, true);
        // Carry weight from the containing node
        if ((eventOrActionSet as IEventAction).weight !== undefined) {
          // Store weight on the group's groupActionData
          newGroup.groupActionData = newGroup.groupActionData || { type: "randomize" };
          (newGroup.groupActionData as any).weight = (eventOrActionSet as IEventAction).weight;
        }
        acts.actions.push(newGroup);
      } else if (sequence) {
        const newGroup: IActionGroup = { actions: [] };
        ActionSetUtilities.addGroup(newGroup, sequence, false);
        if ((eventOrActionSet as IEventAction).weight !== undefined) {
          newGroup.groupActionData = newGroup.groupActionData || { type: "sequence" };
          (newGroup.groupActionData as any).weight = (eventOrActionSet as IEventAction).weight;
        }
        acts.actions.push(newGroup);
      } else {
        // Leaf action (add, remove, trigger, queue_command, etc.)
        const leafActions = this.createLeafActions(eventOrActionSet as IEventAction);
        if (leafActions.length > 0) {
          const weight = (eventOrActionSet as IEventAction).weight;

          // Wrap leaf action(s) in a sub-group so the weight is displayed on
          // its own Randomize/Sequence block in Blockly.  Each entry in a
          // randomize/sequence array is a distinct weighted alternative.
          const groupType = isRandomize ? "randomize" : "sequence";
          const groupActionData: IAction = { type: groupType };
          (groupActionData as any).weight = weight !== undefined ? weight : 1;
          const subGroup: IActionGroup = {
            actions: leafActions,
            groupActionType: groupType,
            groupActionData: groupActionData,
          };
          acts.actions.push(subGroup);
        }
      }
    }
  }

  /**
   * Convert a flat IEventAction into one or more IAction objects.
   * Inspects known leaf properties and creates an IAction for each one found.
   * Returns the first action found, or undefined if none match.
   */
  static createLeafAction(event: IEventAction): IAction | undefined {
    const results = this.createLeafActions(event);
    return results.length > 0 ? results[0] : undefined;
  }

  /**
   * Convert a flat IEventAction into ALL matching IAction objects.
   * An event entry can contain multiple leaf verbs (e.g. "add" and "remove").
   */
  static createLeafActions(event: IEventAction): IAction[] {
    const results: IAction[] = [];
    // Inspect each known leaf action key
    for (const key of LEAF_ACTION_KEYS) {
      const value = (event as any)[key];
      if (value !== undefined) {
        // Use the form-compatible ID so the action type matches the registered Blockly block.
        const formId = EVENT_KEY_TO_FORM_ID[key] || key;
        const action: IAction = {
          type: formId,
          args: typeof value === "object" ? { ...value } : { value: value },
        };
        results.push(action);
      }
    }
    return results;
  }

  /**
   * Convert an ActionSet back into Minecraft entity event JSON.
   * This is the reverse of createActionSetFromEvent().
   */
  static createEventFromActionSet(actionSet: ActionSet): IEventActionSet | IEventAction {
    const data = actionSet.actionSetData;
    return this.createEventFromGroup(data);
  }

  /**
   * Convert an IActionGroup into the corresponding event JSON structure.
   */
  static createEventFromGroup(group: IActionGroup): IEventActionSet | IEventAction {
    const groupType = group.groupActionType;

    // If this group has no children, return an empty action
    if (!group.actions || group.actions.length === 0) {
      return {};
    }

    // Check if all children are leaf actions (not groups).
    // A randomize/sequence group whose children are ALL leaf actions is a
    // "weighted entry" — it should be flattened into a single event object
    // with the leaf verbs directly (e.g. { add: {...}, remove: {...} }),
    // not emitted as a nested randomize/sequence array.
    const allLeaves = group.actions.every((child) => !this.isActionGroup(child));

    if ((groupType === "randomize" || groupType === "sequence") && allLeaves) {
      // Weighted entry: merge all leaf actions into a single flat event object
      const result: IEventAction = {};
      for (const child of group.actions) {
        const leafEvent = this.createEventActionFromLeaf(child as IAction);
        Object.assign(result, leafEvent);
      }
      return result;
    }

    // If the group is a sequence/randomize with sub-groups, build the array
    if (groupType === "randomize" || groupType === "sequence") {
      const children: (IEventAction | IEventActionSet)[] = [];

      for (const child of group.actions) {
        if (this.isActionGroup(child)) {
          const childEvent = this.createEventFromGroup(child as IActionGroup);
          // Recover weight from groupActionData if present
          const weight = (child as IActionGroup).groupActionData
            ? ((child as IActionGroup).groupActionData as any).weight
            : undefined;
          if (weight !== undefined) {
            (childEvent as IEventAction).weight = weight;
          }
          children.push(childEvent);
        } else {
          // Leaf IAction → IEventAction
          const leafEvent = this.createEventActionFromLeaf(child as IAction);
          if ((child as any).weight !== undefined) {
            leafEvent.weight = (child as any).weight;
          }
          children.push(leafEvent);
        }
      }

      const result: IEventActionSet = {};
      if (groupType === "randomize") {
        result.randomize = children;
      } else {
        result.sequence = children;
      }
      return result;
    }

    // No group type — single leaf or flat group
    if (group.actions.length === 1) {
      const child = group.actions[0];
      if (this.isActionGroup(child)) {
        return this.createEventFromGroup(child as IActionGroup);
      } else {
        return this.createEventActionFromLeaf(child as IAction);
      }
    }

    // Multiple children without a group type — wrap in sequence
    const children: (IEventAction | IEventActionSet)[] = [];
    for (const child of group.actions) {
      if (this.isActionGroup(child)) {
        children.push(this.createEventFromGroup(child as IActionGroup));
      } else {
        children.push(this.createEventActionFromLeaf(child as IAction));
      }
    }
    return { sequence: children };
  }

  /**
   * Convert a leaf IAction back to an IEventAction.
   * Reverses createLeafAction().
   */
  static createEventActionFromLeaf(action: IAction): IEventAction {
    const result: IEventAction = {};
    // Resolve the event JSON key from the action type (which may be a form ID).
    const eventKey = FORM_ID_TO_EVENT_KEY[action.type] || action.type;
    const args = action.args as any;

    switch (eventKey) {
      case "add":
        result.add = args ? { component_groups: args.component_groups || [] } : { component_groups: [] };
        break;
      case "remove":
        result.remove = args ? { component_groups: args.component_groups || [] } : { component_groups: [] };
        break;
      case "trigger":
        if (args && args.value !== undefined) {
          result.trigger = args.value;
        } else if (args && args.event !== undefined) {
          result.trigger = args.target ? { event: args.event, target: args.target } : args.event;
        } else {
          result.trigger = "";
        }
        break;
      case "queue_command":
        result.queue_command = args ? { command: args.command || "" } : { command: "" };
        break;
      case "set_property":
        result.set_property = args ? { ...args } : {};
        break;
      case "play_sound":
        result.play_sound = args ? { sound: args.sound || "" } : { sound: "" };
        break;
      case "emit_vibration":
        result.emit_vibration = args ? { vibration: args.vibration || "" } : { vibration: "" };
        break;
      case "emit_particle":
        result.emit_particle = args ? { particle: args.particle || "" } : { particle: "" };
        break;
      case "reset_target":
        result.reset_target = args ? { ...args } : {};
        break;
      default:
        // Unknown action type — store as-is in args
        if (args) {
          (result as any)[eventKey] = args;
        }
        break;
    }

    return result;
  }

  /**
   * Type guard: checks if an action-or-group is an IActionGroup (has `actions` array).
   */
  static isActionGroup(item: IAction | IActionGroup): item is IActionGroup {
    return Array.isArray((item as IActionGroup).actions);
  }
}

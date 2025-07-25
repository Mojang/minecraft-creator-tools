import Utilities from "../core/Utilities";
import DataFormFile from "../dataform/DataFormFile";
import IFormDefinition from "../dataform/IFormDefinition";
import Database from "../minecraft/Database";
import StorageUtilities from "../storage/StorageUtilities";
import Action from "./Action";
import ActionGroup from "./ActionGroup";
import BlockBreakAction from "./BlockBreakAction";
import BlockExplodeAction from "./BlockExplodeAction";
import BlockSetAction from "./BlockSetAction";
import EntityDieAction from "./EntityDieAction";
import EntitySpawnAction from "./EntitySpawnAction";
import GeneralAction from "./GeneralAction";
import IAction, { ActionContextType } from "./IAction";
import IActionGroup from "./IActionGroup";
import { ActionSetTarget } from "./IActionSetData";
import ItemSpawnAction from "./ItemSpawnAction";
import ParticleSpawnAction from "./ParticleSpawnAction";
import PlayerJoinAction from "./PlayerJoinAction";
import RandomizeGroupAction from "./RandomizeGroupAction";
import SequenceGroupAction from "./SequenceGroupAction";
import SoundPlayAction from "./SoundPlayAction";
import TestIdleAction from "./TestIdleAction";
import TestSimulatedPlayerMoveAction from "./TestSimulatedPlayerMoveAction";
import TestSimulatedPlayerSpawnAction from "./TestSimulatedPlayerSpawnAction";
import TickGroupAction from "./TickGroupAction";
import WorldSendMessageAction from "./WorldSendMessageAction";

export interface IActionSetActionType {
  id: string;
  title: string;
  requiredContextType: ActionContextType;
}

export interface IActionType {
  id: string;
  title: string;
  form: IFormDefinition;
}

const EntitySpawnActionType: IActionSetActionType = {
  id: "entity_spawn",
  title: "Entity Spawn",
  requiredContextType: ActionContextType.dimensionLocation,
};

const BlockBreakActionType: IActionSetActionType = {
  id: "block_break",
  title: "Block Break",
  requiredContextType: ActionContextType.dimensionLocation,
};

export const GroupActions = ["tick", "entity_die", "block_explode", "player_join", "randomize", "sequence"];

export class ActionSetCatalog {
  static async getEntityLegacyFiltersSet() {
    const legacyFilterTypes: IActionType[] = [];

    await ActionSetCatalog.addTypesFromFormFolder(legacyFilterTypes, "entityfilters", ActionSetTarget.entityEvent);

    return legacyFilterTypes;
  }

  static async getScriptSet() {
    const scriptFilterTypes: IActionType[] = [];

    await ActionSetCatalog.addTypesFromFormFolder(scriptFilterTypes, "scriptfilters", ActionSetTarget.script);

    return scriptFilterTypes;
  }

  static async addTypesFromFormFolder(actionList: IActionType[], folderName: string, actionSetTarget: ActionSetTarget) {
    const formsFolder = await Database.getFormsFolder(folderName);

    if (!formsFolder) {
      return;
    }

    await formsFolder.load();

    for (const fileName in formsFolder.files) {
      const file = formsFolder.files[fileName];

      if (file) {
        await file.loadContent();

        const form = await DataFormFile.ensureOnFile(file);

        if (form && form.formDefinition) {
          let shouldAddItem = true;

          if (form.formDefinition.tags) {
            if (actionSetTarget === ActionSetTarget.entityEvent && !form.formDefinition.tags.includes("entityevent")) {
              shouldAddItem = false;
            }
            if (actionSetTarget === ActionSetTarget.script && !form.formDefinition.tags.includes("script")) {
              shouldAddItem = false;
            }
            if (actionSetTarget === ActionSetTarget.mcfunction && !form.formDefinition.tags.includes("commands")) {
              shouldAddItem = false;
            }
            if (actionSetTarget === ActionSetTarget.gameTest && !form.formDefinition.tags.includes("test")) {
              shouldAddItem = false;
            }
          } else {
            shouldAddItem = false;
          }

          if (shouldAddItem) {
            actionList.push({
              id: StorageUtilities.getCoreBaseFromName(fileName),
              title: form.title
                ? form.title
                : Utilities.humanify(form.id ? form.id : StorageUtilities.getCoreBaseFromName(fileName)),
              form: form.formDefinition,
            });
          }
        }
      }
    }
  }

  getDefaultContextForTarget(actionSetTarget: ActionSetTarget) {
    if (actionSetTarget === ActionSetTarget.entityEvent) {
      return ActionContextType.entity;
    }

    return ActionContextType.general;
  }

  static async getActionCatalog(actionSetTarget: ActionSetTarget): Promise<IActionType[]> {
    const actionTypes: IActionType[] = [];

    if (actionSetTarget === ActionSetTarget.entityEvent) {
      await ActionSetCatalog.addTypesFromFormFolder(actionTypes, "entityevents", actionSetTarget);
    } else {
      await ActionSetCatalog.addTypesFromFormFolder(actionTypes, "action", actionSetTarget);
    }

    return actionTypes;
  }

  static createActionGroup(parent: ActionGroup, data: IActionGroup, id?: string): ActionGroup {
    const ag = new ActionGroup(
      data
        ? data
        : {
            id: id ? id : Utilities.createRandomId(10),
            actions: [],
          },
      parent.actionSet
    );

    return ag;
  }

  static createActionOrGroup(
    parent: ActionGroup,
    type: string,
    data?: IAction | ActionGroup,
    id?: string
  ): Action | ActionGroup {
    if (GroupActions.includes(type)) {
      const ag = this.createActionGroup(parent, data as IActionGroup, id);

      ag.groupActionType = type;

      return ag;
    }

    return this.createAction(parent, type, data as IAction, id);
  }

  static createAction(parent: ActionGroup, type: string, data?: IAction, id?: string): Action {
    let action = undefined;

    if (!data) {
      data = {
        type: type,
      };
    }

    switch (type) {
      case EntitySpawnActionType.id:
        action = new EntitySpawnAction(parent, data as IAction);
        break;
      case BlockBreakActionType.id:
        action = new BlockBreakAction(parent, data as IAction);
        break;
      case "test_simulated_player_spawn":
        action = new TestSimulatedPlayerSpawnAction(parent, data as IAction);
        break;
      case "test_simulated_player_move":
        action = new TestSimulatedPlayerMoveAction(parent, data as IAction);
        break;
      case "test_idle":
        action = new TestIdleAction(parent, data as IAction);
        break;
      case "tick":
        action = new TickGroupAction(parent, data);
        break;
      case "randomize":
        action = new RandomizeGroupAction(parent, data);
        break;
      case "sequence":
        action = new SequenceGroupAction(parent, data);
        break;
      case "world_send_message":
        action = new WorldSendMessageAction(parent, data);
        break;
      case "entity_die":
        action = new EntityDieAction(parent, data);
        break;
      case "player_join":
        action = new PlayerJoinAction(parent, data);
        break;
      case "block_set":
        action = new BlockSetAction(parent, data);
        break;
      case "particle_spawn":
        action = new ParticleSpawnAction(parent, data);
        break;
      case "item_spawn":
        action = new ItemSpawnAction(parent, data);
        break;
      case "block_explode":
        action = new BlockExplodeAction(parent, data);
        break;
      case "sound_play":
        action = new SoundPlayAction(parent, data);
        break;
      default:
        action = new GeneralAction(parent, data);
        action.typeId = type;
        break;
    }

    if (id) {
      action.id = id;
    }

    return action;
  }
}

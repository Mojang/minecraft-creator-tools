import { Component } from "react";
import IFile from "../../../storage/IFile";
import "./ActionSetEditor.css";
import IPersistable from "../../types/IPersistable";
import ActionSetManager from "../../../script/ActionSetManager";
import ActionSet from "../../../actions/ActionSet";
import CreatorTools from "../../../app/CreatorTools";
import { Stack, Button, FormControl, Select, MenuItem, SelectChangeEvent } from "@mui/material";
import Project from "../../../app/Project";
import { BlocklyWorkspace } from "react-blockly";
import * as Blockly from "blockly";
import { WorkspaceSvg } from "blockly";
import { ActionSetCatalog } from "../../../actions/ActionSetCatalog";
import { ToolboxDefinition, ToolboxInfo, ToolboxItemInfo } from "blockly/core/utils/toolbox";
import { BlockDefinition } from "blockly/core/blocks";
import IBlocklyDefinition, {
  IActionGroupBlock,
  IBlocklyBlockBase,
  IBlocklyBlockDefinition,
  IBlocklyBlockDefinitionArgument,
  IBlocklyBlockLocatableBase,
} from "../../blockly/IBlocklyDefinitions";
import ActionGroup from "../../../actions/ActionGroup";
import Utilities from "../../../core/Utilities";
import Action from "../../../actions/Action";
import { CustomLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faExpand, faCompress } from "@fortawesome/free-solid-svg-icons";
import { ActionSetTarget } from "../../../actions/IActionSetData";
import axios from "axios";
import IBlocklyCatalog, { BlocklyCategory, IBlocklyCatalogItem } from "../../../actions/IBlocklyCatalogItem";
import Log from "../../../core/Log";
import IFormDefinition from "../../../dataform/IFormDefinition";
import { FieldDataType } from "../../../dataform/IField";
import DataFormUtilities from "../../../dataform/DataFormUtilities";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import { getMinecraftBlocklyConfig } from "../../blockly/blocklyMinecraftTheme";
import IProjectTheme from "../../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";

interface IActionSetEditorProps extends WithLocalizationProps {
  heightOffset: number;
  readOnly: boolean;
  displayTypeDropdown?: boolean;
  actionSet?: ActionSet;
  title?: string;
  file?: IFile;
  project: Project;
  theme: IProjectTheme;
  creatorTools: CreatorTools;
  ambientSelectedPoint?: number[] | undefined;
  setActivePersistable?: (persistObject: IPersistable) => void;
  onActionSetChanged?: (actionSet: ActionSet) => void;
}

interface IActionSetEditorState {
  fileToEdit: IFile | undefined;
  actionSet: ActionSet | undefined;
  targetType: ActionSetTarget | undefined;
  toolboxDefinition: ToolboxDefinition | undefined;
  isMaximized: boolean;
}

const DEFAULT_BLOCK_LEFT = 100;
const DEFAULT_BLOCK_Y_SPACING = 240;

export const ActionSetTargetTypeStrings = ["General", "Script"];

class ActionSetEditor extends Component<IActionSetEditorProps, IActionSetEditorState> {
  private _lastFileEdited?: IFile;
  private static blocklyCatalog: IBlocklyCatalog;
  private static catalogLoaded: boolean = false;
  private static catalogItemsById: { [id: string]: IBlocklyCatalogItem } = {};

  constructor(props: IActionSetEditorProps) {
    super(props);

    this._blocklyJsonChange = this._blocklyJsonChange.bind(this);
    this._handleActionSetTypeChange = this._handleActionSetTypeChange.bind(this);
    this._toggleMaximize = this._toggleMaximize.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleBlocklyInject = this._handleBlocklyInject.bind(this);

    this.state = {
      fileToEdit: undefined,
      actionSet: this.props.actionSet,
      targetType: this.props.actionSet?.targetType,
      toolboxDefinition: undefined,
      isMaximized: false,
    };
  }

  static async getBlocklyCatalog(creatorTools: CreatorTools) {
    let result = null;

    if (ActionSetEditor.catalogLoaded) {
      return ActionSetEditor.blocklyCatalog;
    }

    // @ts-ignore
    if (typeof window !== "undefined") {
      const url = creatorTools.contentRoot + "data/blocklydefs.json";

      try {
        result = await axios.get(url);

        if (result) {
          ActionSetEditor.blocklyCatalog = result.data;
        }
      } catch (e) {
        Log.fail("Could not load blockly catalog: " + e + " from '" + url + "'");
      }
    } else if (creatorTools.local) {
      try {
        result = await creatorTools.local.readJsonFile("data/blocklydefs.json");
      } catch (e) {
        Log.fail("Could not load local file: " + e + " from 'data/blocklydefs.json'");
      }

      if (result !== null) {
        ActionSetEditor.blocklyCatalog = result as IBlocklyCatalog;
      }
    }

    for (const blocklyItem of ActionSetEditor.blocklyCatalog.items) {
      if (blocklyItem.definition && blocklyItem.definition.type) {
        ActionSetEditor.catalogItemsById[blocklyItem.definition.type] = blocklyItem.definition;
      }
    }
    ActionSetEditor.catalogLoaded = true;

    return ActionSetEditor.blocklyCatalog;
  }

  static getDerivedStateFromProps(props: IActionSetEditorProps, inState: IActionSetEditorState) {
    if (props.file) {
      if (inState === undefined || inState === null) {
        const state = {
          fileToEdit: props.file,
          actionSet: props.actionSet,
          targetType: props.actionSet?.targetType,
        };

        return state;
      }

      if (props.file !== inState.fileToEdit) {
        inState.fileToEdit = props.file;

        return inState;
      }
    }

    return null; // No change to state
  }

  componentDidMount() {
    this._updateManager();
  }

  componentDidUpdate(prevProps: IActionSetEditorProps, prevState: IActionSetEditorState) {
    this._updateManager();
  }

  async _updateManager() {
    if (this.state && this.state.fileToEdit) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        const asm = await ActionSetManager.ensureOnFile(this.state.fileToEdit, this.props.project);

        if (asm && asm.actionSet) {
          this._doUpdate(asm.actionSet);
        }
      }
    } else if (this.props.actionSet && !this.state.toolboxDefinition) {
      this._doUpdate(this.props.actionSet);
    }
  }

  getMainActionGroupId(actionSet?: ActionSet) {
    let mainActionGroupId = "action_group";

    if (actionSet && actionSet.targetType === ActionSetTarget.entityEvent) {
      mainActionGroupId = "sequence";
    }

    return mainActionGroupId;
  }

  async getBlockFromForm(form: IFormDefinition, isChainable: boolean, isContainer?: boolean, blockTypeId?: string) {
    // blockTypeId (when provided) is the canonical action id derived from the
    // form's filename (e.g. "set_entity_property"). Some upstream form files
    // have a non-canonical `id` field (e.g. set_entity_property.form.json
    // currently ships with id "Set Entity Property"), so prefer blockTypeId
    // for both the Blockly block type and the event-verb style lookup.
    const effectiveId = blockTypeId || form.id;

    if (!effectiveId) {
      return;
    }

    if (form && form.tags && !isContainer) {
      isContainer = form.tags.includes("container");
    }

    // Determine block style based on form tags and semantics
    let blockStyle = "action_style";
    if (form.tags) {
      if (form.tags.includes("trigger")) {
        blockStyle = "trigger_style";
      } else if (form.tags.includes("logic")) {
        blockStyle = "logic_style";
      } else if (form.tags.includes("conditional")) {
        blockStyle = "condition_style";
      }
    }

    // Entity event verb-specific style overrides
    const eventVerbIds = ["add_component_group", "remove_component_group", "set_property", "set_entity_property"];
    if (eventVerbIds.includes(effectiveId)) {
      blockStyle = "event_style";
    }

    const blockCore: IBlocklyBlockDefinition = {
      type: effectiveId,
      tooltip: form.description ? form.description : form.title,
      style: blockStyle,
      message0: "",
    };

    let message = form.title ? form.title : "";
    let fieldsAdded = 0;
    let args0: IBlocklyBlockDefinitionArgument[] | undefined = undefined;

    const allFields = form.fields.slice();

    allFields.sort(DataFormUtilities.sortFieldsByPriority);

    for (const field of allFields) {
      let targetType = undefined;
      let options = undefined;
      let defaultText: string | undefined = undefined;
      let fieldBase = field.title ? field.title : field.id;

      if (
        field.dataType === FieldDataType.point3 ||
        field.dataType === FieldDataType.intPoint3 ||
        field.dataType === FieldDataType.location ||
        field.dataType === FieldDataType.locationOffset
      ) {
        if (args0 === undefined) {
          args0 = [];
        }

        const coordLabel = fieldBase;

        message += " " + coordLabel + " X %" + String(fieldsAdded + 1);
        args0.push({
          type: "field_number",
          name: field.id + "X",
          text: coordLabel + " X:",
        });
        message += " Y %" + String(fieldsAdded + 2);
        args0.push({
          type: "field_number",
          name: field.id + "Y",
          text: coordLabel + " Y:",
        });
        message += " Z %" + String(fieldsAdded + 3);
        args0.push({
          type: "field_number",
          name: field.id + "Z",
          text: coordLabel + " Z:",
        });
        fieldsAdded += 3;
      } else if (field.choices) {
        options = [];
        targetType = "field_dropdown";
        for (const choice of field.choices) {
          options.push([choice.title ? choice.title : choice.id, choice.id]);
        }
      } else if (field.lookupId) {
        options = [];

        const choices = await this.props.project.getLookupChoices(field.lookupId);

        if (choices) {
          targetType = "field_dropdown";
          for (const choice of choices) {
            options.push([choice.title ? choice.title : choice.id, choice.id]);
          }
        } else {
          targetType = "field_input";
        }
      } else if (field.dataType === FieldDataType.int || field.dataType === FieldDataType.number) {
        targetType = "field_number";
      } else if (field.dataType === FieldDataType.boolean) {
        targetType = "field_checkbox";
      } else if (field.dataType === FieldDataType.string) {
        targetType = "field_input";
        if (typeof field.defaultValue === "string") {
          defaultText = field.defaultValue;
        }
      }

      if (targetType) {
        if (args0 === undefined) {
          args0 = [];
        }

        args0.push({
          type: targetType,
          name: field.id,
          options: options,
          text: defaultText,
        });

        if (fieldBase.indexOf(" N ") >= 0) {
          message += " " + fieldBase.replace(" N ", " %" + String(fieldsAdded + 1));
        } else {
          message += " " + fieldBase + " %" + String(fieldsAdded + 1);
        }
        fieldsAdded++;
      }
    }

    // Also process scalarField if present (e.g., trigger.form.json uses this
    // for the simple string form of the value)
    if (form.scalarField && fieldsAdded === 0) {
      const scalarField = form.scalarField;
      let scalarType: string | undefined = undefined;
      let scalarDefault: string | undefined = undefined;

      if (scalarField.dataType === FieldDataType.string) {
        scalarType = "field_input";
        if (typeof scalarField.defaultValue === "string") {
          scalarDefault = scalarField.defaultValue;
        }
      } else if (scalarField.dataType === FieldDataType.int || scalarField.dataType === FieldDataType.number) {
        scalarType = "field_number";
      } else if (scalarField.dataType === FieldDataType.boolean) {
        scalarType = "field_checkbox";
      }

      if (scalarType) {
        if (args0 === undefined) {
          args0 = [];
        }

        const scalarLabel = scalarField.title ? scalarField.title : scalarField.id;
        message += " " + scalarLabel + " %" + String(fieldsAdded + 1);
        args0.push({
          type: scalarType,
          name: scalarField.id,
          text: scalarDefault,
        });
        fieldsAdded++;
      }
    }

    if (isChainable && !isContainer) {
      blockCore.previousStatement = null;
      blockCore.nextStatement = null;
    }

    if (isContainer) {
      blockCore.inputsInline = true;
      if (args0 === undefined) {
        args0 = [];
      }

      message += " %" + String(fieldsAdded + 1);
      args0.push({
        type: "input_statement",
        name: "actions",
      });
      fieldsAdded++;
    }

    if (args0) {
      blockCore.args0 = args0;
    }

    blockCore.message0 = message.trim();

    return blockCore;
  }

  async _doUpdate(actionSet: ActionSet) {
    let mainActionGroupId = this.getMainActionGroupId(actionSet);

    const blocklyCatalog = await ActionSetEditor.getBlocklyCatalog(this.props.creatorTools);
    const logicCategory: ToolboxItemInfo & ToolboxInfo = {
      kind: "category",
      name: "Logic",
      categorystyle: "logic",
      contents: [],
    };

    if (actionSet.targetType === ActionSetTarget.script || actionSet.targetType === ActionSetTarget.general) {
      this.ensureBlockType("action_group");

      logicCategory.contents.push({
        kind: "block",
        type: mainActionGroupId,
      });
    }

    if (actionSet.targetType === ActionSetTarget.entityEvent) {
      this.ensureBlockType("sequence");
      this.ensureBlockType("randomize");

      logicCategory.contents.push({
        kind: "block",
        type: "sequence",
      });

      logicCategory.contents.push({
        kind: "block",
        type: "randomize",
      });
    }

    let triggersCategory: ToolboxItemInfo = {
      kind: "category",
      name: "Triggers",
      categorystyle: "triggers",
      contents: [],
    };

    let actionsCategory: ToolboxItemInfo = {
      kind: "category",
      name: "Actions",
      categorystyle: "actions",
      contents: [],
    };

    let eventsCategory: ToolboxItemInfo = {
      kind: "category",
      name: "Events",
      categorystyle: "events",
      contents: [],
    };

    let conditionsCategory: ToolboxItemInfo = {
      kind: "category",
      name: "Conditions",
      categorystyle: "conditions",
      contents: [],
    };

    const availableActions = await ActionSetCatalog.getActionCatalog(actionSet.targetType);

    // Entity event verb IDs that should go in the "Events" category
    const eventVerbIds = ["add_component_group", "remove_component_group", "set_property", "set_entity_property"];

    for (const action of availableActions) {
      if (action.form) {
        const blockAction = await this.getBlockFromForm(action.form, true, undefined, action.id);
        this.ensureBlockType(action.id, blockAction);
      }

      if (action.form.tags && action.form.tags.includes("logic")) {
        (logicCategory as any).contents.push({
          kind: "block",
          type: action.id,
        });
      } else if (action.form.tags && action.form.tags.includes("trigger")) {
        (triggersCategory as any).contents.push({
          kind: "block",
          type: action.id,
        });
      } else if (action.form.tags && action.form.tags.includes("conditional")) {
        (conditionsCategory as any).contents.push({
          kind: "block",
          type: action.id,
        });
      } else if (eventVerbIds.includes(action.id)) {
        (eventsCategory as any).contents.push({
          kind: "block",
          type: action.id,
        });
      } else {
        (actionsCategory as any).contents.push({
          kind: "block",
          type: action.id,
        });
      }
    }

    for (const blocklyItem of blocklyCatalog.items) {
      if (blocklyItem.definition && blocklyItem.definition.type) {
        const typeId = blocklyItem.definition.type;

        if (
          blocklyItem.target === undefined ||
          (blocklyItem.target !== undefined && blocklyItem.target === actionSet.targetType)
        ) {
          this.ensureBlockType(typeId);

          if (blocklyItem.category === BlocklyCategory.actions) {
            (actionsCategory as any).contents.push({
              kind: "block",
              type: typeId,
            });
          } else if (blocklyItem.category === BlocklyCategory.logic) {
            (logicCategory as any).contents.push({
              kind: "block",
              type: typeId,
            });
          } else if (blocklyItem.category === BlocklyCategory.conditions) {
            (conditionsCategory as any).contents.push({
              kind: "block",
              type: typeId,
            });
          } else if (blocklyItem.category === BlocklyCategory.triggers) {
            (triggersCategory as any).contents.push({
              kind: "block",
              type: typeId,
            });
          }
        }
      }
    }

    let availableConditions = undefined;

    if (actionSet.targetType === ActionSetTarget.entityEvent) {
      availableConditions = await ActionSetCatalog.getEntityLegacyFiltersSet();
    } else if (actionSet.targetType === ActionSetTarget.script) {
      availableConditions = await ActionSetCatalog.getScriptSet();
    }

    if (availableConditions) {
      for (const condition of availableConditions) {
        this.ensureBlockType(condition.id, {
          type: condition.id,
          message0: condition.title + " %1",
          args0: [
            {
              type: "input_value",
              name: "NAME",
            },
          ],
          output: "Boolean",
          style: "condition_style",
          tooltip: condition.form?.description ? condition.form.description : "Filter: " + condition.title,
        });

        (conditionsCategory as any).contents.push({
          kind: "block",
          type: condition.id,
        });
      }
    }

    // Build the toolbox: only include categories that have blocks
    const allCategories = [actionsCategory, eventsCategory, logicCategory, triggersCategory, conditionsCategory];

    const categories = allCategories.filter((cat) => (cat as any).contents && (cat as any).contents.length > 0);

    const toolboxDef = {
      kind: "categoryToolbox",
      contents: categories,
    };

    this.setState({
      actionSet: actionSet,
      fileToEdit: this.state.fileToEdit,
      toolboxDefinition: toolboxDef,
    });
  }

  async persist(): Promise<boolean> {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const asm = file.manager as ActionSetManager;

        await asm.persist(this.props.project);
      }
    } else if (this.state.actionSet) {
      const asm = new ActionSetManager(this.props.project, this.state.actionSet);

      return await asm.persist(this.props.project);
    }

    return false;
  }

  _blocklyJsonChange(workspaceState: object) {
    this.updateActionSetFromBlockly(workspaceState as IBlocklyDefinition);

    if (this.props.onActionSetChanged && this.state.actionSet) {
      this.props.onActionSetChanged(this.state.actionSet);
    }
  }

  ensureBlockType(id: string, blockJson?: BlockDefinition) {
    if (!Blockly.Blocks[id]) {
      if (blockJson) {
        Blockly.common.defineBlocksWithJsonArray([blockJson]);
      } else if (ActionSetEditor.catalogItemsById[id]) {
        Blockly.common.defineBlocksWithJsonArray([ActionSetEditor.catalogItemsById[id]]);
      }
    }
  }

  updateActionSetFromBlockly(workspaceState: IBlocklyDefinition) {
    const rootActionState = this.state.actionSet;

    if (!rootActionState) {
      return;
    }

    if (workspaceState.blocks && workspaceState.blocks.blocks && workspaceState.blocks.blocks.length > 0) {
      if (workspaceState.blocks.blocks.length === 1) {
        this.applyBlocklyStateToActionGroup(rootActionState, workspaceState.blocks.blocks[0]);
      } else {
        this.setActionListFromBlockList(rootActionState, workspaceState.blocks.blocks);
      }
    }
  }

  applyBlocklyStateToActionGroup(actionGroup: ActionGroup, block: IBlocklyBlockBase) {
    const filtersBlock = (block as IActionGroupBlock).inputs?.filters?.block;
    if (filtersBlock) {
    }

    const actionsBlock = (block as IActionGroupBlock).inputs?.actions?.block;

    if (actionsBlock) {
      this.setActionListFromBlock(actionGroup, actionsBlock);
    }
  }

  sortBlocksByYandX(actionBlockA: IBlocklyBlockBase, actionBlockB: IBlocklyBlockBase) {
    const aY = (actionBlockA as IBlocklyBlockLocatableBase).y;
    const bY = (actionBlockB as IBlocklyBlockLocatableBase).y;

    if (aY !== undefined && bY !== undefined && aY !== bY) {
      return aY - bY;
    }

    const aX = (actionBlockA as IBlocklyBlockLocatableBase).x;
    const bX = (actionBlockB as IBlocklyBlockLocatableBase).x;

    if (aX !== undefined && bX !== undefined && aX !== bX) {
      return aX - bX;
    }

    return actionBlockA.id.localeCompare(actionBlockB.id);
  }

  setActionListFromBlockList(actionGroup: ActionGroup, actionsBlockList: IBlocklyBlockBase[]) {
    const newActionList: (Action | ActionSet)[] = [];

    const actionsBlockListSorted = actionsBlockList.slice();
    actionsBlockListSorted.sort(this.sortBlocksByYandX);

    for (const block of actionsBlockListSorted) {
      this.processActionBlocks(block, newActionList, actionGroup);
    }

    actionGroup.setActions(newActionList);
  }

  setActionListFromBlock(actionGroup: ActionGroup, actionsBlock: IBlocklyBlockBase) {
    if (actionsBlock) {
      const newActionList: (Action | ActionSet)[] = [];

      this.processActionBlocks(actionsBlock, newActionList, actionGroup);

      actionGroup.setActions(newActionList);
    }
  }

  processActionBlocks(block: IBlocklyBlockBase, actionList: (Action | ActionGroup)[], actionGroup: ActionGroup) {
    let targetActionOrGroup: Action | ActionGroup | undefined = undefined;

    for (const actionOrGroup of actionGroup.actions) {
      if (actionOrGroup && actionOrGroup.id === block.id) {
        targetActionOrGroup = actionOrGroup;
        break;
      }
    }

    if (!targetActionOrGroup) {
      if (block.type === this.getMainActionGroupId(actionGroup.actionSet)) {
        targetActionOrGroup = new ActionGroup(
          {
            id: block.id,
            actions: [],
            groupActionType: block.type,
          },
          actionGroup.actionSet
        );
      } else {
        targetActionOrGroup = ActionSetCatalog.createActionOrGroup(actionGroup, block.type, undefined, block.id);
      }
    }

    if (block.fields && targetActionOrGroup instanceof Action) {
      // Write field values back into the action's args object (where createLeafAction stores them).
      // Arrays that were serialized to comma-separated strings need to be split back.
      if (!targetActionOrGroup.data.args) {
        targetActionOrGroup.data.args = {};
      }

      const args = targetActionOrGroup.data.args as any;

      for (const fieldName in block.fields) {
        const val = block.fields[fieldName];

        if (fieldName && val !== undefined && val !== null) {
          // Check if the original value was an array (component_groups, etc.)
          const originalVal = args[fieldName];
          if (Array.isArray(originalVal) && typeof val === "string") {
            // Split comma-separated string back into an array, trimming whitespace
            args[fieldName] = val
              .split(",")
              .map((s: string) => s.trim())
              .filter((s: string) => s.length > 0);
          } else {
            args[fieldName] = val;
          }
        }
      }
    } else if (block.fields) {
      for (const fieldName in block.fields) {
        const val = block.fields[fieldName];

        if (fieldName && val !== undefined && val !== null) {
          targetActionOrGroup.setProperty(fieldName, val);
        }
      }
    }

    actionList.push(targetActionOrGroup);

    if (targetActionOrGroup instanceof ActionGroup) {
      if ((block as IBlocklyBlockLocatableBase).x !== undefined) {
        targetActionOrGroup.canvasX = (block as IBlocklyBlockLocatableBase).x;
      }

      if ((block as IBlocklyBlockLocatableBase).y !== undefined) {
        targetActionOrGroup.canvasY = (block as IBlocklyBlockLocatableBase).y;
      }

      const actionsBlock = (block as IActionGroupBlock).inputs?.actions?.block;

      if (actionsBlock) {
        const subActionList: (Action | ActionSet)[] = [];
        this.processActionBlocks(actionsBlock, subActionList, targetActionOrGroup);
        targetActionOrGroup.setActions(subActionList);
      }
    }

    if (block.next && block.next.block) {
      this.processActionBlocks(block.next.block, actionList, actionGroup);
    }
  }

  getBlocklyStateFromActionSet(actionSet: ActionSet) {
    const blocklyDef: IBlocklyDefinition = {
      blocks: {
        languageVersion: 0,
        blocks: [],
      },
    };

    const locatableBlocks = blocklyDef.blocks.blocks;

    let subGroups = 0;
    let subActions = 0;

    for (const actionOrGroup of actionSet.actions) {
      if (actionOrGroup instanceof ActionGroup) {
        subGroups++;
      } else if (actionOrGroup instanceof Action) {
        subActions++;
      }
    }

    if (subGroups > 0) {
      for (const actionOrGroup of actionSet.actions) {
        if (actionOrGroup instanceof ActionGroup) {
          locatableBlocks.push(this.getActionGroupBlocklyDefinition(actionOrGroup, false));
        }
      }
    } else if (subActions > 0) {
      locatableBlocks.push(this.getActionGroupBlocklyDefinition(actionSet, true));
    }

    let i = 0;
    for (const block of locatableBlocks) {
      if (block.x === undefined) {
        block.x = DEFAULT_BLOCK_LEFT;
      }

      if (block.y === undefined) {
        block.y = (i + 1) * DEFAULT_BLOCK_Y_SPACING;
      }
      i++;
    }

    return blocklyDef;
  }

  /**
   * Extract flat Blockly-compatible field values from an Action's data.
   * Blockly fields must be simple primitives (string | number | boolean).
   * Arrays (like component_groups) are joined into comma-separated strings.
   * Nested objects are flattened into "key=value" pairs.
   */
  static getBlocklyFieldsFromAction(action: Action): { [fieldName: string]: boolean | string | number | undefined } {
    const result: { [fieldName: string]: boolean | string | number | undefined } = {};
    const args = action.data.args;

    if (!args) {
      // Fall back to the data's value field if present (e.g., trigger string form)
      if (action.data.value !== undefined) {
        result["value"] = action.data.value;
      }
      return result;
    }

    for (const key in args) {
      const val = (args as any)[key];

      if (val === undefined || val === null) {
        continue;
      }

      if (Array.isArray(val)) {
        // Join arrays into comma-separated strings for display in Blockly field_input
        result[key] = val.join(", ");
      } else if (typeof val === "object") {
        // For nested objects (e.g., set_property { "prop": value }),
        // serialize as "key=value" pairs
        const pairs: string[] = [];
        for (const subKey in val) {
          pairs.push(subKey + "=" + String(val[subKey]));
        }
        result[key] = pairs.join(", ");
      } else {
        result[key] = val;
      }
    }

    return result;
  }

  /**
   * Extract Blockly field values from an ActionGroup's groupActionData.
   * Filters out internal properties like "type" that aren't Blockly fields,
   * and correctly handles falsy values like weight=0.
   */
  static getBlocklyFieldsFromGroupAction(
    group: ActionGroup
  ): { [fieldName: string]: boolean | string | number | undefined } | undefined {
    const data = group.data.groupActionData;
    if (!data) {
      return undefined;
    }

    const result: { [fieldName: string]: boolean | string | number | undefined } = {};

    for (const key in data) {
      // Skip internal properties that aren't Blockly display fields
      if (key === "type" || key === "id") {
        continue;
      }

      const val = (data as any)[key];

      if (val === undefined || val === null) {
        continue;
      }

      if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        result[key] = val;
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  getActionGroupBlocklyDefinition(parentActionGroup: ActionGroup, ignoreSubgroups: boolean): IBlocklyBlockBase {
    let id = parentActionGroup.id;

    if (id === undefined) {
      id = Utilities.createRandomId(10);
      parentActionGroup.id = id;
    }

    let firstAction: IBlocklyBlockBase | undefined = undefined;
    let lastAction: IBlocklyBlockBase | undefined = undefined;

    for (const actionOrGroup of parentActionGroup.actions) {
      if (actionOrGroup instanceof Action) {
        let actionId = actionOrGroup.id;

        if (!actionId) {
          actionId = Utilities.createRandomId(10);
          actionOrGroup.id = actionId;
        }

        const action = {
          id: actionId,
          type: (actionOrGroup as Action).typeId,
          fields: ActionSetEditor.getBlocklyFieldsFromAction(actionOrGroup as Action),
        };

        if (firstAction === undefined) {
          firstAction = action;
        } else if (lastAction) {
          (lastAction as IBlocklyBlockBase).next = { block: action };
        }
        lastAction = action;
      } else if (actionOrGroup instanceof ActionGroup) {
        if (!ignoreSubgroups) {
          const action = this.getActionGroupBlocklyDefinition(actionOrGroup, false);

          if (firstAction === undefined) {
            firstAction = action;
          } else if (lastAction) {
            (lastAction as IBlocklyBlockBase).next = { block: action };
          }
          lastAction = action;
        }
      }
    }

    const actions = firstAction
      ? {
          block: firstAction,
        }
      : undefined;

    const block: IActionGroupBlock = {
      type: parentActionGroup.groupActionType ? parentActionGroup.groupActionType : "action_group",
      id: id,
      inputs: {
        actions: actions,
      },
      fields: ActionSetEditor.getBlocklyFieldsFromGroupAction(parentActionGroup),
      x: parentActionGroup.canvasX,
      y: parentActionGroup.canvasY,
    };

    return block;
  }

  async _handleActionSetTypeChange(event: SelectChangeEvent<string>) {
    if (!this.state.actionSet) {
      return;
    }

    let newActionSetTargetType = ActionSetTarget.general;

    if (event.target.value === ActionSetTargetTypeStrings[1]) {
      newActionSetTargetType = ActionSetTarget.script;
    }

    this.state.actionSet.targetType = newActionSetTargetType;

    this._doUpdate(this.state.actionSet);
  }

  _toggleMaximize() {
    const next = !this.state.isMaximized;
    this.setState({ isMaximized: next });

    if (next) {
      document.addEventListener("keydown", this._handleKeyDown);
    } else {
      document.removeEventListener("keydown", this._handleKeyDown);
    }

    // Blockly needs a resize event after layout changes
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 50);
  }

  _handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && this.state.isMaximized) {
      this._toggleMaximize();
    }
  }

  /**
   * Called once after Blockly injects the workspace. Scrolls the viewport to
   * frame existing blocks (center) or the top-left origin when the canvas
   * is empty, so the user never starts with scrollbars at the bottom-right.
   */
  _handleBlocklyInject(workspace: WorkspaceSvg) {
    // Allow time for initialJson blocks to be rendered before scrolling.
    setTimeout(() => {
      try {
        const topBlocks = workspace.getTopBlocks(false);
        if (topBlocks.length > 0) {
          workspace.zoomToFit();

          // zoomToFit may over-zoom on small block sets; clamp to 1.0
          if (workspace.getScale() > 1) {
            workspace.setScale(1);
            workspace.scrollCenter();
          }
        } else {
          // No blocks — show the origin area (upper-left).
          workspace.scroll(0, 0);
        }
      } catch (e) {
        Log.debug("Blockly initial scroll failed: " + e);
      }
    }, 150);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this._handleKeyDown);
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    let actionSet = this.state.actionSet;

    if (!actionSet || !this.state.toolboxDefinition) {
      const isDarkLoading = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
      return (
        <div className={"ase-emptyState" + (isDarkLoading ? " ase-emptyState-dark" : "")}>
          <div className="ase-emptyState-icon">&#9881;</div>
          <div className="ase-emptyState-title">{!actionSet ? this.props.intl.formatMessage({ id: "project_editor.action_set.preparing" }) : this.props.intl.formatMessage({ id: "project_editor.action_set.loading_toolbox" })}</div>
          <div className="ase-emptyState-hint">{this.props.intl.formatMessage({ id: "project_editor.action_set.loading_hint" })}</div>
        </div>
      );
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    let blocklyState = this.getBlocklyStateFromActionSet(actionSet);

    let toolbarArea = <></>;
    let aseWorkspaceClass = "ase-workspaceArea-full";

    if (this.props.displayTypeDropdown) {
      aseWorkspaceClass = "ase-workspaceArea";

      toolbarArea = (
        <div className="ase-toolBarArea">
          <div className="ase-dropdownArea">
            <FormControl size="small">
              <Select
                key="modeinput"
                value={ActionSetTargetTypeStrings[actionSet.targetType]}
                onChange={this._handleActionSetTypeChange}
              >
                {ActionSetTargetTypeStrings.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
          <div className="ase-toolBar">
            <Stack direction="row" spacing={1} aria-label={this.props.intl.formatMessage({ id: "project_editor.action_set.actions_aria" })}>
              <Button key="addComponentGroupAdd" title={this.props.intl.formatMessage({ id: "project_editor.action_set.add_component_group" })}>
                <CustomLabel
                  isCompact={false}
                  text={this.props.intl.formatMessage({ id: "project_editor.action_set.add_component_group" })}
                  icon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
                />
              </Button>
              <Button key="addEventAdd" title={this.props.intl.formatMessage({ id: "project_editor.action_set.add_action" })}>
                <CustomLabel
                  isCompact={false}
                  text={this.props.intl.formatMessage({ id: "project_editor.action_set.add_action" })}
                  icon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
                />
              </Button>
            </Stack>
          </div>
        </div>
      );
    }

    const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
    const isMaximized = this.state.isMaximized;

    const editorToolbar = (
      <div className={"ase-editorToolbar" + (isDark ? " ase-editorToolbar-dark" : "")}>
        <span className="ase-editorToolbar-title">
          {this.props.intl.formatMessage({ id: "project_editor.action_set.title" })}{isMaximized && this.props.title ? " — " + this.props.title : ""}
        </span>
        <button
          className={"ase-editorToolbar-btn" + (isDark ? " ase-editorToolbar-btn-dark" : "")}
          onClick={this._toggleMaximize}
          title={isMaximized ? this.props.intl.formatMessage({ id: "project_editor.action_set.restore" }) : this.props.intl.formatMessage({ id: "project_editor.action_set.maximize" })}
        >
          <FontAwesomeIcon icon={isMaximized ? faCompress : faExpand} />
        </button>
      </div>
    );

    const blocklyContent = (
      <>
        {editorToolbar}
        <div className={isMaximized ? "ase-workspaceArea-maximized" : aseWorkspaceClass}>
          <BlocklyWorkspace
            workspaceConfiguration={getMinecraftBlocklyConfig(isDark)}
            initialJson={blocklyState}
            toolboxConfiguration={this.state.toolboxDefinition}
            onJsonChange={this._blocklyJsonChange}
            onInject={this._handleBlocklyInject}
            className="ase-bw"
          />
        </div>
      </>
    );

    if (isMaximized) {
      return (
        <div className={"ase-fullscreen" + (isDark ? " ase-fullscreen-dark" : "")}>
          <div className="ase-outer ase-outer-fullscreen">
            {toolbarArea}
            {blocklyContent}
          </div>
        </div>
      );
    }

    return (
      <div style={{ height: height }} className="ase-outer">
        {toolbarArea}
        {blocklyContent}
      </div>
    );
  }
}

export default withLocalization(ActionSetEditor);

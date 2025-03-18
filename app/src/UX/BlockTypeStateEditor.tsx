import { Component, SyntheticEvent } from "react";
import "./BlockTypeStateEditor.css";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import Database from "../minecraft/Database";
import { Toolbar, ThemeInput, List, ListProps, selectableListBehavior, Menu, Dialog } from "@fluentui/react-northstar";
import BlockTypeDefinition, { BlockStateType } from "../minecraft/BlockTypeDefinition";
import Log from "../core/Log";
import { CustomLabel } from "./Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRemove } from "@fortawesome/free-solid-svg-icons";
import Project from "../app/Project";
import SetNamespacedId from "./SetNamespacedId";

interface IBlockTypeStateEditorProps {
  blockTypeItem: BlockTypeDefinition;
  heightOffset: number;
  project: Project;
  title?: string;
  theme: ThemeInput<any>;
}

interface IBlockTypeStateEditorState {
  loadedFormCount?: number;
  activeState: string | undefined;
  dialogMode: BlockTypeStateEditorDialogMode;
  selectedName?: string | undefined;
  newStateType?: BlockStateType | undefined;
}

export enum BlockTypeStateEditorDialogMode {
  none = 0,
  newStateName = 1,
}

export default class BlockTypeStateEditor extends Component<IBlockTypeStateEditorProps, IBlockTypeStateEditorState> {
  constructor(props: IBlockTypeStateEditorProps) {
    super(props);

    this._addStateClick = this._addStateClick.bind(this);
    this._addState = this._addState.bind(this);
    this._handleCloseClick = this._handleCloseClick.bind(this);
    this._handleStateSelected = this._handleStateSelected.bind(this);
    this._addStateClick = this._addStateClick.bind(this);
    this.setNewName = this.setNewName.bind(this);
    this._handleDialogCancel = this._handleDialogCancel.bind(this);
    this._handleSetNameOK = this._handleSetNameOK.bind(this);
    this._addNewStringState = this._addNewStringState.bind(this);
    this._addNewNumberState = this._addNewNumberState.bind(this);
    this._addNewBooleanState = this._addNewBooleanState.bind(this);
    this._ensureBlockPlacementDirectionTrait = this._ensureBlockPlacementDirectionTrait.bind(this);
    this._ensureBlockPlacementPositionTrait = this._ensureBlockPlacementPositionTrait.bind(this);
    this._deleteThisStateClick = this._deleteThisStateClick.bind(this);

    let id = undefined;

    const stateListing = props.blockTypeItem.getStateList();

    if (stateListing && stateListing.length > 0) {
      id = stateListing[0];
    }

    this.state = {
      loadedFormCount: undefined,
      activeState: id,
      dialogMode: BlockTypeStateEditorDialogMode.none,
      selectedName: undefined,
    };
  }

  componentDidUpdate(prevProps: IBlockTypeStateEditorProps, prevState: IBlockTypeStateEditorState) {
    if (prevProps.blockTypeItem !== this.props.blockTypeItem) {
      let id = undefined;

      const stateListing = this.props.blockTypeItem.getStateList();

      if (stateListing && stateListing.length > 0) {
        id = stateListing[0];
      }

      this.setState({
        loadedFormCount: Database.loadedFormCount,
        activeState: id,
        dialogMode: BlockTypeStateEditorDialogMode.none,
      });
    }
  }

  _addStateClick() {
    this.forceUpdate();
  }

  async _addState(id: string, stateType: BlockStateType) {
    this.props.blockTypeItem.addState(id, stateType);
  }

  getFormIdFromComponentId(componentId: string) {
    return componentId.replace(/:/gi, "_").replace(/\./gi, "_");
  }

  async _updateManager() {
    if (!this.props.blockTypeItem) {
      return;
    }

    await Database.ensureFormLoaded("block", "blockstate_boolean");
    await Database.ensureFormLoaded("block", "blockstate_string");
    await Database.ensureFormLoaded("block", "blockstate_number");
    await Database.ensureFormLoaded("block", "trait_placement_direction");
    await Database.ensureFormLoaded("block", "trait_placement_position");

    this.setState({
      loadedFormCount: Database.loadedFormCount,
      activeState: this.state.activeState,
    });
  }

  _handleStateSelected(elt: any, event: ListProps | undefined) {
    if (event === undefined || event.selectedIndex === undefined || this.state == null) {
      return;
    }

    const stateList = this.props.blockTypeItem.getStateList();
    let id = undefined;
    const traits = this.props.blockTypeItem.data?.description?.traits;

    if (event.selectedIndex < stateList.length) {
      id = stateList[event.selectedIndex];
    } else if (traits?.["minecraft:placement_direction"] && event.selectedIndex === stateList.length) {
      id = "trait_placement_direction";
    } else if (traits?.["minecraft:placement_position"] && event.selectedIndex <= stateList.length + 1) {
      id = "trait_placement_position";
    }

    if (id) {
      this.setState({
        activeState: id,
      });
    }
  }

  _handleCloseClick(props: IDataFormProps) {
    if (!props.tag) {
      return;
    }

    const componentId = props.tag;

    if (componentId) {
      this.props.blockTypeItem.removeComponent(componentId);
      this.forceUpdate();
    }
  }

  _addNewStringState() {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      dialogMode: BlockTypeStateEditorDialogMode.newStateName,
      newStateType: BlockStateType.string,
    });
  }

  _addNewBooleanState() {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      dialogMode: BlockTypeStateEditorDialogMode.newStateName,
      newStateType: BlockStateType.boolean,
    });
  }

  _addNewNumberState() {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      dialogMode: BlockTypeStateEditorDialogMode.newStateName,
      newStateType: BlockStateType.number,
    });
  }

  _ensureBlockPlacementDirectionTrait() {
    this.props.blockTypeItem.ensurePlacementDirectionTrait();

    this.forceUpdate();
  }

  _ensureBlockPlacementPositionTrait() {
    this.props.blockTypeItem.ensurePlacementPositionTrait();

    this.forceUpdate();
  }

  setNewName(newName: string) {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      activeState: this.state.activeState,
      dialogMode: this.state.dialogMode,
      selectedName: newName,
    });
  }

  private _handleDialogCancel() {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      dialogMode: BlockTypeStateEditorDialogMode.none,
    });
  }

  private _handleSetNameOK() {
    if (this.state.selectedName && this.state.newStateType !== undefined) {
      this._addState(this.state.selectedName, this.state.newStateType);

      this.setState({
        loadedFormCount: this.state.loadedFormCount,
        dialogMode: BlockTypeStateEditorDialogMode.none,
        selectedName: undefined,
      });
    }
  }

  _deleteThisStateClick(e: SyntheticEvent | undefined, data: any | undefined) {
    if (!data.tag) {
      return;
    }

    const stateId = data.tag;

    if (stateId && stateId !== "trait_placement_direction" && stateId !== "trait_placement_position") {
      this.props.blockTypeItem.removeState(stateId);
    } else if (stateId === "trait_placement_direction") {
      this.props.blockTypeItem.removePlacementDirectionTrait();
    } else if (stateId === "trait_placement_position") {
      this.props.blockTypeItem.removePlacementPositionTrait();
    }

    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      activeState: undefined,
    });
  }

  render() {
    if (this.state === undefined || this.state.loadedFormCount === undefined) {
      this._updateManager();

      return <div className="btse-loading">Loading...</div>;
    }
    if (this.state.dialogMode === BlockTypeStateEditorDialogMode.newStateName) {
      return (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="btse-addComponentOuter"
          onCancel={this._handleDialogCancel}
          onConfirm={this._handleSetNameOK}
          content={
            <SetNamespacedId
              onNameChanged={this.setNewName}
              defaultNamespace={this.props.project.effectiveDefaultNamespace}
              defaultName="newState"
              theme={this.props.theme}
            />
          }
          header={"Add block state"}
        />
      );
    } else {
      let formName = undefined;
      let formKey = undefined;
      let formData: number[] | boolean[] | string[] | object | undefined = undefined;

      const states = this.props.blockTypeItem.getStates();
      const stateForms = [];
      const stateList = [];
      let message = <></>;

      let selectedIndex = -1;

      let stateCount = 0;
      for (const key in states) {
        const stateData = states[key];

        if (stateData !== undefined) {
          if (key === this.state.activeState || this.state.activeState === undefined || selectedIndex < 0) {
            if (Array.isArray(stateData)) {
              if (stateData.length === 2 && typeof stateData[0] === "boolean") {
                formName = "blockstate_boolean";
                formKey = key;
                formData = stateData;
                selectedIndex = stateCount;
              } else if (stateData.length > 0 && typeof stateData[0] === "number") {
                formName = "blockstate_number";
                formKey = key;
                formData = stateData;
                selectedIndex = stateCount;
              } else if (stateData.length > 0 && typeof stateData[0] === "string") {
                formName = "blockstate_string";
                formKey = key;
                formData = stateData;
                selectedIndex = stateCount;
              }
            }
          }

          stateCount++;
          stateList.push(key);
        }
      }

      const traits = this.props.blockTypeItem.data?.description?.traits;
      const addMenuItems = [
        {
          content: "String state",
          key: "stringState",
          onClick: this._addNewStringState,
        },
        {
          content: "Number state",
          key: "numberState",
          onClick: this._addNewNumberState,
        },
        {
          content: "True/false state",
          key: "booleanState",
          onClick: this._addNewBooleanState,
        },
      ];

      let hasPlacementDirection = false;
      let hasPlacementPosition = false;

      if (traits) {
        const enabledPlacementDirectionStates = traits["minecraft:placement_direction"]?.enabled_states;

        if (enabledPlacementDirectionStates) {
          let placementDirection = "Place Direction";

          if (enabledPlacementDirectionStates.length > 0) {
            placementDirection += " (" + enabledPlacementDirectionStates.join(", ") + ")";
          }

          hasPlacementDirection = true;
          stateList.push(placementDirection);

          if (this.state.activeState === "trait_placement_direction") {
            formData = enabledPlacementDirectionStates;
            formKey = this.state.activeState;
            formName = this.state.activeState;
            selectedIndex = stateCount;
          }

          stateCount++;
        }

        const enabledPlacementPositionStates = traits["minecraft:placement_position"]?.enabled_states;

        if (enabledPlacementPositionStates) {
          let placementPosition = "Place Position";

          if (enabledPlacementPositionStates.length > 0) {
            placementPosition += " (" + enabledPlacementPositionStates.join(", ") + ")";
          }

          hasPlacementPosition = true;
          stateList.push(placementPosition);

          if (this.state.activeState === "trait_placement_position") {
            formData = enabledPlacementDirectionStates;
            formKey = this.state.activeState;
            formName = this.state.activeState;
            selectedIndex = stateCount;
          }

          stateCount++;
        }
      }

      if (stateList.length === 0) {
        message = <div className="btse-select">Select Add state to add custom properties to this block.</div>;
      }

      let title = <></>;

      if (this.props.title) {
        title = <span>{this.props.title}</span>;
      }

      const areaHeight = "calc(100vh - " + String(this.props.heightOffset + 34) + "px)";

      if (!hasPlacementDirection) {
        addMenuItems.push({
          key: "cardinalFacingDirection",
          content: "Direction state: cardinal/facing",
          onClick: this._ensureBlockPlacementDirectionTrait,
        });
      }

      if (!hasPlacementPosition) {
        addMenuItems.push({
          key: "placementPosition",
          content: "Position state: block face/vertical half",
          onClick: this._ensureBlockPlacementPositionTrait,
        });
      }

      const toolbarItems: any[] = [];

      if (formName && formKey && formData) {
        const form = Database.getForm("block", formName);

        Log.assertDefined(form);

        stateForms.push(
          <div className="bcose-componentForm">
            <DataForm
              displayTitle={true}
              displayDescription={true}
              readOnly={false}
              tag={formKey}
              project={this.props.project}
              lookupProvider={this.props.project}
              theme={this.props.theme}
              objectKey={formKey}
              closeButton={false}
              definition={form}
              directObject={{
                values: formData,
              }}
            ></DataForm>
          </div>
        );

        toolbarItems.push({
          id: "deleteThisComponent",
          icon: (
            <CustomLabel
              text={"Delete this state"}
              icon={<FontAwesomeIcon icon={faRemove} className="fa-lg" />}
              isCompact={false}
            />
          ),
          key: "delete." + this.state.activeState,
          tag: this.state.activeState,
          onClick: this._deleteThisStateClick,
          title: "Delete this state",
        });
      }

      return (
        <div className="btse-area">
          <div className="btse-componentArea">
            <div className="btse-titleArea">{title}</div>
            <div className="btse-addMenu">
              <Menu
                items={[
                  {
                    content: "Add state",
                    key: "addItem",
                    menu: {
                      items: addMenuItems,
                    },
                  },
                ]}
              />
            </div>
          </div>
          <div
            className="btse-componentList"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background6,
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
              minHeight: areaHeight,
              maxHeight: areaHeight,
            }}
          >
            <List
              selectable
              aria-label="List of components"
              accessibility={selectableListBehavior}
              defaultSelectedIndex={selectedIndex}
              selectedIndex={selectedIndex}
              items={stateList}
              onSelectedIndexChange={this._handleStateSelected}
            />
          </div>
          <div
            className="btse-componentBin"
            style={{
              minHeight: areaHeight,
              maxHeight: areaHeight,
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background6,
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            }}
          >
            <div className="btse-componentToolBarArea">
              <Toolbar aria-label="Component editing toolbar" items={toolbarItems} />
            </div>
            {message}
            {stateForms}
          </div>
        </div>
      );
    }
  }
}

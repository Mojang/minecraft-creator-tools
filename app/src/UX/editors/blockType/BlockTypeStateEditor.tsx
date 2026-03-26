import { Component } from "react";
import "./BlockTypeStateEditor.css";
import DataForm, { IDataFormProps } from "../../../dataformux/DataForm";
import Database from "../../../minecraft/Database";
import {
  Stack,
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItemButton,
} from "@mui/material";
import BlockTypeDefinition, { BlockStateType } from "../../../minecraft/BlockTypeDefinition";
import Log from "../../../core/Log";
import { CustomLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import Project from "../../../app/Project";
import SetNamespacedId from "../../project/naming/SetNamespacedId";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";

interface IBlockTypeStateEditorProps {
  blockTypeItem: BlockTypeDefinition;
  heightOffset: number;
  project: Project;
  title?: string;
  theme: IProjectTheme;
}

interface IBlockTypeStateEditorState {
  loadedFormCount?: number;
  activeState: string | undefined;
  dialogMode: BlockTypeStateEditorDialogMode;
  selectedName?: string | undefined;
  newStateType?: BlockStateType | undefined;
  menuAnchorEl?: HTMLElement | null;
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
    this._handleMenuOpen = this._handleMenuOpen.bind(this);
    this._handleMenuClose = this._handleMenuClose.bind(this);

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
      menuAnchorEl: null,
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

  _handleStateSelected(id: string) {
    if (this.state == null) {
      return;
    }

    this.setState({
      activeState: id,
    });
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

  _handleMenuOpen(event: React.MouseEvent<HTMLButtonElement>) {
    this.setState({ menuAnchorEl: event.currentTarget });
  }

  _handleMenuClose() {
    this.setState({ menuAnchorEl: null });
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

  _deleteThisStateClick(stateId: string) {
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
        <Dialog open={true} onClose={this._handleDialogCancel} key="btse-addComponentOuter">
          <DialogTitle>Add block state</DialogTitle>
          <DialogContent>
            <SetNamespacedId
              onNameChanged={this.setNewName}
              defaultNamespace={this.props.project.effectiveDefaultNamespace}
              defaultName="newState"
              theme={this.props.theme}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={this._handleDialogCancel}>Cancel</Button>
            <Button onClick={this._handleSetNameOK}>Add</Button>
          </DialogActions>
        </Dialog>
      );
    } else {
      let formName = undefined;
      let formKey = undefined;
      let formData: number[] | boolean[] | string[] | object | undefined = undefined;

      const states = this.props.blockTypeItem.getStates();
      const stateForms = [];
      const stateList: { id: string; label: string }[] = [];
      let message = <></>;

      let stateCount = 0;
      for (const key in states) {
        const stateData = states[key];

        if (stateData !== undefined) {
          if (key === this.state.activeState || this.state.activeState === undefined || formKey === undefined) {
            if (Array.isArray(stateData)) {
              if (stateData.length === 2 && typeof stateData[0] === "boolean") {
                formName = "blockstate_boolean";
                formKey = key;
                formData = stateData;
              } else if (stateData.length > 0 && typeof stateData[0] === "number") {
                formName = "blockstate_number";
                formKey = key;
                formData = stateData;
              } else if (stateData.length > 0 && typeof stateData[0] === "string") {
                formName = "blockstate_string";
                formKey = key;
                formData = stateData;
              }
            }
          }

          stateCount++;
          stateList.push({ id: key, label: key });
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
          stateList.push({ id: "trait_placement_direction", label: placementDirection });

          if (this.state.activeState === "trait_placement_direction") {
            formData = enabledPlacementDirectionStates;
            formKey = this.state.activeState;
            formName = this.state.activeState;
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
          stateList.push({ id: "trait_placement_position", label: placementPosition });

          if (this.state.activeState === "trait_placement_position") {
            formData = enabledPlacementDirectionStates;
            formKey = this.state.activeState;
            formName = this.state.activeState;
          }

          stateCount++;
        }
      }

      if (stateList.length === 0) {
        message = (
          <div className="btse-select">
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>No block states defined yet</div>
            <div style={{ marginBottom: 12 }}>
              Block states let your block have different appearances or behaviors (e.g., a door being open or closed).
            </div>
            <div>Click the + button above to add your first state.</div>
          </div>
        );
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

      let showDeleteButton = false;

      if (formName && formKey && formData) {
        const form = Database.getForm("block", formName);

        Log.assertDefined(form);

        if (form) {
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
        }

        showDeleteButton = true;
      }

      const colors = getThemeColors();
      const menuOpen = Boolean(this.state.menuAnchorEl);

      return (
        <div className="btse-area">
          <div className="btse-componentArea">
            <div className="btse-titleArea">{title}</div>
            <div className="btse-addMenu">
              <Button onClick={this._handleMenuOpen} startIcon={<FontAwesomeIcon icon={faPlus} />}>
                Add state
              </Button>
              <Menu anchorEl={this.state.menuAnchorEl} open={menuOpen} onClose={this._handleMenuClose}>
                {addMenuItems.map((item) => (
                  <MenuItem
                    key={item.key}
                    onClick={() => {
                      this._handleMenuClose();
                      item.onClick();
                    }}
                  >
                    {item.content}
                  </MenuItem>
                ))}
              </Menu>
            </div>
          </div>
          <div
            className="btse-componentList"
            style={{
              borderColor: colors.background6,
              backgroundColor: colors.background3,
              color: colors.foreground3,
              minHeight: areaHeight,
              maxHeight: areaHeight,
            }}
          >
            <List aria-label="List of components">
              {stateList.map((item) => (
                <ListItemButton
                  key={item.id}
                  selected={item.id === this.state.activeState}
                  onClick={() => this._handleStateSelected(item.id)}
                >
                  {item.label}
                </ListItemButton>
              ))}
            </List>
          </div>
          <div
            className="btse-componentBin"
            style={{
              minHeight: areaHeight,
              maxHeight: areaHeight,
              borderColor: colors.background6,
              backgroundColor: colors.background2,
              color: colors.foreground2,
            }}
          >
            <div className="btse-componentToolBarArea">
              <Stack direction="row" spacing={1} aria-label="Block type state editing">
                {showDeleteButton && this.state.activeState && (
                  <Button
                    key={"delete." + this.state.activeState}
                    onClick={() => this._deleteThisStateClick(this.state.activeState!)}
                    title="Delete this state"
                  >
                    <CustomLabel
                      text={"Delete this state"}
                      icon={<FontAwesomeIcon icon={faMinus} className="fa-lg" />}
                      isCompact={false}
                    />
                  </Button>
                )}
              </Stack>
            </div>
            {message}
            {stateForms}
          </div>
        </div>
      );
    }
  }
}

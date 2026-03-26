import { Component } from "react";
import "./EntityTypePropertyEditor.css";
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
import SetName from "../../project/naming/SetName";
import Log from "../../../core/Log";
import { CustomLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import EntityTypeDefinition, { EntityPropertyType } from "../../../minecraft/EntityTypeDefinition";
import Project from "../../../app/Project";
import IProjectTheme from "../../types/IProjectTheme";

interface IEntityTypePropertyEditorProps {
  entityTypeItem: EntityTypeDefinition;
  heightOffset: number;
  project: Project;
  title?: string;
  theme: IProjectTheme;
}

interface IEntityTypePropertyEditorState {
  loadedFormCount?: number;
  activeProperty: string | undefined;
  dialogMode: EntityTypePropertyEditorDialogMode;
  selectedName?: string | undefined;
  newPropertyType?: EntityPropertyType | undefined;
  menuAnchorEl?: HTMLElement | null;
}

export enum EntityTypePropertyEditorDialogMode {
  none = 0,
  newPropertyName = 1,
}

export default class EntityTypePropertyEditor extends Component<
  IEntityTypePropertyEditorProps,
  IEntityTypePropertyEditorState
> {
  constructor(props: IEntityTypePropertyEditorProps) {
    super(props);

    this._addStateClick = this._addStateClick.bind(this);
    this._addState = this._addState.bind(this);
    this._handleCloseClick = this._handleCloseClick.bind(this);
    this._handlePropertySelected = this._handlePropertySelected.bind(this);
    this._addStateClick = this._addStateClick.bind(this);
    this.setNewName = this.setNewName.bind(this);
    this._handleDialogCancel = this._handleDialogCancel.bind(this);
    this._handleSetNameOK = this._handleSetNameOK.bind(this);
    this._addNewStringProperty = this._addNewStringProperty.bind(this);
    this._addNewNumberProperty = this._addNewNumberProperty.bind(this);
    this._addNewBooleanProperty = this._addNewBooleanProperty.bind(this);
    this._deleteThisPropertyClick = this._deleteThisPropertyClick.bind(this);
    this._handleMenuOpen = this._handleMenuOpen.bind(this);
    this._handleMenuClose = this._handleMenuClose.bind(this);

    let id = undefined;

    const stateListing = props.entityTypeItem.getPropertyList();

    if (stateListing && stateListing.length > 0) {
      id = stateListing[0];
    }

    this.state = {
      loadedFormCount: undefined,
      activeProperty: id,
      dialogMode: EntityTypePropertyEditorDialogMode.none,
      selectedName: undefined,
      menuAnchorEl: null,
    };
  }

  componentDidUpdate(prevProps: IEntityTypePropertyEditorProps, prevState: IEntityTypePropertyEditorState) {
    if (prevProps.entityTypeItem !== this.props.entityTypeItem) {
      let id = undefined;

      const propList = this.props.entityTypeItem.getPropertyList();

      if (propList && propList.length > 0) {
        id = propList[0];
      }

      this.setState({
        loadedFormCount: Database.loadedFormCount,
        activeProperty: id,
        dialogMode: EntityTypePropertyEditorDialogMode.none,
      });
    }
  }

  _addStateClick() {
    this.forceUpdate();
  }

  async _addState(id: string, stateType: EntityPropertyType) {
    this.props.entityTypeItem.addProperty(id, stateType);
  }

  getFormIdFromComponentId(componentId: string) {
    return componentId.replace(/:/gi, "_").replace(/\./gi, "_");
  }

  async _updateManager() {
    if (!this.props.entityTypeItem) {
      return;
    }

    await Database.ensureFormLoaded("block", "blockstate_boolean");
    await Database.ensureFormLoaded("block", "blockstate_string");
    await Database.ensureFormLoaded("block", "blockstate_number");
    await Database.ensureFormLoaded("block", "trait_placement_direction");
    await Database.ensureFormLoaded("block", "trait_placement_position");

    this.setState({
      loadedFormCount: Database.loadedFormCount,
      activeProperty: this.state.activeProperty,
    });
  }

  _handlePropertySelected(id: string) {
    if (this.state == null) {
      return;
    }

    this.setState({
      activeProperty: id,
    });
  }

  _handleCloseClick(props: IDataFormProps) {
    if (!props.tag) {
      return;
    }

    const componentId = props.tag;

    if (componentId) {
      this.props.entityTypeItem.removeComponent(componentId);
      this.forceUpdate();
    }
  }

  _addNewStringProperty() {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      dialogMode: EntityTypePropertyEditorDialogMode.newPropertyName,
      newPropertyType: EntityPropertyType.enum,
    });
  }

  _addNewBooleanProperty() {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      dialogMode: EntityTypePropertyEditorDialogMode.newPropertyName,
      newPropertyType: EntityPropertyType.boolean,
    });
  }

  _addNewNumberProperty() {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      dialogMode: EntityTypePropertyEditorDialogMode.newPropertyName,
      newPropertyType: EntityPropertyType.float,
    });
  }

  setNewName(newName: string) {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      activeProperty: this.state.activeProperty,
      dialogMode: this.state.dialogMode,
      selectedName: newName,
    });
  }

  private _handleDialogCancel() {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      dialogMode: EntityTypePropertyEditorDialogMode.none,
    });
  }

  private _handleSetNameOK() {
    if (this.state.selectedName && this.state.newPropertyType !== undefined) {
      this._addState(this.state.selectedName, this.state.newPropertyType);

      this.setState({
        loadedFormCount: this.state.loadedFormCount,
        dialogMode: EntityTypePropertyEditorDialogMode.none,
        selectedName: undefined,
      });
    }
  }

  _deleteThisPropertyClick(propertyId: string) {
    if (propertyId) {
      this.props.entityTypeItem.removeProperty(propertyId);
    }

    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      activeProperty: undefined,
    });
  }

  _handleMenuOpen(event: React.MouseEvent<HTMLButtonElement>) {
    this.setState({ menuAnchorEl: event.currentTarget });
  }

  _handleMenuClose() {
    this.setState({ menuAnchorEl: null });
  }

  render() {
    if (this.state === undefined || this.state.loadedFormCount === undefined) {
      this._updateManager();

      return <div className="etpe-loading">Loading...</div>;
    }

    if (this.state.dialogMode === EntityTypePropertyEditorDialogMode.newPropertyName) {
      return (
        <Dialog open={true} onClose={this._handleDialogCancel} key="etpe-addComponentOuter">
          <DialogTitle>Add property</DialogTitle>
          <DialogContent>
            <SetName onNameChanged={this.setNewName} defaultName="new property" theme={this.props.theme} />
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

      const props = this.props.entityTypeItem.getProperties();
      const propForms = [];
      const propList: { id: string; label: string }[] = [];
      let message = <></>;

      let stateCount = 0;
      for (const key in props) {
        const propData = props[key];

        if (propData !== undefined) {
          if (key === this.state.activeProperty || this.state.activeProperty === undefined || formKey === undefined) {
            if (Array.isArray(propData)) {
              if (propData.length === 2 && typeof propData[0] === "boolean" && typeof propData[0] === "boolean") {
                formName = "blockstate_boolean";
                formKey = key;
                formData = propData;
              } else if (propData.length > 0 && typeof propData[0] === "number") {
                formName = "blockstate_number";
                formKey = key;
                formData = propData;
              } else if (propData.length > 0 && typeof propData[0] === "string") {
                formName = "blockstate_string";
                formKey = key;
                formData = propData;
              }
            } else if (propData && (propData as any).type === "enum") {
              formName = "blockstate_string";
              formKey = key;
              formData = (propData as any).values;
            }
          }

          stateCount++;
          propList.push({ id: key, label: key });
        }
      }

      const addMenuItems = [
        {
          content: "String property",
          key: "stringProperty",
          onClick: this._addNewStringProperty,
        },
        {
          content: "Number property",
          key: "numberProperty",
          onClick: this._addNewNumberProperty,
        },
        {
          content: "True/false property",
          key: "booleanProperty",
          onClick: this._addNewBooleanProperty,
        },
      ];

      if (propList.length === 0) {
        message = (
          <div style={{ padding: "8px 12px", lineHeight: 1.5, fontSize: "10pt" }}>
            <div style={{ marginBottom: "8px", opacity: 0.8 }}>
              Properties are custom data values that store information about your mob — like whether it's tamed, what
              color it is, or how big it's grown.
            </div>
            <div style={{ marginBottom: "8px", opacity: 0.6, fontSize: "9pt" }}>
              <strong>Examples:</strong>
              <ul style={{ marginTop: "4px", paddingLeft: "20px" }}>
                <li>
                  <strong>is_tamed</strong> (true/false) — Track if this mob has been tamed
                </li>
                <li>
                  <strong>color</strong> (text) — Store the mob's color variant
                </li>
                <li>
                  <strong>growth_stage</strong> (number) — Track baby vs. adult state
                </li>
              </ul>
            </div>
            <div style={{ opacity: 0.6, fontSize: "9pt" }}>
              Click <strong>Add Property</strong> above to create your first one.
            </div>
          </div>
        );
      }

      let title = <></>;

      if (this.props.title) {
        title = <span>{this.props.title}</span>;
      }

      const areaHeight = "calc(100vh - " + String(this.props.heightOffset + 74) + "px)";

      let showDeleteButton = false;

      if (formName && formKey && formData) {
        const form = Database.getForm("block", formName);

        Log.assertDefined(form);

        if (form) {
          propForms.push(
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

      const menuOpen = Boolean(this.state.menuAnchorEl);

      return (
        <div className="etpe-area">
          <div className="etpe-listPanel">
            <div className="etpe-addButtonRow">
              <button className="ete-addActionBtn" onClick={this._handleMenuOpen}>
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: "6px" }} />
                Add Property
              </button>
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
            <div
              className="etpe-componentList"
              style={{
                minHeight: areaHeight,
                maxHeight: areaHeight,
              }}
            >
              <List aria-label="List of properties">
                {propList.map((item) => (
                  <ListItemButton
                    key={item.id}
                    selected={item.id === this.state.activeProperty}
                    onClick={() => this._handlePropertySelected(item.id)}
                  >
                    {item.label}
                  </ListItemButton>
                ))}
              </List>
            </div>
          </div>
          <div
            className="etpe-componentBin"
            style={{
              minHeight: areaHeight,
              maxHeight: areaHeight,
            }}
          >
            <div className="etpe-componentToolBarArea">
              <Stack direction="row" spacing={1} aria-label="Property editing toolbar">
                {showDeleteButton && this.state.activeProperty && (
                  <Button
                    key={"delete." + this.state.activeProperty}
                    onClick={() => this._deleteThisPropertyClick(this.state.activeProperty!)}
                    title="Delete this property"
                  >
                    <CustomLabel
                      text={"Delete this property"}
                      icon={<FontAwesomeIcon icon={faMinus} className="fa-lg" />}
                      isCompact={false}
                    />
                  </Button>
                )}
              </Stack>
            </div>
            {message}
            {propForms}
          </div>
        </div>
      );
    }
  }
}

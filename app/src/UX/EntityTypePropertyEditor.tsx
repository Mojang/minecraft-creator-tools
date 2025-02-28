import { Component, SyntheticEvent } from "react";
import "./EntityTypePropertyEditor.css";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import Database from "../minecraft/Database";
import { Toolbar, ThemeInput, List, ListProps, selectableListBehavior, Menu, Dialog } from "@fluentui/react-northstar";
import SetName from "./SetName";
import Log from "../core/Log";
import { CustomLabel } from "./Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRemove } from "@fortawesome/free-solid-svg-icons";
import EntityTypeDefinition, { EntityPropertyType } from "../minecraft/EntityTypeDefinition";

interface IEntityTypePropertyEditorProps {
  entityTypeItem: EntityTypeDefinition;
  heightOffset: number;
  title?: string;
  theme: ThemeInput<any>;
}

interface IEntityTypePropertyEditorState {
  loadedFormCount?: number;
  activeProperty: string | undefined;
  dialogMode: EntityTypePropertyEditorDialogMode;
  selectedName?: string | undefined;
  newPropertyType?: EntityPropertyType | undefined;
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

  _handlePropertySelected(elt: any, event: ListProps | undefined) {
    if (event === undefined || event.selectedIndex === undefined || this.state == null) {
      return;
    }

    const propList = this.props.entityTypeItem.getPropertyList();
    let id = undefined;

    if (event.selectedIndex < propList.length) {
      id = propList[event.selectedIndex];
    }

    if (id) {
      this.setState({
        activeProperty: id,
      });
    }
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
      newPropertyType: EntityPropertyType.string,
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
      newPropertyType: EntityPropertyType.number,
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

  _deleteThisPropertyClick(e: SyntheticEvent | undefined, data: any | undefined) {
    if (!data.tag) {
      return;
    }

    const stateId = data.tag;

    if (stateId) {
      this.props.entityTypeItem.removeProperty(stateId);
    }

    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      activeProperty: undefined,
    });
  }

  render() {
    if (this.state === undefined || this.state.loadedFormCount === undefined) {
      this._updateManager();

      return <div>Loading...</div>;
    }
    if (this.state.dialogMode === EntityTypePropertyEditorDialogMode.newPropertyName) {
      return (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="etpe-addComponentOuter"
          onCancel={this._handleDialogCancel}
          onConfirm={this._handleSetNameOK}
          content={<SetName onNameChanged={this.setNewName} defaultName="new property" theme={this.props.theme} />}
          header={"Add property"}
        />
      );
    } else {
      let formName = undefined;
      let formKey = undefined;
      let formData: number[] | boolean[] | string[] | object | undefined = undefined;

      const props = this.props.entityTypeItem.getProperties();
      const propForms = [];
      const propList = [];
      let message = <></>;

      let selectedIndex = -1;

      let stateCount = 0;
      for (const key in props) {
        const propData = props[key];

        if (propData !== undefined) {
          if (key === this.state.activeProperty || this.state.activeProperty === undefined || selectedIndex < 0) {
            if (Array.isArray(propData)) {
              if (propData.length === 2 && typeof propData[0] === "boolean" && typeof propData[0] === "boolean") {
                formName = "blockstate_boolean";
                formKey = key;
                formData = propData;
                selectedIndex = stateCount;
              } else if (propData.length > 0 && typeof propData[0] === "number") {
                formName = "blockstate_number";
                formKey = key;
                formData = propData;
                selectedIndex = stateCount;
              } else if (propData.length > 0 && typeof propData[0] === "string") {
                formName = "blockstate_string";
                formKey = key;
                formData = propData;
                selectedIndex = stateCount;
              }
            }
          }

          stateCount++;
          propList.push(key);
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
        message = <div>Select Add Property to add custom properties to this entity.</div>;
      }

      let title = <></>;

      if (this.props.title) {
        title = <span>{this.props.title}</span>;
      }

      const areaHeight = "calc(100vh - " + String(this.props.heightOffset + 34) + "px)";

      const toolbarItems: any[] = [];

      if (formName && formKey && formData) {
        const form = Database.getForm("block", formName);

        Log.assertDefined(form);

        propForms.push(
          <div className="bcose-componentForm">
            <DataForm
              displayTitle={true}
              displayDescription={true}
              readOnly={false}
              tag={formKey}
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
          id: "deleteThisProp",
          icon: (
            <CustomLabel
              text={"Delete this state"}
              icon={<FontAwesomeIcon icon={faRemove} className="fa-lg" />}
              isCompact={false}
            />
          ),
          key: "delete." + this.state.activeProperty,
          tag: this.state.activeProperty,
          onClick: this._deleteThisPropertyClick,
          title: "Delete this state",
        });
      }

      return (
        <div className="etpe-area">
          <div className="etpe-componentArea">
            <div className="etpe-titleArea">{title}</div>
            <div className="etpe-addMenu">
              <Menu
                items={[
                  {
                    content: "Add property",
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
            className="etpe-componentList"
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
              items={propList}
              onSelectedIndexChange={this._handlePropertySelected}
            />
          </div>
          <div
            className="etpe-componentBin"
            style={{
              minHeight: areaHeight,
              maxHeight: areaHeight,
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background6,
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            }}
          >
            <div className="etpe-componentToolBarArea">
              <Toolbar aria-label="Component editing toolbar" items={toolbarItems} />
            </div>
            {message}
            {propForms}
          </div>
        </div>
      );
    }
  }
}

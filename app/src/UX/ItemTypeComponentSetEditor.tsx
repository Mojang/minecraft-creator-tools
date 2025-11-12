import { Component, SyntheticEvent } from "react";
import "./ItemTypeComponentSetEditor.css";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import Database from "../minecraft/Database";
import {
  Toolbar,
  ThemeInput,
  List,
  ListProps,
  selectableListBehavior,
  ButtonProps,
  Dialog,
} from "@fluentui/react-northstar";
import IManagedComponentSetItem from "../minecraft/IManagedComponentSetItem";
import DataFormUtilities from "../dataform/DataFormUtilities";
import Utilities from "../core/Utilities";
import { CustomLabel } from "./Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAdd } from "@fortawesome/free-solid-svg-icons";
import ItemTypeAddComponent from "./ItemTypeAddComponent";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import CreatorTools from "../app/CreatorTools";
import Project from "../app/Project";
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import { ManagedComponent } from "../minecraft/ManagedComponent";

interface IItemTypeComponentSetEditorProps {
  itemTypeDefinition: IManagedComponentSetItem;
  isVisualsMode: boolean;
  isDefault: boolean;
  project: Project;
  creatorTools: CreatorTools;
  height?: number;
  heightOffset?: number;
  title?: string;
  theme: ThemeInput<any>;
}

interface IItemTypeComponentSetEditorState {
  loadedFormCount?: number;
  activeComponentId: string | undefined;
  dialogMode: ItemTypeComponentEditorDialog;
  selectedNewComponentId: string | undefined;
}

export enum ItemTypeComponentEditorDialog {
  none = 0,
  addComponent = 1,
}

export default class ItemTypeComponentSetEditor extends Component<
  IItemTypeComponentSetEditorProps,
  IItemTypeComponentSetEditorState
> {
  constructor(props: IItemTypeComponentSetEditorProps) {
    super(props);

    this._addComponentClick = this._addComponentClick.bind(this);
    this._addComponent = this._addComponent.bind(this);
    this._handleCloseClick = this._handleCloseClick.bind(this);
    this._handleComponentSelected = this._handleComponentSelected.bind(this);
    this._addComponentClick = this._addComponentClick.bind(this);
    this.setSelectedNewComponentId = this.setSelectedNewComponentId.bind(this);
    this._handleAddComponentClick = this._handleAddComponentClick.bind(this);
    this._handleAddComponentOK = this._handleAddComponentOK.bind(this);
    this._handleDialogCancel = this._handleDialogCancel.bind(this);

    let id = undefined;

    const componentListing = this.getUsableComponents();

    if (componentListing && componentListing.length > 0) {
      id = componentListing[0].id;
    }

    this.state = {
      loadedFormCount: undefined,
      activeComponentId: id,
      dialogMode: ItemTypeComponentEditorDialog.none,
      selectedNewComponentId: undefined,
    };
  }

  componentDidUpdate(prevProps: IItemTypeComponentSetEditorProps, prevState: IItemTypeComponentSetEditorState) {
    if (prevProps.itemTypeDefinition !== this.props.itemTypeDefinition) {
      let id = undefined;

      const componentListing = this.getUsableComponents();

      if (componentListing && componentListing.length > 0) {
        id = componentListing[0].id;
      }

      this.setState({
        loadedFormCount: Database.loadedFormCount,
        activeComponentId: id,
      });
    }
  }

  _addComponentClick() {
    this.forceUpdate();
  }

  async _addComponent(id: string) {
    if (Database.uxCatalog === null) {
      return;
    }

    let formName = id;

    if (formName.startsWith("minecraft:")) {
      formName = EntityTypeDefinition.getFormIdFromComponentId(id);
    }

    let form = Database.getForm("item_components", formName);

    if (!form) {
      form = await Database.ensureFormLoaded("item_components", formName);
    }

    if (form !== undefined) {
      const newDataObject = DataFormUtilities.generateDefaultItem(form);

      this.props.itemTypeDefinition.addComponent(id, newDataObject);
    }
  }

  getFormIdFromComponentId(componentId: string) {
    return componentId.replace(/:/gi, "_").replace(/\./gi, "_");
  }

  async _updateManager() {
    if (!this.props.itemTypeDefinition) {
      return;
    }

    const components = this.props.itemTypeDefinition.getComponents();

    for (let i = 0; i < components.length; i++) {
      const component = components[i];

      if (typeof component === "object" && component.id !== undefined) {
        if (!component.id.startsWith("minecraft:")) {
          continue;
        }

        const formId = this.getFormIdFromComponentId(component.id);

        if (!Database.isFormLoaded("item_components", formId)) {
          await Database.ensureFormLoaded("item_components", formId);
        }
      }
    }

    this.setState({
      loadedFormCount: Database.loadedFormCount,
      activeComponentId: this.state.activeComponentId,
    });
  }

  _handleComponentSelected(elt: any, event: ListProps | undefined) {
    if (event === undefined || event.selectedIndex === undefined || this.state == null) {
      return;
    }

    const componentListing = this.getUsableComponents();

    const id = componentListing[event.selectedIndex].id;

    if (id) {
      this.setState({
        activeComponentId: id,
      });
    }
  }

  _handleCloseClick(props: IDataFormProps) {
    if (!props.tag) {
      return;
    }

    const componentId = props.tag;

    if (componentId) {
      this.props.itemTypeDefinition.removeComponent(componentId);
      this.forceUpdate();
    }
  }

  getUsableComponents() {
    const components = this.props.itemTypeDefinition.getComponents();
    const componentList = [];

    for (let i = 0; i < components.length; i++) {
      const component = components[i];

      if (typeof component === "object" && component.id !== undefined) {
        const isVisual = ItemTypeDefinition.isVisualComponent(component.id);

        if (isVisual === this.props.isVisualsMode) {
          componentList.push(component);
        }
      }
    }

    return componentList;
  }

  private async _handleAddComponentClick(e: SyntheticEvent | undefined, data: ButtonProps | undefined) {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      dialogMode: ItemTypeComponentEditorDialog.addComponent,
    });
  }

  setSelectedNewComponentId(id: string) {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      activeComponentId: this.state.activeComponentId,
      dialogMode: this.state.dialogMode,
      selectedNewComponentId: id,
    });
  }

  private _handleDialogCancel() {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      dialogMode: ItemTypeComponentEditorDialog.none,
    });
  }

  private async _handleAddComponentOK() {
    if (this.state.selectedNewComponentId) {
      await this._addComponent(this.state.selectedNewComponentId);

      this.setState({
        loadedFormCount: this.state.loadedFormCount,
        dialogMode: ItemTypeComponentEditorDialog.none,
        activeComponentId: this.state.selectedNewComponentId,
      });
    }
  }

  render() {
    if (this.state === undefined || this.state.loadedFormCount === undefined) {
      this._updateManager();

      return <div className="icose-loading">Loading...</div>;
    }

    if (this.state.dialogMode === ItemTypeComponentEditorDialog.addComponent) {
      return (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="etcse-addComponentOuter"
          onCancel={this._handleDialogCancel}
          onConfirm={this._handleAddComponentOK}
          content={
            <ItemTypeAddComponent
              isVisualsMode={this.props.isVisualsMode}
              onNewComponentSelected={this.setSelectedNewComponentId}
              theme={this.props.theme}
            />
          }
          header={"Add component"}
        />
      );
    } else {
      const components = this.getUsableComponents();
      const componentForms = [];
      const componentList = [];

      let selectedIndex = 0;

      for (let i = 0; i < components.length; i++) {
        const component = components[i];

        if (typeof component === "object" && component.id !== undefined) {
          if (
            !component.id.startsWith("minecraft:") &&
            !component.id.startsWith("tag:") &&
            component.id === this.state?.activeComponentId
          ) {
            componentForms.push(
              <div className="icose-noeditor">(No editor is available for the {component.id} custom component.)</div>
            );

            continue;
          }

          const isVisual = ItemTypeDefinition.isVisualComponent(component.id);

          if (isVisual === this.props.isVisualsMode) {
            const formId = component.id.replace(/:/gi, "_").replace(/\./gi, "_");

            const form = Database.getForm("item_components", formId);

            componentList.push({
              key: component.id,
              content: (
                <div
                  className="icose-componentWrapper"
                  style={{
                    backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
                    borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
                  }}
                >
                  {Utilities.humanifyMinecraftName(component.id)}
                </div>
              ),
            });

            if (component && component.id) {
              if (form !== undefined && component.id === this.state?.activeComponentId) {
                selectedIndex = i;
                componentForms.push(
                  <div className="icose-componentForm">
                    <DataForm
                      displayTitle={true}
                      displayDescription={true}
                      readOnly={false}
                      tag={component.id}
                      project={this.props.project}
                      lookupProvider={this.props.project}
                      carto={this.props.creatorTools}
                      theme={this.props.theme}
                      objectKey={component.id}
                      closeButton={false}
                      definition={form}
                      directObject={component.getData()}
                      onPropertyChanged={(component as ManagedComponent).handlePropertyChanged}
                    ></DataForm>
                  </div>
                );
              } else if (component.id === this.state?.activeComponentId) {
                selectedIndex = i;
                componentForms.push(
                  <div className="icose-noeditor">(No editor is available for the {component.id} type.)</div>
                );
              }
            }
          }
        }
      }

      const toolbarItems: any[] = [
        {
          key: "addComponent",
          onClick: this._handleAddComponentClick,
          title: "Add component",
          icon: (
            <CustomLabel
              isCompact={false}
              text="Add component"
              icon={<FontAwesomeIcon icon={faAdd} className="fa-lg" />}
            />
          ),
        },
      ];

      let title = <></>;

      if (this.props.title) {
        title = <span>{this.props.title}</span>;
      }

      let areaHeight = "calc(100vh - " + String((this.props.heightOffset ? this.props.heightOffset : 0) + 34) + "px)";

      if (this.props.height) {
        areaHeight = this.props.height + "px";
      }

      return (
        <div className="icose-area">
          <div className="icose-componentArea">
            <div className="icose-titleArea">{title}</div>
            <div className="icose-componentToolBarArea">
              <Toolbar aria-label="Component editing toolbar" items={toolbarItems} />
            </div>
          </div>
          <div
            className="icose-componentList"
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
              items={componentList}
              onSelectedIndexChange={this._handleComponentSelected}
            />
          </div>
          <div
            className="icose-componentBin"
            style={{
              minHeight: areaHeight,
              maxHeight: areaHeight,
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background6,
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            }}
          >
            {componentForms}
          </div>
        </div>
      );
    }
  }
}

import { Component, SyntheticEvent } from "react";
import "./EntityTypeComponentSetEditor.css";
import DataForm from "../dataform/DataForm";
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
import IManagedComponent from "../minecraft/IManagedComponent";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import { CustomLabel } from "./Labels";
import { faAdd, faRemove } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import EntityTypeAddComponent from "./EntityTypeAddComponent";
import Carto from "../app/Carto";
import Project from "../app/Project";
import MinecraftButton from "./MinecraftButton";

interface IEntityTypeComponentSetEditorProps {
  componentSetItem: IManagedComponentSetItem;
  entityTypeItem: EntityTypeDefinition;
  isDefault: boolean;
  heightOffset: number;
  project: Project;
  carto: Carto;
  title?: string;
  theme: ThemeInput<any>;
}

interface IEntityTypeComponentSetEditorState {
  loadedFormCount?: number;
  activeComponentId: string | undefined;
  dialogMode: EntityTypeComponentEditorDialog;
  selectedNewComponentId?: string | undefined;
}

enum EntityTypeComponentEditorDialog {
  none,
  addComponent,
}

export default class EntityTypeComponentSetEditor extends Component<
  IEntityTypeComponentSetEditorProps,
  IEntityTypeComponentSetEditorState
> {
  _componentIdsByIndex: { [index: string]: string } = {};

  constructor(props: IEntityTypeComponentSetEditorProps) {
    super(props);

    this._handleComponentSelected = this._handleComponentSelected.bind(this);
    this._deleteThisComponentClick = this._deleteThisComponentClick.bind(this);
    this._handleAddComponentClick = this._handleAddComponentClick.bind(this);
    this._handleDialogCancel = this._handleDialogCancel.bind(this);
    this._handleAddComponentOK = this._handleAddComponentOK.bind(this);
    this.setSelectedNewComponentId = this.setSelectedNewComponentId.bind(this);

    let id = undefined;

    const componentListing = this.getUsableComponents();

    if (componentListing && componentListing.length > 0) {
      id = componentListing[0].id;
    }

    this.state = {
      loadedFormCount: undefined,
      activeComponentId: id,
      dialogMode: EntityTypeComponentEditorDialog.none,
    };
  }

  async _addComponent(id: string, idStack?: string[]) {
    if (Database.uxCatalog === null) {
      return;
    }

    let formName = id;

    if (formName.startsWith("minecraft:")) {
      formName = EntityTypeDefinition.getFormIdFromComponentId(id);
    }

    const form = await Database.ensureFormLoaded("entity", formName);

    if (form !== undefined) {
      const newDataObject = DataFormUtilities.generateDefaultItem(form);

      if (form.requires) {
        if (!idStack) {
          idStack = [];
        }

        if (!idStack.includes(id)) {
          idStack.push(id);
        }

        for (const req of form.requires) {
          if (req.type === "targeting_entity_component") {
            if (
              !this.props.componentSetItem.getComponent("minecraft:behavior.nearest_attackable_target") &&
              !idStack.includes("minecraft:behavior.nearest_attackable_target")
            ) {
              await this._addComponent("minecraft:behavior.nearest_attackable_target", idStack);
            }
          } else if (req.type === "entity_component" && req.id) {
            if (!this.props.componentSetItem.getComponent(req.id) && !idStack.includes(req.id)) {
              await this._addComponent(req.id, idStack);
            }
          }
        }
      }

      this.props.componentSetItem.addComponent(id, newDataObject);
    }
  }

  setSelectedNewComponentId(id: string) {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      activeComponentId: this.state.activeComponentId,
      dialogMode: this.state.dialogMode,
      selectedNewComponentId: id,
    });
  }

  async _updateManager() {
    if (!this.props.componentSetItem) {
      return;
    }

    const components = this.props.componentSetItem.getAllComponents();

    const componentsLoaded: string[] = [];

    for (let i = 0; i < components.length; i++) {
      const component = components[i];

      if (typeof component === "object" && component.id !== undefined) {
        if (!componentsLoaded.includes(component.id)) {
          const formId = EntityTypeDefinition.getFormIdFromComponentId(component.id);
          await Database.ensureFormLoaded("entity", formId);
          componentsLoaded.push(component.id);
        }
      }
    }

    this.setState({
      loadedFormCount: Database.loadedFormCount,
      activeComponentId: this.state.activeComponentId,
      dialogMode: EntityTypeComponentEditorDialog.none,
    });
  }

  _handleComponentSelected(elt: any, event: ListProps | undefined) {
    if (event === undefined || event.selectedIndex === undefined || this.state == null) {
      return;
    }

    const id = this._componentIdsByIndex[event.selectedIndex.toString()];

    if (id) {
      this.setState({
        activeComponentId: id,
      });
    }
  }

  _deleteThisComponentClick(e: SyntheticEvent | undefined, data: any | undefined) {
    if (!data.tag) {
      return;
    }

    const componentId = data.tag;

    if (componentId) {
      this.props.componentSetItem.removeComponent(componentId);

      this.setState({
        loadedFormCount: this.state.loadedFormCount,
        activeComponentId: undefined,
      });
    }
  }

  getUsableComponents() {
    const components = this.props.componentSetItem.getComponents();
    const componentList = [];

    for (let i = 0; i < components.length; i++) {
      const component = components[i];

      if (typeof component === "object" && component.id !== undefined) {
        componentList.push(component);
      }
    }

    return componentList;
  }

  private async _handleAddComponentClick(e: SyntheticEvent | undefined, data: ButtonProps | undefined) {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      dialogMode: EntityTypeComponentEditorDialog.addComponent,
    });
  }

  private _handleDialogCancel() {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      dialogMode: EntityTypeComponentEditorDialog.none,
    });
  }

  private async _handleAddComponentOK() {
    if (this.state.selectedNewComponentId) {
      await this._addComponent(this.state.selectedNewComponentId);

      this.setState({
        loadedFormCount: this.state.loadedFormCount,
        dialogMode: EntityTypeComponentEditorDialog.none,
        activeComponentId: this.state.selectedNewComponentId,
      });
    }
  }

  render() {
    if (this.state === undefined || this.state.loadedFormCount === undefined) {
      this._updateManager();

      return <div className="etcse-loading">Loading...</div>;
    }

    if (this.state.dialogMode === EntityTypeComponentEditorDialog.addComponent) {
      return (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="etcse-addComponentOuter"
          onCancel={this._handleDialogCancel}
          onConfirm={this._handleAddComponentOK}
          content={
            <EntityTypeAddComponent onNewComponentSelected={this.setSelectedNewComponentId} theme={this.props.theme} />
          }
          header={"Add component"}
        />
      );
    } else {
      const components = this.props.componentSetItem.getComponents();
      const componentForms = [];
      const componentList = [];

      let selectedIndex = 0;

      this._componentIdsByIndex = {};

      // sort by category, then priority (for behaviors, mostly), then by alpha
      components.sort((a: IManagedComponent, b: IManagedComponent) => {
        const aCategory = EntityTypeDefinition.getComponentCategory(a.id);
        const bCategory = EntityTypeDefinition.getComponentCategory(b.id);

        if (aCategory !== bCategory) {
          return aCategory - bCategory;
        }

        const aPri = a.getProperty("priority");
        const bPri = b.getProperty("priority");

        if (
          aPri !== undefined &&
          bPri !== undefined &&
          aPri !== bPri &&
          typeof aPri === "number" &&
          typeof bPri === "number"
        ) {
          return aPri - bPri;
        }

        return a.id.localeCompare(b.id);
      });

      let itemsAdded = 0;
      let categoriesDisplayed: boolean[] = [];

      for (let i = 0; i < components.length; i++) {
        const component = components[i];

        if (typeof component === "object" && component.id !== undefined) {
          const formId = component.id.replace(/:/gi, "_").replace(/\./gi, "_");

          const form = Database.getForm("entity", formId);
          const attribCategory = EntityTypeDefinition.getComponentCategory(component.id);

          if (!categoriesDisplayed[attribCategory]) {
            const attribCategoryDescrip = EntityTypeDefinition.getPluralComponentCategoryDescription(attribCategory);
            categoriesDisplayed[attribCategory] = true;
            componentList.push({
              key: "attribCat" + attribCategory,
              selectable: false,
              content: <div>{attribCategoryDescrip}</div>,
            });
            itemsAdded++;
          }

          this._componentIdsByIndex[itemsAdded.toString()] = component.id;
          componentList.push({
            key: component.id,
            content: (
              <MinecraftButton theme={this.props.theme} className="etcse-componentWrapper">
                <div className="etcse-componentWrapperInner">{Utilities.humanifyMinecraftName(component.id)}</div>
              </MinecraftButton>
            ),
          });
          itemsAdded++;

          if (component && component.id) {
            const perComponentToolbarItems = [];

            perComponentToolbarItems.push({
              id: "deleteThisComponent",
              icon: (
                <CustomLabel
                  text={
                    "Delete this " + EntityTypeDefinition.getComponentCategoryDescription(attribCategory).toLowerCase()
                  }
                  icon={<FontAwesomeIcon icon={faRemove} className="fa-lg" />}
                  isCompact={false}
                />
              ),
              key: "delete." + component.id,
              tag: component.id,
              onClick: this._deleteThisComponentClick,
              title: "Delete this component",
            });

            if (component.id === this.state?.activeComponentId) {
              componentForms.push(<Toolbar aria-label="Component editing toolbar" items={perComponentToolbarItems} />);

              if (form !== undefined) {
                selectedIndex = itemsAdded - 1;
                componentForms.push(
                  <div className="etcse-componentForm">
                    <DataForm
                      displayTitle={true}
                      displayDescription={true}
                      readOnly={false}
                      carto={this.props.carto}
                      project={this.props.project}
                      tag={component.id}
                      itemDefinition={this.props.entityTypeItem}
                      theme={this.props.theme}
                      objectKey={component.id}
                      closeButton={false}
                      definition={form}
                      getsetPropertyObject={component}
                    ></DataForm>
                  </div>
                );
              } else {
                selectedIndex = itemsAdded - 1;
                componentForms.push(
                  <div className="etcse-noeditor">(No editor is available for the {component.id} type.)</div>
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

      const areaHeight = "calc(100vh - " + String(this.props.heightOffset + 34) + "px)";

      return (
        <div className="etcse-area">
          <div className="etcse-componentArea">
            <div className="etcse-titleArea">{title}</div>
            <div className="etcse-componentToolBarArea">
              <Toolbar aria-label="Component editing toolbar" items={toolbarItems} />
            </div>
          </div>
          <div
            className="etcse-componentList"
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
            className="etcse-componentBin"
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

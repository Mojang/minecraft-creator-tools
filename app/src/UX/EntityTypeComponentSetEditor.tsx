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
  Dropdown,
  DropdownProps,
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
import CreatorTools from "../app/CreatorTools";
import Project from "../app/Project";
import MinecraftButton from "./MinecraftButton";
import ManagedComponentGroup from "../minecraft/ManagedComponentGroup";
import { ManagedComponent } from "../minecraft/ManagedComponent";

interface IEntityTypeComponentSetEditorProps {
  componentSetItem: IManagedComponentSetItem;
  entityTypeItem: EntityTypeDefinition;
  isDefault: boolean;
  displayNarrow?: boolean;
  heightOffset: number;
  project: Project;
  creatorTools: CreatorTools;
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
  _componentIdsByValue: { [index: string]: string } = {};

  constructor(props: IEntityTypeComponentSetEditorProps) {
    super(props);

    this._handleComponentSelected = this._handleComponentSelected.bind(this);
    this._deleteThisComponentClick = this._deleteThisComponentClick.bind(this);
    this._handleAddComponentClick = this._handleAddComponentClick.bind(this);
    this._handleDialogCancel = this._handleDialogCancel.bind(this);
    this._handleAddComponentOK = this._handleAddComponentOK.bind(this);
    this.setSelectedNewComponentId = this.setSelectedNewComponentId.bind(this);
    this._handleComponentSelectedFromDropdown = this._handleComponentSelectedFromDropdown.bind(this);

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

    let form = Database.getForm("entity", formName);

    if (!form) {
      form = await Database.ensureFormLoaded("entity", formName);
    }

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

  componentDidMount(): void {
    this._updateManager();
  }

  componentDidUpdate(
    prevProps: Readonly<IEntityTypeComponentSetEditorProps>,
    prevState: Readonly<IEntityTypeComponentSetEditorState>,
    snapshot?: any
  ): void {
    if (prevProps.componentSetItem !== this.props.componentSetItem) {
      this._updateManager();
    }
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

          if (!Database.isFormLoaded("entity", formId)) {
            await Database.ensureFormLoaded("entity", formId);
          }

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

  _handleComponentSelectedFromDropdown(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (data !== undefined && data.value !== undefined && typeof data.value === "string") {
      const id = this._componentIdsByValue[data.value];

      if (id) {
        this.setState({
          activeComponentId: id,
        });
      }
    }
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
      return <div className="etcse-loading">Loading...</div>;
    }

    const isNarrow = this.props.displayNarrow;

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
      const componentDropdown = [];

      let selectedIndex = 0;
      let selectedIndexDropdown = 0;
      let itemsAddedDropdown = 0;

      this._componentIdsByIndex = {};
      this._componentIdsByValue = {};
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
          const humanVersion = Utilities.humanifyMinecraftName(component.id);

          this._componentIdsByValue[humanVersion] = component.id;

          componentDropdown.push(humanVersion);
          componentList.push({
            key: "compButtonList" + component.id,
            content: (
              <MinecraftButton theme={this.props.theme} className="etcse-componentWrapper">
                <div className="etcse-componentWrapperInner">{Utilities.humanifyMinecraftName(component.id)}</div>
              </MinecraftButton>
            ),
          });
          itemsAddedDropdown++;
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
              componentForms.push(
                <Toolbar
                  aria-label="Entity type component list actions"
                  key="etcse.toolbar"
                  items={perComponentToolbarItems}
                />
              );

              if (this.state.activeComponentId) {
                if (this.props.isDefault) {
                  const cgs = this.props.entityTypeItem.getComponentGroupsComponentUsedIn(this.state.activeComponentId);

                  if (cgs.length === 1) {
                    componentForms.push(
                      <div className="etcse-note" key="etcse.note">
                        This component is used in the {Utilities.getHumanifiedObjectName(cgs[0].id)} component group.
                        Its settings will be overridden when that group is applied.
                      </div>
                    );
                  } else if (cgs.length >= 2) {
                    let strCgList = "";

                    for (let i = 0; i < cgs.length; i++) {
                      if (i < cgs.length - 1) {
                        strCgList += Utilities.getHumanifiedObjectName(cgs[i].id) + ", ";
                      } else {
                        strCgList += "and " + Utilities.getHumanifiedObjectName(cgs[i].id);
                      }
                    }

                    componentForms.push(
                      <div className="etcse-note" key="etcse.note2">
                        This component is used in the {strCgList} component groups. Its settings will be overridden when
                        one of those groups is applied.
                      </div>
                    );
                  }
                } else {
                  let cgs = this.props.entityTypeItem.getComponentGroupsComponentUsedIn(this.state.activeComponentId);

                  const cgsA: ManagedComponentGroup[] = [];

                  for (const cg of cgs) {
                    if (cg.id !== (this.props.componentSetItem as ManagedComponentGroup).id) {
                      cgsA.push(cg);
                    }
                  }

                  let noteStr = "";

                  if (this.props.entityTypeItem.getComponent(component.id)) {
                    noteStr = "This component is used in the default configuration. ";
                  }

                  if (cgsA.length === 1) {
                    noteStr +=
                      "This component is used in the " +
                      Utilities.humanifyMinecraftName(cgsA[0].id) +
                      " component group. Its' settings will be overridden when that group is applied.";
                  } else if (cgsA.length >= 2) {
                    let strCgList = "";

                    for (let i = 0; i < cgsA.length; i++) {
                      if (i < cgsA.length - 1) {
                        strCgList += cgsA[i].id + ", ";
                      } else {
                        strCgList += "and " + cgsA[i].id;
                      }
                    }

                    noteStr +=
                      "This component is used in " +
                      strCgList +
                      " component groups. Its' settings will be overridden when one of those groups is applied.";
                  }

                  if (noteStr.length > 0) {
                    componentForms.push(<div className="etcse-note">{noteStr}</div>);
                  }
                }
              }

              selectedIndex = itemsAdded - 1;
              selectedIndexDropdown = itemsAddedDropdown - 1;
              if (form !== undefined) {
                componentForms.push(
                  <div className="etcse-componentForm" key={"etcse-form" + component.id}>
                    <DataForm
                      displayTitle={true}
                      displayDescription={true}
                      displayNarrow={this.props.displayNarrow}
                      readOnly={false}
                      carto={this.props.creatorTools}
                      project={this.props.project}
                      lookupProvider={this.props.project}
                      tag={component.id}
                      itemDefinition={this.props.entityTypeItem}
                      theme={this.props.theme}
                      objectKey={component.id}
                      closeButton={false}
                      definition={form}
                      directObject={component.getData()}
                      onPropertyChanged={(component as ManagedComponent).handlePropertyChanged}
                    ></DataForm>
                  </div>
                );
              } else {
                componentForms.push(
                  <div className="etcse-noeditor" key="etcse-noed">
                    (No editor is available for the {component.id} type.)
                  </div>
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

      let areaClass = "etcse-area";

      if (isNarrow) {
        areaClass = "etcse-area-narrow";
      }

      let listElement = <></>;

      if (isNarrow) {
        listElement = (
          <div className="etcse-componentDropdown">
            <Dropdown
              items={componentDropdown}
              value={componentDropdown[selectedIndexDropdown]}
              onChange={this._handleComponentSelectedFromDropdown}
            />
          </div>
        );
      } else {
        listElement = (
          <div
            className="etcse-componentList"
            style={{
              borderColor: isNarrow ? undefined : this.props.theme.siteVariables?.colorScheme.brand.background6,
              backgroundColor: isNarrow ? undefined : this.props.theme.siteVariables?.colorScheme.brand.background3,
              color: isNarrow ? undefined : this.props.theme.siteVariables?.colorScheme.brand.foreground3,
              minHeight: isNarrow ? undefined : areaHeight,
              maxHeight: isNarrow ? undefined : areaHeight,
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
        );
      }

      let componentBinClassName = "etcse-componentBin";

      if (this.props.displayNarrow) {
        componentBinClassName += " etcse-componentBin-narrow";
      }

      return (
        <div className={areaClass}>
          <div className="etcse-componentArea">
            <div className="etcse-titleArea">{title}</div>
            <div className="etcse-componentToolBarArea">
              <Toolbar aria-label="Entity type components actions" items={toolbarItems} />
            </div>
          </div>

          {listElement}
          <div
            className={componentBinClassName}
            style={{
              minHeight: isNarrow ? "100%" : areaHeight,
              maxHeight: isNarrow ? "100%" : areaHeight,
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

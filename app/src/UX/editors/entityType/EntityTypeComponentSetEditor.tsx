import { Component, SyntheticEvent } from "react";
import "./EntityTypeComponentSetEditor.css";
import DataForm from "../../../dataformux/DataForm";
import Database from "../../../minecraft/Database";
import McSelectableList, { McSelectableListItem } from "../../shared/components/inputs/mcSelectableList/McSelectableList";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  SelectChangeEvent,
} from "@mui/material";
import IManagedComponentSetItem from "../../../minecraft/IManagedComponentSetItem";
import DataFormUtilities from "../../../dataform/DataFormUtilities";
import Utilities from "../../../core/Utilities";
import IManagedComponent from "../../../minecraft/IManagedComponent";
import EntityTypeDefinition, {
  EntityTypeComponentCategory,
  EntityTypeComponentExtendedCategory,
} from "../../../minecraft/EntityTypeDefinition";
import { faPlus, faMinus, faChevronRight, faChevronDown, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import EntityTypeAddComponent from "./EntityTypeAddComponent";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import CreatorTools from "../../../app/CreatorTools";
import Project from "../../../app/Project";
import ManagedComponentGroup from "../../../minecraft/ManagedComponentGroup";
import { ManagedComponent } from "../../../minecraft/ManagedComponent";
import ComponentIcon, { getComponentColor } from "../../shared/components/icons/ComponentIcon";
import { getEntityFriendlyName, getFriendlyComponentGroupName } from "../../utils/ComponentFriendlyNames";
import ComponentSlot from "../../shared/components/icons/ComponentSlot";
import { EditorContentPanel, EditorPanelGrid } from "../../appShell/EditorContentPanel";
import { ProjectItemType } from "../../../app/IProjectItemData";
import IProjectTheme from "../../types/IProjectTheme";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import { getComponentDescription } from "../../../minecraft/ComponentDescriptions";

interface IEntityTypeComponentSetEditorProps {
  componentSetItem: IManagedComponentSetItem;
  entityTypeItem: EntityTypeDefinition;
  isDefault: boolean;
  displayNarrow?: boolean;
  heightOffset: number;
  project: Project;
  creatorTools: CreatorTools;
  title?: string;
  theme: IProjectTheme;
  initialComponentId?: string;
}

interface IEntityTypeComponentSetEditorState {
  loadedFormCount?: number;
  activeComponentId: string | undefined;
  dialogMode: EntityTypeComponentEditorDialog;
  selectedNewComponentId?: string | undefined;
  addComponentInitialCategory?: EntityTypeComponentExtendedCategory;
  searchFilter?: string;
  showComponentsHelp?: boolean;
  collapsedCategories?: { [key: number]: boolean };
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
    this._handleAddSlotClick = this._handleAddSlotClick.bind(this);
    this._handleDialogCancel = this._handleDialogCancel.bind(this);
    this._handleAddComponentOK = this._handleAddComponentOK.bind(this);
    this.setSelectedNewComponentId = this.setSelectedNewComponentId.bind(this);
    this._handleComponentSelectedFromDropdown = this._handleComponentSelectedFromDropdown.bind(this);
    this._handleSearchFilterChanged = this._handleSearchFilterChanged.bind(this);
    this._handleSearchFilterClear = this._handleSearchFilterClear.bind(this);
    this._handleDismissHelp = this._handleDismissHelp.bind(this);

    let id = undefined;

    const componentListing = this.getUsableComponents();

    if (this.props.initialComponentId) {
      const hasInitial = componentListing.some((comp) => comp.id === this.props.initialComponentId);
      if (hasInitial) {
        id = this.props.initialComponentId;
      }
    }

    if (id === undefined && componentListing && componentListing.length > 0) {
      id = componentListing[0].id;
    }

    this.state = {
      loadedFormCount: undefined,
      activeComponentId: id,
      dialogMode: EntityTypeComponentEditorDialog.none,
      showComponentsHelp:
        typeof localStorage !== "undefined" &&
        localStorage.getItem("mct_dismiss_entity_components_help") !== "true" &&
        this.props.componentSetItem.getComponents().length < 3,
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
    } else if (this.props.initialComponentId && prevProps.initialComponentId !== this.props.initialComponentId) {
      const usableComponents = this.getUsableComponents();
      const componentExists = usableComponents.some((comp) => comp.id === this.props.initialComponentId);
      if (componentExists) {
        this.setState({
          activeComponentId: this.props.initialComponentId,
        });
      }
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

    // Check if initialComponentId is set and valid for this component set
    // Otherwise check if current activeComponentId still exists
    // If not, select the first available component
    let newActiveComponentId = this.state.activeComponentId;
    const usableComponents = this.getUsableComponents();

    if (this.props.initialComponentId) {
      const hasInitial = usableComponents.some((comp) => comp.id === this.props.initialComponentId);
      if (hasInitial) {
        newActiveComponentId = this.props.initialComponentId;
      }
    }

    if (newActiveComponentId) {
      const componentExists = usableComponents.some((comp) => comp.id === newActiveComponentId);
      if (!componentExists) {
        newActiveComponentId = usableComponents.length > 0 ? usableComponents[0].id : undefined;
      }
    } else if (usableComponents.length > 0) {
      newActiveComponentId = usableComponents[0].id;
    }

    this.setState({
      loadedFormCount: Database.loadedFormCount,
      activeComponentId: newActiveComponentId,
      dialogMode: EntityTypeComponentEditorDialog.none,
    });
  }

  _handleComponentSelectedFromDropdown(event: SelectChangeEvent<string>) {
    const value = event.target.value;
    if (value !== undefined && typeof value === "string") {
      const id = this._componentIdsByValue[value];

      if (id) {
        this.setState({
          activeComponentId: id,
        });
      }
    }
  }

  _handleComponentSelected(index: number, item: McSelectableListItem) {
    if (this.state == null) {
      return;
    }

    const id = this._componentIdsByIndex[index.toString()];

    if (id) {
      this.setState({
        activeComponentId: id,
      });
    }
  }

  _deleteThisComponentClick(e: SyntheticEvent | undefined, data: any | undefined) {
    if (!data?.tag) {
      return;
    }

    const componentId = data.tag;

    if (componentId) {
      const componentName = getEntityFriendlyName(componentId) || Utilities.humanifyMinecraftName(componentId);

      if (
        typeof window !== "undefined" &&
        !window.confirm(`Remove component "${componentName}" (${componentId}) from this entity?`)
      ) {
        return;
      }

      this.props.componentSetItem.removeComponent(componentId);

      this.setState({
        loadedFormCount: this.state.loadedFormCount,
        activeComponentId: undefined,
      });
    }
  }

  _handleDismissHelp() {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mct_dismiss_entity_components_help", "true");
    }
    this.setState({ showComponentsHelp: false });
  }

  getUsableComponents() {
    const components = this.props.componentSetItem.getComponents();
    const componentList = [];

    const filterLower = this.state?.searchFilter?.toLowerCase();

    for (let i = 0; i < components.length; i++) {
      const component = components[i];

      if (typeof component === "object" && component.id !== undefined) {
        if (filterLower) {
          const friendlyName = getEntityFriendlyName(component.id) || Utilities.humanifyMinecraftName(component.id);
          const description = getComponentDescription(component.id) || "";
          if (
            !component.id.toLowerCase().includes(filterLower) &&
            !friendlyName.toLowerCase().includes(filterLower) &&
            !description.toLowerCase().includes(filterLower)
          ) {
            continue;
          }
        }
        componentList.push(component);
      }
    }

    return componentList;
  }

  private _handleSearchFilterChanged(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ searchFilter: e.target.value });
  }

  private _handleSearchFilterClear() {
    this.setState({ searchFilter: undefined });
  }

  private async _handleAddComponentClick() {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      dialogMode: EntityTypeComponentEditorDialog.addComponent,
      addComponentInitialCategory: undefined,
    });
  }

  private _handleAddSlotClick(category: EntityTypeComponentExtendedCategory) {
    this.setState({
      loadedFormCount: this.state.loadedFormCount,
      dialogMode: EntityTypeComponentEditorDialog.addComponent,
      addComponentInitialCategory: category,
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
        <Dialog open={true} key="etcse-addComponentOuter">
          <DialogTitle>Add component</DialogTitle>
          <DialogContent>
            <EntityTypeAddComponent
              onNewComponentSelected={this.setSelectedNewComponentId}
              theme={this.props.theme}
              initialCategory={this.state.addComponentInitialCategory}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={this._handleDialogCancel}>Cancel</Button>
            <Button onClick={this._handleAddComponentOK} variant="contained">
              Add
            </Button>
          </DialogActions>
        </Dialog>
      );
    } else {
      const components = this.props.componentSetItem.getComponents();
      const componentForms = [];
      const componentList: McSelectableListItem[] = [];
      const componentDropdown = [];
      const colors = getThemeColors();

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
      let lastCategory: number | undefined = undefined;

      // Map simple category to extended category for the add component dialog
      const mapToExtendedCategory = (
        simpleCategory: EntityTypeComponentCategory
      ): EntityTypeComponentExtendedCategory => {
        switch (simpleCategory) {
          case EntityTypeComponentCategory.attribute:
            return EntityTypeComponentExtendedCategory.attribute;
          case EntityTypeComponentCategory.complex:
            return EntityTypeComponentExtendedCategory.complex;
          case EntityTypeComponentCategory.behavior:
            return EntityTypeComponentExtendedCategory.behavior;
          case EntityTypeComponentCategory.trigger:
            return EntityTypeComponentExtendedCategory.trigger;
          default:
            return EntityTypeComponentExtendedCategory.complex;
        }
      };

      // Helper to add the "add component" slot for a category
      const addCategoryAddSlot = (category: number) => {
        const extendedCategory = mapToExtendedCategory(category as EntityTypeComponentCategory);
        const categoryLabel = EntityTypeDefinition.getComponentCategoryDescription(
          category as EntityTypeComponentCategory
        );
        const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          this._handleAddSlotClick(extendedCategory);
        };
        componentList.push({
          key: "addSlot" + category,
          content: (
            <div className="etcse-addSlotWrapper">
              <button className="etcse-addSlot" onClick={handleClick} title={`Add ${categoryLabel}`} type="button">
                <span className="etcse-addSlotIcon">+</span>
                <span>Add {categoryLabel}</span>
              </button>
            </div>
          ),
        });
        itemsAdded++;
      };

      const searchFilterLower = this.state.searchFilter?.toLowerCase();

      for (let i = 0; i < components.length; i++) {
        const component = components[i];

        if (typeof component === "object" && component.id !== undefined) {
          // Apply search filter
          if (searchFilterLower) {
            const friendlyName = getEntityFriendlyName(component.id) || Utilities.humanifyMinecraftName(component.id);
            const description = getComponentDescription(component.id) || "";
            if (
              !component.id.toLowerCase().includes(searchFilterLower) &&
              !friendlyName.toLowerCase().includes(searchFilterLower) &&
              !description.toLowerCase().includes(searchFilterLower)
            ) {
              continue;
            }
          }

          const formId = component.id.replace(/:/gi, "_").replace(/\./gi, "_");

          const form = Database.getForm("entity", formId);
          const attribCategory = EntityTypeDefinition.getComponentCategory(component.id);

          // Add "add slot" for previous category if we're switching categories
          if (lastCategory !== undefined && attribCategory !== lastCategory) {
            addCategoryAddSlot(lastCategory);
          }

          if (!categoriesDisplayed[attribCategory]) {
            const attribCategoryDescrip = EntityTypeDefinition.getPluralComponentCategoryDescription(attribCategory);
            categoriesDisplayed[attribCategory] = true;
            const isCategoryCollapsed = this.state.collapsedCategories?.[attribCategory] === true;
            componentList.push({
              key: "attribCat" + attribCategory,
              content: (
                <div
                  className="etcse-slotCategoryHeader etcse-slotCategoryHeaderClickable"
                  style={{
                    color: getThemeColors().foreground3,
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    const collapsed = { ...(this.state.collapsedCategories || {}) };
                    collapsed[attribCategory] = !isCategoryCollapsed;
                    this.setState({ collapsedCategories: collapsed });
                  }}
                  title={isCategoryCollapsed ? "Expand category" : "Collapse category"}
                >
                  <FontAwesomeIcon
                    icon={isCategoryCollapsed ? faChevronRight : faChevronDown}
                    className="etcse-categoryChevron"
                  />
                  {attribCategoryDescrip}
                </div>
              ),
            });
            itemsAdded++;
          }

          // Skip components in collapsed categories
          if (this.state.collapsedCategories?.[attribCategory] === true) {
            lastCategory = attribCategory;
            continue;
          }

          lastCategory = attribCategory;

          this._componentIdsByIndex[itemsAdded.toString()] = component.id;
          const humanVersion = getEntityFriendlyName(component.id) || Utilities.humanifyMinecraftName(component.id);

          this._componentIdsByValue[humanVersion] = component.id;

          componentDropdown.push(humanVersion);

          // Get the component color for the slot styling
          const slotColor = getComponentColor(component.id);
          const isSelected = component.id === this.state?.activeComponentId;

          componentList.push({
            key: "compButtonList" + component.id,
            content: (
              <ComponentSlot
                componentId={component.id}
                componentData={component.getData()}
                isSelected={isSelected}
                title={humanVersion}
              />
            ),
          });
          itemsAddedDropdown++;
          itemsAdded++;

          if (component && component.id) {
            if (component.id === this.state?.activeComponentId) {
              // Add component header with large icon FIRST
              const activeColor = getComponentColor(component.id);
              const attribCategoryDesc = EntityTypeDefinition.getComponentCategoryDescription(attribCategory);
              componentForms.push(
                <div
                  className="etcse-componentHeader"
                  key={"etcse-header" + component.id}
                  style={
                    {
                      "--header-icon-color": activeColor,
                    } as React.CSSProperties
                  }
                >
                  <div className="etcse-componentHeaderIcon">
                    <ComponentIcon componentId={component.id} size={32} />
                  </div>
                  <div className="etcse-componentHeaderText">
                    <div className="etcse-componentHeaderTitle" title={getComponentDescription(component.id)}>
                      {getEntityFriendlyName(component.id) || Utilities.humanifyMinecraftName(component.id)}
                    </div>
                    <div className="etcse-componentHeaderSubtitle">{attribCategoryDesc}</div>
                    {getComponentDescription(component.id) && (
                      <div className="etcse-componentHeaderDescription">{getComponentDescription(component.id)}</div>
                    )}
                  </div>
                  <IconButton
                    size="small"
                    className="etcse-componentHeaderDelete"
                    title={
                      "Delete this " +
                      EntityTypeDefinition.getComponentCategoryDescription(attribCategory).toLowerCase()
                    }
                    aria-label={
                      "Delete this " +
                      EntityTypeDefinition.getComponentCategoryDescription(attribCategory).toLowerCase()
                    }
                    onClick={(e) => this._deleteThisComponentClick(e, { tag: component.id })}
                    sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}
                  >
                    <FontAwesomeIcon icon={faMinus} />
                  </IconButton>
                </div>
              );

              // Add advisory notes if applicable

              if (this.state.activeComponentId) {
                if (this.props.isDefault) {
                  const cgs = this.props.entityTypeItem.getComponentGroupsComponentUsedIn(this.state.activeComponentId);

                  if (cgs.length === 1) {
                    componentForms.push(
                      <div className="etcse-note" key="etcse.note">
                        This component is used in the {getFriendlyComponentGroupName(cgs[0].id)} state. Its settings
                        will be overridden when that group is applied.
                      </div>
                    );
                  } else if (cgs.length >= 2) {
                    let strCgList = "";

                    for (let i = 0; i < cgs.length; i++) {
                      if (i < cgs.length - 1) {
                        strCgList += getFriendlyComponentGroupName(cgs[i].id) + ", ";
                      } else {
                        strCgList += "and " + getFriendlyComponentGroupName(cgs[i].id);
                      }
                    }

                    componentForms.push(
                      <div className="etcse-note" key="etcse.note2">
                        This component is used in the {strCgList} states. Its settings will be overridden when one of
                        those groups is applied.
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
                      getFriendlyComponentGroupName(cgsA[0].id) +
                      " state. Its settings will be overridden when that state is active.";
                  } else if (cgsA.length >= 2) {
                    let strCgList = "";

                    for (let i = 0; i < cgsA.length; i++) {
                      if (i < cgsA.length - 1) {
                        strCgList += getFriendlyComponentGroupName(cgsA[i].id) + ", ";
                      } else {
                        strCgList += "and " + getFriendlyComponentGroupName(cgsA[i].id);
                      }
                    }

                    noteStr +=
                      "This component is used in " +
                      strCgList +
                      " states. Its settings will be overridden when one of those states is active.";
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
                      displayTitle={false}
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
                      formCategory="entity"
                      summarizerNoun="mob"
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

      // Add the final "add slot" for the last category
      if (lastCategory !== undefined) {
        addCategoryAddSlot(lastCategory);
      }

      let title = <></>;

      if (this.props.title) {
        title = <span>{this.props.title}</span>;
      }

      const areaHeight = "calc(100vh - " + String(this.props.heightOffset + 34) + "px)";

      const themeClass =
        CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? " etcse-area-dark" : " etcse-area-light";
      let areaClass = "etcse-area" + themeClass;

      if (isNarrow) {
        areaClass = "etcse-area-narrow" + themeClass;
      }

      let componentBinClassName = "etcse-componentBin";

      if (this.props.displayNarrow) {
        componentBinClassName += " etcse-componentBin-narrow";
      }

      // Build breadcrumb navigation
      const entityName = this.props.entityTypeItem.shortId
        ? Utilities.humanifyMinecraftName(this.props.entityTypeItem.shortId)
        : Utilities.humanifyMinecraftName(this.props.entityTypeItem.id || "Mob");
      const groupName = this.props.isDefault
        ? "Default (base state)"
        : getFriendlyComponentGroupName(this.props.title || "Group");
      const componentName = this.state.activeComponentId
        ? Utilities.humanifyMinecraftName(this.state.activeComponentId)
        : null;

      const breadcrumb = (
        <div
          className="etcse-breadcrumb"
          style={{
            borderBottomColor: getThemeColors().background4,
          }}
        >
          <span className="etcse-breadcrumbItem">{entityName}</span>
          <FontAwesomeIcon icon={faChevronRight} className="etcse-breadcrumbSeparator" />
          <span className="etcse-breadcrumbItem">{groupName}</span>
          {componentName && (
            <>
              <FontAwesomeIcon icon={faChevronRight} className="etcse-breadcrumbSeparator" />
              <span className="etcse-breadcrumbItem etcse-breadcrumbCurrent">{componentName}</span>
            </>
          )}
        </div>
      );

      return (
        <div className={areaClass}>
          <div className="etcse-componentArea">
            <div className="etcse-titleArea">{title}</div>
            <div className="etcse-componentToolBarArea">
              <button className="eat-mcBtn" title="Add component" onClick={this._handleAddComponentClick}>
                <FontAwesomeIcon icon={faPlus} /> Add component
              </button>
              {components.length > 0 && (
                <div className="etcse-searchFilterWrapper">
                  <input
                    className="etcse-searchFilter"
                    type="text"
                    placeholder="Filter components..."
                    value={this.state.searchFilter || ""}
                    onChange={this._handleSearchFilterChanged}
                    aria-label="Filter components"
                  />
                  {this.state.searchFilter && (
                    <button
                      className="etcse-searchFilterClear"
                      onClick={this._handleSearchFilterClear}
                      title="Clear filter"
                      type="button"
                      aria-label="Clear filter"
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {this.state.showComponentsHelp && (
            <div className="etcse-helpHint" role="note" aria-label="How components, attributes, and groups work">
              <button
                className="etcse-helpHintDismiss"
                onClick={this._handleDismissHelp}
                title="Dismiss help"
                aria-label="Dismiss help"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
              <div className="etcse-helpHintTitle">New here? Start with these building blocks.</div>
              <div className="etcse-helpHintBody">
                <strong>Behaviors (components)</strong> are reusable actions (like attack, movement, or AI goals).
              </div>
              <div className="etcse-helpHintBody">
                <strong>Stats (attributes)</strong> are number-based values (like health, speed, and damage).
              </div>
              <div className="etcse-helpHintBody">
                <strong>Groups</strong> are named bundles you can turn on for different states of your mob.
              </div>
              <div className="etcse-helpHintNext">
                Next: select a component on the left, edit values on the right, then add more with Add component.
                Changes save automatically as you edit.
              </div>
            </div>
          )}

          <EditorPanelGrid
            theme={this.props.theme}
            itemType={ProjectItemType.entityTypeBehavior}
            columns={isNarrow ? "1fr" : "280px 1fr"}
            className="etcse-panelGrid"
          >
            {isNarrow ? (
              <div className="etcse-componentDropdown">
                <FormControl size="small" fullWidth>
                  <Select
                    value={componentDropdown[selectedIndexDropdown] || ""}
                    onChange={this._handleComponentSelectedFromDropdown}
                  >
                    {componentDropdown.length === 0 ? (
                      <MenuItem disabled>No components available</MenuItem>
                    ) : (
                      componentDropdown.map((item) => (
                        <MenuItem key={item} value={item}>
                          {item}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </div>
            ) : (
              <EditorContentPanel
                variant="inset"
                theme={this.props.theme}
                itemType={ProjectItemType.entityTypeBehavior}
                header="Components"
                compactHeader
                className="etcse-componentListPanel"
                style={{
                  minHeight: areaHeight,
                  maxHeight: areaHeight,
                }}
              >
                <McSelectableList
                  aria-label="List of components"
                  selectedIndex={selectedIndex}
                  items={componentList}
                  onSelectedIndexChange={this._handleComponentSelected}
                />
              </EditorContentPanel>
            )}
            <EditorContentPanel
              variant="raised"
              theme={this.props.theme}
              itemType={ProjectItemType.entityTypeBehavior}
              className="etcse-componentBinPanel"
              style={{
                minHeight: isNarrow ? "100%" : areaHeight,
                maxHeight: isNarrow ? "100%" : areaHeight,
              }}
            >
              {breadcrumb}
              {componentForms}
            </EditorContentPanel>
          </EditorPanelGrid>
        </div>
      );
    }
  }
}

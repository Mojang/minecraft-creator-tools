import { Component, SyntheticEvent } from "react";
import "./ItemTypeComponentSetEditor.css";
import DataForm, { IDataFormProps } from "../../../dataformux/DataForm";
import Database from "../../../minecraft/Database";
import McSelectableList, { McSelectableListItem } from "../../shared/components/inputs/mcSelectableList/McSelectableList";
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Stack } from "@mui/material";
import IManagedComponentSetItem from "../../../minecraft/IManagedComponentSetItem";
import IManagedComponent from "../../../minecraft/IManagedComponent";
import DataFormUtilities from "../../../dataform/DataFormUtilities";
import Utilities from "../../../core/Utilities";
import { CustomLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faMinus } from "@fortawesome/free-solid-svg-icons";
import ItemTypeAddComponent from "./ItemTypeAddComponent";
import EntityTypeDefinition from "../../../minecraft/EntityTypeDefinition";
import telemetry from "../../../analytics/Telemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";
import CreatorTools from "../../../app/CreatorTools";
import Project from "../../../app/Project";
import ItemTypeDefinition from "../../../minecraft/ItemTypeDefinition";
import { ManagedComponent } from "../../../minecraft/ManagedComponent";
import ItemComponentSlot from "./ItemComponentSlot";
import ItemComponentIcon, { getItemComponentColor } from "./ItemComponentIcon";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import { getComponentDescription } from "../../../minecraft/ComponentDescriptions";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";

export enum ItemComponentCategory {
  combat = 0,
  tools = 1,
  food = 2,
  appearance = 3,
  interaction = 4,
  storage = 5,
  enchantment = 6,
  misc = 7,
}

// Get category for an item component
function getItemComponentCategory(componentId: string): ItemComponentCategory {
  const id = componentId.toLowerCase();

  // Combat related
  if (
    id.includes("damage") ||
    id.includes("projectile") ||
    id.includes("weapon") ||
    id.includes("throwable") ||
    id.includes("shooter") ||
    id.includes("knockback")
  ) {
    return ItemComponentCategory.combat;
  }

  // Tools related
  if (
    id.includes("digger") ||
    id.includes("durability") ||
    id.includes("repairable") ||
    id.includes("mining_speed") ||
    id.includes("tool")
  ) {
    return ItemComponentCategory.tools;
  }

  // Food related
  if (
    id.includes("food") ||
    id.includes("saturation") ||
    id.includes("nutrition") ||
    id.includes("consumable") ||
    id.includes("use_duration")
  ) {
    return ItemComponentCategory.food;
  }

  // Appearance related
  if (
    id.includes("icon") ||
    id.includes("glint") ||
    id.includes("wearable") ||
    id.includes("hand_equipped") ||
    id.includes("render") ||
    id.includes("display") ||
    id.includes("hover_text") ||
    id.includes("rarity") ||
    id.includes("dyeable")
  ) {
    return ItemComponentCategory.appearance;
  }

  // Interaction related
  if (
    id.includes("entity_placer") ||
    id.includes("block_placer") ||
    id.includes("on_use") ||
    id.includes("interact") ||
    id.includes("seed") ||
    id.includes("bucket") ||
    id.includes("record")
  ) {
    return ItemComponentCategory.interaction;
  }

  // Storage related
  if (id.includes("max_stack") || id.includes("bundle") || id.includes("storage") || id.includes("container")) {
    return ItemComponentCategory.storage;
  }

  // Enchantment related
  if (id.includes("enchant") || id.includes("magic")) {
    return ItemComponentCategory.enchantment;
  }

  return ItemComponentCategory.misc;
}

// Get category description
function getItemComponentCategoryDescription(category: ItemComponentCategory): string {
  switch (category) {
    case ItemComponentCategory.combat:
      return "Combat";
    case ItemComponentCategory.tools:
      return "Tools";
    case ItemComponentCategory.food:
      return "Food";
    case ItemComponentCategory.appearance:
      return "Appearance";
    case ItemComponentCategory.interaction:
      return "Interaction";
    case ItemComponentCategory.storage:
      return "Storage";
    case ItemComponentCategory.enchantment:
      return "Enchantment";
    case ItemComponentCategory.misc:
      return "Other";
    default:
      return "Other";
  }
}

interface IItemTypeComponentSetEditorProps {
  itemTypeDefinition: IManagedComponentSetItem;
  isVisualsMode: boolean;
  isDefault: boolean;
  project: Project;
  creatorTools: CreatorTools;
  height?: number;
  heightOffset?: number;
  title?: string;
  theme: IProjectTheme;
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
  private _componentIdsByIndex: { [index: string]: string } = {};

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
    this._deleteThisComponentClick = this._deleteThisComponentClick.bind(this);

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

  _handleComponentSelected(index: number, item: McSelectableListItem) {
    if (this.state == null) {
      return;
    }

    const id = this._componentIdsByIndex[index.toString()];

    if (id) {
      telemetry.trackEvent({
        name: TelemetryEvents.ITEM_TYPE_EDITOR_COMPONENT_CLICKED,
        properties: {
          [TelemetryProperties.COMPONENT_ID]: id,
        },
      });

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
      this.props.itemTypeDefinition.removeComponent(componentId);

      // Select a different component after deletion
      const components = this.getUsableComponents();
      let newActiveId = undefined;
      if (components.length > 0) {
        newActiveId = components[0].id;
      }

      this.setState({
        activeComponentId: newActiveId,
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

  private async _handleAddComponentClick() {
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
        <Dialog open={true} className="icose-addComponentDialog" key="icose-addComponentOuter">
          <DialogTitle>Add item type component</DialogTitle>
          <DialogContent>
            <ItemTypeAddComponent
              isVisualsMode={this.props.isVisualsMode}
              onNewComponentSelected={this.setSelectedNewComponentId}
              theme={this.props.theme}
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
      const components = this.getUsableComponents();
      const componentForms = [];
      const componentList: McSelectableListItem[] = [];
      const colors = getThemeColors();

      let selectedIndex = 0;
      let itemsAdded = 0;

      // Reset component IDs by index for selection
      this._componentIdsByIndex = {};

      // Filter components by visual mode (already done by getUsableComponents)
      const filteredComponents: IManagedComponent[] = components;

      // Sort by category, then alphabetically
      filteredComponents.sort((a: IManagedComponent, b: IManagedComponent) => {
        const aCategory = getItemComponentCategory(a.id);
        const bCategory = getItemComponentCategory(b.id);

        if (aCategory !== bCategory) {
          return aCategory - bCategory;
        }

        return a.id.localeCompare(b.id);
      });

      let categoriesDisplayed: boolean[] = [];

      for (let i = 0; i < filteredComponents.length; i++) {
        const component = filteredComponents[i];
        const formId = component.id.replace(/:/gi, "_").replace(/\./gi, "_");
        const attribCategory = getItemComponentCategory(component.id);

        // Add category header if this is a new category
        if (!categoriesDisplayed[attribCategory]) {
          const attribCategoryDescrip = getItemComponentCategoryDescription(attribCategory);
          categoriesDisplayed[attribCategory] = true;
          componentList.push({
            key: "attribCat" + attribCategory,
            content: (
              <div
                className="etcse-slotCategoryHeader"
                style={{
                  color: colors.foreground3,
                }}
              >
                {attribCategoryDescrip}
              </div>
            ),
          });
          itemsAdded++;
        }

        this._componentIdsByIndex[itemsAdded.toString()] = component.id;
        const isSelected = component.id === this.state?.activeComponentId;

        componentList.push({
          key: "compButtonList" + component.id,
          content: (
            <ItemComponentSlot
              componentId={component.id}
              componentData={component.getData()}
              isSelected={isSelected}
              title={Utilities.humanifyMinecraftName(component.id)}
            />
          ),
        });
        itemsAdded++;

        if (isSelected) {
          selectedIndex = itemsAdded - 1;

          // Add component header with large icon
          const activeColor = getItemComponentColor(component.id);
          const attribCategoryDesc = getItemComponentCategoryDescription(attribCategory);

          // Add component header with large icon FIRST
          componentForms.push(
            <div
              className="icose-componentHeader"
              key={"icose-header" + component.id}
              style={
                {
                  "--header-icon-color": activeColor,
                } as React.CSSProperties
              }
            >
              <div className="icose-componentHeaderIcon">
                <ItemComponentIcon componentId={component.id} size={32} />
              </div>
              <div className="icose-componentHeaderText">
                <div className="icose-componentHeaderTitle" title={getComponentDescription(component.id)}>
                  {Utilities.humanifyMinecraftName(component.id)}
                </div>
                <div className="icose-componentHeaderSubtitle">{attribCategoryDesc}</div>
              </div>
            </div>
          );

          // Add toolbar with delete button
          componentForms.push(
            <Stack
              direction="row"
              spacing={1}
              aria-label="Item type component actions"
              key={"icose-toolbar" + component.id}
            >
              <IconButton
                size="small"
                title="Delete this component"
                aria-label="Delete this component"
                onClick={(e) => this._deleteThisComponentClick(e, { tag: component.id })}
              >
                <CustomLabel
                  text={"Delete this component"}
                  icon={<FontAwesomeIcon icon={faMinus} className="fa-lg" />}
                  isCompact={false}
                />
              </IconButton>
            </Stack>
          );

          if (!component.id.startsWith("minecraft:") && !component.id.startsWith("tag:")) {
            componentForms.push(
              <div className="icose-noeditor" key={"noeditor" + component.id}>
                (No editor is available for the {component.id} custom component.)
              </div>
            );
          } else if (component.id.startsWith("tag:")) {
            componentForms.push(
              <div className="icose-noeditor" key={"noeditor" + component.id}>
                (No editor is available for the {component.id} custom tag.)
              </div>
            );
          } else {
            const form = Database.getForm("item_components", formId);
            const componentData = component.getData();

            if (form !== undefined && form.fields !== undefined && componentData !== undefined) {
              componentForms.push(
                <div className="icose-componentForm" key={"form" + component.id}>
                  <DataForm
                    displayTitle={false}
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
                    directObject={componentData}
                    onPropertyChanged={(component as ManagedComponent).handlePropertyChanged}
                  ></DataForm>
                </div>
              );
            } else {
              componentForms.push(
                <div className="icose-noeditor" key={"noeditor" + component.id}>
                  (No editor is available for the {component.id} type.)
                </div>
              );
            }
          }
        }
      }

      let areaHeight = "calc(100vh - " + String((this.props.heightOffset ? this.props.heightOffset : 0) + 34) + "px)";

      if (this.props.height) {
        areaHeight = this.props.height + "px";
      }

      const themeClass =
        CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? " etcse-area-dark" : " etcse-area-light";

      return (
        <div className={"icose-area" + themeClass}>
          <div
            className="icose-componentList"
            style={{
              borderColor: colors.background6,
              color: colors.foreground3,
              minHeight: areaHeight,
              maxHeight: areaHeight,
            }}
          >
            <div className="etcse-slotGrid">
              {componentList.length === 0 ? (
                <div style={{ padding: "16px", opacity: 0.7, fontStyle: "italic" }}>
                  No components added yet. Components define what your item does — like how much damage a sword deals or
                  how much hunger food restores. Click the + button to add one.
                </div>
              ) : (
                <McSelectableList
                  aria-label="List of components"
                  selectedIndex={selectedIndex}
                  items={componentList}
                  onSelectedIndexChange={this._handleComponentSelected}
                />
              )}
            </div>
          </div>
          <div
            className="icose-componentBin"
            style={{
              minHeight: areaHeight,
              maxHeight: areaHeight,
              borderColor: colors.background6,
              backgroundColor: colors.background2,
              color: colors.foreground2,
            }}
          >
            <div className="icose-binToolbar">
              <Button
                size="small"
                title="Add component"
                onClick={() => this._handleAddComponentClick()}
                startIcon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
              >
                Add component
              </Button>
            </div>
            {componentForms}
          </div>
        </div>
      );
    }
  }
}

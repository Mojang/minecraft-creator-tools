import { Component, SyntheticEvent } from "react";
import "./BlockTypeComponentSetEditor.css";
import DataForm, { IDataFormProps } from "../../../dataformux/DataForm";
import Database from "../../../minecraft/Database";
import McSelectableList, { McSelectableListItem } from "../../shared/components/inputs/mcSelectableList/McSelectableList";
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Stack } from "@mui/material";
import IManagedComponentSetItem from "../../../minecraft/IManagedComponentSetItem";
import DataFormUtilities from "../../../dataform/DataFormUtilities";
import Utilities from "../../../core/Utilities";
import { CustomLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faMinus } from "@fortawesome/free-solid-svg-icons";
import BlockTypeAddComponent from "./BlockTypeAddComponent";
import EntityTypeDefinition from "../../../minecraft/EntityTypeDefinition";
import Project from "../../../app/Project";
import { LazyMolangEditor } from "../../appShell/LazyComponents";
import CreatorTools from "../../../app/CreatorTools";
import ManagedPermutation from "../../../minecraft/ManagedPermutation";
import { IBlockResource } from "../../../minecraft/IBlocksCatalog";
import BlockTypeDefinition from "../../../minecraft/BlockTypeDefinition";
import { ProjectItemType } from "../../../app/IProjectItemData";
import BlocksCatalogDefinition from "../../../minecraft/BlocksCatalogDefinition";
import IFormDefinition from "../../../dataform/IFormDefinition";
import { ManagedComponent } from "../../../minecraft/ManagedComponent";
import BlockComponentSlot from "./BlockComponentSlot";
import BlockComponentIcon, { getBlockComponentColor } from "./BlockComponentIcon";
import { getBlockFriendlyName } from "../../utils/ComponentFriendlyNames";
import IManagedComponent from "../../../minecraft/IManagedComponent";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import { getComponentDescription } from "../../../minecraft/ComponentDescriptions";

export enum BlockComponentCategory {
  geometry = 0,
  material = 1,
  light = 2,
  physics = 3,
  destruction = 4,
  interaction = 5,
  redstone = 6,
  misc = 7,
}

// Get category for a block component
function getBlockComponentCategory(componentId: string): BlockComponentCategory {
  const id = componentId.toLowerCase();

  if (id.includes("geometry") || id.includes("transformation") || id.includes("unit_cube")) {
    return BlockComponentCategory.geometry;
  }

  if (
    id.includes("material") ||
    id.includes("map_color") ||
    id.includes("bone_visibility") ||
    id.includes("item_visual") ||
    id.includes("embedded")
  ) {
    return BlockComponentCategory.material;
  }

  if (id.includes("light_emission") || id.includes("light_dampening")) {
    return BlockComponentCategory.light;
  }

  if (id.includes("collision") || id.includes("selection") || id.includes("friction") || id.includes("breathability")) {
    return BlockComponentCategory.physics;
  }

  if (
    id.includes("destructible") ||
    id.includes("flammable") ||
    id.includes("explosion") ||
    id.includes("mining") ||
    id.includes("destruction") ||
    id.includes("loot")
  ) {
    return BlockComponentCategory.destruction;
  }

  if (
    id.includes("crafting") ||
    id.includes("placement") ||
    id.includes("display_name") ||
    id.includes("flower") ||
    id.includes("entity_fall")
  ) {
    return BlockComponentCategory.interaction;
  }

  if (id.includes("redstone") || id.includes("tick") || id.includes("queued") || id.includes("random_ticking")) {
    return BlockComponentCategory.redstone;
  }

  return BlockComponentCategory.misc;
}

// Get category description
function getBlockComponentCategoryDescription(category: BlockComponentCategory): string {
  switch (category) {
    case BlockComponentCategory.geometry:
      return "Geometry";
    case BlockComponentCategory.material:
      return "Materials";
    case BlockComponentCategory.light:
      return "Lighting";
    case BlockComponentCategory.physics:
      return "Physics";
    case BlockComponentCategory.destruction:
      return "Destruction";
    case BlockComponentCategory.interaction:
      return "Interaction";
    case BlockComponentCategory.redstone:
      return "Redstone";
    case BlockComponentCategory.misc:
      return "Other";
  }
}

interface IBlockTypeComponentSetEditorProps {
  componentSet: IManagedComponentSetItem;
  isVisualsMode: boolean;
  permutation?: ManagedPermutation;
  isDefault: boolean;
  readOnly: boolean;
  project: Project;
  creatorTools: CreatorTools;
  heightOffset: number;
  title?: string;
  theme: IProjectTheme;
}

interface IBlockTypeComponentSetEditorState {
  loadedFormCount?: number;
  activeComponentId: string | undefined;
  blockResource?: IBlockResource;
  blockResourceForm?: IFormDefinition;
  dialogMode: BlockTypeComponentEditorDialog;
  selectedNewComponentId: string | undefined;
}

export enum BlockTypeComponentEditorDialog {
  none = 0,
  addComponent = 1,
}

export default class BlockTypeComponentSetEditor extends Component<
  IBlockTypeComponentSetEditorProps,
  IBlockTypeComponentSetEditorState
> {
  _componentIdsByIndex: { [index: string]: string } = {};
  constructor(props: IBlockTypeComponentSetEditorProps) {
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
    this._onUpdatePreferredTextSize = this._onUpdatePreferredTextSize.bind(this);
    this._updateCondition = this._updateCondition.bind(this);
    this._loadBlockResource = this._loadBlockResource.bind(this);
    this._deleteThisComponentClick = this._deleteThisComponentClick.bind(this);

    let id = undefined;

    const componentListing = this.getUsableComponents();

    if (componentListing && componentListing.length > 0) {
      id = componentListing[0].id;
    }

    this.state = {
      loadedFormCount: undefined,
      activeComponentId: id,
      dialogMode: BlockTypeComponentEditorDialog.none,
      selectedNewComponentId: undefined,
    };
  }

  componentDidMount(): void {
    this._loadBlockResource();
    this._updateManager();
  }

  componentDidUpdate(prevProps: IBlockTypeComponentSetEditorProps, prevState: IBlockTypeComponentSetEditorState) {
    if (prevProps.componentSet !== this.props.componentSet) {
      let id = undefined;

      const componentListing = this.getUsableComponents();

      if (componentListing && componentListing.length > 0) {
        id = componentListing[0].id;
      }

      this.setState({
        loadedFormCount: Database.loadedFormCount,
        activeComponentId: id,
      });

      this._loadBlockResource();
    }
  }

  async _loadBlockResource() {
    if (this.props.componentSet instanceof BlockTypeDefinition && this.props.componentSet.id) {
      const itemsCopy = this.props.project.getItemsCopy();

      for (const projectItem of itemsCopy) {
        if (projectItem.itemType === ProjectItemType.blocksCatalogResourceJson) {
          if (!projectItem.isContentLoaded) {
            await projectItem.loadContent();
          }

          if (projectItem.primaryFile) {
            const blocksCatalog = await BlocksCatalogDefinition.ensureOnFile(projectItem.primaryFile);

            if (blocksCatalog) {
              const blockResource = blocksCatalog.getCatalogResource(this.props.componentSet.id);

              if (blockResource) {
                const blockResourceForm = await Database.ensureFormLoaded(
                  "block",
                  "block_resource_" + (this.props.isVisualsMode ? "visual" : "nonvisual")
                );

                this.setState({
                  loadedFormCount: this.state.loadedFormCount,
                  activeComponentId: this.state.activeComponentId,
                  dialogMode: this.state.dialogMode,
                  selectedNewComponentId: this.state.selectedNewComponentId,
                  blockResource: blockResource,
                  blockResourceForm: blockResourceForm,
                });

                return;
              }
            }
          }
        }
      }

      // we couldn't find an existing definition, so create a new one
      for (const projectItem of itemsCopy) {
        if (projectItem.itemType === ProjectItemType.blocksCatalogResourceJson) {
          if (!projectItem.isContentLoaded) {
            await projectItem.loadContent();
          }

          if (projectItem.primaryFile) {
            const blocksCatalog = await BlocksCatalogDefinition.ensureOnFile(projectItem.primaryFile);

            if (blocksCatalog) {
              const blockResource = blocksCatalog.ensureCatalogResource(this.props.componentSet.id);

              if (blockResource) {
                const blockResourceForm = await Database.ensureFormLoaded(
                  "block",
                  "block_resource_" + (this.props.isVisualsMode ? "visual" : "nonvisual")
                );

                this.setState({
                  loadedFormCount: this.state.loadedFormCount,
                  activeComponentId: this.state.activeComponentId,
                  dialogMode: this.state.dialogMode,
                  selectedNewComponentId: this.state.selectedNewComponentId,
                  blockResource: blockResource,
                  blockResourceForm: blockResourceForm,
                });

                return;
              }
            }
          }
        }
      }
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

      let form = Database.getForm("block", formName);

      if (!form) {
        form = await Database.ensureFormLoaded("block", formName);
      }

      if (form !== undefined) {
        const newDataObject = DataFormUtilities.generateDefaultItem(form);

        this.props.componentSet.addComponent(id, newDataObject);
      }
    }
  }

  getFormIdFromComponentId(componentId: string) {
    return componentId.replace(/:/gi, "_").replace(/\./gi, "_");
  }

  async _updateManager() {
    if (!this.props.componentSet) {
      return;
    }

    const components = this.props.componentSet.getComponents();

    for (let i = 0; i < components.length; i++) {
      const component = components[i];

      if (typeof component === "object" && component.id !== undefined) {
        const formId = this.getFormIdFromComponentId(component.id);

        // Check component.id (not formId) since formId has colons replaced with underscores
        if (component.id.startsWith("minecraft:")) {
          if (!Database.isFormLoaded("block", formId)) {
            await Database.ensureFormLoaded("block", formId);
          }
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
      this.props.componentSet.removeComponent(componentId);
      this.forceUpdate();
    }
  }

  _deleteThisComponentClick(e: SyntheticEvent | undefined, data: any | undefined) {
    if (!data.tag) {
      return;
    }

    const componentId = data.tag;

    if (componentId) {
      this.props.componentSet.removeComponent(componentId);

      this.setState({
        loadedFormCount: this.state.loadedFormCount,
        activeComponentId: undefined,
      });
    }
  }

  getUsableComponents() {
    const components = this.props.componentSet.getComponents();
    const componentList = [];

    for (let i = 0; i < components.length; i++) {
      const component = components[i];

      if (typeof component === "object" && component.id !== undefined) {
        const isVisual = this.isVisualComponent(component.id);

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
      dialogMode: BlockTypeComponentEditorDialog.addComponent,
    });
  }

  isVisualComponent(value: string) {
    if (
      value === "minecraft:geometry" ||
      value === "minecraft:material_instances" ||
      value === "minecraft:map_color" ||
      value === "minecraft:bone_visibility" ||
      value === "minecraft:transformation" ||
      value === "minecraft:item_visual" ||
      value === "minecraft:unit_cube"
    ) {
      return true;
    }

    return false;
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
      dialogMode: BlockTypeComponentEditorDialog.none,
    });
  }

  private async _handleAddComponentOK() {
    if (this.state.selectedNewComponentId) {
      await this._addComponent(this.state.selectedNewComponentId);

      this.setState({
        loadedFormCount: this.state.loadedFormCount,
        dialogMode: BlockTypeComponentEditorDialog.none,
        activeComponentId: this.state.selectedNewComponentId,
      });
    }
  }

  _onUpdatePreferredTextSize(newTextSize: number) {
    this.props.creatorTools.preferredTextSize = newTextSize;
  }

  _updateCondition(permutationContent: string) {
    if (this.props.permutation) {
      this.props.permutation!.condition = permutationContent;
    }
  }

  render() {
    let permutationEditor = <></>;
    if (this.state === undefined || this.state.loadedFormCount === undefined) {
      return <div className="bcose-loading">Loading...</div>;
    }

    if (this.props.permutation) {
      permutationEditor = (
        <LazyMolangEditor
          creatorTools={this.props.creatorTools}
          readOnly={this.props.readOnly}
          initialContent={this.props.permutation.condition}
          onMolangTextChanged={this._updateCondition}
          onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
          preferredTextSize={this.props.creatorTools.preferredTextSize}
          project={this.props.project}
          theme={this.props.theme}
        />
      );
    }

    if (this.state.dialogMode === BlockTypeComponentEditorDialog.addComponent) {
      return (
        <Dialog open={true} className="bcose-addComponentDialog" key="bcose-addComponentOuter">
          <DialogTitle>Add block type component</DialogTitle>
          <DialogContent>
            <BlockTypeAddComponent
              onNewComponentSelected={this.setSelectedNewComponentId}
              theme={this.props.theme}
              isVisual={this.props.isVisualsMode}
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
      const components = this.props.componentSet.getComponents();
      const componentForms = [];
      const componentList: McSelectableListItem[] = [];
      const colors = getThemeColors();

      let selectedIndex = 0;
      let itemsAdded = 0;
      let componentOffset = 0;

      // Reset component IDs by index for selection
      this._componentIdsByIndex = {};

      if (this.state.blockResource && this.state.blockResourceForm) {
        const isSelected = this.state.activeComponentId === "baseProps";
        componentList.push({
          key: "baseProps",
          content: (
            <BlockComponentSlot
              componentId="minecraft:base_properties"
              componentData={{}}
              isSelected={isSelected}
              title="Base Properties"
            />
          ),
        });

        this._componentIdsByIndex[itemsAdded.toString()] = "baseProps";
        componentOffset = 1;
        itemsAdded++;

        if (isSelected && this.state.blockResourceForm?.fields !== undefined) {
          selectedIndex = 0;
          componentForms.push(
            <div className="bcose-componentForm" key="basePropsForm">
              <DataForm
                displayTitle={true}
                displayDescription={true}
                readOnly={false}
                tag={"baseProps"}
                project={this.props.project}
                lookupProvider={this.props.project}
                theme={this.props.theme}
                objectKey={"basePros"}
                closeButton={false}
                definition={this.state.blockResourceForm}
                directObject={this.state.blockResource}
              ></DataForm>
            </div>
          );
        }
      }

      // Filter components by visual mode
      const filteredComponents: IManagedComponent[] = [];
      for (let i = 0; i < components.length; i++) {
        const component = components[i];
        if (typeof component === "object" && component.id !== undefined) {
          const isVisual = this.isVisualComponent(component.id);
          if (isVisual === this.props.isVisualsMode) {
            filteredComponents.push(component);
          }
        }
      }

      // Sort by category, then alphabetically
      filteredComponents.sort((a: IManagedComponent, b: IManagedComponent) => {
        const aCategory = getBlockComponentCategory(a.id);
        const bCategory = getBlockComponentCategory(b.id);

        if (aCategory !== bCategory) {
          return aCategory - bCategory;
        }

        return a.id.localeCompare(b.id);
      });

      let categoriesDisplayed: boolean[] = [];
      let lastCategory: number | undefined = undefined;

      for (let i = 0; i < filteredComponents.length; i++) {
        const component = filteredComponents[i];
        const formId = component.id.replace(/:/gi, "_").replace(/\./gi, "_");
        const attribCategory = getBlockComponentCategory(component.id);

        // Add category header if this is a new category
        if (!categoriesDisplayed[attribCategory]) {
          const attribCategoryDescrip = getBlockComponentCategoryDescription(attribCategory);
          categoriesDisplayed[attribCategory] = true;
          componentList.push({
            key: "attribCat" + attribCategory,
            disabled: true,
            content: (
              <div
                className="bcose-slotCategoryHeader"
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

        lastCategory = attribCategory;

        this._componentIdsByIndex[itemsAdded.toString()] = component.id;
        const isSelected = component.id === this.state?.activeComponentId;

        componentList.push({
          key: "compButtonList" + component.id,
          content: (
            <BlockComponentSlot
              componentId={component.id}
              componentData={component.getData()}
              isSelected={isSelected}
              title={getBlockFriendlyName(component.id) || Utilities.humanifyMinecraftName(component.id)}
            />
          ),
        });
        itemsAdded++;

        if (isSelected) {
          selectedIndex = itemsAdded - 1;

          // Add component header with large icon
          const activeColor = getBlockComponentColor(component.id);
          const attribCategoryDesc = getBlockComponentCategoryDescription(attribCategory);

          componentForms.push(
            <div
              className="bcose-componentHeader"
              key={"bcose-header" + component.id}
              style={
                {
                  "--header-icon-color": activeColor,
                } as React.CSSProperties
              }
            >
              <div className="bcose-componentHeaderIcon">
                <BlockComponentIcon componentId={component.id} size={32} />
              </div>
              <div className="bcose-componentHeaderInfo">
                <div className="bcose-componentHeaderName" title={getComponentDescription(component.id)}>{getBlockFriendlyName(component.id) || Utilities.humanifyMinecraftName(component.id)}</div>
                <div className="bcose-componentHeaderCategory">{attribCategoryDesc}</div>
              </div>
              <div className="bcose-componentHeaderActions">
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
              </div>
            </div>
          );

          if (!component.id.startsWith("minecraft:") && !component.id.startsWith("tag:")) {
            componentForms.push(
              <div className="bcose-noeditor" key={"noeditor" + component.id}>
                (No editor is available for the {component.id} custom component.)
              </div>
            );
          } else if (component.id.startsWith("tag:")) {
            componentForms.push(
              <div className="bcose-noeditor" key={"noeditor" + component.id}>
                (No editor is available for the {component.id} custom tag.)
              </div>
            );
          } else {
            const form = Database.getForm("block", formId);
            const componentData = component.getData();

            if (form !== undefined && form.fields !== undefined && componentData !== undefined) {
              componentForms.push(
                <div className="bcose-componentForm" key={"form" + component.id}>
                  <DataForm
                    displayTitle={false}
                    displayDescription={true}
                    readOnly={false}
                    tag={component.id}
                    project={this.props.project}
                    lookupProvider={this.props.project}
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
                <div className="bcose-noeditor" key={"noeditor" + component.id}>
                  (No editor is available for the {component.id} type.)
                </div>
              );
            }
          }
        }
      }

      let title = <></>;

      if (this.props.title) {
        title = <span>{this.props.title}</span>;
      }

      const areaHeight = "calc(100vh - " + String(this.props.heightOffset + 34) + "px)";

      return (
        <div>
          {permutationEditor}

          <div className="bcose-area">
            <div className="bcose-componentArea">
              <div className="bcose-titleArea">{title}</div>
              <div className="bcose-componentToolBarArea">
                <Stack direction="row" spacing={1} aria-label="Block type component actions">
                  <Button
                    size="small"
                    title="Add component"
                    onClick={this._handleAddComponentClick}
                    startIcon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
                  >
                    Add component
                  </Button>
                </Stack>
              </div>
            </div>
            <div
              className="bcose-componentList"
              style={{
                borderColor: colors.background6,
                backgroundColor: colors.background3,
                color: colors.foreground3,
                minHeight: areaHeight,
                maxHeight: areaHeight,
              }}
            >
              {componentList.length === 0 ? (
                <div style={{ padding: "16px", opacity: 0.7, fontStyle: "italic" }}>
                  No components added yet. Components define how your block looks and works. Click the + button to add one — try starting with Geometry or Material.
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
            <div
              className="bcose-componentBin"
              style={{
                minHeight: areaHeight,
                maxHeight: areaHeight,
                borderColor: colors.background6,
                backgroundColor: colors.background2,
                color: colors.foreground2,
              }}
            >
              {componentForms}
            </div>
          </div>
        </div>
      );
    }
  }
}

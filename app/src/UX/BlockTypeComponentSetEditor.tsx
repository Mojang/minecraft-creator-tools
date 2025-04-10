import { Component, SyntheticEvent } from "react";
import "./BlockTypeComponentSetEditor.css";
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
import BlockTypeAddComponent from "./BlockTypeAddComponent";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import Project from "../app/Project";
import MolangEditor from "./MolangEditor";
import Carto from "../app/Carto";
import ManagedPermutation from "../minecraft/ManagedPermutation";
import { IBlockResource } from "../minecraft/IBlocksCatalog";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import { ProjectItemType } from "../app/IProjectItemData";
import BlocksCatalogDefinition from "../minecraft/BlocksCatalogDefinition";
import IFormDefinition from "../dataform/IFormDefinition";

interface IBlockTypeComponentSetEditorProps {
  componentSet: IManagedComponentSetItem;
  isVisualsMode: boolean;
  permutation?: ManagedPermutation;
  isDefault: boolean;
  readOnly: boolean;
  project: Project;
  carto: Carto;
  heightOffset: number;
  title?: string;
  theme: ThemeInput<any>;
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
          await projectItem.ensureFileStorage();

          if (projectItem.defaultFile) {
            const blocksCatalog = await BlocksCatalogDefinition.ensureOnFile(projectItem.defaultFile);

            if (blocksCatalog) {
              const blockResource = blocksCatalog.getBlockDefinition(this.props.componentSet.id);

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
          await projectItem.ensureFileStorage();

          if (projectItem.defaultFile) {
            const blocksCatalog = await BlocksCatalogDefinition.ensureOnFile(projectItem.defaultFile);

            if (blocksCatalog) {
              const blockResource = blocksCatalog.ensureBlockDefinition(this.props.componentSet.id);

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
    }

    const form = await Database.ensureFormLoaded("block", formName);

    if (form !== undefined) {
      const newDataObject = DataFormUtilities.generateDefaultItem(form);

      this.props.componentSet.addComponent(id, newDataObject);
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
        await Database.ensureFormLoaded("block", formId);
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

    let componentOffset = 0;

    if (this.state.blockResource && this.state.blockResourceForm) {
      if (event.selectedIndex === 0) {
        this.setState({
          activeComponentId: "baseProps",
        });

        return;
      }

      componentOffset = 1;
    }

    const componentListing = this.getUsableComponents();

    const id = componentListing[event.selectedIndex - componentOffset].id;

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

  private async _handleAddComponentClick(e: SyntheticEvent | undefined, data: ButtonProps | undefined) {
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
    this.props.carto.preferredTextSize = newTextSize;
  }

  _updateCondition(permutationContent: string) {
    if (this.props.permutation) {
      this.props.permutation!.condition = permutationContent;
    }
  }

  render() {
    let permutationEditor = <></>;
    if (this.state === undefined || this.state.loadedFormCount === undefined) {
      this._updateManager();

      return <div className="bcose-loading">Loading...</div>;
    }

    if (this.props.permutation) {
      permutationEditor = (
        <MolangEditor
          carto={this.props.carto}
          readOnly={this.props.readOnly}
          initialContent={this.props.permutation.condition}
          onMolangTextChanged={this._updateCondition}
          onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
          preferredTextSize={this.props.carto.preferredTextSize}
          project={this.props.project}
          theme={this.props.theme}
        />
      );
    }

    if (this.state.dialogMode === BlockTypeComponentEditorDialog.addComponent) {
      return (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="etcse-addComponentOuter"
          onCancel={this._handleDialogCancel}
          onConfirm={this._handleAddComponentOK}
          content={
            <BlockTypeAddComponent
              onNewComponentSelected={this.setSelectedNewComponentId}
              theme={this.props.theme}
              isVisual={this.props.isVisualsMode}
            />
          }
          header={"Add component"}
        />
      );
    } else {
      const components = this.props.componentSet.getComponents();
      const componentForms = [];
      const componentList = [];

      let selectedIndex = 0;
      let curItem = 0;
      let componentOffset = 0;

      if (this.state.blockResource && this.state.blockResourceForm) {
        componentList.push({
          key: "baseProps",
          content: (
            <div
              className="bcose-componentWrapper"
              style={{
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
                borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
              }}
            >
              Base Properties
            </div>
          ),
        });

        componentOffset = 1;

        if (this.state.activeComponentId === "baseProps") {
          selectedIndex = 0;
          componentForms.push(
            <div className="bcose-componentForm">
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

      for (let i = 0; i < components.length; i++) {
        const component = components[i];

        if (typeof component === "object" && component.id !== undefined) {
          const isVisual = this.isVisualComponent(component.id);

          if (isVisual === this.props.isVisualsMode) {
            const formId = component.id.replace(/:/gi, "_").replace(/\./gi, "_");

            const form = Database.getForm("block", formId);

            componentList.push({
              key: component.id,
              content: (
                <div
                  className="bcose-componentWrapper"
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
                selectedIndex = curItem + componentOffset;
                componentForms.push(
                  <div className="bcose-componentForm">
                    <DataForm
                      displayTitle={true}
                      displayDescription={true}
                      readOnly={false}
                      tag={component.id}
                      project={this.props.project}
                      lookupProvider={this.props.project}
                      theme={this.props.theme}
                      objectKey={component.id}
                      closeButton={false}
                      definition={form}
                      getsetPropertyObject={component}
                    ></DataForm>
                  </div>
                );
              } else if (component.id === this.state?.activeComponentId) {
                selectedIndex = curItem;
                componentForms.push(
                  <div className="bcose-noeditor">(No editor is available for the {component.id} type.)</div>
                );
              }
            }
            curItem++;
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
        <div>
          {permutationEditor}

          <div className="bcose-area">
            <div className="bcose-componentArea">
              <div className="bcose-titleArea">{title}</div>
              <div className="bcose-componentToolBarArea">
                <Toolbar aria-label="Component editing toolbar" items={toolbarItems} />
              </div>
            </div>
            <div
              className="bcose-componentList"
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
              className="bcose-componentBin"
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
        </div>
      );
    }
  }
}

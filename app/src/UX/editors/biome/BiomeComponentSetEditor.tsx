import { Component } from "react";
import "./BiomeComponentSetEditor.css";
import DataForm from "../../../dataformux/DataForm";
import Database from "../../../minecraft/Database";
import { Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItemButton } from "@mui/material";
import DataFormUtilities from "../../../dataform/DataFormUtilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import BiomeAddComponent from "./BiomeAddComponent";
import Project from "../../../app/Project";
import CreatorTools from "../../../app/CreatorTools";
import BiomeBehaviorDefinition from "../../../minecraft/BiomeBehaviorDefinition";
import Utilities from "../../../core/Utilities";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";

interface IBiomeComponentSetEditorProps {
  biomeDefinition: BiomeBehaviorDefinition;
  readOnly: boolean;
  project: Project;
  heightOffset: number;
  creatorTools: CreatorTools;
  theme: IProjectTheme;
}

interface IBiomeComponentSetEditorState {
  activeComponentId: string | undefined;
  dialogMode: BiomeComponentEditorDialog;
  selectedNewComponentId: string | undefined;
  isLoaded: boolean;
}

export enum BiomeComponentEditorDialog {
  none = 0,
  addComponent = 1,
}

export default class BiomeComponentSetEditor extends Component<
  IBiomeComponentSetEditorProps,
  IBiomeComponentSetEditorState
> {
  constructor(props: IBiomeComponentSetEditorProps) {
    super(props);
    this._addComponent = this._addComponent.bind(this);
    this._handleCloseClick = this._handleCloseClick.bind(this);
    this._handleComponentSelected = this._handleComponentSelected.bind(this);
    this.setSelectedNewComponentId = this.setSelectedNewComponentId.bind(this);
    this._handleAddComponentClick = this._handleAddComponentClick.bind(this);
    this._handleAddComponentOK = this._handleAddComponentOK.bind(this);
    this._handleDialogCancel = this._handleDialogCancel.bind(this);
    this._onUpdatePreferredTextSize = this._onUpdatePreferredTextSize.bind(this);

    let id = undefined;

    const componentListing = this.getUsableComponentsForUIList();

    if (componentListing && componentListing.length > 0) {
      id = componentListing[0].id;
    }

    this.state = {
      activeComponentId: id,
      dialogMode: BiomeComponentEditorDialog.none,
      selectedNewComponentId: undefined,
      isLoaded: false,
    };
  }

  componentDidMount() {
    this._updateManager();
  }

  async _updateManager() {
    const componentListing = this.getUsableComponentsForUIList();

    if (componentListing && componentListing.length > 0) {
      const formId = this.getComponentFormFromId(componentListing[0].id);

      if (!Database.isFormLoaded("biome", formId)) {
        await Database.ensureFormLoaded("biome", formId);
      }
    }

    if (this.state.activeComponentId) {
      const formId = this.getComponentFormFromId(componentListing[0].id);

      if (!Database.isFormLoaded("biome", formId)) {
        await Database.ensureFormLoaded("biome", formId);
      }
    }

    this.setState({
      activeComponentId: this.state.activeComponentId,
      dialogMode: this.state.dialogMode,
      selectedNewComponentId: this.state.selectedNewComponentId,
      isLoaded: true,
    });
  }

  componentDidUpdate(prevProps: IBiomeComponentSetEditorProps, prevState: IBiomeComponentSetEditorState) {
    if (prevProps.biomeDefinition !== this.props.biomeDefinition) {
      const componentListing = this.getUsableComponentsForUIList();

      let id = this.state.activeComponentId;

      if (componentListing && componentListing.length > 0) {
        id = componentListing[0].id;
      }

      this.setState({
        activeComponentId: id,
        dialogMode: this.state.dialogMode,
        selectedNewComponentId: this.state.selectedNewComponentId,
        isLoaded: this.state.isLoaded,
      });
    }
  }

  async _handleComponentSelected(id: string) {
    const formId = this.getComponentFormFromId(id);

    await Database.ensureFormLoaded("biome", formId);

    this.setState({
      activeComponentId: id,
      dialogMode: this.state.dialogMode,
      selectedNewComponentId: this.state.selectedNewComponentId,
      isLoaded: true,
    });
  }

  _handleCloseClick() {
    this.setState({
      activeComponentId: this.state.activeComponentId,
      dialogMode: BiomeComponentEditorDialog.none,
      selectedNewComponentId: this.state.selectedNewComponentId,
    });
  }

  _onUpdatePreferredTextSize(newSize: number) {
    if (this.props.creatorTools.preferredTextSize !== newSize) {
      this.props.creatorTools.preferredTextSize = newSize;
      this.props.creatorTools.save();
    }
  }

  getUsableComponentsForUIList() {
    const componentSet: any[] = [];
    const colors = getThemeColors();

    const comps = this.props.biomeDefinition.getComponents();

    for (let i = 0; i < comps.length; i++) {
      const comp = comps[i];

      componentSet.push({
        id: comp.id,
        content: (
          <div
            className="biocse-componentWrapper"
            style={{
              backgroundColor: colors.sectionHeaderBackground,
              borderColor: colors.sectionBorder,
            }}
          >
            {Utilities.humanifyMinecraftName(comp.id)}
          </div>
        ),
        name: comp.id,
      });
    }

    return componentSet.sort((a, b) => {
      if (a.name < b.name) {
        return -1;
      }

      if (a.name > b.name) {
        return 1;
      }

      return 0;
    });
  }

  _handleAddComponentClick() {
    this.setState({
      activeComponentId: this.state.activeComponentId,
      dialogMode: BiomeComponentEditorDialog.addComponent,
      selectedNewComponentId: this.state.selectedNewComponentId,
    });
  }

  _handleDialogCancel() {
    this.setState({
      activeComponentId: this.state.activeComponentId,
      dialogMode: BiomeComponentEditorDialog.none,
      selectedNewComponentId: this.state.selectedNewComponentId,
    });
  }

  setSelectedNewComponentId(newId: string) {
    this.setState({
      activeComponentId: this.state.activeComponentId,
      dialogMode: this.state.dialogMode,
      selectedNewComponentId: newId,
    });
  }

  async _handleAddComponentOK() {
    if (this.state.selectedNewComponentId) {
      await this._addComponent(this.state.selectedNewComponentId);
    }

    this.setState({
      activeComponentId: this.state.selectedNewComponentId,
      dialogMode: BiomeComponentEditorDialog.none,
      selectedNewComponentId: undefined,
    });
  }

  async _addComponent(name: string) {
    if (Database.uxCatalog === null) {
      return;
    }

    const form = await Database.ensureFormLoaded("biome", this.getComponentFormFromId(name));

    if (form !== undefined) {
      const newDataObject = DataFormUtilities.generateDefaultItem(form);

      this.props.biomeDefinition.addComponent(name, newDataObject);

      this.setState({
        activeComponentId: name,
        dialogMode: this.state.dialogMode,
        selectedNewComponentId: this.state.selectedNewComponentId,
      });
    }
  }

  getComponentFormFromId(componentId: string) {
    return componentId.replace(/:/gi, "_").replace(/\./gi, "_");
  }

  render() {
    let selectedIndex = -1;
    let activeContent = <></>;

    if (!this.state || !this.state.isLoaded) {
      return <></>;
    }

    const componentListing = this.getUsableComponentsForUIList();

    if (componentListing) {
      for (let i = 0; i < componentListing.length; i++) {
        if (componentListing[i].id === this.state.activeComponentId) {
          selectedIndex = i;
        }
      }
    }

    const areaHeight = "calc(100vh - " + String(this.props.heightOffset + 10) + "px)";

    if (this.state.activeComponentId) {
      const component = this.props.biomeDefinition.getComponent(this.state.activeComponentId);

      if (component) {
        const componentName = this.state.activeComponentId;

        const formId = this.getComponentFormFromId(componentName);
        const form = Database.getForm("biome", formId);

        if (form) {
          activeContent = (
            <div className="biocse-form">
              <DataForm
                key={"biomeComponent" + componentName}
                definition={form}
                displayTitle={true}
                theme={this.props.theme}
                directObject={component.getData()}
                readOnly={this.props.readOnly}
                objectKey={componentName}
              />
            </div>
          );
        }
      }
    }

    const addComponentDialog = this.state.dialogMode === BiomeComponentEditorDialog.addComponent && (
      <Dialog open={true} onClose={this._handleDialogCancel} className="biocse-addComponentDialog">
        <DialogTitle>Add Biome Component</DialogTitle>
        <DialogContent>
          <BiomeAddComponent
            onSelectedNewComponentId={this.setSelectedNewComponentId}
            theme={this.props.theme}
            existingComponents={this.props.biomeDefinition.getComponents()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={this._handleDialogCancel}>Cancel</Button>
          <Button onClick={this._handleAddComponentOK}>OK</Button>
        </DialogActions>
      </Dialog>
    );

    const colors = getThemeColors();

    return (
      <div className="biocse-area">
        <div className="biocse-toolArea">
          <Stack direction="row" spacing={1} aria-label="Component toolbar">
            <Button key="addComponent" onClick={this._handleAddComponentClick} title="Add Component">
              <FontAwesomeIcon icon={faPlus} className="fa-lg" />
            </Button>
          </Stack>
        </div>
        <div className="biocse-mainArea">
          <div
            className="biocse-componentListArea"
            style={{
              minHeight: areaHeight,
              maxHeight: areaHeight,
              borderColor: colors.cardBorder,
              backgroundColor: colors.surfaceBackground,
              color: colors.contentForeground,
            }}
          >
            <List>
              {componentListing.map((comp, index) => (
                <ListItemButton
                  key={comp.id}
                  selected={index === selectedIndex}
                  onClick={() => this._handleComponentSelected(comp.id)}
                >
                  {comp.content}
                </ListItemButton>
              ))}
            </List>
          </div>
          <div
            className="biocse-componentArea"
            style={{
              minHeight: areaHeight,
              maxHeight: areaHeight,
              borderColor: colors.cardBorder,
              backgroundColor: colors.sectionHeaderBackground,
              color: colors.surfaceForeground,
            }}
          >
            {activeContent}
          </div>
        </div>
        {addComponentDialog}
      </div>
    );
  }
}

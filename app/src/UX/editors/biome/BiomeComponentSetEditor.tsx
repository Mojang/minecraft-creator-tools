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
import IManagedComponentSetItem from "../../../minecraft/IManagedComponentSetItem";
import Utilities from "../../../core/Utilities";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";

interface IBiomeComponentSetEditorProps extends WithLocalizationProps {
  biomeDefinition: IManagedComponentSetItem;
  formCategory?: string;
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

class BiomeComponentSetEditor extends Component<IBiomeComponentSetEditorProps, IBiomeComponentSetEditorState> {
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

  get formCategory(): string {
    return this.props.formCategory || "biome";
  }

  async _updateManager() {
    const componentListing = this.getUsableComponentsForUIList();

    if (componentListing && componentListing.length > 0) {
      const formId = this.getComponentFormFromId(componentListing[0].id);

      if (!Database.isFormLoaded(this.formCategory, formId)) {
        await Database.ensureFormLoaded(this.formCategory, formId);
      }
    }

    if (this.state.activeComponentId) {
      const formId = this.getComponentFormFromId(componentListing[0].id);

      if (!Database.isFormLoaded(this.formCategory, formId)) {
        await Database.ensureFormLoaded(this.formCategory, formId);
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

    await Database.ensureFormLoaded(this.formCategory, formId);

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

    const comps = this.props.biomeDefinition.getComponents();

    for (let i = 0; i < comps.length; i++) {
      const comp = comps[i];
      const isSelected = comp.id === this.state?.activeComponentId;

      componentSet.push({
        id: comp.id,
        content: (
          <div className={`biocse-componentSlot ${isSelected ? "biocse-slotSelected" : ""}`}>
            <div className="biocse-slotChip">
              <span className="biocse-slotText">{Utilities.humanifyMinecraftName(comp.id)}</span>
            </div>
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

    const form = await Database.ensureFormLoaded(this.formCategory, this.getComponentFormFromId(name));

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
        const form = Database.getForm(this.formCategory, formId);

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

    const colors = getThemeColors();

    const addComponentDialog = this.state.dialogMode === BiomeComponentEditorDialog.addComponent && (
      <Dialog
        open={true}
        onClose={this._handleDialogCancel}
        className="biocse-addComponentDialog"
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: colors.sectionHeaderBackground,
            color: colors.contentForeground,
          },
        }}
      >
        <DialogTitle>{this.props.intl.formatMessage({ id: "project_editor.biome_comp.add_dialog_title" })}</DialogTitle>
        <DialogContent>
          <BiomeAddComponent
            onSelectedNewComponentId={this.setSelectedNewComponentId}
            theme={this.props.theme}
            formCategory={this.formCategory}
            existingComponents={this.props.biomeDefinition.getComponents()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={this._handleDialogCancel}>Cancel</Button>
          <Button variant="contained" color="success" onClick={this._handleAddComponentOK}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    );

    return (
      <div className="biocse-area">
        <div className="biocse-toolArea">
          <Stack
            direction="row"
            spacing={1}
            aria-label={this.props.intl.formatMessage({ id: "project_editor.biome_comp.aria_toolbar" })}
          >
            <Button
              key="addComponent"
              onClick={this._handleAddComponentClick}
              title={this.props.intl.formatMessage({ id: "project_editor.biome_comp.add_component" })}
            >
              <FontAwesomeIcon icon={faPlus} className="fa-lg" />
              &nbsp;{this.props.intl.formatMessage({ id: "project_editor.biome_comp.add_component" })}
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

export default withLocalization(BiomeComponentSetEditor);

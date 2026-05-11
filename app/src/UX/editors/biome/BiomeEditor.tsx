import { Component } from "react";
import IFileProps from "../../project/fileExplorer/IFileProps";
import IFile from "../../../storage/IFile";
import "./BiomeEditor.css";
import Database from "../../../minecraft/Database";
import DataFormUtilities from "../../../dataform/DataFormUtilities";
import BiomeBehaviorDefinition from "../../../minecraft/BiomeBehaviorDefinition";
import ProjectItem from "../../../app/ProjectItem";
import DataFormComponentAccordion from "../../../dataformux/DataFormComponentAccordion";
import { CustomTabLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import WebUtilities from "../../utils/WebUtilities";
import { faTreeCity, faSliders } from "@fortawesome/free-solid-svg-icons";
import { Button, Stack } from "@mui/material";
import CreatorTools from "../../../app/CreatorTools";
import Project from "../../../app/Project";
import { ProjectItemType } from "../../../app/IProjectItemData";
import BiomeResourceEditor from "./BiomeResourceEditor";
import BiomeResourceDefinition from "../../../minecraft/BiomeResourceDefinition";
import Utilities from "../../../core/Utilities";
import StorageUtilities from "../../../storage/StorageUtilities";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";
import { EditorHeaderChip, EditorHeaderBar, EditorHeaderTabs } from "../../appShell/EditorHeader";

export enum BiomeEditorMode {
  components = 0,
  visuals = 2,
}

interface IBiomeEditorProps extends IFileProps, WithLocalizationProps {
  heightOffset: number;
  readOnly: boolean;
  item: ProjectItem;
  project: Project;
  creatorTools: CreatorTools;
  theme: IProjectTheme;
}

interface IBiomeEditorState {
  fileToEdit: IFile;
  mode: BiomeEditorMode;
  resourceFileToEdit?: IFile;
  resourceItem?: ProjectItem;
  isLoaded: boolean;
}

class BiomeEditor extends Component<IBiomeEditorProps, IBiomeEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: IBiomeEditorProps) {
    super(props);

    this._handleBiomeLoaded = this._handleBiomeLoaded.bind(this);
    this._addRelatedResourceClick = this._addRelatedResourceClick.bind(this);
    this._addRelatedResourceItem = this._addRelatedResourceItem.bind(this);
    this._setComponentsMode = this._setComponentsMode.bind(this);
    this._setVisualsMode = this._setVisualsMode.bind(this);

    this.state = {
      fileToEdit: props.file,
      resourceFileToEdit: undefined,
      mode: BiomeEditorMode.components,
      isLoaded: false,
    };
  }

  static getDerivedStateFromProps(props: IBiomeEditorProps, state: IBiomeEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        mode: BiomeEditorMode.components,
        resourceFileToEdit: undefined,
        isLoaded: false,
      };

      return state;
    }

    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;
      state.isLoaded = false;

      return state;
    }

    return null; // No change to state
  }

  componentDidMount(): void {
    this._updateManager(true);
  }

  componentDidUpdate(prevProps: Readonly<IBiomeEditorProps>, prevState: Readonly<IBiomeEditorState>): void {
    if (this.state && this.props.file !== this.state.fileToEdit) {
      this.setState(
        {
          fileToEdit: this.props.file,
          mode: this.state.mode,
          resourceFileToEdit: undefined,
          resourceItem: undefined,
          isLoaded: false,
        },
        () => {
          this._updateManager(true);
        }
      );
    }
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await this._doUpdate(setState);
      }
    }
  }

  _handleBiomeLoaded(biome: BiomeBehaviorDefinition, typeA: BiomeBehaviorDefinition) {
    if (this.state) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        mode: this.state.mode,
        isLoaded: true,
      });
    }
  }

  async _doUpdate(setState: boolean) {
    let biomeDefinition = this.state.fileToEdit.manager;
    let resourceFileToEdit = this.state.resourceFileToEdit;
    let resourceItem = this.state.resourceItem;

    if (biomeDefinition === undefined || !(biomeDefinition instanceof BiomeBehaviorDefinition)) {
      biomeDefinition = await BiomeBehaviorDefinition.ensureOnFile(this.state.fileToEdit);
    }

    await this.props.item.ensureDependencies();

    if (this.props.item && this.props.item.childItems) {
      for (const childItem of this.props.item.childItems) {
        if (childItem.childItem.itemType === ProjectItemType.biomeResource) {
          if (!childItem.childItem.isContentLoaded) {
            await childItem.childItem.loadContent();
          }

          if (childItem.childItem.primaryFile) {
            resourceItem = childItem.childItem;
            resourceFileToEdit = childItem.childItem.primaryFile;

            await BiomeResourceDefinition.ensureOnFile(resourceFileToEdit);
          }
        }
      }
    }

    if (biomeDefinition !== undefined) {
      if (!biomeDefinition.isLoaded) {
        biomeDefinition.onLoaded.subscribe(this._handleBiomeLoaded);
      } else {
        if (setState) {
          this.setState({
            fileToEdit: this.state.fileToEdit,
            resourceFileToEdit: resourceFileToEdit,
            resourceItem: resourceItem,
            mode: this.state.mode,
            isLoaded: true,
          });
        }
      }
    }
  }

  async persist(): Promise<boolean> {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      const biomeDefinition = this.state.fileToEdit.manager;

      if (biomeDefinition !== undefined && biomeDefinition instanceof BiomeBehaviorDefinition) {
        return await biomeDefinition.persist();
      }
    }

    return false;
  }

  _setComponentsMode() {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      mode: BiomeEditorMode.components,
      isLoaded: this.state.isLoaded,
    });
  }

  _setVisualsMode() {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      mode: BiomeEditorMode.visuals,
      isLoaded: this.state.isLoaded,
    });
  }

  async _addRelatedResourceClick() {
    // For now, just add a default climate component
    this._addRelatedResourceItem("minecraft:climate");
  }

  async _addRelatedResourceItem(name: string) {
    if (Database.uxCatalog === null) {
      return;
    }

    const form = await Database.ensureFormLoaded("biome", name);

    if (form !== undefined) {
      const newDataObject = DataFormUtilities.generateDefaultItem(form);

      const bd = this.state.fileToEdit.manager as BiomeBehaviorDefinition;

      if (bd._data === undefined) {
        return;
      }

      bd.addComponent(name, newDataObject);
    }
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const areaHeight = "calc(100vh - " + String(this.props.heightOffset + 60) + "px)";
    const width = WebUtilities.getWidth();
    let isButtonCompact = false;
    const colors = getThemeColors();

    if (width < 716) {
      isButtonCompact = true;
    }

    if (
      this.state === null ||
      !this.state.isLoaded ||
      this.state.fileToEdit === null ||
      this.state.fileToEdit.manager === undefined ||
      Database.uxCatalog === null
    ) {
      return <div className="bio-loading">Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const biomeDefinition = this.state.fileToEdit.manager as BiomeBehaviorDefinition;

    let interior = <></>;

    if (this.state.mode === BiomeEditorMode.components) {
      interior = (
        <DataFormComponentAccordion
          componentSetItem={biomeDefinition}
          formCategory="biome"
          theme={this.props.theme}
          readOnly={this.props.readOnly}
          maxHeight={areaHeight}
        />
      );
    } else if (this.state.mode === BiomeEditorMode.visuals) {
      if (this.state.resourceFileToEdit && this.state.resourceItem) {
        interior = (
          <BiomeResourceEditor
            theme={this.props.theme}
            file={this.state.resourceFileToEdit}
            item={this.state.resourceItem}
            heightOffset={this.props.heightOffset + 92}
            readOnly={this.props.readOnly}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
          />
        );
      } else {
        interior = (
          <div className="bio-addResource">
            <Button variant="contained" onClick={this._addRelatedResourceClick}>
              {this.props.intl.formatMessage(
                { id: "project_editor.biome.add_resource" },
                { biomeName: Utilities.humanifyMinecraftName(this.state.fileToEdit.name) }
              )}
            </Button>
          </div>
        );
      }
    }

    return (
      <div
        className="bio-areaOuter"
        style={{
          backgroundColor: colors.contentBackground,
          color: colors.contentForeground,
          minHeight: height,
          maxHeight: height,
        }}
      >
        <EditorHeaderChip itemType={ProjectItemType.biomeBehavior} theme={this.props.theme}>
          <EditorHeaderBar
            itemId={
              biomeDefinition.id ||
              (this.state.fileToEdit?.name
                ? Utilities.humanifyMinecraftName(StorageUtilities.getBaseFromName(this.state.fileToEdit.name))
                : "(new biome)")
            }
            itemType={ProjectItemType.biomeBehavior}
            typeName="Biome"
            formatVersion={biomeDefinition.data?.format_version}
          />
          <EditorHeaderTabs>
            <Stack direction="row" spacing={0.5} aria-label="Biome editor tabs">
              <Button onClick={this._setComponentsMode} title="Components">
                <CustomTabLabel
                  theme={this.props.theme}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === BiomeEditorMode.components}
                  icon={<FontAwesomeIcon icon={faSliders} className="fa-lg" />}
                  title="Components"
                  text="Components"
                />
              </Button>
              <Button
                onClick={this._setVisualsMode}
                title={this.props.intl.formatMessage({ id: "project_editor.biome.tab_audio_visuals" })}
              >
                <CustomTabLabel
                  theme={this.props.theme}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === BiomeEditorMode.visuals}
                  icon={<FontAwesomeIcon icon={faTreeCity} className="fa-lg" />}
                  title={this.props.intl.formatMessage({ id: "project_editor.biome.tab_audio_visuals" })}
                  text={this.props.intl.formatMessage({ id: "project_editor.biome.tab_audio_visuals" })}
                />
              </Button>
            </Stack>
          </EditorHeaderTabs>
        </EditorHeaderChip>
        <div
          className="bio-area"
          style={{
            minHeight: areaHeight,
            maxHeight: areaHeight,
          }}
        >
          {interior}
        </div>
      </div>
    );
  }
}

export default withLocalization(BiomeEditor);

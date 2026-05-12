import { Component } from "react";
import IFileProps from "../../project/fileExplorer/IFileProps";
import IFile from "../../../storage/IFile";
import "./BlockTypeEditor.css";
import Database from "../../../minecraft/Database";
import DataFormUtilities from "../../../dataform/DataFormUtilities";
import BlockTypeDefinition from "../../../minecraft/BlockTypeDefinition";
import ProjectItem from "../../../app/ProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import BlockTypeComponentSetEditor from "./BlockTypeComponentSetEditor";
import { CustomTabLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import WebUtilities from "../../utils/WebUtilities";
import { faBolt, faCow, faHome, faSliders } from "@fortawesome/free-solid-svg-icons";
import { Stack, Button } from "@mui/material";
import { faSquarePlus } from "@fortawesome/free-regular-svg-icons";
import BlockTypeStateEditor from "./BlockTypeStateEditor";
import CreatorTools from "../../../app/CreatorTools";
import Project from "../../../app/Project";
import BlockTypePermutationEditor from "./BlockTypePermutationEditor";
import BlockTypeActionEditor from "./BlockTypeActionEditor";
import BlockTypeOverviewPanel from "./BlockTypeOverviewPanel";
import { EditorHeaderChip, EditorHeaderBar, EditorHeaderTabs } from "../../appShell/EditorHeader";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";

export enum BlockTypeEditorMode {
  overview = 0,
  states = 1,
  components = 2,
  actions = 3,
  visuals = 4,
  loot = 5,
}

interface IBlockTypeEditorProps extends IFileProps, WithLocalizationProps {
  heightOffset: number;
  readOnly: boolean;
  item: ProjectItem;
  project: Project;
  creatorTools: CreatorTools;
  theme: IProjectTheme;
}

interface IBlockTypeEditorState {
  fileToEdit: IFile;
  mode: BlockTypeEditorMode;
  isLoaded: boolean;
}

class BlockTypeEditor extends Component<IBlockTypeEditorProps, IBlockTypeEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: IBlockTypeEditorProps) {
    super(props);

    this._handleBlockTypeLoaded = this._handleBlockTypeLoaded.bind(this);
    this._addComponentClick = this._addComponentClick.bind(this);
    this._addComponent = this._addComponent.bind(this);
    this._setOverviewMode = this._setOverviewMode.bind(this);
    this._setStatesMode = this._setStatesMode.bind(this);
    this._setComponentsMode = this._setComponentsMode.bind(this);
    this._setActionsMode = this._setActionsMode.bind(this);
    this._setVisualsMode = this._setVisualsMode.bind(this);
    this._setLootMode = this._setLootMode.bind(this);
    this._handleNavigateToTab = this._handleNavigateToTab.bind(this);

    this.state = {
      fileToEdit: props.file,
      mode: BlockTypeEditorMode.overview,
      isLoaded: false,
    };
  }

  static getDerivedStateFromProps(props: IBlockTypeEditorProps, state: IBlockTypeEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        mode: BlockTypeEditorMode.overview,
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

  private _isMounted = false;

  componentDidMount(): void {
    this._isMounted = true;
    this._updateManager();
  }

  componentWillUnmount(): void {
    this._isMounted = false;
  }

  componentDidUpdate(prevProps: Readonly<IBlockTypeEditorProps>, prevState: Readonly<IBlockTypeEditorState>): void {
    if (prevProps.file !== this.state.fileToEdit) {
      this._updateManager();
    }
  }

  async _updateManager() {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await BlockTypeDefinition.ensureOnFile(this.state.fileToEdit, this._handleBlockTypeLoaded, true);
      }
    }

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof BlockTypeDefinition &&
      (this.state.fileToEdit.manager as BlockTypeDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate();
    }
  }

  _handleBlockTypeLoaded(blockType: BlockTypeDefinition, typeA: BlockTypeDefinition) {
    this._doUpdate();
  }

  async _doUpdate() {
    this.setState({
      ...this.state,
      isLoaded: true,
    });
  }

  async persist(): Promise<boolean> {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const bt = file.manager as BlockTypeDefinition;

        return bt.persist();
      }
    }

    return false;
  }

  _setOverviewMode() {
    this._setMode(BlockTypeEditorMode.overview);
  }

  _setStatesMode() {
    this._setMode(BlockTypeEditorMode.states);
  }

  _setComponentsMode() {
    this._setMode(BlockTypeEditorMode.components);
  }

  _setActionsMode() {
    this._setMode(BlockTypeEditorMode.actions);
  }

  _setVisualsMode() {
    this._setMode(BlockTypeEditorMode.visuals);
  }

  _setLootMode() {
    this._setMode(BlockTypeEditorMode.loot);
  }

  _handleNavigateToTab(tabId: string) {
    switch (tabId) {
      case "states":
        this._setStatesMode();
        break;
      case "components":
        this._setComponentsMode();
        break;
      case "actions":
        this._setActionsMode();
        break;
      case "visuals":
        this._setVisualsMode();
        break;
      case "loot":
        this._setLootMode();
        break;
      default:
        this._setOverviewMode();
    }
  }

  _setMode(mode: BlockTypeEditorMode) {
    this.setState({
      ...this.state,
      mode: mode,
    });
  }

  async _addComponentClick() {
    await this._addComponent("minecraft:tameable");

    if (this._isMounted) {
      this.forceUpdate();
    }
  }

  async _addComponent(name: string) {
    if (Database.uxCatalog === null) {
      return;
    }

    const form = await Database.ensureFormLoaded("block", name);

    if (form !== undefined) {
      const newDataObject = DataFormUtilities.generateDefaultItem(form);

      const bt = this.state.fileToEdit.manager as BlockTypeDefinition;

      if (bt._data === undefined) {
        return;
      }

      bt._data.components[name] = newDataObject;
    }
  }

  render() {
    const height = "calc(100vh - " + (this.props.heightOffset - 1) + "px)";
    const width = WebUtilities.getWidth();
    let isButtonCompact = false;
    const colors = getThemeColors();

    if (width < 900) {
      isButtonCompact = true;
    }

    if (
      this.state === null ||
      this.state.fileToEdit === null ||
      this.state.fileToEdit.manager === undefined ||
      Database.uxCatalog === null
    ) {
      return (
        <div className="bte-loading">{this.props.intl.formatMessage({ id: "project_editor.block.loading_type" })}</div>
      );
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const bt = this.state.fileToEdit.manager as BlockTypeDefinition;

    if (bt._data === undefined) {
      return (
        <div className="bte-message">
          {this.props.intl.formatMessage({ id: "project_editor.block.loading_definition" })}
        </div>
      );
    }

    // Calculate counts for tab badges
    const componentCount = bt.getComponents().length;
    const states = bt.getStates();
    const stateCount = states ? Object.keys(states).length : 0;
    const permutationCount = bt.getManagedPermutations()?.length || 0;

    // Labels for tabs
    // Tab labels: States and Components show counts because they have discrete,
    // countable items that help users gauge content at a glance. Other tabs
    // (Actions, Visuals, Loot, etc.) represent categories rather than countable
    // collections, so counts would not be meaningful.
    const statesLabel = isButtonCompact
      ? this.props.intl.formatMessage({ id: "project_editor.block.tab_states" })
      : this.props.intl.formatMessage({ id: "project_editor.block.tab_states_count" }, { count: stateCount });
    const componentsLabel = isButtonCompact
      ? this.props.intl.formatMessage({ id: "project_editor.block.tab_components" })
      : this.props.intl.formatMessage({ id: "project_editor.block.tab_components_count" }, { count: componentCount });

    let modeArea = <></>;

    if (this.state.mode === BlockTypeEditorMode.overview) {
      modeArea = (
        <div
          className="bte-contentArea"
          style={{
            borderColor: colors.sectionBorder,
          }}
        >
          <BlockTypeOverviewPanel
            creatorTools={this.props.creatorTools}
            project={this.props.project}
            item={this.props.item}
            heightOffset={this.props.heightOffset + 72}
            theme={this.props.theme}
            blockType={bt}
            onNavigateToTab={this._handleNavigateToTab}
          />
        </div>
      );
    } else if (this.state.mode === BlockTypeEditorMode.states) {
      modeArea = (
        <div className="bte-contentArea">
          <BlockTypeStateEditor
            blockTypeItem={bt}
            project={this.props.project}
            theme={this.props.theme}
            heightOffset={this.props.heightOffset + 72}
          />
        </div>
      );
    } else if (this.state.mode === BlockTypeEditorMode.components) {
      modeArea = (
        <div className="bte-contentArea">
          <BlockTypePermutationEditor
            isVisualsMode={false}
            blockTypeItem={bt}
            readOnly={this.props.readOnly}
            item={this.props.item}
            creatorTools={this.props.creatorTools}
            file={this.props.file}
            project={this.props.project}
            theme={this.props.theme}
            heightOffset={this.props.heightOffset + 72}
          />
        </div>
      );
    } else if (this.state.mode === BlockTypeEditorMode.actions) {
      modeArea = (
        <div className="bte-contentArea">
          <BlockTypeActionEditor
            isVisualsMode={false}
            blockTypeItem={bt}
            readOnly={this.props.readOnly}
            item={this.props.item}
            creatorTools={this.props.creatorTools}
            file={this.props.file}
            project={this.props.project}
            theme={this.props.theme}
            heightOffset={this.props.heightOffset + 72}
          />
        </div>
      );
    } else if (this.state.mode === BlockTypeEditorMode.visuals) {
      modeArea = (
        <div className="bte-contentArea">
          <BlockTypeComponentSetEditor
            isVisualsMode={true}
            componentSet={bt}
            readOnly={this.props.readOnly}
            creatorTools={this.props.creatorTools}
            project={this.props.project}
            theme={this.props.theme}
            isDefault={true}
            heightOffset={this.props.heightOffset + 72}
          />
        </div>
      );
    }

    return (
      <div
        className="bte-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <EditorHeaderChip itemType={ProjectItemType.blockTypeBehavior} theme={this.props.theme}>
          <EditorHeaderBar
            itemId={bt.id}
            itemType={ProjectItemType.blockTypeBehavior}
            typeName={this.props.intl.formatMessage({ id: "project_editor.block.type_name" })}
            formatVersion={bt.formatVersion}
          />
          <EditorHeaderTabs>
            <Stack direction="row" spacing={0.5} aria-label="Block type actions">
              <Button
                onClick={this._setOverviewMode}
                title={this.props.intl.formatMessage({ id: "project_editor.block.tooltip_overview" })}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faHome} className="fa-lg" />}
                  text={"Overview"}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === BlockTypeEditorMode.overview}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={this._setStatesMode}
                title={this.props.intl.formatMessage(
                  { id: "project_editor.block.tooltip_states" },
                  { count: stateCount }
                )}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faSliders} className="fa-lg" />}
                  text={statesLabel}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === BlockTypeEditorMode.states}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={this._setComponentsMode}
                title={this.props.intl.formatMessage(
                  { id: "project_editor.block.tooltip_components" },
                  { componentCount, permutationCount }
                )}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faSquarePlus} className="fa-lg" />}
                  text={componentsLabel}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === BlockTypeEditorMode.components}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={this._setActionsMode}
                title={this.props.intl.formatMessage({ id: "project_editor.block.tooltip_actions" })}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faBolt} className="fa-lg" />}
                  text={"Actions"}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === BlockTypeEditorMode.actions}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={this._setVisualsMode}
                title={this.props.intl.formatMessage({ id: "project_editor.block.tooltip_visuals" })}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faCow} className="fa-lg" />}
                  text={"Visuals"}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === BlockTypeEditorMode.visuals}
                  theme={this.props.theme}
                />
              </Button>
            </Stack>
          </EditorHeaderTabs>
        </EditorHeaderChip>

        <div className="bte-mainArea">{modeArea}</div>
      </div>
    );
  }
}

export default withLocalization(BlockTypeEditor);

import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./BlockTypeEditor.css";
import Database from "../minecraft/Database";
import DataFormUtilities from "../dataform/DataFormUtilities";
import { ThemeInput } from "@fluentui/styles";
import BlockTypeBehaviorDefinition from "../minecraft/BlockTypeBehaviorDefinition";
import ProjectItem from "../app/ProjectItem";
import BlockTypeComponentSetEditor from "./BlockTypeComponentSetEditor";
import { CustomTabLabel } from "./Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import WebUtilities from "./WebUtilities";
import { faBolt, faBone, faCow, faSliders } from "@fortawesome/free-solid-svg-icons";
import { Toolbar } from "@fluentui/react-northstar";

export enum BlockTypeEditorMode {
  properties = 0,
  actions = 1,
  visuals = 2,
  audio = 3,
  loot = 5,
}

interface IBlockTypeEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  item: ProjectItem;
  theme: ThemeInput<any>;
}

interface IBlockTypeEditorState {
  fileToEdit: IFile;
  mode: BlockTypeEditorMode;
  isLoaded: boolean;
}

export default class BlockTypeEditor extends Component<IBlockTypeEditorProps, IBlockTypeEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: IBlockTypeEditorProps) {
    super(props);

    this._handleBlockTypeLoaded = this._handleBlockTypeLoaded.bind(this);
    this._addComponentClick = this._addComponentClick.bind(this);
    this._addComponent = this._addComponent.bind(this);
    this._setPropertiesMode = this._setPropertiesMode.bind(this);
    this._setActionsMode = this._setActionsMode.bind(this);
    this._setAudioMode = this._setAudioMode.bind(this);
    this._setLootMode = this._setLootMode.bind(this);
    this._setVisualsMode = this._setVisualsMode.bind(this);

    this.state = {
      fileToEdit: props.file,
      mode: BlockTypeEditorMode.properties,
      isLoaded: false,
    };

    this._updateManager(false);
  }

  static getDerivedStateFromProps(props: IBlockTypeEditorProps, state: IBlockTypeEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        mode: BlockTypeEditorMode.properties,
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

  componentDidUpdate(prevProps: IBlockTypeEditorProps, prevState: IBlockTypeEditorState) {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await BlockTypeBehaviorDefinition.ensureOnFile(this.state.fileToEdit, this._handleBlockTypeLoaded);
      }
    }

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof BlockTypeBehaviorDefinition &&
      (this.state.fileToEdit.manager as BlockTypeBehaviorDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate(setState);
    }
  }

  _handleBlockTypeLoaded(blockType: BlockTypeBehaviorDefinition, typeA: BlockTypeBehaviorDefinition) {
    this._doUpdate(true);
  }

  async _doUpdate(setState: boolean) {
    if (setState) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        isLoaded: true,
      });
    } else {
      this.state = {
        fileToEdit: this.props.file,
        mode: this.state.mode,
        isLoaded: true,
      };
    }
  }

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager !== null) {
        const bt = file.manager as BlockTypeBehaviorDefinition;

        bt.persist();
      }
    }
  }

  _setPropertiesMode() {
    this._setMode(BlockTypeEditorMode.properties);
  }

  _setActionsMode() {
    this._setMode(BlockTypeEditorMode.actions);
  }

  _setVisualsMode() {
    this._setMode(BlockTypeEditorMode.visuals);
  }

  _setAudioMode() {
    this._setMode(BlockTypeEditorMode.audio);
  }

  _setLootMode() {
    this._setMode(BlockTypeEditorMode.loot);
  }

  _setMode(mode: BlockTypeEditorMode) {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      isLoaded: this.state.isLoaded,
      mode: mode,
    });
  }

  async _addComponentClick() {
    await this._addComponent("minecraft:tameable");

    this.forceUpdate();
  }

  async _addComponent(name: string) {
    if (Database.uxCatalog === null) {
      return;
    }

    const form = await Database.ensureFormLoaded(name);

    if (form !== undefined) {
      const newDataObject = DataFormUtilities.generateDefaultItem(form);

      const bt = this.state.fileToEdit.manager as BlockTypeBehaviorDefinition;

      if (bt.behaviorPackBlockTypeDef === undefined) {
        return;
      }

      bt.behaviorPackBlockTypeDef.components[name] = newDataObject;
    }
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const toolbarItems = [];
    const width = WebUtilities.getWidth();
    let isButtonCompact = false;

    if (width < 1016) {
      isButtonCompact = true;
    }

    if (
      this.state === null ||
      this.state.fileToEdit === null ||
      this.state.fileToEdit.manager === undefined ||
      Database.uxCatalog === null
    ) {
      if (this.state.fileToEdit !== null) {
        if (this.state.fileToEdit.manager === undefined) {
          this._updateManager(true);
        }
      }

      return <div>Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faSliders} className="fa-lg" />}
          text={"Properties"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === BlockTypeEditorMode.properties}
          theme={this.props.theme}
        />
      ),
      key: "btePropertiesTab",
      onClick: this._setPropertiesMode,
      title: "Edit documentation by types",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faBolt} className="fa-lg" />}
          text={"Actions"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === BlockTypeEditorMode.actions}
          theme={this.props.theme}
        />
      ),
      key: "bteActionsTab",
      onClick: this._setActionsMode,
      title: "Edit documentation by types that need edits",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faCow} className="fa-lg" />}
          text={"Visuals"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === BlockTypeEditorMode.visuals}
          theme={this.props.theme}
        />
      ),
      key: "bteVisualsTab",
      onClick: this._setVisualsMode,
      title: "Edit documentation by types that need edits",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faBone} className="fa-lg" />}
          text={"Loot"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === BlockTypeEditorMode.loot}
          theme={this.props.theme}
        />
      ),
      key: "bteLootTableTab",
      onClick: this._setLootMode,
      title: "Loot",
    });

    const bt = this.state.fileToEdit.manager as BlockTypeBehaviorDefinition;

    if (bt.behaviorPackBlockTypeDef === undefined) {
      return <div>Loading behavior pack...</div>;
    }

    let mode = <></>;

    if (this.state.mode === BlockTypeEditorMode.properties) {
      mode = (
        <div>
          <BlockTypeComponentSetEditor
            blockTypeItem={bt}
            theme={this.props.theme}
            isDefault={true}
            heightOffset={this.props.heightOffset + 80}
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
        <div
          className="bte-header"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          {bt.id}
        </div>
        <div
          className="bte-toolBarArea"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          <Toolbar aria-label="Actions toolbar overflow menu" items={toolbarItems} />
        </div>
        {mode}
      </div>
    );
  }
}

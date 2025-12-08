import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./ItemTypeEditor.css";
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import ProjectItem from "../app/ProjectItem";
import ItemTypeComponentSetEditor from "./ItemTypeComponentSetEditor";
import Project from "../app/Project";
import CreatorTools from "../app/CreatorTools";
import { CustomTabLabel } from "./Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSquarePlus } from "@fortawesome/free-regular-svg-icons";
import WebUtilities from "./WebUtilities";
import { faBolt, faCow } from "@fortawesome/free-solid-svg-icons";
import { Toolbar } from "@fluentui/react-northstar";
import ItemTypeActionEditor from "./ItemTypeActionEditor";
import { ProjectItemType } from "../app/IProjectItemData";
import ItemTypeAttachableEditor from "./ItemTypeAttachableEditor";
import telemetry from "../analytics/Telemetry";
import { TelemetryEvents, TelemetryProperties } from "../analytics/TelemetryConstants";

interface IItemTypeEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  item: ProjectItem;
  project: Project;
  creatorTools: CreatorTools;
  theme: ThemeInput<any>;
}

interface IItemTypeEditorState {
  fileToEdit: IFile;
  mode: ItemTypeEditorMode;
  isLoaded: boolean;
}

export enum ItemTypeEditorMode {
  properties = 1,
  visuals = 2,
  actions = 3,
}

export default class ItemTypeEditor extends Component<IItemTypeEditorProps, IItemTypeEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: IItemTypeEditorProps) {
    super(props);

    this._handleItemTypeLoaded = this._handleItemTypeLoaded.bind(this);
    this._setPropertiesMode = this._setPropertiesMode.bind(this);
    this._setActionsMode = this._setActionsMode.bind(this);
    this._setVisualsMode = this._setVisualsMode.bind(this);

    this.state = {
      fileToEdit: props.file,
      mode: ItemTypeEditorMode.properties,
      isLoaded: false,
    };
  }

  componentDidMount(): void {
    this._updateManager();
  }

  componentDidUpdate(
    prevProps: Readonly<IItemTypeEditorProps>,
    prevState: Readonly<IItemTypeEditorState>,
    snapshot?: any
  ): void {
    if (this.state && this.props.file !== this.state.fileToEdit) {
      this.setState(
        {
          fileToEdit: this.props.file,
          isLoaded: false,
        },
        () => {
          this._updateManager();
        }
      );
    }
  }

  async _updateManager(force?: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        const itbd = await ItemTypeDefinition.ensureOnFile(this.state.fileToEdit, this._handleItemTypeLoaded);

        if (itbd) {
          await itbd.load();
        }

        this._lastFileEdited = this.state.fileToEdit;
      }
    }

    await this.props.item.ensureDependencies();

    this._doUpdate();
  }

  _handleItemTypeLoaded(itemType: ItemTypeDefinition, typeA: ItemTypeDefinition) {
    this._doUpdate();
  }

  async _doUpdate() {
    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof ItemTypeDefinition &&
      (this.state.fileToEdit.manager as ItemTypeDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      this.setState({
        fileToEdit: this.props.file,
        isLoaded: true,
      });
    }
  }

  async persist(): Promise<boolean> {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const et = file.manager as ItemTypeDefinition;

        return et.persist();
      }
    }

    return false;
  }

  _setPropertiesMode() {
    this._setMode(ItemTypeEditorMode.properties);
  }

  _setVisualsMode() {
    this._setMode(ItemTypeEditorMode.visuals);
  }

  _setActionsMode() {
    this._setMode(ItemTypeEditorMode.actions);
  }

  _setMode(mode: ItemTypeEditorMode) {
    telemetry.trackEvent({
      name: TelemetryEvents.ITEM_TYPE_EDITOR_VIEW_CHANGE,
      properties: {
        [TelemetryProperties.MODE]: ItemTypeEditorMode[mode],
      },
    });

    this.setState({
      fileToEdit: this.state.fileToEdit,
      isLoaded: this.state.isLoaded,
      mode: mode,
    });
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const toolbarItems = [];
    const width = WebUtilities.getWidth();
    let isButtonCompact = false;

    if (width < 716) {
      isButtonCompact = true;
    }

    if (
      this.state === null ||
      this.state.fileToEdit === null ||
      this.state.fileToEdit.manager === undefined ||
      Database.uxCatalog === null
    ) {
      return <div className="ite-loading">Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const itbd = this.state.fileToEdit.manager as ItemTypeDefinition;

    if (itbd.data === undefined) {
      return <div className="ite-loading">Loading...</div>;
    }

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faSquarePlus} className="fa-lg" />}
          text={"Components"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === ItemTypeEditorMode.properties}
          theme={this.props.theme}
        />
      ),
      key: "bteComponentsTab",
      onClick: this._setPropertiesMode,
      title: "Edit item base properties",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faBolt} className="fa-lg" />}
          text={"Actions"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === ItemTypeEditorMode.actions}
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
          isSelected={this.state.mode === ItemTypeEditorMode.visuals}
          theme={this.props.theme}
        />
      ),
      key: "bteVisualsTab",
      onClick: this._setVisualsMode,
      title: "Edit item core properties",
    });

    let mode = <></>;

    if (this.state.mode === ItemTypeEditorMode.properties) {
      mode = (
        <div>
          <ItemTypeComponentSetEditor
            itemTypeDefinition={itbd}
            theme={this.props.theme}
            isDefault={true}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
            isVisualsMode={false}
            heightOffset={this.props.heightOffset + 99}
          />
        </div>
      );
    } else if (this.state.mode === ItemTypeEditorMode.visuals) {
      let attachableItem = undefined;
      if (this.props.item && this.props.item.childItems) {
        for (const childItem of this.props.item.childItems) {
          if (childItem.childItem.itemType === ProjectItemType.attachableResourceJson) {
            attachableItem = childItem.childItem;
          }
        }
      }

      if (attachableItem && attachableItem.primaryFile) {
        mode = (
          <div
            className="ite-attachableArea"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background6,
            }}
          >
            <ItemTypeAttachableEditor
              readOnly={this.props.readOnly}
              theme={this.props.theme}
              displayHeader={false}
              item={attachableItem}
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              file={attachableItem.primaryFile}
              heightOffset={this.props.heightOffset + 106}
            />
          </div>
        );
      } else {
        mode = (
          <div>
            <ItemTypeComponentSetEditor
              itemTypeDefinition={itbd}
              theme={this.props.theme}
              isDefault={true}
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              isVisualsMode={true}
              heightOffset={this.props.heightOffset + 106}
            />
          </div>
        );
      }
    } else if (this.state.mode === ItemTypeEditorMode.actions) {
      mode = (
        <div>
          <ItemTypeActionEditor
            isVisualsMode={false}
            itemTypeItem={itbd}
            readOnly={this.props.readOnly}
            item={this.props.item}
            creatorTools={this.props.creatorTools}
            file={this.props.file}
            project={this.props.project}
            theme={this.props.theme}
            heightOffset={this.props.heightOffset + 90}
          />
        </div>
      );
    }

    return (
      <div
        className="ite-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div
          className="ite-header"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          {itbd.id}
        </div>
        <div
          className="ite-toolBarArea"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          <Toolbar aria-label="Actions" items={toolbarItems} />
        </div>
        {mode}
      </div>
    );
  }
}

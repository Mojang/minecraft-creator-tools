import { Component } from "react";
import IFileProps from "../../project/fileExplorer/IFileProps";
import IFile from "../../../storage/IFile";
import "./EntityTypeResourceEditor.css";
import Database from "../../../minecraft/Database";
import DataForm, { IDataFormProps } from "../../../dataformux/DataForm";
import IProperty from "../../../dataform/IProperty";
import EntityTypeResourceDefinition from "../../../minecraft/EntityTypeResourceDefinition";
import ProjectItem from "../../../app/ProjectItem";
import RenderControllerSetDefinition from "../../../minecraft/RenderControllerSetDefinition";
import RenderControllerSetEditor, { RenderControllerSetEditorFocus } from "../renderController/RenderControllerSetEditor";
import { ProjectItemType } from "../../../app/IProjectItemData";
import MinecraftDefinitions from "../../../minecraft/MinecraftDefinitions";
import IPersistable from "../../types/IPersistable";
import { CustomTabLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCube,
  faEye,
  faPaintBrush,
  faPersonWalkingArrowLoopLeft,
  faSliders,
} from "@fortawesome/free-solid-svg-icons";
import { Stack, Button } from "@mui/material";
import SoundCatalogDefinition from "../../../minecraft/SoundCatalogDefinition";
import { ISoundEventSet } from "../../../minecraft/ISoundCatalog";
import SoundEventSetEditor, { SoundEventSetType } from "../sound/SoundEventSetEditor";
import Project from "../../../app/Project";
import CreatorTools from "../../../app/CreatorTools";
import { LazyModelViewer } from "../../appShell/LazyComponents";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import { ProjectEditPreference } from "../../../app/IProjectData";

import IField from "../../../dataform/IField";
import StorageUtilities from "../../../storage/StorageUtilities";

export enum EntityTypeResourceEditorMode {
  preview = 0,
  textures = 1,
  geometry = 2,
  animations = 3,
  materials = 4,
  audio = 5,
}

interface IEntityTypeResourceEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  displayHeader?: boolean;
  project: Project;
  creatorTools?: CreatorTools;
  theme: IProjectTheme;
  item: ProjectItem;
  onOpenProjectItem?: (projectPath: string) => void;
}

interface IEntityTypeResourceEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
  sound: ISoundEventSet | undefined;
  mode: EntityTypeResourceEditorMode;
  renderControllerSets?: RenderControllerSetDefinition[] | undefined;
  entityTypeResource: EntityTypeResourceDefinition | undefined;
  loadTimedOut: boolean;
}

export default class EntityTypeResourceEditor extends Component<
  IEntityTypeResourceEditorProps,
  IEntityTypeResourceEditorState
> {
  private _lastFileEdited?: IFile;
  private _childPersistables: IPersistable[];
  private _loadingTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(props: IEntityTypeResourceEditorProps) {
    super(props);

    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._handleValueAction = this._handleValueAction.bind(this);

    this._setPreviewMode = this._setPreviewMode.bind(this);
    this._setGeometryMode = this._setGeometryMode.bind(this);
    this._setMaterialsMode = this._setMaterialsMode.bind(this);
    this._setAnimationsMode = this._setAnimationsMode.bind(this);
    this._setAudioMode = this._setAudioMode.bind(this);
    this._setTexturesMode = this._setTexturesMode.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
      sound: undefined,
      mode: EntityTypeResourceEditorMode.preview,
      entityTypeResource: undefined,
      loadTimedOut: false,
    };

    this._childPersistables = [];
  }

  static getDerivedStateFromProps(props: IEntityTypeResourceEditorProps, state: IEntityTypeResourceEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        isLoaded: false,
        sound: undefined,
        mode: EntityTypeResourceEditorMode.preview,
        entityTypeResource: undefined,
        loadTimedOut: false,
      };

      return state;
    }

    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;
      state.isLoaded = false;

      return state;
    }

    return null;
  }

  componentDidUpdate(prevProps: IEntityTypeResourceEditorProps, prevState: IEntityTypeResourceEditorState) {
    this._updateManager();
  }

  componentDidMount(): void {
    this._childPersistables = [];

    this._updateManager();
    this._loadingTimeout = setTimeout(() => {
      if (!this.state.isLoaded) {
        this.setState({ loadTimedOut: true });
      }
    }, 20000);
  }

  componentWillUnmount(): void {
    if (this._loadingTimeout) {
      clearTimeout(this._loadingTimeout);
    }
  }

  async _updateManager() {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;
      }
    }

    await Database.ensureFormLoaded("entity", "resource_animations");
    await Database.ensureFormLoaded("entity", "resource_geometry");
    await Database.ensureFormLoaded("entity", "resource_materials");
    await Database.ensureFormLoaded("entity", "resource_textures");
    await Database.ensureFormLoaded("entity", "sound_event");

    if (this.state.fileToEdit && this.state.fileToEdit.manager === undefined) {
      await EntityTypeResourceDefinition.ensureOnFile(this.state.fileToEdit);
    }

    await this.props.item.ensureDependencies();

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof EntityTypeResourceDefinition &&
      (this.state.fileToEdit.manager as EntityTypeResourceDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate();
    }
  }

  async _doUpdate() {
    let selItem = this.state.entityTypeResource;

    if (selItem === undefined && this.state && this.state.fileToEdit && this.state.fileToEdit.manager) {
      selItem = this.state.fileToEdit.manager as EntityTypeResourceDefinition;
    }

    const renderControllerSets: RenderControllerSetDefinition[] = [];

    if (this.props.item && this.props.item.childItems) {
      for (const item of this.props.item.childItems) {
        if (item.childItem.itemType === ProjectItemType.renderControllerJson) {
          const renderControllerSet = (await MinecraftDefinitions.get(item.childItem)) as RenderControllerSetDefinition;

          renderControllerSets.push(renderControllerSet);
        }
      }
    }

    const etrd = await EntityTypeResourceDefinition.ensureOnFile(this.state.fileToEdit);

    const items = this.props.item.project.getItemsCopy();
    let soundEvent: ISoundEventSet | undefined = undefined;

    for (const projItem of items) {
      if (projItem.itemType === ProjectItemType.soundCatalog) {
        const soundDef = (await MinecraftDefinitions.get(projItem)) as SoundCatalogDefinition;

        if (
          soundDef &&
          soundDef.data &&
          soundDef.data.entity_sounds &&
          soundDef.data.entity_sounds.entities &&
          etrd &&
          etrd.id
        ) {
          soundEvent = soundDef.data.entity_sounds.entities[etrd.id];
        }
      }
    }

    this.setState({
      fileToEdit: this.state.fileToEdit,
      isLoaded: true,
      mode: this.state.mode,
      sound: soundEvent,
      entityTypeResource: etrd,
      renderControllerSets: renderControllerSets,
    });
  }

  async persist(): Promise<boolean> {
    let didPersist = false;
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const etrd = file.manager as EntityTypeResourceDefinition;

        if (etrd.persist()) {
          didPersist = true;
        }
      }
    }

    if (this._childPersistables) {
      for (const persister of this._childPersistables) {
        if (await persister.persist()) {
          didPersist = true;
        }
      }
    }

    return didPersist;
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    if (!this._childPersistables.includes(newPersistable)) {
      this._childPersistables.push(newPersistable);
    }
  }

  _handleDataFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {
    if (props.tagData && props.directObject) {
      const file = props.tagData as IFile;

      file.setObjectContentIfSemanticallyDifferent(props.directObject);
    }
  }

  _handleValueAction(action: string, field: IField, value: string) {
    if (action === "openProjectItem" && this.props.onOpenProjectItem) {
      // Texture paths in entity resource definitions are relative to the resource pack root
      // (e.g., "textures/entity/biceson_6") and need a file extension to match project items.
      const extensions = [".png", ".tga", ".jpg", ".jpeg"];
      const project = this.props.project;

      for (const ext of extensions) {
        const candidatePath = "/" + value + ext;

        for (const item of project.items) {
          if (
            item.projectPath &&
            StorageUtilities.canonicalizePath(item.projectPath).endsWith(
              StorageUtilities.canonicalizePath(candidatePath)
            )
          ) {
            this.props.onOpenProjectItem(item.projectPath);
            return;
          }
        }
      }
    }
  }

  _setMode(mode: EntityTypeResourceEditorMode) {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      isLoaded: this.state.isLoaded,
      mode: mode,
    });
  }

  _setTexturesMode() {
    this._setMode(EntityTypeResourceEditorMode.textures);
  }

  _setPreviewMode() {
    this._setMode(EntityTypeResourceEditorMode.preview);
  }

  _setGeometryMode() {
    this._setMode(EntityTypeResourceEditorMode.geometry);
  }

  _setMaterialsMode() {
    this._setMode(EntityTypeResourceEditorMode.materials);
  }

  _setAnimationsMode() {
    this._setMode(EntityTypeResourceEditorMode.animations);
  }

  _setAudioMode() {
    this._setMode(EntityTypeResourceEditorMode.audio);
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    if (
      this.state === null ||
      this.state.fileToEdit === null ||
      this.state.fileToEdit.manager === undefined ||
      Database.uxCatalog === null
    ) {
      if (this.state && this.state.loadTimedOut) {
        return (
          <div className="etre-loading">
            <div>Unable to load entity resource data.</div>
            <button
              className="etre-retry-button"
              onClick={() => {
                this.setState({ loadTimedOut: false });
                this._loadingTimeout = setTimeout(() => {
                  if (!this.state.isLoaded) {
                    this.setState({ loadTimedOut: true });
                  }
                }, 20000);
                this._updateManager();
              }}
            >
              Retry
            </button>
          </div>
        );
      }
      return <div className="etre-loading">Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    let isButtonCompact = false;

    const resourceDefinition = this.state.fileToEdit.manager as EntityTypeResourceDefinition;
    const def = resourceDefinition.dataWrapper;

    if (def === undefined) {
      if (this.state.loadTimedOut) {
        return (
          <div className="etre-loading">
            <div>Unable to load definition data.</div>
            <button
              className="etre-retry-button"
              onClick={() => {
                this.setState({ loadTimedOut: false });
                this._loadingTimeout = setTimeout(() => {
                  if (!this.state.isLoaded) {
                    this.setState({ loadTimedOut: true });
                  }
                }, 20000);
                this._updateManager();
              }}
            >
              Retry
            </button>
          </div>
        );
      }
      return <div className="etre-loading">Loading definition...</div>;
    }

    let resourceData = resourceDefinition.ensureData();

    let form = undefined;
    let focus = RenderControllerSetEditorFocus.all;

    if (this.state.mode === EntityTypeResourceEditorMode.textures) {
      form = Database.getForm("entity", "resource_textures");
      focus = RenderControllerSetEditorFocus.textures;
    } else if (this.state.mode === EntityTypeResourceEditorMode.geometry) {
      form = Database.getForm("entity", "resource_geometry");
      focus = RenderControllerSetEditorFocus.geometry;
    } else if (this.state.mode === EntityTypeResourceEditorMode.materials) {
      form = Database.getForm("entity", "resource_materials");
      focus = RenderControllerSetEditorFocus.materials;
    } else if (this.state.mode === EntityTypeResourceEditorMode.animations) {
      form = Database.getForm("entity", "resource_animations");
    }

    let header = <></>;
    if (this.props.displayHeader === undefined || this.props.displayHeader) {
      const headerColors = getThemeColors();
      header = (
        <div
          className="etre-header"
          key="etrehd"
          style={{
            backgroundColor: headerColors.background1,
            color: headerColors.foreground2,
          }}
        >
          Entity Type Visuals and Audio
        </div>
      );
    }

    let renderControllerEditors = [];

    let renderControllerHeader = <></>;

    if (
      this.state.renderControllerSets &&
      this.state.renderControllerSets.length > 0 &&
      this.state.mode !== EntityTypeResourceEditorMode.audio &&
      this.state.mode !== EntityTypeResourceEditorMode.animations &&
      this.state.mode !== EntityTypeResourceEditorMode.preview
    ) {
      let rcTitle = "Render Controllers";
      let rcDescrip =
        "Render controllers tell Minecraft how to select a texture, geometry model, and material rendering strategy based on the configuration of the mob.";

      if (this.state.mode === EntityTypeResourceEditorMode.textures) {
        rcTitle = "Texture render controllers";
        rcDescrip =
          "Texture render controllers tell Minecraft how to select a texture based on the configuration of the mob.";
      } else if (this.state.mode === EntityTypeResourceEditorMode.geometry) {
        rcTitle = "Geometry render controllers";
        rcDescrip =
          "Geometry render controllers tell Minecraft how to select a geometry model based on the configuration of the mob.";
      } else if (this.state.mode === EntityTypeResourceEditorMode.materials) {
        rcTitle = "Materials render controllers";
        rcDescrip =
          "Materials render controllers tell Minecraft how to select a material render strategy based on the configuration of the mob.";
      }

      renderControllerHeader = (
        <div className="etre-rc-header" key="rch">
          <div className="etre-header-interior">{rcTitle}</div>
          <div>{rcDescrip}</div>
        </div>
      );

      let i = 0;
      for (const renderControllerSet of this.state.renderControllerSets) {
        renderControllerEditors.push(
          <RenderControllerSetEditor
            theme={this.props.theme}
            displayHeader={false}
            key={"etrscrc" + i}
            project={this.props.project}
            heightOffset={this.props.heightOffset}
            readOnly={this.props.readOnly}
            isInline={true}
            focus={focus}
            renderControllerSet={renderControllerSet}
            setActivePersistable={this._handleNewChildPersistable}
          />
        );
        i++;
      }
    }

    let mainInterior = <></>;

    if (this.state.mode === EntityTypeResourceEditorMode.preview) {
      // Find a geometry project item from the entity's children
      let geometryItem: ProjectItem | undefined = undefined;

      if (this.props.item && this.props.item.childItems) {
        for (const childRef of this.props.item.childItems) {
          if (childRef.childItem.itemType === ProjectItemType.modelGeometryJson) {
            geometryItem = childRef.childItem;
            break;
          }
        }
      }

      if (geometryItem && this.props.creatorTools) {
        const viewerHeight = this.props.heightOffset + 50;

        mainInterior = (
          <div className="etre-preview-container">
            <LazyModelViewer
              key={"etremv" + geometryItem.projectPath}
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              heightOffset={viewerHeight}
              readOnly={this.props.readOnly}
              projectItem={geometryItem}
            />
          </div>
        );
      } else {
        mainInterior = (
          <div className="etre-empty-state">
            <div className="etre-empty-state-icon">
              <FontAwesomeIcon icon={faEye} className="fa-2x" />
            </div>
            <div className="etre-empty-state-title">No 3D Preview Available</div>
            <div className="etre-empty-state-message">
              This entity does not have associated geometry that can be previewed. Add geometry references to enable 3D
              preview.
            </div>
          </div>
        );
      }
    } else if (this.state.mode === EntityTypeResourceEditorMode.audio) {
      if (this.state.entityTypeResource && this.state.entityTypeResource.id) {
        mainInterior = (
          <SoundEventSetEditor
            readOnly={this.props.readOnly}
            displayHeader={false}
            key={"sevse"}
            typeId={this.state.entityTypeResource?.id}
            eventType={SoundEventSetType.entity}
            project={this.props.item.project}
            theme={this.props.theme}
            creatorTools={this.props.item.project.creatorTools}
          />
        );
      }
    } else if (form) {
      mainInterior = (
        <DataForm
          definition={form}
          key={"sevdf"}
          project={this.props.project}
          lookupProvider={this.props.project}
          directObject={resourceData}
          readOnly={false}
          theme={this.props.theme}
          objectKey={this.props.file.storageRelativePath}
          onPropertyChanged={this._handleDataFormPropertyChange}
          onValueAction={this._handleValueAction}
        ></DataForm>
      );
    }

    return (
      <div
        className="etre-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        {header}
        <div className="etre-mainArea">
          {this.props.project.effectiveEditPreference !== ProjectEditPreference.summarized && (
            <div className="etre-toolBarArea">
              <Stack direction="row" spacing={0.5} aria-label="Actions">
                <Button onClick={this._setPreviewMode} title="Preview — See how your mob looks in 3D">
                  <CustomTabLabel
                    icon={<FontAwesomeIcon icon={faEye} className="fa-lg" />}
                    text={"Preview"}
                    isCompact={isButtonCompact}
                    isSelected={this.state.mode === EntityTypeResourceEditorMode.preview}
                    theme={this.props.theme}
                  />
                </Button>
                <Button onClick={this._setTexturesMode} title="Textures — Manage mob skin textures">
                  <CustomTabLabel
                    icon={<FontAwesomeIcon icon={faPaintBrush} className="fa-lg" />}
                    text={"Textures"}
                    isCompact={isButtonCompact}
                    isSelected={this.state.mode === EntityTypeResourceEditorMode.textures}
                    theme={this.props.theme}
                  />
                </Button>
                <Button onClick={this._setGeometryMode} title="Geometry — Edit mob 3D models">
                  <CustomTabLabel
                    icon={<FontAwesomeIcon icon={faCube} className="fa-lg" />}
                    text={"Geometry"}
                    isCompact={isButtonCompact}
                    isSelected={this.state.mode === EntityTypeResourceEditorMode.geometry}
                    theme={this.props.theme}
                  />
                </Button>
                <Button onClick={this._setMaterialsMode} title="Materials — Configure rendering materials">
                  <CustomTabLabel
                    icon={<FontAwesomeIcon icon={faSliders} className="fa-lg" />}
                    text={"Materials"}
                    isCompact={isButtonCompact}
                    isSelected={this.state.mode === EntityTypeResourceEditorMode.materials}
                    theme={this.props.theme}
                  />
                </Button>
                <Button onClick={this._setAnimationsMode} title="Animations — Manage mob movement animations">
                  <CustomTabLabel
                    icon={<FontAwesomeIcon icon={faPersonWalkingArrowLoopLeft} className="fa-lg" />}
                    text={"Animations"}
                    isCompact={isButtonCompact}
                    isSelected={this.state.mode === EntityTypeResourceEditorMode.animations}
                    theme={this.props.theme}
                  />
                </Button>
              </Stack>
            </div>
          )}

          <div className="etre-form">{mainInterior}</div>
          {renderControllerHeader}
          <div>{renderControllerEditors}</div>
        </div>
      </div>
    );
  }
}

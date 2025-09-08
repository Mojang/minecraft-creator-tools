import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./EntityTypeResourceEditor.css";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import IProperty from "../dataform/IProperty";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import ProjectItem from "../app/ProjectItem";
import RenderControllerSetDefinition from "../minecraft/RenderControllerSetDefinition";
import RenderControllerSetEditor, { RenderControllerSetEditorFocus } from "./RenderControllerSetEditor";
import { ProjectItemType } from "../app/IProjectItemData";
import MinecraftDefinitions from "../minecraft/MinecraftDefinitions";
import IPersistable from "./IPersistable";
import { CustomTabLabel } from "./Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCube,
  faPaintBrush,
  faPersonWalkingArrowLoopLeft,
  faSliders,
  faVolumeUp,
} from "@fortawesome/free-solid-svg-icons";
import { Toolbar } from "@fluentui/react-northstar";
import SoundCatalogDefinition from "../minecraft/SoundCatalogDefinition";
import { ISoundEventSet } from "../minecraft/ISoundCatalog";
import SoundEventSetEditor, { SoundEventSetType } from "./SoundEventSetEditor";
import Project from "../app/Project";

export enum EntityTypeResourceEditorMode {
  textures = 0,
  geometry = 1,
  animations = 2,
  materials = 3,
  audio = 4,
}

interface IEntityTypeResourceEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  displayHeader?: boolean;
  project: Project;
  theme: ThemeInput<any>;
  item: ProjectItem;
}

interface IEntityTypeResourceEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
  sound: ISoundEventSet | undefined;
  mode: EntityTypeResourceEditorMode;
  renderControllerSets?: RenderControllerSetDefinition[] | undefined;
  entityTypeResource: EntityTypeResourceDefinition | undefined;
}

export default class EntityTypeResourceEditor extends Component<
  IEntityTypeResourceEditorProps,
  IEntityTypeResourceEditorState
> {
  private _lastFileEdited?: IFile;
  private _childPersistables: IPersistable[];

  constructor(props: IEntityTypeResourceEditorProps) {
    super(props);

    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);

    this._setGeometryMode = this._setGeometryMode.bind(this);
    this._setMaterialsMode = this._setMaterialsMode.bind(this);
    this._setAnimationsMode = this._setAnimationsMode.bind(this);
    this._setAudioMode = this._setAudioMode.bind(this);
    this._setTexturesMode = this._setTexturesMode.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
      sound: undefined,
      mode: EntityTypeResourceEditorMode.textures,
      entityTypeResource: undefined,
    };

    this._childPersistables = [];
  }

  static getDerivedStateFromProps(props: IEntityTypeResourceEditorProps, state: IEntityTypeResourceEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        isLoaded: false,
        sound: undefined,
        mode: EntityTypeResourceEditorMode.textures,
        entityTypeResource: undefined,
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

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const srbd = file.manager as EntityTypeResourceDefinition;

        srbd.persist();
      }
    }

    if (this._childPersistables) {
      for (const persister of this._childPersistables) {
        persister.persist();
      }
    }
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    if (!this._childPersistables.includes(newPersistable)) {
      this._childPersistables.push(newPersistable);
    }
  }

  _handleDataFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {
    if (props.tagData && props.directObject) {
      const file = props.tagData as IFile;

      const newData = JSON.stringify(props.directObject, null, 2);

      file.setContent(newData);
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
    const toolbarItems = [];

    if (
      this.state === null ||
      this.state.fileToEdit === null ||
      this.state.fileToEdit.manager === undefined ||
      Database.uxCatalog === null
    ) {
      return <div className="etre-loading">Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    let isButtonCompact = false;

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faPaintBrush} className="fa-lg" />}
          text={"Textures"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EntityTypeResourceEditorMode.textures}
          theme={this.props.theme}
        />
      ),
      key: "etreTexturesTab",
      onClick: this._setTexturesMode,
      title: "Textures",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faCube} className="fa-lg" />}
          text={"Geometry"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EntityTypeResourceEditorMode.geometry}
          theme={this.props.theme}
        />
      ),
      key: "etreGeometryTab",
      onClick: this._setGeometryMode,
      title: "Geometry",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faSliders} className="fa-lg" />}
          text={"Materials"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EntityTypeResourceEditorMode.materials}
          theme={this.props.theme}
        />
      ),
      key: "etreMaterialsTab",
      onClick: this._setMaterialsMode,
      title: "Materials",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faPersonWalkingArrowLoopLeft} className="fa-lg" />}
          text={"Animations"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EntityTypeResourceEditorMode.animations}
          theme={this.props.theme}
        />
      ),
      key: "etreAnimationsTab",
      onClick: this._setAnimationsMode,
      title: "Animations",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faVolumeUp} className="fa-lg" />}
          text={"Audio"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EntityTypeResourceEditorMode.audio}
          theme={this.props.theme}
        />
      ),
      key: "etreAudioTab",
      onClick: this._setAudioMode,
      title: "Audio",
    });

    const resourceDefinition = this.state.fileToEdit.manager as EntityTypeResourceDefinition;
    const def = resourceDefinition.dataWrapper;

    if (def === undefined) {
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
      header = (
        <div
          className="etre-header"
          key="etrehd"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
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
      this.state.mode !== EntityTypeResourceEditorMode.animations
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

    if (this.state.mode === EntityTypeResourceEditorMode.audio) {
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
            carto={this.props.item.project.carto}
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
          <div
            className="etre-toolBarArea"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            }}
          >
            <Toolbar aria-label="Actions toolbar overflow menu" items={toolbarItems} />
          </div>

          <div className="etre-form">{mainInterior}</div>
          {renderControllerHeader}
          <div>{renderControllerEditors}</div>
        </div>
      </div>
    );
  }
}

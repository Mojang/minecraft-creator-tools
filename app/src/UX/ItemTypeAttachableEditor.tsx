import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./ItemTypeAttachableEditor.css";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import IProperty from "../dataform/IProperty";
import ProjectItem from "../app/ProjectItem";
import RenderControllerSetDefinition from "../minecraft/RenderControllerSetDefinition";
import RenderControllerSetEditor, { RenderControllerSetEditorFocus } from "./RenderControllerSetEditor";
import { ProjectItemType } from "../app/IProjectItemData";
import MinecraftDefinitions from "../minecraft/MinecraftDefinitions";
import IPersistable from "./IPersistable";
import { CustomTabLabel } from "./Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCube, faPaintBrush, faPersonWalkingArrowLoopLeft, faSliders } from "@fortawesome/free-solid-svg-icons";
import { Toolbar } from "@fluentui/react-northstar";
import Project from "../app/Project";
import AttachableResourceDefinition from "../minecraft/AttachableResourceDefinition";
import ItemTypeComponentSetEditor from "./ItemTypeComponentSetEditor";
import Carto from "../app/Carto";
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import { faSquarePlus } from "@fortawesome/free-regular-svg-icons";

export enum ItemTypeAttachableEditorMode {
  textures = 0,
  geometry = 1,
  animations = 2,
  materials = 3,
  components = 4,
}

interface IItemTypeAttachableEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  carto: Carto;
  displayHeader?: boolean;
  project: Project;
  theme: ThemeInput<any>;
  projectItem: ProjectItem;
}

interface IItemTypeAttachableEditorState {
  fileToEdit: IFile;
  behaviorFileToEdit?: IFile | undefined;
  behaviorItem?: ProjectItem | undefined;
  behaviorDefinition?: ItemTypeDefinition | undefined;
  isLoaded: boolean;
  mode: ItemTypeAttachableEditorMode;
  renderControllerSets?: RenderControllerSetDefinition[] | undefined;
  attachable: AttachableResourceDefinition | undefined;
}

export default class ItemTypeAttachableEditor extends Component<
  IItemTypeAttachableEditorProps,
  IItemTypeAttachableEditorState
> {
  private _lastFileEdited?: IFile;
  private _childPersistables: IPersistable[];

  constructor(props: IItemTypeAttachableEditorProps) {
    super(props);

    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);

    this._setComponentsMode = this._setComponentsMode.bind(this);
    this._setGeometryMode = this._setGeometryMode.bind(this);
    this._setMaterialsMode = this._setMaterialsMode.bind(this);
    this._setAnimationsMode = this._setAnimationsMode.bind(this);
    this._setTexturesMode = this._setTexturesMode.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
      mode: ItemTypeAttachableEditorMode.textures,
      attachable: undefined,
    };

    this._childPersistables = [];
  }

  static getDerivedStateFromProps(props: IItemTypeAttachableEditorProps, state: IItemTypeAttachableEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        isLoaded: false,
        mode: ItemTypeAttachableEditorMode.textures,
        attachable: undefined,
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

  componentDidUpdate(prevProps: IItemTypeAttachableEditorProps, prevState: IItemTypeAttachableEditorState) {
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

    await Database.ensureFormLoaded("client_item", "resource_animations");
    await Database.ensureFormLoaded("client_item", "resource_geometry");
    await Database.ensureFormLoaded("client_item", "resource_materials");
    await Database.ensureFormLoaded("client_item", "resource_textures");

    if (this.state.fileToEdit && this.state.fileToEdit.manager === undefined) {
      await AttachableResourceDefinition.ensureOnFile(this.state.fileToEdit);
    }

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof AttachableResourceDefinition &&
      (this.state.fileToEdit.manager as AttachableResourceDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate();
    }
  }

  async _doUpdate() {
    let selItem = this.state.attachable;

    if (selItem === undefined && this.state && this.state.fileToEdit && this.state.fileToEdit.manager) {
      selItem = this.state.fileToEdit.manager as AttachableResourceDefinition;
    }

    const renderControllerSets: RenderControllerSetDefinition[] = [];

    if (this.props.projectItem && this.props.projectItem.childItems) {
      for (const item of this.props.projectItem.childItems) {
        if (item.childItem.itemType === ProjectItemType.renderControllerJson) {
          const renderControllerSet = (await MinecraftDefinitions.get(item.childItem)) as RenderControllerSetDefinition;

          renderControllerSets.push(renderControllerSet);
        }
      }
    }

    const etrd = await AttachableResourceDefinition.ensureOnFile(this.state.fileToEdit);

    let parentBehaviorItem = undefined;
    let parentBehaviorFile = undefined;
    let parentBehaviorDefinition = undefined;

    if (this.props.projectItem && this.props.projectItem.parentItems) {
      for (const parentItem of this.props.projectItem.parentItems) {
        if (parentItem.parentItem.itemType === ProjectItemType.itemTypeBehavior) {
          parentBehaviorItem = parentItem.parentItem;

          await parentBehaviorItem.ensureStorage();

          if (parentBehaviorItem.defaultFile) {
            parentBehaviorFile = parentBehaviorItem.defaultFile;
            parentBehaviorDefinition = await ItemTypeDefinition.ensureOnFile(parentBehaviorFile);
          }
        }
      }
    }

    this.setState({
      fileToEdit: this.state.fileToEdit,
      isLoaded: true,
      behaviorItem: parentBehaviorItem,
      behaviorFileToEdit: parentBehaviorFile,
      behaviorDefinition: parentBehaviorDefinition,
      mode: this.state.mode,
      attachable: etrd,
      renderControllerSets: renderControllerSets,
    });
  }

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager !== null) {
        const srbd = file.manager as AttachableResourceDefinition;

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

  _setMode(mode: ItemTypeAttachableEditorMode) {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      isLoaded: this.state.isLoaded,
      mode: mode,
    });
  }

  _setComponentsMode() {
    this._setMode(ItemTypeAttachableEditorMode.components);
  }

  _setTexturesMode() {
    this._setMode(ItemTypeAttachableEditorMode.textures);
  }

  _setGeometryMode() {
    this._setMode(ItemTypeAttachableEditorMode.geometry);
  }

  _setMaterialsMode() {
    this._setMode(ItemTypeAttachableEditorMode.materials);
  }

  _setAnimationsMode() {
    this._setMode(ItemTypeAttachableEditorMode.animations);
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
      return <div className="itae-loading">Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    let isButtonCompact = false;

    if (this.state.behaviorItem) {
      toolbarItems.push({
        icon: (
          <CustomTabLabel
            icon={<FontAwesomeIcon icon={faSquarePlus} className="fa-lg" />}
            text={"Components"}
            isCompact={isButtonCompact}
            isSelected={this.state.mode === ItemTypeAttachableEditorMode.components}
            theme={this.props.theme}
          />
        ),
        key: "itaeComponentsTab",
        onClick: this._setComponentsMode,
        title: "Components",
      });
    }

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faPaintBrush} className="fa-lg" />}
          text={"Textures"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === ItemTypeAttachableEditorMode.textures}
          theme={this.props.theme}
        />
      ),
      key: "itaeTexturesTab",
      onClick: this._setTexturesMode,
      title: "Textures",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faCube} className="fa-lg" />}
          text={"Geometry"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === ItemTypeAttachableEditorMode.geometry}
          theme={this.props.theme}
        />
      ),
      key: "itaeGeometryTab",
      onClick: this._setGeometryMode,
      title: "Geometry",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faSliders} className="fa-lg" />}
          text={"Materials"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === ItemTypeAttachableEditorMode.materials}
          theme={this.props.theme}
        />
      ),
      key: "itaeMaterialsTab",
      onClick: this._setMaterialsMode,
      title: "Materials",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faPersonWalkingArrowLoopLeft} className="fa-lg" />}
          text={"Animations"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === ItemTypeAttachableEditorMode.animations}
          theme={this.props.theme}
        />
      ),
      key: "itaeAnimationsTab",
      onClick: this._setAnimationsMode,
      title: "Animations",
    });

    const resourceDefinition = this.state.fileToEdit.manager as AttachableResourceDefinition;
    const def = resourceDefinition.data;

    if (def === undefined) {
      return <div className="itae-loading">Loading definition...</div>;
    }

    let resourceData = resourceDefinition.ensureData();

    let form = undefined;
    let focus = RenderControllerSetEditorFocus.all;

    if (this.state.mode === ItemTypeAttachableEditorMode.textures) {
      form = Database.getForm("client_item", "resource_textures");
      focus = RenderControllerSetEditorFocus.textures;
    } else if (this.state.mode === ItemTypeAttachableEditorMode.geometry) {
      form = Database.getForm("client_item", "resource_geometry");
      focus = RenderControllerSetEditorFocus.geometry;
    } else if (this.state.mode === ItemTypeAttachableEditorMode.materials) {
      form = Database.getForm("client_item", "resource_materials");
      focus = RenderControllerSetEditorFocus.materials;
    } else if (this.state.mode === ItemTypeAttachableEditorMode.animations) {
      form = Database.getForm("client_item", "resource_animations");
    }

    let header = <></>;
    if (this.props.displayHeader === undefined || this.props.displayHeader) {
      header = (
        <div
          className="itae-header"
          key="itaehd"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
          }}
        >
          Item Type Visuals and Audio
        </div>
      );
    }

    let renderControllerEditors = [];

    let renderControllerHeader = <></>;

    if (
      this.state.renderControllerSets &&
      this.state.renderControllerSets.length > 0 &&
      this.state.mode !== ItemTypeAttachableEditorMode.animations
    ) {
      let rcTitle = "Render Controllers";
      let rcDescrip =
        "Render controllers tell Minecraft how to select a texture, geometry model, and material rendering strategy based on the configuration of the mob.";

      if (this.state.mode === ItemTypeAttachableEditorMode.textures) {
        rcTitle = "Texture render controllers";
        rcDescrip =
          "Texture render controllers tell Minecraft how to select a texture based on the configuration of the mob.";
      } else if (this.state.mode === ItemTypeAttachableEditorMode.geometry) {
        rcTitle = "Geometry render controllers";
        rcDescrip =
          "Geometry render controllers tell Minecraft how to select a geometry model based on the configuration of the mob.";
      } else if (this.state.mode === ItemTypeAttachableEditorMode.materials) {
        rcTitle = "Materials render controllers";
        rcDescrip =
          "Materials render controllers tell Minecraft how to select a material render strategy based on the configuration of the mob.";
      }

      renderControllerHeader = (
        <div className="itae-rc-header" key="rch">
          <div className="itae-header-interior">{rcTitle}</div>
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

    if (this.state.behaviorDefinition && this.state.mode === ItemTypeAttachableEditorMode.components) {
      mainInterior = (
        <ItemTypeComponentSetEditor
          itemTypeDefinition={this.state.behaviorDefinition}
          theme={this.props.theme}
          isDefault={true}
          project={this.props.project}
          carto={this.props.carto}
          isVisualsMode={true}
          heightOffset={this.props.heightOffset + 60}
        />
      );
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
        className="itae-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        {header}
        <div className="itae-mainArea">
          <div
            className="itae-toolBarArea"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            }}
          >
            <Toolbar aria-label="Actions toolbar overflow menu" items={toolbarItems} />
          </div>

          <div className="itae-form">{mainInterior}</div>
          {renderControllerHeader}
          <div>{renderControllerEditors}</div>
        </div>
      </div>
    );
  }
}

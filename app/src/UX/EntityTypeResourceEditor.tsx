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
import RenderControllerSetEditor from "./RenderControllerSetEditor";
import { ProjectItemType } from "../app/IProjectItemData";
import MinecraftDefinitions from "../minecraft/MinecraftDefinitions";
import IPersistable from "./IPersistable";

interface IEntityTypeResourceEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  displayHeader?: boolean;
  theme: ThemeInput<any>;
  projectItem: ProjectItem;
}

interface IEntityTypeResourceEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
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

    this._definitionLoaded = this._definitionLoaded.bind(this);
    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
      entityTypeResource: undefined,
    };

    this._childPersistables = [];

    this._updateManager(true);
  }

  static getDerivedStateFromProps(props: IEntityTypeResourceEditorProps, state: IEntityTypeResourceEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        isLoaded: false,
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

  componentDidMount(): void {
    this._childPersistables = [];
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await EntityTypeResourceDefinition.ensureOnFile(this.state.fileToEdit, this._definitionLoaded);
      }
    }

    await Database.ensureFormLoaded("entity_type_resource");

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof EntityTypeResourceDefinition &&
      (this.state.fileToEdit.manager as EntityTypeResourceDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate(setState);
    }
  }

  _definitionLoaded(defA: EntityTypeResourceDefinition, defB: EntityTypeResourceDefinition) {
    this._doUpdate(true);
  }

  async _doUpdate(setState: boolean) {
    let selItem = this.state.entityTypeResource;

    if (selItem === undefined && this.state && this.state.fileToEdit && this.state.fileToEdit.manager) {
      selItem = this.state.fileToEdit.manager as EntityTypeResourceDefinition;
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

    if (setState) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        isLoaded: true,
        entityTypeResource: this.state.entityTypeResource,
        renderControllerSets: renderControllerSets,
      });
    } else {
      this.state = {
        fileToEdit: this.props.file,
        isLoaded: true,
        entityTypeResource: this.state.entityTypeResource,
        renderControllerSets: renderControllerSets,
      };
    }
  }

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager !== null) {
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

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

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

    const definitionFile = this.state.fileToEdit.manager as EntityTypeResourceDefinition;
    const def = definitionFile._dataWrapper;

    if (def === undefined) {
      return <div>Loading definition...</div>;
    }

    let defInner = def["minecraft:client_entity"];
    if (defInner === undefined) {
      defInner = {
        description: {
          identifier: "",
          materials: {},
          textures: {},
          geometry: {},
          animation_controllers: {},
          particle_effects: {},
          animations: {},
          render_controllers: [],
          scripts: {},
        },
      };
      def["minecraft:client_entity"] = defInner;
    }

    const form = Database.getForm("entity_type_resource");

    let header = <></>;
    if (this.props.displayHeader === undefined || this.props.displayHeader) {
      header = <div className="etre-header">Entity Type Resources</div>;
    }

    let renderControllerEditors = [];

    let renderControllerHeader = <></>;

    if (this.state.renderControllerSets && this.state.renderControllerSets.length > 0) {
      renderControllerHeader = (
        <div className="etre-rc-header">
          <div className="etre-header-interior">Render Controllers</div>
          <div>
            Render controllers tell Minecraft how to select a texture, geometry model, and material rendering strategy
            based on the configuration of the mob.
          </div>
        </div>
      );

      for (const renderControllerSet of this.state.renderControllerSets) {
        renderControllerEditors.push(
          <RenderControllerSetEditor
            theme={this.props.theme}
            displayHeader={false}
            heightOffset={this.props.heightOffset}
            readOnly={this.props.readOnly}
            isInline={true}
            renderControllerSet={renderControllerSet}
            setActivePersistable={this._handleNewChildPersistable}
          />
        );
      }
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
          <div className="etre-form">
            <DataForm
              definition={form}
              directObject={defInner.description}
              readOnly={false}
              theme={this.props.theme}
              objectKey={this.props.file.storageRelativePath}
              onPropertyChanged={this._handleDataFormPropertyChange}
            ></DataForm>
          </div>
          {renderControllerHeader}
          <div>{renderControllerEditors}</div>
        </div>
      </div>
    );
  }
}

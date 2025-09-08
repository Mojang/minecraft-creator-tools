import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./BiomeResourceEditor.css";
import Database from "../minecraft/Database";
import DataFormUtilities from "../dataform/DataFormUtilities";
import { ThemeInput } from "@fluentui/styles";
import ProjectItem from "../app/ProjectItem";
import Carto from "../app/Carto";
import Project from "../app/Project";
import DataForm from "../dataform/DataForm";
import BiomeResourceDefinition from "../minecraft/BiomeResourceDefinition";

export enum BiomeResourceEditorMode {
  components = 0,
}

interface IBiomeResourceEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  item: ProjectItem;
  project: Project;
  carto: Carto;
  theme: ThemeInput<any>;
}

interface IBiomeResourceEditorState {
  fileToEdit: IFile;
  mode: BiomeResourceEditorMode;
  isLoaded: boolean;
}

export default class BiomeResourceEditor extends Component<IBiomeResourceEditorProps, IBiomeResourceEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: IBiomeResourceEditorProps) {
    super(props);

    this._handleBiomeLoaded = this._handleBiomeLoaded.bind(this);
    this._addComponent = this._addComponent.bind(this);
    this._setComponentsMode = this._setComponentsMode.bind(this);

    this.state = {
      fileToEdit: props.file,
      mode: BiomeResourceEditorMode.components,
      isLoaded: false,
    };
  }

  static getDerivedStateFromProps(props: IBiomeResourceEditorProps, state: IBiomeResourceEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        mode: BiomeResourceEditorMode.components,
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
    this._updateManager();
  }

  async _updateManager() {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await this._doUpdate();
      }
    }
  }

  _handleBiomeLoaded(biome: BiomeResourceDefinition, typeA: BiomeResourceDefinition) {
    if (this.state) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        mode: this.state.mode,
        isLoaded: true,
      });
    }
  }

  async _doUpdate() {
    let biomeResourceDefinition = this.state.fileToEdit.manager;

    if (biomeResourceDefinition === undefined || !(biomeResourceDefinition instanceof BiomeResourceDefinition)) {
      biomeResourceDefinition = await BiomeResourceDefinition.ensureOnFile(this.state.fileToEdit);
    }

    await Database.ensureFormLoaded("client_biome", "client_biome_components");

    if (biomeResourceDefinition !== undefined) {
      if (!biomeResourceDefinition.isLoaded) {
        biomeResourceDefinition.onLoaded.subscribe(this._handleBiomeLoaded);
      } else {
        this.setState({
          fileToEdit: this.state.fileToEdit,
          mode: this.state.mode,
          isLoaded: true,
        });
      }
    }
  }

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      const biomeDefinition = this.state.fileToEdit.manager;

      if (biomeDefinition !== undefined && biomeDefinition instanceof BiomeResourceDefinition) {
        biomeDefinition.persist();
      }
    }
  }

  _setComponentsMode() {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      mode: BiomeResourceEditorMode.components,
      isLoaded: this.state.isLoaded,
    });
  }

  async _addComponent(name: string) {
    if (Database.uxCatalog === null) {
      return;
    }

    const form = await Database.ensureFormLoaded("biome", name);

    if (form !== undefined) {
      const newDataObject = DataFormUtilities.generateDefaultItem(form);

      const bd = this.state.fileToEdit.manager as BiomeResourceDefinition;

      if (bd._data === undefined) {
        return;
      }

      bd.addComponent(name, newDataObject);
    }
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    if (
      this.state === null ||
      !this.state.isLoaded ||
      this.state.fileToEdit === null ||
      this.state.fileToEdit.manager === undefined ||
      Database.uxCatalog === null
    ) {
      return <div className="bior-loading">Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const biomeDefinition = this.state.fileToEdit.manager as BiomeResourceDefinition;
    const form = Database.getForm("client_biome", "client_biome_components");

    let interior = <></>;

    if (this.state.mode === BiomeResourceEditorMode.components && form) {
      interior = (
        <DataForm
          definition={form}
          directObject={biomeDefinition.clientBiomeData.components}
          readOnly={this.props.readOnly}
          theme={this.props.theme}
        />
      );
    }

    return (
      <div
        className="bior-areaOuter"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
        }}
      >
        <div
          className="bior-area"
          style={{
            minHeight: height,
            maxHeight: height,
          }}
        >
          {interior}
        </div>
      </div>
    );
  }
}

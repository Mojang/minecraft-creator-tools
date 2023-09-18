import { Component } from "react";
import IFile from "./../storage/IFile";
import IFolder from "./../storage/IFolder";
import "./MCWorldEditor.css";
import IPersistable from "./IPersistable";
import MCWorld from "../minecraft/MCWorld";
import Database from "../minecraft/Database";
import WorldView from "../worldux/WorldView";
import IAppProps from "./IAppProps";
import DataForm from "../dataform/DataForm";
import IFormDefinition from "../dataform/IFormDefinition";
import Project from "../app/Project";

interface IMCWorldEditorProps extends IAppProps {
  heightOffset: number;
  project?: Project;
  readOnly: boolean;
  folder?: IFolder;
  file?: IFile;
  displayProps: boolean;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface IMCWorldEditorState {
  fileToEdit: IFile | undefined;
  folderToEdit: IFolder | undefined;
}

export default class MCWorldEditor extends Component<IMCWorldEditorProps, IMCWorldEditorState> implements IPersistable {
  private _lastFileEdited?: IFile;
  private _lastFolderEdited?: IFolder;

  constructor(props: IMCWorldEditorProps) {
    super(props);

    this._handleMcworldLoaded = this._handleMcworldLoaded.bind(this);

    this.state = {
      fileToEdit: this.props.file,
      folderToEdit: this.props.folder,
    };
  }

  static getDerivedStateFromProps(props: IMCWorldEditorProps, state: IMCWorldEditorState) {
    if ((state === undefined || state === null) && props.file) {
      state = {
        fileToEdit: props.file,
        folderToEdit: undefined,
      };

      return state;
    }

    if ((state === undefined || state === null) && props.folder) {
      state = {
        fileToEdit: undefined,
        folderToEdit: props.folder,
      };

      return state;
    }

    if (props.folder && props.folder !== state.folderToEdit) {
      state.folderToEdit = props.folder;

      return state;
    }

    if (props.file && props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;

      return state;
    }

    return null; // No change to state
  }

  componentDidUpdate(prevProps: IMCWorldEditorProps, prevState: IMCWorldEditorState) {
    this._updateManagerOnFile();
  }

  private _updateManagerOnFolder() {
    if (this.state !== undefined && this.state.folderToEdit !== undefined) {
      if (this.state.folderToEdit !== this._lastFolderEdited) {
        this._lastFolderEdited = this.state.folderToEdit;

        MCWorld.ensureMCWorldOnFolder(this.state.folderToEdit, this.props.project, this._handleMcworldLoaded);

        this._doUpdate();
      }
    }
  }

  async _doUpdate() {
    if (Database.uxCatalog === null) {
      await Database.loadUx();

      this.forceUpdate();
    }
  }

  private _updateManagerOnFile() {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited && this.state.fileToEdit) {
        this._lastFileEdited = this.state.fileToEdit;

        MCWorld.ensureMCWorldOnFile(this.state.fileToEdit, this.props.project, this._handleMcworldLoaded);

        this._doUpdate();
      }
    }
  }

  _handleMcworldLoaded(world: MCWorld, worldA: MCWorld) {
    this.forceUpdate();
  }

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager !== undefined && file.manager instanceof MCWorld) {
        const manager = file.manager as MCWorld;

        await manager.saveToFile();
      }
    }
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    if (Database.uxCatalog === null || this.state === null) {
      return <div>Loading...</div>;
    }

    if (
      this.props.file &&
      (this.state === null ||
        this.state.fileToEdit === null ||
        this.state.fileToEdit === undefined ||
        this.state.fileToEdit.manager === undefined ||
        Database.uxCatalog === null)
    ) {
      if (this.state.fileToEdit) {
        if (this.state.fileToEdit.manager === undefined) {
          this._updateManagerOnFile();
        }
      }

      return <div>Loading...</div>;
    } else if (
      this.props.folder &&
      (this.state === null ||
        this.state.folderToEdit === null ||
        this.state.folderToEdit === undefined ||
        this.state.folderToEdit.manager === undefined ||
        Database.uxCatalog === null)
    ) {
      if (this.state.folderToEdit) {
        if (this.state.folderToEdit.manager === undefined) {
          this._updateManagerOnFolder();
        }
      }

      return <div>Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    let mcworld = undefined;

    if (this.state.fileToEdit) {
      mcworld = this.state.fileToEdit.manager as MCWorld;
    }

    if (this.state.folderToEdit) {
      mcworld = this.state.folderToEdit.manager as MCWorld;
    }

    if (!mcworld) {
      return <div>Loading...</div>;
    }

    let propsArea = <></>;

    if (this.props.displayProps) {
      const formDef: IFormDefinition = Database.uxCatalog.mcworldProperties;
      propsArea = (
        <div className="mcwe-props">
          <DataForm readOnly={false} definition={formDef} getsetPropertyObject={mcworld}></DataForm>
        </div>
      );
    }

    return (
      <div
        className="mcwe-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="mcwe-map">
          <WorldView
            carto={this.props.carto}
            project={this.props.project}
            world={mcworld}
            heightOffset={this.props.heightOffset + 48}
          />
        </div>
        {propsArea}
      </div>
    );
  }
}

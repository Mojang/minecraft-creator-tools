import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./ItemTypeEditor.css";
import ItemTypeBehaviorDefinition from "../minecraft/ItemTypeBehaviorDefinition";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import ProjectItem from "../app/ProjectItem";
import ItemTypeComponentSetEditor from "./ItemTypeComponentSetEditor";
import Project from "../app/Project";
import Carto from "../app/Carto";

interface IItemTypeEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  item: ProjectItem;
  project: Project;
  carto: Carto;
  theme: ThemeInput<any>;
}

interface IItemTypeEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
}

export default class ItemTypeEditor extends Component<IItemTypeEditorProps, IItemTypeEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: IItemTypeEditorProps) {
    super(props);

    this._handleItemTypeLoaded = this._handleItemTypeLoaded.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
    };

    this._updateManager(false);
  }

  static getDerivedStateFromProps(props: IItemTypeEditorProps, state: IItemTypeEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
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

  componentDidUpdate(prevProps: IItemTypeEditorProps, prevState: IItemTypeEditorState) {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await ItemTypeBehaviorDefinition.ensureOnFile(this.state.fileToEdit, this._handleItemTypeLoaded);
      }
    }

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof ItemTypeBehaviorDefinition &&
      (this.state.fileToEdit.manager as ItemTypeBehaviorDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate(setState);
    }
  }

  _handleItemTypeLoaded(itemType: ItemTypeBehaviorDefinition, typeA: ItemTypeBehaviorDefinition) {
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
        isLoaded: true,
      };
    }
  }

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager !== null) {
        const et = file.manager as ItemTypeBehaviorDefinition;

        et.persist();
      }
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

    const itbd = this.state.fileToEdit.manager as ItemTypeBehaviorDefinition;

    if (itbd.data === undefined) {
      return <div className="ite-loading">Loading...</div>;
    }

    return (
      <div
        className="ite-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="ite-header">{itbd.id}</div>

        <div>
          <ItemTypeComponentSetEditor
            itemTypeItem={itbd}
            theme={this.props.theme}
            isDefault={true}
            project={this.props.project}
            carto={this.props.carto}
            isVisualsMode={false}
            heightOffset={this.props.heightOffset + 80}
          />
        </div>
      </div>
    );
  }
}

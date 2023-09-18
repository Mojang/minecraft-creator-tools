import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./ItemTypeEditor.css";
import IPersistable from "./IPersistable";
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import Database from "../minecraft/Database";
import DataFormUtilities from "../dataform/DataFormUtilities";
import ComponentSetEditor from "./ComponentSetEditor";
import { ThemeInput } from "@fluentui/styles";

interface IItemTypeEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  theme: ThemeInput<any>;
}

interface IItemTypeEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
}

export default class ItemTypeEditor
  extends Component<IItemTypeEditorProps, IItemTypeEditorState>
  implements IPersistable
{
  private _lastFileEdited?: IFile;

  constructor(props: IItemTypeEditorProps) {
    super(props);

    this._handleItemTypeLoaded = this._handleItemTypeLoaded.bind(this);
    this._addComponentClick = this._addComponentClick.bind(this);
    this._addComponent = this._addComponent.bind(this);

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

        await ItemTypeDefinition.ensureItemTypeOnFile(this.state.fileToEdit, this._handleItemTypeLoaded);
      }
    }

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof ItemTypeDefinition &&
      (this.state.fileToEdit.manager as ItemTypeDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate(setState);
    }
  }

  _handleItemTypeLoaded(itemType: ItemTypeDefinition, typeA: ItemTypeDefinition) {
    this._doUpdate(true);
  }

  async _doUpdate(setState: boolean) {
    if (Database.uxCatalog === null) {
      await Database.loadUx();
    }

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
        const et = file.manager as ItemTypeDefinition;

        et.persist();
      }
    }
  }

  _addComponentClick() {
    this._addComponent("minecraft:tameable");

    this.forceUpdate();
  }

  _addComponent(name: string) {
    if (Database.uxCatalog === null) {
      return;
    }

    const form = Database.uxCatalog.componentForms[name];

    if (form !== undefined) {
      const newDataObject = DataFormUtilities.generateDefaultItem(form);

      const et = this.state.fileToEdit.manager as ItemTypeDefinition;

      if (et.behaviorPackDefinition === undefined) {
        return;
      }

      et.behaviorPackDefinition.components[name] = newDataObject;
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

    const et = this.state.fileToEdit.manager as ItemTypeDefinition;

    if (et.behaviorPackDefinition === undefined) {
      return <div>Loading behavior pack...</div>;
    }

    return (
      <div
        className="ite-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="ite-header">{et.id}</div>

        <div className="ite-componentHeader">default components:</div>
        <div>
          <ComponentSetEditor
            componentSetItem={et}
            theme={this.props.theme}
            isDefault={true}
            heightOffset={this.props.heightOffset + 80}
          />
        </div>
      </div>
    );
  }
}
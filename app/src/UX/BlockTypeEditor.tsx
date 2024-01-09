import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./BlockTypeEditor.css";
import IPersistable from "./IPersistable";
import BlockType from "../minecraft/BlockType";
import Database from "../minecraft/Database";
import DataFormUtilities from "../dataform/DataFormUtilities";
import ComponentSetEditor from "./ComponentSetEditor";
import { ThemeInput } from "@fluentui/styles";

interface IBlockTypeEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  theme: ThemeInput<any>;
}

interface IBlockTypeEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
}

export default class BlockTypeEditor
  extends Component<IBlockTypeEditorProps, IBlockTypeEditorState>
  implements IPersistable
{
  private _lastFileEdited?: IFile;

  constructor(props: IBlockTypeEditorProps) {
    super(props);

    this._handleBlockTypeLoaded = this._handleBlockTypeLoaded.bind(this);
    this._addComponentClick = this._addComponentClick.bind(this);
    this._addComponent = this._addComponent.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
    };

    this._updateManager(false);
  }

  static getDerivedStateFromProps(props: IBlockTypeEditorProps, state: IBlockTypeEditorState) {
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

  componentDidUpdate(prevProps: IBlockTypeEditorProps, prevState: IBlockTypeEditorState) {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await BlockType.ensureBlockTypeOnFile(this.state.fileToEdit, this._handleBlockTypeLoaded);
      }
    }

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof BlockType &&
      (this.state.fileToEdit.manager as BlockType).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate(setState);
    }
  }

  _handleBlockTypeLoaded(blockType: BlockType, typeA: BlockType) {
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
        const bt = file.manager as BlockType;

        bt.persist();
      }
    }
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

      const bt = this.state.fileToEdit.manager as BlockType;

      if (bt.behaviorPackBlockTypeDef === undefined) {
        return;
      }

      bt.behaviorPackBlockTypeDef.components[name] = newDataObject;
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

    const et = this.state.fileToEdit.manager as BlockType;

    if (et.behaviorPackBlockTypeDef === undefined) {
      return <div>Loading behavior pack...</div>;
    }

    return (
      <div
        className="bte-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="bte-header">{et.id}</div>
        <div className="bte-componentHeader">default components:</div>
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

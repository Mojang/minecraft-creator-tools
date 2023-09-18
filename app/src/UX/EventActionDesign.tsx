import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./EventActionDesign.css";
import IPersistable from "./IPersistable";
import BlockType from "../minecraft/BlockType";
import Database from "../minecraft/Database";
import DataFormUtilities from "../dataform/DataFormUtilities";
import { ThemeInput } from "@fluentui/styles";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import ManagedEvent from "../minecraft/ManagedEvent";

interface IEventActionDesignProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  entityType: EntityTypeDefinition;
  event: ManagedEvent;
  theme: ThemeInput<any>;
}

interface IEventActionDesignState {
  fileToEdit: IFile;
  isLoaded: boolean;
}

export default class EventActionDesign
  extends Component<IEventActionDesignProps, IEventActionDesignState>
  implements IPersistable
{
  private _lastFileEdited?: IFile;

  constructor(props: IEventActionDesignProps) {
    super(props);

    this._addComponentGroupAddClick = this._addComponentGroupAddClick.bind(this);
    this._addComponentGroupAdd = this._addComponentGroupAdd.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
    };

    this._updateManager(false);
  }

  static getDerivedStateFromProps(props: IEventActionDesignProps, state: IEventActionDesignState) {
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

  componentDidUpdate(prevProps: IEventActionDesignProps, prevState: IEventActionDesignState) {
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
        const et = file.manager as BlockType;

        et.persist();
      }
    }
  }

  _addComponentGroupAddClick() {
    this._addComponentGroupAdd("minecraft:tameable");

    this.forceUpdate();
  }

  _addComponentGroupAdd(name: string) {
    if (Database.uxCatalog === null) {
      return;
    }

    const form = Database.uxCatalog.componentForms[name];

    if (form !== undefined) {
      const newDataObject = DataFormUtilities.generateDefaultItem(form);

      const et = this.state.fileToEdit.manager as BlockType;

      if (et.behaviorPackBlockTypeDef === undefined) {
        return;
      }

      et.behaviorPackBlockTypeDef.components[name] = newDataObject;
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

    const et = this.state.fileToEdit.manager as EntityTypeDefinition;

    if (et.behaviorPackEntityTypeDef === undefined) {
      return <div>Loading behavior pack...</div>;
    }

    return (
      <div
        className="ead-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="ead-header">Action Editor{et.id}</div>
        <div className="ead-componentHeader">default components:</div>
        <div></div>
      </div>
    );
  }
}

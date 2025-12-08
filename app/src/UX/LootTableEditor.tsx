import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./LootTableEditor.css";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import DataForm, { IDataFormProps } from "../dataformux/DataForm";
import IProperty from "../dataform/IProperty";
import LootTableBehaviorDefinition from "../minecraft/LootTableBehaviorDefinition";
import Project from "../app/Project";

interface ILootTableEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  project: Project;
  displayHeader?: boolean;
  theme: ThemeInput<any>;
}

interface ILootTableEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
  selectedItem: LootTableBehaviorDefinition | undefined;
}

export default class LootTableEditor extends Component<ILootTableEditorProps, ILootTableEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: ILootTableEditorProps) {
    super(props);

    this._definitionLoaded = this._definitionLoaded.bind(this);
    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
      selectedItem: undefined,
    };

    this._updateManager(true);
  }

  static getDerivedStateFromProps(props: ILootTableEditorProps, state: ILootTableEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        isLoaded: false,
        selectedItem: undefined,
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

  componentDidUpdate(prevProps: ILootTableEditorProps, prevState: ILootTableEditorState) {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await LootTableBehaviorDefinition.ensureOnFile(this.state.fileToEdit, this._definitionLoaded);
      }
    }

    await Database.ensureFormLoaded("loot", "loot_table");

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof LootTableBehaviorDefinition &&
      (this.state.fileToEdit.manager as LootTableBehaviorDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate(setState);
    }
  }

  _definitionLoaded(defA: LootTableBehaviorDefinition, defB: LootTableBehaviorDefinition) {
    this._doUpdate(true);
  }

  async _doUpdate(setState: boolean) {
    let selItem = this.state.selectedItem;

    if (selItem === undefined && this.state && this.state.fileToEdit && this.state.fileToEdit.manager) {
      selItem = this.state.fileToEdit.manager as LootTableBehaviorDefinition;
    }

    if (setState) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        isLoaded: true,
        selectedItem: this.state.selectedItem,
      });
    } else {
      this.state = {
        fileToEdit: this.props.file,
        isLoaded: true,
        selectedItem: this.state.selectedItem,
      };
    }
  }

  async persist(): Promise<boolean> {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const srbd = file.manager as LootTableBehaviorDefinition;

        return srbd.persist();
      }
    }

    return false;
  }

  _handleDataFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {
    if (props.tagData && props.directObject) {
      const file = props.tagData as IFile;

      file.setObjectContentIfSemanticallyDifferent(props.directObject);
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

    const definitionFile = this.state.fileToEdit.manager as LootTableBehaviorDefinition;
    const def = definitionFile.data;

    if (def === undefined) {
      return <div className="ltb-loading">Loading definition...</div>;
    }

    const form = Database.getForm("loot", "loot_table");

    let header = <></>;
    if (this.props.displayHeader === undefined || this.props.displayHeader) {
      header = <div className="ltb-header">Loot Table</div>;
    }

    if (!form) {
      return <div className="ltb-loading">Form not found</div>;
    }

    return (
      <div
        className="ltb-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        {header}
        <div className="ltb-mainArea">
          <div className="ltb-form">
            <DataForm
              definition={form}
              directObject={def}
              readOnly={false}
              project={this.props.project}
              lookupProvider={this.props.project}
              theme={this.props.theme}
              objectKey={this.props.file.storageRelativePath}
              onPropertyChanged={this._handleDataFormPropertyChange}
            ></DataForm>
          </div>
        </div>
      </div>
    );
  }
}

import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./SpawnRulesEditor.css";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import IProperty from "../dataform/IProperty";
import SpawnRulesBehaviorDefinition from "../minecraft/SpawnRulesBehaviorDefinition";

interface ISpawnRulesEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  displayHeader?: boolean;
  theme: ThemeInput<any>;
}

interface ISpawnRulesEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
  selectedItem: SpawnRulesBehaviorDefinition | undefined;
}

export default class SpawnRulesEditor extends Component<ISpawnRulesEditorProps, ISpawnRulesEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: ISpawnRulesEditorProps) {
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

  static getDerivedStateFromProps(props: ISpawnRulesEditorProps, state: ISpawnRulesEditorState) {
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

    return null; // No change to state
  }

  componentDidUpdate(prevProps: ISpawnRulesEditorProps, prevState: ISpawnRulesEditorState) {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await SpawnRulesBehaviorDefinition.ensureOnFile(this.state.fileToEdit, this._definitionLoaded);
      }
    }

    await Database.ensureFormLoaded("spawn", "spawn_rules_header");

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof SpawnRulesBehaviorDefinition &&
      (this.state.fileToEdit.manager as SpawnRulesBehaviorDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate(setState);
    }
  }

  _definitionLoaded(defA: SpawnRulesBehaviorDefinition, defB: SpawnRulesBehaviorDefinition) {
    this._doUpdate(true);
  }

  async _doUpdate(setState: boolean) {
    let selItem = this.state.selectedItem;

    if (selItem === undefined && this.state && this.state.fileToEdit && this.state.fileToEdit.manager) {
      selItem = this.state.fileToEdit.manager as SpawnRulesBehaviorDefinition;
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

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager !== null) {
        const srbd = file.manager as SpawnRulesBehaviorDefinition;

        srbd.persist();
      }
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

    const definitionFile = this.state.fileToEdit.manager as SpawnRulesBehaviorDefinition;
    const def = definitionFile.data;

    if (def === undefined) {
      return <div>Loading definition...</div>;
    }

    let defInner = def["minecraft:spawn_rules"];
    if (defInner === undefined) {
      defInner = {};
      def["minecraft:spawn_rules"] = defInner;
    }

    const form = Database.getForm("spawn", "spawn_rules_header");

    let header = <></>;
    if (this.props.displayHeader === undefined || this.props.displayHeader) {
      header = <div className="sre-header">Spawn Rules</div>;
    }

    return (
      <div
        className="sre-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        {header}
        <div className="sre-mainArea">
          <div className="sre-form">
            <DataForm
              definition={form}
              directObject={defInner.description}
              readOnly={false}
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

import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./GeneralFormEditor.css";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import IProperty from "../dataform/IProperty";
import Project from "../app/Project";
import Utilities from "../core/Utilities";
import StorageUtilities from "../storage/StorageUtilities";

interface IGeneralFormEditorProps extends IFileProps {
  heightOffset: number;
  formCategory: string;
  formName: string;
  readOnly: boolean;
  project: Project;
  select?: string;
  displayHeader?: boolean;
  theme: ThemeInput<any>;
}

interface IGeneralFormEditorState {
  fileToEdit: IFile;
  jsonObject?: object;
  isLoaded: boolean;
}

export default class GeneralFormEditor extends Component<IGeneralFormEditorProps, IGeneralFormEditorState> {
  constructor(props: IGeneralFormEditorProps) {
    super(props);

    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);

    this.state = {
      fileToEdit: props.file,
      jsonObject: undefined,
      isLoaded: false,
    };
  }

  componentDidMount(): void {
    this._updateManager();
  }

  async _updateManager() {
    if (this.state === undefined || this.state.fileToEdit === undefined) {
      return;
    }

    await this.state.fileToEdit.loadContent();

    await Database.ensureFormLoaded(this.props.formCategory, this.props.formName);

    if (this.state.fileToEdit && !this.state.isLoaded) {
      this._doUpdate();
    }
  }

  async _doUpdate() {
    await this.state.fileToEdit.loadContent();

    const jsonO = StorageUtilities.getJsonObject(this.state.fileToEdit);
    this.setState({
      fileToEdit: this.state.fileToEdit,
      jsonObject: jsonO,
      isLoaded: true,
    });
  }

  async persist(): Promise<boolean> {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (this.state.jsonObject) {
        let jsonO: object | undefined = this.state.jsonObject;

        if (this.props.select) {
          jsonO = Utilities.selectJsonObject(jsonO, this.props.select, true);
        }

        return file.setObjectContentIfSemanticallyDifferent(jsonO);
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
      Database.uxCatalog === null ||
      this.state.isLoaded === false ||
      this.state.jsonObject === undefined
    ) {
      return <div className="gfe-loading">Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const form = Database.getForm(this.props.formCategory, this.props.formName);

    let header = <></>;
    if (this.props.displayHeader === undefined || this.props.displayHeader) {
      header = <div className="gfe-header">General</div>;
    }

    let jsonO: object | undefined = this.state.jsonObject;

    if (this.props.select && jsonO) {
      jsonO = Utilities.selectJsonObject(jsonO, this.props.select, true);
    }

    if (!form) {
      return <div className="gfe-loading">Form not found</div>;
    }

    return (
      <div
        className="gfe-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        {header}
        <div className="gfe-mainArea">
          <div className="gfe-form">
            <DataForm
              definition={form}
              directObject={jsonO}
              readOnly={false}
              select={this.props.select}
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

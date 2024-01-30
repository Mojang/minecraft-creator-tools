import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./DataFormEditor.css";
import DataFormFile from "../dataform/DataFormFile";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import Database from "../minecraft/Database";
import CartoApp from "../app/CartoApp";
import Project from "../app/Project";
import { ThemeInput } from "@fluentui/react-northstar";
import IProperty from "../dataform/IProperty";

interface IDataFormEditorProps extends IFileProps {
  heightOffset: number;
  theme: ThemeInput<any>;
  carto: CartoApp;
  project: Project;
  onDataFormUpdate?: (dataForm: DataForm) => void;
}

interface IDataFormEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
}

export default class DataFormEditor extends Component<IDataFormEditorProps, IDataFormEditorState> {
  constructor(props: IDataFormEditorProps) {
    super(props);

    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);
  }

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const dff = file.manager as DataFormFile;

        dff.persist();
      }
    }
  }

  static getDerivedStateFromProps(props: IDataFormEditorProps, state: IDataFormEditorState) {
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

  componentDidMount() {
    if (this.state && !this.state.isLoaded) {
      this.doLoad();
    }
  }

  async doLoad() {
    await Database.ensureFormLoaded("dataform");

    if (this.state.fileToEdit) {
      await DataFormFile.ensureOnFile(this.state.fileToEdit);
    }

    this.setState({
      fileToEdit: this.state.fileToEdit,
      isLoaded: true,
    });
  }

  _handleDataFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {
    if (props.tagData && props.directObject) {
      const file = props.tagData as IFile;

      const newData = JSON.stringify(props.directObject, null, 2);

      file.setContent(newData);
    }
  }

  render() {
    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    if (this.state && !this.state.isLoaded) {
      this.doLoad();

      return <div>Loading...</div>;
    }

    const formHeight = "calc(100vh - " + this.props.heightOffset + "px)";

    const dform = this.state.fileToEdit.manager as DataFormFile;
    const form = Database.getForm("dataform");

    return (
      <div
        className="dfe-area"
        style={{
          minHeight: formHeight,
          maxHeight: formHeight,
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
        }}
      >
        <div className="dfe-header">{dform.id}</div>
        <div className="dfe-form">
          <DataForm
            definition={form}
            theme={this.props.theme}
            directObject={dform.formDefinition}
            readOnly={false}
            objectKey={dform.id}
          ></DataForm>
        </div>
      </div>
    );
  }
}

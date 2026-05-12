import { Component } from "react";
import IFileProps from "../project/fileExplorer/IFileProps";
import IFile from "../../storage/IFile";
import "./DataFormEditor.css";
import DataFormFile from "../../dataform/DataFormFile";
import DataForm, { IDataFormProps } from "../../dataformux/DataForm";
import Database from "../../minecraft/Database";
import Project from "../../app/Project";
import IProperty from "../../dataform/IProperty";
import CreatorTools from "../../app/CreatorTools";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import IProjectTheme from "../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

interface IDataFormEditorProps extends IFileProps, WithLocalizationProps {
  heightOffset: number;
  theme: IProjectTheme;
  creatorTools: CreatorTools;
  project: Project;
  onDataFormUpdate?: (dataForm: DataForm) => void;
}

interface IDataFormEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
}

class DataFormEditor extends Component<IDataFormEditorProps, IDataFormEditorState> {
  constructor(props: IDataFormEditorProps) {
    super(props);

    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);
  }

  async persist(): Promise<boolean> {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const dff = file.manager as DataFormFile;

        return dff.persist();
      }
    }

    return false;
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
    await Database.ensureFormLoaded("form", "dataform");

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

      file.setObjectContentIfSemanticallyDifferent(props.directObject);
    }
  }

  render() {
    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    if (this.state && !this.state.isLoaded) {
      this.doLoad();

      return <div>{this.props.intl.formatMessage({ id: "project_editor.data_form.loading" })}</div>;
    }

    const formHeight = "calc(100vh - " + this.props.heightOffset + "px)";

    const dform = this.state.fileToEdit.manager as DataFormFile;
    const form = Database.getForm("form", "dataform");

    if (!form) {
      return <div>{this.props.intl.formatMessage({ id: "project_editor.data_form.error_loading" })}</div>;
    }

    const colors = getThemeColors();

    return (
      <div
        className="dfe-area"
        key="dfeArea"
        style={{
          minHeight: formHeight,
          maxHeight: formHeight,
          backgroundColor: colors.background2,
          color: colors.foreground2,
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
        <div className="dfe-sourceForm">
          <DataForm
            definition={form}
            theme={this.props.theme}
            directObject={dform.formDefinition?.generated_doNotEdit}
            readOnly={true}
            objectKey={dform.id}
          ></DataForm>
        </div>
      </div>
    );
  }
}

export default withLocalization(DataFormEditor);

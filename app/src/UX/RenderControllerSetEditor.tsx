import { Component } from "react";
import IFile from "../storage/IFile";
import "./RenderControllerSetEditor.css";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import IProperty from "../dataform/IProperty";
import RenderControllerSetDefinition from "../minecraft/RenderControllerSetDefinition";
import IPersistable from "./IPersistable";
import IFormDefinition from "../dataform/IFormDefinition";

interface IRenderControllerSetEditorProps {
  heightOffset: number;
  readOnly: boolean;
  displayHeader?: boolean;
  isInline?: boolean;
  theme: ThemeInput<any>;
  renderControllerSet?: RenderControllerSetDefinition;
  file?: IFile;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface IRenderControllerSetEditorState {
  fileToEdit?: IFile;
  renderControllerSet?: RenderControllerSetDefinition | undefined;
  renderControllerForm?: IFormDefinition;
}

export default class RenderControllerSetEditor extends Component<
  IRenderControllerSetEditorProps,
  IRenderControllerSetEditorState
> {
  private _lastFileEdited?: IFile;

  constructor(props: IRenderControllerSetEditorProps) {
    super(props);

    this._definitionLoaded = this._definitionLoaded.bind(this);
    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);

    this.state = {
      fileToEdit: props.file,
      renderControllerSet: undefined,
      renderControllerForm: undefined,
    };

    this._updateManager(true);
  }

  static getDerivedStateFromProps(props: IRenderControllerSetEditorProps, state: IRenderControllerSetEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        renderControllerSet: undefined,
        renderControllerForm: undefined,
      };

      return state;
    }

    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;

      return state;
    }

    return null;
  }

  componentDidMount(): void {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await RenderControllerSetDefinition.ensureOnFile(this.state.fileToEdit, this._definitionLoaded);
      }
    }

    if (
      this.props.renderControllerSet ||
      (this.state.fileToEdit &&
        this.state.fileToEdit.manager !== undefined &&
        this.state.fileToEdit.manager instanceof RenderControllerSetDefinition &&
        (this.state.fileToEdit.manager as RenderControllerSetDefinition).isLoaded)
    ) {
      this._doUpdate(setState);
    }
  }

  _definitionLoaded(defA: RenderControllerSetDefinition, defB: RenderControllerSetDefinition) {
    this._doUpdate(true);
  }

  async _doUpdate(setState: boolean) {
    let selRenderControllerSet = this.props.renderControllerSet;

    if (selRenderControllerSet === undefined && this.state && this.state.fileToEdit && this.state.fileToEdit.manager) {
      selRenderControllerSet = this.state.fileToEdit.manager as RenderControllerSetDefinition;
    }

    const form = await Database.ensureFormLoaded("render_controller_set");

    if (setState) {
      this.setState({
        fileToEdit: this.props.file,
        renderControllerSet: selRenderControllerSet,
        renderControllerForm: form,
      });
    } else {
      this.state = {
        fileToEdit: this.props.file,
        renderControllerSet: selRenderControllerSet,
        renderControllerForm: form,
      };
    }
  }

  async persist() {
    if (this.state && this.state.fileToEdit) {
      const file = this.state.fileToEdit;

      if (file.manager !== null) {
        const rcsd = file.manager as RenderControllerSetDefinition;

        rcsd.persist();
      }
    } else if (this.state && this.state.renderControllerSet) {
      this.state.renderControllerSet.persist();
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

    if (this.state === null || !this.state.renderControllerSet || !this.state.renderControllerForm) {
      return <div>Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    let header = <></>;
    if (this.props.displayHeader === undefined || this.props.displayHeader) {
      header = <div className="rencoe-header">Render Controllers</div>;
    }

    let outerClassName = "rencoe-area";

    if (this.props.isInline) {
      outerClassName = "rencoe-inline";
    }

    return (
      <div
        className={outerClassName}
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        {header}
        <div className="rencoe-mainArea">
          <div className="rencoe-form">
            <DataForm
              definition={this.state.renderControllerForm}
              directObject={this.state.renderControllerSet.data}
              readOnly={false}
              theme={this.props.theme}
              constrainHeight={false}
              objectKey={this.props.file?.storageRelativePath}
              onPropertyChanged={this._handleDataFormPropertyChange}
            ></DataForm>
          </div>
        </div>
      </div>
    );
  }
}

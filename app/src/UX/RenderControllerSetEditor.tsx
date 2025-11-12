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
import DataFormProcessor from "../dataform/DataFormProcessor";
import Project from "../app/Project";

export enum RenderControllerSetEditorFocus {
  all,
  geometry,
  materials,
  textures,
}

interface IRenderControllerSetEditorProps {
  heightOffset: number;
  readOnly: boolean;
  displayHeader?: boolean;
  isInline?: boolean;
  project: Project;
  focus: RenderControllerSetEditorFocus;
  theme: ThemeInput<any>;
  renderControllerSet?: RenderControllerSetDefinition;
  file?: IFile;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface IRenderControllerSetEditorState {
  fileToEdit?: IFile;
  renderControllerSet?: RenderControllerSetDefinition | undefined;
  form?: IFormDefinition;
  formMaterials?: IFormDefinition;
  formTextures?: IFormDefinition;
  formGeometry?: IFormDefinition;
  formMisc?: IFormDefinition;
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
      form: undefined,
    };
  }

  static getDerivedStateFromProps(props: IRenderControllerSetEditorProps, state: IRenderControllerSetEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        renderControllerSet: undefined,
        form: undefined,
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
    this._updateManager();
  }

  componentDidUpdate(
    prevProps: Readonly<IRenderControllerSetEditorProps>,
    prevState: Readonly<IRenderControllerSetEditorState>,
    snapshot?: any
  ): void {
    if (this.state && prevProps.file !== this.state.fileToEdit) {
      this._updateManager();
    }
  }

  async _updateManager() {
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
      this._doUpdate();
    }
  }

  _definitionLoaded(defA: RenderControllerSetDefinition, defB: RenderControllerSetDefinition) {
    this._doUpdate();
  }

  async _doUpdate() {
    let selRenderControllerSet = this.props.renderControllerSet;

    if (selRenderControllerSet === undefined && this.state && this.state.fileToEdit && this.state.fileToEdit.manager) {
      selRenderControllerSet = this.state.fileToEdit.manager as RenderControllerSetDefinition;
    }

    const form = await Database.ensureFormLoaded("resource", "render_controller_set");
    const formMaterials = await Database.ensureFormLoaded("resource", "render_controller_set_materials");
    const formTextures = await Database.ensureFormLoaded("resource", "render_controller_set_textures");
    const formGeometry = await Database.ensureFormLoaded("resource", "render_controller_set_geometry");
    const formMisc = await Database.ensureFormLoaded("resource", "render_controller_set_misc");
    this.setState({
      fileToEdit: this.props.file,
      renderControllerSet: selRenderControllerSet,
      form: form,
      formMaterials: formMaterials,
      formTextures: formTextures,
      formGeometry: formGeometry,
      formMisc: formMisc,
    });
  }

  async persist(): Promise<boolean> {
    let didPersist = false;
    if (this.state && this.state.fileToEdit) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const rcsd = file.manager as RenderControllerSetDefinition;

        if (await rcsd.persist()) {
          didPersist = true;
        }
      }
    } else if (this.state && this.state.renderControllerSet) {
      if (await this.state.renderControllerSet.persist()) {
        didPersist = true;
      }
    }

    return didPersist;
  }

  async _handleDataFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {
    if (props.tagData && props.directObject) {
      const file = props.tagData as IFile;

      if (this.state.form) {
        await DataFormProcessor.process(props.directObject, this.state.form);
      }

      file.setObjectContentIfSemanticallyDifferent(props.directObject);
    }
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    if (this.state === null || !this.state.renderControllerSet || !this.state.form) {
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

    let form = this.state.form;

    switch (this.props.focus) {
      case RenderControllerSetEditorFocus.geometry:
        if (this.state.formGeometry) {
          form = this.state.formGeometry;
        }
        break;
      case RenderControllerSetEditorFocus.materials:
        if (this.state.formMaterials) {
          form = this.state.formMaterials;
        }
        break;
      case RenderControllerSetEditorFocus.textures:
        if (this.state.formTextures) {
          form = this.state.formTextures;
        }
        break;
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
              definition={form}
              directObject={this.state.renderControllerSet.data}
              readOnly={false}
              project={this.props.project}
              lookupProvider={this.props.project}
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

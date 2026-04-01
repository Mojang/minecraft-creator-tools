import { Component } from "react";
import IAppProps from "../../UX/appShell/IAppProps";
import Entity from "../../minecraft/Entity";
import "./EntityPropertyEditor.css";
import DataForm, { IDataFormProps } from "../../dataformux/DataForm";
import IProperty from "../../dataform/IProperty";
import Database from "../../minecraft/Database";
import { TextField } from "@mui/material";
import Project from "../../app/Project";
import IProjectTheme from "../../UX/types/IProjectTheme";

interface IEntityPropertyEditorProps extends IAppProps {
  entity: Entity;
  project: Project;
  theme: IProjectTheme;
}

interface IEntityPropertyEditorState {}

export default class EntityPropertyEditor extends Component<IEntityPropertyEditorProps, IEntityPropertyEditorState> {
  private _isLoading = false;
  constructor(props: IEntityPropertyEditorProps) {
    super(props);

    this._handleEntityChanged = this._handleEntityChanged.bind(this);
    this._handlePropertyChanged = this._handlePropertyChanged.bind(this);

    this._handleXChanged = this._handleXChanged.bind(this);
    this._handleYChanged = this._handleYChanged.bind(this);
    this._handleZChanged = this._handleZChanged.bind(this);
  }

  componentDidUpdate(prevProps: IEntityPropertyEditorProps, prevState: IEntityPropertyEditorState) {
    if (prevProps !== undefined && prevProps.entity !== undefined) {
      prevProps.entity.onComponentAdded.unsubscribe(this._handleEntityChanged);
      prevProps.entity.onComponentRemoved.unsubscribe(this._handleEntityChanged);
      prevProps.entity.onComponentChanged.unsubscribe(this._handleEntityChanged);
    }

    if (this.props !== undefined && this.props.entity !== undefined) {
      prevProps.entity.onComponentAdded.subscribe(this._handleEntityChanged);
      prevProps.entity.onComponentRemoved.subscribe(this._handleEntityChanged);
      prevProps.entity.onComponentChanged.subscribe(this._handleEntityChanged);
    }
  }

  _handleEntityChanged() {
    this.forceUpdate();
  }

  _handlePropertyChanged(props: IDataFormProps, property: IProperty, newValue: any) {
    const entity = this.props.entity;

    if (entity === undefined || property.id === undefined) {
      return;
    }

    //  entity.getProperty(property.name).value = newValue;
  }

  async _loadForms() {
    if (Database.uxCatalog === null && !this._isLoading) {
      this._isLoading = true;

      await Database.ensureFormLoaded("entity", "instance");

      await Database.ensureFormLoaded("entity", "core");

      this.forceUpdate();
    }
  }

  _handleXChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.state == null) {
      return;
    }

    this.props.entity.location.x = parseFloat(e.target.value);
  }

  _handleYChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.state == null) {
      return;
    }

    this.props.entity.location.y = parseFloat(e.target.value);
  }

  _handleZChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.state == null) {
      return;
    }

    this.props.entity.location.z = parseFloat(e.target.value);
  }

  render() {
    if (Database.uxCatalog === null) {
      this._loadForms();
      return <div>Loading...</div>;
    }

    const protoEntity = this.props.entity;

    const formElements = [];

    let form = Database.getForm("entity", "instance");

    if (form != null) {
      formElements.push(
        <DataForm
          readOnly={true}
          definition={form}
          project={this.props.project}
          lookupProvider={this.props.project}
          theme={this.props.theme}
          objectKey={protoEntity.typeId}
          dataPropertyObject={protoEntity}
          onPropertyChanged={this._handlePropertyChanged}
        ></DataForm>
      );
    }

    form = Database.getForm("entity", "core");

    if (form != null) {
      formElements.push(
        <DataForm
          definition={form}
          theme={this.props.theme}
          project={this.props.project}
          lookupProvider={this.props.project}
          objectKey={protoEntity.typeId}
          dataPropertyObject={protoEntity}
          readOnly={true}
          onPropertyChanged={this._handlePropertyChanged}
        ></DataForm>
      );
    }
    const isReadOnly = true;

    return (
      <div className="bpe-outer">
        <div>
          <div className="bpe-row">
            <span>Position</span>
          </div>
          <div className="bpe-row">
            <span className="bpe-labelcell">X:</span>
            <span>
              <TextField
                value={String(this.props.entity.location.x)}
                disabled={isReadOnly}
                onChange={this._handleXChanged}
                size="small"
                variant="outlined"
              />
            </span>
          </div>
          <div className="bpe-row">
            <span className="bpe-labelcell">Y:</span>
            <span>
              <TextField
                value={String(this.props.entity.location.y)}
                disabled={isReadOnly}
                onChange={this._handleYChanged}
                size="small"
                variant="outlined"
              />
            </span>
          </div>
          <div className="bpe-row">
            <span className="bpe-labelcell">Z:</span>
            <span>
              <TextField
                value={String(this.props.entity.location.z)}
                disabled={isReadOnly}
                onChange={this._handleZChanged}
                size="small"
                variant="outlined"
              />
            </span>
          </div>
        </div>
        {formElements}
      </div>
    );
  }
}

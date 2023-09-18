import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Entity from "../minecraft/Entity";
import "./EntityPropertyEditor.css";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import { ICommander } from "./ICommand";
import IProperty from "../dataform/IProperty";
import Database from "../minecraft/Database";
import { Input, InputProps } from "@fluentui/react-northstar";

interface IEntityPropertyEditorProps extends IAppProps {
  entity: Entity;
  commander: ICommander;
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
      await Database.loadUx();
      this.forceUpdate();
    }
  }

  _handleXChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.state == null) {
      return;
    }

    this.props.entity.location.x = parseFloat(data.value);
  }

  _handleYChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.state == null) {
      return;
    }

    this.props.entity.location.y = parseFloat(data.value);
  }

  _handleZChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.state == null) {
      return;
    }

    this.props.entity.location.z = parseFloat(data.value);
  }

  render() {
    if (Database.uxCatalog === null) {
      this._loadForms();
      return <div>Loading...</div>;
    }

    const protoEntity = this.props.entity;

    const formElements = [];

    let form = Database.uxCatalog.componentForms["entityInstance"];

    if (form != null) {
      formElements.push(
        <DataForm
          readOnly={true}
          definition={form}
          objectKey={protoEntity.typeId}
          dataPropertyObject={protoEntity}
          onPropertyChanged={this._handlePropertyChanged}
        ></DataForm>
      );
    }

    form = Database.uxCatalog.componentForms["entityCore"];

    if (form != null) {
      formElements.push(
        <DataForm
          definition={form}
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
              <Input value={this.props.entity.location.x} readOnly={isReadOnly} onChange={this._handleXChanged} />
            </span>
          </div>
          <div className="bpe-row">
            <span className="bpe-labelcell">Y:</span>
            <span>
              <Input value={this.props.entity.location.y} readOnly={isReadOnly} onChange={this._handleXChanged} />
            </span>
          </div>
          <div className="bpe-row">
            <span className="bpe-labelcell">Z:</span>
            <span>
              <Input value={this.props.entity.location.z} readOnly={isReadOnly} onChange={this._handleXChanged} />
            </span>
          </div>
        </div>
        {formElements}
      </div>
    );
  }
}

import { Component } from "react";
import "./SoundEventSetEditor.css";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import DataForm, { IDataFormProps } from "../dataformux/DataForm";
import IProperty from "../dataform/IProperty";
import IAppProps from "./IAppProps";
import { ISoundEventSet } from "../minecraft/ISoundCatalog";
import Project from "../app/Project";
import SoundCatalogDefinition from "../minecraft/SoundCatalogDefinition";

export enum SoundEventSetType {
  entity,
  block,
}

interface ISoundEventSetSoundEditorProps extends IAppProps {
  readOnly: boolean;
  project: Project;
  typeId: string;
  eventType: SoundEventSetType;
  displayHeader?: boolean;
  theme: ThemeInput<any>;
}

interface ISoundEventSetEditorState {
  isLoaded: boolean;
  soundCatalogDefinition: SoundCatalogDefinition | undefined;
  soundEventSet: ISoundEventSet | undefined;
}

export default class SoundEventSetEditor extends Component<ISoundEventSetSoundEditorProps, ISoundEventSetEditorState> {
  constructor(props: ISoundEventSetSoundEditorProps) {
    super(props);

    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);

    this.state = {
      isLoaded: false,
      soundEventSet: undefined,
      soundCatalogDefinition: undefined,
    };

    this._updateManager(true);
  }

  componentDidMount(): void {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    await Database.ensureFormLoaded("entity", "sound_event");

    if (!this.state.isLoaded) {
      this._doUpdate(setState);
    }
  }

  async _doUpdate(setState: boolean) {
    const soundCatalogDefinition = await SoundCatalogDefinition.ensureForProject(this.props.project);
    let soundEventSet: ISoundEventSet | undefined = undefined;

    if (soundCatalogDefinition) {
      if (this.props.eventType === SoundEventSetType.entity) {
        soundEventSet = soundCatalogDefinition.ensureEntityEvent(this.props.typeId);
      }
    }

    if (setState) {
      this.setState({
        isLoaded: true,
        soundCatalogDefinition: soundCatalogDefinition,
        soundEventSet: soundEventSet,
      });
    } else {
      this.state = {
        isLoaded: true,
        soundCatalogDefinition: soundCatalogDefinition,
        soundEventSet: soundEventSet,
      };
    }
  }

  async persist(): Promise<boolean> {
    return false;
  }

  _handleDataFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {}

  render() {
    const def = this.state.soundEventSet;

    if (def === undefined) {
      return <div className="ltb-loading">Loading definition...</div>;
    }

    const form = Database.getForm("entity", "sound_event");

    let header = <></>;
    if (this.props.displayHeader === undefined || this.props.displayHeader) {
      header = <div className="sevs-header">Sound Event Set</div>;
    }

    if (!form) {
      return <div className="sevs-loading">Form not found</div>;
    }

    return (
      <div className="sevs-area">
        {header}
        <div className="sevs-mainArea">
          <div className="sevs-form">
            <DataForm
              definition={form}
              directObject={def}
              readOnly={false}
              project={this.props.project}
              lookupProvider={this.props.project}
              theme={this.props.theme}
              objectKey={"ses" + this.props.typeId}
              onPropertyChanged={this._handleDataFormPropertyChange}
            ></DataForm>
          </div>
        </div>
      </div>
    );
  }
}

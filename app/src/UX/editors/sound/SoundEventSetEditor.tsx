import { Component } from "react";
import "./SoundEventSetEditor.css";
import Database from "../../../minecraft/Database";
import DataForm, { IDataFormProps } from "../../../dataformux/DataForm";
import IProperty from "../../../dataform/IProperty";
import IAppProps from "../../appShell/IAppProps";
import { ISoundEvent, ISoundEventSet } from "../../../minecraft/ISoundCatalog";
import Project from "../../../app/Project";
import SoundCatalogDefinition from "../../../minecraft/SoundCatalogDefinition";
import IProjectTheme from "../../types/IProjectTheme";
import { FieldDataType } from "../../../dataform/IField";
import IFormDefinition from "../../../dataform/IFormDefinition";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";

export enum SoundEventSetType {
  entity,
  block,
}

interface ISoundEventSetSoundEditorProps extends IAppProps, WithLocalizationProps {
  readOnly: boolean;
  project: Project;
  typeId: string;
  eventType: SoundEventSetType;
  displayHeader?: boolean;
  theme: IProjectTheme;
}

interface ISoundEventSetEditorState {
  isLoaded: boolean;
  soundCatalogDefinition: SoundCatalogDefinition | undefined;
  soundEventSet: ISoundEventSet | undefined;
}

class SoundEventSetEditor extends Component<ISoundEventSetSoundEditorProps, ISoundEventSetEditorState> {
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

    if (soundEventSet) {
      SoundEventSetEditor.upscaleEvents(soundEventSet);
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

  /**
   * Converts string event values to {sound: string} objects so the
   * keyedObjectCollection form can render sub-forms for every entry.
   */
  static upscaleEvents(soundEventSet: ISoundEventSet) {
    if (!soundEventSet.events) {
      return;
    }

    for (const key in soundEventSet.events) {
      const val = soundEventSet.events[key];
      if (typeof val === "string") {
        soundEventSet.events[key] = { sound: val } as ISoundEvent;
      }
    }
  }

  async persist(): Promise<boolean> {
    return false;
  }

  _handleDataFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {}

  /**
   * Creates a patched form definition that changes the events field from
   * keyedStringCollection to keyedObjectCollection with an inline sub-form,
   * so mixed string/object sound event values render as editable sub-forms.
   */
  static getSoundEventForm(): IFormDefinition | undefined {
    const baseForm = Database.getForm("entity", "sound_event");
    if (!baseForm || !baseForm.fields) {
      return baseForm;
    }

    const patchedFields = baseForm.fields.map((field) => {
      if (field.id === "events") {
        return {
          ...field,
          dataType: FieldDataType.keyedObjectCollection,
          subForm: {
            id: "sound_event_item",
            fields: [
              {
                id: "sound",
                title: "Sound",
                dataType: FieldDataType.string,
                description: "The sound identifier to play for this event.",
              },
              {
                id: "volume",
                title: "Volume",
                dataType: FieldDataType.float,
                minValue: 0,
                maxValue: 1,
                step: 0.05,
                experienceType: "slider",
                description: "Volume level for this specific event.",
              },
              {
                id: "pitch",
                title: "Pitch",
                dataType: FieldDataType.float,
                description: "Pitch adjustment for this specific event.",
              },
            ],
          } as IFormDefinition,
        };
      }
      return field;
    });

    return { ...baseForm, fields: patchedFields };
  }

  render() {
    const def = this.state.soundEventSet;

    if (def === undefined) {
      return <div className="ltb-loading">Loading definition...</div>;
    }

    const form = SoundEventSetEditor.getSoundEventForm();

    let header = <></>;
    if (this.props.displayHeader === undefined || this.props.displayHeader) {
      header = <div className="sevs-header">{this.props.intl.formatMessage({ id: "project_editor.sound_event.header" })}</div>;
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

export default withLocalization(SoundEventSetEditor);

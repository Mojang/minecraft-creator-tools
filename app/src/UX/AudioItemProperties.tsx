import { Component } from "react";
import IFile from "../storage/IFile";
import "./AudioItemProperties.css";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import IProperty from "../dataform/IProperty";
import SpawnRulesBehaviorDefinition from "../minecraft/SpawnRulesBehaviorDefinition";
import SoundDefinitionCatalogDefinition from "../minecraft/SoundDefinitionCatalogDefinition";
import SoundCatalogDefinition from "../minecraft/SoundCatalogDefinition";
import Carto from "../app/Carto";
import Project from "../app/Project";
import { ISoundDefinition } from "../minecraft/ISoundDefinitionCatalog";
import IPersistable from "./IPersistable";
import ProjectItemCreateManager from "../app/ProjectItemCreateManager";

interface IAudioItemPropertiesProps {
  readOnly: boolean;
  theme: ThemeInput<any>;
  carto: Carto;
  file?: IFile;
  project: Project;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface IAudioItemPropertiesState {
  fileToEdit?: IFile;
  isLoaded: boolean;
  soundDefinitionCatalog: SoundDefinitionCatalogDefinition | undefined;
  soundCatalog: SoundCatalogDefinition | undefined;
  formData: IAudioItemFormData | undefined;
}

interface IAudioItemFormData {
  definitions: { [name: string]: ISoundDefinition };
}

export default class AudioItemProperties extends Component<IAudioItemPropertiesProps, IAudioItemPropertiesState> {
  constructor(props: IAudioItemPropertiesProps) {
    super(props);

    this._definitionLoaded = this._definitionLoaded.bind(this);
    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
      soundDefinitionCatalog: undefined,
      soundCatalog: undefined,
      formData: undefined,
    };

    this._updateManager(true);
  }

  static getDerivedStateFromProps(props: IAudioItemPropertiesProps, state: IAudioItemPropertiesState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        isLoaded: false,
        soundDefinitionCatalog: undefined,
        soundCatalog: undefined,
        formData: undefined,
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

  componentDidMount(): void {
    this._updateManager(true);

    if (this.props.setActivePersistable) {
      this.props.setActivePersistable(this);
    }
  }

  componentDidUpdate(prevProps: IAudioItemPropertiesProps, prevState: IAudioItemPropertiesState) {
    if (prevProps.file !== this.props.file) {
      this.setState({
        soundCatalog: this.state.soundCatalog,
        soundDefinitionCatalog: this.state.soundDefinitionCatalog,
        formData: undefined,
      });

      this._updateManager(true);
    }
  }

  async _updateManager(setState: boolean) {
    await Database.ensureFormLoaded("resource", "audio_item_properties");

    this._doUpdate(setState);
  }

  _definitionLoaded(defA: SpawnRulesBehaviorDefinition, defB: SpawnRulesBehaviorDefinition) {
    this._doUpdate(true);
  }

  async _doUpdate(setState: boolean) {
    let soundDefinitionCat = await ProjectItemCreateManager.ensureSoundDefinitionCatalogDefinition(this.props.project);
    let soundCat = await ProjectItemCreateManager.ensureSoundCatalogDefinition(this.props.project);

    const formData: IAudioItemFormData = {
      definitions: {},
    };

    if (this.props.file && soundDefinitionCat) {
      let matches = soundDefinitionCat.getSoundDefinitionMatchesByPath(this.props.file);

      if (matches) {
        let keyCount = 0;

        for (const key in matches) {
          if (key) {
            keyCount++;
          }
        }

        if (keyCount === 0) {
          soundDefinitionCat.ensureDefintionForFile(this.props.project, this.props.file);

          const nextMatches = soundDefinitionCat.getSoundDefinitionMatchesByPath(this.props.file);

          if (nextMatches) {
            matches = nextMatches;
          }
        }

        formData.definitions = matches;
      }
    }

    if (setState) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        isLoaded: true,
        soundDefinitionCatalog: soundDefinitionCat,
        soundCatalog: soundCat,
        formData: formData,
      });
    } else {
      this.state = {
        fileToEdit: this.props.file,
        isLoaded: true,
        soundDefinitionCatalog: soundDefinitionCat,
        soundCatalog: soundCat,
        formData: formData,
      };
    }
  }

  async persist() {
    if (this.state !== undefined && this.state.soundDefinitionCatalog) {
      this.state.soundDefinitionCatalog.persist();
    }

    if (this.state !== undefined && this.state.soundCatalog) {
      this.state.soundCatalog.persist();
    }
  }

  _handleDataFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {
    if (typeof newValue === "object") {
    }
  }

  render() {
    if (
      this.state === null ||
      !this.state.soundCatalog ||
      !this.state.soundDefinitionCatalog ||
      Database.uxCatalog === null
    ) {
      return <div>Loading...</div>;
    }

    const form = Database.getForm("resource", "audio_item_properties");

    if (!form) {
      return <div>(Error loading form)...</div>;
    }

    return (
      <div className="aipro-area">
        <div className="aipro-mainArea">
          <div className="aipro-form">
            <DataForm
              key="aidf"
              definition={form}
              directObject={this.state.formData}
              readOnly={false}
              project={this.props.project}
              lookupProvider={this.props.project}
              theme={this.props.theme}
              objectKey={this.props.file?.storageRelativePath}
              onPropertyChanged={this._handleDataFormPropertyChange}
            ></DataForm>
          </div>
        </div>
      </div>
    );
  }
}

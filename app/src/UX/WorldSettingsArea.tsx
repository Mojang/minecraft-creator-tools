import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import "./WorldSettingsArea.css";
import { Input, InputProps, Dropdown, DropdownProps, Checkbox, CheckboxProps } from "@fluentui/react-northstar";
import IPersistable from "./IPersistable";
import WebUtilities from "./WebUtilities";
import { BackupType, IPackReference, IWorldSettings } from "../minecraft/IWorldSettings";
import { GameType, Generator } from "../minecraft/WorldLevelDat";
import PackManager from "./PackManager";
import TemplateManager from "./TemplateManager";

interface IWorldSettingsAreaProps extends IAppProps {
  setActivePersistable?: (persistObject: IPersistable) => void;
  forceCompact?: boolean;
  displayName: boolean;
  displayOtherProperties: boolean;
  worldSettings: IWorldSettings;
  onWorldSettingsChanged?: (worldSettings: IWorldSettings) => void;
}

interface IWorldSettingsAreaState {
  gameType?: GameType;
  generator?: Generator;
  isEditor?: boolean;
  seed?: string;
  slotName?: string;
  useCustomSettings?: boolean;
  backupType?: BackupType;
}

export default class WorldSettingsArea
  extends Component<IWorldSettingsAreaProps, IWorldSettingsAreaState>
  implements IPersistable
{
  private _activeEditorPersistable?: IPersistable;

  private _gameTypes = ["Survival", "Creative", "Adventure"];
  private _generator = ["Old", "Infinite", "Flat"];
  private _backupTypes = ["No backup", "On start/stop only", "Every 5 minutes"];

  constructor(props: IWorldSettingsAreaProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._handleGameTypeChanged = this._handleGameTypeChanged.bind(this);
    this._handleGeneratorChanged = this._handleGeneratorChanged.bind(this);
    this._handleSeedChanged = this._handleSeedChanged.bind(this);
    this._handleBackupTypeChanged = this._handleBackupTypeChanged.bind(this);
    this._handleNameChanged = this._handleNameChanged.bind(this);
    this._handlePackSetChanged = this._handlePackSetChanged.bind(this);
    this._handleTemplateSetChanged = this._handleTemplateSetChanged.bind(this);
    this._handleUseEditor = this._handleUseEditor.bind(this);

    this.state = {
      gameType: props.worldSettings ? props.worldSettings.gameType : GameType.creative,
      generator: props.worldSettings ? props.worldSettings.generator : Generator.flat,
      seed: props.worldSettings ? props.worldSettings.randomSeed : "1000",
      isEditor: props.worldSettings ? props.worldSettings.isEditor : false,
      useCustomSettings: props.worldSettings ? props.worldSettings.useCustomSettings : false,
      slotName: props.worldSettings ? props.worldSettings.name : "world",
    };
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this._activeEditorPersistable = newPersistable;
  }

  async persist() {
    if (this._activeEditorPersistable !== undefined) {
      await this._activeEditorPersistable.persist();
    }
  }

  _handleUseEditor(e: SyntheticEvent, data: (CheckboxProps & { checked: boolean }) | undefined) {
    if (data) {
      if (data.checked) {
        this.props.worldSettings.isEditor = true;
      } else {
        this.props.worldSettings.isEditor = false;
      }

      this._notifyUpdated();
      this.setState({
        gameType: this.state.gameType,
        generator: this.state.generator,
        isEditor: this.state.isEditor,
        seed: this.state.seed,
        useCustomSettings: this.state.useCustomSettings,
        slotName: this.state.slotName,
        backupType: this.state.backupType,
      });
    }
  }

  _handleGameTypeChanged(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    for (let i = 0; i < this._gameTypes.length; i++) {
      const gameType = this._gameTypes[i];

      if (gameType === data.value && this.state.gameType !== i) {
        this.props.worldSettings.gameType = i;

        this._notifyUpdated();

        this.setState({
          gameType: i,
          generator: this.state.generator,
          seed: this.state.seed,
          isEditor: this.state.isEditor,
          useCustomSettings: this.state.useCustomSettings,
          slotName: this.state.slotName,
          backupType: this.state.backupType,
        });
      }
    }
  }

  _handleBackupTypeChanged(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    for (let i = 0; i < this._backupTypes.length; i++) {
      const backupType = this._backupTypes[i];

      if (backupType === data.value && this.state.backupType !== i) {
        this.props.worldSettings.backupType = i;

        this._notifyUpdated();

        this.setState({
          gameType: this.state.gameType,
          generator: this.state.generator,
          seed: this.state.seed,
          isEditor: this.state.isEditor,
          useCustomSettings: this.state.useCustomSettings,
          slotName: this.state.slotName,
          backupType: i,
        });
      }
    }
  }

  _handleGeneratorChanged(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    for (let i = 0; i < this._generator.length; i++) {
      const gen = this._generator[i];

      if (gen === data.value && this.state.generator !== i) {
        this.props.worldSettings.generator = i;

        this._notifyUpdated();

        this.setState({
          gameType: this.state.gameType,
          generator: i,
          seed: this.state.seed,
          isEditor: this.state.isEditor,
          useCustomSettings: this.state.useCustomSettings,
          slotName: this.state.slotName,
          backupType: this.state.backupType,
        });
      }
    }
  }

  _handlePackSetChanged(packReferences: IPackReference[]) {
    this.props.worldSettings.packReferences = packReferences;

    this._notifyUpdated();
  }

  _handleTemplateSetChanged(packReferences: IPackReference[]) {
    this.props.worldSettings.worldTemplateReferences = packReferences;

    this._notifyUpdated();
    this.forceUpdate();
  }

  _notifyUpdated() {
    if (this.props.onWorldSettingsChanged) {
      this.props.onWorldSettingsChanged(this.props.worldSettings);
    }
  }

  _handleSeedChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    let bigintVal: bigint | undefined = undefined;

    try {
      bigintVal = BigInt(data.value);
    } catch (e) {
      return;
    }

    if (bigintVal === undefined) {
      return;
    }

    if (data.value !== this.state.seed) {
      this.props.worldSettings.randomSeed = data.value;

      this._notifyUpdated();

      this.setState({
        gameType: this.state.gameType,
        generator: this.state.generator,
        seed: data.value,
        isEditor: this.state.isEditor,
        useCustomSettings: this.state.useCustomSettings,
        slotName: this.state.slotName,
        backupType: this.state.backupType,
      });
    }
  }

  _handleNameChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    this.props.worldSettings.name = data.value;

    this._notifyUpdated();

    this.setState({
      gameType: this.state.gameType,
      generator: this.state.generator,
      seed: this.state.seed,
      isEditor: this.state.isEditor,
      useCustomSettings: this.state.useCustomSettings,
      slotName: data.value,
      backupType: this.state.backupType,
    });
  }

  render() {
    if (this.props === undefined || this.state === undefined) {
      return <></>;
    }

    let outerClassNameModifier = "";
    const width = WebUtilities.getWidth();

    if (width < 1016 || this.props.forceCompact === true) {
      outerClassNameModifier = "Compact";
    }

    const settingsProps = [];

    let enableCustomWorldOptions = true;

    if (
      this.props.worldSettings.worldTemplateReferences &&
      this.props.worldSettings.worldTemplateReferences.length > 0
    ) {
      enableCustomWorldOptions = false;
    }

    if (this.props.displayName) {
      settingsProps.push(
        <div className={"wsa-label wsa-namelabel" + outerClassNameModifier} key="namelabel">
          World Name
        </div>
      );

      settingsProps.push(
        <div className="wsa-nameinput" key="nameinput">
          <Input value={this.state.slotName} onChange={this._handleNameChanged} placeholder="1" />
        </div>
      );
    }

    if (this.props.displayOtherProperties) {
      settingsProps.push(
        <div className={"wsa-label wsa-gametypelabel" + outerClassNameModifier} key="gametypelabel">
          Game Type
        </div>
      );

      settingsProps.push(
        <div className="wsa-gametypeinput" key="gametypeinput">
          <Dropdown
            items={this._gameTypes}
            key="gtInput"
            defaultValue={
              this.props.worldSettings && this.props.worldSettings.gameType !== undefined
                ? this._gameTypes[this.props.worldSettings.gameType]
                : "Creative"
            }
            disabled={!enableCustomWorldOptions}
            placeholder="Game type"
            onChange={this._handleGameTypeChanged}
          />
        </div>
      );

      settingsProps.push(
        <div className={"wsa-label wsa-iseditorlabel" + outerClassNameModifier} key="iseditorlabel">
          Editor Mode
        </div>
      );

      settingsProps.push(
        <div className="wsa-iseditorinput" key="iseditorinput">
          <Checkbox
            toggle={true}
            checked={this.props.worldSettings.isEditor === true}
            onClick={this._handleUseEditor}
            disabled={!enableCustomWorldOptions}
          />
        </div>
      );

      settingsProps.push(
        <div className={"wsa-label wsa-genlabel" + outerClassNameModifier} key="genlabel">
          Generator
        </div>
      );

      settingsProps.push(
        <div className="wsa-geninput" key="geninput">
          <Dropdown
            items={this._generator}
            key="genInput"
            disabled={!enableCustomWorldOptions}
            defaultValue={
              this.props.worldSettings && this.props.worldSettings.generator !== undefined
                ? this._generator[this.props.worldSettings?.generator]
                : "Flat"
            }
            placeholder="Generator"
            onChange={this._handleGeneratorChanged}
          />
        </div>
      );
      settingsProps.push(
        <div className={"wsa-label wsa-worldsettingslabel" + outerClassNameModifier} key="wslabel">
          New World Settings
        </div>
      );

      settingsProps.push(
        <div className={"wsa-label wsa-templatelabel" + outerClassNameModifier} key="templateslabel">
          World Templates
        </div>
      );

      let templateRefs = this.props.worldSettings?.worldTemplateReferences;

      if (templateRefs === undefined) {
        templateRefs = [];
      }

      settingsProps.push(
        <div className="wsa-templates" key="templatebin">
          <TemplateManager
            carto={this.props.carto}
            packReferences={templateRefs}
            onPackSetChanged={this._handleTemplateSetChanged}
          />
        </div>
      );

      settingsProps.push(
        <div className={"wsa-label wsa-seedlabel" + outerClassNameModifier} key="seedlabel">
          Seed
        </div>
      );

      settingsProps.push(
        <div className="wsa-seedinput" key="seedinput">
          <Input
            value={this.state.seed === undefined ? "" : this.state.seed.toString()}
            disabled={!enableCustomWorldOptions}
            onChange={this._handleSeedChanged}
            placeholder="1"
          />
        </div>
      );

      settingsProps.push(
        <div className={"wsa-label wsa-backuplabel" + outerClassNameModifier} key="backuplabel">
          Backup
        </div>
      );

      settingsProps.push(
        <div className="wsa-backupinput" key="backupinput">
          <Dropdown
            items={this._backupTypes}
            key="backupInput"
            defaultValue={
              this.props.worldSettings && this.props.worldSettings.backupType !== undefined
                ? this._backupTypes[this.props.worldSettings.backupType]
                : "Every 5 minutes"
            }
            placeholder="Every 5 minutes"
            onChange={this._handleBackupTypeChanged}
          />
        </div>
      );

      settingsProps.push(
        <div className={"wsa-label wsa-packlabel" + outerClassNameModifier} key="packslabel">
          Packs
        </div>
      );

      let packRefs = this.props.worldSettings?.packReferences;

      if (packRefs === undefined) {
        packRefs = [];
      }

      settingsProps.push(
        <div className="wsa-packs" key="packbin">
          <PackManager
            carto={this.props.carto}
            packReferences={packRefs}
            isWorldFocused={false}
            onPackSetChanged={this._handlePackSetChanged}
          />
        </div>
      );
    }

    return (
      <div className="wsa-outer">
        <div className={"wsa-grid" + outerClassNameModifier}>{settingsProps}</div>
      </div>
    );
  }
}

import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import "./WorldSettingsArea.css";
import { TextField, Select, MenuItem, Checkbox, FormControlLabel, SelectChangeEvent } from "@mui/material";
import IPersistable from "../types/IPersistable";
import WebUtilities from "../utils/WebUtilities";
import { BackupType, IPackageReference, IWorldSettings } from "../../minecraft/IWorldSettings";
import { Difficulty, GameType, Generator } from "../../minecraft/WorldLevelDat";
import PackManager from "../io/PackageManager";
import TemplateManager from "../io/TemplateManager";

interface IWorldSettingsAreaProps extends IAppProps {
  setActivePersistable?: (persistObject: IPersistable) => void;
  forceCompact?: boolean;
  isAdditive?: boolean;
  displayName: boolean;
  displayGameTypeProperties: boolean;
  displayGameAdminProperties: boolean;
  worldSettings: IWorldSettings;
  onWorldSettingsChanged?: (worldSettings: IWorldSettings) => void;
}

interface IWorldSettingsAreaState {
  gameType?: GameType;
  difficulty?: Difficulty;
  generator?: Generator;
  isEditor?: boolean;
  maxPlayerCount?: number;
  seed?: string;
  slotName?: string;
  useCustomSettings?: boolean;
  backupType?: BackupType;
}

export default class WorldSettingsArea extends Component<IWorldSettingsAreaProps, IWorldSettingsAreaState> {
  private _activeEditorPersistable?: IPersistable;

  private _gameTypes = ["Survival", "Creative", "Adventure"];
  private _difficulty = ["Peaceful", "Easy", "Normal", "Hard"];
  private _generator = ["Old", "Infinite", "Flat"];
  private _backupTypes = ["No backup", "On start/stop only", "Every 5 minutes", "Every 2 minutes"];

  constructor(props: IWorldSettingsAreaProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._handleGameTypeChanged = this._handleGameTypeChanged.bind(this);
    this._handleGeneratorChanged = this._handleGeneratorChanged.bind(this);
    this._handleSeedChanged = this._handleSeedChanged.bind(this);
    this._handleBackupTypeChanged = this._handleBackupTypeChanged.bind(this);
    this._handleDifficultyChanged = this._handleDifficultyChanged.bind(this);
    this._handleNameChanged = this._handleNameChanged.bind(this);
    this._handlePackSetChanged = this._handlePackSetChanged.bind(this);
    this._handleTemplateSetChanged = this._handleTemplateSetChanged.bind(this);
    this._handleUseEditor = this._handleUseEditor.bind(this);
    this._handleTransientWorld = this._handleTransientWorld.bind(this);

    this.state = {
      gameType: props.worldSettings ? props.worldSettings.gameType : GameType.creative,
      generator: props.worldSettings ? props.worldSettings.generator : Generator.flat,
      difficulty: props.worldSettings ? props.worldSettings.difficulty : Difficulty.normal,
      seed: props.worldSettings ? props.worldSettings.randomSeed : "1000",
      maxPlayerCount: props.worldSettings ? props.worldSettings.maxPlayerCount : 10,
      isEditor: props.worldSettings ? props.worldSettings.isEditor : false,
      useCustomSettings: props.worldSettings ? props.worldSettings.useCustomSettings : false,
      slotName: props.worldSettings ? props.worldSettings.name : "world",
    };
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this._activeEditorPersistable = newPersistable;
  }

  async persist(): Promise<boolean> {
    if (this._activeEditorPersistable !== undefined) {
      return await this._activeEditorPersistable.persist();
    }

    return false;
  }

  _handleUseEditor(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
      this.props.worldSettings.isEditor = true;
    } else {
      this.props.worldSettings.isEditor = false;
    }

    this._notifyUpdated();
    this.setState({
      gameType: this.state.gameType,
      generator: this.state.generator,
      maxPlayerCount: this.state.maxPlayerCount,
      difficulty: this.state.difficulty,

      isEditor: this.state.isEditor,
      seed: this.state.seed,
      useCustomSettings: this.state.useCustomSettings,
      slotName: this.state.slotName,
      backupType: this.state.backupType,
    });
  }

  _handleTransientWorld(e: React.ChangeEvent<HTMLInputElement>) {
    this.props.worldSettings.transientWorld = e.target.checked === true;
    this._notifyUpdated();
    this.forceUpdate();
  }

  _handleGameTypeChanged(event: SelectChangeEvent<string>) {
    for (let i = 0; i < this._gameTypes.length; i++) {
      const gameType = this._gameTypes[i];

      if (gameType === event.target.value && this.state.gameType !== i) {
        this.props.worldSettings.gameType = i;

        this._notifyUpdated();

        this.setState({
          gameType: i,
          generator: this.state.generator,
          maxPlayerCount: this.state.maxPlayerCount,
          difficulty: this.state.difficulty,
          seed: this.state.seed,
          isEditor: this.state.isEditor,
          useCustomSettings: this.state.useCustomSettings,
          slotName: this.state.slotName,
          backupType: this.state.backupType,
        });
      }
    }
  }

  _handleDifficultyChanged(event: SelectChangeEvent<string>) {
    for (let i = 0; i < this._difficulty.length; i++) {
      const difficulty = this._difficulty[i];

      if (difficulty === event.target.value && this.state.difficulty !== i) {
        this.props.worldSettings.difficulty = i;

        this._notifyUpdated();

        this.setState({
          difficulty: i,
          generator: this.state.generator,
          maxPlayerCount: this.state.maxPlayerCount,
          gameType: this.state.gameType,
          seed: this.state.seed,
          isEditor: this.state.isEditor,
          useCustomSettings: this.state.useCustomSettings,
          slotName: this.state.slotName,
          backupType: this.state.backupType,
        });
      }
    }
  }

  _handleBackupTypeChanged(event: SelectChangeEvent<string>) {
    for (let i = 0; i < this._backupTypes.length; i++) {
      const backupType = this._backupTypes[i];

      if (backupType === event.target.value && this.state.backupType !== i) {
        this.props.worldSettings.backupType = i;

        this._notifyUpdated();

        this.setState({
          gameType: this.state.gameType,
          generator: this.state.generator,
          maxPlayerCount: this.state.maxPlayerCount,
          difficulty: this.state.difficulty,

          seed: this.state.seed,
          isEditor: this.state.isEditor,
          useCustomSettings: this.state.useCustomSettings,
          slotName: this.state.slotName,
          backupType: i,
        });
      }
    }
  }

  _handleGeneratorChanged(event: SelectChangeEvent<string>) {
    for (let i = 0; i < this._generator.length; i++) {
      const gen = this._generator[i];

      if (gen === event.target.value && this.state.generator !== i) {
        this.props.worldSettings.generator = i;

        this._notifyUpdated();

        this.setState({
          gameType: this.state.gameType,
          generator: i,
          seed: this.state.seed,
          maxPlayerCount: this.state.maxPlayerCount,
          difficulty: this.state.difficulty,

          isEditor: this.state.isEditor,
          useCustomSettings: this.state.useCustomSettings,
          slotName: this.state.slotName,
          backupType: this.state.backupType,
        });
      }
    }
  }

  _handlePackSetChanged(packReferences: IPackageReference[]) {
    this.props.worldSettings.packageReferences = packReferences;

    this._notifyUpdated();
  }

  _handleTemplateSetChanged(packReferences: IPackageReference[]) {
    this.props.worldSettings.worldTemplateReferences = packReferences;

    this._notifyUpdated();
    this.forceUpdate();
  }

  _notifyUpdated() {
    if (this.props.onWorldSettingsChanged) {
      this.props.onWorldSettingsChanged(this.props.worldSettings);
    }
  }

  _handleSeedChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    const value = e.target.value;
    let bigintVal: bigint | undefined;

    try {
      bigintVal = BigInt(value);
    } catch (e) {
      return;
    }

    if (bigintVal === undefined) {
      return;
    }

    if (value !== this.state.seed) {
      this.props.worldSettings.randomSeed = value;

      this._notifyUpdated();

      this.setState({
        gameType: this.state.gameType,
        generator: this.state.generator,
        seed: value,
        isEditor: this.state.isEditor,
        maxPlayerCount: this.state.maxPlayerCount,
        difficulty: this.state.difficulty,

        useCustomSettings: this.state.useCustomSettings,
        slotName: this.state.slotName,
        backupType: this.state.backupType,
      });
    }
  }

  _handleNameChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    const value = e.target.value;
    this.props.worldSettings.name = value;

    this._notifyUpdated();

    this.setState({
      gameType: this.state.gameType,
      generator: this.state.generator,
      seed: this.state.seed,
      isEditor: this.state.isEditor,
      maxPlayerCount: this.state.maxPlayerCount,
      difficulty: this.state.difficulty,

      useCustomSettings: this.state.useCustomSettings,
      slotName: value,
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
        <div className={"wsa-label wsa-namelabel" + outerClassNameModifier} key="namelabel" id="wsa-label-name">
          World name
        </div>
      );

      settingsProps.push(
        <div className="wsa-nameinput" key="nameinput">
          <TextField
            aria-labelledby="wsa-label-name"
            value={this.state.slotName}
            onChange={this._handleNameChanged}
            placeholder="1"
            size="small"
            variant="outlined"
          />
        </div>
      );
    }

    if (this.props.displayGameTypeProperties) {
      settingsProps.push(
        <div
          className={"wsa-label wsa-gametypelabel" + outerClassNameModifier}
          key="gametypelabel"
          id="wsa-label-gametype"
        >
          Game type
        </div>
      );

      settingsProps.push(
        <div className="wsa-gametypeinput" key="gametypeinput">
          <Select
            value={
              this.props.worldSettings && this.props.worldSettings.gameType !== undefined
                ? this._gameTypes[this.props.worldSettings.gameType]
                : "Creative"
            }
            key="gtInput"
            aria-labelledby="wsa-label-gametype"
            disabled={!enableCustomWorldOptions}
            onChange={this._handleGameTypeChanged}
            size="small"
          >
            {this._gameTypes.map((gt) => (
              <MenuItem key={gt} value={gt}>
                {gt}
              </MenuItem>
            ))}
          </Select>
        </div>
      );

      settingsProps.push(
        <div
          className={"wsa-label wsa-gamedifflabel" + outerClassNameModifier}
          key="gamedifflabel"
          id="wsa-label-gamediff"
        >
          Difficulty
        </div>
      );

      settingsProps.push(
        <div className="wsa-gamediffinput" key="gamediffinput">
          <Select
            value={
              this.props.worldSettings && this.props.worldSettings.difficulty !== undefined
                ? this._difficulty[this.props.worldSettings.difficulty]
                : "Normal"
            }
            key="gdInput"
            aria-labelledby="wsa-label-gamediff"
            disabled={!enableCustomWorldOptions}
            onChange={this._handleDifficultyChanged}
            size="small"
          >
            {this._difficulty.map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </Select>
        </div>
      );

      settingsProps.push(
        <div className="wsa-iseditorinput" key="iseditorinput">
          <FormControlLabel
            control={
              <Checkbox
                checked={this.props.worldSettings.isEditor === true}
                onChange={this._handleUseEditor}
                disabled={!enableCustomWorldOptions}
              />
            }
            label="Editor Mode"
          />
        </div>
      );

      settingsProps.push(
        <div className="wsa-transientworldinput" key="transientworldinput">
          <FormControlLabel
            control={
              <Checkbox
                checked={this.props.worldSettings.transientWorld === true}
                onChange={this._handleTransientWorld}
              />
            }
            label="Transient World"
            title="When enabled, world data is not backed up and each deployment starts fresh. Useful for development."
          />
        </div>
      );

      settingsProps.push(
        <div className={"wsa-label wsa-packlabel" + outerClassNameModifier} key="packslabel">
          {this.props.isAdditive === true ? "Additional Packs" : "Packs"}
        </div>
      );

      let packRefs = this.props.worldSettings?.packageReferences;

      if (packRefs === undefined) {
        packRefs = [];
      }

      settingsProps.push(
        <div className="wsa-packs" key="packbin">
          <PackManager
            creatorTools={this.props.creatorTools}
            packReferences={packRefs}
            isWorldFocused={false}
            onPackSetChanged={this._handlePackSetChanged}
          />
        </div>
      );

      if (!this.props.isAdditive) {
        settingsProps.push(
          <div className={"wsa-label wsa-worldsettingslabel" + outerClassNameModifier} key="wslabel">
            When creating a new world:
          </div>
        );
      }

      settingsProps.push(
        <div className={"wsa-label wsa-templatelabel" + outerClassNameModifier} key="templateslabel">
          Use world template
        </div>
      );

      let templateRefs = this.props.worldSettings?.worldTemplateReferences;

      if (templateRefs === undefined) {
        templateRefs = [];
      }

      settingsProps.push(
        <div className="wsa-templates" key="templatebin">
          <TemplateManager
            creatorTools={this.props.creatorTools}
            packReferences={templateRefs}
            onPackSetChanged={this._handleTemplateSetChanged}
          />
        </div>
      );

      settingsProps.push(
        <div className={"wsa-label wsa-genlabel" + outerClassNameModifier} key="genlabel">
          Or map style
        </div>
      );

      settingsProps.push(
        <div className="wsa-geninput" key="geninput">
          <Select
            value={
              this.props.worldSettings && this.props.worldSettings.generator !== undefined
                ? this._generator[this.props.worldSettings?.generator]
                : "Flat"
            }
            key="genInput"
            aria-label="Map Style"
            disabled={!enableCustomWorldOptions}
            onChange={this._handleGeneratorChanged}
            size="small"
          >
            {this._generator.map((g) => (
              <MenuItem key={g} value={g}>
                {g}
              </MenuItem>
            ))}
          </Select>
        </div>
      );

      settingsProps.push(
        <div className={"wsa-label wsa-seedlabel" + outerClassNameModifier} key="seedlabel">
          &#160;&#160;&#160;&#160;Seed
        </div>
      );

      settingsProps.push(
        <div className="wsa-seedinput" key="seedinput">
          <TextField
            aria-label="World Seed"
            value={this.state.seed === undefined ? "" : this.state.seed.toString()}
            disabled={!enableCustomWorldOptions}
            onChange={this._handleSeedChanged}
            placeholder="1"
            size="small"
            variant="outlined"
          />
        </div>
      );
    }

    if (this.props.displayGameAdminProperties) {
      settingsProps.push(
        <div className={"wsa-label wsa-backuplabel" + outerClassNameModifier} key="backuplabel" id="wsa-label-backup">
          Backup
        </div>
      );

      settingsProps.push(
        <div className="wsa-backupinput" key="backupinput">
          <Select
            value={
              this.props.worldSettings && this.props.worldSettings.backupType !== undefined
                ? this._backupTypes[this.props.worldSettings.backupType]
                : "Every 5 minutes"
            }
            key="backupInput"
            aria-labelledby="wsa-label-backup"
            onChange={this._handleBackupTypeChanged}
            size="small"
          >
            {this._backupTypes.map((bt) => (
              <MenuItem key={bt} value={bt}>
                {bt}
              </MenuItem>
            ))}
          </Select>
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

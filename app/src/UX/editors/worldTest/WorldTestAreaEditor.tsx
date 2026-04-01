import { Component } from "react";
import "./WorldTestAreaEditor.css";
import { FormControl, IconButton, MenuItem, Select, SelectChangeEvent, Stack } from "@mui/material";
import WorldTestArea from "../../../worldtest/WorldTestArea";
import ActionSetEditor from "../action/ActionSetEditor";
import CommandRunner from "../../../app/CommandRunner";
import CreatorTools from "../../../app/CreatorTools";
import DataForm from "../../../dataformux/DataForm";
import IFormDefinition from "../../../dataform/IFormDefinition";
import Database from "../../../minecraft/Database";
import BlockLocation from "../../../minecraft/BlockLocation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlusCircle, faPlayCircle } from "@fortawesome/free-solid-svg-icons";
import ICommandOptions from "../../../actions/ICommandOptions";
import Project from "../../../app/Project";
import Action from "../../../actions/Action";
import IProjectTheme from "../../types/IProjectTheme";

interface IWorldTestAreaEditorProps {
  area: WorldTestArea;
  creatorTools: CreatorTools;
  objectKey: string;
  project: Project;
  theme: IProjectTheme;
  heightOffset: number;
  selectionBlockFrom?: BlockLocation;
  selectionBlockTo?: BlockLocation;
}

interface IWorldTestAreaEditorState {
  selectedScriptIndex: number | undefined;
}

export default class WorldTestAreaEditor extends Component<IWorldTestAreaEditorProps, IWorldTestAreaEditorState> {
  private _commandsToRun: string[] = [];
  private _commandIndex = 0;

  constructor(props: IWorldTestAreaEditorProps) {
    super(props);

    this._addScriptClick = this._addScriptClick.bind(this);
    this._runSimulation = this._runSimulation.bind(this);
    this._runNextCommand = this._runNextCommand.bind(this);
    this._handleScriptChange = this._handleScriptChange.bind(this);
    //  this._recordScriptClick = this._recordScriptClick.bind(this);
  }

  _addScriptClick() {
    const worldTestArea = this.props.area;

    if (worldTestArea === undefined) {
      return;
    }

    worldTestArea.createScript("");

    this.setState({
      selectedScriptIndex: worldTestArea.scripts.length - 1,
    });
  }

  async _runSimulation() {
    const worldTestArea = this.props.area;

    if (worldTestArea === undefined) {
      return;
    }

    this._commandsToRun = [];
    this._commandIndex = 0;

    this._commandsToRun.push("gamerule sendCommandFeedback false");
    this._commandsToRun.push(
      "tp " + worldTestArea.location.x + " " + worldTestArea.location.y + " " + worldTestArea.location.z
    );

    for (let i = 0; i < worldTestArea.scripts.length; i++) {
      const script = worldTestArea.scripts[i];

      script.locationRoot = worldTestArea.location.toLocation();

      for (let j = 0; j < script.actions.length; j++) {
        const action = script.actions[j];

        if (action instanceof Action) {
          const options: ICommandOptions = {};

          action.addCommandLines(this._commandsToRun, 0, options);
        }
      }
    }

    this._runNextCommand();
  }

  _runNextCommand() {
    const command = this._commandsToRun[this._commandIndex];

    CommandRunner.runCommandText(this.props.creatorTools, command);

    this._commandIndex++;

    if (this._commandIndex < this._commandsToRun.length) {
      window.setTimeout(this._runNextCommand, 500);
    }
  }

  /*
  _recordScriptClick() {
    const worldTestArea = this.props.area;

    if (worldTestArea === undefined) {
      return;
    }

    worldTestArea.createScript("");

    this.setState({
      selectedScriptIndex: worldTestArea.scripts.length - 1,
    });
  }
*/
  _handleScriptChange(event: SelectChangeEvent<string>) {
    const worldTestArea = this.props.area;

    if (worldTestArea === undefined) {
      return;
    }

    const selectedValue = event.target.value;
    let index = undefined;

    for (let i = 0; i < worldTestArea.scripts.length; i++) {
      const scriptName = (i + 1).toString() + ". " + worldTestArea.scripts[i].name;
      if (scriptName === selectedValue) {
        index = i;
        break;
      }
    }

    if (index !== undefined) {
      this.setState({
        selectedScriptIndex: index,
      });
    }
  }

  render() {
    if (Database.uxCatalog === null) {
      return <div>Loading...</div>;
    }
    let height = "calc(100vh - " + this.props.heightOffset + "px)";

    const formDef: IFormDefinition = (Database.uxCatalog as any)["worldTestArea"];

    let ambientSelectionPoint: number[] = [];

    if (this.props.selectionBlockFrom) {
      ambientSelectionPoint = this.props.selectionBlockFrom.toArray();
    }
    let scriptComponent = <></>;
    let scriptDropdown = <></>;

    const worldTestArea = this.props.area;

    if (worldTestArea) {
      const scriptList: string[] = [];
      let selectedScript = "";

      if (worldTestArea.scripts.length > 0) {
        let i = 0;

        for (const script of worldTestArea.scripts) {
          scriptList.push((i + 1).toString() + ". " + script.name);

          if (this.state) {
            if (i === this.state.selectedScriptIndex) {
              selectedScript = (i + 1).toString() + ". " + script.name;
            }
          }

          i++;
        }
      }

      scriptDropdown = (
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select
            value={selectedScript}
            disabled={worldTestArea.scripts.length === 0}
            displayEmpty
            onChange={this._handleScriptChange}
          >
            {scriptList.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );

      if (
        this.state &&
        this.state.selectedScriptIndex !== undefined &&
        this.state.selectedScriptIndex >= 0 &&
        this.state.selectedScriptIndex < worldTestArea.scripts.length
      ) {
        let ambientSel = ambientSelectionPoint;
        const script = worldTestArea.scripts[this.state.selectedScriptIndex];

        if (ambientSel && worldTestArea.location && script && ambientSel.length === 3) {
          ambientSel = [
            ambientSel[0] - worldTestArea.location.x,
            ambientSel[1] - worldTestArea.location.y,
            ambientSel[2] - worldTestArea.location.z,
          ];
        }

        scriptComponent = (
          <ActionSetEditor
            actionSet={script}
            ambientSelectedPoint={ambientSel}
            theme={this.props.theme}
            project={this.props.project}
            heightOffset={this.props.heightOffset + 80}
            readOnly={false}
            creatorTools={this.props.creatorTools}
          />
        );
      }
    }

    /*
    const clientButtons = [];
    if (ElectronProxy.isElectronOrDebug) {
      clientButtons.push(<Button content="Record" primary onClick={this._recordScriptClick} />);
    }*/

    return (
      <div
        className="wtae-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="wtae-summaryArea">
          <div className="wtae-summaryAreaTitle">Start Location</div>
          <div className="wtae-summaryAreaForm">
            <DataForm
              definition={formDef}
              readOnly={false}
              theme={this.props.theme}
              objectKey={this.props.objectKey}
              getsetPropertyObject={this.props.area}
              ambientSelectedPoint={ambientSelectionPoint}
            />
          </div>
        </div>
        <div className="wtae-actionsArea">
          <div className="wtae-actionsAreaDropdown">{scriptDropdown}</div>
          <div className="wtae-actionsAreaToolbar">
            <Stack direction="row" spacing={1} aria-label="World test area actions">
              <IconButton onClick={this._addScriptClick} title="Add a new script" size="small">
                <FontAwesomeIcon icon={faPlusCircle} className="fa-lg" />
              </IconButton>
              <IconButton onClick={this._runSimulation} title="Run simulation" size="small">
                <FontAwesomeIcon icon={faPlayCircle} className="fa-lg" />
              </IconButton>
            </Stack>
          </div>
        </div>

        <div className="wtae-extraArea">{scriptComponent}</div>
      </div>
    );
  }
}

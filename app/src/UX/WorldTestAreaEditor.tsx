import { Component } from "react";
import "./WorldTestAreaEditor.css";
import { Toolbar, Dropdown, DropdownProps } from "@fluentui/react-northstar";
import WorldTestArea from "../worldtest/WorldTestArea.js";
import AutoScriptEditor from "./AutoScriptEditor";
import CommandManager from "../app/CommandManager";
import Carto from "./../app/Carto";
import DataForm from "../dataform/DataForm";
import IFormDefinition from "../dataform/IFormDefinition.js";
import Database from "../minecraft/Database";
import BlockLocation from "../minecraft/BlockLocation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlusCircle, faPlayCircle } from "@fortawesome/free-solid-svg-icons";
import ICommandOptions from "../autoscript/ICommandOptions";

interface IWorldTestAreaEditorProps {
  area: WorldTestArea;
  carto: Carto;
  objectKey: string;
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

        const options: ICommandOptions = {};

        action.addCommandLines(this._commandsToRun, 0, options);
      }
    }

    this._runNextCommand();
  }

  _runNextCommand() {
    const command = this._commandsToRun[this._commandIndex];

    CommandManager.runCommandText(this.props.carto, command);

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
  _handleScriptChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    let index = undefined;

    if (data.items) {
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        if (item === data.value) {
          index = i;
        }
      }

      if (index !== undefined) {
        this.setState({
          selectedScriptIndex: index,
        });
      }
    }
  }

  render() {
    /*const actions = this.props.action.actions as IAutoScriptAction[];

    for (const action in actions) {
    }*/
    if (Database.uxCatalog === null) {
      return <div>Loading...</div>;
    }
    let height = "calc(100vh - " + this.props.heightOffset + "px)";

    const formDef: IFormDefinition = (Database.uxCatalog as any)["worldTestArea"];

    const toolbarItems: any[] = [];

    toolbarItems.push({
      icon: <FontAwesomeIcon icon={faPlusCircle} className="fa-lg" />,
      key: "recording",
      kind: "button",
      onClick: this._addScriptClick,
      title: "Add a new script",
    });

    toolbarItems.push({
      icon: <FontAwesomeIcon icon={faPlayCircle} className="fa-lg" />,
      key: "runSimulation",
      kind: "button",
      onClick: this._runSimulation,
      title: "Run simulation",
    });

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
      let scriptPlaceholder = "";

      if (worldTestArea.scripts.length > 0) {
        let i = 0;

        for (const script of worldTestArea.scripts) {
          scriptList.push((i + 1).toString() + ". " + script.name);

          if (this.state) {
            if (i === this.state.selectedScriptIndex) {
              selectedScript = (i + 1).toString() + ". " + script.name;
              scriptPlaceholder = selectedScript;
            }
          }

          i++;
        }
      }

      scriptDropdown = (
        <Dropdown
          items={scriptList}
          disabled={worldTestArea.scripts.length === 0}
          defaultValue={selectedScript}
          placeholder={scriptPlaceholder}
          onChange={this._handleScriptChange}
        />
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
          <AutoScriptEditor
            script={script}
            ambientSelectedPoint={ambientSel}
            heightOffset={this.props.heightOffset + 80}
            readOnly={false}
            carto={this.props.carto}
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
              objectKey={this.props.objectKey}
              getsetPropertyObject={this.props.area}
              ambientSelectedPoint={ambientSelectionPoint}
            />
          </div>
        </div>
        <div className="wtae-actionsArea">
          <div className="wtae-actionsAreaDropdown">{scriptDropdown}</div>
          <div className="wtae-actionsAreaToolbar">
            <Toolbar aria-label="Actions toolbar overflow menu" items={toolbarItems} />
          </div>
        </div>

        <div className="wtae-extraArea">{scriptComponent}</div>
      </div>
    );
  }
}

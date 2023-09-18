import { Component } from "react";
import "./AutoScriptGroupEditor.css";
import { Toolbar, SplitButton } from "@fluentui/react-northstar";
import AutoScriptGroup from "../autoscript/AutoScriptGroup";
import AutoScriptAction, { AutoScriptActionType } from "../autoscript/AutoScriptAction";
import AutoScriptActionEditor from "./AutoScriptActionEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRecordVinyl } from "@fortawesome/free-solid-svg-icons";
import AppServiceProxy from "./../core/AppServiceProxy";
import Carto from "./../app/Carto";
import GameStateManager from "../minecraft/GameStateManager";
import IPlayerTravelledEvent from "../minecraft/IPlayerTravelledEvent";
import IItemInteractedEvent from "../minecraft/IItemInteractedEvent";
import SimulatedPlayerMoveAction from "../autoscript/SimulatedPlayerMoveAction";
import Location from "../minecraft/Location";
import SimulatedPlayerInteractionAction from "../autoscript/SimulatedPlayerInteractionAction";
import Log from "../core/Log";

interface IAutoScriptGroupEditorProps {
  group: AutoScriptGroup;
  carto: Carto;
  heightOffset: number;
  ambientSelectedPoint?: number[] | undefined;
  displayConditionEditor: boolean;
  displayBaseActionEditor: boolean;
}

interface IAutoScriptGroupEditorState {
  isRecording: boolean;
}

export default class AutoScriptGroupEditor extends Component<IAutoScriptGroupEditorProps, IAutoScriptGroupEditorState> {
  constructor(props: IAutoScriptGroupEditorProps) {
    super(props);

    this._removeAction = this._removeAction.bind(this);
    this._moveSimulatedPlayerClick = this._moveSimulatedPlayerClick.bind(this);
    this._spawnSimulatedPlayerClick = this._spawnSimulatedPlayerClick.bind(this);
    this._spawnEntityClick = this._spawnEntityClick.bind(this);
    this._idleClick = this._idleClick.bind(this);
    this._toggleRecording = this._toggleRecording.bind(this);
    this._handlePlayerTravelled = this._handlePlayerTravelled.bind(this);

    this.state = {
      isRecording: false,
    };
  }

  _moveSimulatedPlayerClick() {
    this._addAction("simulatedplayer.move");
  }

  _spawnSimulatedPlayerClick() {
    this._addAction("simulatedplayer.spawn");
  }

  _spawnEntityClick() {
    this._addAction("entity.spawn");
  }
  _idleClick() {
    this._addAction("idle");
  }

  _addAction(actionType: string) {
    this.props.group.createAction(actionType);

    this.forceUpdate();
  }

  _removeAction(action: AutoScriptAction) {
    this.props.group.removeAction(action);
    this.forceUpdate();
  }

  _toggleRecording() {
    if (!this.props.carto.activeMinecraft || !this.props.carto.activeMinecraft.gameStateManager) {
      Log.unexpectedUndefined("ASGE");
      return;
    }

    const newRecordingState = !this.state.isRecording;

    if (newRecordingState) {
      const gsm = this.props.carto.activeMinecraft.gameStateManager;

      gsm.onPlayerMajorTravelled.subscribe(this._handlePlayerTravelled);
      gsm.onItemInteracted.subscribe(this._handleItemInteracted);
    } else {
      const gsm = this.props.carto.activeMinecraft.gameStateManager;

      gsm.onPlayerMajorTravelled.unsubscribe(this._handlePlayerTravelled);
      gsm.onItemInteracted.unsubscribe(this._handleItemInteracted);
    }

    this.setState({
      isRecording: newRecordingState,
    });
  }

  _handleItemInteracted(gsm: GameStateManager, event: IItemInteractedEvent) {
    const spma = new SimulatedPlayerInteractionAction(this.props.group, {
      type: AutoScriptActionType.simulatedPlayerMove,
    });

    spma.location = gsm.playerLocation;

    this.props.group.addAction(spma);

    this.forceUpdate();
  }

  _handlePlayerTravelled(gsm: GameStateManager, event: IPlayerTravelledEvent) {
    const spma = new SimulatedPlayerMoveAction(this.props.group, {
      type: AutoScriptActionType.simulatedPlayerMove,
    });

    spma.location = this.props.group.relativizeLocation(
      new Location(event.body.player.position.x, event.body.player.position.y - 1.8, event.body.player.position.z) // subtract 1.8 from Y to translate eye level to feet level
    );

    this.props.group.addAction(spma);

    this.forceUpdate();
  }

  render() {
    const actions = this.props.group.actions;
    const actionBinItems = [];

    if (actions) {
      let i = 0;
      for (const action of actions) {
        actionBinItems.push(
          <AutoScriptActionEditor
            key={"ACT" + i}
            action={action}
            ambientSelectedPoint={this.props.ambientSelectedPoint}
            onRemove={this._removeAction}
          />
        );
        i++;
      }
    }

    const toolbarItems: any[] = [];

    if (AppServiceProxy.hasAppServiceOrDebug) {
      let isRecording = false;

      if (this.state && this.state.isRecording) {
        isRecording = true;
      }

      toolbarItems.push({
        icon: <FontAwesomeIcon icon={faRecordVinyl} className="fa-lg" />,
        key: "recording",
        kind: "toggle",
        active: isRecording,
        onClick: this._toggleRecording,
        title: "Toggle whether recording actions",
      });
    }

    const splitButtonMenuItems = [
      {
        id: "spawnSimulatedPlayer",
        key: "spawnSimulatedPlayer",
        onClick: this._spawnSimulatedPlayerClick,
        content: "Spawn simulated player",
      },
      {
        id: "moveSimulatedPlayer",
        key: "moveSimulatedPlayer",
        onClick: this._moveSimulatedPlayerClick,
        content: "Move simulated player",
      },
      {
        id: "entitySpawn",
        key: "spawnEntity",
        onClick: this._spawnEntityClick,
        content: "Spawn entity",
      },
      {
        id: "idle",
        key: "idle",
        onClick: this._idleClick,
        content: "Idle",
      },
    ];

    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const binHeight = "calc(100vh - " + (this.props.heightOffset + 40) + "px)";

    return (
      <div
        className="asge-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="asge-actionsToolBarArea">
          <Toolbar aria-label="Actions  toolbar overflow menu" items={toolbarItems} />
        </div>
        <div className="asge-extraArea">
          <SplitButton
            menu={splitButtonMenuItems}
            button={{
              content: "Add actions",
              "aria-roledescription": "splitbutton",
              "aria-describedby": "instruction-message-primary-button",
            }}
            primary
            toggleButton={{
              "aria-label": "more options",
            }}
          />
        </div>
        <div className="asge-actionBin">
          <div className="asge-actionBinInterior" style={{ maxHeight: binHeight }}>
            {actionBinItems}
          </div>
        </div>
      </div>
    );
  }
}

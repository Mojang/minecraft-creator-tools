import { Component } from "react";
import "./ActionGroupEditor.css";
import { Stack, Button, Menu, MenuItem, ToggleButton } from "@mui/material";
import ActionGroup from "../../../actions/ActionGroup";
import Action, { ActionType } from "../../../actions/Action";
import ActionEditor from "./ActionEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faRecordVinyl } from "@fortawesome/free-solid-svg-icons";
import AppServiceProxy from "../../../core/AppServiceProxy";
import CreatorTools from "../../../app/CreatorTools";
import GameStateManager from "../../../minecraft/GameStateManager";
import IPlayerTravelledEvent from "../../../minecraft/IPlayerTravelledEvent";
import IItemInteractedEvent from "../../../minecraft/IItemInteractedEvent";
import TestSimulatedPlayerMoveAction from "../../../actions/TestSimulatedPlayerMoveAction";
import Location from "../../../minecraft/Location";
import TestSimulatedPlayerInteractionAction from "../../../actions/TestSimulatedPlayerInteractionAction";
import Log from "../../../core/Log";
import Project from "../../../app/Project";
import { ActionSetCatalog } from "../../../actions/ActionSetCatalog";
import IProjectTheme from "../../types/IProjectTheme";

interface IActionGroupEditorProps {
  group: ActionGroup;
  creatorTools: CreatorTools;
  heightOffset: number;
  project: Project;
  theme: IProjectTheme;
  ambientSelectedPoint?: number[] | undefined;
  displayConditionEditor: boolean;
  displayBaseActionEditor: boolean;
}

interface IActionGroupEditorState {
  isRecording: boolean;
  menuAnchorEl: HTMLElement | null;
}

export default class ActionGroupEditor extends Component<IActionGroupEditorProps, IActionGroupEditorState> {
  constructor(props: IActionGroupEditorProps) {
    super(props);

    this._removeAction = this._removeAction.bind(this);
    this._moveSimulatedPlayerClick = this._moveSimulatedPlayerClick.bind(this);
    this._spawnSimulatedPlayerClick = this._spawnSimulatedPlayerClick.bind(this);
    this._spawnEntityClick = this._spawnEntityClick.bind(this);
    this._idleClick = this._idleClick.bind(this);
    this._toggleRecording = this._toggleRecording.bind(this);
    this._handlePlayerTravelled = this._handlePlayerTravelled.bind(this);
    this._handleMenuOpen = this._handleMenuOpen.bind(this);
    this._handleMenuClose = this._handleMenuClose.bind(this);

    this.state = {
      isRecording: false,
      menuAnchorEl: null,
    };
  }

  _moveSimulatedPlayerClick() {
    this._addAction("simulatedplayer_move");
  }

  _spawnSimulatedPlayerClick() {
    this._addAction("simulatedplayer_spawn");
  }

  _spawnEntityClick() {
    this._addAction("entity_spawn");
  }
  _idleClick() {
    this._addAction("idle");
  }

  _addAction(actionType: string) {
    const action = ActionSetCatalog.createAction(this.props.group, actionType);

    this.props.group.addAction(action);

    this.forceUpdate();
  }

  _removeAction(action: Action) {
    this.props.group.removeAction(action);
    this.forceUpdate();
  }

  _toggleRecording() {
    if (!this.props.creatorTools.activeMinecraft || !this.props.creatorTools.activeMinecraft.gameStateManager) {
      Log.unexpectedUndefined("ASGE");
      return;
    }

    const newRecordingState = !this.state.isRecording;

    if (newRecordingState) {
      const gsm = this.props.creatorTools.activeMinecraft.gameStateManager;

      if (!gsm.onPlayerMajorTravelled.has(this._handlePlayerTravelled)) {
        gsm.onPlayerMajorTravelled.subscribe(this._handlePlayerTravelled);
      }

      if (!gsm.onItemInteracted.has(this._handleItemInteracted)) {
        gsm.onItemInteracted.subscribe(this._handleItemInteracted);
      }
    } else {
      const gsm = this.props.creatorTools.activeMinecraft.gameStateManager;

      gsm.onPlayerMajorTravelled.unsubscribe(this._handlePlayerTravelled);
      gsm.onItemInteracted.unsubscribe(this._handleItemInteracted);
    }

    this.setState({
      isRecording: newRecordingState,
    });
  }

  _handleItemInteracted(gsm: GameStateManager, event: IItemInteractedEvent) {
    const spma = new TestSimulatedPlayerInteractionAction(this.props.group, {
      type: ActionType.simulatedPlayerMove,
    });

    spma.location = gsm.playerLocation;

    this.props.group.addAction(spma);

    this.forceUpdate();
  }

  _handlePlayerTravelled(gsm: GameStateManager, event: IPlayerTravelledEvent) {
    const spma = new TestSimulatedPlayerMoveAction(this.props.group, {
      type: ActionType.simulatedPlayerMove,
    });

    spma.location = this.props.group.relativizeLocation(
      new Location(event.body.player.position.x, event.body.player.position.y - 1.8, event.body.player.position.z) // subtract 1.8 from Y to translate eye level to feet level
    );

    this.props.group.addAction(spma);

    this.forceUpdate();
  }

  _handleMenuOpen(event: React.MouseEvent<HTMLButtonElement>) {
    this.setState({ menuAnchorEl: event.currentTarget });
  }

  _handleMenuClose() {
    this.setState({ menuAnchorEl: null });
  }

  render() {
    const actions = this.props.group.actions;
    const actionBinItems = [];

    if (actions) {
      let i = 0;
      for (const action of actions) {
        if (action instanceof Action) {
          actionBinItems.push(
            <ActionEditor
              key={"ACT" + i}
              action={action}
              project={this.props.project}
              theme={this.props.theme}
              ambientSelectedPoint={this.props.ambientSelectedPoint}
              onRemove={this._removeAction}
            />
          );
        }
        i++;
      }
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
        id: "test_idle",
        key: "test_idle",
        onClick: this._idleClick,
        content: "Idle",
      },
    ];

    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const binHeight = "calc(100vh - " + (this.props.heightOffset + 40) + "px)";
    const menuOpen = Boolean(this.state.menuAnchorEl);

    return (
      <div
        className="asge-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="asge-actionsToolBarArea">
          <Stack direction="row" spacing={1} aria-label="Action group actions">
            {AppServiceProxy.hasAppServiceOrSim && (
              <ToggleButton
                value="recording"
                selected={this.state?.isRecording || false}
                onChange={this._toggleRecording}
                title="Toggle whether recording actions"
              >
                <FontAwesomeIcon icon={faRecordVinyl} className="fa-lg" />
              </ToggleButton>
            )}
          </Stack>
        </div>
        <div className="asge-extraArea">
          <Button
            variant="contained"
            onClick={this._handleMenuOpen}
            startIcon={<FontAwesomeIcon icon={faPlus} />}
            aria-describedby="instruction-message-primary-button"
          >
            Add actions
          </Button>
          <Menu anchorEl={this.state.menuAnchorEl} open={menuOpen} onClose={this._handleMenuClose}>
            {splitButtonMenuItems.map((item) => (
              <MenuItem
                key={item.key}
                onClick={() => {
                  this._handleMenuClose();
                  item.onClick();
                }}
              >
                {item.content}
              </MenuItem>
            ))}
          </Menu>
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

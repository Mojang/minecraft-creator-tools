import { Component } from "react";
import "./EventActionDesign.css";
import EntityTypeDefinition from "../../../minecraft/EntityTypeDefinition";
import IEventActionSet from "../../../minecraft/IEventActionSet";
import IEventAction from "../../../minecraft/IEventAction";
import { Stack, Button, Select, MenuItem, SelectChangeEvent } from "@mui/material";
import CreatorTools from "../../../app/CreatorTools";
import EventActionSet from "./EventActionSet";
import Project from "../../../app/Project";
import { CustomTabLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiagramProject, faExpand } from "@fortawesome/free-solid-svg-icons";
import ActionSetEditor from "../action/ActionSetEditor";
import ActionSetUtilities from "../action/ActionSetUtilities";
import ActionSet from "../../../actions/ActionSet";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";

const TRIGGER_OPTIONS = [
  "on_death",
  "on_friendly_anger",
  "on_hurt",
  "on_hurt_by_player",
  "on_ignite",
  "on_interact",
  "on_start_landing",
  "on_start_takeoff",
  "on_target_acquired",
  "on_target_escape",
  "on_wake_with_owner",
];

export enum EventActionDesignMode {
  summary = 0,
  designer = 1,
}

interface IEventActionDesignProps {
  heightOffset: number;
  readOnly: boolean;
  displayTriggers: boolean;
  constrainHeight?: boolean;
  displayNarrow?: boolean;
  displayHelperText: boolean;
  displayAddRemoveGroups: boolean;
  entityType: EntityTypeDefinition;
  creatorTools: CreatorTools;
  project: Project;
  event: IEventActionSet | IEventAction;
  id: string;
  theme: IProjectTheme;

  /** When provided, shows an expand button to open this action in the full editor. */
  onOpenFull?: (eventId: string) => void;
}

interface IEventActionDesignState {
  mode?: EventActionDesignMode;
  isLoaded: boolean;
  selectedTrigger: string;
  cachedActionSet?: ActionSet;
  /** The event id the cached ActionSet was created from, used to invalidate on prop change. */
  cachedEventId?: string;
}

export default class EventActionDesign extends Component<IEventActionDesignProps, IEventActionDesignState> {
  constructor(props: IEventActionDesignProps) {
    super(props);

    this._handleAddTriggerChange = this._handleAddTriggerChange.bind(this);
    this._handleActionSetChanged = this._handleActionSetChanged.bind(this);

    this.state = {
      isLoaded: true,
      mode: EventActionDesignMode.summary,
      selectedTrigger: "",
    };
  }

  _handleAddTriggerChange(event: SelectChangeEvent<string>) {
    this.setState({ selectedTrigger: event.target.value });
  }

  /**
   * Called by ActionSetEditor whenever the Blockly workspace changes.
   * Syncs the modified ActionSet back to the source event JSON so that
   * switching to Summary mode (or closing) preserves Blockly edits.
   */
  _handleActionSetChanged(actionSet: ActionSet) {
    const updatedEvent = ActionSetUtilities.createEventFromActionSet(actionSet);

    // Merge the updated event back into the original props.event in-place,
    // matching how the Summary view directly mutates the event object.
    const target = this.props.event as any;

    // Clear old properties
    delete target.sequence;
    delete target.randomize;
    delete target.add;
    delete target.remove;
    delete target.trigger;
    delete target.queue_command;
    delete target.set_property;
    delete target.play_sound;
    delete target.emit_vibration;
    delete target.emit_particle;
    delete target.reset_target;

    // Copy updated properties
    for (const key of Object.keys(updatedEvent)) {
      target[key] = (updatedEvent as any)[key];
    }
  }

  render() {
    let height = "calc(100vh - " + this.props.heightOffset + "px)";
    let triggerContent = <></>;

    let prefix = "ead-";

    if (this.props.displayNarrow) {
      prefix += "n-";
    }

    if (this.state === null) {
      return <div>Loading...</div>;
    }

    const colors = getThemeColors();
    let isButtonCompact = this.props.displayNarrow === true;

    const defaultTriggers = [];

    if (this.props.displayHelperText) {
      if (this.props.id === "minecraft:entity_spawned") {
        defaultTriggers.push(
          <div key="ead-instruction" className="ead-instruction">
            This action is automatically fired when the mob is spawned.
          </div>
        );
      } else if (this.props.id === "minecraft:entity_born") {
        defaultTriggers.push(
          <div key="ead-instruction2" className="ead-instruction">
            This action is automatically fired when the mob is born via breeding.
          </div>
        );
      } else if (this.props.id === "minecraft:transformed") {
        defaultTriggers.push(
          <div key="ead-instruction3" className="ead-instruction">
            This action is automatically fired when the mob is changed into a different type of mob.
          </div>
        );
      } else if (this.props.id === "minecraft:on_prime") {
        defaultTriggers.push(
          <div key="ead-instruction4" className="ead-instruction">
            This action is automatically fired when the mob is set to explode.
          </div>
        );
      }

      defaultTriggers.push(
        <div key="ead-instruction5" className="ead-instruction">
          This can be triggered via /event command. For example,{" "}
          <span className="ead-codeSnippet">
            /event @e[type={this.props.entityType.id}] {this.props.id}
          </span>
        </div>
      );
    }

    if (this.props.entityType.data === undefined) {
      return <div>Loading behavior pack...</div>;
    }

    if (this.props.displayTriggers) {
      triggerContent = (
        <div key="ead-triggerContent">
          <div className={prefix + "triggerTitle"}>Triggers</div>
          <div className="ead-info">{defaultTriggers}</div>
          <div className={prefix + "addTriggerArea"}>
            <div className={prefix + "addTriggerInstruction"}>Add a trigger:</div>
            <div className={prefix + "addTriggerDropdown"}>
              <Select
                value={this.state.selectedTrigger}
                onChange={this._handleAddTriggerChange}
                displayEmpty
                size="small"
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="" disabled>
                  &lt;select a trigger&gt;
                </MenuItem>
                {TRIGGER_OPTIONS.map((trigger) => (
                  <MenuItem key={trigger} value={trigger}>
                    {trigger.replace(/_/g, " ")}
                  </MenuItem>
                ))}
              </Select>
            </div>
            <div className="ead-addTriggerButton">
              <Button>Add</Button>
            </div>
          </div>
        </div>
      );
    }

    let areaClass = prefix + "area";

    if (this.props.constrainHeight === false) {
      areaClass = "ead-areaNoScroll";
      height = "inherit";
    } else if (this.state.mode === EventActionDesignMode.designer) {
      areaClass = prefix + "areaDesigner";
    }

    let contentArea = <></>;

    if (this.state.mode === EventActionDesignMode.summary) {
      const colors = getThemeColors();
      contentArea = (
        <div key={"ead-actionSetBinOuter"}>
          {triggerContent}
          <div
            className="ead-actionSetBin"
            style={{
              backgroundColor: colors.background1,
              color: colors.surfaceForeground,
            }}
          >
            <EventActionSet
              readOnly={this.props.readOnly}
              entityType={this.props.entityType}
              displayAddRemoveGroups={this.props.displayAddRemoveGroups}
              displayNarrow={this.props.displayNarrow}
              isRandomize={false}
              project={this.props.project}
              key={"ead-actionSet"}
              eventContextId={this.props.id}
              event={this.props.event}
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
            />
          </div>
        </div>
      );
    } else if (this.state.mode === EventActionDesignMode.designer) {
      // Reuse the cached ActionSet if available AND the event id hasn't changed.
      // This prevents losing Blockly edits on re-render while still updating
      // when the user switches to a different event in the left panel.
      let actionSet = this.state.cachedActionSet;
      if (!actionSet || this.state.cachedEventId !== this.props.id) {
        actionSet = ActionSetUtilities.createActionSetFromEvent(this.props.event, this.props.id);
        // Cache it in state so subsequent renders reuse it (setState deferred to avoid render loop)
        setTimeout(() => this.setState({ cachedActionSet: actionSet, cachedEventId: this.props.id }), 0);
      }

      contentArea = (
        <ActionSetEditor
          creatorTools={this.props.creatorTools}
          theme={this.props.theme}
          project={this.props.project}
          readOnly={false}
          actionSet={actionSet}
          title={this.props.id}
          key={"ead-actionSetEditor-" + this.props.id}
          heightOffset={this.props.heightOffset + 100}
          onActionSetChanged={this._handleActionSetChanged}
        />
      );
    }

    return (
      <div
        className={areaClass}
        style={{
          minHeight: height,
          maxHeight: height,
          backgroundColor: colors.surfaceBackground,
          color: colors.surfaceForeground,
        }}
      >
        <div className={prefix + "header"}>
          {this.props.id} Action
          {this.props.onOpenFull && (
            <button
              className="ead-openFullBtn"
              title="Open in full action editor"
              onClick={() => this.props.onOpenFull!(this.props.id)}
            >
              <FontAwesomeIcon icon={faExpand} />
            </button>
          )}
        </div>
        {!this.props.displayNarrow && (
          <div className="ead-tabRow">
            <Stack direction="row" spacing={1} aria-label="Actions">
              <Button
                onClick={() => {
                  this.setState({ mode: EventActionDesignMode.summary, cachedActionSet: undefined });
                }}
                title="Summary"
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faDiagramProject} className="fa-lg" />}
                  text={"Summary"}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EventActionDesignMode.summary}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={() => {
                  this.setState({ mode: EventActionDesignMode.designer, cachedActionSet: undefined });
                }}
                title="Designer"
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faDiagramProject} className="fa-lg" />}
                  text={"Designer"}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EventActionDesignMode.designer}
                  theme={this.props.theme}
                />
              </Button>
            </Stack>
          </div>
        )}
        {contentArea}
      </div>
    );
  }
}

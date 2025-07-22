import { Component, SyntheticEvent } from "react";
import "./EventActionTile.css";
import { ThemeInput } from "@fluentui/styles";
import ManagedEventActionOrActionSet from "../minecraft/ManagedEventActionOrActionSet";
import FunctionEditor from "./FunctionEditor";
import Utilities from "../core/Utilities";
import { Button, MenuButton } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faRemove } from "@fortawesome/free-solid-svg-icons";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import Carto from "../app/Carto";
import { CustomSlimLabel } from "./Labels";
import MinecraftFilterEditor from "../dataform/MinecraftFilterEditor";
import { faCheckSquare, faSquare } from "@fortawesome/free-regular-svg-icons";
import Database from "../minecraft/Database";
import DataForm from "../dataform/DataForm";
import Project from "../app/Project";

interface IEventActionDesignProps {
  readOnly: boolean;
  entityType: EntityTypeDefinition;
  displayWeight?: boolean;
  displayAddRemoveGroups: boolean;
  displayNarrow?: boolean;
  eventContextId: string;
  project: Project;
  event: ManagedEventActionOrActionSet;
  theme: ThemeInput<any>;
  carto: Carto;
}

interface IEventActionDesignState {
  formsLoaded: boolean;
  eventState: string;
}

export default class EventActionDesign extends Component<IEventActionDesignProps, IEventActionDesignState> {
  constructor(props: IEventActionDesignProps) {
    super(props);

    this._handleToggleGroup = this._handleToggleGroup.bind(this);
    this._toggleAddRemove = this._toggleAddRemove.bind(this);
    this._toggleCommand = this._toggleCommand.bind(this);
    this._toggleSound = this._toggleSound.bind(this);
    this._toggleVibration = this._toggleVibration.bind(this);
    this._toggleParticle = this._toggleParticle.bind(this);
    this._toggleTrigger = this._toggleTrigger.bind(this);
    this._setCommand = this._setCommand.bind(this);

    this.state = {
      formsLoaded: false,
      eventState: this.props.event.toString(),
    };
  }

  componentDidMount(): void {
    this.loadForms();
  }

  async loadForms() {
    await Database.ensureFormLoaded("entityevents", "emit_particle");
    await Database.ensureFormLoaded("entityevents", "emit_vibration");
    await Database.ensureFormLoaded("entityevents", "play_sound");
    await Database.ensureFormLoaded("entityevents", "trigger");

    this.setState({
      formsLoaded: true,
      eventState: this.state.eventState,
    });
  }

  _handleToggleGroup(eventData: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null) {
    if (!eventData?.target) {
      return;
    }

    const elt = eventData.target as HTMLElement;

    if (!elt.className) {
      return;
    }

    const classNames = elt.className.split(" ");

    for (const className of classNames) {
      if (className.startsWith("cg.")) {
        const cgKey = className.split(".");

        if (cgKey.length === 2) {
          const cgId = cgKey[1];

          if (this.props.event.hasAddComponentGroup(cgId)) {
            this.props.event.removeAddComponentGroup(cgId);
            this.props.event.ensureRemoveComponentGroup(cgId);
          } else if (this.props.event.hasRemoveComponentGroup(cgId)) {
            this.props.event.removeRemoveComponentGroup(cgId);
          } else {
            this.props.event.ensureAddComponentGroup(cgId);
          }

          this.forceUpdate();
        }
      }
    }
  }

  _toggleAddRemove() {
    if (this.props.event.hasAddRemove) {
      this.props.event.removeAddRemove();
    } else {
      this.props.event.ensureAddRemove();
    }

    this._updateState();
  }

  _toggleCommand() {
    if (this.props.event.hasCommand) {
      this.props.event.removeCommand();
    } else {
      this.props.event.ensureCommand();
    }

    this._updateState();
  }

  _toggleSound() {
    if (this.props.event.hasSound) {
      this.props.event.removeSound();
    } else {
      this.props.event.ensureSound();
    }

    this._updateState();
  }

  _toggleVibration() {
    if (this.props.event.hasVibration) {
      this.props.event.removeVibration();
    } else {
      this.props.event.ensureVibration();
    }

    this._updateState();
  }

  _toggleParticle() {
    if (this.props.event.hasParticle) {
      this.props.event.removeParticle();
    } else {
      this.props.event.ensureParticle();
    }

    this._updateState();
  }

  _toggleTrigger() {
    if (this.props.event.hasTrigger) {
      this.props.event.removeTrigger();
    } else {
      this.props.event.ensureTrigger();
    }

    this._updateState();
  }

  _setCommand(command: string) {
    this.props.event.ensureCommand(command);
  }

  _updateState() {
    this.setState({
      eventState: this.props.event.toString(),
    });
  }

  render() {
    if (this.state === null) {
      return <div>Loading...</div>;
    }

    if (this.props.entityType.data === undefined) {
      return <div>Loading behavior pack...</div>;
    }
    let areaClass = "eat-area";

    const actionMenuItems = [];
    const groupToggleButtons = [];

    if (this.props.displayAddRemoveGroups) {
      const groups = this.props.entityType.getComponentGroups();

      const groupIds = [];

      for (const etg of groups) {
        groupIds.push(etg.id);
      }

      groupIds.sort();

      for (const groupId of groupIds) {
        let icon = <span className="eat-icon">&nbsp;</span>;

        let cssAdjust = "";
        if (this.props.event.hasAddComponentGroup(groupId)) {
          cssAdjust = " eat-cgAdd";
          icon = (
            <span className="eat-icon">
              <FontAwesomeIcon icon={faCheck} className="fa-lg" />
            </span>
          );
        } else if (this.props.event.hasRemoveComponentGroup(groupId)) {
          cssAdjust = " eat-cgRemove";
          icon = (
            <span className="eat-icon">
              <FontAwesomeIcon icon={faRemove} className="fa-lg" />
            </span>
          );
        }

        groupToggleButtons.push(
          <Button
            key={"eadcg." + groupId}
            className={"eat-cgToggle" + cssAdjust + " cg." + groupId}
            onClick={this._handleToggleGroup}
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1 + " !important",
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
            }}
          >
            {icon}
            <span className={"eat-cgText cg." + groupId}>
              {Utilities.humanifyMinecraftNameRemoveNamespaces(groupId)}
            </span>
          </Button>
        );
      }

      actionMenuItems.push({
        icon: (
          <CustomSlimLabel
            icon={
              <FontAwesomeIcon
                icon={this.props.event.hasAddRemove !== undefined ? faCheckSquare : faSquare}
                className="fa-lg"
              />
            }
            text={"Add/remove groups"}
            isCompact={false}
          />
        ),
        key: "add",
        onClick: this._toggleAddRemove,
        title: "Add/remove groups",
      });
    }

    actionMenuItems.push({
      icon: (
        <CustomSlimLabel
          icon={
            <FontAwesomeIcon
              icon={this.props.event.hasCommand !== undefined ? faCheckSquare : faSquare}
              className="fa-lg"
            />
          }
          text={"Command"}
          isCompact={false}
        />
      ),
      key: "command",
      onClick: this._toggleCommand,
      title: "Command",
    });

    actionMenuItems.push({
      icon: (
        <CustomSlimLabel
          icon={<FontAwesomeIcon icon={this.props.event.hasSound ? faCheckSquare : faSquare} className="fa-lg" />}
          text={"Sound"}
          isCompact={false}
        />
      ),
      key: "sound",
      onClick: this._toggleSound,
      title: "Sound",
    });

    actionMenuItems.push({
      icon: (
        <CustomSlimLabel
          icon={<FontAwesomeIcon icon={this.props.event.hasParticle ? faCheckSquare : faSquare} className="fa-lg" />}
          text={"Particle"}
          isCompact={false}
        />
      ),
      key: "particle",
      onClick: this._toggleParticle,
      title: "particle",
    });

    actionMenuItems.push({
      icon: (
        <CustomSlimLabel
          icon={<FontAwesomeIcon icon={this.props.event.hasTrigger ? faCheckSquare : faSquare} className="fa-lg" />}
          text={"Trigger"}
          isCompact={false}
        />
      ),
      key: "trigger",
      onClick: this._toggleTrigger,
      title: "trigger",
    });

    actionMenuItems.push({
      icon: (
        <CustomSlimLabel
          icon={<FontAwesomeIcon icon={this.props.event.hasVibration ? faCheckSquare : faSquare} className="fa-lg" />}
          text={"Vibration"}
          isCompact={false}
        />
      ),
      key: "vibration",
      onClick: this._toggleVibration,
      title: "vibration",
    });

    const actionElements = [];

    if (this.props.event.hasAddRemove && this.props.displayAddRemoveGroups) {
      actionElements.push(
        <div>
          <div className="eat-componentGroupsHeaderInfo">(click to toggle add/remove/neutral component groups)</div>
          <div
            className="eat-componentGroupsBin"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
            }}
          >
            {groupToggleButtons}
          </div>
        </div>
      );
    }

    if (this.props.event.hasSound && this.state.formsLoaded) {
      const form = Database.getForm("entityevents", "play_sound");
      actionElements.push(
        <DataForm
          displayTitle={true}
          displayDescription={true}
          readOnly={false}
          theme={this.props.theme}
          project={this.props.project}
          lookupProvider={this.props.project}
          objectKey={this.props.eventContextId + "sound"}
          closeButton={false}
          definition={form}
          directObject={this.props.event.ensureSound()}
        ></DataForm>
      );
    }

    if (this.props.event.hasVibration && this.state.formsLoaded) {
      const form = Database.getForm("entityevents", "emit_vibration");
      actionElements.push(
        <DataForm
          displayTitle={true}
          displayDescription={true}
          readOnly={false}
          theme={this.props.theme}
          project={this.props.project}
          lookupProvider={this.props.project}
          objectKey={this.props.eventContextId + "vibration"}
          closeButton={false}
          definition={form}
          directObject={this.props.event.ensureVibration()}
        ></DataForm>
      );
    }

    if (this.props.event.hasParticle && this.state.formsLoaded) {
      const form = Database.getForm("entityevents", "emit_particle");
      actionElements.push(
        <DataForm
          displayTitle={true}
          displayDescription={true}
          readOnly={false}
          theme={this.props.theme}
          project={this.props.project}
          lookupProvider={this.props.project}
          objectKey={this.props.eventContextId + "particle"}
          closeButton={false}
          definition={form}
          directObject={this.props.event.ensureParticle()}
        ></DataForm>
      );
    }

    if (this.props.event.hasTrigger && this.state.formsLoaded) {
      const form = Database.getForm("entityevents", "trigger");
      actionElements.push(
        <DataForm
          displayTitle={true}
          displayDescription={true}
          readOnly={false}
          theme={this.props.theme}
          project={this.props.project}
          lookupProvider={this.props.project}
          objectKey={this.props.eventContextId + "trigger"}
          closeButton={false}
          definition={form}
          directObject={this.props.event.ensureTrigger()}
        ></DataForm>
      );
    }

    if (this.props.event.hasCommand) {
      actionElements.push(
        <div className="eat-functionsHeader">
          <FunctionEditor
            preferredTextSize={this.props.carto.preferredTextSize}
            theme={this.props.theme}
            content={this.props.event.command}
            title="Run commands"
            readOnly={this.props.readOnly}
            isCommandEditor={false}
            fixedHeight={200}
            onCommandTextChanged={this._setCommand}
            carto={this.props.carto}
          />
        </div>
      );
    }

    if (this.props.event.filters === undefined) {
      this.props.event.filters = {};
    }

    return (
      <div
        className={areaClass}
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
          borderColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
        }}
      >
        Run this action when:
        <MinecraftFilterEditor
          data={this.props.event.filters}
          displayNarrow={this.props.displayNarrow}
          filterContextId={this.props.eventContextId}
        />
        <div className="eat-toolbarArea">
          <div className="eat-toolbar">
            <MenuButton
              menu={actionMenuItems}
              trigger={
                <Button content="Actions..." aria-label="Show or hide different categories of items on the list" />
              }
            />
          </div>
        </div>
        {actionElements}
      </div>
    );
  }
}

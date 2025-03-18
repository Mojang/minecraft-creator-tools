import { Component } from "react";
import "./EventActionSet.css";
import { ThemeInput } from "@fluentui/styles";
import IEventActionSet from "../minecraft/IEventActionSet";
import IEventAction from "../minecraft/IEventAction";
import EventActionTile from "./EventActionTile";
import ManagedEventAction from "../minecraft/ManagedEventAction";
import { Toolbar } from "@fluentui/react-northstar";
import Carto from "../app/Carto";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAdd } from "@fortawesome/free-solid-svg-icons";
import { CustomLabel } from "./Labels";
import Project from "../app/Project";

interface IEventActionSetProps {
  readOnly: boolean;
  event: IEventActionSet | IEventAction;
  entityType: EntityTypeDefinition;
  isRandomize: boolean;
  eventContextId: string;
  project: Project;
  carto: Carto;
  theme: ThemeInput<any>;
}

interface IEventActionSetState {
  eventState: string;
}

export default class EventActionSet extends Component<IEventActionSetProps, IEventActionSetState> {
  constructor(props: IEventActionSetProps) {
    super(props);

    this._addAction = this._addAction.bind(this);

    this.state = {
      eventState: this.props.event.toString(),
    };
  }

  _getIsSingle() {
    return !((this.props.event as any).sequence || (this.props.event as any).randomize);
  }

  _addAction() {
    if (this._getIsSingle()) {
      (this.props.event as IEventActionSet).sequence = [
        {
          filters: (this.props.event as any).filters,
          weight: (this.props.event as any).weight,
          add: (this.props.event as any).add,
          remove: (this.props.event as any).remove,
          set_property: (this.props.event as any).set_property,
          queue_command: (this.props.event as any).queue_command,
          play_sound: (this.props.event as any).play_sound,
        },
      ];

      (this.props.event as IEventAction).filters = undefined;
      (this.props.event as IEventAction).weight = undefined;
      (this.props.event as IEventAction).add = undefined;
      (this.props.event as IEventAction).remove = undefined;
      (this.props.event as IEventAction).set_property = undefined;
      (this.props.event as IEventAction).queue_command = undefined;
      (this.props.event as IEventAction).play_sound = undefined;
    }

    let coll = (this.props.event as IEventActionSet).sequence || (this.props.event as IEventActionSet).sequence;

    if (coll) {
      coll.push({});
    }

    this._updateState();
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

    let interior = [];

    if (this._getIsSingle()) {
      interior.push(
        <EventActionTile
          readOnly={this.props.readOnly}
          entityType={this.props.entityType}
          eventContextId={this.props.eventContextId}
          carto={this.props.carto}
          project={this.props.project}
          event={new ManagedEventAction(this.props.event)}
          theme={this.props.theme}
        />
      );
    } else {
      let elements = (this.props.event as IEventActionSet).randomize
        ? (this.props.event as IEventActionSet).randomize
        : (this.props.event as IEventActionSet).sequence;

      if (elements) {
        for (const elt of elements) {
          if ((elt as IEventActionSet).sequence || (elt as IEventActionSet).randomize) {
            interior.push(
              <EventActionSet
                readOnly={this.props.readOnly}
                entityType={this.props.entityType}
                project={this.props.project}
                eventContextId={this.props.eventContextId}
                isRandomize={(elt as IEventActionSet).randomize !== undefined}
                event={elt as IEventActionSet}
                carto={this.props.carto}
                theme={this.props.theme}
              />
            );
          } else {
            interior.push(
              <EventActionTile
                readOnly={this.props.readOnly}
                entityType={this.props.entityType}
                project={this.props.project}
                displayWeight={this.props.isRandomize}
                eventContextId={this.props.eventContextId}
                event={new ManagedEventAction(elt as IEventAction)}
                carto={this.props.carto}
                theme={this.props.theme}
              />
            );
          }
        }
      }
    }

    const toolbarItems = [];

    toolbarItems.push({
      icon: (
        <CustomLabel icon={<FontAwesomeIcon icon={faAdd} className="fa-lg" />} text={"Add action"} isCompact={false} />
      ),
      key: "add",
      onClick: this._addAction,
      title: "Add new query",
    });

    return (
      <div
        className={"eas-area"}
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
          borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
        }}
      >
        <div
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
          }}
        >
          <Toolbar aria-label="Minecraft event action management" items={toolbarItems} />
        </div>
        <div>{interior}</div>
      </div>
    );
  }
}

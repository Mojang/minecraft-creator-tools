import { Component } from "react";
import "./EventActionDesign.css";
import { ThemeInput } from "@fluentui/styles";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import IEventActionSet from "../minecraft/IEventActionSet";
import IEventAction from "../minecraft/IEventAction";
import { Button, Dropdown, DropdownProps } from "@fluentui/react-northstar";
import Carto from "../app/Carto";
import EventActionSet from "./EventActionSet";

interface IEventActionDesignProps {
  heightOffset: number;
  readOnly: boolean;
  displayTriggers: boolean;
  constrainHeight?: boolean;
  entityType: EntityTypeDefinition;
  carto: Carto;
  event: IEventActionSet | IEventAction;
  id: string;
  theme: ThemeInput<any>;
}

interface IEventActionDesignState {
  isLoaded: boolean;
  state: string;
}

export default class EventActionDesign extends Component<IEventActionDesignProps, IEventActionDesignState> {
  constructor(props: IEventActionDesignProps) {
    super(props);

    this.state = {
      isLoaded: false,
      state: this.props.event.toString(),
    };

    this.state = {
      isLoaded: true,
      state: this.props.event.toString(),
    };
  }

  async _handleAddTriggerChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {}

  render() {
    let height = "calc(100vh - " + this.props.heightOffset + "px)";
    let triggerContent = <></>;

    if (this.state === null) {
      return <div>Loading...</div>;
    }

    const defaultTriggers = [];

    if (this.props.id === "minecraft:entity_spawned") {
      defaultTriggers.push(
        <div className="ead-instruction">This action is automatically fired when the mob is spawned.</div>
      );
    } else if (this.props.id === "minecraft:entity_born") {
      defaultTriggers.push(
        <div className="ead-instruction">This action is automatically fired when the mob is born via breeding.</div>
      );
    } else if (this.props.id === "minecraft:transformed") {
      defaultTriggers.push(
        <div className="ead-instruction">
          This action is automatically fired when the mob is changed into a different type of mob.
        </div>
      );
    } else if (this.props.id === "minecraft:on_prime") {
      defaultTriggers.push(
        <div className="ead-instruction">This action is automatically fired when the mob is set to explode.</div>
      );
    }

    defaultTriggers.push(
      <div className="ead-instruction">
        This can be triggered via /event command. For example,{" "}
        <span className="ead-codeSnippet">
          /event @e[type={this.props.entityType.id}] {this.props.id}
        </span>
      </div>
    );

    if (this.props.entityType.data === undefined) {
      return <div>Loading behavior pack...</div>;
    }

    if (this.props.displayTriggers) {
      triggerContent = (
        <div>
          <div className="ead-triggerTitle">Triggers</div>
          <div className="ead-info">{defaultTriggers}</div>
          <div className="ead-addTriggerArea">
            <div className="ead-addTriggerInstruction">Add a trigger:</div>
            <div className="ead-addTriggerDropdown">
              <Dropdown
                items={["on breathe"]}
                placeholder="<select a trigger>"
                onChange={this._handleAddTriggerChange}
              />
            </div>
            <div className="ead-addTriggerButton">
              <Button>Add</Button>
            </div>
          </div>
        </div>
      );
    }

    let areaClass = "ead-area";

    if (this.props.constrainHeight === false) {
      areaClass = "ead-areaNoScroll";
      height = "inhering";
    }

    return (
      <div
        className={areaClass}
        style={{
          minHeight: height,
          maxHeight: height,
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
        }}
      >
        <div className="ead-header">{this.props.id}</div>
        {triggerContent}
        <div className="ead-actionsTitle">Actions</div>
        <div
          className="ead-actionSetBin"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground4,
          }}
        >
          <EventActionSet
            readOnly={this.props.readOnly}
            entityType={this.props.entityType}
            isRandomize={false}
            eventContextId={this.props.id}
            event={this.props.event}
            carto={this.props.carto}
            theme={this.props.theme}
          />
        </div>
      </div>
    );
  }
}

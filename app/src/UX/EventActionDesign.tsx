import { Component } from "react";
import "./EventActionDesign.css";
import { ThemeInput } from "@fluentui/styles";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import IEventActionSet from "../minecraft/IEventActionSet";
import IEventAction from "../minecraft/IEventAction";
import { Button, Dropdown, DropdownProps, Toolbar } from "@fluentui/react-northstar";
import CreatorTools from "../app/CreatorTools";
import EventActionSet from "./EventActionSet";
import Project from "../app/Project";
import { CustomTabLabel } from "./Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCode, faDiagramProject } from "@fortawesome/free-solid-svg-icons";
import JsonEditor from "./JsonEditor";

export enum EventActionDesignMode {
  summary = 0,
  designer = 1,
  json = 2,
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
  theme: ThemeInput<any>;
}

interface IEventActionDesignState {
  mode?: EventActionDesignMode;
  isLoaded: boolean;
}

export default class EventActionDesign extends Component<IEventActionDesignProps, IEventActionDesignState> {
  constructor(props: IEventActionDesignProps) {
    super(props);

    this.state = {
      isLoaded: true,
      mode: EventActionDesignMode.summary,
    };
  }

  async _handleAddTriggerChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {}

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

    let isButtonCompact = this.props.displayNarrow === true;

    const toolbarItems = [];

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faDiagramProject} className="fa-lg" />}
          text={"Summary"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EventActionDesignMode.summary}
          theme={this.props.theme}
        />
      ),
      key: "eadSummaryTab",
      onClick: () => {
        this.setState({ mode: EventActionDesignMode.summary });
      },
      title: "Summary",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faCode} className="fa-lg" />}
          text={"JSON"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EventActionDesignMode.json}
          theme={this.props.theme}
        />
      ),
      key: "eadJsonTab",
      onClick: () => {
        this.setState({ mode: EventActionDesignMode.json });
      },
      title: "Designer",
    });

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
          <div className="ead-triggerTitle">Triggers</div>
          <div className="ead-info">{defaultTriggers}</div>
          <div className={prefix + "addTriggerArea"}>
            <div className={prefix + "addTriggerInstruction"}>Add a trigger:</div>
            <div className={prefix + "addTriggerDropdown"}>
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

    let areaClass = prefix + "area";

    if (this.props.constrainHeight === false) {
      areaClass = "ead-areaNoScroll";
      height = "inherit";
    }

    let contentArea = <></>;

    if (this.state.mode === EventActionDesignMode.summary) {
      contentArea = (
        <div key={"ead-actionSetBinOuter"}>
          {triggerContent}
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
    } else if (this.state.mode === EventActionDesignMode.json) {
      contentArea = (
        <JsonEditor
          theme={this.props.theme}
          project={this.props.project}
          preferredTextSize={this.props.creatorTools.preferredTextSize}
          readOnly={false}
          key={"ead-jsonEditor"}
          heightOffset={this.props.heightOffset}
          content={JSON.stringify(this.props.event, null, 2)}
        />
      );
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
        <div className={prefix + "header"}>{this.props.id} Action</div>
        <Toolbar aria-label="Actions" items={toolbarItems} />
        {contentArea}
      </div>
    );
  }
}

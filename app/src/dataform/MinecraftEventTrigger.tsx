import { Component, SyntheticEvent } from "react";
import "./MinecraftEventTrigger.css";
import IFormComponentProps from "./IFormComponentProps.js";
import { Dialog, Dropdown, DropdownProps, ThemeInput, Toolbar } from "@fluentui/react-northstar";
import { IEventTrigger } from "../minecraft/IEventTrigger";
import Carto from "../app/Carto";
import Project from "../app/Project";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import IEventAction from "../minecraft/IEventAction";
import IEventActionSet from "../minecraft/IEventActionSet";
import EventActionDesign from "../UX/EventActionDesign";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAdd } from "@fortawesome/free-solid-svg-icons";
import SetName from "../UX/SetName";
import { CustomLabel } from "../UX/Labels";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";

export interface IMinecraftEventTriggerProps extends IFormComponentProps {
  data: IEventTrigger;
  objectKey: string | undefined;
  carto: Carto;
  readOnly: boolean;
  project: Project;
  heightOffset: number;
  theme: ThemeInput<any>;
  constrainHeight?: boolean;
  entityTypeDefinition: EntityTypeDefinition;
  onChange?: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IMinecraftEventTriggerProps
  ) => void;
}

interface IMinecraftEventTriggerState {
  eventName: string | undefined;
  target: string | undefined;
  dialogMode: MinecraftEventTriggerEditorDialog;
  selectedName?: string | undefined;
}

export enum MinecraftEventTriggerEditorDialog {
  none = 0,
  addEvent = 1,
}

export default class MinecraftEventTrigger extends Component<IMinecraftEventTriggerProps, IMinecraftEventTriggerState> {
  constructor(props: IMinecraftEventTriggerProps) {
    super(props);

    this._handleEventChanged = this._handleEventChanged.bind(this);
    this._handleDialogCancel = this._handleDialogCancel.bind(this);
    this._handleSetNameOK = this._handleSetNameOK.bind(this);
    this.setNewName = this.setNewName.bind(this);
    this._addEvent = this._addEvent.bind(this);

    this.state = {
      dialogMode: MinecraftEventTriggerEditorDialog.none,
      target: this.props.data.target,
      eventName: this.props.data.event,
    };
  }

  _getAvailableEvents() {
    const eventNames: string[] = [];

    if (this.props.entityTypeDefinition) {
      const eventList = this.props.entityTypeDefinition.getEvents();

      for (const eventData of eventList) {
        if (!MinecraftUtilities.getIsBuiltIn(eventData.id)) {
          eventNames.push(eventData.id);
        }
      }
    }

    return eventNames;
  }

  _handleEventChanged(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (!data.value || typeof data.value !== "string") {
      return;
    }

    this.props.data.event = data.value;

    this.setState({
      eventName: data.value,
      target: this.state.target,
      dialogMode: this.state.dialogMode,
    });
  }

  private _handleDialogCancel() {
    this.setState({
      eventName: this.state.eventName,
      target: this.state.target,
      dialogMode: MinecraftEventTriggerEditorDialog.none,
    });
  }

  setNewName(newName: string) {
    this.setState({
      eventName: this.state.eventName,
      target: this.state.target,
      dialogMode: this.state.dialogMode,
      selectedName: newName,
    });
  }

  private _handleSetNameOK() {
    if (this.state.selectedName) {
      this.props.entityTypeDefinition.addEvent(this.state.selectedName);
      this.props.data.event = this.state.selectedName;

      this.setState({
        eventName: this.state.selectedName,
        target: this.state.target,
        dialogMode: MinecraftEventTriggerEditorDialog.none,
      });
    }
  }

  private _addEvent() {
    this.setState({
      eventName: this.state.eventName,
      target: this.state.target,
      dialogMode: MinecraftEventTriggerEditorDialog.addEvent,
    });
  }

  render() {
    if (this.state.dialogMode === MinecraftEventTriggerEditorDialog.addEvent) {
      return (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="miet-addEventOuter"
          onCancel={this._handleDialogCancel}
          onConfirm={this._handleSetNameOK}
          content={<SetName onNameChanged={this.setNewName} defaultName="new property" theme={this.props.theme} />}
          header={"Add new action"}
        />
      );
    } else {
      let eventItem: IEventActionSet | IEventAction | undefined = undefined;
      let actionDesignInterior = <></>;
      const toolbarItems = [];

      if (this.props.data.event) {
        eventItem = this.props.entityTypeDefinition.getEvent(this.props.data.event);

        if (eventItem) {
          actionDesignInterior = (
            <EventActionDesign
              carto={this.props.carto}
              readOnly={this.props.readOnly}
              theme={this.props.theme}
              displayTriggers={false}
              project={this.props.project}
              constrainHeight={this.props.constrainHeight}
              heightOffset={this.props.heightOffset}
              entityType={this.props.entityTypeDefinition}
              event={eventItem}
              id={this.props.data.event}
            />
          );
        }
      }

      const availableEvents = this._getAvailableEvents();

      toolbarItems.push({
        icon: (
          <CustomLabel isCompact={false} text="Add action" icon={<FontAwesomeIcon icon={faAdd} className="fa-lg" />} />
        ),
        key: "add",
        tag: "addItem",
        onClick: this._addEvent,
        title: "Add action",
      });

      return (
        <div className="miet-outer">
          <div
            className="miet-toolBarArea"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            }}
          >
            <Toolbar aria-label="Actions toolbar overflow menu" items={toolbarItems} />
          </div>
          <div className="miet-actionList">
            <div className="miet-actionListLabel">Actions:</div>
            <div className="miet-actionListDropdown">
              <Dropdown
                items={availableEvents}
                key="modeinput"
                defaultValue={this.props.data.event}
                onChange={this._handleEventChanged}
              />
            </div>
          </div>
          <div className="miet-actionDesign">{actionDesignInterior}</div>
        </div>
      );
    }
  }
}

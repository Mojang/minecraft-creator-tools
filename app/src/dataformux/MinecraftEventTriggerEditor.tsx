import { Component } from "react";
import "./MinecraftEventTriggerEditor.css";
import IFormComponentProps from "./../dataform/IFormComponentProps.js";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  MenuItem,
  SelectChangeEvent,
} from "@mui/material";
import CreatorTools from "../app/CreatorTools";
import Project from "../app/Project";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import IEventAction from "../minecraft/IEventAction";
import IEventActionSet from "../minecraft/IEventActionSet";
import EventActionDesign from "../UX/editors/event/EventActionDesign";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import SetName from "../UX/project/naming/SetName";
import { CustomLabel } from "../UX/shared/components/feedback/labels/Labels";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import MinecraftEventTrigger from "../minecraft/jsoncommon/MinecraftEventTrigger";
import IField from "./../dataform/IField";
import IProjectTheme from "../UX/types/IProjectTheme";

export interface IMinecraftEventTriggerEditorProps extends IFormComponentProps {
  data: MinecraftEventTrigger;
  objectKey: string | undefined;
  creatorTools: CreatorTools;
  readOnly: boolean;
  project: Project;
  heightOffset: number;
  theme: IProjectTheme;
  constrainHeight?: boolean;
  entityTypeDefinition: EntityTypeDefinition;
  onChange?: (field: IField, data: MinecraftEventTrigger) => void;
}

interface IMinecraftEventTriggerEditorState {
  eventName: string | undefined;
  target: string | undefined;
  dialogMode: MinecraftEventTriggerEditorDialog;
  selectedName?: string | undefined;
}

export enum MinecraftEventTriggerEditorDialog {
  none = 0,
  addEvent = 1,
}

export default class MinecraftEventTriggerEditor extends Component<
  IMinecraftEventTriggerEditorProps,
  IMinecraftEventTriggerEditorState
> {
  constructor(props: IMinecraftEventTriggerEditorProps) {
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

  _handleEventChanged(event: SelectChangeEvent<string>) {
    if (!event.target.value || typeof event.target.value !== "string") {
      return;
    }

    this.props.data.event = event.target.value;

    if (this.props.onChange) {
      this.props.onChange(this.props.field, this.props.data);
    }

    this.setState({
      eventName: event.target.value,
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

      if (this.props.onChange) {
        this.props.onChange(this.props.field, this.props.data);
      }

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
        <Dialog open={true} key="miet-addEventOuter" onClose={this._handleDialogCancel}>
          <DialogTitle>Add new action</DialogTitle>
          <DialogContent>
            <SetName onNameChanged={this.setNewName} defaultName="new property" theme={this.props.theme} />
          </DialogContent>
          <DialogActions>
            <Button onClick={this._handleDialogCancel}>Cancel</Button>
            <Button onClick={this._handleSetNameOK} variant="contained">
              Add
            </Button>
          </DialogActions>
        </Dialog>
      );
    } else {
      let eventItem: IEventActionSet | IEventAction | undefined = undefined;
      let actionDesignInterior = <></>;

      if (this.props.data.event) {
        eventItem = this.props.entityTypeDefinition.getEvent(this.props.data.event);

        if (eventItem) {
          actionDesignInterior = (
            <EventActionDesign
              creatorTools={this.props.creatorTools}
              readOnly={this.props.readOnly}
              displayAddRemoveGroups={true}
              displayHelperText={true}
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

      return (
        <div className="miet-outer">
          <div className="miet-toolBarRow">
            <div className="miet-actionListDropdown">
              <Select
                size="small"
                value={this.props.data.event || ""}
                onChange={this._handleEventChanged}
                displayEmpty
                fullWidth
                renderValue={(selected) => {
                  if (!selected) {
                    return <em style={{ opacity: 0.5, fontStyle: "normal" }}>No action selected</em>;
                  }
                  return selected as string;
                }}
              >
                {availableEvents.map((evt) => (
                  <MenuItem key={evt} value={evt}>
                    {evt}
                  </MenuItem>
                ))}
              </Select>
            </div>
            <Button key="add" onClick={this._addEvent} title="Add action" variant="text" size="small">
              <CustomLabel
                isCompact={false}
                text="Add action"
                icon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
              />
            </Button>
          </div>
          <div className="miet-actionDesign">{actionDesignInterior}</div>
        </div>
      );
    }
  }
}

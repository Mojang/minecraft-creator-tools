import React, { Component } from "react";
import CreatorTools from "../../app/CreatorTools";
import "./LogItemArea.css";
import IAppProps from "./IAppProps";
import IStatus, { StatusTopic } from "../../app/Status";
import { LogItemLevel } from "../../core/Log";
import { ProjectStatusAreaMode } from "../project/ProjectEditor";
import { IconButton, List, ListItem, ListItemText, Stack } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretSquareDown, faCaretSquareUp } from "@fortawesome/free-solid-svg-icons";

interface ILogItemAreaProps extends IAppProps {
  onSetExpandedSize: (newMode: ProjectStatusAreaMode) => void;
  mode: ProjectStatusAreaMode;
  widthOffset: number;
  minLogLevel?: LogItemLevel;
  filterTopics?: StatusTopic[];
}

interface ILogItemAreaState {}

const MESSAGE_FADEOUT_TIME = 200000;

export default class LogItemArea extends Component<ILogItemAreaProps, ILogItemAreaState> {
  scrollArea: React.RefObject<HTMLDivElement>;
  private _isMounted = false;

  constructor(props: ILogItemAreaProps) {
    super(props);

    this.scrollArea = React.createRef();

    this._handleStatusAdded = this._handleStatusAdded.bind(this);
    this._handleOperationEnded = this._handleOperationEnded.bind(this);
    this._checkForTimeOut = this._checkForTimeOut.bind(this);
    this._toggleExpandedSize = this._toggleExpandedSize.bind(this);
    this._update = this._update.bind(this);
    this.scrollToListBottom = this.scrollToListBottom.bind(this);

    this.props.creatorTools.onStatusAdded.subscribe(this._handleStatusAdded);
    this.props.creatorTools.onOperationCompleted.subscribe(this._handleOperationEnded);
  }

  _handleOperationEnded(creatorTools: CreatorTools, operationId: number) {
    this._update();
  }

  _handleStatusAdded(creatorTools: CreatorTools, status: IStatus) {
    this._update();
  }

  private _update() {
    if (!this._isMounted) {
      return;
    }
    this.forceUpdate();

    window.setTimeout(this.scrollToListBottom, 1);

    window.setTimeout(this._checkForTimeOut, MESSAGE_FADEOUT_TIME + 100);
  }

  _checkForTimeOut(creatorTools: CreatorTools, status: IStatus) {
    if (!this._isMounted) {
      return;
    }
    this.forceUpdate();
  }

  _toggleExpandedSize() {
    if (this.props.mode === ProjectStatusAreaMode.expanded) {
      this.props.onSetExpandedSize(ProjectStatusAreaMode.minimized);
    } else {
      this.props.onSetExpandedSize(ProjectStatusAreaMode.expanded);
    }
  }

  componentDidMount(): void {
    this._isMounted = true;
    this.scrollToListBottom();
  }

  componentWillUnmount(): void {
    this._isMounted = false;
  }

  scrollToListBottom() {
    if (this.scrollArea && this.scrollArea.current) {
      this.scrollArea.current.scrollTop = this.scrollArea.current.scrollHeight;
    }
  }

  matchesFilter(item: IStatus) {
    if (!this.props.filterTopics) {
      return true;
    }
    if (!item.topic) {
      return false;
    }

    if (this.props.filterTopics.includes(item.topic)) {
      return true;
    }

    return false;
  }

  render() {
    let interior = <></>;

    const width = "calc(100vw - " + String(this.props.widthOffset + 30) + "px)";
    let toolTip = "";

    if (this.props.mode === ProjectStatusAreaMode.minimized) {
      if (this.props.creatorTools.status.length > 0) {
        let statusItem = undefined;
        for (let i = this.props.creatorTools.status.length - 1; i >= 0; i--) {
          const statusItemCand = this.props.creatorTools.status[i];

          if (statusItemCand && this.matchesFilter(statusItemCand)) {
            statusItem = statusItemCand;
          }
        }

        if (statusItem !== undefined) {
          toolTip = statusItem.message;
          interior = <span>{statusItem.message}</span>;
        }
      }
    } else {
      interior = (
        <div className="lia-list" ref={this.scrollArea} style={{ maxWidth: width }}>
          <List dense aria-label="List of status items">
            {this.props.creatorTools.status
              .filter((statusItem) => this.matchesFilter(statusItem))
              .map((statusItem, i) => (
                <ListItem key={"si" + i} disablePadding>
                  <ListItemText
                    primary={
                      <div className="sa-list-item" title={statusItem.message}>
                        {statusItem.message}
                      </div>
                    }
                    sx={{ margin: 0 }}
                  />
                </ListItem>
              ))}
          </List>
        </div>
      );
    }

    const isMinimized = this.props.mode === ProjectStatusAreaMode.minimized;

    return (
      <div className="lia-outer" onClick={this._toggleExpandedSize}>
        <div className="lia-message" style={{ maxWidth: width }} title={toolTip}>
          {interior}
        </div>
        <div className="lia-tools">
          <Stack direction="row" spacing={0.5} aria-label="Log actions">
            <IconButton
              size="small"
              onClick={this._toggleExpandedSize}
              title="Show more information in the status area"
              aria-label="Toggle status area size"
            >
              <FontAwesomeIcon icon={isMinimized ? faCaretSquareUp : faCaretSquareDown} className="fa-lg" />
            </IconButton>
          </Stack>
        </div>
      </div>
    );
  }
}

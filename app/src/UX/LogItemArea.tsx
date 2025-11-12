import React, { Component } from "react";
import CreatorTools from "../app/CreatorTools";
import "./LogItemArea.css";
import IAppProps from "./IAppProps";
import IStatus, { StatusTopic } from "../app/Status";
import { LogItemLevel } from "./../core/Log";
import { ProjectStatusAreaMode } from "./ProjectEditor";
import { Toolbar, List } from "@fluentui/react-northstar";
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
    this.forceUpdate();

    window.setTimeout(this.scrollToListBottom, 1);

    window.setTimeout(this._checkForTimeOut, MESSAGE_FADEOUT_TIME + 100);
  }

  _checkForTimeOut(creatorTools: CreatorTools, status: IStatus) {
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
    this.scrollToListBottom();
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
    const toolbarItems = [];
    let toolTip = "";

    if (this.props.mode === ProjectStatusAreaMode.minimized) {
      toolbarItems.push({
        icon: <FontAwesomeIcon icon={faCaretSquareUp} className="fa-lg" />,
        key: "expandLogItemArea",
        kind: "toggle",
        active: false,
        onClick: this._toggleExpandedSize,
        title: "Show more information in the status area",
      });

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
      toolbarItems.push({
        icon: <FontAwesomeIcon icon={faCaretSquareDown} className="fa-lg" />,
        key: "hideLogItemArea",
        kind: "toggle",
        active: true,
        onClick: this._toggleExpandedSize,
        title: "Show more information in the status area",
      });

      const li = [];

      for (let i = 0; i < this.props.creatorTools.status.length; i++) {
        const statusItem = this.props.creatorTools.status[i];

        if (this.matchesFilter(statusItem) === false) {
          continue;
        }

        li.push({
          key: "si" + i,
          content: (
            <div className="sa-list-item" title={statusItem.message}>
              {statusItem.message}
            </div>
          ),
        });
      }

      interior = (
        <div className="lia-list" ref={this.scrollArea} style={{ maxWidth: width }}>
          <List selectable aria-label="List of status items" items={li} />
        </div>
      );
    }

    return (
      <div className="lia-outer" onClick={this._toggleExpandedSize}>
        <div className="lia-message" style={{ maxWidth: width }} title={toolTip}>
          {interior}
        </div>
        <div className="lia-tools">
          <Toolbar aria-label="Log actions" items={toolbarItems} />
        </div>
      </div>
    );
  }
}

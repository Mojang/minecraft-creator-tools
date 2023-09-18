import React, { Component } from "react";
import Carto from "./../app/Carto";
import "./LogItemArea.css";
import IAppProps from "./IAppProps";
import Status from "../app/Status";
import { LogItem, LogItemLevel } from "./../core/Log";
import { ProjectStatusAreaMode } from "./ProjectEditor";
import { Toolbar, List } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretSquareDown, faCaretSquareUp } from "@fortawesome/free-solid-svg-icons";

interface ILogItemAreaProps extends IAppProps {
  onSetExpandedSize: (newMode: ProjectStatusAreaMode) => void;
  mode: ProjectStatusAreaMode;
  widthOffset: number;
  minLogLevel?: LogItemLevel;
  filterCategories?: string[];
}

interface ILogItemAreaState {}

const MESSAGE_FADEOUT_TIME = 200000;

export default class LogItemArea extends Component<ILogItemAreaProps, ILogItemAreaState> {
  scrollArea: React.RefObject<HTMLDivElement>;

  constructor(props: ILogItemAreaProps) {
    super(props);

    this.scrollArea = React.createRef();

    this._handleStatusAdded = this._handleStatusAdded.bind(this);
    this._checkForTimeOut = this._checkForTimeOut.bind(this);
    this._toggleExpandedSize = this._toggleExpandedSize.bind(this);
    this._update = this._update.bind(this);
    this.scrollToListBottom = this.scrollToListBottom.bind(this);

    this.props.carto.onStatusAdded.subscribe(this._handleStatusAdded);
  }

  _handleStatusAdded(carto: Carto, status: Status) {
    this._update();
  }

  private _update() {
    this.forceUpdate();

    window.setTimeout(this._checkForTimeOut, MESSAGE_FADEOUT_TIME + 100);
  }

  _checkForTimeOut(carto: Carto, status: Status) {
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

  matchesFilter(item: LogItem) {
    if (!this.props.filterCategories) {
      return true;
    }
    if (!item.category) {
      return false;
    }

    if (this.props.filterCategories.includes(item.category)) {
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

      if (this.props.carto.status.length > 0) {
        const statusItem = this.props.carto.status[this.props.carto.status.length - 1];

        toolTip = statusItem.message;
        interior = <span>{statusItem.message}</span>;
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

      for (let i = 0; i < this.props.carto.status.length; i++) {
        const statusItem = this.props.carto.status[i];

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
          <List selectable items={li} />
        </div>
      );
    }

    window.setTimeout(this.scrollToListBottom, 1);

    return (
      <div className="lia-outer" onClick={this._toggleExpandedSize}>
        <div className="lia-message" style={{ maxWidth: width }} title={toolTip}>
          {interior}
        </div>
        <div className="lia-tools">
          <Toolbar aria-label="Editor toolbar overflow menu" items={toolbarItems} />
        </div>
      </div>
    );
  }
}

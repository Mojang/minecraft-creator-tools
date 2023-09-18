import React, { Component } from "react";
import Carto from "./../app/Carto";
import "./StatusArea.css";
import IAppProps from "./IAppProps";
import Status, { StatusType } from "../app/Status";
import Utilities from "./../core/Utilities";
import Log, { LogItem } from "./../core/Log";
import { ProjectStatusAreaMode } from "./ProjectEditor";
import { Toolbar, List, ThemeInput, Button } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretSquareDown, faCaretSquareUp, faXmark } from "@fortawesome/free-solid-svg-icons";
import TextEditor from "./TextEditor";
import CartoApp, { HostType } from "../app/CartoApp";
import IPersistable from "./IPersistable";
import FunctionEditor from "./FunctionEditor";
import Project from "../app/Project";

interface IStatusAreaProps extends IAppProps {
  onSetExpandedSize: (newMode: ProjectStatusAreaMode) => void;
  statusAreaMode: ProjectStatusAreaMode;
  project?: Project;
  theme: ThemeInput<any>;
  heightOffset: number;
}

interface IStatusAreaState {
  displayEditor: boolean;
  activeOperations: number;
}

const MESSAGE_FADEOUT_TIME = 20000;

export default class StatusArea extends Component<IStatusAreaProps, IStatusAreaState> {
  scrollArea: React.RefObject<HTMLDivElement>;
  private _activeEditorPersistable?: IPersistable;
  private _isMountedInternal: boolean = false;

  constructor(props: IStatusAreaProps) {
    super(props);

    this.scrollArea = React.createRef();

    this._handleStatusAdded = this._handleStatusAdded.bind(this);
    this._handleLogItemAdded = this._handleLogItemAdded.bind(this);
    this._checkForTimeOut = this._checkForTimeOut.bind(this);
    this._toggleExpandedSize = this._toggleExpandedSize.bind(this);
    this._onUpdatePreferredTextSize = this._onUpdatePreferredTextSize.bind(this);
    this._toggleToEditor = this._toggleToEditor.bind(this);
    this._toggleToMessage = this._toggleToMessage.bind(this);
    this._update = this._update.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this.scrollToListBottom = this.scrollToListBottom.bind(this);
    this._commitCommand = this._commitCommand.bind(this);

    if (Utilities.isDebug) {
      Log.onItemAdded.subscribe(this._handleLogItemAdded);
    }

    this.props.carto.onStatusAdded.subscribe(this._handleStatusAdded);

    this.state = {
      displayEditor: false,
      activeOperations: 0,
    };
  }

  _handleLogItemAdded(log: Log, item: LogItem) {
    this._update();
  }

  _handleStatusAdded(carto: Carto, status: Status) {
    if (status.type === StatusType.OperationStarted) {
      this.setState({
        displayEditor: this.state.displayEditor,
        activeOperations: this.state.activeOperations + 1,
      });

      // this._prepareForFadeout(); // don't fade out text if an operation is ongoing.
    } else if (status.type === StatusType.OperationEnded) {
      this.setState({
        displayEditor: this.state.displayEditor,
        activeOperations: this.state.activeOperations - 1,
      });

      this._prepareForFadeout();
    } else {
      this._update();
    }
  }

  private _update() {
    if (this._isMountedInternal) {
      this.forceUpdate();
    }

    this._prepareForFadeout();
  }

  private _prepareForFadeout() {
    window.setTimeout(this._checkForTimeOut, MESSAGE_FADEOUT_TIME + 100);
  }

  _checkForTimeOut(carto: Carto, status: Status) {
    if (this._isMountedInternal) {
      this.forceUpdate();
    }
  }

  _toggleExpandedSize() {
    if (this.props.statusAreaMode === ProjectStatusAreaMode.expanded) {
      this.props.onSetExpandedSize(ProjectStatusAreaMode.minimized);
    } else {
      this.props.onSetExpandedSize(ProjectStatusAreaMode.expanded);
      this.scrollToListBottom();
    }
  }

  _toggleToEditor() {
    this.setState({
      displayEditor: true,
      activeOperations: this.state.activeOperations,
    });
  }

  _toggleToMessage() {
    this.setState({
      displayEditor: false,
      activeOperations: this.state.activeOperations,
    });
  }

  componentDidMount(): void {
    this.scrollToListBottom();
    this._isMountedInternal = true;
  }

  componentWillUnmount(): void {
    this._isMountedInternal = false;
  }

  scrollToListBottom() {
    if (this.scrollArea && this.scrollArea.current) {
      this.scrollArea.current.scrollTop = this.scrollArea.current.scrollHeight;
    }
  }

  _onUpdatePreferredTextSize(newTextSize: number) {
    this.props.carto.preferredTextSize = newTextSize;
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this._activeEditorPersistable = newPersistable;
  }

  async _commitCommand(command: string) {
    if (command.length > 0) {
      this.props.carto.notifyStatusUpdate(command);

      await this.props.carto.runCommand(command, this.props.project);
    }
  }

  render() {
    let interior = <></>;
    let editor = <></>;

    const heightOffset = this.props.heightOffset;
    const toolbarItems = [];
    if (this.state && this.state.displayEditor) {
      if (Utilities.isDebug && CartoApp.hostType === HostType.electronWeb) {
        editor = (
          <div className="sa-inputArea">
            <div className="sa-inputButton">
              <Button
                onClick={this._toggleToMessage}
                icon={<FontAwesomeIcon key="closeClick" icon={faXmark} className="fa-lg" />}
              />
            </div>
            <div className="sa-inputEditor">
              <TextEditor
                theme={this.props.theme}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.carto.preferredTextSize}
                readOnly={false}
                onUpdateContent={this._commitCommand}
                singleLineMode={true}
                carto={this.props.carto}
                heightOffset={heightOffset}
                initialContent={""}
                setActivePersistable={this._handleNewChildPersistable}
              />
            </div>
          </div>
        );
      } else {
        editor = (
          <div className="sa-inputArea">
            <div className="sa-inputButton">
              <Button
                onClick={this._toggleToMessage}
                icon={<FontAwesomeIcon key="closeClick" icon={faXmark} className="fa-lg" />}
              />
            </div>
            <div className="sa-inputEditor">
              <FunctionEditor
                theme={this.props.theme}
                carto={this.props.carto}
                project={this.props.project}
                isCommandEditor={true}
                // onUpdateContent={this._commitCommand}  /* function editor will call run system command itself.
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.carto.preferredTextSize}
                readOnly={false}
                singleCommandMode={true}
                roleId={"statusAreaEditor"}
                heightOffset={this.props.heightOffset}
                initialContent={""}
                setActivePersistable={this._handleNewChildPersistable}
              />
            </div>
          </div>
        );
      }
    }
    if (this.props.statusAreaMode === ProjectStatusAreaMode.minimized) {
      toolbarItems.push({
        icon: <FontAwesomeIcon icon={faCaretSquareUp} className="fa-lg" />,
        key: "expandStatusArea",
        kind: "toggle",
        active: false,
        onClick: this._toggleExpandedSize,
        title: "Show more information in the status area",
      });

      if (this.state && this.state.displayEditor) {
        interior = editor;
      } else {
        if (this.props.carto.status.length > 0) {
          const lastStatus = this.props.carto.status[this.props.carto.status.length - 1];

          const lastStatusUpdate = new Date().getTime() - lastStatus.time.getTime();

          if (lastStatusUpdate < MESSAGE_FADEOUT_TIME || this.state.activeOperations > 0) {
            if (this.state.activeOperations > 0) {
              interior = (
                <span className="sa-singleline" title={lastStatus.message}>
                  <img src="/loading.gif" alt="Waiting spinner" className="sa-loading" />
                  <span className="sa-message">{lastStatus.message}</span>
                </span>
              );
            } else {
              interior = (
                <span className="sa-singleline" title={lastStatus.message}>
                  <span className="sa-message">{lastStatus.message}</span>
                </span>
              );
            }
          } else if (Utilities.isDebug) {
            const lastLog = Log.items[Log.items.length - 1];
            if (lastLog && lastLog.created) {
              const lastLogUpdate = new Date().getTime() - lastLog.created.getTime();
              const message = lastLog.message ? lastLog.message.toString() : "(no message)";

              if (lastLogUpdate < MESSAGE_FADEOUT_TIME || this.state.activeOperations > 0) {
                interior = (
                  <span className="sa-singleline" title={message}>
                    <span className="sa-message">log: {message}</span>
                  </span>
                );
              }
            }
          }
        } else if (Utilities.isDebug) {
          const lastLog = Log.items[Log.items.length - 1];

          if (lastLog && lastLog.created) {
            const lastLogUpdate = new Date().getTime() - lastLog.created.getTime();

            if (lastLogUpdate < MESSAGE_FADEOUT_TIME || this.state.activeOperations > 0) {
              const message = lastLog.message ? lastLog.message.toString() : "(no message)";
              interior = (
                <span className="sa-singleline" title={message}>
                  <span className="sa-message">log: {message}</span>
                </span>
              );
            }
          }
        }
      }
    } else {
      toolbarItems.push({
        icon: <FontAwesomeIcon icon={faCaretSquareDown} className="fa-lg" />,
        key: "hideStatusArea",
        kind: "toggle",
        active: true,
        onClick: this._toggleExpandedSize,
        title: "Show more information in the status area",
      });

      const li = [];
      let index = 0;

      if (Utilities.isDebug) {
        for (let i = 0; i < Log.items.length; i++) {
          const logItem = Log.items[i];

          li.push({
            key: "sli" + i,
            content: (
              <div className="sa-list-item" title={logItem.message}>
                log: {logItem.message}
              </div>
            ),
          });
        }

        index += Log.items.length;
      }

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
      index += this.props.carto.status.length;

      interior = (
        <div className="sa-listOuter">
          <div className="sa-list" ref={this.scrollArea}>
            <List selectable items={li} selectedIndex={index} defaultSelectedIndex={index} />
          </div>
          {editor}
        </div>
      );
    }

    window.setTimeout(this.scrollToListBottom, 1);

    return (
      <div className="sa-outer">
        <div className="sa-message" onClick={this.state.displayEditor ? undefined : this._toggleToEditor}>
          {interior}
        </div>
        <div className="sa-tools">
          <Toolbar aria-label="Editor toolbar overflow menu" items={toolbarItems} />
        </div>
      </div>
    );
  }
}

import React, { Component } from "react";
import CreatorTools from "../app/CreatorTools";
import "./StatusArea.css";
import IAppProps from "./IAppProps";
import IStatus, { StatusType } from "../app/Status";
import Utilities from "./../core/Utilities";
import Log, { LogItem } from "./../core/Log";
import { ProjectStatusAreaMode } from "./ProjectEditor";
import { Toolbar, List, ThemeInput, Button, selectableListBehavior } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretSquareDown, faCaretSquareUp, faSearch, faXmark } from "@fortawesome/free-solid-svg-icons";
import Project from "../app/Project";
import SearchCommandEditor from "./SearchCommandEditor";
import { ProjectEditorAction } from "./ProjectEditorUtilities";

interface IStatusAreaProps extends IAppProps {
  onSetExpandedSize: (newMode: ProjectStatusAreaMode) => void;
  onFilterTextChanged: (newFilterText: string | undefined) => void;
  onActionRequested: (action: ProjectEditorAction) => void;
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
  scrollAreaList: React.RefObject<HTMLUListElement>;
  private _isMountedInternal: boolean = false;

  constructor(props: IStatusAreaProps) {
    super(props);

    this.scrollArea = React.createRef();
    this.scrollAreaList = React.createRef();

    this._handleKeyPress = this._handleKeyPress.bind(this);
    this._handleStatusAdded = this._handleStatusAdded.bind(this);
    this._handleOperationCompleted = this._handleOperationCompleted.bind(this);
    this._handleLogItemAdded = this._handleLogItemAdded.bind(this);
    this._checkForTimeOut = this._checkForTimeOut.bind(this);
    this._toggleExpandedSize = this._toggleExpandedSize.bind(this);
    this._toggleToEditor = this._toggleToEditor.bind(this);
    this._toggleToMessage = this._toggleToMessage.bind(this);
    this._update = this._update.bind(this);
    this.scrollToListBottom = this.scrollToListBottom.bind(this);
    this._prepareForFadeout = this._prepareForFadeout.bind(this);

    this.state = {
      displayEditor: false,
      activeOperations: 0,
    };
  }

  _handleLogItemAdded(log: Log, item: LogItem) {
    this._update();
  }

  async _handleOperationCompleted(creatorTools: CreatorTools, operation: number) {
    this.setState({
      displayEditor: this.state.displayEditor,
      activeOperations: this.props.creatorTools.activeOperations.length,
    });
  }

  async _handleStatusAdded(creatorTools: CreatorTools, status: IStatus): Promise<void> {
    if (!this._isMountedInternal) {
      // Component unmounted, resolve immediately to avoid hanging
      return;
    }

    if (status.type === StatusType.operationStarted) {
      return new Promise((resolve: () => void, reject: () => void) => {
        if (!this._isMountedInternal) {
          resolve();
          return;
        }
        this.setState(
          {
            displayEditor: this.state.displayEditor,
            activeOperations: this.state.activeOperations + 1,
          },
          () => {
            this._prepareForFadeout();
            window.setTimeout(() => {
              resolve();
            }, 1);
          }
        );
      });
      // this._prepareForFadeout(); // don't fade out text if an operation is ongoing.
    } else if (status.type === StatusType.operationEndedComplete || status.type === StatusType.operationEndedErrors) {
      return new Promise((resolve: () => void, reject: () => void) => {
        if (!this._isMountedInternal) {
          resolve();
          return;
        }
        this.setState(
          {
            displayEditor: this.state.displayEditor,
            activeOperations: this.props.creatorTools.activeOperations.length,
          },
          () => {
            this._prepareForFadeout();
            window.setTimeout(() => {
              resolve();
            }, 1);
          }
        );
      });
    } else {
      return new Promise((resolve: () => void, reject: () => void) => {
        if (!this._isMountedInternal) {
          resolve();
          return;
        }
        this.forceUpdate(() => {
          this._prepareForFadeout();
          window.setTimeout(() => {
            resolve();
          }, 1);
        });
      });
    }
  }

  private _update() {
    if (this._isMountedInternal) {
      this.forceUpdate();

      window.setTimeout(this.scrollToListBottom, 1);
    }
  }

  private _prepareForFadeout() {
    window.setTimeout(this._checkForTimeOut, MESSAGE_FADEOUT_TIME + 100);
  }

  _checkForTimeOut(creatorTools: CreatorTools, status: IStatus) {
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
      window.setTimeout(() => {
        if (this.scrollAreaList && this.scrollAreaList.current) {
          this.scrollAreaList.current.focus();
        }
      }, 10);
    }
  }

  _toggleToEditor() {
    this.setState({
      displayEditor: true,
      activeOperations: this.state.activeOperations,
    });
  }

  _toggleToMessage() {
    if (this.props.onFilterTextChanged) {
      this.props.onFilterTextChanged(undefined);
    }

    this.setState({
      displayEditor: false,
      activeOperations: this.state.activeOperations,
    });
  }

  componentDidMount(): void {
    this.scrollToListBottom();
    this._isMountedInternal = true;

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this._handleKeyPress);
    }

    if (Utilities.isDebug) {
      Log.onItemAdded.subscribe(this._handleLogItemAdded);
    }

    for (const status of this.props.creatorTools.status) {
      this._handleStatusAdded(this.props.creatorTools, status);
    }

    this.props.creatorTools.subscribeStatusAddedAsync(this._handleStatusAdded);

    if (!this.props.creatorTools.onOperationCompleted.has(this._handleOperationCompleted)) {
      this.props.creatorTools.onOperationCompleted.subscribe(this._handleOperationCompleted);
    }
  }

  componentWillUnmount(): void {
    this._isMountedInternal = false;

    if (typeof window !== "undefined") {
      window.removeEventListener("keypress", this._handleKeyPress);
    }

    if (Utilities.isDebug) {
      Log.onItemAdded.unsubscribe(this._handleLogItemAdded);
    }

    this.props.creatorTools.unsubscribeStatusAddedAsync(this._handleStatusAdded);
  }

  scrollToListBottom() {
    if (this.scrollArea && this.scrollArea.current) {
      this.scrollArea.current.scrollTop = this.scrollArea.current.scrollHeight;
    }
  }

  _handleKeyPress(event: KeyboardEvent) {
    if (event.key === "Escape" && this.state.displayEditor) {
      this._toggleToMessage();
    } else if (event.key === "Enter" && this.state.displayEditor) {
      this.props.onActionRequested(ProjectEditorAction.projectListCommit);
      this._toggleToMessage();
    } else if (event.ctrlKey === true && event.key === "e") {
      if (this.state.displayEditor) {
        this._toggleToMessage();
      } else {
        this._toggleToEditor();
      }

      event.stopPropagation();
      event.preventDefault();
    }
  }

  render() {
    let interior = <></>;
    let editor = <></>;

    const heightOffset = this.props.heightOffset;
    const toolbarItems = [];
    if (this.state && this.state.displayEditor) {
      editor = (
        <div className="sa-inputArea">
          <div className="sa-inputButton">
            <Button
              onClick={this._toggleToMessage}
              title="Close search box"
              icon={<FontAwesomeIcon key="closeClick" icon={faXmark} className="fa-lg" />}
            />
          </div>
          <div className="sa-inputEditor">
            <SearchCommandEditor
              isLarge={false}
              displayAbove={true}
              theme={this.props.theme}
              onActionRequested={this.props.onActionRequested}
              contentIndex={this.props.project?.indevInfoSet.contentIndex}
              onFilterTextChanged={this.props.onFilterTextChanged}
              creatorTools={this.props.creatorTools}
              heightOffset={heightOffset}
              initialContent={""}
            />
          </div>
        </div>
      );
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

      let setInterior = false;
      if (this.state && this.state.displayEditor) {
        interior = editor;
        setInterior = true;
      } else {
        if (this.props.creatorTools.status.length > 0) {
          let lastItemIndex = this.props.creatorTools.status.length - 1;
          let lastStatus = this.props.creatorTools.status[lastItemIndex];

          while (lastStatus.type === StatusType.operationEndedErrors && lastItemIndex > 0) {
            lastItemIndex--;
            lastStatus = this.props.creatorTools.status[lastItemIndex];
          }

          const lastStatusUpdate = new Date().getTime() - lastStatus.time.getTime();

          if (lastStatusUpdate < MESSAGE_FADEOUT_TIME || this.state.activeOperations > 0) {
            if (this.state.activeOperations > 0) {
              setInterior = true;
              interior = (
                <span className="sa-placeHolder" title={lastStatus.message}>
                  <img className="sa-placeHolderIcon sa-loading" src="loading.gif" alt="Waiting spinner" />
                  <span className="sa-placeHolderText">{lastStatus.message}</span>
                </span>
              );
            } else {
              setInterior = true;
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
                setInterior = true;
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

        if (!setInterior) {
          interior = (
            <div
              className="sa-placeHolder"
              style={{
                color: this.props.theme.siteVariables?.colorScheme.brand.foreground6,
              }}
            >
              <span className="sa-placeHolderIcon">
                <FontAwesomeIcon
                  key="searchPlaceHolder"
                  icon={faSearch}
                  className="fa-lg"
                  style={{
                    paddingTop: "2px",
                  }}
                />
              </span>
              <Button className="sa-serchplaceHolder" title="Use to search">
                Click or Ctrl-E to search
              </Button>
            </div>
          );
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

      const listItems = [];
      let index = 0;

      if (Utilities.isDebug) {
        for (let i = 0; i < Log.items.length; i++) {
          const logItem = Log.items[i];

          listItems.push({
            key: "sli" + i,
            "aria-label": logItem.message,
            content: (
              <div className="sa-list-item" title={logItem.message}>
                log: {logItem.message}
              </div>
            ),
          });
        }

        index += Log.items.length;
      }

      for (
        let i = Math.max(0, this.props.creatorTools.status.length - 1000);
        i < this.props.creatorTools.status.length;
        i++
      ) {
        const statusItem = this.props.creatorTools.status[i];

        listItems.push({
          key: "si" + i,
          "aria-label": statusItem.message,
          content: (
            <div className="sa-list-item" title={statusItem.message}>
              {statusItem.message}
            </div>
          ),
        });
      }

      index += this.props.creatorTools.status.length;

      interior = (
        <div className="sa-listOuter">
          <div className="sa-list" ref={this.scrollArea} tabIndex={0}>
            <List
              selectable
              items={listItems}
              autoFocus={true}
              tabIndex={0}
              ref={this.scrollAreaList}
              aria-label="List of status items"
              accessibility={selectableListBehavior}
              selectedIndex={index}
              defaultSelectedIndex={index}
            />
          </div>
          {editor}
        </div>
      );
    }

    return (
      <div className="sa-outer">
        <div
          className="sa-messageOuter"
          onClick={this.state.displayEditor ? undefined : this._toggleToEditor}
          aria-live="assertive"
        >
          {interior}
        </div>
        <div className="sa-tools">
          <Toolbar aria-label="Status area tools" items={toolbarItems} />
        </div>
      </div>
    );
  }
}

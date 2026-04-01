import React, { Component } from "react";
import CreatorTools from "../../app/CreatorTools";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import "./StatusArea.css";
import IAppProps from "./IAppProps";
import IStatus, { StatusType, StatusTopic } from "../../app/Status";
import Utilities from "../../core/Utilities";
import Log, { LogItem } from "../../core/Log";
import { ProjectStatusAreaMode } from "../project/ProjectEditor";
import { Box, IconButton, List, ListItem, ListItemButton, ListItemText, Button } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCaretSquareDown,
  faCaretSquareUp,
  faCheck,
  faExclamationTriangle,
  faSearch,
  faSpinner,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import Project from "../../app/Project";
import SearchCommandEditor from "../shared/components/inputs/searchCommandEditor/SearchCommandEditor";
import { ProjectEditorAction } from "../project/ProjectEditorUtilities";
import { mcColors } from "../hooks/theme/mcColors";
import { isDarkMode, getThemeColors } from "../hooks/theme/useThemeColors";
import { CreatorToolsEditPreference } from "../../app/ICreatorToolsData";
import IProjectTheme from "../types/IProjectTheme";

interface IStatusAreaProps extends IAppProps {
  onSetExpandedSize: (newMode: ProjectStatusAreaMode) => void;
  onFilterTextChanged: (newFilterText: string | undefined) => void;
  onActionRequested: (action: ProjectEditorAction) => void;
  statusAreaMode: ProjectStatusAreaMode;
  project?: Project;
  theme: IProjectTheme;
  heightOffset: number;
}

interface IStatusAreaState {
  displayEditor: boolean;
  activeOperations: number;
}

const MESSAGE_FADEOUT_TIME = 20000;
const PROGRESS_GRACE_MS = 2000;

export default class StatusArea extends Component<IStatusAreaProps, IStatusAreaState> {
  scrollArea: React.RefObject<HTMLDivElement>;
  scrollAreaList: React.RefObject<HTMLUListElement>;
  private _isMountedInternal: boolean = false;
  private _fadeoutTimer: number | undefined;

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
    this._focusCommandInput = this._focusCommandInput.bind(this);
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
    this._prepareForFadeout();
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
    if (this._fadeoutTimer !== undefined) {
      window.clearTimeout(this._fadeoutTimer);
    }
    this._fadeoutTimer = window.setTimeout(this._checkForTimeOut, MESSAGE_FADEOUT_TIME + 100);
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
    this.setState(
      {
        displayEditor: true,
        activeOperations: this.state.activeOperations,
      },
      () => {
        this._focusCommandInput();
      }
    );
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

  _focusCommandInput(retries = 6) {
    if (typeof document === "undefined") {
      return;
    }

    const input = document.querySelector<HTMLInputElement>(
      "#sceed-forminput, #sceed-forminput input, input[aria-label='Search or enter command']"
    );

    if (input) {
      input.focus();
      return;
    }

    if (retries > 0) {
      window.setTimeout(() => this._focusCommandInput(retries - 1), 50);
    }
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

    if (this._fadeoutTimer !== undefined) {
      window.clearTimeout(this._fadeoutTimer);
      this._fadeoutTimer = undefined;
    }

    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this._handleKeyPress);
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
    const target = event.target as HTMLElement | null;
    const isTextEntryTarget =
      !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

    if (isTextEntryTarget && this.state.displayEditor && (event.key === "Enter" || event.key === "Escape")) {
      return;
    }

    if (event.key === "Escape" && this.state.displayEditor) {
      this._toggleToMessage();
    } else if (event.key === "Enter" && this.state.displayEditor) {
      this.props.onActionRequested(ProjectEditorAction.projectListCommit);
      this._toggleToMessage();
    } else if (event.ctrlKey === true && event.key.toLowerCase() === "e") {
      if (!this.state.displayEditor) {
        this._toggleToEditor();
      } else {
        this._focusCommandInput();
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
            <IconButton
              onClick={this._toggleToMessage}
              title="Close search box"
              aria-label="Close search box"
              size="small"
            >
              <FontAwesomeIcon key="closeClick" icon={faXmark} className="fa-lg" />
            </IconButton>
          </div>
          <div className="sa-inputEditor">
            <SearchCommandEditor
              isLarge={false}
              displayAbove={true}
              theme={this.props.theme}
              onActionRequested={this.props.onActionRequested}
              contentIndex={this.props.project?.indevInfoSet.contentIndex}
              project={this.props.project}
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
        icon: <FontAwesomeIcon icon={faCaretSquareUp} className="fa-lg" style={{ marginTop: "2px" }} />,
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

          // In Focused mode, skip validation-topic messages entirely
          const isFocusedMode = this.props.creatorTools.editPreference === CreatorToolsEditPreference.summarized;

          while (
            (lastStatus.type === StatusType.operationEndedErrors ||
              (isFocusedMode && lastStatus.topic === StatusTopic.validation)) &&
            lastItemIndex > 0
          ) {
            lastItemIndex--;
            lastStatus = this.props.creatorTools.status[lastItemIndex];
          }

          // If we've skipped all messages (e.g., only validation messages remain), don't show anything
          const skipStatusDisplay = isFocusedMode && lastStatus.topic === StatusTopic.validation;
          const lastStatusTime =
            lastStatus.time instanceof Date
              ? lastStatus.time.getTime()
              : typeof lastStatus.time === "string"
                ? new Date(lastStatus.time).getTime()
                : 0;
          const lastStatusUpdate = new Date().getTime() - lastStatusTime;
          const hasActiveOperations = this.props.creatorTools.activeOperations.length > 0;
          const isProgressMessage = lastStatus.message.match(/\(\d+(?:\.\d+)?%\)/) !== null;
          const isValidationProgress = lastStatus.topic === StatusTopic.validation && isProgressMessage;

          if (!skipStatusDisplay) {
            const shouldShowProgress =
              hasActiveOperations || (isValidationProgress && lastStatusUpdate < PROGRESS_GRACE_MS);

            if (lastStatusUpdate < MESSAGE_FADEOUT_TIME || hasActiveOperations) {
              if (shouldShowProgress) {
                // Extract percentage from message (format: "... (18%)" or "... (18.5%)")
                const percentMatch = lastStatus.message.match(/\((\d+(?:\.\d+)?)%\)/);
                const progressPercent = percentMatch ? parseFloat(percentMatch[1]) : 0;
                // Calculate how many of 8 blocks should be filled (0-8)
                const filledBlocks = Math.floor((progressPercent / 100) * 8);

                const woodBlocks = [];
                for (let i = 0; i < 8; i++) {
                  woodBlocks.push(
                    <div
                      key={i}
                      className={`sa-woodBlock ${i < filledBlocks ? "sa-woodBlockFilled" : "sa-woodBlockEmpty"}`}
                      title={lastStatus.message}
                    >
                      <img
                        src={CreatorToolsHost.contentWebRoot + "res/images/icons/wood-block.png"}
                        alt="Status indicator"
                      />
                    </div>
                  );
                }

                setInterior = true;
                interior = (
                  <div
                    className="sa-progressOuter"
                    title={lastStatus.message}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressPercent}
                  >
                    <img
                      src={CreatorToolsHost.contentWebRoot + "res/images/icons/pickaxe-progress.png"}
                      alt="Working..."
                      className="sa-progressPickaxe"
                      title={lastStatus.message}
                    />
                    <div className="sa-woodBlockBar">{woodBlocks}</div>
                  </div>
                );
              } else {
                // Only show the message text if it's not a worker progress message (those have percentages)
                // When an operation completes, we want to go straight to "Click to search" mode
                if (!isProgressMessage) {
                  const isDone =
                    lastStatus.type === StatusType.operationEndedComplete ||
                    lastStatus.message.toLowerCase().includes("done") ||
                    lastStatus.message.toLowerCase().includes("complete");
                  const isError = lastStatus.type === StatusType.operationEndedErrors;
                  const statusIcon = isDone ? (
                    <FontAwesomeIcon icon={faCheck} style={{ marginRight: "6px", color: mcColors.green4 }} />
                  ) : isError ? (
                    <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: "6px", color: "#e8a317" }} />
                  ) : (
                    <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: "6px" }} />
                  );
                  setInterior = true;
                  interior = (
                    <span className="sa-singleline" title={lastStatus.message}>
                      <span className="sa-message" data-testid="status-message">
                        {statusIcon}
                        {lastStatus.message}
                      </span>
                    </span>
                  );
                }
              }
            } else if (Utilities.isDebug) {
              const lastLog = Log.items[Log.items.length - 1];
              if (lastLog && lastLog.created) {
                const lastLogUpdate = new Date().getTime() - lastLog.created.getTime();
                const message = lastLog.message ? lastLog.message.toString() : "(no message)";

                if (lastLogUpdate < MESSAGE_FADEOUT_TIME || hasActiveOperations) {
                  setInterior = true;
                  interior = (
                    <span className="sa-singleline" title={message}>
                      <span className="sa-message">log: {message}</span>
                    </span>
                  );
                }
              }
            }
          }
        } else if (Utilities.isDebug) {
          const lastLog = Log.items[Log.items.length - 1];
          const hasActiveOperationsDebug = this.props.creatorTools.activeOperations.length > 0;

          if (lastLog && lastLog.created) {
            const lastLogUpdate = new Date().getTime() - lastLog.created.getTime();

            if (lastLogUpdate < MESSAGE_FADEOUT_TIME || hasActiveOperationsDebug) {
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
                color: getThemeColors().foreground6,
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
              <Button
                className="sa-searchPlaceHolder"
                title="Use to search"
                size="small"
                style={{ marginLeft: "6px", marginTop: "2px" }}
              >
                Click or Ctrl-E to search
              </Button>
            </div>
          );
        }
      }
    } else {
      toolbarItems.push({
        icon: <FontAwesomeIcon icon={faCaretSquareDown} className="fa-lg" style={{ marginTop: "2px" }} />,
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
              dense
              sx={{
                outline: "none",
                "&:focus-visible": {
                  outline: `2px solid ${mcColors.green4}`,
                  outlineOffset: -2,
                },
              }}
            >
              {listItems.map((item, idx) => (
                <ListItem key={item.key} disablePadding>
                  <ListItemButton
                    selected={idx === index - 1}
                    sx={{
                      "&.Mui-selected": {
                        backgroundColor: isDarkMode() ? "rgba(82, 165, 53, 0.25)" : "rgba(82, 165, 53, 0.2)",
                      },
                    }}
                  >
                    <ListItemText
                      primary={item.content}
                      primaryTypographyProps={{
                        sx: { color: isDarkMode() ? mcColors.white : mcColors.gray6 },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
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
          <Box
            component="div"
            role="toolbar"
            aria-label="Status area tools"
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            {toolbarItems.map((item) => (
              <IconButton
                key={item.key}
                onClick={item.onClick}
                title={item.title}
                aria-label={item.title}
                size="small"
                sx={{
                  color: item.active ? mcColors.green4 : isDarkMode() ? mcColors.white : mcColors.gray6,
                  backgroundColor: item.active
                    ? isDarkMode()
                      ? "rgba(82, 165, 53, 0.25)"
                      : "rgba(82, 165, 53, 0.2)"
                    : "transparent",
                  "&:hover": {
                    backgroundColor: isDarkMode() ? mcColors.gray4 : mcColors.gray2,
                  },
                }}
              >
                {item.icon}
              </IconButton>
            ))}
          </Box>
        </div>
      </div>
    );
  }
}

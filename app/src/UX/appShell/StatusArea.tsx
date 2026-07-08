import React, { Component } from "react";
import CreatorTools from "../../app/CreatorTools";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import "./StatusArea.css";
import IAppProps from "./IAppProps";
import IStatus, { StatusType, StatusTopic } from "../../app/Status";
import Utilities from "../../core/Utilities";
import Log, { LogItem } from "../../core/Log";
import { ProjectStatusAreaMode } from "../project/ProjectEditor";
import { Box, IconButton, List, ListItem, ListItemText, Button } from "@mui/material";
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
import { withLocalization, WithLocalizationProps } from "../withLocalization";

interface IStatusAreaProps extends IAppProps, WithLocalizationProps {
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
  // Index of the status row that holds the roving tab stop (the row keyboard
  // focus lands on / moves within). -1 means "default to the most recent row".
  activeListIndex: number;
}

const MESSAGE_FADEOUT_TIME = 20000;
const PROGRESS_GRACE_MS = 2000;

class StatusArea extends Component<IStatusAreaProps, IStatusAreaState> {
  scrollArea: React.RefObject<HTMLDivElement>;
  toggleButtonRef: React.RefObject<HTMLButtonElement>;
  private _isMountedInternal: boolean = false;
  private _fadeoutTimer: number | undefined;

  constructor(props: IStatusAreaProps) {
    super(props);

    this.scrollArea = React.createRef();
    this.toggleButtonRef = React.createRef();

    this._handleKeyPress = this._handleKeyPress.bind(this);
    this._handleStatusAdded = this._handleStatusAdded.bind(this);
    this._handleOperationCompleted = this._handleOperationCompleted.bind(this);
    this._handleLogItemAdded = this._handleLogItemAdded.bind(this);
    this._checkForTimeOut = this._checkForTimeOut.bind(this);
    this._toggleExpandedSize = this._toggleExpandedSize.bind(this);
    this._collapseAndFocusToggle = this._collapseAndFocusToggle.bind(this);
    this._handleListKeyDown = this._handleListKeyDown.bind(this);
    this._setActiveListIndex = this._setActiveListIndex.bind(this);
    this._toggleToEditor = this._toggleToEditor.bind(this);
    this._toggleToMessage = this._toggleToMessage.bind(this);
    this._focusCommandInput = this._focusCommandInput.bind(this);
    this._update = this._update.bind(this);
    this.scrollToListBottom = this.scrollToListBottom.bind(this);
    this._prepareForFadeout = this._prepareForFadeout.bind(this);

    this.state = {
      displayEditor: false,
      activeOperations: 0,
      activeListIndex: -1,
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
      this._collapseAndFocusToggle();
    } else {
      this.props.onSetExpandedSize(ProjectStatusAreaMode.expanded);

      // After the parent re-renders with the expanded list mounted, move keyboard
      // focus into the now-visible flyout so keyboard-only users land inside it and
      // can read/navigate it (and Escape out). Previously this focused `scrollAreaList`,
      // a ref that was never attached to any element, so focus never entered the
      // flyout and the controls inside it were unreachable by keyboard
      // (WCAG / MAS 2.1.1, Keyboard). Land on the most recent row so Up/Down then
      // navigate the log; fall back to the scroll container when the log is empty.
      window.setTimeout(() => {
        this.scrollToListBottom();
        const list = this.scrollArea.current;
        const options = list ? Array.from(list.querySelectorAll<HTMLElement>('[role="option"]')) : [];
        if (options.length > 0) {
          options[options.length - 1].focus();
        } else if (list) {
          list.focus();
        }
      }, 10);
    }
  }

  /**
   * Roving-tabindex keyboard navigation for the status log listbox: Up/Down move
   * between rows, Home/End jump to the first/last row. The focused row carries the
   * single tab stop (see render); Tab therefore enters/leaves the list as one stop
   * while these keys navigate within it (WCAG / MAS 2.1.1).
   */
  _handleListKeyDown(event: React.KeyboardEvent) {
    const key = event.key;
    if (key !== "ArrowDown" && key !== "ArrowUp" && key !== "Home" && key !== "End") {
      return;
    }

    const list = this.scrollArea.current;
    if (!list) {
      return;
    }

    const options = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
    if (options.length === 0) {
      return;
    }

    const currentIndex = options.findIndex((option) => option === document.activeElement);
    let nextIndex = currentIndex;
    if (key === "ArrowDown") {
      nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, options.length - 1);
    } else if (key === "ArrowUp") {
      nextIndex = currentIndex < 0 ? options.length - 1 : Math.max(currentIndex - 1, 0);
    } else if (key === "Home") {
      nextIndex = 0;
    } else if (key === "End") {
      nextIndex = options.length - 1;
    }

    if (nextIndex >= 0 && nextIndex < options.length) {
      event.preventDefault();
      event.stopPropagation();
      options[nextIndex].focus();
    }
  }

  _setActiveListIndex(index: number) {
    if (this.state.activeListIndex !== index) {
      this.setState({ activeListIndex: index });
    }
  }

  _collapseAndFocusToggle() {
    this.props.onSetExpandedSize(ProjectStatusAreaMode.minimized);

    // Return focus to the disclosure toggle so keyboard focus is not left orphaned
    // on the now-removed flyout when it collapses.
    window.setTimeout(() => {
      if (this.toggleButtonRef && this.toggleButtonRef.current) {
        this.toggleButtonRef.current.focus();
      }
    }, 10);
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
    } else if (
      event.key === "Escape" &&
      this.props.statusAreaMode === ProjectStatusAreaMode.expanded &&
      !!target &&
      !!target.closest(".sa-outer")
    ) {
      // Collapse the expanded status flyout from the keyboard and return focus to
      // its toggle so keyboard users can dismiss it (WCAG / MAS 2.1.1).
      this._collapseAndFocusToggle();
      event.stopPropagation();
      event.preventDefault();
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
        ariaExpanded: false,
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
          // In Focused mode, validation ops shouldn't be surfaced as progress
          // activity — the user has opted out of seeing inspector/validation,
          // so a validation operation running in the background would leave the
          // status bar showing "progress" (with a stale non-validation tooltip
          // like "Done loading project files...") long after project load is
          // actually done. Exclude validation-topic operations from the
          // "active operations" signal in focused mode.
          const relevantActiveOps = isFocusedMode
            ? this.props.creatorTools.activeOperations.filter((op) => op.topic !== StatusTopic.validation)
            : this.props.creatorTools.activeOperations;
          const hasActiveOperations = relevantActiveOps.length > 0;
          const isProgressMessage = lastStatus.message.match(/\(\d+(?:\.\d+)?%\)/) !== null;
          const isValidationProgress = lastStatus.topic === StatusTopic.validation && isProgressMessage;

          // When the progress bar (pickaxe) is shown because an operation is
          // still active, the message we display in its tooltip should describe
          // that active operation — not whatever the most recent status push
          // happened to be. Otherwise, finishing one short operation (e.g.
          // project load → "Done loading project files for 'X'") while a
          // longer one keeps running in the background (e.g. validation) leaves
          // the pickaxe visible with a misleading "Done…" tooltip until the
          // background work finishes, which can look like the bar is stuck.
          // Walk back through the status history to find the most recent
          // status that belongs to a still-active operation.
          let progressStatus = lastStatus;
          if (hasActiveOperations) {
            const activeOpIds = new Set<number>();
            for (const op of relevantActiveOps) {
              if (op.operationId !== undefined && op.operationId !== null) {
                activeOpIds.add(op.operationId);
              }
            }
            for (let i = this.props.creatorTools.status.length - 1; i >= 0; i--) {
              const candidate = this.props.creatorTools.status[i];
              if (
                candidate.operationId !== undefined &&
                candidate.operationId !== null &&
                activeOpIds.has(candidate.operationId)
              ) {
                progressStatus = candidate;
                break;
              }
            }
          }

          if (!skipStatusDisplay) {
            const shouldShowProgress =
              hasActiveOperations || (isValidationProgress && lastStatusUpdate < PROGRESS_GRACE_MS);

            if (lastStatusUpdate < MESSAGE_FADEOUT_TIME || hasActiveOperations) {
              if (shouldShowProgress) {
                // Extract percentage from the active operation's message
                // (format: "... (18%)" or "... (18.5%)") rather than
                // lastStatus.message, so the bar reflects the operation that's
                // actually keeping it on screen.
                const percentMatch = progressStatus.message.match(/\((\d+(?:\.\d+)?)%\)/);
                const progressPercent = percentMatch ? parseFloat(percentMatch[1]) : 0;
                // Calculate how many of 8 blocks should be filled (0-8)
                const filledBlocks = Math.floor((progressPercent / 100) * 8);

                const woodBlocks = [];
                for (let i = 0; i < 8; i++) {
                  woodBlocks.push(
                    <div
                      key={i}
                      className={`sa-woodBlock ${i < filledBlocks ? "sa-woodBlockFilled" : "sa-woodBlockEmpty"}`}
                      title={progressStatus.message}
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
                    title={progressStatus.message}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressPercent}
                  >
                    <img
                      src={CreatorToolsHost.contentWebRoot + "res/images/icons/pickaxe-progress.png"}
                      alt="Working..."
                      className="sa-progressPickaxe"
                      title={progressStatus.message}
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
        ariaExpanded: true,
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
          <div className="sa-list" ref={this.scrollArea} tabIndex={-1}>
            {/* The status log is a navigable list: each row is a listbox option with
                a roving tab stop, so keyboard users land on a row (Tab) and move
                between rows (Up/Down/Home/End) per the project's roving-tabindex
                convention. Rows are read-only options, NOT ListItemButtons — those
                were announced as activatable controls that did nothing for
                keyboard/AT users (WCAG / MAS 2.1.1 + 4.1.2). */}
            <List dense role="listbox" aria-label={this.props.intl.formatMessage({ id: "project_editor.status.messages_aria" })} onKeyDown={this._handleListKeyDown}>
              {listItems.map((item, idx) => {
                const isCurrent = idx === index - 1;
                // The focused row holds the single tab stop; default it to the most
                // recent (last) row when the user has not navigated yet.
                const tabStopIndex =
                  this.state.activeListIndex >= 0 && this.state.activeListIndex < listItems.length
                    ? this.state.activeListIndex
                    : listItems.length - 1;
                const isTabStop = idx === tabStopIndex;

                return (
                  <ListItem
                    key={item.key}
                    id={`sa-opt-${idx}`}
                    role="option"
                    tabIndex={isTabStop ? 0 : -1}
                    aria-selected={isTabStop}
                    aria-current={isCurrent ? "true" : undefined}
                    onFocus={() => this._setActiveListIndex(idx)}
                    disablePadding
                    sx={{
                      px: 0.5,
                      backgroundColor: isCurrent
                        ? isDarkMode()
                          ? "rgba(82, 165, 53, 0.25)"
                          : "rgba(82, 165, 53, 0.2)"
                        : "transparent",
                    }}
                  >
                    <ListItemText
                      primary={item.content}
                      primaryTypographyProps={{
                        sx: { color: isDarkMode() ? mcColors.white : mcColors.gray6 },
                      }}
                    />
                  </ListItem>
                );
              })}
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
                ref={item.kind === "toggle" ? this.toggleButtonRef : undefined}
                onClick={item.onClick}
                title={item.title}
                aria-label={item.title}
                aria-expanded={item.kind === "toggle" ? item.ariaExpanded : undefined}
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

export default withLocalization(StatusArea);

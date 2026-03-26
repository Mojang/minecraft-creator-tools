import React, { Component } from "react";
import ReactDOM from "react-dom";
import "./SearchCommandEditor.css";
import CreatorTools from "../../../../../app/CreatorTools";
import McSelectableList, { McSelectableListItem } from "../mcSelectableList/McSelectableList";
import { IconButton, Stack, TextField } from "@mui/material";
import { getThemeColors } from "../../../../hooks/theme/useThemeColors";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faFile, faFont } from "@fortawesome/free-solid-svg-icons";
import Project from "../../../../../app/Project";
import CommandRunner from "../../../../../app/CommandRunner";
import { IContentIndex } from "../../../../../core/ContentIndex";
import { IAnnotatedValue } from "../../../../../core/AnnotatedValue";
import { ProjectEditorAction } from "../../../../project/ProjectEditorUtilities";
import { ToolCommandRegistry, initializeToolCommands, ToolCommandContextFactory } from "../../../../../app/toolcommands";
import type { IToolCommandOutput } from "../../../../../app/toolcommands";
import IProjectTheme from "../../../../types/IProjectTheme";
import Log from "../../../../../core/Log";

interface ISearchCommandEditorProps {
  theme: IProjectTheme;
  placeholder?: string;
  commitButton?: boolean;
  runCommandButton?: boolean;
  initialContent?: string;
  fixedHeight?: number;
  contentIndex?: IContentIndex;
  project?: Project;
  heightOffset?: number;
  isLarge: boolean;
  creatorTools: CreatorTools;
  displayAbove: boolean;
  onUpdateContent?: (newContent: string) => void;
  onCommit?: (newContent: string) => void;
  onActionRequested?: (action: ProjectEditorAction) => void;
  onFilterTextChanged: (newFilterText: string | undefined) => void;
}

interface ISearchCommandEditorState {
  autoCompleteResults?: { [fullKey: string]: IAnnotatedValue[] | undefined } | undefined;
  content?: string;
  initialContent?: string;
  selectedAutoComplete?: number;
  /** When in command mode (/), the prefix up to the token being completed */
  completionPrefix?: string;
  /** Description map for command suggestions (suggestion → description text) */
  commandSuggestionDescriptions?: Map<string, string>;
  /** Set of result keys that are matched project item paths (for distinct rendering) */
  matchedItemPaths?: Set<string>;
}

export default class SearchCommandEditor extends Component<ISearchCommandEditorProps, ISearchCommandEditorState> {
  inputArea: React.RefObject<HTMLDivElement>;
  #isRetrieving = false;

  constructor(props: ISearchCommandEditorProps) {
    super(props);

    this.inputArea = React.createRef();
    this._retrieveSuggestions = this._retrieveSuggestions.bind(this);
    this._handleAutoCompleteSelected = this._handleAutoCompleteSelected.bind(this);

    this._sendFunction = this._sendFunction.bind(this);

    this._handleTextInputChange = this._handleTextInputChange.bind(this);
    this._handleInputKey = this._handleInputKey.bind(this);
    this._handleInputDown = this._handleInputDown.bind(this);

    this._commitContent = this._commitContent.bind(this);

    this.state = {
      content: this.props.initialContent,
      initialContent: this.props.initialContent,
      autoCompleteResults: undefined,
    };
  }

  /** Whether the current input is a tool command (starts with "/"). */
  private get _isToolCommandMode(): boolean {
    return !!this.state?.content?.startsWith("/");
  }

  /**
   * Dynamically resolve the content index from the project's indevInfoSet.
   * This is critical because ProjectInfoSet.generateInfoSet() creates a NEW
   * ContentIndex and swaps the reference on completion. If we only use the
   * prop captured at render time, we'd hold a stale (empty) index.
   */
  private get _contentIndex(): IContentIndex | undefined {
    return this.props.project?.indevInfoSet?.contentIndex ?? this.props.contentIndex;
  }

  /**
   * Compute the prefix of the input before the token currently being completed.
   * For "/create addons", prefix is "/create " and partial is "addons".
   * For "/cre", prefix is "/" and partial is "cre".
   */
  private _getCompletionPrefix(text: string): string {
    const trimmed = text.trimEnd();
    const hasTrailingSpace = text.length > trimmed.length;

    if (hasTrailingSpace) {
      return text;
    }

    const lastSpace = text.lastIndexOf(" ");
    if (lastSpace >= 0) {
      return text.slice(0, lastSpace + 1);
    }

    return text.startsWith("/") ? "/" : "";
  }

  /**
   * Build a description map for tool command suggestions.
   * Shows command descriptions for command-name completions and
   * gallery item titles for argument completions (e.g., template names).
   */
  private _buildCommandDescriptions(suggestions: string[], commandText: string): Map<string, string> {
    const descMap = new Map<string, string>();
    const withoutSlash = commandText.startsWith("/") ? commandText.slice(1) : commandText;
    const parts = withoutSlash.trim().split(/\s+/);
    const cmdName = parts[0] || "";

    // Completing command names
    if (parts.length <= 1 && !commandText.trimEnd().includes(" ")) {
      for (const s of suggestions) {
        const name = s.startsWith("/") ? s.slice(1) : s;
        const cmd = ToolCommandRegistry.instance.get(name);
        if (cmd) {
          descMap.set(s, cmd.metadata.description);
        }
      }
      return descMap;
    }

    // Completing arguments — look up gallery titles if available
    const cmd = ToolCommandRegistry.instance.get(cmdName);
    if (cmd) {
      for (const s of suggestions) {
        const galItem = this.props.creatorTools.gallery?.items?.find((item) => item.id === s);
        if (galItem) {
          descMap.set(s, galItem.title);
        }
      }
    }

    return descMap;
  }

  /** Create an IToolCommandOutput that logs to the CreatorTools status. */
  private _createCommandOutput(): IToolCommandOutput {
    return {
      info: (msg) => this.props.creatorTools.notifyStatusUpdate(msg),
      success: (msg) => this.props.creatorTools.notifyStatusUpdate(msg),
      warn: (msg) => this.props.creatorTools.notifyStatusUpdate(msg),
      error: (msg) => this.props.creatorTools.notifyStatusUpdate(msg),
      debug: () => {},
      progress: (current, total, msg) => {
        const pct = Math.round((current / total) * 100);
        this.props.creatorTools.notifyStatusUpdate(`[${pct}%] ${msg || ""}`);
      },
    };
  }

  /**
   * Accept a tool command suggestion: insert it at the completion prefix position,
   * add a trailing space, and re-trigger completions for the next argument.
   */
  private async _acceptToolCommandSuggestion(suggestion: string) {
    const prefix = this.state.completionPrefix || "/";
    const newValue = prefix + suggestion + " ";

    this.setState({
      content: newValue,
      selectedAutoComplete: undefined,
      autoCompleteResults: undefined,
      completionPrefix: undefined,
      commandSuggestionDescriptions: undefined,
    });

    // Notify parent of the content change
    if (this.props.onUpdateContent) {
      this.props.onUpdateContent(newValue);
    }

    // Re-trigger completions for next argument after a short delay
    setTimeout(async () => {
      if (newValue.startsWith("/")) {
        await this._retrieveToolCommandSuggestions(newValue);
      }
    }, 50);
  }

  /**
   * Retrieve tool command completions for the given text and update state.
   */
  private async _retrieveToolCommandSuggestions(text?: string) {
    const content = text || this.state.content || "";
    if (!content.startsWith("/")) {
      return;
    }

    const output = this._createCommandOutput();
    const context = ToolCommandContextFactory.createMinimal(this.props.creatorTools, output);

    if (this.props.project) {
      context.project = this.props.project;
    }

    context.scope = "ui";

    const completions = await ToolCommandRegistry.instance.getCompletions(content, content.length, context);
    const limited = completions.slice(0, 15);

    const prefix = this._getCompletionPrefix(content);
    const descriptions = this._buildCommandDescriptions(limited, content);

    // Convert to autoCompleteResults format for display
    const autoCompleteResults: { [fullKey: string]: IAnnotatedValue[] | undefined } = {};
    for (const c of limited) {
      autoCompleteResults[c] = undefined;
    }

    this.setState({
      selectedAutoComplete: undefined,
      autoCompleteResults: Object.keys(autoCompleteResults).length > 0 ? autoCompleteResults : undefined,
      completionPrefix: prefix,
      commandSuggestionDescriptions: descriptions,
    });
  }

  /**
   * Execute a tool command string via ToolCommandRegistry.
   */
  private async _executeToolCommand(commandText: string) {
    if (!commandText.trim()) {
      return;
    }

    const output = this._createCommandOutput();
    const context = ToolCommandContextFactory.createMinimal(this.props.creatorTools, output);

    if (this.props.project) {
      context.project = this.props.project;
    }

    context.scope = "ui";

    this.props.creatorTools.notifyStatusUpdate("Running: " + commandText);

    try {
      const result = await ToolCommandRegistry.instance.execute(commandText, context);

      if (result) {
        if (result.success) {
          this.props.creatorTools.notifyStatusUpdate(result.message || "Command completed");
        } else {
          this.props.creatorTools.notifyStatusUpdate("Error: " + (result.error?.message || "Command failed"));
        }
      } else {
        this.props.creatorTools.notifyStatusUpdate("Unknown command: " + commandText);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.props.creatorTools.notifyStatusUpdate("Command error: " + msg);
    }

    // Clear the input after executing
    this.setState({
      content: "",
      selectedAutoComplete: undefined,
      autoCompleteResults: undefined,
      completionPrefix: undefined,
      commandSuggestionDescriptions: undefined,
    });
  }

  static getDerivedStateFromProps(props: ISearchCommandEditorProps, state: ISearchCommandEditorState) {
    if (state === undefined || state === null) {
      state = {};

      return state;
    }

    if (props.initialContent !== state.initialContent && props.initialContent !== undefined) {
      state.content = props.initialContent;
      state.initialContent = props.initialContent;

      return state;
    }

    return null; // No change to state
  }

  async _sendFunction() {
    if (!this.state.content) {
      return;
    }

    await CommandRunner.runCommandText(this.props.creatorTools, this.state.content);
  }

  _handleInputDown(event: React.KeyboardEvent<Element>) {
    if (event.key === "Enter") {
      this._handleInputKey(event);
      return;
    }

    if (this._isToolCommandMode) {
      // Handle arrow keys and tab for command mode suggestion navigation
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        if (this.state.autoCompleteResults) {
          const results = this.getResultsFromAutoCompleteResults();
          if (results.length > 0) {
            const idx = this.state.selectedAutoComplete;
            let next: number;
            if (event.key === "ArrowUp") {
              next = idx === undefined || idx <= 0 ? results.length - 1 : idx - 1;
            } else {
              next = idx === undefined || idx >= results.length - 1 ? 0 : idx + 1;
            }
            this.setState({ selectedAutoComplete: next });
            event.preventDefault();
          }
        }
        return;
      }

      if (event.key === "Tab") {
        if (this.state.autoCompleteResults) {
          const results = this.getResultsFromAutoCompleteResults();
          if (results.length > 0) {
            const idx = this.state.selectedAutoComplete !== undefined ? this.state.selectedAutoComplete : 0;
            this._acceptToolCommandSuggestion(results[idx]);
            event.preventDefault();
          }
        }
        return;
      }

      return;
    }

    if (this.props.onActionRequested) {
      if (event.key === "ArrowUp") {
        this.props.onActionRequested(ProjectEditorAction.projectListUp);
        event.preventDefault();
      }

      if (event.key === "ArrowDown") {
        this.props.onActionRequested(ProjectEditorAction.projectListDown);
        event.preventDefault();
      }
    }
  }

  _handleInputKey(event: React.KeyboardEvent<Element>) {
    if (event.key === "Enter") {
      if (this._isToolCommandMode) {
        // Tool command mode
        if (this.state.selectedAutoComplete !== undefined && this.state.autoCompleteResults) {
          // A suggestion is selected — accept it
          const results = this.getResultsFromAutoCompleteResults();
          const suggestion = results[this.state.selectedAutoComplete];
          if (suggestion) {
            this._acceptToolCommandSuggestion(suggestion);
          }
        } else {
          // No suggestion selected — execute the command
          const command = this.state.content;
          if (command) {
            this._executeToolCommand(command);
          }
        }
        event.preventDefault();
        return;
      }

      if (this.state.selectedAutoComplete !== undefined && this.state.autoCompleteResults) {
        const results = this.getResultsFromAutoCompleteResults();

        const text = results[this.state.selectedAutoComplete];

        this.setState({
          content: text,
          initialContent: this.state.initialContent,
          selectedAutoComplete: undefined,
          autoCompleteResults: undefined,
        });
      } else {
        const command = this.state.content;

        if (command && command.length > 4 && command.startsWith("/")) {
          this.props.creatorTools.notifyStatusUpdate(command);

          this.props.creatorTools.runCommand(command, this.props.project);
        }
      }
    }
  }

  _handleTextInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event === null || event.target.value === undefined) {
      return;
    }

    this._handleContentChange(event.target.value.toString(), false);
  }

  _handleContentChange(dataStr: string, clearAutoComplete: boolean) {
    if (this.props.onUpdateContent !== undefined) {
      this.props.onUpdateContent(dataStr);
    }

    if (this.props.onFilterTextChanged) {
      // Only filter project items when not in command mode
      if (!dataStr.startsWith("/")) {
        this.props.onFilterTextChanged(dataStr);
      }
    }

    if (this.state && dataStr !== undefined) {
      this.setState({
        content: dataStr,
        initialContent: this.state.initialContent,
        selectedAutoComplete: clearAutoComplete ? undefined : this.state.selectedAutoComplete,
        autoCompleteResults: clearAutoComplete ? undefined : this.state.autoCompleteResults,
      });
    }

    // Tool command mode: get completions from ToolCommandRegistry
    if (!clearAutoComplete && dataStr.startsWith("/") && dataStr.length >= 1) {
      if (!this.#isRetrieving) {
        this.#isRetrieving = true;
        window.setTimeout(async () => {
          this.#isRetrieving = false;
          await this._retrieveToolCommandSuggestions(dataStr);
        }, 100);
      }
      return;
    }

    // Normal content index search mode — popover is hidden for non-command searches
    // (project items list already word-wheels/filters as you type), so skip retrieval.
  }

  private async _retrieveSuggestions() {
    this.#isRetrieving = false;

    const contentIndex = this._contentIndex;

    if (contentIndex === undefined || this.state.content === undefined) {
      return;
    }

    const content = this.state.content;

    try {
      // Get trie-based term completions
      const termResults = await contentIndex.getDescendentStrings(content);

      // Also get matched project items (file paths) via getMatches
      const matchedItems = await contentIndex.getMatches(content);

      // Merge: start with term results
      const merged: { [fullKey: string]: IAnnotatedValue[] | undefined } = termResults ? { ...termResults } : {};
      const matchedItemPaths = new Set<string>();

      if (matchedItems && matchedItems.length > 0) {
        // Add matched item paths that start with "/" (file paths) to the results
        for (const item of matchedItems) {
          if (item.value && item.value.startsWith("/") && !merged[item.value]) {
            merged[item.value] = [item];
            matchedItemPaths.add(item.value);
          }
        }
      }

      // Only update if content hasn't changed during async operations
      if (this.state.content === content) {
        this.setState({
          selectedAutoComplete: undefined,
          autoCompleteResults: Object.keys(merged).length > 0 ? merged : undefined,
          matchedItemPaths: matchedItemPaths,
        });
      }
    } catch (e) {
      Log.debug("Error retrieving search suggestions: " + e);
    }
  }

  private async _commitContent() {
    if (this.props.onCommit && this.state && this.state.content !== undefined) {
      this.props.onCommit(this.state.content);

      this.setState({
        content: "",
      });
    }
  }

  _handleAutoCompleteSelected(index: number, item: McSelectableListItem) {
    if (this.state == null) {
      return;
    }

    const results = this.getResultsFromAutoCompleteResults();

    const id = results[index];

    if (id) {
      if (this._isToolCommandMode) {
        // In command mode, accept the suggestion at the completion prefix
        this._acceptToolCommandSuggestion(id);
      } else {
        this._handleContentChange(id, true);
      }
    }
  }

  getResultsFromAutoCompleteResults() {
    const itemResults: string[] = [];
    const termResults: string[] = [];

    for (const key in this.state.autoCompleteResults) {
      if (key !== this.state.content) {
        if (this.state.matchedItemPaths?.has(key)) {
          itemResults.push(key);
        } else {
          termResults.push(key);
        }
      }
    }

    // Project items first (sorted), then term completions (sorted)
    return [...itemResults.sort(), ...termResults.sort()];
  }

  componentDidMount() {
    initializeToolCommands();
  }

  render() {
    let interior = <></>;
    let toolbar = <></>;
    let accessoryToolbar = <></>;
    let floatBox = <></>;

    let height = "106px";
    let editorHeight = "106px";

    if (this.props.fixedHeight) {
      height = this.props.fixedHeight + "px";
      editorHeight = this.props.fixedHeight - 40 + "px";
    } else {
      height = "32px";
      editorHeight = "32px";
    }

    let cols = "1f 0px";

    if (this.props.commitButton) {
      cols = "1fr 34px";

      accessoryToolbar = (
        <div className="sceed-bottomToolBarArea">
          <Stack direction="row" spacing={1} aria-label="Search command editor actions">
            <IconButton
              size="small"
              onClick={this._commitContent}
              title="Send this function over to Minecraft"
              aria-label="Send to Minecraft"
            >
              <FontAwesomeIcon icon={faPlay} className="fa-lg" />
            </IconButton>
          </Stack>
        </div>
      );
    }

    if (this.state !== null) {
      let content = this.state.content;

      if (content === undefined) {
        content = this.props.initialContent;
      }

      const colors = getThemeColors();

      if (content && this.state.autoCompleteResults && this._isToolCommandMode) {
        const results = this.getResultsFromAutoCompleteResults();

        if (results.length > 0) {
          let left = 10;
          let top = 10;

          if (this.inputArea && this.inputArea.current) {
            // Use getBoundingClientRect for viewport-relative coordinates,
            // since the float box is portaled to document.body with position: fixed.
            const rect = this.inputArea.current.getBoundingClientRect();
            left = rect.left;
            top = rect.bottom;

            if (!this.props.displayAbove && this.state.content) {
              // In non-bottom mode, offset left by the text width for cursor-following
              const c = document.createElement("canvas");
              const ctx = c.getContext("2d");
              if (ctx) {
                ctx.font = '18px source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace';
                const txtWidth = ctx.measureText(this.state.content).width;

                left = left + txtWidth;
              }
            }
          }

          const listItems = [];
          let itemIndex = 0;
          for (const result of results) {
            const desc = this.state.commandSuggestionDescriptions?.get(result);
            const isProjectItem = this.state.matchedItemPaths?.has(result);
            const displayName = isProjectItem ? result.split("/").pop() || result : result;
            const displayPath = isProjectItem ? result : undefined;
            listItems.push({
              key: "scel" + itemIndex,
              content: (
                <div className="sceed-floatListItem" title={desc || result}>
                  {isProjectItem ? (
                    <FontAwesomeIcon icon={faFile} style={{ marginRight: 6, opacity: 0.6, fontSize: "0.8em" }} />
                  ) : (
                    <FontAwesomeIcon icon={faFont} style={{ marginRight: 6, opacity: 0.4, fontSize: "0.8em" }} />
                  )}
                  <span style={{ fontWeight: isProjectItem ? 500 : "normal" }}>{displayName}</span>
                  {displayPath && <span style={{ marginLeft: 8, opacity: 0.5, fontSize: "0.8em" }}>{displayPath}</span>}
                  {desc && <span style={{ marginLeft: 12, opacity: 0.6, fontSize: "0.85em" }}>{desc}</span>}
                </div>
              ),
            });
            itemIndex++;
          }

          if (this.props.displayAbove) {
            // Position above the input: subtract the input height and the dropdown height
            const dropdownHeight = Math.min(180, results.length * 36) + 8;
            if (this.inputArea && this.inputArea.current) {
              const rect = this.inputArea.current.getBoundingClientRect();
              top = Math.max(0, rect.top - dropdownHeight - 4);
            } else {
              top = Math.max(0, top - dropdownHeight - 4);
            }
          }

          floatBox = (
            <div
              className="sceed-floatBox"
              style={{
                left: left,
                top: top,
                backgroundColor: colors.background2,
                color: colors.foreground2,
              }}
            >
              <div className="sceed-list">
                <McSelectableList
                  items={listItems}
                  aria-label="List of suggestions"
                  onSelectedIndexChange={this._handleAutoCompleteSelected}
                  selectedIndex={this.state.selectedAutoComplete}
                />
              </div>
            </div>
          );
        }
      }

      interior = (
        <TextField
          autoComplete="off"
          fullWidth
          size="small"
          role="combobox"
          aria-expanded={!!this.state.autoCompleteResults}
          aria-autocomplete="list"
          aria-label="Search or enter command"
          style={{
            height: editorHeight,
            backgroundColor: colors.background6,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              "& fieldset": { borderColor: "#3e8828" },
              "&:hover fieldset": { borderColor: "#52a535" },
              "&.Mui-focused fieldset": { borderColor: "#52a535", borderWidth: "1px" },
              "&.Mui-focused": { outline: "none", boxShadow: "none" },
            },
            "& .MuiOutlinedInput-notchedOutline": { borderColor: "#3e8828" },
            "& .MuiInputLabel-root": { color: "var(--mc-accent-label)" },
            "& .MuiInputLabel-root.Mui-focused": { color: "var(--mc-accent-label)" },
            "& .MuiInputLabel-root[data-shrink='true']": { color: "var(--mc-accent-label)" },
            "& .MuiInputBase-root": { outline: "none", boxShadow: "none", border: "none" },
            "& .MuiInputBase-input": { outline: "none", boxShadow: "none", border: "none" },
            "& .MuiInputBase-input:focus": { outline: "none", boxShadow: "none", border: "none" },
            "& .MuiInputBase-input:focus-visible": { outline: "none", boxShadow: "none", border: "none" },
            outline: "none",
          }}
          key="sceed-forminput"
          id="sceed-forminput"
          className={this.props.isLarge ? "sceed-text-large" : "sceed-text"}
          autoFocus={true}
          label={this.props.isLarge ? "Search:" : undefined}
          placeholder={
            this.props.isLarge ? this.props.placeholder : this.props.placeholder || "Search or type / for commands..."
          }
          inputProps={{
            "aria-label": "Search or enter command",
            "aria-autocomplete": "list",
            role: "combobox",
            "aria-expanded": !!this.state.autoCompleteResults,
          }}
          defaultValue={content as string}
          value={content as string}
          onKeyDown={this._handleInputDown}
          onChange={this._handleTextInputChange}
        />
      );
    }

    return (
      <div
        className="sceed-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        {toolbar}
        <div className="sceed-input-area" style={{ gridTemplateColumns: cols }}>
          <div className="sceed-input" ref={this.inputArea}>
            {interior}
          </div>
          <div className="sceed-accessoryToolbar">{accessoryToolbar}</div>
        </div>
        {floatBox && ReactDOM.createPortal(floatBox, document.body)}
      </div>
    );
  }
}

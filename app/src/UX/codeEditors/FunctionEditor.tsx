import { Component } from "react";
import IFile from "../../storage/IFile";
import Editor from "@monaco-editor/react";
import "./FunctionEditor.css";
import * as monaco from "monaco-editor";
import IPersistable from "../types/IPersistable";
import CreatorTools, { CreatorToolsMinecraftState } from "../../app/CreatorTools";
import { Stack, IconButton } from "@mui/material";
import Log from "../../core/Log";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus, faPlay, faRemoveFormat } from "@fortawesome/free-solid-svg-icons";
import { ICommandResponseBody } from "../../minecraft/ICommandResponse";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import Project from "../../app/Project";
import {
  ensureCommandMetadataLoaded,
  registerMinecraftCommandsLanguage,
  getThemeRules,
  validateCommands,
} from "./MinecraftCommandsLanguage";
import IProjectTheme from "../types/IProjectTheme";
import type { IProjectItemEditorNavigationTarget } from "../project/ProjectItemEditor";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

interface IFunctionEditorProps extends WithLocalizationProps {
  file?: IFile;
  project?: Project;
  title?: string;
  theme: IProjectTheme;
  isCommandEditor: boolean;
  initialContent?: string;
  content?: string;
  singleCommandMode?: boolean;
  roleId?: string;
  navigationTarget?: IProjectItemEditorNavigationTarget;
  setActivePersistable?: (persistObject: IPersistable) => void;
  heightOffset?: number;
  fixedHeight?: number;
  readOnly: boolean;
  preferredTextSize: number;
  creatorTools: CreatorTools;
  onCommandTextChanged?: (newCommandText: string) => void;
  onUpdatePreferredTextSize?: (newSize: number) => void;
  onUpdateContent?: (newContent: string) => void;
}

interface IFunctionEditorState {
  fileToEdit?: IFile;
  content?: string;
}

class FunctionEditor extends Component<IFunctionEditorProps, IFunctionEditorState> {
  editor?: monaco.editor.IStandaloneCodeEditor;
  _decorationIds: string[] = [];
  _validationTimeout?: number;
  _navigationDecorations?: monaco.editor.IEditorDecorationsCollection;
  _lastNavigationRequestId?: number;

  constructor(props: IFunctionEditorProps) {
    super(props);

    this._handleContentUpdated = this._handleContentUpdated.bind(this);
    this._handleEditorWillMount = this._handleEditorWillMount.bind(this);
    this._handleEditorDidMount = this._handleEditorDidMount.bind(this);
    this._zoomIn = this._zoomIn.bind(this);
    this._zoomOut = this._zoomOut.bind(this);
    this._sendFunction = this._sendFunction.bind(this);
    this._clearRun = this._clearRun.bind(this);
    this._handleInputKey = this._handleInputKey.bind(this);

    this.state = {
      fileToEdit: props.file,
      content: props.initialContent ? props.initialContent : props.content,
    };
  }

  async componentDidMount() {
    // Pre-load command metadata for autocomplete
    await ensureCommandMetadataLoaded();
  }

  componentDidUpdate(prevProps: IFunctionEditorProps) {
    if (prevProps.navigationTarget !== this.props.navigationTarget) {
      this._applyNavigationTarget(this.props.navigationTarget);
    }
  }

  static getDerivedStateFromProps(props: IFunctionEditorProps, state: IFunctionEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
      };

      return state;
    }

    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;
      return state;
    }

    if (props.content !== undefined && props.content !== state.content) {
      state.content = props.content;
      return state;
    }
    return null; // No change to state
  }

  _handleEditorWillMount(monacoInstance: any) {
    // Register the Minecraft commands language with all providers
    registerMinecraftCommandsLanguage(monacoInstance);

    // Define a custom theme that combines our language rules with the editor styling
    let theme = "vs-dark";

    if (CreatorToolsHost.theme === CreatorToolsThemeStyle.light) {
      theme = "vs";
    }

    const colors = getThemeColors();

    monacoInstance.editor.defineTheme("mcCommandsTheme" + this.props.roleId, {
      base: theme,
      inherit: true,
      colors: {
        "editor.foreground": colors.foreground4,
        "editor.background": this.props.singleCommandMode ? "#1a1a1a" : colors.background1,
        "editorCursor.foreground": "#8B0000",
        "editor.lineHighlightBackground": this.props.singleCommandMode ? "#1a1a1a" : "#0000FF20",
        "editorLineNumber.foreground": "#008800",
        "editor.selectionBackground": "#88000030",
        "editor.inactiveSelectionBackground": "#88000015",
      },
      rules: [{ background: "EDF9FA" }, ...getThemeRules()],
    });
  }

  _handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: any) {
    this.editor = editor;

    if (this.editor === undefined) {
      return;
    }

    // Set up content change listener for validation
    const model = this.editor.getModel();
    if (model) {
      model.onDidChangeContent(() => {
        this._scheduleValidation();
      });
      // Run initial validation
      this._runValidation();
    }

    this._applyNavigationTarget(this.props.navigationTarget);
  }

  private _applyNavigationTarget(target?: IProjectItemEditorNavigationTarget) {
    if (!this.editor || !target) {
      return;
    }

    if (this._lastNavigationRequestId === target.requestId) {
      return;
    }

    this._lastNavigationRequestId = target.requestId;

    let lineNumber = target.lineNumber;
    let column = target.column ?? 1;

    if (!lineNumber && target.searchText) {
      const model = this.editor.getModel();
      if (model) {
        const matches = model.findMatches(target.searchText, false, false, false, null, true);
        if (matches.length > 0) {
          lineNumber = matches[0].range.startLineNumber;
          column = matches[0].range.startColumn;
        }
      }
    }

    if (!lineNumber) {
      return;
    }

    this.editor.revealLineInCenter(lineNumber);
    this.editor.setPosition({ lineNumber, column });
    this.editor.focus();

    if (this._navigationDecorations) {
      this._navigationDecorations.clear();
    }

    this._navigationDecorations = this.editor.createDecorationsCollection([
      {
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          className: "pie-highlight-line",
        },
      },
    ]);

    window.setTimeout(() => {
      this._navigationDecorations?.clear();
    }, 2000);
  }

  _scheduleValidation() {
    if (this._validationTimeout) {
      window.clearTimeout(this._validationTimeout);
    }
    this._validationTimeout = window.setTimeout(() => {
      this._runValidation();
    }, 500);
  }

  _runValidation() {
    if (!this.editor) return;

    const model = this.editor.getModel();
    if (!model) return;

    try {
      const markers = validateCommands(model);
      monaco.editor.setModelMarkers(model, "mcCommands", markers);
    } catch (e) {
      Log.debug("Validation error: " + e);
    }
  }

  _handleContentUpdated(newValue: string | undefined, event: any) {
    if (!newValue) {
      return;
    }

    newValue = newValue.trim();

    if (this.props.onCommandTextChanged) {
      if (!newValue.startsWith("/")) {
        this.props.onCommandTextChanged(newValue);
      }
    }

    if (this.props.onUpdateContent !== undefined) {
      this.props.onUpdateContent(newValue);
    }
  }

  async persist(): Promise<boolean> {
    let didPersist = false;

    if (this.editor !== undefined) {
      const value = this.editor.getValue();

      if (this.state.fileToEdit !== undefined) {
        if (this.state.fileToEdit.setContent(value)) {
          didPersist = true;
        }
      }

      if (this.state.content !== undefined) {
        this.setState({
          content: value,
          fileToEdit: this.state.fileToEdit,
        });
      }

      if (this.props.onUpdateContent !== undefined) {
        this.props.onUpdateContent(value);
      }
    }

    return didPersist;
  }

  _zoomIn() {
    if (this.editor) {
      let action = this.editor.getAction("editor.action.fontZoomIn");

      if (action) {
        action.run();

        this._updateZoom();
      }
    }
  }

  _zoomOut() {
    if (this.editor) {
      let action = this.editor.getAction("editor.action.fontZoomOut");

      if (action) {
        action.run();

        this._updateZoom();
      }
    }
  }

  _updateZoom() {
    if (this.editor === undefined) {
      return;
    }

    const val = this.editor.getOption(monaco.editor.EditorOptions.fontSize.id);

    if (val !== undefined) {
      if (this.props.onUpdatePreferredTextSize) {
        this.props.onUpdatePreferredTextSize(Math.round(val));
      } else {
        this.props.creatorTools.preferredTextSize = Math.round(val);
      }
    }
  }

  async _clearRun() {
    if (this.editor === undefined) {
      return;
    }

    this._decorationIds = this.editor.deltaDecorations(this._decorationIds, []);

    this.editor.updateOptions({
      glyphMargin: false,
    });
  }

  async _clearContent() {
    if (this.editor === undefined) {
      return;
    }

    this.editor.updateOptions({
      glyphMargin: false,
    });

    if (this.state.fileToEdit !== undefined) {
      this.state.fileToEdit.setContent("");
    }

    if (this.state.content !== undefined) {
      this.setState({
        content: "",
        fileToEdit: this.state.fileToEdit,
      });
    }

    this.editor.setValue("");

    if (this.props.onUpdateContent !== undefined) {
      this.props.onUpdateContent("");
    }
  }

  _handleInputKey(event: React.KeyboardEvent<Element>) {
    if (event.key === "Enter" && this.props.singleCommandMode === true) {
      this._sendFunction();
    } else if (event.ctrlKey === true && event.key === "Enter") {
      this._sendFunction();
    }
  }

  async _sendFunction() {
    if (this.editor === undefined) {
      return;
    }

    const value = this.editor.getValue();
    const commands: any[] = [];

    if (!this.props.singleCommandMode) {
      this.editor.updateOptions({
        glyphMargin: true,
      });
    }

    this._decorationIds = this.editor.deltaDecorations(this._decorationIds, []);

    const commandItems = value.split("\n");

    if (this.props.singleCommandMode) {
      this._clearContent();
    }

    for (let i = 0; i < commandItems.length; i++) {
      let command = commandItems[i].trim();

      if (command.length > 4 && !command.startsWith("#")) {
        if (!command.startsWith("/")) {
          command = "/" + command;
        }

        let className = "mcfe-glyphMarginRunningClass";

        const currentIndicator = {
          range: new monaco.Range(i + 1, 1, i + 1, 1),
          options: {
            isWholeLine: true,
            className: className,
            glyphMarginClassName: "mcfe-glyphMarginClass",
            glyphMarginHoverMessage: { value: this.props.intl.formatMessage({ id: "project_editor.func_ed.running_command" }, { command }) },
            //hoverMessage: [{ value: "hover2" }]
          },
        };

        commands.push(currentIndicator);

        this._decorationIds = this.editor.deltaDecorations(this._decorationIds, commands);

        this.props.creatorTools.notifyStatusUpdate(command);

        const result = await this.props.creatorTools.runCommand(command, this.props.project);

        let commandSuccess = false;
        let successMessage = this.props.intl.formatMessage({ id: "project_editor.func_ed.run_default" });

        if (result && result.data && typeof result.data === "string") {
          if (result.data.indexOf("{") >= 0) {
            try {
              const commandResponse: ICommandResponseBody = JSON.parse(result.data);

              if (commandResponse.statusCode === 0) {
                commandSuccess = true;
              }

              successMessage = commandResponse.statusMessage;
            } catch (e: any) {
              Log.fail(e);
            }
          }
        }

        if (commandSuccess) {
          className = "mcfe-glyphMarginSuccessClass";
        } else {
          className = "mcfe-glyphMarginFailClass";
        }

        currentIndicator.options.glyphMarginClassName = className;
        currentIndicator.options.glyphMarginHoverMessage.value = successMessage;

        this._decorationIds = this.editor.deltaDecorations(this._decorationIds, commands);
      }
    }
  }

  render() {
    let interior = <></>;

    let height = "106px";
    let editorHeight = "23px";
    let editorContainerHeight = "39px";

    if (this.props.singleCommandMode) {
      // For single command mode, use simpler height calculations
      if (this.props.fixedHeight) {
        height = this.props.fixedHeight + "px";
        editorHeight = this.props.fixedHeight + "px";
        editorContainerHeight = this.props.fixedHeight + "px";
      } else {
        height = "32px";
        editorHeight = "32px";
        editorContainerHeight = "50px";
      }
    } else if (this.props.fixedHeight) {
      height = this.props.fixedHeight + "px";
      editorHeight = this.props.fixedHeight - 90 + "px";
      editorContainerHeight = this.props.fixedHeight - 74 + "px";
    } else if (this.props.heightOffset) {
      height = "calc(100vh - " + this.props.heightOffset + "px)";
      editorHeight = "calc(100vh - " + (this.props.heightOffset + 44) + "px)";
      editorContainerHeight = "calc(100vh - " + (this.props.heightOffset + 60) + "px)";
    }

    if (this.state !== null && this.state.fileToEdit !== null) {
      let content = this.state.content;

      if (content === undefined) {
        content = this.props.initialContent;
      }

      if (
        content === undefined &&
        this.state.fileToEdit !== undefined &&
        typeof this.state.fileToEdit.content === "string"
      ) {
        content = this.state.fileToEdit.content as string;
      }

      if (content !== undefined) {
        if (this.props.setActivePersistable !== undefined) {
          this.props.setActivePersistable(this);
        }

        interior = (
          <Editor
            height={editorHeight}
            theme={"mcCommandsTheme" + this.props.roleId}
            language="mcCommands"
            options={{
              lineNumbers: "off",
              minimap: {
                enabled: false,
              },
              glyphMargin: !this.props.singleCommandMode,
              fontSize: this.props.preferredTextSize,
              readOnly: this.props.readOnly,
              // Enable fixed overflow widgets so autocomplete/hover appear above containers
              fixedOverflowWidgets: true,
              // Aggressive autocomplete settings
              quickSuggestions: {
                other: true,
                comments: false,
                strings: true,
              },
              quickSuggestionsDelay: 10,
              suggestOnTriggerCharacters: true,
              tabCompletion: "on",
              wordBasedSuggestions: "off",
              parameterHints: {
                enabled: true,
                cycle: true,
              },
              suggest: {
                filterGraceful: true,
                showIcons: true,
                insertMode: "insert",
                snippetsPreventQuickSuggestions: false,
              },
            }}
            defaultValue={content}
            value={content}
            beforeMount={this._handleEditorWillMount}
            onMount={this._handleEditorDidMount}
            onChange={this._handleContentUpdated}
          />
        );
      }
    }

    let toolBarArea = <></>;
    let accessoryToolbar = <></>;

    let contentClass = "mcfe-content";
    let functionClass = "mcfe-interior";
    let accessoryClass = "mcfe-accessoryToolBarArea";

    if (!this.props.singleCommandMode) {
      const isConnected = this.props.creatorTools.activeMinecraftState !== CreatorToolsMinecraftState.none;

      toolBarArea = (
        <div className="mcfe-toolBarArea">
          <div className="mcfe-title">
            <span>{this.props.title ? this.props.title : this.props.isCommandEditor ? this.props.intl.formatMessage({ id: "project_editor.func_ed.commands_title" }) : this.props.intl.formatMessage({ id: "project_editor.func_ed.function_title" })}</span>
          </div>
          <div className="mcfe-toolbar">
            <Stack direction="row" spacing={0.5} aria-label={this.props.intl.formatMessage({ id: "project_editor.func_ed.toolbar_aria" })}>
              <IconButton size="small" onClick={this._zoomIn} title={this.props.intl.formatMessage({ id: "project_editor.func_ed.zoom_in" })} aria-label={this.props.intl.formatMessage({ id: "project_editor.func_ed.zoom_in" })}>
                <FontAwesomeIcon icon={faSearchPlus} className="fa-sm" />
              </IconButton>
              <IconButton size="small" onClick={this._zoomOut} title={this.props.intl.formatMessage({ id: "project_editor.func_ed.zoom_out" })} aria-label={this.props.intl.formatMessage({ id: "project_editor.func_ed.zoom_out" })}>
                <FontAwesomeIcon icon={faSearchMinus} className="fa-sm" />
              </IconButton>
              {isConnected && (
                <IconButton size="small" onClick={this._clearRun} title={this.props.intl.formatMessage({ id: "project_editor.func_ed.clear_results" })} aria-label={this.props.intl.formatMessage({ id: "project_editor.func_ed.clear_results" })}>
                  <FontAwesomeIcon icon={faRemoveFormat} className="fa-sm" />
                </IconButton>
              )}
              {isConnected && (
                <IconButton
                  size="small"
                  onClick={this._sendFunction}
                  title={this.props.intl.formatMessage({ id: "project_editor.func_ed.send_commands" })}
                  aria-label={this.props.intl.formatMessage({ id: "project_editor.func_ed.send_commands" })}
                >
                  <FontAwesomeIcon icon={faPlay} className="fa-sm" />
                </IconButton>
              )}
            </Stack>
          </div>
        </div>
      );
    } else {
      contentClass = "mcfe-contentSingle";
      functionClass = "mcfe-interiorSingle";
      accessoryClass = "mcfe-accessoryToolBarAreaSingle";

      accessoryToolbar = (
        <div className={accessoryClass}>
          <div className="mcfe-accessoryToolBar">
            <Stack direction="row" spacing={0.5} aria-label={this.props.intl.formatMessage({ id: "project_editor.func_ed.addl_tools_aria" })}>
              {this.props.creatorTools.activeMinecraftState !== CreatorToolsMinecraftState.none && (
                <IconButton
                  size="small"
                  onClick={this._sendFunction}
                  title={this.props.intl.formatMessage({ id: "project_editor.func_ed.send_command" })}
                  aria-label={this.props.intl.formatMessage({ id: "project_editor.func_ed.send_command" })}
                >
                  <FontAwesomeIcon icon={faPlay} className="fa-sm" />
                </IconButton>
              )}
            </Stack>
          </div>
        </div>
      );
    }

    return (
      <div
        className="mcfe-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        {toolBarArea}
        <div className={contentClass}>
          <div
            className={functionClass}
            onKeyDown={this._handleInputKey}
            style={{
              minHeight: editorContainerHeight,
              maxHeight: editorContainerHeight,
              backgroundColor:
                CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "#000000" : getThemeColors().background1,
            }}
          >
            {interior}
          </div>
          {accessoryToolbar}
        </div>
      </div>
    );
  }
}

export default withLocalization(FunctionEditor);

import { Component } from "react";
import IFile from "./../storage/IFile";
import Editor from "@monaco-editor/react";
import "./FunctionEditor.css";
import * as monaco from "monaco-editor";
import IPersistable from "./IPersistable";
import Carto, { CartoMinecraftState } from "../app/Carto";
import { ThemeInput, Toolbar } from "@fluentui/react-northstar";
import Log from "./../core/Log";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus, faPlay, faRemoveFormat } from "@fortawesome/free-solid-svg-icons";
import { ICommandResponseBody } from "../minecraft/ICommandResponse";
import CartoApp, { CartoThemeStyle } from "../app/CartoApp";
import Project from "../app/Project";

interface IFunctionEditorProps {
  file?: IFile;
  project?: Project;
  title?: string;
  theme: ThemeInput<any>;
  isCommandEditor: boolean;
  initialContent?: string;
  content?: string;
  singleCommandMode?: boolean;
  roleId?: string;
  setActivePersistable?: (persistObject: IPersistable) => void;
  heightOffset?: number;
  fixedHeight?: number;
  readOnly: boolean;
  preferredTextSize: number;
  carto: Carto;
  onCommandTextChanged?: (newCommandText: string) => void;
  onUpdatePreferredTextSize?: (newSize: number) => void;
  onUpdateContent?: (newContent: string) => void;
}

interface IFunctionEditorState {
  fileToEdit?: IFile;
  content?: string;
}

export default class FunctionEditor extends Component<IFunctionEditorProps, IFunctionEditorState> {
  editor?: monaco.editor.IStandaloneCodeEditor;
  _decorationIds: string[] = [];

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

  _handleEditorWillMount(monaco: any) {
    // Register a new language
    monaco.languages.register({ id: "mcCommands" });

    // Register a tokens provider for the language
    monaco.languages.setMonarchTokensProvider("mcCommands", {
      tokenizer: {
        root: [
          [/\[error.*/, "custom-error"],
          [/\[notice.*/, "custom-notice"],
          [/\[info.*/, "custom-info"],
          [/\[[a-zA-Z 0-9:]+\]/, "custom-date"],
        ],
      },
    });

    // Define a new theme that contains only rules that match this language

    let theme = "vs-dark";

    if (CartoApp.theme === CartoThemeStyle.light) {
      theme = "vs";
    }

    monaco.editor.defineTheme("mcCommandsTheme" + this.props.roleId, {
      base: theme,
      inherit: true,
      colors: {
        "editor.foreground": this.props.theme.siteVariables?.colorScheme.brand.foreground4,
        "editor.background": this.props.singleCommandMode
          ? "#000000"
          : this.props.theme.siteVariables?.colorScheme.brand.background1,
        "editorCursor.foreground": "#8B0000",
        "editor.lineHighlightBackground": "#0000FF20",
        "editorLineNumber.foreground": "#008800",
        "editor.selectionBackground": "#88000030",
        "editor.inactiveSelectionBackground": "#88000015",
      },
      rules: [
        { background: "EDF9FA" },
        { token: "custom-info", foreground: "FFFFFF" },
        { token: "custom-error", foreground: "ff11FF", fontStyle: "bold" },
        { token: "custom-notice", foreground: "FFA500" },
        { token: "custom-date", foreground: "FF88FF" },
      ],
    });

    // Register a completion item provider for the new language
    monaco.languages.registerCompletionItemProvider("mcCommands", {
      provideCompletionItems: this._provideCompletionItems,
    });
  }

  _provideCompletionItems(document: any, position: any, token: any, context: any) {
    const suggestions = [
      {
        label: "simpleText",
        kind: monaco.languages.CompletionItemKind.Text,
        insertText: "simpleText",
      },
      {
        label: "testing",
        kind: monaco.languages.CompletionItemKind.Keyword,
        // eslint-disable-next-line
        insertText: "testing(${1:condition})",
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      },
      {
        label: "ifelse",
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: [
          // eslint-disable-next-line
          "if (${1:condition}) {",
          "\t$0",
          "} else {",
          "\t",
          "}",
        ].join("\n"),
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: "If-Else Statement",
      },
    ];

    return { suggestions: suggestions };
  }

  _handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: any) {
    this.editor = editor;

    if (this.editor === undefined) {
      return;
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
  }

  async persist() {
    if (this.editor !== undefined) {
      const value = this.editor.getValue();

      if (this.state.fileToEdit !== undefined) {
        this.state.fileToEdit.setContent(value);
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
        this.props.carto.preferredTextSize = Math.round(val);
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
            glyphMarginHoverMessage: { value: "Running command '" + command + "'" },
            //hoverMessage: [{ value: "hover2" }]
          },
        };

        commands.push(currentIndicator);

        this._decorationIds = this.editor.deltaDecorations(this._decorationIds, commands);

        this.props.carto.notifyStatusUpdate(command);

        const result = await this.props.carto.runCommand(command, this.props.project);

        let commandSuccess = false;
        let successMessage = "Run.";

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

    if (this.props.fixedHeight) {
      height = this.props.fixedHeight + "px";
      editorHeight = this.props.fixedHeight - 90 + "px";
    } else if (this.props.singleCommandMode) {
      height = "32px";
      editorHeight = "32px";
    } else if (this.props.heightOffset) {
      height = "calc(100vh - " + this.props.heightOffset + "px)";
      editorHeight = "calc(100vh - " + (this.props.heightOffset + 44) + "px)";
    }

    const toolbarItems = [
      {
        icon: <FontAwesomeIcon icon={faSearchPlus} className="fa-lg" />,
        key: "zoomIn",
        onClick: this._zoomIn,
        title: "Toggle whether supporting files are shown",
      },
      {
        icon: <FontAwesomeIcon icon={faSearchMinus} className="fa-lg" />,
        key: "zoomOut",
        onClick: this._zoomOut,
        title: "Toggle whether supporting files are shown",
      },
    ];

    const bottomToolbarItems = [];

    if (this.props.carto.activeMinecraftState !== CartoMinecraftState.none) {
      if (!this.props.singleCommandMode) {
        bottomToolbarItems.push({
          icon: <FontAwesomeIcon icon={faRemoveFormat} className="fa-lg" />,
          key: "clear",
          onClick: this._clearRun,
          title: "Clear results",
        });
      }
      bottomToolbarItems.push({
        icon: <FontAwesomeIcon icon={faPlay} className="fa-lg" />,
        key: "run",
        onClick: this._sendFunction,
        title: "Send this function over to Minecraft",
      });
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
      toolBarArea = (
        <div className="mcfe-toolBarArea">
          <div className="mcfe-title">
            <span>{this.props.title ? this.props.title : this.props.isCommandEditor ? "Commands" : "Function"}</span>
          </div>
          <div className="mcfe-toolbar">
            <Toolbar aria-label="Function editor toolbar" items={toolbarItems} />
          </div>
        </div>
      );
    } else {
      contentClass = "mcfe-contentSingle";
      functionClass = "mcfe-interiorSingle";
      accessoryClass = "mcfe-accessoryToolBarAreaSingle";
    }

    accessoryToolbar = (
      <div className={accessoryClass}>
        <div className="mcfe-accessoryToolBar">
          <Toolbar aria-label="Function editor additional tools" items={bottomToolbarItems} />
        </div>
      </div>
    );

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
              minHeight: editorHeight,
              maxHeight: editorHeight,
              backgroundColor:
                CartoApp.theme === CartoThemeStyle.dark
                  ? "#000000"
                  : this.props.theme.siteVariables?.colorScheme.brand.background1,
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

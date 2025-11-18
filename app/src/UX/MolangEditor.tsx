import { Component } from "react";
import IFile from "./../storage/IFile";
import Editor from "@monaco-editor/react";
import "./MolangEditor.css";
import * as monaco from "monaco-editor";
import IPersistable from "./IPersistable";
import CreatorTools from "../app/CreatorTools";
import { ThemeInput, Toolbar } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus } from "@fortawesome/free-solid-svg-icons";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../app/CreatorToolsHost";
import Project from "../app/Project";

interface IMolangEditorProps {
  file?: IFile;
  project?: Project;
  title?: string;
  theme: ThemeInput<any>;
  initialContent?: string;
  roleId?: string;
  setActivePersistable?: (persistObject: IPersistable) => void;
  heightOffset?: number;
  fixedHeight?: number;
  readOnly: boolean;
  preferredTextSize: number;
  creatorTools: CreatorTools;
  onMolangTextChanged?: (newCommandText: string) => void;
  onUpdatePreferredTextSize?: (newSize: number) => void;
  onUpdateContent?: (newContent: string) => void;
}

interface IMolangEditorState {
  fileToEdit?: IFile;
  content?: string;
}

export default class MolangEditor extends Component<IMolangEditorProps, IMolangEditorState> {
  editor?: monaco.editor.IStandaloneCodeEditor;
  _decorationIds: string[] = [];

  constructor(props: IMolangEditorProps) {
    super(props);

    this._handleContentUpdated = this._handleContentUpdated.bind(this);
    this._handleEditorWillMount = this._handleEditorWillMount.bind(this);
    this._handleEditorDidMount = this._handleEditorDidMount.bind(this);
    this._zoomIn = this._zoomIn.bind(this);
    this._zoomOut = this._zoomOut.bind(this);
    this._clearRun = this._clearRun.bind(this);

    this.state = {
      fileToEdit: props.file,
      content: props.initialContent,
    };
  }

  static getDerivedStateFromProps(props: IMolangEditorProps, state: IMolangEditorState) {
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

    if (CreatorToolsHost.theme === CreatorToolsThemeStyle.light) {
      theme = "vs";
    }

    monaco.editor.defineTheme("mcCommandsTheme" + this.props.roleId, {
      base: theme,
      inherit: true,
      colors: {
        "editor.foreground": this.props.theme.siteVariables?.colorScheme.brand.foreground4,
        "editor.background": this.props.theme.siteVariables?.colorScheme.brand.background1,
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

    if (this.props.onMolangTextChanged) {
      if (!newValue.startsWith("/")) {
        this.props.onMolangTextChanged(newValue);
      }
    }
  }

  async persist(): Promise<boolean> {
    let didPersist = false;
    if (this.editor !== undefined) {
      const value = this.editor.getValue();

      if (this.state.fileToEdit !== undefined) {
        didPersist = this.state.fileToEdit.setContent(value);
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

  render() {
    let interior = <></>;

    let height = "96px";
    let editorHeight = "33px";

    if (this.props.fixedHeight) {
      height = this.props.fixedHeight + "px";
      editorHeight = this.props.fixedHeight - 90 + "px";
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
              glyphMargin: true,
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

    let contentClass = "mcme-content";
    let molangClass = "mcme-interior";

    toolBarArea = (
      <div className="mcme-toolBarArea">
        <div className="mcme-title">
          <span>Molang Expression</span>
        </div>
        <div className="mcme-toolbar">
          <Toolbar aria-label="Molang editor actions" items={toolbarItems} />
        </div>
      </div>
    );

    return (
      <div
        className="mcme-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        {toolBarArea}
        <div className={contentClass}>
          <div
            className={molangClass}
            style={{
              minHeight: editorHeight,
              maxHeight: editorHeight,
              backgroundColor:
                CreatorToolsHost.theme === CreatorToolsThemeStyle.dark
                  ? "#000000"
                  : this.props.theme.siteVariables?.colorScheme.brand.background1,
            }}
          >
            {interior}
          </div>
        </div>
      </div>
    );
  }
}

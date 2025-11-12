import { Component } from "react";
import IFile from "./../storage/IFile";
import Editor, { DiffEditor } from "@monaco-editor/react";
import "./JsonEditor.css";
import * as monaco from "monaco-editor";
import { ThemeInput, Toolbar } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus } from "@fortawesome/free-solid-svg-icons";
import ProjectItem from "../app/ProjectItem";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "../minecraft/Database";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../app/CreatorToolsHost";
import Project from "../app/Project";
import { constants } from "../core/Constants";
import IPersistable from "./IPersistable";

interface IJsonEditorProps {
  heightOffset: number;
  readOnly: boolean;
  project: Project;
  isDiffEditor?: boolean;
  content?: string;
  theme: ThemeInput<any>;
  preferredTextSize: number;
  item?: ProjectItem;
  diffFile?: IFile;
  file?: IFile;
  setActivePersistable?: (persistObject: IPersistable) => void;
  onUpdatePreferredTextSize?: (newSize: number) => void;
}

interface IJsonEditorState {
  fileToEdit?: IFile;
  content?: string;
  isLoaded: boolean;
}

export default class JsonEditor extends Component<IJsonEditorProps, IJsonEditorState> {
  editor?: monaco.editor.IStandaloneCodeEditor;
  diffEditor?: monaco.editor.IDiffEditor;
  _needsPersistence: boolean = false;
  _monaco: any;

  constructor(props: IJsonEditorProps) {
    super(props);

    this._handleContentUpdated = this._handleContentUpdated.bind(this);
    this._handleEditorWillMount = this._handleEditorWillMount.bind(this);
    this._handleEditorDidMount = this._handleEditorDidMount.bind(this);
    this._handleDiffEditorDidMount = this._handleDiffEditorDidMount.bind(this);
    this._considerFormat = this._considerFormat.bind(this);
    this._zoomIn = this._zoomIn.bind(this);
    this._zoomOut = this._zoomOut.bind(this);
    this.persist = this.persist.bind(this);

    this.state = {
      fileToEdit: undefined,
      content: props.content,
      isLoaded: false,
    };
  }

  static getDerivedStateFromProps(props: IJsonEditorProps, state: IJsonEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        content: props.content,
        isLoaded: false,
      };

      return state;
    }
    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;
      state.isLoaded = false;
      return state;
    }

    return null; // No change to state
  }

  _handleEditorWillMount(monacoInstance: any) {
    // const models = monacoInstance.editor.getModels();
    this._ensureModels(monacoInstance);
  }

  static getUriForFile(file: IFile) {
    let baseUri = "file:/" + StorageUtilities.ensureStartsWithDelimiter(file.storageRelativePath);

    // if we encode baseUri, the JSON model lookup doesn't seem to work for paths with spaces
    // encode with __ instead.
    baseUri = baseUri.replace(/ /gi, "__");

    baseUri = baseUri.toLowerCase();

    return baseUri;
  }

  async _ensureModels(monacoInstance: any) {
    if (this.props.file) {
      await this._ensureModelForFile(monacoInstance, this.props.file);
    }

    if (this.props.diffFile) {
      await this._ensureModelForFile(monacoInstance, this.props.diffFile);
    }

    if (this.state !== undefined && !this.state.isLoaded) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        content: this.state.content,
        isLoaded: true,
      });
    }

    window.setTimeout(this._considerFormat, 5);

    this._monaco = monacoInstance;
  }

  async _ensureModelForFile(monacoInstance: any, file: IFile) {
    const baseUri = JsonEditor.getUriForFile(file);
    let lang = "json";
    let content = "";

    if (!file.isContentLoaded) {
      await file.loadContent();
    }

    if (file.content !== undefined && typeof file.content === "string") {
      const modelUri = monacoInstance.Uri.parse(baseUri);

      let model = monacoInstance.editor.getModel(modelUri);

      if (model === null || model === undefined) {
        content = file.content as string;

        model = monacoInstance.editor.createModel(content, lang, modelUri);
      } else {
        let existingContent = model.getValue();
        if (existingContent.trim() !== file.content.trim()) {
          model.setValue(file.content as string);
        }
      }

      if (this.props.item) {
        const schemaPath = this.props.item.getSchemaPath();

        if (schemaPath !== undefined) {
          const schemaContent = await Database.getSchema(schemaPath);

          const modelUriToStr = modelUri.toString();

          if (schemaContent) {
            const jsonlang = monacoInstance.languages.json;
            const schemaUri = constants.homeUrl + "/res/latest/schemas/" + schemaPath;

            jsonlang.jsonDefaults.setDiagnosticsOptions({
              validate: true,
              enableSchemaRequest: false,
              allowComments: true,
              schemas: [
                {
                  uri: schemaUri,
                  fileMatch: [modelUriToStr],
                  schema: schemaContent,
                },
              ],
            });
          }
        }
      }
    }
  }

  _handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: any) {
    this.editor = editor;
  }

  _handleDiffEditorDidMount(editor: monaco.editor.IDiffEditor, monaco: any) {
    this.diffEditor = editor;
  }

  componentDidUpdate(prevProps: IJsonEditorProps, prevState: IJsonEditorState) {
    if (this._monaco) {
      this._ensureModels(this._monaco);
    }
  }

  async _considerFormat() {
    if (this.editor && this.props.project && this.props.project.creatorTools.formatBeforeSave) {
      const action = this.editor.getAction("editor.action.formatDocument");

      if (action) {
        await action.run();
      }
    }
  }

  _handleContentUpdated(newValue: string | undefined, event: any) {
    this._needsPersistence = true;

    if (this.editor !== undefined && this.state.fileToEdit && !this.props.readOnly && newValue) {
      this.state.fileToEdit.setContent(newValue);
    }
  }

  async persist(): Promise<boolean> {
    if (this.editor !== undefined && this.state.fileToEdit && !this.props.readOnly && this._needsPersistence) {
      this._needsPersistence = false;

      await this._considerFormat();

      const value = this.editor.getValue();

      if (value.length > 0 || !this.state.fileToEdit.content || this.state.fileToEdit.content.length < 1) {
        this.state.fileToEdit.setContent(value);
        return true;
      }
    }

    return false;
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

    if (val !== undefined && this.props.onUpdatePreferredTextSize) {
      this.props.onUpdatePreferredTextSize(Math.round(val));
    }
  }

  render() {
    let interior = <></>;

    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const editorHeight = "calc(100vh - " + (this.props.heightOffset + 30) + "px)";

    let toolbarItems: any[] = [];

    let coreUri = undefined;
    let diffUri = undefined;
    if (this.state.isLoaded && this.state.fileToEdit) {
      coreUri = JsonEditor.getUriForFile(this.state.fileToEdit);

      if (this.props.diffFile) {
        diffUri = JsonEditor.getUriForFile(this.props.diffFile);
      }
    }

    if (
      this.state !== null &&
      (this.state.content || (this.state.fileToEdit && this.state.fileToEdit.content !== null))
    ) {
      if (this.props.setActivePersistable !== undefined) {
        this.props.setActivePersistable(this);
      }

      let theme = "vs-dark";

      if (CreatorToolsHost.theme === CreatorToolsThemeStyle.light) {
        theme = "vs";
      }

      if (
        this.props.isDiffEditor &&
        this.state.fileToEdit &&
        this.state.fileToEdit.content &&
        this.props.diffFile?.content &&
        typeof this.state.fileToEdit.content === "string" &&
        typeof this.props.diffFile?.content === "string"
      ) {
        // diff editor doesn't seem to update its diffs in response to different URI switches properly,
        // so we set the content explicitly instead
        // originalModelPath={coreUri}
        // modifiedModelPath={diffUri}

        interior = (
          <div>
            <div className="jse-dffEditorHeader">
              <div className="jse-coreLabel">{coreUri}</div>
              <div className="jse-diffLabel">{diffUri}</div>
            </div>
            <div>
              <DiffEditor
                height={editorHeight}
                theme={theme}
                originalLanguage="json"
                modifiedLanguage="json"
                original={this.state.fileToEdit.content}
                modified={this.props.diffFile.content}
                options={{
                  fontSize: this.props.preferredTextSize,
                  readOnly: this.props.readOnly,
                  renderSideBySide: true,
                  automaticLayout: true,
                  originalEditable: false,
                  renderValidationDecorations: this.props.readOnly ? "on" : "editable",
                }}
                beforeMount={this._handleEditorWillMount}
                onMount={this._handleDiffEditorDidMount}
              />
            </div>
          </div>
        );
      } else {
        toolbarItems = [
          {
            icon: <FontAwesomeIcon icon={faSearchPlus} className="fa-lg" />,
            key: "zoomIn",
            onClick: this._zoomIn,
            title: "Toggle whether hidden items are shown",
          },
          {
            icon: <FontAwesomeIcon icon={faSearchMinus} className="fa-lg" />,
            key: "zoomOut",
            onClick: this._zoomOut,
            title: "Toggle whether hidden items are shown",
          },
        ];

        if (this.state.fileToEdit) {
          interior = (
            <Editor
              height={editorHeight}
              theme={theme}
              defaultLanguage="json"
              options={{
                fontSize: this.props.preferredTextSize,
                readOnly: this.props.readOnly,
                renderValidationDecorations: this.props.readOnly ? "on" : "editable",
              }}
              path={coreUri}
              beforeMount={this._handleEditorWillMount}
              onMount={this._handleEditorDidMount}
              onChange={this._handleContentUpdated}
            />
          );
        } else if (this.state.content) {
          interior = (
            <Editor
              height={editorHeight}
              theme={theme}
              defaultLanguage="json"
              options={{
                fontSize: this.props.preferredTextSize,
                readOnly: this.props.readOnly,
                renderValidationDecorations: this.props.readOnly ? "on" : "editable",
              }}
              value={this.state.content}
              beforeMount={this._handleEditorWillMount}
              onMount={this._handleEditorDidMount}
              onChange={this._handleContentUpdated}
            />
          );
        }
      }
    }

    return (
      <div
        className="jse-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="jse-toolBar">
          <Toolbar aria-label="JSON editor toolbar" items={toolbarItems} />
        </div>
        {interior}
      </div>
    );
  }
}

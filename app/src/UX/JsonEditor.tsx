import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "./../storage/IFile";
import Editor from "@monaco-editor/react";
import "./JsonEditor.css";
import * as monaco from "monaco-editor";
import { ThemeInput, Toolbar } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus } from "@fortawesome/free-solid-svg-icons";
import ProjectItem from "../app/ProjectItem";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "../minecraft/Database";
import CartoApp, { CartoThemeStyle } from "../app/CartoApp";
import Project from "../app/Project";
import { constants } from "../core/Constants";

interface IJsonEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  project: Project;
  theme: ThemeInput<any>;
  preferredTextSize: number;
  item: ProjectItem;
  onUpdatePreferredTextSize: (newSize: number) => void;
}

interface IJsonEditorState {
  fileToEdit?: IFile;
  isLoaded: boolean;
}

export default class JsonEditor extends Component<IJsonEditorProps, IJsonEditorState> {
  editor?: monaco.editor.IStandaloneCodeEditor;
  _needsPersistence: boolean = false;
  _monaco: any;

  constructor(props: IJsonEditorProps) {
    super(props);

    this._handleContentUpdated = this._handleContentUpdated.bind(this);
    this._handleEditorWillMount = this._handleEditorWillMount.bind(this);
    this._handleEditorDidMount = this._handleEditorDidMount.bind(this);
    this._considerFormat = this._considerFormat.bind(this);
    this._zoomIn = this._zoomIn.bind(this);
    this._zoomOut = this._zoomOut.bind(this);
    this.persist = this.persist.bind(this);

    this.state = {
      fileToEdit: undefined,
      isLoaded: false,
    };
  }

  static getDerivedStateFromProps(props: IJsonEditorProps, state: IJsonEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
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
    await this._ensureModelForFile(monacoInstance, this.props.file);

    if (this.state !== undefined && !this.state.isLoaded) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
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

    await file.loadContent();

    if (file.content !== undefined && typeof file.content === "string") {
      const modelUri = monacoInstance.Uri.parse(baseUri);

      let model = monacoInstance.editor.getModel(modelUri);

      if (model === null || model === undefined) {
        content = file.content as string;

        model = monacoInstance.editor.createModel(content, lang, modelUri);
      }

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

  _handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: any) {
    this.editor = editor;

    if (this.editor === undefined) {
      return;
    }
  }

  componentDidUpdate(prevProps: IJsonEditorProps, prevState: IJsonEditorState) {
    if (this._monaco) {
      this._ensureModels(this._monaco);
    }
  }

  async _considerFormat() {
    if (this.editor && this.props.project && this.props.project.carto.formatBeforeSave) {
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

  async persist() {
    if (this.editor !== undefined && this.state.fileToEdit && !this.props.readOnly && this._needsPersistence) {
      this._needsPersistence = false;

      await this._considerFormat();

      const value = this.editor.getValue();

      if (value.length > 0 || !this.state.fileToEdit.content || this.state.fileToEdit.content.length < 1) {
        this.state.fileToEdit.setContent(value);
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
      this.props.onUpdatePreferredTextSize(Math.round(val));
    }
  }

  render() {
    let interior = <></>;

    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const editorHeight = "calc(100vh - " + (this.props.heightOffset + 30) + "px)";

    const toolbarItems = [
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

    let coreUri = undefined;

    if (this.state.isLoaded) {
      coreUri = JsonEditor.getUriForFile(this.props.file);
    }

    if (this.state !== null && this.state.fileToEdit !== null) {
      if (this.state.fileToEdit && this.state.fileToEdit.content !== null) {
        if (this.props.setActivePersistable !== undefined) {
          this.props.setActivePersistable(this);
        }

        let theme = "vs-dark";

        if (CartoApp.theme === CartoThemeStyle.light) {
          theme = "vs";
        }

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

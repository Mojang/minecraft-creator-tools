import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "./../storage/IFile";
import Editor from "@monaco-editor/react";
import "./JsonEditor.css";
import * as monaco from "monaco-editor";
import IPersistable from "./IPersistable";
import { ThemeInput, Toolbar } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus } from "@fortawesome/free-solid-svg-icons";
import ProjectItem from "../app/ProjectItem";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "../minecraft/Database";
import CartoApp, { CartoThemeStyle } from "../app/CartoApp";
import { constants } from "../core/Constants";

interface IJsonEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  theme: ThemeInput<any>;

  preferredTextSize: number;
  item: ProjectItem;
  onUpdatePreferredTextSize: (newSize: number) => void;
}

interface IJsonEditorState {
  fileToEdit?: IFile;
  isLoaded: boolean;
}

export default class JsonEditor extends Component<IJsonEditorProps, IJsonEditorState> implements IPersistable {
  editor?: monaco.editor.IStandaloneCodeEditor;
  _needsPersistence: boolean = false;
  _monaco: any;

  constructor(props: IJsonEditorProps) {
    super(props);

    this._handleContentUpdated = this._handleContentUpdated.bind(this);
    this._handleEditorWillMount = this._handleEditorWillMount.bind(this);
    this._handleEditorDidMount = this._handleEditorDidMount.bind(this);
    this.zoomIn = this.zoomIn.bind(this);
    this.zoomOut = this.zoomOut.bind(this);
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

        const schemaPath = this.props.item.getSchemaPath();

        if (schemaPath !== undefined) {
          const schemaContent = await Database.getSchema(schemaPath);

          const modelUriToStr = modelUri.toString();

          if (schemaContent) {
            const jsonlang = monacoInstance.languages.json;

            jsonlang.jsonDefaults.setDiagnosticsOptions({
              validate: true,
              schemaValidation: "warning",
              enableSchemaRequest: false,
              schemas: [
                {
                  uri: constants.homeUrl + "/res/latest/schemas/" + schemaPath,
                  fileMatch: [modelUriToStr],
                  schema: schemaContent,
                },
              ],
            });
          }
        }

        model = monacoInstance.editor.createModel(content, lang, modelUri);
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

  _handleContentUpdated(newValue: string | undefined, event: any) {
    this._needsPersistence = true;

    window.setTimeout(this.persist, 400);
  }

  async persist() {
    if (this.editor !== undefined && this.state.fileToEdit) {
      this._needsPersistence = false;

      const value = this.editor.getValue();

      this.state.fileToEdit.setContent(value);
    }
  }

  zoomIn() {
    this.editor?.getAction("editor.action.fontZoomIn").run();

    this._updateZoom();
  }

  zoomOut() {
    this.editor?.getAction("editor.action.fontZoomOut").run();

    this._updateZoom();
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
        onClick: this.zoomIn,
        title: "Toggle whether hidden items are shown",
      },
      {
        icon: <FontAwesomeIcon icon={faSearchMinus} className="fa-lg" />,
        key: "zoomOut",
        onClick: this.zoomOut,
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
          <Toolbar aria-label="Editor toolbar overflow menu" items={toolbarItems} />
        </div>
        {interior}
      </div>
    );
  }
}

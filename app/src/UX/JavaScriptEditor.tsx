import React, { Component, SyntheticEvent } from "react";
import Project from "./../app/Project";
import IFile from "./../storage/IFile";
import IStorage from "./../storage/IStorage";
import Editor from "@monaco-editor/react";
import "./JavaScriptEditor.css";
import * as monaco from "monaco-editor";
import IPersistable from "./IPersistable";
import Log from "./../core/Log";
import { Toolbar, DropdownProps, ThemeInput, FormInput, InputProps } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus } from "@fortawesome/free-solid-svg-icons";
import { ProjectScriptLanguage, ProjectScriptVersion } from "../app/IProjectData";
import ProjectContent from "../app/ProjectContent";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import Database from "../minecraft/Database";
import ISnippet from "../app/ISnippet";
import CartoApp, { CartoThemeStyle } from "../app/CartoApp";
import ITypeDefCatalog from "../minecraft/ITypeDefCatalog";
import IAppProps from "./IAppProps";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import ProjectUtilities from "../app/ProjectUtilities";
import ItemGallery, { GalleryItemCommand } from "./ItemGallery";
import { ItemTileButtonDisplayMode } from "./ItemTileButton";

export enum ScriptEditorRole {
  script = 0,
  gameTest = 1,
}

interface IJavaScriptEditorProps extends IAppProps {
  heightOffset: number;
  project?: Project;
  theme: ThemeInput<any>;
  file?: IFile;
  initialContent?: string;
  setActivePersistable?: (persistObject: IPersistable) => void;
  onUpdateContent?: (newContent: string) => void;

  scriptLanguage: ProjectScriptLanguage;
  readOnly: boolean;
  preferredTextSize: number;
  role: ScriptEditorRole;
  onUpdatePreferredTextSize: (newSize: number) => void;
}

interface IJavaScriptEditorState {
  pathToEdit: string;
  isLoaded: boolean;
  snippetSearch?: string;
}

export default class JavaScriptEditor extends Component<IJavaScriptEditorProps, IJavaScriptEditorState> {
  editor?: monaco.editor.IStandaloneCodeEditor;
  _activeModel: any; // think of "model" as a file.
  _monaco: any;
  _trackingUpdates: boolean = false;
  _scriptsFolder?: IFolder;
  _modelReloadPending: boolean = false;

  constructor(props: IJavaScriptEditorProps) {
    super(props);

    this._handleContentUpdated = this._handleContentUpdated.bind(this);
    this._handleEditorWillMount = this._handleEditorWillMount.bind(this);
    this._handleEditorDidMount = this._handleEditorDidMount.bind(this);
    this._handleFileStateChanged = this._handleFileStateChanged.bind(this);
    this._handleFileStateRemoved = this._handleFileStateRemoved.bind(this);
    this._handleSnippetGalleryCommand = this._handleSnippetGalleryCommand.bind(this);
    this._handleNewSearch = this._handleNewSearch.bind(this);
    this._handleSnippet = this._handleSnippet.bind(this);
    this._updateModels = this._updateModels.bind(this);
    this._doUpdate = this._doUpdate.bind(this);
    this.persist = this.persist.bind(this);
    this._considerFormat = this._considerFormat.bind(this);

    this._zoomIn = this._zoomIn.bind(this);
    this._zoomOut = this._zoomOut.bind(this);

    let curPath = "";

    if (props.file !== undefined) {
      curPath = JavaScriptEditor.getUriForFile(props.file, props.scriptLanguage);
    }

    this.state = {
      pathToEdit: curPath,
      isLoaded: false,
    };
  }

  _handleNewSearch(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state) {
      return;
    }

    const newSearch = data.value;

    this.setState({
      pathToEdit: this.state.pathToEdit,
      isLoaded: this.state.isLoaded,
      snippetSearch: newSearch,
    });
  }

  static getDerivedStateFromProps(props: IJavaScriptEditorProps, state: IJavaScriptEditorState) {
    if (props.file) {
      const curPath = JavaScriptEditor.getUriForFile(props.file, props.scriptLanguage);

      if (state === undefined || state === null) {
        state = {
          pathToEdit: curPath,
          isLoaded: false,
        };

        return state;
      }
      if (curPath !== state.pathToEdit) {
        state.pathToEdit = curPath;

        return state;
      }
    }

    return null; // No change to state
  }

  _handleEditorWillMount(monacoInstance: any) {
    if (this._monaco !== monacoInstance) {
      this._monaco = monacoInstance;
      const tslang = this._monaco.languages.typescript;

      tslang.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      tslang.javascriptDefaults.setCompilerOptions({
        target: tslang.ScriptTarget.ESNext,
        module: tslang.ModuleKind.ESNext,
        lib: ["es2020"],
        allowNonTsExtensions: true,
      });

      tslang.typescriptDefaults.setCompilerOptions({
        lib: ["es2020"],
        allowJs: true,
        target: 99,
        allowNonTsExtensions: true,
        noImplicitAny: true,
      });
    }

    this._injectLibModels();

    this._ensureModels(monacoInstance);
  }

  _injectLibModels() {
    if (!this._monaco) {
      return;
    }

    const tslang = this._monaco.languages.typescript;

    if (tslang && tslang.typescriptDefaults) {
      const extraLibs = tslang.typescriptDefaults.getExtraLibs();
      let hasBuiltInModels = false;
      let hasLibraries = false;

      for (const libName in extraLibs) {
        if (libName === "@minecraft/server.d.ts") {
          hasBuiltInModels = true;
        }

        if (libName === "@minecraft/math.d.ts") {
          hasLibraries = true;
        }
      }

      if (!hasBuiltInModels) {
        let typeDefs: ITypeDefCatalog | null = null;

        if (this.props.project && this.props.project.scriptVersion === ProjectScriptVersion.stable10) {
          typeDefs = Database.stableTypeDefs;
        } else {
          typeDefs = Database.betaTypeDefs;
        }

        let globalUri = encodeURI("file://fs/global.d.ts");

        const globalContent =
          "interface GlobalConsole { warn: (message: string) => void; log: (message: string) => void;}; declare var console: GlobalConsole; ";
        tslang.javascriptDefaults.addExtraLib(globalContent, globalUri);
        tslang.typescriptDefaults.addExtraLib(globalContent, globalUri);

        if (typeDefs) {
          for (let i = 0; i < typeDefs.typeDefs.length; i++) {
            const td = typeDefs.typeDefs[i];

            const uri = td.name + ".d.ts";

            let content = td.content.join("\n");

            content = "declare module '" + td.name + "' {" + content + "}";

            tslang.javascriptDefaults.addExtraLib(content, uri);
            tslang.typescriptDefaults.addExtraLib(content, uri);
          }
        }
      }

      if (!hasLibraries) {
        const tslang = this._monaco.languages.typescript;
        const libs = Database.libs;

        if (libs) {
          for (let i = 0; i < libs.typeDefs.length; i++) {
            const td = libs.typeDefs[i];

            const namespaceName = td.name;

            if (namespaceName.length > 0) {
              let content = td.content.join("\n");
              const uri = namespaceName + ".d.ts";

              content = "declare module '" + namespaceName + "' {" + content + "}";

              tslang.javascriptDefaults.addExtraLib(content, uri);
              tslang.typescriptDefaults.addExtraLib(content, uri);
            }
          }
        }
      }
    }
  }

  componentWillUnmount() {
    if (this._scriptsFolder) {
      this._trackingUpdates = false;

      this._scriptsFolder.storage.onFileAdded.unsubscribe(this._handleFileStateChanged);
      this._scriptsFolder.storage.onFileRemoved.unsubscribe(this._handleFileStateRemoved);
    }
  }

  async _ensureModels(monacoInstance: any) {
    let typeDefs: ITypeDefCatalog | null = null;

    if (this.props.project && this.props.project.scriptVersion === ProjectScriptVersion.stable10) {
      await Database.loadStableScriptTypes();
      typeDefs = Database.stableTypeDefs;
    } else {
      await Database.loadBetaScriptTypes();
      typeDefs = Database.betaTypeDefs;
    }

    await this._doUpdate();
    const libs = await Database.getLibs();

    if (!typeDefs || !libs) {
      return;
    }

    if (this.props.project) {
      const mainScriptsFolder = await this.props.project.getMainScriptsFolder();
      let scriptsFolder = undefined;

      if (mainScriptsFolder) {
        scriptsFolder = mainScriptsFolder;
      } else {
        const bpScriptsFolder = await this.props.project.getBehaviorPackScriptsFolder();

        if (bpScriptsFolder !== undefined) {
          scriptsFolder = bpScriptsFolder;
        } else if (this.props.project.projectFolder !== null) {
          scriptsFolder = this.props.project.projectFolder;
        } else {
          return;
        }
      }

      try {
        await this._loadModelsFromFolder(monacoInstance, scriptsFolder);
      } catch (e) {
        Log.debugAlert("Error loading TS/JS models from folder: " + e);
      }

      if (!this._trackingUpdates) {
        this._trackingUpdates = true;
        this._scriptsFolder = scriptsFolder;

        scriptsFolder.storage.onFileAdded.subscribe(this._handleFileStateChanged);
        scriptsFolder.storage.onFileContentsUpdated.subscribe(this._handleFileStateChanged);
        scriptsFolder.storage.onFileRemoved.subscribe(this._handleFileStateRemoved);
      }
    }

    this._injectLibModels();

    if (this.state !== undefined && !this.state.isLoaded) {
      this.setState({
        pathToEdit: this.state.pathToEdit,
        isLoaded: true,
      });
    }
  }

  _handleFileStateRemoved(storage: IStorage, path: string) {
    this._updateFiles(path);
  }

  _handleFileStateChanged(storage: IStorage, file: IFile) {
    this._updateFiles(file.storageRelativePath);
  }

  _updateFiles(path: string) {
    if (this._monaco === undefined) {
      return;
    }

    const fileType = StorageUtilities.getTypeFromName(path);

    if (fileType !== "js" && fileType !== "mjs" && fileType !== "ts") {
      return;
    }

    this._modelReloadPending = true;

    window.setTimeout(this._updateModels, 50);
  }

  _updateModels() {
    if (this._monaco === undefined || !this._modelReloadPending) {
      return;
    }

    this._modelReloadPending = false;

    this._ensureModels(this._monaco);
  }

  async _loadModelsFromFolder(monacoInstance: any, folder: IFolder) {
    await folder.load();

    for (const fileName in folder.files) {
      const childFile = folder.files[fileName];

      if (childFile !== undefined) {
        const type = StorageUtilities.getTypeFromName(childFile.name);
        if (type === "js" || type === "ts") {
          await this._ensureModelForFile(monacoInstance, folder, childFile);

          // if we come across a TS file and we haven't yet compiled it into JS, compile it.
          if (type === "ts") {
            if (this.props.file) {
              this.compileTsToJs(childFile, true);
            }
          }
        } else if (StorageUtilities.isFileStorageItem(childFile)) {
          const folder = await StorageUtilities.getFileStorageFolder(childFile);

          if (folder) {
            await this._loadModelsFromFolder(monacoInstance, folder);
          }
        }
      }
    }

    for (const folderName in folder.folders) {
      const childFolder = folder.folders[folderName];

      if (childFolder !== undefined) {
        await this._loadModelsFromFolder(monacoInstance, childFolder);
      }
    }
  }

  static getUriForFile(file: IFile, preferredLanguage: ProjectScriptLanguage) {
    let baseUri = "file://fs" + StorageUtilities.ensureStartsWithDelimiter(file.storageRelativePath);

    baseUri = baseUri.replace(/ /gi, "__");

    baseUri = encodeURI(baseUri);

    return baseUri;
  }

  async _ensureModelForFile(monacoInstance: any, parentFolder: IFolder, file: IFile) {
    const baseUri = JavaScriptEditor.getUriForFile(file, this.props.scriptLanguage);
    let lang = "javascript";
    let content = "";

    await file.loadContent();

    if (file.type === "ts") {
      lang = "typescript";

      const tsFile = parentFolder.ensureFile(StorageUtilities.getBaseFromName(file.name) + ".ts");

      await tsFile.loadContent();

      if (
        tsFile.content === "" ||
        tsFile.content === undefined ||
        tsFile.content === null ||
        tsFile.content instanceof Uint8Array
      ) {
        content = file.content as string;

        tsFile.setContent(content);
      } else {
        content = tsFile.content as string;
      }
    } else {
      content = file.content as string;
    }

    if (file.content !== undefined && typeof file.content === "string") {
      const modelUri = monacoInstance.Uri.parse(baseUri);

      let model = monacoInstance.editor.getModel(modelUri);

      if (model === null || model === undefined) {
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

  _handleContentUpdated(newValue: string | undefined, event: any) {
    if (this.editor && this.props.file && !this.props.readOnly && newValue) {
      this.props.file.setContent(newValue);
    }
  }

  componentDidMount(): void {
    this._doUpdate();
  }

  componentDidUpdate(prevProps: IJavaScriptEditorProps, prevState: IJavaScriptEditorState) {
    this._considerFormat();
  }

  async _considerFormat() {
    if (this.editor && this.props.project && this.props.project.carto.formatBeforeSave) {
      const action = this.editor.getAction("editor.action.formatDocument");

      if (action) {
        await action.run();
      }
    }
  }

  async persist() {
    if (this.editor && this.props.file && !this.props.readOnly) {
      const file = this.props.file;

      if (this.props.project && this.props.project.carto.formatBeforeSave) {
        const action = this.editor.getAction("editor.action.formatDocument");

        if (action) {
          await action.run();
        }
      }

      const uri = this.editor.getModel()?.uri;

      if (uri === undefined) {
        return;
      }

      const url = uri.toString();

      const intendedUrl = monaco.Uri.parse(JavaScriptEditor.getUriForFile(file, this.props.scriptLanguage)).toString();

      if (url !== intendedUrl) {
        return;
      }

      const value = this.editor.getValue();

      if (value) {
        this.props.file.setContent(value);

        if (StorageUtilities.getTypeFromName(file.name) === "ts") {
          await this.compileTsToJs(file, true);
        }
      }
    }
  }

  async compileTsToJs(file: IFile, doSave?: boolean) {
    if (StorageUtilities.getTypeFromName(file.name) === "ts" && this.props.project) {
      const uri = JavaScriptEditor.getUriForFile(file, ProjectScriptLanguage.typeScript);

      const scriptsFolder = await this.props.project.ensureDefaultScriptsFolder();

      let relativePath = file.getFolderRelativePath(scriptsFolder);

      if (relativePath) {
        if (relativePath.toLowerCase().endsWith(".ts")) {
          relativePath = relativePath.substring(0, relativePath.length - 3) + ".js";
        }

        const libScriptsFolder = await this.props.project.ensureLibScriptsFolder();

        const jsFile = await libScriptsFolder.ensureFileFromRelativePath(relativePath);

        const worker = await this._monaco.languages.typescript.getTypeScriptWorker();

        const client = await worker(uri);

        const result = await client.getEmitOutput(uri.toString());

        if (result.outputFiles.length > 0) {
          const jsContent = result.outputFiles[0].text;

          jsFile.setContent(jsContent);

          if (doSave) {
            jsFile.saveContent();
          }
        }
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

  _handleSnippet(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (
      this.editor === undefined ||
      data.value === undefined ||
      data.value === null ||
      typeof data.value !== "string"
    ) {
      return;
    }

    const snippet = ProjectUtilities.getSnippet(data.value);

    if (!snippet) {
      return;
    }

    let result = undefined;
    result = snippet.body.join("\n");

    if (result !== undefined && this.props.project) {
      const projName = this.props.project.loc.getTokenValueOrDefault(this.props.project.name);

      result = ProjectContent.replaceCommonItems(result, projName);
      result = ProjectUtilities.adaptSample(result, "");

      this.editor.trigger("keyboard", "type", { text: result });
    }
  }

  async _doUpdate() {
    if (Database.snippetsFolder === null) {
      await Database.loadSnippets();
    }

    if (this.props.project && this.props.project.scriptVersion === ProjectScriptVersion.stable10) {
      if (!Database.stableTypeDefs) {
        await Database.loadStableScriptTypes();
      }
    } else if (!Database.betaTypeDefs) {
      await Database.loadBetaScriptTypes();
    }
  }

  private _handleSnippetGalleryCommand(command: GalleryItemCommand, project: IGalleryItem) {
    if (this.editor === undefined) {
      return;
    }

    this.setState({
      pathToEdit: this.state.pathToEdit,
      isLoaded: this.state.isLoaded,
      snippetSearch: undefined,
    });

    const snippet = ProjectUtilities.getSnippet(project.id);

    if (!snippet) {
      return;
    }

    let result = undefined;
    result = snippet.body.join("\n");

    if (result !== undefined && this.props.project) {
      result = ProjectContent.replaceCommonItems(result, this.props.project.name);

      this.editor.trigger("keyboard", "type", { text: result });
    }
  }

  render() {
    let interior = <></>;
    let overlay = <></>;

    const height = "calc(100vh - " + this.props.heightOffset + 4 + "px)";
    const editorHeight = "calc(100vh - " + (this.props.heightOffset + 36) + "px)";

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

    if (this.props.file !== null) {
      if (this.props.setActivePersistable !== undefined) {
        this.props.setActivePersistable(this);
      }

      let coreUri = undefined;

      if (this.state.isLoaded && this.props.file) {
        coreUri = JavaScriptEditor.getUriForFile(this.props.file, this.props.scriptLanguage);
      }

      let theme = "vs-dark";

      if (CartoApp.theme === CartoThemeStyle.light) {
        theme = "vs";
      }

      interior = (
        <div className="jse-editor" key="editor">
          <Editor
            height={editorHeight}
            theme={theme}
            key="editor"
            defaultLanguage="typescript"
            path={coreUri}
            options={{
              fontSize: this.props.preferredTextSize,
              readOnly: this.props.readOnly,
              formatOnPaste: true,
              formatOnType: true,
              quickSuggestions: true,
              autoIndent: "full",
            }}
            beforeMount={this._handleEditorWillMount}
            onMount={this._handleEditorDidMount}
            onChange={this._handleContentUpdated}
          />
        </div>
      );
    }

    const snippets: string[] = [];

    if (Database.snippetsFolder !== null && Database.snippetsFolder.files) {
      for (const fileName in Database.snippetsFolder.files) {
        const file = Database.snippetsFolder.files[fileName];

        if (file) {
          const snipSet = StorageUtilities.getJsonObject(file) as { [snippetName: string]: ISnippet };

          if (snipSet) {
            for (const snippetName in snipSet) {
              const snippet = snipSet[snippetName];

              if (snippet) {
                snippets.push(snippetName);
              }
            }
          }
        }
      }
    }

    const writeableTools: any[] = [];

    if (!this.props.readOnly) {
      writeableTools.push(
        <div key="projSearch">
          <FormInput
            id="projSearch"
            className="home-search"
            defaultValue={""}
            placeholder="add a code snippet"
            value={this.state.snippetSearch}
            onChange={this._handleNewSearch}
          />
        </div>
      );
    } else {
      writeableTools.push(
        <div key="roLabel" className="jse-toolBarLabel">
          read-only
        </div>
      );
    }

    if (this.state.snippetSearch && this.state.snippetSearch.length >= 3 && this.props.carto.gallery) {
      overlay = (
        <div
          className="jse-snippets-overlay"
          key="pageOverlay"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          <ItemGallery
            carto={this.props.carto}
            theme={this.props.theme}
            view={ItemTileButtonDisplayMode.smallImage}
            gallery={this.props.carto.gallery}
            search={this.state.snippetSearch}
            filterOn={[GalleryItemType.codeSample, GalleryItemType.editorCodeSample]}
            onGalleryItemCommand={this._handleSnippetGalleryCommand}
          />
        </div>
      );
    }

    return (
      <div
        className="jse-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="jse-commands">
          <div className="jse-toolBarArea">
            <Toolbar aria-label="Javascript Editor toolbar" items={toolbarItems} />
          </div>
          <div className="jse-extraArea">{writeableTools}</div>
        </div>
        {overlay}
        {interior}
      </div>
    );
  }
}

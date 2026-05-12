import React, { Component } from "react";
import Project from "../../app/Project";
import IFile, { FileUpdateType } from "../../storage/IFile";
import IStorage, { IFileUpdateEvent } from "../../storage/IStorage";
import Editor from "@monaco-editor/react";
import "./JavaScriptEditor.css";
// Use type-only import to avoid bundling the full Monaco editor (~4MB)
// The actual Monaco instance is obtained from the Editor's onMount callback
import type * as MonacoType from "monaco-editor";
import IPersistable from "../types/IPersistable";
import Log from "../../core/Log";
import { Stack, IconButton, TextField } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus } from "@fortawesome/free-solid-svg-icons";
import { ProjectScriptLanguage, ProjectScriptVersion } from "../../app/IProjectData";
import ProjectContent from "../../app/ProjectContent";
import IFolder from "../../storage/IFolder";
import StorageUtilities from "../../storage/StorageUtilities";
import Database from "../../minecraft/Database";
import ISnippet from "../../app/ISnippet";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import ITypeDefCatalog from "../../minecraft/ITypeDefCatalog";
import IAppProps from "../appShell/IAppProps";
import IGalleryItem, { GalleryItemType } from "../../app/IGalleryItem";
import ItemGallery, { GalleryItemCommand } from "../project/itemGallery/ItemGallery";
import { ItemTileButtonDisplayMode } from "../project/itemGallery/ItemTileButton";
import WebUtilities from "../utils/WebUtilities";
import { getThemeColors } from "../hooks/theme/useThemeColors";

// Import and re-export from shared location for backward compatibility
import { ScriptEditorRole } from "../utils/ScriptEditorRole";
import IProjectTheme from "../types/IProjectTheme";
import type { IProjectItemEditorNavigationTarget } from "../project/ProjectItemEditor";
import { WithLocalizationProps, withLocalization } from "../withLocalization";
export { ScriptEditorRole };

interface IJavaScriptEditorProps extends IAppProps, WithLocalizationProps {
  heightOffset: number;
  project?: Project;
  theme: IProjectTheme;
  file?: IFile;
  initialContent?: string;
  navigationTarget?: IProjectItemEditorNavigationTarget;
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
  contentReady: boolean; // true when file content is loaded and ready to display
  snippetSearch?: string;
  proposedLeft?: number;
}

class JavaScriptEditor extends Component<IJavaScriptEditorProps, IJavaScriptEditorState> {
  editor?: MonacoType.editor.IStandaloneCodeEditor;
  _activeModel: any; // think of "model" as a file.
  _monaco: typeof MonacoType | null = null;
  _trackingUpdates: boolean = false;
  _scriptsFolder?: IFolder;
  _modelReloadPending: boolean = false;
  _isMounted: boolean = false;
  _navigationDecorations?: MonacoType.editor.IEditorDecorationsCollection;
  _lastNavigationRequestId?: number;
  /** When true, suppresses onChange propagation to prevent programmatic model
   *  changes (e.g. setValue, line-ending normalization) from marking the file
   *  as edited. */
  _suppressOnChange: boolean = false;

  constructor(props: IJavaScriptEditorProps) {
    super(props);

    this._handleContentUpdated = this._handleContentUpdated.bind(this);
    this._handleEditorWillMount = this._handleEditorWillMount.bind(this);
    this._handleEditorDidMount = this._handleEditorDidMount.bind(this);
    this._handleFileStateChanged = this._handleFileStateChanged.bind(this);
    this._handleFileStateRemoved = this._handleFileStateRemoved.bind(this);
    this._handleSnippetGalleryCommand = this._handleSnippetGalleryCommand.bind(this);
    this._handleNewSearch = this._handleNewSearch.bind(this);
    this._updateModels = this._updateModels.bind(this);
    this._doUpdate = this._doUpdate.bind(this);
    this.persist = this.persist.bind(this);
    this._considerFormat = this._considerFormat.bind(this);

    this._handleFileStateChanged = this._handleFileStateChanged.bind(this);
    this._handleFileStateRemoved = this._handleFileStateRemoved.bind(this);
    this._handleFileStateAdded = this._handleFileStateAdded.bind(this);

    this._zoomIn = this._zoomIn.bind(this);
    this._zoomOut = this._zoomOut.bind(this);

    let curPath = "";

    if (props.file !== undefined) {
      curPath = JavaScriptEditor.getUriForFile(props.file, props.scriptLanguage);
    }

    this.state = {
      pathToEdit: curPath,
      isLoaded: false,
      contentReady: props.initialContent !== undefined, // Ready if initial content provided
    };

    // Bind the content preload method
    this._ensureContentLoaded = this._ensureContentLoaded.bind(this);
  }

  _handleNewSearch(event: React.ChangeEvent<HTMLInputElement>) {
    if (!this.state) {
      return;
    }

    const newSearch = event.target.value;

    const left = WebUtilities.getElementLeft(event.currentTarget as HTMLElement);

    this.setState({
      pathToEdit: this.state.pathToEdit,
      isLoaded: this.state.isLoaded,
      snippetSearch: newSearch,
      proposedLeft: left,
    });
  }

  static getDerivedStateFromProps(props: IJavaScriptEditorProps, state: IJavaScriptEditorState) {
    if (props.file) {
      const curPath = JavaScriptEditor.getUriForFile(props.file, props.scriptLanguage);

      if (state === undefined || state === null) {
        state = {
          pathToEdit: curPath,
          isLoaded: false,
          contentReady: props.initialContent !== undefined,
        };

        return state;
      }
      if (curPath !== state.pathToEdit) {
        state.pathToEdit = curPath;
        state.contentReady = false; // Reset when file changes

        return state;
      }
    }

    return null; // No change to state
  }

  _handleEditorWillMount(monacoInstance: typeof MonacoType) {
    if (this._monaco !== monacoInstance) {
      this._monaco = monacoInstance;
      const tslang = this._monaco!.languages.typescript;

      tslang.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      tslang.javascriptDefaults.setCompilerOptions({
        target: tslang.ScriptTarget.ESNext,
        module: tslang.ModuleKind.ESNext,
        lib: ["es2022"],
        allowNonTsExtensions: true,
      });

      tslang.typescriptDefaults.setCompilerOptions({
        lib: ["es2022"],
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
          typeDefs = Database.stable10TypeDefs;
        } else {
          typeDefs = Database.stable20TypeDefs;
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
    this._isMounted = false;
    if (this._scriptsFolder) {
      this._trackingUpdates = false;

      this._scriptsFolder.storage.onFileAdded.unsubscribe(this._handleFileStateAdded);
      this._scriptsFolder.storage.onFileRemoved.unsubscribe(this._handleFileStateRemoved);
    }
  }

  async _ensureModels(monacoInstance: any) {
    let typeDefs: ITypeDefCatalog | null = null;

    if (this.props.project && this.props.project.scriptVersion === ProjectScriptVersion.stable10) {
      await Database.loadStable10ScriptTypes();
      typeDefs = Database.stable10TypeDefs;
    } else {
      await Database.loadStable20ScriptTypes();
      typeDefs = Database.stable20TypeDefs;
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

        if (!scriptsFolder.storage.onFileAdded.has(this._handleFileStateAdded)) {
          scriptsFolder.storage.onFileAdded.subscribe(this._handleFileStateAdded);
        }
        if (!scriptsFolder.storage.onFileContentsUpdated.has(this._handleFileStateChanged)) {
          scriptsFolder.storage.onFileContentsUpdated.subscribe(this._handleFileStateChanged);
        }
        if (!scriptsFolder.storage.onFileRemoved.has(this._handleFileStateRemoved)) {
          scriptsFolder.storage.onFileRemoved.subscribe(this._handleFileStateRemoved);
        }
      }
    }

    this._injectLibModels();

    if (this.state !== undefined && !this.state.isLoaded) {
      this.setState({
        pathToEdit: this.state.pathToEdit,
        isLoaded: true,
        snippetSearch: this.state.snippetSearch,
        proposedLeft: this.state.proposedLeft,
      });
    }
  }

  _handleFileStateRemoved(storage: IStorage, path: string) {
    this._updateFiles(path);
  }

  _handleFileStateAdded(storage: IStorage, file: IFile) {
    this._updateFiles(file.storageRelativePath);
  }

  _handleFileStateChanged(storage: IStorage, fileUpdate: IFileUpdateEvent) {
    if (fileUpdate.sourceId !== this.getEditorInstanceId()) {
      this._updateFiles(fileUpdate.file.storageRelativePath);
    }
  }

  _updateFiles(path: string) {
    if (this._monaco === undefined) {
      return;
    }

    const fileType = StorageUtilities.getTypeFromName(path);

    if (fileType !== "js" && fileType !== "mjs" && fileType !== "ts") {
      return;
    }

    if (this._modelReloadPending) {
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
    if (!folder.isLoaded) {
      await folder.load();
    }

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

          if (folder && typeof folder !== "string") {
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

  getEditorInstanceId() {
    return "JavaScriptEditor|" + (this.props.file ? this.props.file.extendedPath : "noFile");
  }

  async _ensureModelForFile(monacoInstance: any, parentFolder: IFolder, file: IFile) {
    const baseUri = JavaScriptEditor.getUriForFile(file, this.props.scriptLanguage);
    let lang = "javascript";
    let content = "";

    if (!file.isContentLoaded) {
      await file.loadContent();
    }

    if (file.type === "ts") {
      lang = "typescript";

      const tsFile = parentFolder.ensureFile(StorageUtilities.getBaseFromName(file.name) + ".ts");

      if (!tsFile.isContentLoaded) {
        await tsFile.loadContent();
      }

      if (
        tsFile.content === "" ||
        tsFile.content === undefined ||
        tsFile.content === null ||
        tsFile.content instanceof Uint8Array
      ) {
        content = file.content as string;

        tsFile.setContentIfSemanticallyDifferent(content, FileUpdateType.regularEdit, this.getEditorInstanceId());
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
        this._suppressOnChange = true;
        model = monacoInstance.editor.createModel(content, lang, modelUri);
        this._suppressOnChange = false;
      } else {
        let existingContent = model.getValue();
        if (existingContent.trim() !== file.content.trim()) {
          this._suppressOnChange = true;
          model.setValue(file.content as string);
          this._suppressOnChange = false;
        }
      }
    }
  }

  _handleEditorDidMount(editor: MonacoType.editor.IStandaloneCodeEditor, monacoInstance: typeof MonacoType) {
    this.editor = editor;
    this._monaco = monacoInstance;

    if (this.editor === undefined) {
      return;
    }

    this._applyNavigationTarget(this.props.navigationTarget);
  }

  _handleContentUpdated(newValue: string | undefined, event: any) {
    if (this._suppressOnChange) {
      return;
    }

    if (this.editor && this.props.file && !this.props.readOnly && newValue) {
      this.props.file.setContentIfSemanticallyDifferent(
        newValue,
        FileUpdateType.regularEdit,
        this.getEditorInstanceId()
      );
    }

    if (!this.props.file && this.props.onUpdateContent && newValue !== undefined) {
      this.props.onUpdateContent(newValue);
    }
  }

  componentDidMount(): void {
    this._isMounted = true;
    this._doUpdate();
    this._ensureContentLoaded();
  }

  componentDidUpdate(prevProps: IJavaScriptEditorProps, prevState: IJavaScriptEditorState) {
    // When file changes, ensure the new file's content is loaded
    if (prevProps.file !== this.props.file) {
      this._ensureContentLoaded();
    }

    // When initialContent changes without a file (e.g., tool editor switching tools),
    // update the Monaco model directly
    if (
      !this.props.file &&
      this.editor &&
      this.props.initialContent !== undefined &&
      prevProps.initialContent !== this.props.initialContent
    ) {
      this._suppressOnChange = true;
      this.editor.setValue(this.props.initialContent);
      this._suppressOnChange = false;
    }

    if (prevProps.navigationTarget !== this.props.navigationTarget) {
      this._applyNavigationTarget(this.props.navigationTarget);
    }
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

    const range = this._monaco ? new this._monaco.Range(lineNumber, 1, lineNumber, 1) : undefined;
    if (!range) {
      return;
    }

    this._navigationDecorations = this.editor.createDecorationsCollection([
      {
        range,
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

  /**
   * Pre-loads the file content before the Monaco editor mounts.
   * This prevents the "empty editor with line number 1" flash.
   */
  async _ensureContentLoaded(): Promise<void> {
    const file = this.props.file;

    // If we have initial content prop, we're already ready
    if (this.props.initialContent !== undefined) {
      if (!this.state.contentReady && this._isMounted) {
        this.setState({ contentReady: true });
      }
      return;
    }

    // If no file, nothing to load
    if (!file) {
      return;
    }

    // If file content is already loaded, mark as ready
    if (file.isContentLoaded && file.content !== undefined) {
      if (!this.state.contentReady && this._isMounted) {
        this.setState({ contentReady: true });
      }
      return;
    }

    // Load the file content
    try {
      await file.loadContent();

      // Only update state if we're still showing this file and component is mounted
      if (this._isMounted && this.props.file === file) {
        this.setState({ contentReady: true });
      }
    } catch (error) {
      Log.debug(`JavaScriptEditor: Failed to preload content for ${file.storageRelativePath}: ${error}`);
      // Still mark as ready so the editor can show
      if (this._isMounted) {
        this.setState({ contentReady: true });
      }
    }
  }

  async _considerFormat() {
    if (
      this.editor &&
      this.editor.getModel() &&
      this.props.project &&
      this.props.project.creatorTools.formatBeforeSave
    ) {
      const action = this.editor.getAction("editor.action.formatDocument");

      if (action) {
        try {
          await action.run();
        } catch (e) {
          // Format can fail if the model becomes null during file switching
          Log.debug("JavaScriptEditor: format action failed, likely due to model change: " + e);
        }
      }
    }
  }

  async persist(): Promise<boolean> {
    let didPersist = false;

    if (this.editor && this.props.file && !this.props.readOnly) {
      const file = this.props.file;

      if (this.editor.getModel() && this.props.project && this.props.project.creatorTools.formatBeforeSave) {
        const action = this.editor.getAction("editor.action.formatDocument");

        if (action) {
          try {
            await action.run();
          } catch (e) {
            Log.debug("JavaScriptEditor: format action failed during persist: " + e);
          }
        }
      }

      const uri = this.editor.getModel()?.uri;

      if (uri === undefined || this._monaco === null) {
        return false;
      }

      const url = uri.toString();

      const intendedUrl = this._monaco.Uri.parse(
        JavaScriptEditor.getUriForFile(file, this.props.scriptLanguage)
      ).toString();

      if (url !== intendedUrl) {
        return false;
      }

      const value = this.editor.getValue();

      if (value) {
        if (
          this.props.file.setContentIfSemanticallyDifferent(
            value,
            FileUpdateType.regularEdit,
            this.getEditorInstanceId()
          )
        ) {
          didPersist = true;

          if (StorageUtilities.getTypeFromName(file.name) === "ts") {
            await this.compileTsToJs(file, true);
          }
        }
      }
    }

    return didPersist;
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

        if (!this._monaco) {
          return;
        }

        const worker = await this._monaco.languages.typescript.getTypeScriptWorker();

        const monacoUri = this._monaco.Uri.parse(uri.toString());
        const client = await worker(monacoUri);

        const result = await client.getEmitOutput(monacoUri.toString());

        if (result.outputFiles.length > 0) {
          const jsContent = result.outputFiles[0].text;

          jsFile.setContentIfSemanticallyDifferent(
            jsContent,
            FileUpdateType.versionlessEdit,
            this.getEditorInstanceId()
          );

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
    if (this.editor === undefined || this._monaco === null) {
      return;
    }

    const val = this.editor.getOption(this._monaco.editor.EditorOption.fontSize);

    if (val !== undefined) {
      this.props.onUpdatePreferredTextSize(Math.round(val));
    }
  }
  async _doUpdate() {
    if (this.props.project && this.props.project.scriptVersion === ProjectScriptVersion.stable10) {
      if (!Database.stable10TypeDefs) {
        await Database.loadStable10ScriptTypes();
      }
    } else if (!Database.stable20TypeDefs) {
      await Database.loadStable20ScriptTypes();
    }
  }

  private async _handleSnippetGalleryCommand(command: GalleryItemCommand, project: IGalleryItem) {
    if (this.editor === undefined || !project.sampleSet) {
      return;
    }

    this.setState({
      pathToEdit: this.state.pathToEdit,
      isLoaded: this.state.isLoaded,
      snippetSearch: undefined,
    });

    const snippet = await Database.getSnippet(project.sampleSet, project.id);

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

    // Show loading placeholder while file content is being loaded
    // This prevents the disconcerting blank editor flash
    // Only check contentReady (file loaded) - isLoaded is for Monaco which needs to mount first
    if (!this.state.contentReady && !this.props.initialContent && this.props.file) {
      return (
        <div
          className="jse-area"
          style={{
            minHeight: height,
            maxHeight: height,
          }}
        >
          <div className="jse-toolBar">
            <Stack direction="row" spacing={1} aria-label="Script editor toolbar" />
          </div>
          <div className="jse-content">
            <div className="jse-editor">
              <div className="jse-loading-placeholder" style={{ height: editorHeight }}>
                <div className="jse-loading-spinner" />
                <div className="jse-loading-message">Loading content...</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const colors = getThemeColors();

    if (this.props.file !== null) {
      if (this.props.setActivePersistable !== undefined) {
        this.props.setActivePersistable(this);
      }

      let coreUri = undefined;

      if (this.props.file) {
        coreUri = JavaScriptEditor.getUriForFile(this.props.file, this.props.scriptLanguage);
      }

      let theme = "vs-dark";

      if (CreatorToolsHost.theme === CreatorToolsThemeStyle.light) {
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
            defaultValue={!this.props.file ? this.props.initialContent ?? "" : undefined}
            keepCurrentModel={!this.props.file ? false : true}
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
          <TextField
            size="small"
            id="projSearch"
            className="home-search"
            placeholder={this.props.intl.formatMessage({ id: "project_editor.js_ed.snippet_placeholder" })}
            value={this.state.snippetSearch || ""}
            onChange={this._handleNewSearch}
          />
        </div>
      );
    } else {
      writeableTools.push(
        <div key="roLabel" className="jse-toolBarLabel">
          {this.props.intl.formatMessage({ id: "project_editor.js_ed.read_only" })}
        </div>
      );
    }

    if (this.state.snippetSearch && this.state.snippetSearch.length >= 3 && this.props.creatorTools.gallery) {
      overlay = (
        <div
          className="jse-snippets-overlay"
          key="pageOverlay"
          style={{
            backgroundColor: colors.contentBackground,
            color: colors.contentForeground,
            left: this.state.proposedLeft ? this.state.proposedLeft : undefined,
          }}
        >
          <ItemGallery
            creatorTools={this.props.creatorTools}
            theme={this.props.theme}
            view={ItemTileButtonDisplayMode.smallImage}
            gallery={this.props.creatorTools.gallery}
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
            <Stack direction="row" spacing={1} aria-label={this.props.intl.formatMessage({ id: "project_editor.js_ed.toolbar_aria" })}>
              <IconButton onClick={this._zoomIn} title="Zoom into the text editor" aria-label="Zoom in" size="small">
                <FontAwesomeIcon icon={faSearchPlus} className="fa-lg" />
              </IconButton>
              <IconButton
                onClick={this._zoomOut}
                title="Zoom out of the text editor"
                aria-label="Zoom out"
                size="small"
              >
                <FontAwesomeIcon icon={faSearchMinus} className="fa-lg" />
              </IconButton>
            </Stack>
          </div>
          <div className="jse-extraArea">{writeableTools}</div>
        </div>
        {overlay}
        {interior}
      </div>
    );
  }
}

export default withLocalization(JavaScriptEditor);

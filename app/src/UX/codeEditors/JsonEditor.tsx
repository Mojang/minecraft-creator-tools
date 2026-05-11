import { Component } from "react";
import IFile, { FileUpdateType } from "../../storage/IFile";
import Editor, { DiffEditor } from "@monaco-editor/react";
import "./JsonEditor.css";
// Use type-only import to avoid bundling the full Monaco editor (~4MB)
import type * as MonacoType from "monaco-editor";
import { Stack, IconButton, Snackbar } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearchPlus,
  faSearchMinus,
  faEye,
  faEyeSlash,
  faSearch,
  faCodeBranch,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import ProjectItem from "../../app/ProjectItem";
import { ProjectItemType } from "../../app/IProjectItemData";
import BlockTypeLivePreview from "../editors/blockType/BlockTypeLivePreview";
import EntityTypeLivePreview from "../editors/entityType/EntityTypeLivePreview";
import EntityTypeResourceLivePreview from "../editors/entityType/EntityTypeResourceLivePreview";
import RecipeLivePreview from "../editors/recipe/RecipeLivePreview";
import LootTableLivePreview from "../editors/lootTable/LootTableLivePreview";
import SpawnRuleLivePreview from "../editors/spawnRules/SpawnRuleLivePreview";
import RenderControllerLivePreview from "../editors/renderController/RenderControllerLivePreview";
import AttachableLivePreview from "../editors/entityType/AttachableLivePreview";
import SoundDefinitionLivePreview from "../editors/sound/SoundDefinitionLivePreview";
import FeatureLivePreview from "../editors/feature/FeatureLivePreview";
import ManifestLivePreview from "../editors/manifest/ManifestLivePreview";
import ItemTypeLivePreview from "../editors/itemType/ItemTypeLivePreview";
import VoxelShapeLivePreview from "../editors/voxelShape/VoxelShapeLivePreview";
import StorageUtilities from "../../storage/StorageUtilities";
import Database from "../../minecraft/Database";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import Project from "../../app/Project";
import { constants } from "../../core/Constants";
import IPersistable from "../types/IPersistable";
import IStorage, { IFileUpdateEvent } from "../../storage/IStorage";
import Log from "../../core/Log";
import {
  JsonEditorEnhancements,
  JsonPathBreadcrumb,
  FormSchemaGenerator,
  formDefinitionCache,
} from "../JsonEditorEnhanced";
import Utilities from "../../core/Utilities";
import IProjectTheme from "../types/IProjectTheme";
import type { IProjectItemEditorNavigationTarget } from "../project/ProjectItemEditor";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

// Minimum widths for resizable panes
const MIN_EDITOR_WIDTH = 300;
const MIN_PREVIEW_WIDTH = 200;
const MAX_PREVIEW_WIDTH = 600;
const DEFAULT_PREVIEW_WIDTH = 260;

interface IJsonEditorProps extends WithLocalizationProps {
  heightOffset: number;
  readOnly: boolean;
  project: Project;
  isDiffEditor?: boolean;
  content?: string;
  theme: IProjectTheme;
  preferredTextSize: number;
  livePreviewWidth?: number;
  item?: ProjectItem;
  diffFile?: IFile;
  file?: IFile;
  navigationTarget?: IProjectItemEditorNavigationTarget;
  setActivePersistable?: (persistObject: IPersistable) => void;
  onUpdatePreferredTextSize?: (newSize: number) => void;
  onUpdateLivePreviewWidth?: (newWidth: number) => void;
  onOpenProjectItem?: (projectPath: string) => void;
}

interface IJsonEditorState {
  fileToEdit?: IFile;
  content?: string;
  isLoaded: boolean;
  contentReady: boolean; // true when file content is loaded and ready to display
  showQuickDiff: boolean;
  showLivePreview: boolean;
  livePreviewJsonData?: any;
  livePreviewError?: string; // Error message when JSON parsing fails
  statusMessage?: string; // Brief feedback message shown in snackbar
  // Resize state
  isResizing: boolean;
  previewWidth: number;
}

class JsonEditor extends Component<IJsonEditorProps, IJsonEditorState> {
  editor?: MonacoType.editor.IStandaloneCodeEditor;
  diffEditor?: MonacoType.editor.IDiffEditor;
  _needsPersistence: boolean = false;
  _monaco: typeof MonacoType | null = null;
  _modelReloadPending: boolean = false;
  _isMounted: boolean = false;
  _suppressContentUpdate: boolean = false; // Guard flag to prevent format-on-load from triggering phantom edits
  _enhancements: JsonEditorEnhancements;
  _schemaGenerator: FormSchemaGenerator;
  _resizeStartX: number = 0;
  _resizeStartWidth: number = 0;
  _containerRef: HTMLDivElement | null = null;
  _pendingWidthUpdate: number | null = null; // Track pending width update to prevent getDerivedStateFromProps from resetting
  _navigationDecorations?: MonacoType.editor.IEditorDecorationsCollection;
  _lastNavigationRequestId?: number;
  _quickDiffBaselines: Map<string, string> = new Map<string, string>();
  _autoSuggestDisposable?: MonacoType.IDisposable;
  _autoSuggestTimer?: number;

  constructor(props: IJsonEditorProps) {
    super(props);

    this._handleContentUpdated = this._handleContentUpdated.bind(this);
    this._handleEditorWillMount = this._handleEditorWillMount.bind(this);
    this._handleEditorDidMount = this._handleEditorDidMount.bind(this);
    this._handleDiffEditorDidMount = this._handleDiffEditorDidMount.bind(this);

    this._handleFileStateChanged = this._handleFileStateChanged.bind(this);
    this._handleFileStateRemoved = this._handleFileStateRemoved.bind(this);
    this._handleFileStateAdded = this._handleFileStateAdded.bind(this);

    this._considerFormat = this._considerFormat.bind(this);
    this._zoomIn = this._zoomIn.bind(this);
    this._zoomOut = this._zoomOut.bind(this);
    this._openFind = this._openFind.bind(this);
    this._showHoverDocs = this._showHoverDocs.bind(this);
    this._showQuickFix = this._showQuickFix.bind(this);
    this._handleCloseStatus = this._handleCloseStatus.bind(this);
    this._toggleQuickDiff = this._toggleQuickDiff.bind(this);
    this._toggleLivePreview = this._toggleLivePreview.bind(this);
    this._handlePreviewNavigate = this._handlePreviewNavigate.bind(this);
    this._handleWidgetAction = this._handleWidgetAction.bind(this);
    this._handleResizeStart = this._handleResizeStart.bind(this);
    this._handleResizeMove = this._handleResizeMove.bind(this);
    this._handleResizeEnd = this._handleResizeEnd.bind(this);
    this.persist = this.persist.bind(this);

    // Initialize JSON editor enhancements
    this._enhancements = new JsonEditorEnhancements();
    this._schemaGenerator = new FormSchemaGenerator(formDefinitionCache);

    // Set up widget action callback for clicking on textures/colors
    this._enhancements.setWidgetActionCallback(this._handleWidgetAction);

    // Get live preview preference from CreatorTools (default to true)
    const showLivePreview = props.project?.creatorTools?.showLivePreview ?? true;

    // Get live preview width from props or use default
    const previewWidth = props.livePreviewWidth ?? DEFAULT_PREVIEW_WIDTH;

    this.state = {
      fileToEdit: undefined,
      content: props.content,
      isLoaded: false,
      contentReady: props.content !== undefined, // If content prop is provided, we're ready
      showQuickDiff: false,
      showLivePreview: showLivePreview,
      livePreviewJsonData: undefined,
      livePreviewError: undefined,
      isResizing: false,
      previewWidth: previewWidth,
    };

    // Bind the content preload method
    this._ensureContentLoaded = this._ensureContentLoaded.bind(this);
  }

  static getDerivedStateFromProps(props: IJsonEditorProps, state: IJsonEditorState) {
    if (state === undefined || state === null) {
      // Get live preview preference from CreatorTools (default to true)
      const showLivePreview = props.project?.creatorTools?.showLivePreview ?? true;

      return {
        fileToEdit: props.file,
        content: props.content,
        isLoaded: false,
        contentReady: props.content !== undefined, // Ready if content prop provided
        showQuickDiff: false,
        showLivePreview: showLivePreview,
        livePreviewJsonData: undefined,
        livePreviewError: undefined,
        isResizing: false,
        previewWidth: props.livePreviewWidth ?? DEFAULT_PREVIEW_WIDTH,
      };
    }
    if (props.file !== state.fileToEdit) {
      // Check if the new file's content is already loaded to avoid a blank flash.
      // If content is available, set contentReady immediately instead of going through
      // the _ensureContentLoaded() → setState cycle which causes one blank render frame.
      const alreadyLoaded = props.file
        ? props.file.isContentLoaded && props.file.content !== undefined && props.file.content !== null
        : false;

      // Return a NEW state object - never mutate the existing state
      return {
        ...state,
        fileToEdit: props.file,
        isLoaded: false,
        contentReady: alreadyLoaded,
        showQuickDiff: false,
        livePreviewJsonData: undefined,
        livePreviewError: undefined,
      };
    }

    // Don't update preview width from props during or immediately after resize
    // The isResizing flag prevents reset during drag, but we also need to
    // avoid resetting after mouseup before the prop has updated

    return null; // No change to state
  }

  componentDidMount() {
    this._isMounted = true;
    // Start loading file content if not already loaded
    this._ensureContentLoaded();
  }

  /**
   * Pre-loads the file content before the Monaco editor mounts.
   * This prevents the "empty editor with line number 1" flash that occurs
   * when the editor renders before content is available.
   */
  async _ensureContentLoaded(): Promise<void> {
    const file = this.props.file ?? this.state.fileToEdit;

    // If we have content prop, we're already ready
    if (this.props.content !== undefined) {
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
      if (this._isMounted && (this.state.fileToEdit === file || this.props.file === file)) {
        this.setState({ contentReady: true });
      }
    } catch (error) {
      Log.debug(`JsonEditor: Failed to preload content for ${file.storageRelativePath}: ${error}`);
      // Still mark as ready so the editor can show (will be empty or show error)
      if (this._isMounted) {
        this.setState({ contentReady: true });
      }
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

    if (fileType !== "json") {
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

  getEditorInstanceId() {
    return "JSONEditor|" + (this.props.file ? this.props.file.extendedPath : "noFile");
  }

  _handleEditorWillMount(monacoInstance: any) {
    this._ensureModels(monacoInstance, true);
  }

  static getUriForFile(file: IFile) {
    let baseUri = "file:/" + StorageUtilities.ensureStartsWithDelimiter(file.storageRelativePath);

    // if we encode baseUri, the JSON model lookup doesn't seem to work for paths with spaces
    // encode with __ instead.
    baseUri = baseUri.replace(/ /gi, "__");

    baseUri = baseUri.toLowerCase();

    return baseUri;
  }

  async _ensureModels(monacoInstance: any, formatAfterLoad?: boolean) {
    try {
      if (this.props.file) {
        await this._ensureModelForFile(monacoInstance, this.props.file);
      }

      if (this.props.diffFile) {
        await this._ensureModelForFile(monacoInstance, this.props.diffFile);
      }
    } catch (err) {
      // Ensure isLoaded is set even if model/schema creation fails, so the
      // editor renders with whatever model state is available rather than
      // staying permanently blank.
      Log.debug("JsonEditor: Error in _ensureModels: " + err);
    }

    if (this.state !== undefined && !this.state.isLoaded) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        content: this.state.content,
        isLoaded: true,
      });
    }

    // Only format on initial load, not on every componentDidUpdate re-render.
    // Formatting on every re-render causes newlines typed by the user to be
    // immediately collapsed by the formatter.
    if (formatAfterLoad) {
      window.setTimeout(this._considerFormat, 5);
    }

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

      const snapshotUri = modelUri.toString();
      if (!this._quickDiffBaselines.has(snapshotUri)) {
        this._quickDiffBaselines.set(snapshotUri, file.content);
      }

      // Always configure JSONC support (comments + trailing commas) regardless of schema availability
      const jsonlang = monacoInstance.languages.json;
      if (jsonlang?.jsonDefaults) {
        jsonlang.jsonDefaults.setDiagnosticsOptions({
          validate: true,
          enableSchemaRequest: false,
          allowComments: true,
          trailingCommas: "ignore",
        });
      }

      if (this.props.item) {
        try {
          const schemaPath = this.props.item.getCommunitySchemaPath();
          const modelUriToStr = modelUri.toString();

          // Try to generate a rich schema from form definitions (with samples, descriptions, etc.)
          const formSchema = await this._schemaGenerator.generateSchemaForItemType(this.props.item.itemType);

          if (formSchema) {
            // Use form-generated schema (includes samples in descriptions)
            const formSchemaUri = constants.homeUrl + "/schemas/form/" + this.props.item.itemType + ".json";

            jsonlang.jsonDefaults.setDiagnosticsOptions({
              validate: true,
              enableSchemaRequest: false,
              allowComments: true,
              trailingCommas: "ignore",
              schemas: [
                {
                  uri: formSchemaUri,
                  fileMatch: [modelUriToStr],
                  schema: formSchema,
                },
              ],
            });

            // Note: We intentionally omit setModeConfiguration here.
            // Calling it with colors: true causes timing issues with Monaco's
            // color picker registration that result in exceptions.
            // The default mode configuration is sufficient for JSON editing.
          } else if (schemaPath !== undefined) {
            // Fall back to Blockception schema if no form available
            const schemaContent = await Database.getCommunitySchema(schemaPath);

            if (schemaContent) {
              const schemaUri = constants.homeUrl + "/res/latest/schemas/" + schemaPath;

              jsonlang.jsonDefaults.setDiagnosticsOptions({
                validate: true,
                enableSchemaRequest: false,
                allowComments: true,
                trailingCommas: "ignore",
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
        } catch (err) {
          // Schema generation or application failed - the model is already
          // created with the correct content above, so editing still works;
          // we just won't have schema-based validation/completion.
          Log.debug("JsonEditor: Error setting up schema for " + file.storageRelativePath + ": " + err);
        }
      }
    }
  }

  _handleEditorDidMount(editor: MonacoType.editor.IStandaloneCodeEditor, monacoInstance: typeof MonacoType) {
    this.editor = editor;
    this._monaco = monacoInstance;

    // Register JSON editor enhancements
    this._enhancements.registerProviders(editor);
    (window as any).__mctJsonEnhancements = this._enhancements;

    // Update file context with current project item
    this._enhancements.updateFileContext(this.props.item, this.props.project);

    // Auto-trigger suggestions when typing JSON property keys.
    // Monaco's quickSuggestions.strings doesn't always fire reliably for JSON keys
    // because the user is typing inside a string token where Monaco may not re-trigger.
    // This listener detects when the user is typing a new property key (inside quotes,
    // before a colon) and explicitly triggers suggest after a short delay.
    this._autoSuggestDisposable = editor.onDidChangeModelContent((e) => {
      // Only trigger for user-typed text changes (not programmatic/undo)
      if (e.isUndoing || e.isRedoing || e.isFlush) {
        return;
      }

      // Only trigger for single-character insertions (typing)
      const change = e.changes[0];
      if (!change || change.text.length === 0 || change.text.length > 2) {
        return;
      }

      // Check if we're inside a quoted string that's a property key
      const position = editor.getPosition();
      if (!position) {
        return;
      }

      const model = editor.getModel();
      if (!model) {
        return;
      }

      const lineContent = model.getLineContent(position.lineNumber);
      const col = position.column - 1; // 0-based

      // Quick heuristic: we're in a key position if:
      // 1. There is an opening quote before us on this line with no colon between quote and cursor
      // 2. The character before the opening quote is whitespace, comma, or opening brace
      let inKey = false;
      let openQuotePos = -1;
      for (let i = col - 1; i >= 0; i--) {
        if (lineContent[i] === '"') {
          openQuotePos = i;
          break;
        }
        if (lineContent[i] === ":") {
          // We're after a colon — this is a value, not a key
          break;
        }
      }

      if (openQuotePos >= 0) {
        // Check character before the opening quote (skip whitespace)
        let beforeQuote = -1;
        for (let i = openQuotePos - 1; i >= 0; i--) {
          if (lineContent[i] !== " " && lineContent[i] !== "\t") {
            beforeQuote = i;
            break;
          }
        }
        // Key position if preceded by {, comma, or start of line
        if (beforeQuote < 0 || lineContent[beforeQuote] === "{" || lineContent[beforeQuote] === ",") {
          inKey = true;
        }
      }

      if (inKey) {
        // Trigger suggestions with a small delay to let Monaco process the edit
        if (this._autoSuggestTimer) {
          clearTimeout(this._autoSuggestTimer);
        }
        this._autoSuggestTimer = window.setTimeout(() => {
          if (this.editor) {
            this.editor.trigger("autoSuggestOnKey", "editor.action.triggerSuggest", {});
          }
        }, 100);
      }
    });

    // Update live preview if it's showing - use a small delay to ensure content is ready
    if (this.state.showLivePreview) {
      this._updateLivePreviewData();
    }

    this._applyNavigationTarget(this.props.navigationTarget);
  }

  /**
   * Updates the live preview data, with retry logic for timing issues.
   * Uses file content directly when available to avoid Monaco timing issues.
   * Strips JSON comments (single-line // and multi-line block comments) before parsing
   * since Minecraft JSON supports them.
   */
  private _updateLivePreviewData(retryCount: number = 0): void {
    let jsonData: any = undefined;
    let parseError: string | undefined = undefined;

    // First try to get content from the file directly (most reliable when switching files)
    if (this.state.fileToEdit && this.state.fileToEdit.content && typeof this.state.fileToEdit.content === "string") {
      try {
        // Strip comments from JSON content before parsing
        const fixedContent = Utilities.fixJsonContent(this.state.fileToEdit.content);
        jsonData = JSON.parse(fixedContent);
      } catch (error) {
        parseError = error instanceof Error ? error.message : String(error);
      }
    }

    // Fall back to editor content if file content didn't work
    if (!jsonData && !parseError) {
      const result = this._getCurrentJsonDataWithError();
      jsonData = result.data;
      parseError = result.error;
    }

    if (jsonData) {
      this.setState({ livePreviewJsonData: jsonData, livePreviewError: undefined });
    } else if (parseError) {
      this.setState({ livePreviewJsonData: undefined, livePreviewError: parseError });
    } else if (retryCount < 10) {
      // Retry with increasing delays - file loading can take time
      const delay = 100 + retryCount * 50; // 100ms, 150ms, 200ms, etc.
      window.setTimeout(() => this._updateLivePreviewData(retryCount + 1), delay);
    }
  }

  _handleDiffEditorDidMount(editor: MonacoType.editor.IDiffEditor, monacoInstance: typeof MonacoType) {
    this.diffEditor = editor;
    this._monaco = monacoInstance;
  }

  componentDidUpdate(prevProps: IJsonEditorProps, prevState: IJsonEditorState) {
    // When file changes, ensure the new file's content is loaded
    if (prevProps.file !== this.props.file) {
      this._ensureContentLoaded();
    }

    // Only sync models when the file reference changes — not on every re-render.
    // Re-syncing on every render can overwrite in-progress edits that haven't
    // propagated through onChange → _handleContentUpdated → file.setContent yet.
    if (this._monaco && prevProps.file !== this.props.file) {
      this._ensureModels(this._monaco);
    }

    // Update enhancements when project item changes
    if (prevProps.item !== this.props.item || prevProps.project !== this.props.project) {
      this._enhancements.updateFileContext(this.props.item, this.props.project);
    }

    // Update live preview when the file changes
    if (prevProps.file !== this.props.file && this.state.showLivePreview) {
      // Give Monaco a moment to switch models before trying to get content
      // Use file content directly in _updateLivePreviewData for more reliability
      window.setTimeout(() => this._updateLivePreviewData(), 50);
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

  componentWillUnmount() {
    this._isMounted = false;
    // Clean up editor enhancements
    this._enhancements.dispose();

    // Clean up auto-suggest listener
    if (this._autoSuggestDisposable) {
      this._autoSuggestDisposable.dispose();
      this._autoSuggestDisposable = undefined;
    }
    if (this._autoSuggestTimer) {
      clearTimeout(this._autoSuggestTimer);
      this._autoSuggestTimer = undefined;
    }
  }

  /**
   * Handle widget actions from content widgets (e.g., clicking texture thumbnails)
   */
  _handleWidgetAction(action: string, target?: string) {
    if (action === "openItem" && target && this.props.onOpenProjectItem) {
      // Request to open a project item (e.g., texture)
      this.props.onOpenProjectItem(target);
    } else if (action === "copyColor" && target) {
      // Color was copied to clipboard - could show a toast notification here
      Log.verbose(`Color ${target} copied to clipboard`);
    }
  }

  async _considerFormat() {
    if (this.editor && this.props.project && this.props.project.creatorTools.formatBeforeSave) {
      const action = this.editor.getAction("editor.action.formatDocument");

      if (action) {
        this._suppressContentUpdate = true;
        try {
          await action.run();
        } finally {
          this._suppressContentUpdate = false;
        }
      }
    }
  }

  _handleContentUpdated(newValue: string | undefined, event: any) {
    // Skip content updates triggered by format-on-load to prevent phantom edits
    if (this._suppressContentUpdate) {
      // Still update live preview, but don't mark file as modified
      if (this.state.showLivePreview && newValue) {
        try {
          const fixedContent = Utilities.fixJsonContent(newValue);
          const jsonData = JSON.parse(fixedContent);
          this.setState({ livePreviewJsonData: jsonData, livePreviewError: undefined });
        } catch {
          // Ignore parse errors during format
        }
      }
      return;
    }

    this._needsPersistence = true;

    if (this.editor !== undefined && this.state.fileToEdit && !this.props.readOnly && newValue) {
      this.state.fileToEdit.setContent(newValue, FileUpdateType.regularEdit, this.getEditorInstanceId());
    }

    // Update live preview if enabled
    if (this.state.showLivePreview && newValue) {
      try {
        // Strip comments from JSON content before parsing
        const fixedContent = Utilities.fixJsonContent(newValue);
        const jsonData = JSON.parse(fixedContent);
        this.setState({ livePreviewJsonData: jsonData, livePreviewError: undefined });
      } catch (error) {
        // Show parse error in preview panel
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.setState({ livePreviewJsonData: undefined, livePreviewError: errorMessage });
      }
    }
  }

  async persist(): Promise<boolean> {
    if (this.editor !== undefined && this.state.fileToEdit && !this.props.readOnly && this._needsPersistence) {
      this._needsPersistence = false;

      // Suppress onChange during format to prevent double-write:
      // _considerFormat triggers Monaco onChange → _handleContentUpdated → setContent,
      // but persist() also calls setContent below with the final value.
      this._suppressContentUpdate = true;
      try {
        await this._considerFormat();
      } finally {
        this._suppressContentUpdate = false;
      }

      const value = this.editor.getValue();

      if (value.length > 0 || !this.state.fileToEdit.content || this.state.fileToEdit.content.length < 1) {
        this.state.fileToEdit.setContent(value, FileUpdateType.regularEdit, this.getEditorInstanceId());
        return true;
      }
    }

    return false;
  }

  _runEditorAction(actionId: string) {
    if (!this.editor) {
      return;
    }

    const action = this.editor.getAction(actionId);
    if (action) {
      action.run();
      this.editor.focus();
    }
  }

  _openFind() {
    this._runEditorAction("actions.find");
  }

  _showStatusMessage(message: string) {
    this.setState({ statusMessage: message });
  }

  _handleCloseStatus() {
    this.setState({ statusMessage: undefined });
  }

  _showHoverDocs() {
    if (!this.editor || !this._monaco) {
      return;
    }

    const position = this.editor.getPosition();
    if (!position) {
      this._showStatusMessage(this.props.intl.formatMessage({ id: "project_editor.json_ed.place_cursor_property" }));
      return;
    }

    const model = this.editor.getModel();
    if (!model) {
      return;
    }

    // Try to position cursor on a JSON key if it's currently on whitespace or punctuation
    const lineContent = model.getLineContent(position.lineNumber);
    const trimmed = lineContent.trim();

    if (
      trimmed.length === 0 ||
      trimmed === "{" ||
      trimmed === "}" ||
      trimmed === "[" ||
      trimmed === "]" ||
      trimmed === ","
    ) {
      this._showStatusMessage(this.props.intl.formatMessage({ id: "project_editor.json_ed.place_cursor_name" }));
      return;
    }

    this._runEditorAction("editor.action.showHover");
  }

  _showQuickFix() {
    if (!this.editor || !this._monaco) {
      return;
    }

    const model = this.editor.getModel();
    if (!model) {
      return;
    }

    // Get all markers (errors/warnings) for this model
    const markers = this._monaco.editor.getModelMarkers({ resource: model.uri });

    if (markers.length === 0) {
      this._showStatusMessage(this.props.intl.formatMessage({ id: "project_editor.json_ed.no_issues" }));
      return;
    }

    // Find the next marker after the current cursor position
    const position = this.editor.getPosition();
    let targetMarker = markers[0];

    if (position) {
      // Sort markers by position
      const sorted = [...markers].sort((a, b) => {
        if (a.startLineNumber !== b.startLineNumber) {
          return a.startLineNumber - b.startLineNumber;
        }
        return a.startColumn - b.startColumn;
      });

      // Find the first marker after the current cursor position
      const nextMarker = sorted.find(
        (m) =>
          m.startLineNumber > position.lineNumber ||
          (m.startLineNumber === position.lineNumber && m.startColumn > position.column)
      );

      // If no marker after cursor, wrap around to first marker
      targetMarker = nextMarker || sorted[0];
    }

    // Navigate to the marker
    this.editor.setPosition({
      lineNumber: targetMarker.startLineNumber,
      column: targetMarker.startColumn,
    });
    this.editor.revealLineInCenter(targetMarker.startLineNumber);
    this.editor.focus();

    // Now trigger quick fix at the marker location
    this._runEditorAction("editor.action.quickFix");
  }

  _toggleQuickDiff() {
    this.setState((prev) => ({ showQuickDiff: !prev.showQuickDiff }));
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

    if (val !== undefined && this.props.onUpdatePreferredTextSize) {
      this.props.onUpdatePreferredTextSize(Math.round(val));
    }
  }

  /**
   * Checks if the current item type supports live preview
   */
  _supportsLivePreview(): boolean {
    if (!this.props.item) {
      return false;
    }

    const itemType = this.props.item.itemType;
    const supportedTypes = [
      ProjectItemType.blockTypeBehavior,
      ProjectItemType.entityTypeBehavior,
      ProjectItemType.entityTypeResource,
      ProjectItemType.itemTypeBehavior,
      ProjectItemType.recipeBehavior,
      ProjectItemType.lootTableBehavior,
      ProjectItemType.spawnRuleBehavior,
      ProjectItemType.renderControllerJson,
      ProjectItemType.attachableResourceJson,
      ProjectItemType.soundCatalog,
      ProjectItemType.soundDefinitionCatalog,
      ProjectItemType.featureBehavior,
      ProjectItemType.featureRuleBehavior,
      ProjectItemType.behaviorPackManifestJson,
      ProjectItemType.resourcePackManifestJson,
      ProjectItemType.voxelShapeBehavior,
    ];
    return supportedTypes.includes(itemType);
  }

  /**
   * Toggle live preview panel visibility and parse JSON for preview
   */
  _toggleLivePreview() {
    const newShowLivePreview = !this.state.showLivePreview;
    let jsonData: any = undefined;

    if (newShowLivePreview) {
      // Parse current editor content for the live preview
      jsonData = this._getCurrentJsonData();
    }

    // Persist the setting to CreatorTools
    if (this.props.project?.creatorTools) {
      this.props.project.creatorTools.showLivePreview = newShowLivePreview;
      this.props.project.creatorTools.save();
    }

    this.setState({
      showLivePreview: newShowLivePreview,
      livePreviewJsonData: jsonData,
    });
  }

  /**
   * Handle mouse down on the resize divider to start resizing
   */
  _handleResizeStart(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    this._resizeStartX = e.clientX;
    this._resizeStartWidth = this.state.previewWidth;

    // Add event listeners for mouse move and mouse up
    document.addEventListener("mousemove", this._handleResizeMove);
    document.addEventListener("mouseup", this._handleResizeEnd);

    this.setState({ isResizing: true });
  }

  /**
   * Handle mouse move during resize - calculate new width
   */
  _handleResizeMove(e: MouseEvent) {
    if (!this.state.isResizing) return;

    // Calculate how much the mouse has moved (negative = dragging left = making preview wider)
    const deltaX = this._resizeStartX - e.clientX;
    let newWidth = this._resizeStartWidth + deltaX;

    // Get container width to enforce minimum editor width
    const containerWidth = this._containerRef?.offsetWidth ?? 800;
    const maxPreviewWidth = containerWidth - MIN_EDITOR_WIDTH - 10; // 10px for divider

    // Clamp to min/max
    newWidth = Math.max(MIN_PREVIEW_WIDTH, Math.min(newWidth, Math.min(MAX_PREVIEW_WIDTH, maxPreviewWidth)));

    this.setState({ previewWidth: newWidth });
  }

  /**
   * Handle mouse up to end resizing and persist the new width
   */
  _handleResizeEnd() {
    document.removeEventListener("mousemove", this._handleResizeMove);
    document.removeEventListener("mouseup", this._handleResizeEnd);

    const newWidth = this.state.previewWidth;

    // Persist the new width
    if (this.props.onUpdateLivePreviewWidth && newWidth !== this._resizeStartWidth) {
      this.props.onUpdateLivePreviewWidth(newWidth);
    }

    this.setState({ isResizing: false, previewWidth: newWidth });
  }

  /**
   * Handle navigation from the live preview to a specific path in the JSON.
   * This finds the JSON path and navigates the Monaco editor to that location.
   * Works in both web editor and VS Code extension contexts.
   *
   * @param path - Navigation path like "components/minecraft:health" or "events/minecraft:entity_born"
   */
  _handlePreviewNavigate(path: string): void {
    if (!this.editor) {
      return;
    }

    try {
      const content = this.editor.getValue();
      if (!content) return;

      // Parse the path to determine what we're looking for
      const parts = path.split("/");
      if (parts.length < 2) return;

      const [section, key] = parts;

      // Build the search pattern based on section type
      let searchKey: string;
      if (section === "components") {
        // For components, search within "components": { ... "key": ...
        searchKey = `"${key}"`;
      } else if (section === "component_groups") {
        // For component groups, search within "component_groups": { ... "key": ...
        searchKey = `"${key}"`;
      } else if (section === "events") {
        // For events, search within "events": { ... "key": ...
        searchKey = `"${key}"`;
      } else {
        searchKey = `"${key}"`;
      }

      // Find the position of the key in the editor
      const model = this.editor.getModel();
      if (!model) return;

      const matches = model.findMatches(searchKey, true, false, true, null, true);

      if (matches.length > 0) {
        // Try to find the match within the correct section
        let targetMatch = matches[0];

        // For better accuracy, look for matches that appear after the section header
        const sectionHeader =
          section === "component_groups" ? '"component_groups"' : section === "events" ? '"events"' : '"components"';
        const sectionMatches = model.findMatches(sectionHeader, true, false, true, null, true);

        if (sectionMatches.length > 0) {
          const sectionLine = sectionMatches[0].range.startLineNumber;
          // Find the first key match that's after the section header
          for (const match of matches) {
            if (match.range.startLineNumber > sectionLine) {
              targetMatch = match;
              break;
            }
          }
        }

        // Navigate to the match
        this.editor.setPosition({
          lineNumber: targetMatch.range.startLineNumber,
          column: targetMatch.range.startColumn,
        });
        this.editor.revealLineInCenter(targetMatch.range.startLineNumber);

        // Highlight the found text
        this.editor.setSelection(targetMatch.range);

        // Focus the editor
        this.editor.focus();
      }
    } catch (error) {
      // Silently fail if navigation doesn't work
      Log.debug(`JsonEditor preview navigation error: ${error}`);
    }
  }

  /**
   * Get the current JSON data from the editor or file
   */
  _getCurrentJsonData(): any {
    try {
      let content: string | undefined;

      if (this.editor) {
        content = this.editor.getValue();
      } else if (this.state.fileToEdit && typeof this.state.fileToEdit.content === "string") {
        content = this.state.fileToEdit.content;
      } else if (this.state.content) {
        content = this.state.content;
      }

      if (content) {
        // Strip comments from JSON content before parsing
        const fixedContent = Utilities.fixJsonContent(content);
        return JSON.parse(fixedContent);
      }
    } catch {
      // Return undefined if JSON parsing fails
    }
    return undefined;
  }

  /**
   * Get the current JSON data from the editor or file, with error information
   */
  _getCurrentJsonDataWithError(): { data: any; error?: string } {
    try {
      let content: string | undefined;

      if (this.editor) {
        content = this.editor.getValue();
      } else if (this.state.fileToEdit && typeof this.state.fileToEdit.content === "string") {
        content = this.state.fileToEdit.content;
      } else if (this.state.content) {
        content = this.state.content;
      }

      if (content) {
        // Strip comments from JSON content before parsing
        const fixedContent = Utilities.fixJsonContent(content);
        return { data: JSON.parse(fixedContent) };
      }
    } catch (error) {
      return { data: undefined, error: error instanceof Error ? error.message : String(error) };
    }
    return { data: undefined };
  }

  /**
   * Render the appropriate live preview component based on item type
   */
  _renderLivePreview(): JSX.Element | null {
    if (!this.state.showLivePreview || !this.props.item) {
      return null;
    }

    // If there's a parse error, show it
    if (this.state.livePreviewError) {
      return (
        <div className="jse-preview-error">
          <div className="jse-preview-error-title">⚠️ {this.props.intl.formatMessage({ id: "project_editor.json_ed.json_parse_error" })}</div>
          <div className="jse-preview-error-message">{this.state.livePreviewError}</div>
        </div>
      );
    }

    const itemType = this.props.item.itemType;
    const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
    const jsonData = this.state.livePreviewJsonData;

    switch (itemType) {
      case ProjectItemType.blockTypeBehavior:
        return (
          <BlockTypeLivePreview
            jsonData={jsonData}
            identifier={this.props.item.name}
            darkTheme={isDark}
            showValidation={true}
            onNavigate={this._handlePreviewNavigate}
          />
        );
      case ProjectItemType.entityTypeBehavior:
        return (
          <EntityTypeLivePreview
            jsonData={jsonData}
            identifier={this.props.item.name}
            darkTheme={isDark}
            showValidation={true}
            onNavigate={this._handlePreviewNavigate}
          />
        );
      case ProjectItemType.entityTypeResource:
        return (
          <EntityTypeResourceLivePreview
            jsonData={jsonData}
            identifier={this.props.item.name}
            darkTheme={isDark}
            onNavigate={this._handlePreviewNavigate}
          />
        );
      case ProjectItemType.itemTypeBehavior:
        return (
          <ItemTypeLivePreview
            jsonData={jsonData}
            identifier={this.props.item.name}
            darkTheme={isDark}
            onNavigate={this._handlePreviewNavigate}
          />
        );
      case ProjectItemType.recipeBehavior:
        return (
          <RecipeLivePreview
            jsonData={jsonData}
            identifier={this.props.item.name}
            darkTheme={isDark}
            onNavigate={this._handlePreviewNavigate}
          />
        );
      case ProjectItemType.lootTableBehavior:
        return (
          <LootTableLivePreview
            jsonData={jsonData}
            identifier={this.props.item.name}
            darkTheme={isDark}
            onNavigate={this._handlePreviewNavigate}
          />
        );
      case ProjectItemType.spawnRuleBehavior:
        return (
          <SpawnRuleLivePreview
            jsonData={jsonData}
            identifier={this.props.item.name}
            darkTheme={isDark}
            onNavigate={this._handlePreviewNavigate}
          />
        );
      case ProjectItemType.renderControllerJson:
        return (
          <RenderControllerLivePreview
            jsonData={jsonData}
            identifier={this.props.item.name}
            darkTheme={isDark}
            onNavigate={this._handlePreviewNavigate}
          />
        );
      case ProjectItemType.attachableResourceJson:
        return (
          <AttachableLivePreview
            jsonData={jsonData}
            identifier={this.props.item.name}
            darkTheme={isDark}
            onNavigate={this._handlePreviewNavigate}
          />
        );
      case ProjectItemType.soundCatalog:
      case ProjectItemType.soundDefinitionCatalog:
        return (
          <SoundDefinitionLivePreview
            jsonData={jsonData}
            identifier={this.props.item.name}
            darkTheme={isDark}
            onNavigate={this._handlePreviewNavigate}
          />
        );
      case ProjectItemType.featureBehavior:
      case ProjectItemType.featureRuleBehavior:
        return (
          <FeatureLivePreview
            jsonData={jsonData}
            identifier={this.props.item.name}
            darkTheme={isDark}
            onNavigate={this._handlePreviewNavigate}
            isFeatureRule={itemType === ProjectItemType.featureRuleBehavior}
          />
        );
      case ProjectItemType.behaviorPackManifestJson:
        return (
          <ManifestLivePreview
            jsonData={jsonData}
            identifier={this.props.item.name}
            packType="behavior"
            darkTheme={isDark}
            onNavigate={this._handlePreviewNavigate}
          />
        );
      case ProjectItemType.resourcePackManifestJson:
        return (
          <ManifestLivePreview
            jsonData={jsonData}
            identifier={this.props.item.name}
            packType="resource"
            darkTheme={isDark}
            onNavigate={this._handlePreviewNavigate}
          />
        );
      case ProjectItemType.voxelShapeBehavior:
        return (
          <VoxelShapeLivePreview
            jsonData={jsonData}
            identifier={this.props.item.name}
            darkTheme={isDark}
            onNavigate={this._handlePreviewNavigate}
          />
        );
      default:
        return null;
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

    // Show loading placeholder while file content is being loaded
    // This prevents the disconcerting blank editor flash
    // Only check contentReady (file loaded) - isLoaded is for Monaco which needs to mount first
    if (!this.state.contentReady && !this.state.content && this.state.fileToEdit) {
      return (
        <div
          className="jse-area"
          style={{
            minHeight: height,
            maxHeight: height,
          }}
        >
          <div className="jse-toolBar">
            <Stack direction="row" spacing={0.5} aria-label={this.props.intl.formatMessage({ id: "project_editor.json_ed.toolbar_aria" })} />
          </div>
          <div className="jse-content">
            <div className="jse-editor-pane">
              <div className="jse-loading-placeholder" style={{ height: editorHeight }}>
                <div className="jse-loading-spinner" />
                <div className="jse-loading-message">Loading content...</div>
              </div>
            </div>
          </div>
        </div>
      );
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

      const quickDiffBaseline = coreUri ? this._quickDiffBaselines.get(coreUri) : undefined;
      const quickDiffModified =
        this.editor?.getValue?.() ??
        (this.state.fileToEdit && typeof this.state.fileToEdit.content === "string"
          ? this.state.fileToEdit.content
          : undefined) ??
        (typeof this.state.content === "string" ? this.state.content : undefined);

      if (
        !this.props.isDiffEditor &&
        this.state.showQuickDiff &&
        quickDiffBaseline !== undefined &&
        quickDiffModified !== undefined
      ) {
        interior = (
          <div>
            <div className="jse-dffEditorHeader">
              <div className="jse-coreLabel">{this.props.intl.formatMessage({ id: "project_editor.json_ed.initial_snapshot" })}</div>
              <div className="jse-diffLabel">{coreUri || this.props.intl.formatMessage({ id: "project_editor.json_ed.current_file" })}</div>
            </div>
            <div>
              <DiffEditor
                height={editorHeight}
                theme={theme}
                originalLanguage="json"
                modifiedLanguage="json"
                original={quickDiffBaseline}
                modified={quickDiffModified}
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
      } else if (
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
        if (this.state.fileToEdit) {
          // Provide value as a fallback when coreUri is not yet available (isLoaded=false).
          // Without this, Monaco creates an empty model and shows blank content until
          // _ensureModels completes and sets isLoaded=true with the correct model URI.
          const fallbackValue =
            !coreUri && this.state.fileToEdit.content && typeof this.state.fileToEdit.content === "string"
              ? this.state.fileToEdit.content
              : undefined;

          interior = (
            <Editor
              height={editorHeight}
              theme={theme}
              defaultLanguage="json"
              options={{
                fontSize: this.props.preferredTextSize,
                readOnly: this.props.readOnly,
                renderValidationDecorations: this.props.readOnly ? "on" : "editable",
                wordWrap: "on",
                codeLens: true,
                inlayHints: { enabled: "on" },
                quickSuggestions: {
                  other: true,
                  comments: false,
                  strings: true,
                },
                quickSuggestionsDelay: 50,
                suggestOnTriggerCharacters: true,
                wordBasedSuggestions: "off",
                suggest: {
                  showProperties: true,
                  showKeywords: true,
                  filterGraceful: true,
                  snippetsPreventQuickSuggestions: false,
                },
              }}
              path={coreUri}
              value={fallbackValue}
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
                wordWrap: "on",
                codeLens: true,
                inlayHints: { enabled: "on" },
                quickSuggestions: {
                  other: true,
                  comments: false,
                  strings: true,
                },
                quickSuggestionsDelay: 50,
                suggestOnTriggerCharacters: true,
                wordBasedSuggestions: "off",
                suggest: {
                  showProperties: true,
                  showKeywords: true,
                  filterGraceful: true,
                  snippetsPreventQuickSuggestions: false,
                },
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

    // Determine if we should show the split layout with live preview
    const showLivePreviewPanel = this.state.showLivePreview && this._supportsLivePreview();

    // Calculate preview pane width - use state width which can be resized
    const previewWidth = this.state.previewWidth;

    return (
      <div
        ref={(ref) => (this._containerRef = ref)}
        className={`jse-area ${showLivePreviewPanel ? "jse-with-preview" : ""} ${this.state.isResizing ? "jse-resizing" : ""}`}
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="jse-toolBar">
          <Stack direction="row" spacing={0.5} aria-label={this.props.intl.formatMessage({ id: "project_editor.json_ed.toolbar_aria" })}>
            <IconButton size="small" onClick={this._zoomIn} title={this.props.intl.formatMessage({ id: "project_editor.json_ed.zoom_in_title" })} aria-label="Zoom in">
              <FontAwesomeIcon icon={faSearchPlus} />
            </IconButton>
            <IconButton
              size="small"
              onClick={this._zoomOut}
              title={this.props.intl.formatMessage({ id: "project_editor.json_ed.zoom_out_title" })}
              aria-label="Zoom out"
            >
              <FontAwesomeIcon icon={faSearchMinus} />
            </IconButton>
            <IconButton size="small" onClick={this._openFind} title={this.props.intl.formatMessage({ id: "project_editor.json_ed.find_title" })} aria-label={this.props.intl.formatMessage({ id: "project_editor.json_ed.find_aria" })}>
              <FontAwesomeIcon icon={faSearch} />
            </IconButton>
            <IconButton
              size="small"
              onClick={this._showHoverDocs}
              title={this.props.intl.formatMessage({ id: "project_editor.json_ed.hover_docs_title" })}
              aria-label={this.props.intl.formatMessage({ id: "project_editor.json_ed.hover_docs_aria" })}
            >
              <FontAwesomeIcon icon={faEye} />
            </IconButton>
            <IconButton
              size="small"
              onClick={this._showQuickFix}
              title={this.props.intl.formatMessage({ id: "project_editor.json_ed.quick_fix_title" })}
              aria-label={this.props.intl.formatMessage({ id: "project_editor.json_ed.quick_fix_aria" })}
            >
              <FontAwesomeIcon icon={faExclamationTriangle} />
            </IconButton>
            <IconButton
              size="small"
              onClick={this._toggleQuickDiff}
              title={this.state.showQuickDiff ? this.props.intl.formatMessage({ id: "project_editor.json_ed.hide_diff" }) : this.props.intl.formatMessage({ id: "project_editor.json_ed.compare_snapshot" })}
              aria-label={this.props.intl.formatMessage({ id: "project_editor.json_ed.toggle_diff_aria" })}
            >
              <FontAwesomeIcon icon={faCodeBranch} />
            </IconButton>
            {this._supportsLivePreview() && (
              <IconButton
                size="small"
                onClick={this._toggleLivePreview}
                title={this.state.showLivePreview ? this.props.intl.formatMessage({ id: "project_editor.json_ed.hide_preview" }) : this.props.intl.formatMessage({ id: "project_editor.json_ed.show_preview" })}
                aria-label={this.props.intl.formatMessage({ id: "project_editor.json_ed.toggle_preview_aria" })}
              >
                <FontAwesomeIcon icon={this.state.showLivePreview ? faEyeSlash : faEye} />
              </IconButton>
            )}
          </Stack>
          {this.editor && <JsonPathBreadcrumb editor={this.editor} theme={this.props.theme} />}
        </div>
        <Snackbar
          open={!!this.state.statusMessage}
          autoHideDuration={3000}
          onClose={this._handleCloseStatus}
          message={this.state.statusMessage}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        />
        <div className="jse-content">
          <div
            className={`jse-editor-pane ${showLivePreviewPanel ? "jse-editor-with-preview" : ""}`}
            style={showLivePreviewPanel ? { width: `calc(100% - ${previewWidth + 14}px)` } : undefined}
          >
            {interior}
          </div>
          {showLivePreviewPanel && (
            <>
              <div
                className="jse-resize-divider"
                onMouseDown={this._handleResizeStart}
                title={this.props.intl.formatMessage({ id: "project_editor.json_ed.resize_title" })}
              >
                <div className="jse-resize-handle" />
              </div>
              <div
                className="jse-preview-pane"
                style={{ width: previewWidth, minWidth: MIN_PREVIEW_WIDTH, maxWidth: MAX_PREVIEW_WIDTH }}
              >
                {this._renderLivePreview()}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
}

export { JsonEditor };
export default withLocalization(JsonEditor);

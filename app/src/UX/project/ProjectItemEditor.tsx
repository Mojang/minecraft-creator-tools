/*
 * ==========================================================================================
 * PROJECT ITEM EDITOR ARCHITECTURE NOTES
 * ==========================================================================================
 *
 * OVERVIEW:
 * ---------
 * This component is the main routing hub for editing different types of project items.
 * Based on the ProjectItemType, it renders the appropriate specialized editor component.
 *
 * FORM EDITOR UX GUIDELINES:
 * ==========================
 *
 * THEME SUPPORT (CRITICAL):
 * -------------------------
 * Always implement BOTH light and dark mode. Use the theme object directly:
 *
 *   style={{ backgroundColor: this.props.theme.background2, color: this.props.theme.foreground1 }}
 *
 * Or use getThemeColors() from hooks/theme/useThemeColors for prop-free access.
 *
 * Theme Color Reference:
 *   background1 = main outermost background
 *   background2 = complement/section background
 *   background3 = tertiary background
 *   foreground1 = main text
 *   foreground  = accent foreground (green)
 *   foreground4 = button text
 *
 * ACCENT COLOR: Always use Minecraft green, never blue:
 *   Dark mode accents: #5cff5c, #a2e87a
 *   Light mode accents: #2e7d32, #3b9329
 *
 * LAYOUT PATTERN:
 * ---------------
 * ┌─────────────────────────────────────────────┐
 * │  HEADER (green gradient)                    │
 * │  Icon + Title (uppercase, white)            │
 * ├─────────────────────────────────────────────┤
 * │  CONTENT AREA (scrollable)                  │
 * │  ┌─────────────────────────────────────┐   │
 * │  │ SECTION                              │   │
 * │  │ ┌─────────────────────────────────┐ │   │
 * │  │ │ Section Header (icon + title)   │ │   │
 * │  │ ├─────────────────────────────────┤ │   │
 * │  │ │ Section Content (2-col grid)    │ │   │
 * │  │ └─────────────────────────────────┘ │   │
 * │  └─────────────────────────────────────┘   │
 * └─────────────────────────────────────────────┘
 *
 * CSS CLASS NAMING:
 * -----------------
 * Use short prefix + descriptive name:
 *   {prefix}-outer, {prefix}-header, {prefix}-content, {prefix}-section,
 *   {prefix}-sectionHeader, {prefix}-field, {prefix}-fieldLabel, {prefix}-fieldInput
 *
 * FLUENT UI INPUT WRAPPER FIX:
 * ----------------------------
 * Fluent UI <Input> adds its own border. Remove it:
 *   .fieldInput .ui-input { background: transparent !important; border: none !important; }
 *
 * INPUT STYLING:
 * --------------
 * - 2px solid borders, 4px border radius
 * - Green border (#52a535) on focus
 * - Labels ABOVE inputs, not inline
 *
 * FONT AWESOME ICONS:
 * -------------------
 * - faUser (identity), faFileSignature (docs), faCode (scripts)
 * - faCube/faCubes (blocks/3D), faWrench (tools), faFingerprint (IDs)
 *
 * FILE NAMING:
 * ------------
 * - Component: {ItemType}Editor.tsx (e.g., BiomeEditor.tsx)
 * - Styles: {ItemType}Editor.css
 *
 * INTEGRATION PATTERN FOR NEW EDITORS:
 * ------------------------------------
 * 1. Create {ItemType}Editor.tsx with tabbed interface
 * 2. Add conditional rendering in this file's switch statement
 * 3. Pattern: file.type === "json" && projItem.itemType === ProjectItemType.xxx && !showRaw
 * 4. Pass standard props: item, project, creatorTools, theme, heightOffset, readOnly
 *
 * ==========================================================================================
 */

import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import JsonEditorWithValidation from "../codeEditors/JsonEditorWithValidation";

import IPersistable from "../types/IPersistable";
import { ProjectItemCreationType, ProjectItemStorageType, ProjectItemType } from "../../app/IProjectItemData";
import WorldTestEditor from "../editors/worldTest/WorldTestEditor";
import IGitHubInfo from "../../app/IGitHubInfo";
import GitHubReferenceEditor from "../io/GitHubReferenceEditor";

// Lazy-loaded heavy components (Monaco ~4MB, Babylon ~8MB, Blockly ~1MB)
import {
  LazyJavaScriptEditor,
  LazyJsonEditor,
  LazyFunctionEditor,
  LazyTextEditor,
  LazyStructureEditor,
  LazyMCWorldEditor,
  LazyActionSetEditor,
  LazyModelViewer,
} from "../appShell/LazyComponents";
import { ScriptEditorRole } from "../utils/ScriptEditorRole";

import "./ProjectItemEditor.css";
import { Stack, Button, FormControl, Select, MenuItem, SelectChangeEvent } from "@mui/material";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import { ProjectEditPreference, ProjectScriptLanguage } from "../../app/IProjectData";
import DocumentedModuleEditor from "../editors/docs/DocumentedModuleEditor";
import DocumentedCommandSetEditor from "../editors/docs/DocumentedCommandSetEditor";
import Utilities from "../../core/Utilities";
import CreatorToolsHost, { HostType } from "../../app/CreatorToolsHost";
import NpmPackageEditor from "../io/NpmPackageEditor";
import BehaviorPackManifestJsonEditor from "../editors/manifest/BehaviorPackManifestJsonEditor";
import ImageManager from "../media/ImageManager";
import DataFormEditor from "../codeEditors/DataFormEditor";
import ProjectItemUtilities, { FormMappings } from "../../app/ProjectItemUtilities";
import ProjectInfoDisplay from "./projectInfo/ProjectInfoDisplay";
import EntityTypeEditor from "../editors/entityType/EntityTypeEditor";
import EntityTypeResourceEditor from "../editors/entityType/EntityTypeResourceEditor";
import BlockTypeEditor from "../editors/blockType/BlockTypeEditor";
import AudioManager from "../media/AudioManager";
import ItemTypeEditor from "../editors/itemType/ItemTypeEditor";
import GeneralFormEditor from "../codeEditors/GeneralFormEditor";
import ProjectItemVariant from "../../app/ProjectItemVariant";
import { CustomLabel, CustomTabLabel } from "../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import IFile from "../../storage/IFile";
import { faFile } from "@fortawesome/free-regular-svg-icons";
import ItemTypeAttachableEditor from "../editors/itemType/ItemTypeAttachableEditor";
import BiomeEditor from "../editors/biome/BiomeEditor";
import FeatureEditor from "../editors/feature/FeatureEditor";
import VoxelShapeEditor from "../editors/voxelShape/VoxelShapeEditor";
import { faPlus, faCubes } from "@fortawesome/free-solid-svg-icons";
import { ProjectItemEditorView } from "./ProjectEditorUtilities";
import ProjectMap from "./ProjectMap";
import BiomeResourceEditor from "../editors/biome/BiomeResourceEditor";
import IProjectTheme from "../types/IProjectTheme";
import SpawnRulesEditor from "../components/fileEditors/SpawnRulesEditor/SpawnRulesEditor";
import LootTableEditor from "../components/fileEditors/lootTableEditor/LootTableEditor";

enum ProjectItemEditorDirtyState {
  clean = 0,
  editorDirty = 1,
  itemDirty = 2,
}

interface IProjectItemEditorProps extends IAppProps {
  project: Project;
  theme: IProjectTheme;
  heightOffset: number;
  initialView: ProjectItemEditorView;
  activeVariant?: string;
  visualSeed?: number;
  activeProjectItem: ProjectItem | null;
  activeReference: IGitHubInfo | null;
  readOnly: boolean;
  navigationTarget?: IProjectItemEditorNavigationTarget;
  onNewVariantRequested?: (newVariant: string | undefined) => void;
  onVariantChangeRequested?: (newVariant: string | undefined) => void;
  setActivePersistable?: (persistObject: IPersistable) => void;
  onOpenProjectItem?: (projectPath: string) => void;
}

export interface IProjectItemEditorNavigationTarget {
  requestId: number;
  projectPath: string;
  lineNumber?: number;
  column?: number;
  searchText?: string;
}

interface IProjectItemEditorState {
  dirtyState: ProjectItemEditorDirtyState;
  loadedItem: ProjectItem | null;
  activeView?: ProjectItemEditorView;
  activeViewTarget?: string;
}

export default class ProjectItemEditor extends Component<IProjectItemEditorProps, IProjectItemEditorState> {
  private _activeEditorPersistable?: IPersistable;
  private _isMountedInternal = false;
  private _pendingUpdateItem: ProjectItem | null = null;

  constructor(props: IProjectItemEditorProps) {
    super(props);

    this._handleItemLoaded = this._handleItemLoaded.bind(this);
    this.persist = this.persist.bind(this);
    this._handleNewVariant = this._handleNewVariant.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._onUpdatePreferredTextSize = this._onUpdatePreferredTextSize.bind(this);
    this._onUpdateLivePreviewWidth = this._onUpdateLivePreviewWidth.bind(this);
    this._updateFromProps = this._updateFromProps.bind(this);
    this._handleVariantButton = this._handleVariantButton.bind(this);
    this._handleDefaultVariant = this._handleDefaultVariant.bind(this);
    this._handleDrodownValChange = this._handleDrodownValChange.bind(this);

    if (this.props.activeProjectItem && this.props.activeProjectItem.isContentLoaded) {
      this.state = {
        dirtyState: ProjectItemEditorDirtyState.clean,
        loadedItem: this.props.activeProjectItem,
      };
    } else {
      this.state = {
        dirtyState: ProjectItemEditorDirtyState.clean,
        loadedItem: null,
      };

      this._updateFromProps();
    }

    this._pendingUpdateItem = null;
  }

  componentDidUpdate(prevProps: IProjectItemEditorProps, prevState: IProjectItemEditorState) {
    // Check if the active project item changed - compare CURRENT props to PREVIOUS state.
    // Guard against re-entry: if we're already loading this item, don't call again.
    if (
      this.props.activeProjectItem !== this.state.loadedItem &&
      this.props.activeProjectItem !== this._pendingUpdateItem
    ) {
      this._updateFromProps();
    }

    // Update activeView when initialView prop changes.
    // Only set activeView here — don't pass loadedItem, as doing so can
    // overwrite a concurrent _handleItemLoaded setState when both the active
    // item and the view change in the same render cycle.
    if (prevProps.initialView !== this.props.initialView) {
      this.setState({
        activeView: this.props.initialView,
      });
    }
  }

  private async _updateFromProps() {
    if (this.props.activeProjectItem !== null && this.props.activeProjectItem !== undefined) {
      this._pendingUpdateItem = this.props.activeProjectItem;

      if (!this.props.activeProjectItem.isContentLoaded) {
        if (!this.props.activeProjectItem.onLoaded.has(this._handleItemLoaded)) {
          this.props.activeProjectItem.onLoaded.subscribe(this._handleItemLoaded);
        }

        await this.props.activeProjectItem.loadContent();

        this._handleItemLoaded(this.props.activeProjectItem);
      } else {
        // Always update loadedItem when the active project item changes,
        // even if content is already loaded. Previously, this only ran when
        // loadedItem was null, which meant switching between two already-loaded
        // items would leave loadedItem stale (pointing to the old item).
        if (this.state.loadedItem !== this.props.activeProjectItem) {
          this._handleItemLoaded(this.props.activeProjectItem);
        }
      }
    }
  }

  _handleItemLoaded(source: ProjectItem) {
    if (
      this.props != null &&
      source === this.props.activeProjectItem &&
      this._isMountedInternal &&
      source !== this.state?.loadedItem
    ) {
      this._pendingUpdateItem = null;
      this.setState({
        activeView: this.state.activeView,
        activeViewTarget: this.state.activeViewTarget,
        dirtyState: this.state.dirtyState,
        loadedItem: source,
      });
    }
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this._activeEditorPersistable = newPersistable;
  }

  async persist(): Promise<boolean> {
    if (this._activeEditorPersistable !== undefined) {
      return await this._activeEditorPersistable.persist();
    }

    return false;
  }

  componentDidMount() {
    this._isMountedInternal = true;
  }

  componentWillUnmount(): void {
    this._isMountedInternal = false;
  }

  getActiveProjectItemName() {
    if (this.props.activeProjectItem === null || this.props.activeProjectItem === undefined) {
      return "(no project item selected)";
    } else {
      return this.props.activeProjectItem.projectPath;
    }
  }

  _onUpdatePreferredTextSize(newTextSize: number) {
    this.props.creatorTools.preferredTextSize = newTextSize;
  }

  _onUpdateLivePreviewWidth(newWidth: number) {
    this.props.creatorTools.livePreviewWidth = newWidth;
    this.props.creatorTools.save();
  }

  _handleNewVariant() {
    if (this.props.onNewVariantRequested) {
      this.props.onNewVariantRequested(undefined);
    }
  }

  _handleDefaultVariant() {
    if (this.props.onVariantChangeRequested) {
      this.props.onVariantChangeRequested("");
    }
  }

  _handleVariantButton(ev: React.MouseEvent<HTMLButtonElement>) {
    if (this.props.onVariantChangeRequested) {
      const title = (ev.currentTarget as HTMLElement).title;
      if (title !== undefined) {
        this.props.onVariantChangeRequested(title);
      }
    }
  }

  _handleDrodownValChange(event: SelectChangeEvent<string>) {
    const value = event.target.value;
    if (value && typeof value === "string") {
      let fromIndex = value.indexOf("from ");

      if (value === "Single editor view") {
        this.setState({
          dirtyState: this.state.dirtyState,
          loadedItem: this.state.loadedItem,
          activeView: ProjectItemEditorView.singleFileEditor,
          activeViewTarget: undefined,
        });
      } else if (value === "Single JSON view") {
        this.setState({
          dirtyState: this.state.dirtyState,
          loadedItem: this.state.loadedItem,
          activeView: ProjectItemEditorView.singleFileRaw,
          activeViewTarget: undefined,
        });
      } else if (fromIndex > 0) {
        const variant = value.substring(fromIndex + 5);

        if (variant !== undefined && value.startsWith("Diff from")) {
          this.setState({
            dirtyState: this.state.dirtyState,
            loadedItem: this.state.loadedItem,
            activeView: ProjectItemEditorView.diff,
            activeViewTarget: variant,
          });
        }
      }
    }
  }

  render() {
    let descrip = "No project item selected";
    let file: IFile | null = null;

    if (this.props.activeProjectItem) {
      descrip =
        ProjectItemUtilities.getDescriptionForType(this.props.activeProjectItem.itemType) +
        " - " +
        (this.props.activeProjectItem.projectPath ? this.props.activeProjectItem.projectPath + " " : "");

      if (this.props.activeProjectItem.storageType === ProjectItemStorageType.singleFile) {
        if (this.props.activeVariant === "") {
          file = this.props.activeProjectItem.defaultFile;
        } else if (this.props.activeVariant === undefined) {
          file = this.props.activeProjectItem.primaryFile;
        } else {
          file = this.props.activeProjectItem.getFile(this.props.activeVariant);
        }

        if (!file) {
          // Variant file not in memory — try to load it from storage
          if (this.props.activeVariant && this.props.activeProjectItem) {
            const variant = this.props.activeProjectItem.getVariant(this.props.activeVariant);
            if (variant && variant.projectPath) {
              // Kick off file storage loading asynchronously
              variant.ensureFileStorage().then(() => {
                if (variant.file && this._isMountedInternal) {
                  variant.file.loadContent().then(() => {
                    if (this._isMountedInternal) {
                      this.forceUpdate();
                    }
                  });
                }
              });
              descrip += " - Loading...";
            } else if (!this.props.activeProjectItem.isContentLoaded) {
              descrip += " - Loading...";
            } else if (this.props.activeVariant === "" || this.props.activeVariant === undefined) {
              descrip += " - No default file. Please select a variant if one exists.";
            } else {
              descrip += " - No file for variant `" + this.props.activeVariant + "`.";
            }
          } else {
            // Check if content is still loading
            if (!this.props.activeProjectItem.isContentLoaded) {
              descrip += " - Loading...";
            } else if (this.props.activeVariant === "" || this.props.activeVariant === undefined) {
              descrip += " - No default file. Please select a variant if one exists.";
            } else {
              descrip += " - No file for variant `" + this.props.activeVariant + "`.";
            }
          }
        } else if (file.isContentLoaded) {
          if (file.content === null) {
            descrip = "No default content for " + descrip[0].toLowerCase() + descrip.substring(1);
          } else {
            descrip = "Loaded " + descrip[0].toLowerCase() + descrip.substring(1);
          }
        }
      }
    }

    const navigationTarget =
      this.props.navigationTarget &&
      this.props.activeProjectItem?.projectPath &&
      this.props.navigationTarget.projectPath === this.props.activeProjectItem.projectPath
        ? this.props.navigationTarget
        : undefined;

    let interior =
      this.props.activeProjectItem || this.props.activeReference ? (
        <div className="pie-loadingLabel">{descrip}</div>
      ) : (
        <div
          className="pie-loadingLabel"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            opacity: 0.6,
            textAlign: "center",
            padding: "40px 20px",
          }}
        >
          <FontAwesomeIcon icon={faCubes} style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
          <div style={{ fontSize: "1.1em", marginBottom: 12, fontWeight: "bold" }}>Select an item to start editing</div>
          <div style={{ maxWidth: 360, lineHeight: 1.5 }}>
            Choose a file from the project list on the left, or use the <strong>+ Add</strong> button to create new
            content like entities, blocks, or items.
          </div>
        </div>
      );

    let readOnly = this.props.readOnly;
    let heightOffset = this.props.heightOffset;
    let variantList: ProjectItemVariant[] = [];

    if (this.props.activeReference !== null) {
      interior = (
        <GitHubReferenceEditor
          preferredTextSize={this.props.creatorTools.preferredTextSize}
          project={this.props.project}
          readOnly={readOnly}
          creatorTools={this.props.creatorTools}
          reference={this.props.activeReference}
          heightOffset={heightOffset}
        />
      );
    } else if (this.props.activeProjectItem != null) {
      const ep = this.props.activeProjectItem.effectiveEditPreference;

      if (this.props.activeProjectItem.hasNonDefaultVariant()) {
        heightOffset += 52;
      }

      if (
        this.props.activeProjectItem.creationType !== ProjectItemCreationType.normal &&
        this.props.activeProjectItem.creationType !== undefined
      ) {
        readOnly = true;
      }

      if (this.state.activeView === ProjectItemEditorView.map) {
        interior = (
          <ProjectMap
            theme={this.props.theme}
            creatorTools={this.props.creatorTools}
            heightOffset={heightOffset}
            project={this.props.project}
            sourceItem={this.props.activeProjectItem}
          />
        );
      } else if (this.props.activeProjectItem.itemType === ProjectItemType.worldFolder) {
        const pf = this.props.project.projectFolder;

        if (pf !== null && this.props.activeProjectItem.projectPath) {
          const folder = pf.getFolderFromRelativePathLocal(this.props.activeProjectItem.projectPath);
          interior = (
            <LazyMCWorldEditor
              creatorTools={this.props.creatorTools}
              project={this.props.project}
              readOnly={this.props.readOnly}
              theme={this.props.theme}
              heightOffset={heightOffset}
              displayProps={true}
              folder={folder}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        }
      } else if (
        file !== null &&
        (file.type === "png" ||
          file.type === "jpg" ||
          file.type === "jpeg" ||
          file.type === "tga" ||
          file.type === "psd")
      ) {
        // Image files can be rendered even when content isn't loaded yet - ImageManager handles loading internally
        interior = (
          <ImageManager
            readOnly={this.props.readOnly}
            heightOffset={heightOffset}
            visualSeed={this.props.visualSeed}
            creatorTools={this.props.creatorTools}
            projectItem={this.props.activeProjectItem}
            theme={this.props.theme}
            file={file}
            setActivePersistable={this._handleNewChildPersistable}
          />
        );
      } else if (
        file !== null &&
        (file.type === "mp3" || file.type === "ogg" || file.type === "flac" || file.type === "wav")
      ) {
        // Audio files can be rendered even when content isn't loaded yet - AudioManager handles loading internally
        interior = (
          <AudioManager
            readOnly={this.props.readOnly}
            heightOffset={heightOffset}
            visualSeed={this.props.visualSeed}
            creatorTools={this.props.creatorTools}
            project={this.props.project}
            theme={this.props.theme}
            file={file}
            setActivePersistable={this._handleNewChildPersistable}
          />
        );
      } else if (file !== null && file.isContentLoaded && file.content !== null) {
        if (this.props.setActivePersistable !== undefined) {
          this.props.setActivePersistable(this);
        }

        const projItem = this.props.activeProjectItem;

        // Determine if we should show raw text editor vs specialized form editor
        // "Open in Editor" action sets singleFileEditorForced to explicitly request form view, overriding raw preference
        const editorExplicitlyForced =
          this.props.initialView === ProjectItemEditorView.singleFileEditorForced ||
          this.state.activeView === ProjectItemEditorView.singleFileEditorForced;

        const showRaw =
          this.props.initialView === ProjectItemEditorView.singleFileRaw ||
          (ep === ProjectEditPreference.raw && !editorExplicitlyForced) ||
          file.isInErrorState ||
          this.state.activeView === ProjectItemEditorView.diff ||
          this.state.activeView === ProjectItemEditorView.singleFileRaw;

        // Check if we should show validation view - this bypasses specialized editors
        const showValidation =
          this.props.initialView === ProjectItemEditorView.validationWithJson ||
          this.state.activeView === ProjectItemEditorView.validationWithJson;

        const formCategoryData = FormMappings["" + projItem.itemType];

        if (file.type === "js" || file.type === "ts" || file.type === "mjs") {
          let pref = this.props.project.preferredScriptLanguage;

          if (file.type === "ts") {
            pref = ProjectScriptLanguage.typeScript;
          }

          let role = ScriptEditorRole.script;

          if (projItem.itemType === ProjectItemType.testJs) {
            role = ScriptEditorRole.gameTest;
          }

          interior = (
            <LazyJavaScriptEditor
              role={role}
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
              preferredTextSize={this.props.creatorTools.preferredTextSize}
              readOnly={readOnly}
              project={this.props.project}
              scriptLanguage={pref}
              heightOffset={heightOffset}
              file={file}
              navigationTarget={navigationTarget}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "mcfunction") {
          // because electron doesn't work in debug electron due to odd pathing reasons, use a text editor instead
          if (Utilities.isDebug && CreatorToolsHost.hostType === HostType.electronWeb) {
            interior = (
              <LazyTextEditor
                theme={this.props.theme}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.creatorTools.preferredTextSize}
                readOnly={readOnly}
                creatorTools={this.props.creatorTools}
                heightOffset={heightOffset}
                file={file}
                navigationTarget={navigationTarget}
                setActivePersistable={this._handleNewChildPersistable}
              />
            );
          } else {
            interior = (
              <LazyFunctionEditor
                theme={this.props.theme}
                creatorTools={this.props.creatorTools}
                project={this.props.project}
                roleId={"itemEditor"}
                isCommandEditor={false}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.creatorTools.preferredTextSize}
                readOnly={this.props.readOnly}
                heightOffset={heightOffset}
                file={file}
                navigationTarget={navigationTarget}
                setActivePersistable={this._handleNewChildPersistable}
              />
            );
          }
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.entityTypeBehavior &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <EntityTypeEditor
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              theme={this.props.theme}
              file={file}
              item={this.props.activeProjectItem}
              setActivePersistable={this._handleNewChildPersistable}
              onOpenProjectItem={this.props.onOpenProjectItem}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.blockTypeBehavior &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <BlockTypeEditor
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              theme={this.props.theme}
              file={file}
              item={this.props.activeProjectItem}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.itemTypeBehavior &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <ItemTypeEditor
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              theme={this.props.theme}
              file={file}
              item={this.props.activeProjectItem}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.actionSet &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <LazyActionSetEditor
              readOnly={this.props.readOnly}
              displayTypeDropdown={true}
              project={this.props.project}
              heightOffset={heightOffset}
              theme={this.props.theme}
              file={file}
              creatorTools={this.props.creatorTools}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.modelGeometryJson &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <LazyModelViewer
              creatorTools={this.props.creatorTools}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              theme={this.props.theme}
              projectItem={projItem}
              project={this.props.project}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.worldTest &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <WorldTestEditor
              creatorTools={this.props.creatorTools}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              theme={this.props.theme}
              file={file}
              project={this.props.project}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.scriptTypesJson &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <DocumentedModuleEditor
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              typesReadOnly={true}
              docsReadOnly={this.props.readOnly}
              heightOffset={heightOffset}
              file={file}
              project={this.props.project}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.packageJson &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <NpmPackageEditor
              theme={this.props.theme}
              heightOffset={heightOffset}
              project={this.props.project}
              file={file}
              readOnly={this.props.readOnly}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.behaviorPackManifestJson &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <BehaviorPackManifestJsonEditor
              theme={this.props.theme}
              heightOffset={heightOffset}
              project={this.props.project}
              file={file}
              readOnly={this.props.readOnly}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.spawnRuleBehavior &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <SpawnRulesEditor
              project={this.props.project}
              file={file}
              readOnly={this.props.readOnly}
              setActivePersistable={this._handleNewChildPersistable}
              heightOffset={heightOffset}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.lootTableBehavior &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <LootTableEditor
              project={this.props.project}
              file={file}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.entityTypeResource &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <EntityTypeResourceEditor
              theme={this.props.theme}
              item={this.props.activeProjectItem}
              heightOffset={heightOffset}
              project={this.props.project}
              file={file}
              readOnly={this.props.readOnly}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.attachableResourceJson &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <ItemTypeAttachableEditor
              theme={this.props.theme}
              item={this.props.activeProjectItem}
              creatorTools={this.props.creatorTools}
              heightOffset={heightOffset}
              project={this.props.project}
              file={file}
              readOnly={this.props.readOnly}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.biomeBehavior &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <BiomeEditor
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              theme={this.props.theme}
              file={file}
              item={this.props.activeProjectItem}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.biomeResource &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <BiomeResourceEditor
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              theme={this.props.theme}
              file={file}
              item={this.props.activeProjectItem}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          (projItem.itemType === ProjectItemType.featureBehavior ||
            projItem.itemType === ProjectItemType.featureRuleBehavior) &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <FeatureEditor
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              theme={this.props.theme}
              file={file}
              item={this.props.activeProjectItem}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.voxelShapeBehavior &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <VoxelShapeEditor
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              theme={this.props.theme}
              file={file}
              item={this.props.activeProjectItem}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.commandSetDefinitionJson &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <DocumentedCommandSetEditor
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              typesReadOnly={true}
              docsReadOnly={this.props.readOnly}
              heightOffset={heightOffset}
              file={file}
              project={this.props.project}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          (projItem.itemType === ProjectItemType.contentIndexJson ||
            projItem.itemType === ProjectItemType.contentReportJson) &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <ProjectInfoDisplay
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              heightOffset={heightOffset}
              file={file}
              project={this.props.project}
              indevInfoSet={this.props.project.indevInfoSet}
              indevInfoSetGenerated={this.props.project.indevInfoSet.completedGeneration}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.dataForm &&
          !showRaw &&
          !showValidation
        ) {
          interior = (
            <DataFormEditor
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              heightOffset={heightOffset}
              file={file}
              project={this.props.project}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json" && formCategoryData && !showRaw && !showValidation) {
          interior = (
            <GeneralFormEditor
              project={this.props.project}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              theme={this.props.theme}
              file={file}
              formCategory={formCategoryData.formCategory}
              formName={formCategoryData.formName}
              select={formCategoryData.select}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "geometry" ||
          file.type === "vertex" ||
          file.type === "fragment" ||
          file.type === "lang" ||
          file.type === "md" ||
          file.type === "env"
        ) {
          interior = (
            <LazyTextEditor
              theme={this.props.theme}
              onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
              preferredTextSize={this.props.creatorTools.preferredTextSize}
              readOnly={readOnly}
              creatorTools={this.props.creatorTools}
              heightOffset={heightOffset}
              file={file}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json" || file.type === "material") {
          // because monaco doesn't work in debug electron due to odd pathing reasons, use a text editor instead
          if (
            this.state.activeView === ProjectItemEditorView.diff &&
            this.state.activeViewTarget &&
            this.props.activeProjectItem.getFile(this.state.activeViewTarget) !== null &&
            this.props.activeProjectItem.getFile(this.state.activeViewTarget)?.content
          ) {
            const diffFile = this.props.activeProjectItem.getFile(this.state.activeViewTarget);
            if (diffFile) {
              interior = (
                <LazyJsonEditor
                  theme={this.props.theme}
                  project={this.props.project}
                  onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                  onUpdateLivePreviewWidth={this._onUpdateLivePreviewWidth}
                  preferredTextSize={this.props.creatorTools.preferredTextSize}
                  livePreviewWidth={this.props.creatorTools.livePreviewWidth}
                  readOnly={readOnly}
                  item={this.props.activeProjectItem}
                  heightOffset={heightOffset}
                  file={diffFile}
                  isDiffEditor={true}
                  diffFile={file}
                  setActivePersistable={this._handleNewChildPersistable}
                  onOpenProjectItem={this.props.onOpenProjectItem}
                />
              );
            }
          } else if (showValidation && this.props.project.indevInfoSet) {
            // Show JSON editor with validation issues panel
            interior = (
              <JsonEditorWithValidation
                theme={this.props.theme}
                project={this.props.project}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                onUpdateLivePreviewWidth={this._onUpdateLivePreviewWidth}
                preferredTextSize={this.props.creatorTools.preferredTextSize}
                livePreviewWidth={this.props.creatorTools.livePreviewWidth}
                readOnly={readOnly}
                item={this.props.activeProjectItem}
                heightOffset={heightOffset}
                file={file}
                infoSet={this.props.project.indevInfoSet}
                navigationTarget={navigationTarget}
                setActivePersistable={this._handleNewChildPersistable}
                onOpenProjectItem={this.props.onOpenProjectItem}
              />
            );
          } else {
            interior = (
              <LazyJsonEditor
                theme={this.props.theme}
                project={this.props.project}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                onUpdateLivePreviewWidth={this._onUpdateLivePreviewWidth}
                preferredTextSize={this.props.creatorTools.preferredTextSize}
                livePreviewWidth={this.props.creatorTools.livePreviewWidth}
                readOnly={readOnly}
                item={this.props.activeProjectItem}
                heightOffset={heightOffset}
                file={file}
                navigationTarget={navigationTarget}
                setActivePersistable={this._handleNewChildPersistable}
                onOpenProjectItem={this.props.onOpenProjectItem}
              />
            );
          }
        } else if (file.type === "mcproject" || file.type === "mcworld" || file.type === "mctemplate") {
          interior = (
            <LazyMCWorldEditor
              creatorTools={this.props.creatorTools}
              project={this.props.project}
              theme={this.props.theme}
              readOnly={this.props.readOnly}
              displayProps={true}
              heightOffset={heightOffset}
              file={file}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "mcstructure" || file.type === "snbt") {
          interior = (
            <LazyStructureEditor
              project={this.props.project}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              setActivePersistable={this._handleNewChildPersistable}
              file={file}
            />
          );
        }
      }
    }

    let activeVariant = this.props.activeVariant;

    let primaryVariantLabel = this.props.activeProjectItem?.primaryVariantLabel;

    if (activeVariant === undefined && this.props.activeProjectItem) {
      activeVariant = primaryVariantLabel;
    }

    if (this.props.activeProjectItem?.hasNonDefaultVariant()) {
      variantList = this.props.activeProjectItem.getVariantListMostImportantFirst();
      const colors = getThemeColors();
      const hasDefaultVariantTab = !!(
        this.props.activeProjectItem.defaultFile && this.props.activeProjectItem.defaultFile.content !== null
      );
      const variantTabPanelId = "pie-tabpanel-variants";
      const getVariantTabId = (label?: string) =>
        `pie-tab-${Utilities.sanitizeJavascriptName(label && label.length > 0 ? label : "default")}`;
      const activeVariantTabId =
        activeVariant === "" || activeVariant === undefined
          ? hasDefaultVariantTab
            ? getVariantTabId("default")
            : variantList[0]?.label
              ? getVariantTabId(variantList[0].label)
              : undefined
          : getVariantTabId(activeVariant);
      const items: string[] = [];
      let dropdownVal = "";

      items.push("Single editor view");
      items.push("Single JSON view");

      if (this.state.activeView === ProjectItemEditorView.singleFileEditor || this.state.activeView === undefined) {
        dropdownVal = "Single editor view";
      } else if (this.state.activeView === ProjectItemEditorView.singleFileRaw) {
        dropdownVal = "Single JSON view";
      }

      if (this.props.activeProjectItem.defaultFile && this.props.activeProjectItem.defaultFile.content !== null) {
        if (this.state.activeView === ProjectItemEditorView.diff && !this.state.activeViewTarget) {
          dropdownVal = "Diff from default item";
        }

        items.push("Diff from default item");
      }

      for (const variant of variantList) {
        if (variant.label !== undefined && variant.label !== "") {
          const label = "Diff from " + variant.label;

          if (this.state.activeView === ProjectItemEditorView.diff && this.state.activeViewTarget === variant.label) {
            dropdownVal = label;
          }

          items.push(label);
        }
      }

      return (
        <div className="pie-outer pie-grid">
          <div
            className="pie-variantView"
            style={{
              backgroundColor: colors.background2,
              color: colors.foreground1,
            }}
          >
            <FormControl fullWidth size="small">
              <Select
                id="inptDrop"
                value={dropdownVal}
                onChange={this._handleDrodownValChange}
                sx={{
                  color: colors.foreground1,
                  backgroundColor: colors.background2,
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: colors.cardBorder },
                  "& .MuiSvgIcon-root": { color: colors.foreground1 },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: colors.foreground },
                }}
              >
                {items.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
          <div
            className="pie-viewTabs"
            style={{
              backgroundColor: colors.background2,
              color: colors.foreground1,
            }}
          >
            <Stack direction="row" spacing={1} aria-label="Item actions">
              {!this.props.readOnly && (
                <Button key="newVariant" onClick={this._handleNewVariant} title="New variant">
                  <CustomLabel
                    isCompact={false}
                    text="New Variant"
                    icon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
                  />
                </Button>
              )}
              <Stack direction="row" spacing={1} role="tablist" aria-label="Variants">
                {this.props.activeProjectItem.defaultFile &&
                  this.props.activeProjectItem.defaultFile.content !== null && (
                    <Button
                      key="v."
                      onClick={this._handleDefaultVariant}
                      title="Default item"
                      role="tab"
                      id={getVariantTabId("default")}
                      aria-selected={activeVariant === "" || activeVariant === undefined}
                      aria-controls={variantTabPanelId}
                      tabIndex={activeVariant === "" || activeVariant === undefined ? 0 : -1}
                    >
                      <CustomTabLabel
                        theme={this.props.theme}
                        isSelected={activeVariant === "" || activeVariant === undefined}
                        icon={<FontAwesomeIcon icon={faFile} className="fa-lg" />}
                        text={"Default" + (primaryVariantLabel === undefined ? " (primary)" : "")}
                        isCompact={false}
                      />
                    </Button>
                  )}
                {variantList.map(
                  (variant) =>
                    variant.label !== undefined &&
                    variant.label !== "" && (
                      <Button
                        key={"v." + variant.label}
                        onClick={this._handleVariantButton}
                        title={variant.label}
                        role="tab"
                        id={getVariantTabId(variant.label)}
                        aria-selected={variant.label === activeVariant}
                        aria-controls={variantTabPanelId}
                        tabIndex={variant.label === activeVariant ? 0 : -1}
                      >
                        <CustomTabLabel
                          theme={this.props.theme}
                          isSelected={variant.label === activeVariant}
                          icon={<FontAwesomeIcon icon={faFile} className="fa-lg" />}
                          text={variant.label + (variant.label === primaryVariantLabel ? " (primary)" : "")}
                          isCompact={false}
                        />
                      </Button>
                    )
                )}
              </Stack>
            </Stack>
          </div>
          <div className="pie-interior" role="tabpanel" id={variantTabPanelId} aria-labelledby={activeVariantTabId}>
            {interior}
          </div>
        </div>
      );
    } else {
      return <div className="pie-outer">{interior}</div>;
    }
  }
}

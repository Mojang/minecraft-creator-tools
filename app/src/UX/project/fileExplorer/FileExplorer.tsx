/**
 * ==========================================================================================
 * FILE EXPLORER COMPONENT
 * ==========================================================================================
 *
 * OVERVIEW:
 * ---------
 * FileExplorer provides a tree-based file/folder browser for navigating project content.
 * It supports two modes: file browsing (explorer) and folder selection (folderPicker).
 *
 * ARCHITECTURE - CONTEXT PATTERN:
 * --------------------------------
 * This component uses React Context (FileExplorerContext) to eliminate prop drilling.
 * Instead of passing theme, project, selectedItem, etc. through every child component,
 * we wrap children with FileExplorerProvider and child components access values via:
 *
 *   const { project, theme, selectedItem } = useFileExplorerContext();
 *
 * COMPONENT HIERARCHY:
 * --------------------
 * FileExplorer (this file)
 *   └─ FileExplorerProvider (provides context to all children)
 *       ├─ FileExplorerFolder (recursive folder tree)
 *       │   ├─ FileExplorerFolderDetail (folder row with expand/collapse)
 *       │   ├─ FileExplorerFileDetail (file row with icon and selection)
 *       │   └─ FileExplorerContainerFile (zip/mcaddon container expansion)
 *       └─ FileExplorerFilePreview (optional file preview panel)
 *
 * KEY FEATURES:
 * -------------
 * - MRU (Most Recently Used) items shown at top for quick access
 * - Project item type icons via ProjectItemTypeIcon component
 * - Item annotations (errors, warnings) via ItemAnnotationCollection
 * - Folder creation in folderPicker mode
 * - Optional file preview panel
 * - Responsive layout with compact mode for narrow widths
 *
 * CONTEXT VALUES PROVIDED:
 * ------------------------
 * - project: Current Project for looking up ProjectItems from file paths
 * - theme: FluentUI theme for consistent styling
 * - selectedItem: Currently selected file or folder
 * - mode: FileExplorerMode.explorer or FileExplorerMode.folderPicker
 * - readOnly: Whether the explorer is read-only
 * - Callback functions: onFileSelected, onFolderSelected, onFileDelete, onFileRename
 *
 * RELATED FILES:
 * --------------
 * - FileExplorerContext.tsx: React Context definition and provider
 * - IFileExplorerSharedProps.ts: Shared prop interfaces for child components
 * - ItemAnnotationUtilities.ts: Helper functions for computing annotations
 * - FileExplorerFolder.tsx: Recursive folder tree component
 * - FileExplorerFileDetail.tsx: Individual file row component
 *
 * ==========================================================================================
 */

import { Component } from "react";
import "./FileExplorer.css";
import IFolder from "../../../storage/IFolder";
import FileExplorerFolder from "./FileExplorerFolder";
import { Button, TextField } from "@mui/material";
import CreatorTools from "../../../app/CreatorTools";
import ItemAnnotationCollection from "../../types/ItemAnnotationCollection";
import Project from "../../../app/Project";
import IFile from "../../../storage/IFile";
import StorageUtilities from "../../../storage/StorageUtilities";
import WebUtilities from "../../utils/WebUtilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock, faFolderPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import FileExplorerFilePreview from "./FileExplorerFilePreview";
import { FileExplorerProvider, IFileExplorerContextValue, FileExplorerMode } from "./FileExplorerContext";
import { getAnnotationsForFolder } from "../../types/ItemAnnotationUtilities";
import ProjectItemUtilities from "../../../app/ProjectItemUtilities";
import ColorUtilities from "../../../core/ColorUtilities";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import ProjectItemTypeIcon from "../projectNavigation/ProjectItemTypeIcon";
import ProjectItem from "../../../app/ProjectItem";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";

// Re-export FileExplorerMode from context for backward compatibility
export { FileExplorerMode };

interface IFileExplorerProps {
  rootFolder: IFolder;
  theme: IProjectTheme;
  heightOffset?: number;
  mode: FileExplorerMode;
  forceCompact?: boolean;
  selectFirstFile?: boolean;
  selectedItem?: IFile | IFolder | null | undefined;
  itemAnnotations?: ItemAnnotationCollection;
  expandByDefault?: boolean;
  showPreview?: boolean;
  height?: number;
  onFileSelected?: (file: IFile) => void;
  onFolderSelected?: (folder: IFolder) => void;

  creatorTools: CreatorTools;
  readOnly: boolean;
  project?: Project;

  onRemove?: () => void;
}

interface IFileExplorerState {
  newFolderName: string | undefined;
  selectedItem: IFile | IFolder | null | undefined;
}

export default class FileExplorer extends Component<IFileExplorerProps, IFileExplorerState> {
  constructor(props: IFileExplorerProps) {
    super(props);

    this._handleCloseClick = this._handleCloseClick.bind(this);
    this._handleNewFolderChanged = this._handleNewFolderChanged.bind(this);
    this._handleNewFolderGo = this._handleNewFolderGo.bind(this);

    this._handleNewFileSelected = this._handleNewFileSelected.bind(this);
    this._handleNewFolderSelected = this._handleNewFolderSelected.bind(this);
    this._handleFileDelete = this._handleFileDelete.bind(this);
    this._handleFileRename = this._handleFileRename.bind(this);
    this._handleMruItemClick = this._handleMruItemClick.bind(this);
    this._handleMruItemRemove = this._handleMruItemRemove.bind(this);

    let sel = this.props.selectedItem;

    if (!sel && this.props.selectFirstFile) {
      sel = StorageUtilities.getFirstFile(this.props.rootFolder);
    }

    this.state = {
      newFolderName: undefined,
      selectedItem: sel,
    };
  }

  _handleCloseClick() {
    if (this.props.onRemove) {
      this.props.onRemove();
    }
  }

  /**
   * Creates the context value to be provided to all child components.
   * This eliminates prop drilling for commonly-used values.
   */
  getContextValue(): IFileExplorerContextValue {
    return {
      project: this.props.project,
      theme: this.props.theme,
      selectedItem: this.state.selectedItem,
      mode: this.props.mode,
      readOnly: this.props.readOnly,
      onFileSelected: this._handleNewFileSelected,
      onFolderSelected: this._handleNewFolderSelected,
      onFileDelete: this._handleFileDelete,
      onFileRename: this._handleFileRename,
    };
  }

  async _handleFileDelete(file: IFile) {
    if (this.props.readOnly) {
      return;
    }

    const parentFolder = file.parentFolder;

    if (parentFolder) {
      // Remove corresponding ProjectItem if one exists
      if (this.props.project) {
        const projectItem = this.props.project.getItemByProjectPath(file.storageRelativePath);
        if (projectItem) {
          this.props.project.removeItem(projectItem);
        }
      }

      await parentFolder.deleteFile(file.name);

      // If the deleted file was selected, clear selection
      if (this.state.selectedItem === file) {
        this.setState({
          selectedItem: undefined,
        });
      } else {
        this.forceUpdate();
      }
    }
  }

  async _handleFileRename(file: IFile, newName: string) {
    const invalidChars = /[<>:"/\\|?*]/;
    if (this.props.readOnly || !newName || newName === file.name || invalidChars.test(newName)) {
      return;
    }

    const parentFolder = file.parentFolder;

    if (parentFolder) {
      const wasSelected = this.state.selectedItem === file;
      const newPath = StorageUtilities.joinPath(parentFolder.storageRelativePath, newName);
      await file.moveTo(newPath);

      // Update selection to point to the renamed file
      if (wasSelected) {
        this.setState({ selectedItem: file });
      } else {
        this.forceUpdate();
      }
    }
  }

  _handleNewFolderChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    this.setState({
      newFolderName: e.target.value,
    });
  }

  _handleNewFolderSelected(folder: IFolder) {
    this.setState({
      newFolderName: this.state.newFolderName,
      selectedItem: folder,
    });

    if (this.props.onFolderSelected) {
      this.props.onFolderSelected(folder);
    }
  }

  _handleNewFileSelected(file: IFile) {
    this.setState({
      newFolderName: this.state.newFolderName,
      selectedItem: file,
    });

    if (this.props.onFileSelected) {
      this.props.onFileSelected(file);
    }
  }

  _handleNewFolderGo() {
    if (!this.state.selectedItem) {
      return;
    }

    let name = this.state.newFolderName ? this.state.newFolderName : "New Folder";

    const parentFolder = this.state.selectedItem as IFolder;

    name = StorageUtilities.getUniqueChildFolderName(name, parentFolder);

    const fo = parentFolder.ensureFolder(name);

    this.setState({
      newFolderName: this.state.newFolderName,
      selectedItem: fo,
    });
  }

  /**
   * Returns up to 6 MRU items sorted alphabetically by project path.
   * Uses project item paths from CreatorTools and looks up the corresponding ProjectItems.
   */
  private _getMruItems(): ProjectItem[] {
    if (!this.props.project) return [];

    const mruPaths = this.props.creatorTools.mruItemPaths;
    const projectItems = this.props.project.items;
    const result: ProjectItem[] = [];

    for (const path of mruPaths) {
      if (result.length >= 6) break;

      // Find this path in current project
      const item = projectItems.find((pi) => pi.projectPath === path);
      if (item) {
        result.push(item);
      }
    }

    // Sort alphabetically by name for consistent ordering
    result.sort((a, b) => (a.projectPath ?? "").localeCompare(b.projectPath ?? "", undefined, { sensitivity: "base" }));

    return result;
  }

  private _handleMruItemClick(item: ProjectItem) {
    const file = item.primaryFile;
    if (file && this.props.onFileSelected) {
      this.setState({ selectedItem: file });
      this.props.onFileSelected(file);
    }
  }

  private _handleMruItemRemove(e: React.MouseEvent, item: ProjectItem) {
    e.stopPropagation();
    const path = item.projectPath;
    if (path) {
      this.props.creatorTools.removeFromMru(path);
      this.forceUpdate();
    }
  }

  render() {
    const height = WebUtilities.getHeight();
    const width = WebUtilities.getWidth();

    let isCompact = false;

    if ((width < 1016 && this.props.showPreview) || this.props.forceCompact === true) {
      isCompact = true;
    }

    let explorerHeight = "inherit";
    let folderAreaHeight = "inherit";

    if (isCompact) {
    } else {
      if (this.props.height) {
        explorerHeight = this.props.height + "px";
        folderAreaHeight = this.props.height - 11 + "px";
      } else if (this.props.heightOffset) {
        explorerHeight =
          height > this.props.heightOffset + 100 ? "calc(100vh - " + (this.props.heightOffset - 10) + "px)" : "inherit";

        folderAreaHeight =
          height > this.props.heightOffset + 100 ? "calc(100vh - " + (this.props.heightOffset + 4) + "px)" : "inherit";
      }
    }

    let accessoryArea = <></>;

    if (this.props.mode === FileExplorerMode.folderPicker && this.state.selectedItem) {
      const themeColors = getThemeColors();
      accessoryArea = (
        <div
          className="fex-newFolderArea"
          style={{
            borderColor: themeColors.background3,
          }}
        >
          <div className="fex-newFolderIcon">
            <FontAwesomeIcon icon={faFolderPlus} className="fa-lg" />
          </div>
          <div className="fex-newFolderLabel" title={"Create a new folder at " + this.state.selectedItem.name}>
            <span>(create a new folder at </span>
            <span style={{ backgroundColor: themeColors.background3 }}>{this.state.selectedItem.name}</span>
            <span>):</span>
          </div>
          <div className="fex-newFolderName">
            <TextField
              value={this.state.newFolderName}
              label="New Folder"
              placeholder="New Folder"
              onChange={this._handleNewFolderChanged}
              size="small"
              variant="outlined"
            />
          </div>
          <div className="fex-newFolderGo">
            <Button
              onClick={this._handleNewFolderGo}
              variant="contained"
              size="small"
              disabled={this.state.newFolderName === undefined || this.state.newFolderName.length === 0}
            >
              Create
            </Button>
          </div>
        </div>
      );

      if (this.props.heightOffset) {
        explorerHeight =
          height > this.props.heightOffset + 100
            ? "calc(100vh - " + (this.props.heightOffset + 110) + "px)"
            : "inherit";
        folderAreaHeight =
          height > this.props.heightOffset + 100
            ? "calc(100vh - " + (this.props.heightOffset + 174) + "px)"
            : "inherit";
      }
    }

    let previewArea = <></>;
    let outerClass = "fex-area";
    let folderAreaClass = "fex-folderArea";

    // Build MRU section if conditions are met
    let mruSection = <></>;
    const mruItems = this._getMruItems();
    const showMru =
      this.props.creatorTools.showMruPane &&
      mruItems.length > 2 &&
      this.props.project &&
      this.props.project.items.length >= 30;

    // Get active file path for comparison - prefer props (from parent) over internal state
    const selectedItem = this.props.selectedItem || this.state.selectedItem;
    const activeFilePath = selectedItem ? (selectedItem as IFile).storageRelativePath : undefined;

    if (showMru) {
      const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
      mruSection = (
        <div className={"fex-mruSection" + (isDark ? "" : " fex-mruSection-light")}>
          <div className="fex-mruHeader">
            <FontAwesomeIcon icon={faClock} className="fa-xs" />
            <span>Recent</span>
          </div>
          {mruItems.map((item, index) => {
            const itemColor = ProjectItemUtilities.getColorForType(item.itemType);
            const itemColorCss = ColorUtilities.toCss(itemColor);
            // Compare using projectPath (more reliable) or storageRelativePath as fallback
            const itemFilePath = item.projectPath || item.primaryFile?.storageRelativePath;
            const isActive =
              itemFilePath !== undefined &&
              activeFilePath !== undefined &&
              (itemFilePath === activeFilePath ||
                activeFilePath.endsWith(itemFilePath) ||
                itemFilePath.endsWith(activeFilePath));
            return (
              <div
                key={"mru-" + index}
                className={"fex-mruItem" + (isActive ? " fex-mruItemActive" : "")}
                onClick={isActive ? undefined : () => this._handleMruItemClick(item)}
                title={item.projectPath || item.name}
                style={{ borderLeftColor: itemColorCss }}
              >
                <span className="fex-mruItemGutter">
                  {isActive && <span className="fex-mruItemDot" style={{ backgroundColor: itemColorCss }} />}
                </span>
                <span className="fex-mruItemIcon">
                  <ProjectItemTypeIcon itemType={item.itemType} size={14} color={itemColorCss} />
                </span>
                <span className="fex-mruItemName">{StorageUtilities.getBaseFromName(item.name)}</span>
                <span
                  className="fex-mruItemRemove"
                  onClick={(e) => this._handleMruItemRemove(e, item)}
                  title="Remove from recent"
                  role="button"
                  aria-label={"Remove " + item.name + " from recent"}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    if (this.props.showPreview && this.state.selectedItem && (this.state.selectedItem as IFile).content !== undefined) {
      let previewAreaClass = "fex-previewArea";
      if (isCompact) {
        outerClass = "fex-areaWithPreviewCompact";
        folderAreaClass = "fex-folderAreaCompact";
        previewAreaClass = "fex-previewAreaCompact";
      } else {
        outerClass = "fex-areaWithPreview";
      }

      previewArea = (
        <div className={previewAreaClass}>
          <FileExplorerFilePreview
            selectedItem={this.state.selectedItem as IFile}
            file={this.state.selectedItem as IFile}
            heightOffset={!isCompact ? this.props.heightOffset : undefined}
            height={this.props.height ? this.props.height - 16 : isCompact ? 180 : undefined}
            fileExplorer={this}
            theme={this.props.theme}
            readOnly={this.props.readOnly}
          />
        </div>
      );
    }

    return (
      <FileExplorerProvider value={this.getContextValue()}>
        <div
          className={outerClass}
          style={{
            maxHeight: explorerHeight,
            borderColor: getThemeColors().background4,
          }}
        >
          <div
            className={folderAreaClass}
            style={{
              backgroundColor: getThemeColors().background1,
              maxHeight: folderAreaHeight,
            }}
            role="tree"
          >
            {mruSection}
            <FileExplorerFolder
              folder={this.props.rootFolder}
              startExpanded={true}
              expandByDefault={this.props.expandByDefault}
              itemAnnotations={getAnnotationsForFolder(this.props.itemAnnotations, this.props.rootFolder)}
              fileExplorer={this}
              displayFolderDetail={false}
              depth={0}
            />
          </div>
          {previewArea}
          {accessoryArea}
        </div>
      </FileExplorerProvider>
    );
  }
}

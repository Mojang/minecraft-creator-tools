import { Component, ContextType } from "react";
import "./FileExplorerFolderDetail.css";
import IFolder from "../../../storage/IFolder";
import FileExplorer, { FileExplorerMode } from "./FileExplorer";
import { faFolder } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ItemAnnotationCollection from "../../types/ItemAnnotationCollection";
import { faCaretDown, faCaretRight } from "@fortawesome/free-solid-svg-icons";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { getProjectItemTypeGroup, ProjectItemTypeGroupColors } from "../../../app/ProjectItemTypeInfo";
import { FileExplorerContext } from "./FileExplorerContext";
import { getThemeColors } from "../../hooks/theme/useThemeColors";

interface IFileExplorerFolderDetailProps {
  folder: IFolder;
  fileExplorer: FileExplorer;
  isExpanded: boolean;
  itemAnnotations?: ItemAnnotationCollection;
  onExpandedSet?: (newExpandedValue: boolean) => void;
}

/**
 * State includes cached dominant item type group for performance.
 * The cache is invalidated when folder changes.
 */
interface IFileExplorerFolderDetailState {
  /** Cached dominant item type group (undefined means not yet computed, null means computed as none) */
  cachedDominantGroup: string | null | undefined;
  /** Folder path used to compute the cache - for invalidation */
  cachedForFolderPath: string | undefined;
}

export default class FileExplorerFolderDetail extends Component<
  IFileExplorerFolderDetailProps,
  IFileExplorerFolderDetailState
> {
  static contextType = FileExplorerContext;
  declare context: ContextType<typeof FileExplorerContext>;

  constructor(props: IFileExplorerFolderDetailProps) {
    super(props);

    this.state = {
      cachedDominantGroup: undefined,
      cachedForFolderPath: undefined,
    };

    this._handleToggleExpandedClick = this._handleToggleExpandedClick.bind(this);
    this._handleFolderClick = this._handleFolderClick.bind(this);
    this._handleExpandClick = this._handleExpandClick.bind(this);
    this._handleCollapseClick = this._handleCollapseClick.bind(this);
  }

  _handleFolderClick() {
    if (this.context.onFolderSelected) {
      this.context.onFolderSelected(this.props.folder);
    }
  }

  _handleToggleExpandedClick() {
    if (this.props.onExpandedSet) {
      this.props.onExpandedSet(!this.props.isExpanded);
    }
  }

  _handleCollapseClick() {
    if (this.props.onExpandedSet) {
      this.props.onExpandedSet(false);
    }
  }

  _handleExpandClick() {
    if (this.props.onExpandedSet) {
      this.props.onExpandedSet(true);
    }
  }

  /**
   * Gets the dominant project item type for files contained in this folder.
   * Returns the item type if 100% of the contained files (that have project items)
   * share the same item type group. Returns undefined if mixed or no project items found.
   *
   * This method uses memoization - the result is cached in state and only
   * recomputed when the folder changes.
   */
  getDominantItemTypeGroup(): string | undefined {
    const project = this.context.project;
    if (!project) {
      return undefined;
    }

    // Check if we have a valid cached result
    const folderPath = this.props.folder.extendedPath;
    if (this.state.cachedForFolderPath === folderPath && this.state.cachedDominantGroup !== undefined) {
      // Return cached result (null means "no dominant group")
      return this.state.cachedDominantGroup === null ? undefined : this.state.cachedDominantGroup;
    }

    // Compute the dominant group
    const folder = this.props.folder;
    let dominantGroup: string | undefined = undefined;
    let hasAnyProjectItems = false;

    // Check all files in this folder
    for (const fileName in folder.files) {
      const file = folder.files[fileName];
      if (file) {
        const projectItem = project.getItemByExtendedOrProjectPath(file.extendedPath);
        if (projectItem && projectItem.itemType !== ProjectItemType.unknown) {
          hasAnyProjectItems = true;
          const group = getProjectItemTypeGroup(projectItem.itemType);

          if (dominantGroup === undefined) {
            dominantGroup = group;
          } else if (dominantGroup !== group) {
            // Mixed types, no dominant group - cache and return
            // Use setTimeout to avoid setState during render
            setTimeout(() => {
              this.setState({
                cachedDominantGroup: null,
                cachedForFolderPath: folderPath,
              });
            }, 0);
            return undefined;
          }
        }
      }
    }

    const result = hasAnyProjectItems ? dominantGroup : undefined;

    // Cache the result (use null to represent "no dominant group")
    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      this.setState({
        cachedDominantGroup: result === undefined ? null : result,
        cachedForFolderPath: folderPath,
      });
    }, 0);

    return result;
  }

  /**
   * Gets the color for the folder label based on the dominant item type group.
   */
  getFolderLabelColor(): string | undefined {
    const group = this.getDominantItemTypeGroup();
    if (group) {
      const groupColor = ProjectItemTypeGroupColors[group as keyof typeof ProjectItemTypeGroupColors];
      if (groupColor) {
        // Data-driven color from ProjectItemGroupColor — intentionally inline RGB
        return `rgb(${groupColor.red}, ${groupColor.green}, ${groupColor.blue})`;
      }
    }
    return undefined;
  }

  render() {
    const { theme, selectedItem, mode } = this.context;

    let outerTag = "fexfod-area";

    let backgroundColor = undefined;

    if (selectedItem && selectedItem === this.props.folder) {
      backgroundColor = getThemeColors().background3;
    }

    if (this.props.itemAnnotations) {
      for (const annotationPath in this.props.itemAnnotations) {
        const annotationColl = this.props.itemAnnotations[annotationPath];

        if (annotationColl.length > 0) {
          outerTag += " fexfod-containsAnnotatedItems";
          break;
        }
      }
    }

    let expander = <></>;

    if (
      this.props.folder.folderCount > 0 ||
      (mode !== FileExplorerMode.folderPicker && this.props.folder.fileCount > 0)
    ) {
      expander = (
        <div
          className="fexfod-expander"
          onClick={this._handleToggleExpandedClick}
          onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              this._handleToggleExpandedClick();
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          tabIndex={0}
          role="button"
          aria-expanded={this.props.isExpanded}
          aria-label={(this.props.isExpanded ? "Collapse" : "Expand") + " " + this.props.folder.name}
          title={(this.props.isExpanded ? "Collapse" : "Expand") + " " + this.props.folder.name}
        >
          {this.props.isExpanded ? (
            <FontAwesomeIcon icon={faCaretDown} className="fa-lg" />
          ) : (
            <FontAwesomeIcon icon={faCaretRight} className="fa-lg" />
          )}
        </div>
      );
    }

    return (
      <div
        className={outerTag}
        style={{ backgroundColor: backgroundColor }}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Space") {
            this._handleToggleExpandedClick();
          } else if (e.key === "ArrowLeft") {
            this._handleCollapseClick();
          } else if (e.key === "ArrowRight") {
            this._handleExpandClick();
          } else if (e.key === "Enter") {
            this._handleFolderClick();
          }
        }}
      >
        {expander}
        <div
          aria-selected={!!selectedItem && selectedItem === this.props.folder}
          className="fexfod-summary"
          role="treeitem"
          aria-expanded={this.props.isExpanded}
          tabIndex={0}
          onClick={this._handleFolderClick}
          onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === "Space") {
              this._handleToggleExpandedClick();
              e.preventDefault();
              e.stopPropagation();
            } else if (e.key === "ArrowLeft") {
              this._handleCollapseClick();
              e.preventDefault();
              e.stopPropagation();
            } else if (e.key === "ArrowRight") {
              this._handleExpandClick();
              e.preventDefault();
              e.stopPropagation();
            } else if (e.key === "Enter") {
              this._handleFolderClick();
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          title={"Select " + this.props.folder.name}
          aria-label={"Folder: " + this.props.folder.name}
        >
          <div className="fexfod-icon">
            <FontAwesomeIcon icon={faFolder} className="fa-lg" />
          </div>
          <div className="fexfod-label" style={{ color: this.getFolderLabelColor() }}>
            {this.props.folder.name}
          </div>
        </div>
      </div>
    );
  }
}

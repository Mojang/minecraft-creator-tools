import { Component, ContextType } from "react";
import "./FileExplorerFileDetail.css";
import IFile from "../../../storage/IFile";
import FileExplorer from "./FileExplorer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFile } from "@fortawesome/free-regular-svg-icons";
import ItemAnnotationCollection from "../../types/ItemAnnotationCollection";
import { ItemAnnotationType } from "../../types/ItemAnnotation";
import { faCaretDown, faCaretRight, faEllipsisV } from "@fortawesome/free-solid-svg-icons";
import ProjectItemTypeIcon from "../projectNavigation/ProjectItemTypeIcon";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { FileExplorerContext } from "./FileExplorerContext";
import { ProjectEditorItemAction } from "../ProjectEditorUtilities";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Menu,
  MenuItem as MuiMenuItem,
  IconButton,
} from "@mui/material";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import McButton from "../../shared/components/inputs/mcButton/McButton";

interface IFileExplorerFileDetailProps {
  file: IFile;
  fileExplorer: FileExplorer;
  isExpandable?: boolean;
  isExpanded?: boolean;

  itemAnnotations?: ItemAnnotationCollection;
  onExpandedSet?: (newExpandedValue: boolean) => void;

  onRemove?: () => void;
}

interface IFileExplorerFileDetailState {
  showRenameDialog: boolean;
  renameValue: string;
  menuAnchorEl: HTMLElement | null;
  contextMenuPosition: { top: number; left: number } | null;
}

export default class FileExplorerFileDetail extends Component<
  IFileExplorerFileDetailProps,
  IFileExplorerFileDetailState
> {
  static contextType = FileExplorerContext;
  declare context: ContextType<typeof FileExplorerContext>;

  constructor(props: IFileExplorerFileDetailProps) {
    super(props);

    this._handleCloseClick = this._handleCloseClick.bind(this);
    this._handleToggleExpanderClick = this._handleToggleExpanderClick.bind(this);
    this._handleExpandClick = this._handleExpandClick.bind(this);
    this._handleCollapseClick = this._handleCollapseClick.bind(this);
    this._handleFileClick = this._handleFileClick.bind(this);
    this._handleMenuClick = this._handleMenuClick.bind(this);
    this._handleRenameDialogCancel = this._handleRenameDialogCancel.bind(this);
    this._handleRenameDialogConfirm = this._handleRenameDialogConfirm.bind(this);
    this._handleRenameInputChange = this._handleRenameInputChange.bind(this);
    this._handleMenuButtonClick = this._handleMenuButtonClick.bind(this);
    this._handleMenuClose = this._handleMenuClose.bind(this);
    this._handleContextMenuClose = this._handleContextMenuClose.bind(this);

    this.state = {
      showRenameDialog: false,
      renameValue: props.file.name,
      menuAnchorEl: null,
      contextMenuPosition: null,
    };
  }

  _handleFileClick() {
    if (this.context.onFileSelected) {
      this.context.onFileSelected(this.props.file);
    }
  }

  _handleCloseClick() {
    if (this.props.onRemove) {
      this.props.onRemove();
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

  _handleToggleExpanderClick() {
    if (this.props.onExpandedSet) {
      this.props.onExpandedSet(!this.props.isExpanded);
    }
  }

  _handleMenuClick(action: string) {
    if (action === "Delete") {
      if (this.context.onFileDelete) {
        this.context.onFileDelete(this.props.file);
      }
    } else if (action === "Rename") {
      this.setState({
        showRenameDialog: true,
        renameValue: this.props.file.name,
      });
    }
    this.setState({ menuAnchorEl: null, contextMenuPosition: null });
  }

  _handleMenuButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    this.setState({ menuAnchorEl: event.currentTarget });
  }

  _handleMenuClose() {
    this.setState({ menuAnchorEl: null });
  }

  _handleContextMenuClose() {
    this.setState({ contextMenuPosition: null });
  }

  _handleRenameDialogCancel() {
    this.setState({
      showRenameDialog: false,
    });
  }

  _handleRenameDialogConfirm() {
    const invalidChars = /[<>:"/\\|?*]/;
    if (this.state.renameValue && invalidChars.test(this.state.renameValue)) {
      return;
    }

    if (this.context.onFileRename && this.state.renameValue && this.state.renameValue !== this.props.file.name) {
      this.context.onFileRename(this.props.file, this.state.renameValue);
    }
    this.setState({
      showRenameDialog: false,
    });
  }

  _handleRenameInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({
      renameValue: e.target.value,
    });
  }

  /**
   * Renders the appropriate icon for this file.
   * If the file has a known project item type, shows the ProjectItemTypeIcon.
   * Otherwise, falls back to a generic file icon.
   */
  renderIcon() {
    // Try to get the project item for this file
    if (this.context.project) {
      const projectItem = this.context.project.getItemByExtendedOrProjectPath(this.props.file.extendedPath);
      if (projectItem && projectItem.itemType !== ProjectItemType.unknown) {
        return <ProjectItemTypeIcon itemType={projectItem.itemType} size={16} />;
      }
    }
    // Fallback to generic file icon
    return <FontAwesomeIcon icon={faFile} className="fa-lg" />;
  }

  render() {
    const { theme, selectedItem } = this.context;

    let outerCss = "fexfid-area";
    let title = "";

    let backgroundColor = undefined;

    if (this.props.itemAnnotations) {
      for (const storageName in this.props.itemAnnotations) {
        const annotationColl = this.props.itemAnnotations[storageName];

        for (let i = 0; i < annotationColl.length; i++) {
          if (title.length > 0) {
            title += " ";
          }
          if (annotationColl[i].type === ItemAnnotationType.error && outerCss.indexOf("error") < 1) {
            outerCss += " fexfid-error";
          }

          title += annotationColl[i].message;
        }
      }
    }

    if (selectedItem && selectedItem === this.props.file) {
      backgroundColor = getThemeColors().background3;
      title += " Selected";
    }

    let expandable = <></>;

    if (this.props.isExpandable) {
      expandable = (
        <div
          className="fexfid-expander"
          onClick={this._handleToggleExpanderClick}
          title={"Expand/collapse " + this.props.file.name}
        >
          {this.props.isExpanded ? (
            <FontAwesomeIcon icon={faCaretDown} className="fa-lg" />
          ) : (
            <FontAwesomeIcon icon={faCaretRight} className="fa-lg" />
          )}
        </div>
      );
    }

    const isSelected = selectedItem && selectedItem === this.props.file;

    // Build the context menu items (with keyboard shortcut hints for discoverability)
    const menuItems = [];
    if (!this.context.readOnly) {
      menuItems.push({
        key: "rename",
        content: "Rename",
        shortcut: "F2",
        tag: { action: ProjectEditorItemAction.renameItem },
      });
      menuItems.push({
        key: "delete",
        content: "Delete",
        shortcut: "Del",
        tag: { action: ProjectEditorItemAction.deleteItem },
      });
    }

    // The file summary row content
    const summaryContent = (
      <div
        title={title}
        aria-selected={!!isSelected}
        className="fexfid-summary"
        role="treeitem"
        tabIndex={0}
        onClick={this._handleFileClick}
      >
        <div className="fexfid-icon">{this.renderIcon()}</div>
        <div className="fexfid-label">{this.props.file.name}</div>
      </div>
    );

    // Wrap the summary in a context menu handler, or render directly if no menu
    let summaryWithMenu;
    if (!this.context.readOnly && menuItems.length > 0) {
      summaryWithMenu = (
        <>
          <div
            onContextMenu={(e) => {
              e.preventDefault();
              this.setState({ contextMenuPosition: { top: e.clientY, left: e.clientX } });
            }}
          >
            {summaryContent}
          </div>
          <Menu
            open={this.state.contextMenuPosition !== null}
            onClose={this._handleContextMenuClose}
            anchorReference="anchorPosition"
            anchorPosition={
              this.state.contextMenuPosition !== null
                ? { top: this.state.contextMenuPosition.top, left: this.state.contextMenuPosition.left }
                : undefined
            }
          >
            {menuItems.map((item) => (
              <MuiMenuItem key={item.key} onClick={() => this._handleMenuClick(item.content)}>
                {item.content}
                {item.shortcut && (
                  <span style={{ marginLeft: "auto", paddingLeft: 16, opacity: 0.6, fontSize: "12px" }}>
                    {item.shortcut}
                  </span>
                )}
              </MuiMenuItem>
            ))}
          </Menu>
        </>
      );
    } else {
      summaryWithMenu = summaryContent;
    }

    // Separate "..." menu button for accessibility (visible on hover/focus)
    let menuButton = <></>;
    if (!this.context.readOnly && menuItems.length > 0) {
      menuButton = (
        <div className="fexfid-menuButtonWrapper">
          <IconButton
            className="fexfid-menuButton"
            title="File actions"
            aria-label="File actions"
            size="small"
            onClick={this._handleMenuButtonClick}
          >
            <FontAwesomeIcon icon={faEllipsisV} className="fa-sm" />
          </IconButton>
          <Menu
            anchorEl={this.state.menuAnchorEl}
            open={Boolean(this.state.menuAnchorEl)}
            onClose={this._handleMenuClose}
          >
            {menuItems.map((item) => (
              <MuiMenuItem key={item.key} onClick={() => this._handleMenuClick(item.content)}>
                {item.content}
                {item.shortcut && (
                  <span style={{ marginLeft: "auto", paddingLeft: 16, opacity: 0.6, fontSize: "12px" }}>
                    {item.shortcut}
                  </span>
                )}
              </MuiMenuItem>
            ))}
          </Menu>
        </div>
      );
    }

    // Rename dialog
    const renameDialog = (
      <Dialog open={this.state.showRenameDialog} onClose={this._handleRenameDialogCancel}>
        <DialogTitle>Rename File</DialogTitle>
        <DialogContent>
          <TextField
            value={this.state.renameValue}
            onChange={this._handleRenameInputChange}
            fullWidth
            autoFocus
            size="small"
            variant="outlined"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <McButton variant="stone" onClick={this._handleRenameDialogCancel}>
            Cancel
          </McButton>
          <McButton variant="green" onClick={this._handleRenameDialogConfirm}>
            Rename
          </McButton>
        </DialogActions>
      </Dialog>
    );

    return (
      <div
        className={outerCss}
        style={{ backgroundColor: backgroundColor }}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Space") {
            this._handleToggleExpanderClick();
          } else if (e.key === "ArrowLeft") {
            this._handleCollapseClick();
          } else if (e.key === "ArrowRight") {
            this._handleExpandClick();
          } else if (e.key === "Enter") {
            this._handleFileClick();
          } else if (e.key === "Delete" && !this.context.readOnly) {
            if (this.context.onFileDelete) {
              this.context.onFileDelete(this.props.file);
            }
          } else if (e.key === "F2" && !this.context.readOnly) {
            this.setState({
              showRenameDialog: true,
              renameValue: this.props.file.name,
            });
          }
        }}
      >
        {expandable}
        {summaryWithMenu}
        {menuButton}
        {renameDialog}
      </div>
    );
  }
}

import CreatorToolsHost, { HostType } from "../../../app/CreatorToolsHost";
import AppServiceProxy, { AppServiceProxyCommands } from "../../../core/AppServiceProxy";
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
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Menu,
  MenuItem as MuiMenuItem,
  IconButton,
  Alert,
  InputAdornment,
  Snackbar,
} from "@mui/material";
import { faLock, faLockOpen } from "@fortawesome/free-solid-svg-icons";
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
  renameBaseValue: string;
  renameExtensionValue: string;
  renameError: string | null;
  extensionUnlocked: boolean;
  extensionChangeConfirmed: boolean;
  menuAnchorEl: HTMLElement | null;
  contextMenuPosition: { top: number; left: number } | null;
  toastMessage: string | null;
}

/**
 * Splits a file name into [base, extension] where extension includes the leading dot.
 * Files with no dot, or dotfiles like ".prettierrc" (leading dot only), have no extension.
 */
function splitFileName(fileName: string): { base: string; extension: string } {
  if (!fileName) {
    return { base: "", extension: "" };
  }
  const lastDot = fileName.lastIndexOf(".");
  // Treat a file that begins with '.' and has no further dots as extension-less (dotfile).
  if (lastDot <= 0) {
    return { base: fileName, extension: "" };
  }
  return { base: fileName.substring(0, lastDot), extension: fileName.substring(lastDot) };
}

// Characters disallowed in file names on Windows (superset of web/Unix restrictions).
const INVALID_NAME_CHARS = /[<>:"/\\|?*]/;

/**
 * Validates a proposed file name (base + extension). Returns an error message
 * if invalid, or null if valid. Used by the rename dialog to surface inline
 * feedback instead of silently rejecting submits (Task 063).
 */
function validateRenameInputs(base: string, extension: string): string | null {
  if (!base || !base.trim()) {
    return "File name cannot be empty.";
  }
  if (INVALID_NAME_CHARS.test(base)) {
    return 'Name cannot contain: < > : " / \\ | ? *';
  }
  if (INVALID_NAME_CHARS.test(extension)) {
    return 'Extension cannot contain: < > : " / \\ | ? *';
  }
  return null;
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
    this._handleRenameBaseChange = this._handleRenameBaseChange.bind(this);
    this._handleRenameExtensionChange = this._handleRenameExtensionChange.bind(this);
    this._handleToggleExtensionLock = this._handleToggleExtensionLock.bind(this);
    this._handleConfirmExtensionChange = this._handleConfirmExtensionChange.bind(this);
    this._handleMenuButtonClick = this._handleMenuButtonClick.bind(this);
    this._handleMenuClose = this._handleMenuClose.bind(this);
    this._handleContextMenuClose = this._handleContextMenuClose.bind(this);

    const split = splitFileName(props.file.name);
    this.state = {
      showRenameDialog: false,
      renameBaseValue: split.base,
      renameExtensionValue: split.extension,
      renameError: null,
      extensionUnlocked: false,
      extensionChangeConfirmed: false,
      menuAnchorEl: null,
      contextMenuPosition: null,
      toastMessage: null,
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
      // Confirmation dialog before deleting file
      const fileName = this.props.file.name;
      if (window.confirm(`Delete ${fileName}?\n\nThis will permanently remove the file from your project.`)) {
        if (this.context.onFileDelete) {
          this.context.onFileDelete(this.props.file);
        }
      }
    } else if (action === "Rename") {
      const split = splitFileName(this.props.file.name);
      this.setState({
        showRenameDialog: true,
        renameBaseValue: split.base,
        renameExtensionValue: split.extension,
        renameError: null,
        extensionUnlocked: false,
        extensionChangeConfirmed: false,
      });
    } else if (action === "Copy path") {
      this._copyFilePath();
    } else if (action === "Duplicate") {
      this._duplicateFile();
    } else if (action === "Reveal in folder") {
      this._revealInFolder();
    } else if (action === "Open as Raw") {
      if (this.context.onFileOpenAsRaw) {
        this.context.onFileOpenAsRaw(this.props.file);
      }
    }
    this.setState({ menuAnchorEl: null, contextMenuPosition: null });
  }

  /**
   * Opens the OS file browser at the file's containing folder. Requires the
   * Electron host (or any host with AppServiceProxy.hasAppService === true);
   * the menu item is hidden in pure-web/VSCode hosts because there's no
   * native shell to invoke. We open the parent folder rather than calling
   * `shell.showItemInFolder(file)` because the existing IPC channel
   * (`shellOpenFolderInExplorer`) takes a folder path and is already wired.
   */
  private async _revealInFolder() {
    try {
      const file = this.props.file;
      const folderPath = file.parentFolder?.fullPath || file.fullPath;
      if (!folderPath) {
        this.setState({ toastMessage: "No folder path available for this file" });
        return;
      }
      if (AppServiceProxy.hasAppService) {
        await AppServiceProxy.sendAsync(AppServiceProxyCommands.shellOpenFolderInExplorer, folderPath);
      } else {
        this.setState({ toastMessage: "Reveal in folder is only available in the desktop app" });
      }
    } catch (e) {
      this.setState({ toastMessage: "Could not reveal file in folder" });
    }
  }

  private async _copyFilePath() {
    const path = this.props.file.storageRelativePath || this.props.file.name;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(path);
        this.setState({ toastMessage: "Path copied to clipboard" });
      } else {
        this.setState({ toastMessage: "Clipboard not available: " + path });
      }
    } catch (e) {
      this.setState({ toastMessage: "Could not copy path" });
    }
  }

  private async _duplicateFile() {
    const file = this.props.file;
    const parentFolder = file.parentFolder;
    if (!parentFolder) {
      this.setState({ toastMessage: "Cannot duplicate: no parent folder" });
      return;
    }

    try {
      // Build a unique "foo copy.txt" / "foo copy 2.txt" style name.
      const split = splitFileName(file.name);
      let candidate = `${split.base} copy${split.extension}`;
      let counter = 2;
      const MAX_ATTEMPTS = 100;
      while (parentFolder.files[candidate] !== undefined) {
        if (counter > MAX_ATTEMPTS) {
          // Bail rather than fall through to ensureFile() which would
          // overwrite the existing "foo copy 100" file.
          this.setState({ toastMessage: "Could not find a unique name for the duplicate" });
          return;
        }
        candidate = `${split.base} copy ${counter}${split.extension}`;
        counter++;
      }

      // Ensure content is loaded before copying.
      if (file.content === null || file.content === undefined) {
        await file.loadContent();
      }

      const newFile = parentFolder.ensureFile(candidate);
      if (file.content !== null && file.content !== undefined) {
        newFile.setContent(file.content);
        await newFile.saveContent();
      }
      // Refresh the tree so the new file appears.
      this.props.fileExplorer.forceUpdate();
      this.setState({ toastMessage: `Duplicated as ${candidate}` });
    } catch (e) {
      this.setState({ toastMessage: "Could not duplicate file" });
    }
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
      renameError: null,
      extensionUnlocked: false,
      extensionChangeConfirmed: false,
    });
  }

  _handleRenameDialogConfirm() {
    const base = this.state.renameBaseValue;
    const ext = this.state.renameExtensionValue;

    const validationError = validateRenameInputs(base, ext);
    if (validationError) {
      this.setState({ renameError: validationError });
      return;
    }

    const originalSplit = splitFileName(this.props.file.name);
    const extensionChanged = ext !== originalSplit.extension;

    // If the extension changed, it must be explicitly unlocked AND confirmed.
    if (extensionChanged && (!this.state.extensionUnlocked || !this.state.extensionChangeConfirmed)) {
      return;
    }

    const newName = base + ext;

    if (this.context.onFileRename && newName && newName !== this.props.file.name) {
      this.context.onFileRename(this.props.file, newName);
    }
    this.setState({
      showRenameDialog: false,
      renameError: null,
      extensionUnlocked: false,
      extensionChangeConfirmed: false,
    });
  }

  _handleRenameBaseChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newBase = e.target.value;
    // Re-validate on each keystroke so the error message clears as soon as the name becomes valid.
    const error = validateRenameInputs(newBase, this.state.renameExtensionValue);
    this.setState({
      renameBaseValue: newBase,
      renameError: error,
    });
  }

  _handleRenameExtensionChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Editing the extension always invalidates a prior "Change anyway" confirmation —
    // the user must re-confirm the current value.
    let value = e.target.value;
    // Normalize: allow user to type "png" or ".png" — the stored value carries the dot.
    if (value && !value.startsWith(".")) {
      value = "." + value;
    }
    const error = validateRenameInputs(this.state.renameBaseValue, value);
    this.setState({
      renameExtensionValue: value,
      extensionChangeConfirmed: false,
      renameError: error,
    });
  }

  _handleToggleExtensionLock() {
    this.setState((prevState) => ({
      extensionUnlocked: !prevState.extensionUnlocked,
      // Re-locking also clears confirmation and restores the original extension.
      extensionChangeConfirmed: false,
      renameExtensionValue: prevState.extensionUnlocked
        ? splitFileName(this.props.file.name).extension
        : prevState.renameExtensionValue,
    }));
  }

  _handleConfirmExtensionChange() {
    this.setState({ extensionChangeConfirmed: true });
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
    const menuItems: { key: string; content: string; shortcut?: string }[] = [];
    if (!this.context.readOnly) {
      menuItems.push({
        key: "rename",
        content: "Rename",
        shortcut: "F2",
      });
      menuItems.push({
        key: "duplicate",
        content: "Duplicate",
      });
      menuItems.push({
        key: "copypath",
        content: "Copy path",
      });
      // "Open as Raw" — show whenever the host wired up an onFileOpenAsRaw
      // callback. This intentionally lives in both readOnly and editable
      // contexts in spirit, but we only build menus when !readOnly today.
      if (this.context.onFileOpenAsRaw) {
        menuItems.push({
          key: "openasraw",
          content: "Open as Raw",
        });
      }
      // "Reveal in folder" — Electron only. Hidden (not disabled) in web/VSCode
      // hosts where AppServiceProxy.shellOpenFolderInExplorer cannot run.
      if (
        CreatorToolsHost.hostType === HostType.electronWeb ||
        CreatorToolsHost.hostType === HostType.electronNodeJs
      ) {
        menuItems.push({
          key: "revealinfolder",
          content: "Reveal in folder",
        });
      }
      menuItems.push({
        key: "delete",
        content: "Delete",
        shortcut: "Del",
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

    // Rename dialog — split name and extension for safety.
    const originalSplit = splitFileName(this.props.file.name);
    const extensionChanged = this.state.renameExtensionValue !== originalSplit.extension;
    const extensionLocked = !this.state.extensionUnlocked;
    const hasValidationError = this.state.renameError !== null;
    const confirmDisabled =
      !this.state.renameBaseValue ||
      hasValidationError ||
      (extensionChanged && (!this.state.extensionUnlocked || !this.state.extensionChangeConfirmed));

    const renameDialog = (
      <Dialog open={this.state.showRenameDialog} onClose={this._handleRenameDialogCancel}>
        <DialogTitle>Rename File</DialogTitle>
        <DialogContent>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8 }}>
            <TextField
              label="Name"
              value={this.state.renameBaseValue}
              onChange={this._handleRenameBaseChange}
              autoFocus
              size="small"
              variant="outlined"
              sx={{ flex: 1 }}
              inputProps={{ "aria-label": "File name (without extension)" }}
              error={hasValidationError}
              helperText={this.state.renameError ?? " "}
            />
            <TextField
              label="Extension"
              value={this.state.renameExtensionValue}
              onChange={this._handleRenameExtensionChange}
              disabled={extensionLocked}
              size="small"
              variant="outlined"
              sx={{ width: 140 }}
              inputProps={{ "aria-label": "File extension" }}
              placeholder=".ext"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={this._handleToggleExtensionLock}
                      aria-label={extensionLocked ? "Unlock extension to change it" : "Lock extension"}
                      aria-pressed={!extensionLocked}
                      title={extensionLocked ? "Unlock to change extension" : "Lock extension"}
                    >
                      <FontAwesomeIcon icon={extensionLocked ? faLock : faLockOpen} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </div>
          {extensionChanged && this.state.extensionUnlocked && (
            <Alert
              severity="warning"
              sx={{ mt: 2 }}
              action={
                !this.state.extensionChangeConfirmed ? (
                  <McButton variant="wood" onClick={this._handleConfirmExtensionChange}>
                    Change anyway
                  </McButton>
                ) : undefined
              }
            >
              This will change the file type and may make it unreadable.
              {this.state.extensionChangeConfirmed && " Extension change confirmed."}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <McButton variant="stone" onClick={this._handleRenameDialogCancel}>
            Cancel
          </McButton>
          <McButton
            variant="green"
            onClick={this._handleRenameDialogConfirm}
            disabled={confirmDisabled}
          >
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
          } else if (e.key === "Enter" || e.key === " ") {
            this._handleFileClick();
            if (e.key === " ") {
              e.preventDefault();
            }
          } else if (e.key === "Delete" && !this.context.readOnly) {
            // Confirmation dialog before deleting file
            const fileName = this.props.file.name;
            if (window.confirm(`Delete ${fileName}?\n\nThis will permanently remove the file from your project.`)) {
              if (this.context.onFileDelete) {
                this.context.onFileDelete(this.props.file);
              }
            }
          } else if (e.key === "F2" && !this.context.readOnly) {
            const split = splitFileName(this.props.file.name);
            this.setState({
              showRenameDialog: true,
              renameBaseValue: split.base,
              renameExtensionValue: split.extension,
              extensionUnlocked: false,
              extensionChangeConfirmed: false,
            });
          }
        }}
      >
        {expandable}
        {summaryWithMenu}
        {menuButton}
        {renameDialog}
        <Snackbar
          open={this.state.toastMessage !== null}
          autoHideDuration={2500}
          onClose={() => this.setState({ toastMessage: null })}
          message={this.state.toastMessage ?? ""}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        />
      </div>
    );
  }
}

/**
 * IFileExplorerSharedProps - Shared prop interfaces for FileExplorer components
 *
 * ARCHITECTURE OVERVIEW:
 * The FileExplorer component hierarchy (FileExplorer, FileExplorerFolder,
 * FileExplorerFileDetail, FileExplorerFolderDetail, FileExplorerContainerFile)
 * shares many common props. This file defines base interfaces that these
 * components can extend, reducing duplication and ensuring consistency.
 *
 * NOTE: With FileExplorerContext, many of these props are now optional since
 * components can get values from context. However, props still take precedence
 * over context values when provided, allowing for override scenarios.
 */

import IFile from "../../../storage/IFile";
import IFolder from "../../../storage/IFolder";
import Project from "../../../app/Project";
import ItemAnnotationCollection from "../../types/ItemAnnotationCollection";
import FileExplorer from "./FileExplorer";
import IProjectTheme from "../../types/IProjectTheme";

/**
 * Base props shared by all FileExplorer item components (files, folders, containers).
 * These are the minimal props needed to render any item in the explorer.
 */
export interface IFileExplorerItemBaseProps {
  /** FluentUI theme for styling */
  theme: IProjectTheme;

  /** Currently selected file or folder */
  selectedItem: IFile | IFolder | undefined | null;

  /** Annotations/markers for items (errors, warnings, etc.) */
  itemAnnotations?: ItemAnnotationCollection;

  /** Project reference for looking up ProjectItems */
  project?: Project;

  /** Reference to the parent FileExplorer component */
  fileExplorer: FileExplorer;
}

/**
 * Props for components that support selection callbacks.
 */
export interface IFileExplorerSelectionProps {
  /** Callback when a file is selected */
  onFileSelected?: (file: IFile) => void;

  /** Callback when a folder is selected */
  onFolderSelected?: (folder: IFolder) => void;
}

/**
 * Props for components that support expand/collapse behavior.
 */
export interface IFileExplorerExpandableProps {
  /** Whether the item is currently expanded */
  isExpanded?: boolean;

  /** Callback when expanded state changes */
  onExpandedSet?: (newExpandedValue: boolean) => void;
}

/**
 * Props for components that can be removed/closed.
 */
export interface IFileExplorerRemovableProps {
  /** Callback when the item should be removed */
  onRemove?: () => void;
}

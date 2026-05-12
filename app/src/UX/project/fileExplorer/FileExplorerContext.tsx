/**
 * FileExplorerContext - Provides shared context for the FileExplorer component hierarchy
 *
 * ARCHITECTURE OVERVIEW:
 * This context eliminates prop drilling by providing common props to all FileExplorer
 * child components (FileExplorerFolder, FileExplorerFileDetail, FileExplorerFolderDetail,
 * FileExplorerContainerFile). Instead of passing theme, project, selectedItem, etc.
 * through every level, components can access them via useFileExplorerContext().
 *
 * USAGE:
 * - Wrap FileExplorer's children with <FileExplorerProvider value={...}>
 * - In child components, use: const ctx = useFileExplorerContext();
 * - For class components, use: static contextType = FileExplorerContext;
 *
 * WHAT'S INCLUDED:
 * - project: The current Project (for looking up ProjectItems from files)
 * - theme: FluentUI theme for consistent styling
 * - selectedItem: Currently selected file or folder
 * - mode: Explorer mode (explorer vs folderPicker)
 * - Callback functions for selection events
 *
 * NOTE: fileExplorer reference is NOT included to avoid circular dependencies.
 * Components that need direct FileExplorer access should still receive it as a prop.
 */

import { createContext, useContext } from "react";
import IFile from "../../../storage/IFile";
import IFolder from "../../../storage/IFolder";
import Project from "../../../app/Project";
import IProjectTheme from "../../types/IProjectTheme";

/**
 * Mode for the file explorer - determines selection behavior
 */
export enum FileExplorerMode {
  explorer = 0,
  folderPicker = 1,
}

/**
 * Shared context values for FileExplorer component hierarchy.
 * These are values that nearly every child component needs access to.
 */
export interface IFileExplorerContextValue {
  /** The current project, used for looking up ProjectItems from file paths */
  project?: Project;

  /** FluentUI theme for consistent styling */
  theme: IProjectTheme;

  /** Currently selected file or folder in the explorer */
  selectedItem: IFile | IFolder | null | undefined;

  /** Explorer mode: 'explorer' for file browsing, 'folderPicker' for folder selection */
  mode: FileExplorerMode;

  /** Whether the explorer is read-only */
  readOnly: boolean;

  /** Callback when a file is selected */
  onFileSelected?: (file: IFile) => void;

  /** Callback when a folder is selected */
  onFolderSelected?: (folder: IFolder) => void;

  /** Callback to delete a file */
  onFileDelete?: (file: IFile) => void;

  /** Callback to rename a file */
  onFileRename?: (file: IFile, newName: string) => void;

  /**
   * Optional callback to open a file in the Raw (text/JSON) editor.
   * When provided, the file detail context menu will surface an
   * "Open as Raw" entry. Implementations should switch the user to
   * Raw editing mode (CreatorToolsEditPreference.raw) and select the file.
   */
  onFileOpenAsRaw?: (file: IFile) => void;
}

/**
 * Default context value - used when no provider is present (shouldn't happen in practice)
 */
const defaultContextValue: IFileExplorerContextValue = {
  project: undefined,
  theme: {
    bodyFontFamily: "",
    mc0: "",
    mc1: "",
    mc2: "",
    mc3: "",
    mc4: "",
    mc5: "",
    mcc1: "",
    background: "",
    background1: "",
    background2: "",
    background3: "",
    background4: "",
    background5: "",
    background6: "",
    foreground: "",
    foreground1: "",
    foreground2: "",
    foreground3: "",
    foreground4: "",
    foreground5: "",
    foreground6: "",
    foregroundHover: "",
    foregroundHover1: "",
    foregroundHover2: "",
    foregroundHover3: "",
    backgroundHover: "",
    backgroundHover1: "",
    backgroundHover2: "",
    backgroundHover3: "",
    foregroundActive: "",
    foregroundActive1: "",
    backgroundActive: "",
    backgroundActive1: "",
    backgroundPressed: "",
  },
  selectedItem: undefined,
  mode: FileExplorerMode.explorer,
  readOnly: true,
  onFileSelected: undefined,
  onFolderSelected: undefined,
  onFileDelete: undefined,
  onFileRename: undefined,
  onFileOpenAsRaw: undefined,
};

/**
 * React Context for FileExplorer shared values.
 * Use FileExplorerProvider to wrap children and useFileExplorerContext() to consume.
 */
export const FileExplorerContext = createContext<IFileExplorerContextValue>(defaultContextValue);

/**
 * Hook to access FileExplorer context values.
 * Must be used within a FileExplorerProvider.
 *
 * @example
 * const { project, theme, selectedItem } = useFileExplorerContext();
 */
export function useFileExplorerContext(): IFileExplorerContextValue {
  return useContext(FileExplorerContext);
}

/**
 * Provider component for FileExplorer context.
 * Wrap FileExplorer's child tree with this to provide shared values.
 */
export const FileExplorerProvider = FileExplorerContext.Provider;

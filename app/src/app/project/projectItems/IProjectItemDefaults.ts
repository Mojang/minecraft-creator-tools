// Storing items in a shared interface accessed via strategy pattern avoids having to hunt every down switch statement to look for missing cases
export interface IProjectItemDefaults {
  folderRoots: readonly string[];
  // TODO: add additional properties to replace switch statements, keeping the refactor small for the time being
}

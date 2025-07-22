export default interface IProjectVariant {
  label: string; // in subpacks, label is equivalent to "folder_name"
  memoryTier?: number; // old-style memory tier from subpacks; each number = 512mb of avail memory for textures
  title?: string; // in subpacks, title is equivalent to "name"
}

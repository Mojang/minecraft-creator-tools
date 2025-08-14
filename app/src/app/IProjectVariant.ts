export default interface IProjectVariant {
  label: string; // in subpacks, label is equivalent to "folder_name"
  memoryTier?: number; // old-style memory tier from subpacks; each number = 512mb of avail memory for textures
  title?: string; // in subpacks, title is equivalent to "name"
  memoryPerformanceTier?: number; // new-style memory performance tier; currently ranges from 0 to 5 to represent buckets for broad abstract classes of devices
}

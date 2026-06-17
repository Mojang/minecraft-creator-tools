import Log from "../../core/Log";

/**
 * AppMode — internal state machine enum for the top-level App component.
 *
 * This is intentionally wider than the navigable Page set in AppRouter. It includes
 * transient states (loading, sessionEnded) and platform-specific sub-modes
 * (codeStartPage, remoteServerManager, etc.) that have no URL identity of their own.
 *
 * Related files:
 *   - AppRouter.ts   — maps real URLs to bookmarkable Page values
 *   - AppMain.tsx    — consumes AppMode for top-level render switching
 */
export enum AppMode {
  home = 1,
  loading = 2,
  project = 3,
  codeToolbox = 4,
  projectReadOnly = 5,
  exporterTool = 6,
  remoteServerManager = 7,
  codeStartPage = 9,
  codeStartPageForceNewProject = 12,
  codeLandingForceNewProject = 13,
  codeMinecraftView = 14,
  webServer = 16,
  importFromUrl = 17,
  importFiles = 18,
  blockViewer = 19,
  mobViewer = 20,
  modelViewer = 21, // Standalone model viewer with URL params for geometry/texture
  structureViewer = 22, // Standalone structure viewer with URL param for structure data
  sessionEnded = 23, // View session has ended (server shut down)
  itemViewer = 24, // Standalone item/attachable viewer
  worldViewer = 25, // Standalone 3D world viewer with URL param for .mcworld data
}

/**
 * Map of lowercase string keys (from config/URL/hash) to their corresponding AppMode.
 * Multiple keys can map to the same mode (e.g. "projectitem", "info", "input" → project).
 */
const MODE_MAP: Record<string, AppMode> = {
  home: AppMode.home,
  project: AppMode.project,
  projectitem: AppMode.project,
  info: AppMode.project,
  input: AppMode.project,
  codetoolbox: AppMode.codeToolbox,
  codestartpage: AppMode.codeStartPage,
  codeminecraftview: AppMode.codeMinecraftView,
  codestartpageforcenewproject: AppMode.codeStartPageForceNewProject,
  codelandingforcenewproject: AppMode.codeLandingForceNewProject,
  remoteservermanager: AppMode.remoteServerManager,
  webserver: AppMode.webServer,
  blockviewer: AppMode.blockViewer,
  mobviewer: AppMode.mobViewer,
  itemviewer: AppMode.itemViewer,
  modelviewer: AppMode.modelViewer,
  structureviewer: AppMode.structureViewer,
  worldviewer: AppMode.worldViewer,
  importfromurl: AppMode.importFromUrl,
  importfiles: AppMode.importFiles,
};

/**
 * Resolve a string (from a URL param, config value, or hash token) to an AppMode.
 * The lookup is case-insensitive. Returns undefined for unrecognised strings.
 */
export function getModeFromString(incomingMode: string | null | undefined): AppMode | undefined {
  if (!incomingMode) {
    return undefined;
  }
  const result = MODE_MAP[incomingMode.toLowerCase()];
  if (result === undefined) {
    Log.debug("Unknown app mode requested: " + incomingMode);
  }
  return result;
}

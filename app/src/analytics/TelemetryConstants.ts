// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Standardized telemetry event names for Minecraft Creator Tools.
 */
export const TelemetryEvents = {
  // Application lifecycle
  APP_STARTED: "AppStarted",
  APP_CLOSED: "AppClosed",

  // Project operations
  PROJECT_CREATED: "ProjectCreated",
  PROJECT_OPENED: "ProjectOpened",
  PROJECT_CLOSED: "ProjectClosed",
  PROJECT_SAVED: "ProjectSaved",
  PROJECT_EXPORTED: "ProjectExported",
  PROJECT_IMPORTED: "ProjectImported",
  PROJECT_DELETED: "ProjectDeleted",

  // File operations
  FILE_CREATED: "FileCreated",
  FILE_OPENED: "FileOpened",
  FILE_SAVED: "FileSaved",
  FILE_DELETED: "FileDeleted",
  FILE_RENAMED: "FileRenamed",

  // Editor actions
  EDITOR_OPENED: "EditorOpened",
  EDITOR_CLOSED: "EditorClosed",
  CODE_EDITED: "CodeEdited",
  JSON_EDITED: "JsonEdited",

  // Validation
  VALIDATION_STARTED: "ValidationStarted",
  VALIDATION_COMPLETED: "ValidationCompleted",
  VALIDATION_ERROR: "ValidationError",

  // Build and deployment
  BUILD_STARTED: "BuildStarted",
  BUILD_COMPLETED: "BuildCompleted",
  BUILD_FAILED: "BuildFailed",
  DEPLOYMENT_STARTED: "DeploymentStarted",
  DEPLOYMENT_COMPLETED: "DeploymentCompleted",
  DEPLOYMENT_FAILED: "DeploymentFailed",

  // Minecraft integration
  MINECRAFT_CONNECTED: "MinecraftConnected",
  MINECRAFT_DISCONNECTED: "MinecraftDisconnected",
  MINECRAFT_COMMAND_SENT: "MinecraftCommandSent",
  MINECRAFT_WORLD_LOADED: "MinecraftWorldLoaded",

  // Gallery and templates
  GALLERY_OPENED: "GalleryOpened",
  TEMPLATE_SELECTED: "TemplateSelected",
  SAMPLE_DOWNLOADED: "SampleDownloaded",

  // User actions
  BUTTON_CLICKED: "ButtonClicked",
  MENU_ITEM_SELECTED: "MenuItemSelected",
  SETTING_CHANGED: "SettingChanged",
  SEARCH_PERFORMED: "SearchPerformed",
  ITEM_CLICKED: "ItemClicked",

  // Project/File Management actions
  SHARE_ADDON_FILE: "ShareAddOnFile",
  PROJECT_SETTING_CHANGED: "ProjectSettingChanged",
  CREATOR_TOOL_SETTING_CHANGED: "CreatorToolSettingChanged",
  VIEW_CHANGED: "ViewChanged",
  PROJECT_MAP_CLICKED: "ProjectMapClicked",
  SHOW_FILTER_CLICKED: "ShowFilterClicked",
  HOME_CLICKED: "HomeClicked",
  SAVE_CLICKED: "SaveClicked",
  EXPORT_TO_FOLDER: "ExportToFolder",

  // Editor-specific events
  ENTITY_TYPE_EDITOR_VIEW_CHANGE: "EntityTypeEditorViewChange",
  ENTITY_TYPE_EDITOR_COMPONENT_CLICKED: "EntityTypeEditorComponentClicked",
  ITEM_TYPE_EDITOR_VIEW_CHANGE: "ItemTypeEditorViewChange",
  ITEM_TYPE_EDITOR_COMPONENT_CLICKED: "ItemTypeEditorComponentClicked",
  ADD_NEW_PROJECT_ITEM: "AddNewProjectItem",
  ITEM_ACTION: "ItemAction",

  // Inspector events
  INSPECTOR_OPENED: "InspectorOpened",
  INSPECTOR_SUMMARY_OPENED: "InspectorSummaryOpened",
  INSPECTOR_ITEMS_OPENED: "InspectorItemsOpened",
  INSPECTOR_VIEW_CHANGED: "InspectorViewChanged",
  INSPECTOR_SUITE_CHANGED: "InspectorSuiteChanged",

  // Share events
  PROJECT_SHARED: "ProjectShared",

  // Extension (VS Code)
  EXTENSION_ACTIVATED: "ExtensionActivated",
  EXTENSION_COMMAND_EXECUTED: "ExtensionCommandExecuted",
  CUSTOM_EDITOR_OPENED: "CustomEditorOpened",

  // CLI operations
  CLI_COMMAND_EXECUTED: "CliCommandExecuted",
  CLI_ERROR: "CliError",

  // Errors and exceptions
  UNHANDLED_ERROR: "UnhandledError",
  API_ERROR: "ApiError",
  NETWORK_ERROR: "NetworkError",

  // Performance metrics
  PERFORMANCE_METRIC: "PerformanceMetric",
  LOAD_TIME_RECORDED: "LoadTimeRecorded",

  // File upload operations
  FILE_UPLOADED: "FileUploaded",
  FILE_DROPPED: "FileDropped",

  // Project list operations
  PROJECT_LIST_VIEWED: "ProjectListViewed",
  BACKUP_EXPORTED: "BackupExported",
  FOLDER_OPENED: "FolderOpened",

  // Download operations
  FLAT_WORLD_DOWNLOADED: "FlatWorldDownloaded",
  EDITOR_PROJECT_DOWNLOADED: "EditorProjectDownloaded",
  CUSTOM_WORLD_DOWNLOADED: "CustomWorldDownloaded",

  // Project lifecycle
  PROJECT_LOADED: "ProjectLoaded",
} as const;

/**
 * Property keys for consistent telemetry properties
 */
export const TelemetryProperties = {
  // Project properties
  PROJECT_TYPE: "projectType",
  PROJECT_ID: "projectId",
  HAS_BEHAVIOR_PACK: "hasBehaviorPack",
  HAS_RESOURCE_PACK: "hasResourcePack",
  HAS_SCRIPTS: "hasScripts",

  // View properties
  VIEW_CHANGE_TYPE: "viewChangeType",
  VIEW_MODE: "viewMode",
  PREVIOUS_VIEW: "previousView",

  // Item properties
  ITEM_ID: "itemId",
  ITEM_TYPE: "itemType",
  ITEM_NAME: "itemName",

  // Export and share properties
  EXPORT_TYPE: "exportType",
  SHARE_METHOD: "shareMethod",
  SHARE_TYPE: "shareType",

  // Filter properties
  FILTER_TYPE: "filterType",
  FILTER_TEXT: "filterText",

  // Setting properties
  SETTING_TYPE: "settingType",
  SETTING_VALUE: "settingValue",
  OLD_VALUE: "oldValue",
  NEW_VALUE: "newValue",

  // File properties
  FILE_TYPE: "fileType",
  FILE_SIZE: "fileSize",
  FILE_EXTENSION: "fileExtension",

  // Action properties
  ACTION_SOURCE: "actionSource",
  ACTION_TYPE: "actionType",
  SUCCESS: "success",
  ERROR_MESSAGE: "errorMessage",
  ERROR_CODE: "errorCode",

  // User properties
  IS_AUTHENTICATED: "isAuthenticated",

  // Environment properties
  OS_TYPE: "osType",
  BROWSER_TYPE: "browserType",
  VSCODE_VERSION: "vscodeVersion",
  HOST_TYPE: "hostType",
  MCTOOLS_VERSION: "mctoolsVersion",

  // Feature flags
  FEATURE_NAME: "featureName",
  FEATURE_ENABLED: "featureEnabled",

  // Timing
  DURATION: "duration",
  TIMESTAMP: "timestamp",

  // Template and Gallery properties
  TEMPLATE_ID: "templateId",
  TEMPLATE_TITLE: "templateTitle",
  SNIPPET_ID: "snippetId",
  SNIPPET_TITLE: "snippetTitle",
  TRACK: "track",
  STORAGE_TYPE: "storageType",

  // Search properties
  SEARCH_QUERY: "searchQuery",
  SEARCH_CONTEXT: "searchContext",
  QUERY_LENGTH: "queryLength",

  // Link properties
  LINK_TYPE: "linkType",
  LINK_URL: "linkUrl",

  // Menu properties
  MENU_ITEM: "menuItem",
  LOCATION: "location",

  // Setting properties
  SETTING: "setting",

  // Component properties
  COMPONENT_NAME: "componentName",

  // File upload properties
  FILE_UPLOAD_METHOD: "fileUploadMethod",
  FILE_FORMAT: "fileFormat",
  UPLOAD_SOURCE: "uploadSource",

  // Folder properties
  FOLDER_DEPTH: "folderDepth",
  FOLDER_TYPE: "folderType",

  // Export/Backup properties
  EXPORT_SUCCESS: "exportSuccess",
  EXPORT_FORMAT: "exportFormat",

  // Editor properties
  EDITOR_TYPE: "editorType",
  MODE: "mode",
  COMPONENT_ID: "componentId",
  ITEM_ACTION_TYPE: "itemActionType",
  TEMPLATE: "template",

  // List properties
  PROJECT_LIST_SIZE: "projectListSize",
  TAB_INDEX: "tabIndex",

  // Project date properties
  CREATION_DATE: "creationDate",
  LAST_OPENED_DATE: "lastOpenedDate",

  // Project customization properties
  IS_TITLE_CUSTOMIZED: "isTitleCustomized",
  IS_CREATOR_CUSTOMIZED: "isCreatorCustomized",
  IS_SHORT_NAME_CUSTOMIZED: "isShortNameCustomized",

  // File open method properties
  OPEN_METHOD: "openMethod",

  // World download properties
  ADDITIONAL_PACKS_ADDED: "additionalPacksAdded",
  BEHAVIOR_PACKS: "behaviorPacks",
  RESOURCE_PACKS: "resourcePacks",
  GAME_TYPE: "gameType",
  DIFFICULTY: "difficulty",
  WORLD_TEMPLATE_USED: "worldTemplateUsed",
  MAP_STYLE: "mapStyle",
  SEED: "seed",

  // Project and validation properties
  PROJECT_ITEM_COUNT: "projectItemCount",
  INTERNAL_PROCESSING_ERROR_COUNT: "internalProcessingErrorCount",
  ERROR_TYPES: "errorTypes",
  SUITE_TYPE: "suiteType",
} as const;

/**
 * Measurement keys for numeric metrics
 */
export const TelemetryMeasurements = {
  // Counts
  FILE_COUNT: "fileCount",
  ERROR_COUNT: "errorCount",
  WARNING_COUNT: "warningCount",
  LINE_COUNT: "lineCount",
  ACTIVE_PROJECT_COUNT: "activeProjectCount",

  // Sizes
  FILE_SIZE_BYTES: "fileSizeBytes",
  PROJECT_SIZE_BYTES: "projectSizeBytes",

  // Timing (in milliseconds)
  LOAD_TIME_MS: "loadTimeMs",
  BUILD_TIME_MS: "buildTimeMs",
  VALIDATION_TIME_MS: "validationTimeMs",
  DEPLOYMENT_TIME_MS: "deploymentTimeMs",
  DURATION: "duration",

  // Performance
  MEMORY_USAGE_MB: "memoryUsageMb",
  CPU_USAGE_PERCENT: "cpuUsagePercent",
} as const;

export const TelemetrySeverity = {
  VERBOSE: 0,
  INFORMATION: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4,
} as const;

export type TelemetryEventName = (typeof TelemetryEvents)[keyof typeof TelemetryEvents];
export type TelemetryPropertyKey = (typeof TelemetryProperties)[keyof typeof TelemetryProperties];
export type TelemetryMeasurementKey = (typeof TelemetryMeasurements)[keyof typeof TelemetryMeasurements];
export type TelemetrySeverityLevel = (typeof TelemetrySeverity)[keyof typeof TelemetrySeverity];

/**
 * Type-safe interfaces for telemetry event properties
 */

export interface WorldDownloadProperties {
  [TelemetryProperties.ADDITIONAL_PACKS_ADDED]?: number;
  [TelemetryProperties.BEHAVIOR_PACKS]?: string;
  [TelemetryProperties.RESOURCE_PACKS]?: string;
  [TelemetryProperties.GAME_TYPE]?: number;
  [TelemetryProperties.DIFFICULTY]?: number;
  [TelemetryProperties.WORLD_TEMPLATE_USED]?: boolean;
  [TelemetryProperties.MAP_STYLE]?: string | number;
  [TelemetryProperties.SEED]?: string;
}

export interface ProjectExportProperties {
  [TelemetryProperties.EXPORT_FORMAT]?: string;
  [TelemetryProperties.EXPORT_SUCCESS]?: boolean;
}

export interface ProjectProperties {
  [TelemetryProperties.PROJECT_TYPE]?: string;
  [TelemetryProperties.PROJECT_ID]?: string;
  [TelemetryProperties.HAS_BEHAVIOR_PACK]?: boolean;
  [TelemetryProperties.HAS_RESOURCE_PACK]?: boolean;
  [TelemetryProperties.HAS_SCRIPTS]?: boolean;
  [TelemetryProperties.PROJECT_ITEM_COUNT]?: number;
}

export interface FileProperties {
  [TelemetryProperties.FILE_TYPE]?: string;
  [TelemetryProperties.FILE_SIZE]?: number;
  [TelemetryProperties.FILE_EXTENSION]?: string;
  [TelemetryProperties.FILE_FORMAT]?: string;
}

export interface EditorProperties {
  [TelemetryProperties.EDITOR_TYPE]?: string;
  [TelemetryProperties.MODE]?: string;
  [TelemetryProperties.COMPONENT_ID]?: string;
  [TelemetryProperties.COMPONENT_NAME]?: string;
}

export interface ViewProperties {
  [TelemetryProperties.VIEW_CHANGE_TYPE]?: string;
  [TelemetryProperties.VIEW_MODE]?: string;
  [TelemetryProperties.PREVIOUS_VIEW]?: string;
}

export interface ActionProperties {
  [TelemetryProperties.ACTION_SOURCE]?: string;
  [TelemetryProperties.ACTION_TYPE]?: string;
  [TelemetryProperties.SUCCESS]?: boolean;
  [TelemetryProperties.ERROR_MESSAGE]?: string;
  [TelemetryProperties.ERROR_CODE]?: string;
}

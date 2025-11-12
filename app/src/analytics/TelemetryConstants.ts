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
} as const;

/**
 * Property keys for consistent telemetry properties
 */
export const TelemetryProperties = {
  // Project properties
  PROJECT_TYPE: "projectType",
  PROJECT_ID: "projectId",
  PROJECT_NAME: "projectName",
  HAS_BEHAVIOR_PACK: "hasBehaviorPack",
  HAS_RESOURCE_PACK: "hasResourcePack",
  HAS_SCRIPTS: "hasScripts",

  // File properties
  FILE_TYPE: "fileType",
  FILE_PATH: "filePath",
  FILE_SIZE: "fileSize",
  FILE_EXTENSION: "fileExtension",

  // Action properties
  ACTION_SOURCE: "actionSource",
  ACTION_TYPE: "actionType",
  SUCCESS: "success",
  ERROR_MESSAGE: "errorMessage",
  ERROR_CODE: "errorCode",

  // User properties
  USER_ID: "userId",
  SESSION_ID: "sessionId",
  IS_AUTHENTICATED: "isAuthenticated",

  // Environment properties
  OS_TYPE: "osType",
  BROWSER_TYPE: "browserType",
  VSCODE_VERSION: "vscodeVersion",
  HOST_TYPE: "hostType",

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

  // Sizes
  FILE_SIZE_BYTES: "fileSizeBytes",
  PROJECT_SIZE_BYTES: "projectSizeBytes",

  // Timing (in milliseconds)
  LOAD_TIME_MS: "loadTimeMs",
  BUILD_TIME_MS: "buildTimeMs",
  VALIDATION_TIME_MS: "validationTimeMs",
  DEPLOYMENT_TIME_MS: "deploymentTimeMs",

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

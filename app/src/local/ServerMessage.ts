export enum ServerMessageType {
  general,
  info = 1,
  error = 2,
  warning = 3,
}

export enum ServerMessageCategory {
  general = 0,
  serverStarting = 1,
  version = 2,
  sessionId = 3,
  buildId = 4,
  branch = 5,
  commitId = 6,
  configuration = 7,
  levelName = 8,
  gameMode = 9,
  difficulty = 10,
  contentLoggingConsoleEnabled = 11,
  contentLoggingDiskEnabled = 12,
  experiments = 13,
  openingLevel = 14,
  ipv4supported = 15,
  ipv6supported = 16,
  serverStarted = 17,
  telemetryMessageStart = 18,
  telemetryStart = 19,
  telemetryEnabling = 20,
  telemetryEnabling2 = 21,
  telemetryProperties = 22,
  demarcationLine = 23,
  debuggerListening = 24,
  serverStopRequested = 25,
  serverStopping = 26,
  serverStopped = 27,
  debuggerClosing = 28,
  noLogFile = 29,
  playerConnected = 30,
  playerDisconnected = 31,
  backupSaving = 32,
  backupSaved = 33,
  levelDatUpdate = 34,
  backupComplete = 35,
  gameTestLoaded = 36,
  gameTestPassed = 37,
  gameTestFailed = 38,
  empty = 39,
  debuggerFailedToStart = 40,
  internalSystemMessage = 41, // Internal system messages (e.g., querytarget output) - don't log to console
}

export default class ServerMessage {
  #fullMessage: string;
  #message: string;
  #type: ServerMessageType = ServerMessageType.general;
  #date: Date;
  #category: ServerMessageCategory = ServerMessageCategory.general;

  get fullMessage() {
    return this.#fullMessage;
  }

  get message() {
    return this.#message;
  }

  get type() {
    return this.#type;
  }

  get category() {
    return this.#category;
  }

  get date() {
    return this.#date;
  }

  constructor(message: string) {
    this.#fullMessage = message;
    this.#date = new Date(0);

    // Strip "NO LOG FILE! - " prefix if present - this happens when the server
    // restarts and the log file isn't set up yet. We still need to parse the
    // actual message content for important events like "Server started."
    const NO_LOG_PREFIX = "NO LOG FILE! - ";
    if (message.startsWith(NO_LOG_PREFIX)) {
      message = message.substring(NO_LOG_PREFIX.length);
    }

    const firstBracket = message.indexOf("[");

    if (firstBracket === 0) {
      const lastBracket = message.indexOf("] ", firstBracket);

      if (lastBracket > firstBracket && lastBracket > 10) {
        this.#message = message.substring(lastBracket + 2);

        if (message.substring(lastBracket - 4, lastBracket) === "INFO") {
          this.#type = ServerMessageType.info;
        } else if (message.substring(lastBracket - 5, lastBracket) === "ERROR") {
          this.#type = ServerMessageType.error;
        } else if (message.substring(lastBracket - 4, lastBracket) === "WARN") {
          this.#type = ServerMessageType.warning;
        }

        const lastSpace = message.lastIndexOf(" ", lastBracket);

        if (lastSpace > firstBracket) {
          const dateTime = message.substring(firstBracket + 1, lastSpace);
          this.#date = new Date(dateTime);
        }
      } else {
        this.#message = this.#fullMessage;
      }
    } else {
      this.#message = this.#fullMessage;
    }

    this.#message = this.#message.trim();

    if (this.#message === "") {
      this.#category = ServerMessageCategory.empty;
    } else if (this.#message.startsWith("Starting Server")) {
      this.#category = ServerMessageCategory.serverStarting;
    } else if (this.#message.startsWith("Version: ")) {
      this.#category = ServerMessageCategory.version;
    } else if (this.#message.startsWith("Session ID: ")) {
      this.#category = ServerMessageCategory.sessionId;
    } else if (this.#message.startsWith("Build ID: ")) {
      this.#category = ServerMessageCategory.buildId;
    } else if (this.#message.startsWith("Branch: ")) {
      this.#category = ServerMessageCategory.branch;
    } else if (this.#message.startsWith("Commit ID: ")) {
      this.#category = ServerMessageCategory.commitId;
    } else if (this.#message.startsWith("Configuration: ")) {
      this.#category = ServerMessageCategory.configuration;
    } else if (this.#message.startsWith("Level Name: ")) {
      this.#category = ServerMessageCategory.levelName;
    } else if (this.#message.startsWith("Game mode: ")) {
      this.#category = ServerMessageCategory.gameMode;
    } else if (this.#message.startsWith("Difficulty: ")) {
      this.#category = ServerMessageCategory.difficulty;
    } else if (this.#message.startsWith("Content logging to console is enabled")) {
      this.#category = ServerMessageCategory.contentLoggingConsoleEnabled;
    } else if (this.#message.startsWith("Content logging to disk is enabled")) {
      this.#category = ServerMessageCategory.contentLoggingDiskEnabled;
    } else if (this.#message.startsWith("Experiment(s) active:")) {
      this.#category = ServerMessageCategory.experiments;
    } else if (this.#message.startsWith("Opening level")) {
      this.#category = ServerMessageCategory.openingLevel;
    } else if (this.#message.startsWith("IPv4 supported")) {
      this.#category = ServerMessageCategory.ipv4supported;
    } else if (this.#message.startsWith("IPv6 supported")) {
      this.#category = ServerMessageCategory.ipv6supported;
    } else if (this.#message.startsWith("Server started.")) {
      this.#category = ServerMessageCategory.serverStarted;
    } else if (this.#message.startsWith("================ TELEMETRY MESSAGE ")) {
      this.#category = ServerMessageCategory.telemetryMessageStart;
    } else if (this.#message.startsWith("Server Telemetry is currently not enabled.")) {
      this.#category = ServerMessageCategory.telemetryStart;
    } else if (this.#message.startsWith("Enabling this telemetry helps us improve the game.")) {
      this.#category = ServerMessageCategory.telemetryEnabling;
    } else if (this.#message.startsWith("To enable this feature")) {
      this.#category = ServerMessageCategory.telemetryEnabling2;
    } else if (this.#message.startsWith("to the server.properties")) {
      this.#category = ServerMessageCategory.telemetryProperties;
    } else if (this.#message.startsWith("======================================================")) {
      this.#category = ServerMessageCategory.demarcationLine;
    } else if (this.#message.startsWith("Debugger listening")) {
      this.#category = ServerMessageCategory.debuggerListening;
    } else if (this.#message.startsWith("[Scripting] Script Debugger")) {
      this.#category = ServerMessageCategory.debuggerClosing;
    } else if (this.#message.startsWith("Server stop requested")) {
      this.#category = ServerMessageCategory.serverStopRequested;
    } else if (this.#message.startsWith("Stopping server...")) {
      this.#category = ServerMessageCategory.serverStopping;
    } else if (this.#message.startsWith("Quit correctly")) {
      this.#category = ServerMessageCategory.serverStopped;
    } else if (this.#message.startsWith("Player connected")) {
      this.#category = ServerMessageCategory.playerConnected;
    } else if (this.#message.startsWith("Player disconnected")) {
      this.#category = ServerMessageCategory.playerDisconnected;
    } else if (this.#message.startsWith("Saving...")) {
      this.#category = ServerMessageCategory.backupSaving;
    } else if (this.#message.startsWith("Data saved.")) {
      this.#category = ServerMessageCategory.backupSaved;
    } else if (this.#message.indexOf("/level.dat:") >= 0) {
      this.#category = ServerMessageCategory.levelDatUpdate;
    } else if (this.#message.startsWith("Changes to the world are resumed.")) {
      this.#category = ServerMessageCategory.backupComplete;
    } else if (this.#message.indexOf("onTestStructureLoaded:") >= 0) {
      this.#category = ServerMessageCategory.gameTestLoaded;
    } else if (this.#message.indexOf("onTestFailed:") >= 0) {
      this.#category = ServerMessageCategory.gameTestFailed;
    } else if (this.#message.indexOf("onTestPassed:") >= 0) {
      this.#category = ServerMessageCategory.gameTestPassed;
    } else if (this.#message.startsWith("Failed to start debugger")) {
      this.#category = ServerMessageCategory.debuggerFailedToStart;
    } else if (
      this.#message.startsWith("Target data:") ||
      this.#message.startsWith("No targets matched selector") ||
      this.#message.startsWith('"dimension"') ||
      this.#message.startsWith('"id"') ||
      this.#message.startsWith('"position"') ||
      this.#message.startsWith('"uniqueId"') ||
      this.#message.startsWith('"yRot"') ||
      this.#message.startsWith('"x"') ||
      this.#message.startsWith('"y"') ||
      this.#message.startsWith('"z"') ||
      this.#message === "}," ||
      this.#message === "}" ||
      this.#message === "{" ||
      this.#message === "[" ||
      this.#message === "]"
    ) {
      this.#category = ServerMessageCategory.internalSystemMessage;
    }
  }
}

// Lookup table mapping categories to their log prefix.
// Using a Map instead of a switch avoids subtle bugs when new enum values are
// added: a missing entry simply falls through to the default ("LOG") without
// requiring updates to a switch statement scattered across the codebase.
const MESSAGE_CATEGORY_PREFIXES = new Map<ServerMessageCategory, string>([
  [ServerMessageCategory.serverStarting, "START"],
  [ServerMessageCategory.serverStarted, "READY"],
  [ServerMessageCategory.serverStopped, "STOP"],
  [ServerMessageCategory.serverStopRequested, "STOPREQ"],
  [ServerMessageCategory.serverStopping, "STOPPING"],
  [ServerMessageCategory.playerConnected, "JOIN"],
  [ServerMessageCategory.playerDisconnected, "LEAVE"],
  [ServerMessageCategory.gameTestFailed, "ERROR"],
  [ServerMessageCategory.debuggerFailedToStart, "ERROR"],
  [ServerMessageCategory.gameTestPassed, "PASS"],
  [ServerMessageCategory.backupSaving, "SAVE"],
  [ServerMessageCategory.backupSaved, "SAVED"],
  [ServerMessageCategory.backupComplete, "SAVED"],
  [ServerMessageCategory.version, "VER"],
  [ServerMessageCategory.debuggerListening, "DEBUG"],
  [ServerMessageCategory.gameTestLoaded, "GTEST"],
]);

export function getMessageCategoryPrefix(category: ServerMessageCategory): string {
  return MESSAGE_CATEGORY_PREFIXES.get(category) ?? "LOG";
}

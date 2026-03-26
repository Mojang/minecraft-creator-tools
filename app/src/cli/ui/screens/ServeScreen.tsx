/**
 * =============================================================================
 * SERVE SCREEN - Interactive Server Management UI
 * =============================================================================
 *
 * The main interactive screen for `mct serve` and `mct dedicatedserve` commands.
 * Provides:
 * - Real-time log display using LogViewer with Static output
 * - Server status bar with state, players, uptime
 * - Command input with autocomplete for BDS and MCT commands
 * - Parsed response display for structured outputs
 *
 * Architecture:
 * - Uses Ink's render() to create the interactive UI
 * - Subscribes to ServerManager events for log updates
 * - Integrates with CommandProviderRegistry for autocomplete
 * - Handles both BDS passthrough commands and local MCT commands
 * =============================================================================
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { render, Box, Text, useApp, useInput, Key } from "ink";
import { LogViewer, ILogEntry } from "../components/LogViewer";
import { getMessageCategoryPrefix } from "../../../local/ServerMessage";
import { CommandInput } from "../components/CommandInput";
import { StatusBar } from "../components/StatusBar";
import {
  commandProviderRegistry,
  initializeCommandProviders,
  IServerStatus,
  IPlayerInfo,
  ICommandContext,
} from "../commands";
import ServerManager from "../../../local/ServerManager";
import ServerMessage, { ServerMessageCategory, ServerMessageType } from "../../../local/ServerMessage";
import { constants } from "../../../core/Constants";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const HISTORY_FILE = path.join(os.homedir(), ".mct", "serve_history.json");
const MAX_HISTORY = 100;

function loadHistory(): string[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.slice(-MAX_HISTORY);
      }
    }
  } catch {
    // Ignore errors — start with empty history
  }
  return [];
}

function saveHistory(history: string[]): void {
  try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch {
    // Ignore write errors — history is non-critical
  }
}

type LogFilter = "all" | "errors" | "players" | "tests" | "server";

// Lookup table mapping each log filter to the set of categories it matches.
// Used for concise, data-driven filtering instead of a switch/case per filter.
const FILTER_CATEGORY_SETS: Record<Exclude<LogFilter, "all">, Set<ServerMessageCategory>> = {
  errors: new Set([
    ServerMessageCategory.gameTestFailed,
    ServerMessageCategory.debuggerFailedToStart,
  ]),
  players: new Set([
    ServerMessageCategory.playerConnected,
    ServerMessageCategory.playerDisconnected,
  ]),
  tests: new Set([
    ServerMessageCategory.gameTestLoaded,
    ServerMessageCategory.gameTestPassed,
    ServerMessageCategory.gameTestFailed,
  ]),
  server: new Set([
    ServerMessageCategory.serverStarting,
    ServerMessageCategory.serverStarted,
    ServerMessageCategory.serverStopped,
    ServerMessageCategory.serverStopRequested,
    ServerMessageCategory.serverStopping,
    ServerMessageCategory.version,
    ServerMessageCategory.levelName,
    ServerMessageCategory.gameMode,
    ServerMessageCategory.difficulty,
  ]),
};

// The "errors" filter also matches by message type (not just category).
const ERROR_FILTER_TYPES = new Set([
  ServerMessageType.error,
  ServerMessageType.warning,
]);

// Module-level constant: BDS message categories filtered from the log display.
// These are noisy internal/telemetry messages that don't provide operator value.
const FILTERED_CATEGORIES = new Set([
  ServerMessageCategory.internalSystemMessage,
  ServerMessageCategory.telemetryMessageStart,
  ServerMessageCategory.telemetryStart,
  ServerMessageCategory.telemetryEnabling,
  ServerMessageCategory.telemetryEnabling2,
  ServerMessageCategory.telemetryProperties,
  ServerMessageCategory.demarcationLine,
  ServerMessageCategory.ipv4supported,
  ServerMessageCategory.ipv6supported,
  ServerMessageCategory.empty,
  ServerMessageCategory.noLogFile,
  ServerMessageCategory.contentLoggingConsoleEnabled,
  ServerMessageCategory.contentLoggingDiskEnabled,
  ServerMessageCategory.sessionId,
  ServerMessageCategory.buildId,
  ServerMessageCategory.branch,
  ServerMessageCategory.commitId,
]);

interface ServeScreenProps {
  /** Server manager instance */
  serverManager: ServerManager;
  /** CreatorTools instance for ToolCommand context */
  creatorTools?: any;
  /** HTTP server port */
  httpPort?: number;
  /** BDS server port */
  bdsPort?: number;
  /** Callback when exit is requested */
  onExit: () => void;
  /** Initial message to display */
  welcomeMessage?: string;
  /** Auto-exit timeout in seconds (for testing) */
  timeoutSeconds?: number;
}

/**
 * Generate unique ID for log entries
 */
/** Maximum number of log entries retained in the UI buffer. */
const MAX_LOG_BUFFER = 2000;

let logIdCounter = 0;
function generateLogId(): string {
  return `log-${++logIdCounter}-${Date.now()}`;
}

/**
 * Main serve screen component
 */
const ServeScreenComponent: React.FC<ServeScreenProps> = ({
  serverManager,
  creatorTools,
  httpPort,
  bdsPort,
  onExit,
  welcomeMessage,
  timeoutSeconds,
}) => {
  const { exit } = useApp();
  const [logs, setLogs] = useState<ILogEntry[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>(() => loadHistory());
  const [logFilter, setLogFilter] = useState<LogFilter>("all");
  const [serverStatus, setServerStatus] = useState<IServerStatus>({
    state: "starting",
    playerCount: 0,
    port: bdsPort,
  });
  const [players, setPlayers] = useState<IPlayerInfo[]>([]);
  const [startTime] = useState<Date>(new Date());
  const [initialized, setInitialized] = useState(false);
  const exitRequested = useRef(false);

  const [searchFilter, setSearchFilter] = useState<string | undefined>(undefined);

  // Add a log entry
  const addLog = useCallback((message: string, category: ServerMessageCategory = ServerMessageCategory.general, type?: number) => {
    setLogs((prev) => {
      const newLogs = [
        ...prev,
        {
          id: generateLogId(),
          timestamp: new Date(),
          message,
          category,
          type,
        },
      ];
      // Cap the buffer to prevent memory leaks on long-running servers
      if (newLogs.length > MAX_LOG_BUFFER) {
        return newLogs.slice(-MAX_LOG_BUFFER);
      }
      return newLogs;
    });
  }, []);

  // Handle timeout for auto-exit (testing)
  // Use a ref to prevent the timeout from being reset on every render
  const timeoutSetUp = useRef(false);
  useEffect(() => {
    if (!timeoutSeconds || timeoutSeconds <= 0 || timeoutSetUp.current) {
      return;
    }
    timeoutSetUp.current = true;

    // Log that timeout is configured
    setLogs((prev) => [
      ...prev,
      {
        id: generateLogId(),
        timestamp: new Date(),
        message: `Server will auto-exit in ${timeoutSeconds} seconds.`,
        category: ServerMessageCategory.general,
      },
    ]);

    const timeoutHandle = setTimeout(async () => {
      if (!exitRequested.current) {
        exitRequested.current = true;
        setLogs((prev) => [
          ...prev,
          {
            id: generateLogId(),
            timestamp: new Date(),
            message: "Timeout reached, shutting down...",
            category: ServerMessageCategory.serverStopped,
          },
        ]);
        setServerStatus((prev) => ({ ...prev, state: "stopping" }));
        onExit();
        await serverManager.shutdown("timeout");
        setTimeout(() => exit(), 500);
      }
    }, timeoutSeconds * 1000);

    return () => {
      clearTimeout(timeoutHandle);
    };
  }, [timeoutSeconds, serverManager, onExit, exit]);

  // Initialize command providers
  useEffect(() => {
    initializeCommandProviders()
      .then(() => {
        setInitialized(true);
        if (welcomeMessage) {
          addLog(welcomeMessage, ServerMessageCategory.serverStarting);
        }
        addLog(`Minecraft Creator Tools v${constants.version}`, ServerMessageCategory.version);
        addLog("Type 'help' for available commands", ServerMessageCategory.general);
      })
      .catch((err) => {
        addLog(`Failed to initialize commands: ${err}`, ServerMessageCategory.gameTestFailed);
        setInitialized(true);
      });
  }, [addLog, welcomeMessage]);

  // Subscribe to server events
  useEffect(() => {
    const handleServerOutput = (_sender: any, message: ServerMessage) => {
      // Skip noisy/internal messages that don't provide operator value
      if (FILTERED_CATEGORIES.has(message.category)) {
        return;
      }

      addLog(message.message, message.category, message.type);

      // Update status based on message
      if (message.category === ServerMessageCategory.serverStarted) {
        setServerStatus((prev) => ({ ...prev, state: "running" }));
      } else if (message.category === ServerMessageCategory.serverStopped) {
        setServerStatus((prev) => ({ ...prev, state: "stopped" }));
      } else if (message.category === ServerMessageCategory.version) {
        const versionMatch = message.message.match(/(\d+\.\d+\.\d+)/);
        if (versionMatch) {
          setServerStatus((prev) => ({ ...prev, version: versionMatch[1] }));
        }
      } else if (message.category === ServerMessageCategory.levelName) {
        const levelMatch = message.message.match(/Level Name: (.+)/);
        if (levelMatch) {
          setServerStatus((prev) => ({ ...prev, worldName: levelMatch[1].trim() }));
        }
      } else if (message.category === ServerMessageCategory.playerConnected) {
        const nameMatch = message.message.match(/Player connected:\s*(\S+?)(?:,\s*xuid:\s*(\d+))?/i);
        if (nameMatch) {
          const playerName = nameMatch[1];
          const xuid = nameMatch[2];
          setPlayers((prev) => [...prev, { name: playerName, xuid, connectedAt: new Date() }]);
          setServerStatus((prev) => ({ ...prev, playerCount: prev.playerCount + 1 }));
        }
      } else if (message.category === ServerMessageCategory.playerDisconnected) {
        const nameMatch = message.message.match(/Player disconnected:\s*(\S+?)(?:,\s*xuid:\s*(\d+))?/i);
        if (nameMatch) {
          const playerName = nameMatch[1];
          setPlayers((prev) => prev.filter((p) => p.name !== playerName));
          setServerStatus((prev) => ({ ...prev, playerCount: Math.max(0, prev.playerCount - 1) }));
        }
      }
    };

    const handleShutdown = (_sender: any, reason: string) => {
      if (!exitRequested.current) {
        exitRequested.current = true;
        addLog(`Shutting down... (${reason})`, ServerMessageCategory.serverStopped);
        setServerStatus((prev) => ({ ...prev, state: "stopping" }));
        onExit();
        // Give a moment for final log output, then exit
        setTimeout(() => exit(), 500);
      }
    };

    // Subscribe to events
    serverManager.onServerOutput.subscribe(handleServerOutput);
    serverManager.onShutdown.subscribe(handleShutdown);

    // Check if server is already running
    if (serverManager.primaryActiveServer) {
      setServerStatus((prev) => ({ ...prev, state: "running" }));
    }

    return () => {
      serverManager.onServerOutput.unsubscribe(handleServerOutput);
      serverManager.onShutdown.unsubscribe(handleShutdown);
      onExit();
    };
  }, [serverManager, addLog, onExit]);

  const filteredLogs = useMemo(() => {
    let result = logs;

    // Apply category filter using lookup sets for conciseness
    if (logFilter !== "all") {
      const categorySet = FILTER_CATEGORY_SETS[logFilter];
      result = result.filter((log) => {
        if (categorySet.has(log.category)) {
          return true;
        }
        // The "errors" filter also matches by message type
        if (logFilter === "errors" && log.type !== undefined && ERROR_FILTER_TYPES.has(log.type)) {
          return true;
        }
        return false;
      });
    }

    // Apply search filter
    if (searchFilter) {
      let matcher: (msg: string) => boolean;
      // Try regex first (if pattern looks like /pattern/flags), with length limit to avoid catastrophic backtracking
      if (searchFilter.startsWith("/") && searchFilter.lastIndexOf("/") > 0 && searchFilter.length <= 200) {
        const lastSlash = searchFilter.lastIndexOf("/");
        const pattern = searchFilter.slice(1, lastSlash);
        const flags = searchFilter.slice(lastSlash + 1) || "i";
        try {
          const regex = new RegExp(pattern, flags);
          matcher = (msg: string) => regex.test(msg);
        } catch {
          // Invalid regex — fall back to substring
          const lower = searchFilter.toLowerCase();
          matcher = (msg: string) => msg.toLowerCase().includes(lower);
        }
      } else {
        // Plain substring search (case-insensitive)
        const lower = searchFilter.toLowerCase();
        matcher = (msg: string) => msg.toLowerCase().includes(lower);
      }
      result = result.filter((log) => matcher(log.message));
    }

    return result;
  }, [logs, logFilter, searchFilter]);

  // Create command context
  const createCommandContext = useCallback((): ICommandContext => {
    return {
      sendToBds: (command: string) => {
        const server = serverManager.primaryActiveServer;
        if (server) {
          server.writeToServer(command);
          addLog(`> ${command}`, ServerMessageCategory.general);
        } else {
          addLog("No active server to send command to", ServerMessageCategory.gameTestFailed);
        }
      },
      requestExit: () => {
        exitRequested.current = true;
        addLog("Shutting down...", ServerMessageCategory.serverStopped);
        setServerStatus((prev) => ({ ...prev, state: "stopping" }));
        onExit();
        setTimeout(() => exit(), 500);
      },
      getServerStatus: () => serverStatus,
      getPlayers: () => players,
      clearLog: () => setLogs([]),
      setSearchFilter: (pattern: string | undefined) => setSearchFilter(pattern),
      getProviders: () => commandProviderRegistry.getProviders(),
      creatorTools,
      serverManager,
      getLogs: () => logs,
      exportLogs: (filePath: string) => {
        const lines = logs.map((l) => {
          const prefix = getMessageCategoryPrefix(l.category);
          return `[${l.timestamp.toISOString()}] [${prefix}] ${l.message}`;
        });
        fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
        return logs.length;
      },
    };
  }, [serverManager, serverStatus, players, addLog, onExit, exit, logs]);

  // Handle command submission
  const handleCommand = useCallback(
    async (input: string) => {
      // Add to history and persist
      setCommandHistory((prev) => {
        const updated = [...prev.slice(-(MAX_HISTORY - 1)), input];
        saveHistory(updated);
        return updated;
      });

      try {
        const context = createCommandContext();

        // Try to execute via command providers (MCT commands first)
        const response = await commandProviderRegistry.execute(input, context);

        if (response) {
          // Command was handled by a provider (MCT command)
          if (response.message) {
            // Split multi-line responses into separate log entries
            const lines = response.message.split("\n");
            for (const line of lines) {
              if (line.trim()) {
                addLog(
                  line,
                  response.type === "error" ? ServerMessageCategory.gameTestFailed : ServerMessageCategory.general
                );
              }
            }
          }
        } else {
          // Pass through to BDS
          context.sendToBds(input);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        addLog(`Command error: ${msg}`, ServerMessageCategory.gameTestFailed);
      }
    },
    [createCommandContext, addLog]
  );

  // Handle keyboard shortcuts
  useInput((input: string, key: Key) => {
    if (input === "c" && key.ctrl) {
      const context = createCommandContext();
      context.requestExit();
    }
    // Ctrl+L: clear logs
    if (input === "l" && key.ctrl) {
      setLogs([]);
    }
    // Log filter shortcuts
    if (input === "1" && key.ctrl) {
      setLogFilter("all");
    } else if (input === "2" && key.ctrl) {
      setLogFilter("errors");
    } else if (input === "3" && key.ctrl) {
      setLogFilter("players");
    } else if (input === "4" && key.ctrl) {
      setLogFilter("tests");
    } else if (input === "5" && key.ctrl) {
      setLogFilter("server");
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      {/* Log viewer - takes up most of the screen */}
      <Box flexGrow={1} flexDirection="column">
        <LogViewer logs={filteredLogs} maxLines={200} />
      </Box>

      {/* Log filter indicator */}
      {(logFilter !== "all" || searchFilter) && (
        <Box>
          <Text dimColor>
            {logFilter !== "all" && (
              <>Filter: <Text color="cyan" bold>{logFilter.toUpperCase()}</Text></>
            )}
            {logFilter !== "all" && searchFilter && <Text dimColor> | </Text>}
            {searchFilter && (
              <>Search: <Text color="yellow" bold>"{searchFilter}"</Text></>
            )}
            <Text dimColor> (1=all 2=err 3=play 4=test 5=srv | 'search' to clear)</Text>
          </Text>
        </Box>
      )}

      {/* Status bar */}
      <StatusBar status={serverStatus} startTime={startTime} inputActive={initialized} httpPort={httpPort} />

      {/* Command input */}
      <Box marginTop={1}>
        <CommandInput
          registry={commandProviderRegistry}
          onSubmit={handleCommand}
          prompt="mct> "
          placeholder={initialized ? "Enter command..." : "Initializing..."}
          disabled={!initialized}
          history={commandHistory}
        />
      </Box>
    </Box>
  );
};

/**
 * Render the serve screen and return control functions
 */
export function renderServeScreen(
  serverManager: ServerManager,
  options: {
    httpPort?: number;
    bdsPort?: number;
    welcomeMessage?: string;
    timeoutSeconds?: number;
    creatorTools?: any;
  } = {}
): Promise<void> {
  return new Promise((resolve) => {
    const handleExit = () => {
      // Exit will be handled by the component
    };

    const { waitUntilExit } = render(
      <ServeScreenComponent
        serverManager={serverManager}
        creatorTools={options.creatorTools}
        httpPort={options.httpPort}
        bdsPort={options.bdsPort}
        welcomeMessage={options.welcomeMessage}
        timeoutSeconds={options.timeoutSeconds}
        onExit={handleExit}
      />
    );

    waitUntilExit().then(resolve);
  });
}

export default ServeScreenComponent;

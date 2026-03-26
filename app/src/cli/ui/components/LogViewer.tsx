/**
 * =============================================================================
 * LOG VIEWER COMPONENT
 * =============================================================================
 *
 * Displays server logs using Ink's Static component for permanent output.
 * Logs are colored based on their category (player events, errors, etc.).
 *
 * Uses the ServerMessageCategory enum to determine log coloring:
 * - Green: Player connected, server started, test passed
 * - Red: Errors, test failed
 * - Yellow: Warnings, server stopping
 * - Cyan: Info messages, game test
 * - Gray: General/debug messages
 * =============================================================================
 */

import React from "react";
import { Box, Text, Static } from "ink";
import { ServerMessageCategory, getMessageCategoryPrefix } from "../../../local/ServerMessage";

export interface ILogEntry {
  id: string;
  timestamp: Date;
  message: string;
  category: ServerMessageCategory;
  type?: number;
  raw?: string;
}

interface LogViewerProps {
  logs: ILogEntry[];
  maxLines?: number;
}

/**
 * Get color for a log category
 */
function getCategoryColor(category: ServerMessageCategory): string {
  switch (category) {
    // Success/positive events - green
    case ServerMessageCategory.serverStarted:
    case ServerMessageCategory.playerConnected:
    case ServerMessageCategory.gameTestPassed:
    case ServerMessageCategory.backupComplete:
      return "green";

    // Error/negative events - red
    case ServerMessageCategory.gameTestFailed:
    case ServerMessageCategory.debuggerFailedToStart:
      return "red";

    // Warnings/transitions - yellow
    case ServerMessageCategory.serverStopped:
    case ServerMessageCategory.serverStopRequested:
    case ServerMessageCategory.serverStopping:
    case ServerMessageCategory.playerDisconnected:
    case ServerMessageCategory.backupSaving:
      return "yellow";

    // Info/status - cyan
    case ServerMessageCategory.serverStarting:
    case ServerMessageCategory.version:
    case ServerMessageCategory.gameTestLoaded:
      return "cyan";

    // Debug - magenta
    case ServerMessageCategory.debuggerListening:
      return "magenta";

    // General/other - gray
    case ServerMessageCategory.general:
    case ServerMessageCategory.internalSystemMessage:
    default:
      return "gray";
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Single log entry component
 */
const LogEntry: React.FC<{ entry: ILogEntry }> = ({ entry }) => {
  let color = getCategoryColor(entry.category);
  let prefix = getMessageCategoryPrefix(entry.category);
  const time = formatTimestamp(entry.timestamp);

  // BDS error-level messages that weren't captured by a specific category
  // should still render as errors (red with ERROR prefix)
  if (entry.type === 2 && color === "gray") {
    color = "red";
    prefix = "ERROR";
  }
  // BDS warning-level messages
  if (entry.type === 3 && color === "gray") {
    color = "yellow";
    prefix = "WARN";
  }

  return (
    <Box>
      <Text dimColor>[{time}]</Text>
      <Text> </Text>
      <Text color={color} bold>
        [{prefix}]
      </Text>
      <Text> </Text>
      <Text color={color}>{entry.message}</Text>
    </Box>
  );
};

/**
 * Log viewer component using Ink's Static for permanent output
 */
export const LogViewer: React.FC<LogViewerProps> = ({ logs, maxLines = 100 }) => {
  // Limit displayed logs
  const displayLogs = logs.slice(-maxLines);

  return <Static items={displayLogs}>{(entry: ILogEntry) => <LogEntry key={entry.id} entry={entry} />}</Static>;
};

export default LogViewer;

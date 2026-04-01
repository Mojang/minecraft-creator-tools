/**
 * =============================================================================
 * STATUS BAR COMPONENT
 * =============================================================================
 *
 * Displays server status information in a compact bar at the bottom of the screen.
 * Shows:
 * - Server state (starting, running, stopping, stopped)
 * - Player count
 * - Uptime
 * - Port
 * - Quick help hints
 * =============================================================================
 */

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { IServerStatus } from "../commands/ICommandProvider";

interface StatusBarProps {
  /** Current server status */
  status: IServerStatus;
  /** Server start time for uptime calculation */
  startTime?: Date;
  /** Whether the command input is active */
  inputActive?: boolean;
  /** HTTP server port */
  httpPort?: number;
}

/**
 * Format uptime duration
 */
function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Get color for server state
 */
function getStateColor(state: string): string {
  switch (state) {
    case "running":
      return "green";
    case "starting":
    case "stopping":
      return "yellow";
    case "stopped":
      return "red";
    default:
      return "gray";
  }
}

/**
 * Get state indicator
 */
function getStateIndicator(state: string): React.ReactNode {
  switch (state) {
    case "running":
      return <Text color="green">●</Text>;
    case "starting":
      return (
        <Text color="yellow">
          <Spinner type="dots" />
        </Text>
      );
    case "stopping":
      return (
        <Text color="yellow">
          <Spinner type="dots" />
        </Text>
      );
    case "stopped":
      return <Text color="red">○</Text>;
    default:
      return <Text color="gray">?</Text>;
  }
}

export const StatusBar: React.FC<StatusBarProps> = ({ status, startTime, inputActive = true, httpPort }) => {
  const [uptime, setUptime] = useState(0);

  // Update uptime every second
  useEffect(() => {
    if (status.state === "running" && startTime) {
      const interval = setInterval(() => {
        setUptime(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    } else if (status.uptimeSeconds !== undefined) {
      setUptime(status.uptimeSeconds);
    }
  }, [status.state, status.uptimeSeconds, startTime]);

  const stateColor = getStateColor(status.state);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      {/* Left side - server status */}
      <Box>
        {getStateIndicator(status.state)}
        <Text> </Text>
        <Text color={stateColor} bold>
          {status.state.toUpperCase()}
        </Text>

        {status.version && (
          <>
            <Text dimColor> | </Text>
            <Text dimColor>v{status.version}</Text>
          </>
        )}

        {status.worldName && (
          <>
            <Text dimColor> | </Text>
            <Text color="cyan">{status.worldName}</Text>
          </>
        )}

        {status.port && (
          <>
            <Text dimColor> | </Text>
            <Text>:{status.port}</Text>
          </>
        )}

        {httpPort && (
          <>
            <Text dimColor> | </Text>
            <Text color="green">HTTP</Text>
            <Text dimColor> :{httpPort}</Text>
          </>
        )}
      </Box>

      {/* Center - player count */}
      <Box>
        <Text color="yellow">Players: </Text>
        <Text>
          {status.playerCount}
          {status.maxPlayers ? `/${status.maxPlayers}` : ""}
        </Text>

        {status.state === "running" && (
          <>
            <Text dimColor> | </Text>
            <Text dimColor>Up: {formatUptime(uptime)}</Text>
          </>
        )}
      </Box>

      {/* Right side - help hints */}
      <Box>
        <Text dimColor>{inputActive ? "Ctrl+1-5: filter logs | 'help' for commands" : "Press any key..."}</Text>
      </Box>
    </Box>
  );
};

export default StatusBar;

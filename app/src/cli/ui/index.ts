/**
 * =============================================================================
 * CLI UI MODULE - Ink-based Interactive Terminal Interface
 * =============================================================================
 *
 * This module provides rich interactive terminal UI using Ink (React for CLI).
 *
 * Features:
 * - Real-time log display with color coding
 * - Command input with autocomplete
 * - Server status bar
 * - BDS command integration
 * - Built-in MCT commands (help, status, exit, etc.)
 *
 * Usage:
 *   import { renderServeScreen } from './ui';
 *   await renderServeScreen(serverManager, { httpPort: 6126 });
 *
 * Structure:
 *   ui/
 *   ├── commands/     - Command provider system
 *   │   ├── ICommandProvider.ts    - Interfaces and registry
 *   │   ├── MctCommandProvider.ts  - Built-in MCT commands
 *   │   └── BdsCommandProvider.ts  - BDS command definitions
 *   ├── components/   - Reusable Ink components
 *   │   ├── LogViewer.tsx          - Log display with Static
 *   │   ├── CommandInput.tsx       - Input with autocomplete
 *   │   └── StatusBar.tsx          - Server status display
 *   └── screens/      - Full-screen UI compositions
 *       └── ServeScreen.tsx        - Main serve command UI
 * =============================================================================
 */

// Command providers
export * from "./commands";

// UI Components
export * from "./components";

// Screens
export * from "./screens";

/**
 * Check if the terminal supports interactive Ink UI
 */
export function supportsInkUI(): boolean {
  // Check if stdout is a TTY (terminal)
  if (!process.stdout.isTTY) {
    return false;
  }

  // Check for CI environment variables that indicate non-interactive mode
  if (process.env.CI || process.env.GITHUB_ACTIONS || process.env.JENKINS) {
    return false;
  }

  // Check for dumb terminal
  if (process.env.TERM === "dumb") {
    return false;
  }

  return true;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Command index - exports all ToolCommands
 *
 * NOTE: ServerCommand is NOT exported here because it imports Node.js-only
 * modules (net, child_process, os, timers) via DedicatedServer.ts.
 * Use registerNodeOnlyCommands() to register it in Node.js entry points.
 */

export { helpCommand, HelpCommand } from "./HelpCommand";
export { createCommand, CreateCommand } from "./CreateCommand";
export { addCommand, AddCommand } from "./AddCommand";
export { removeCommand, RemoveCommand } from "./RemoveCommand";
export { renameCommand, RenameCommand } from "./RenameCommand";
export { scriptCommand, ScriptCommand } from "./ScriptCommand";
export { openSampleCommand, OpenSampleCommand } from "./OpenSampleCommand";
export { validateCommand, ValidateCommand } from "./ValidateCommand";
export { infoCommand, InfoCommand } from "./InfoCommand";
export { exportCommand, ExportCommand } from "./ExportCommand";
export { deployCommand, DeployCommand } from "./DeployCommand";
export { switchModeCommand, SwitchModeCommand } from "./SwitchModeCommand";
export { toggleInspectorCommand, ToggleInspectorCommand } from "./ToggleInspectorCommand";
export { reloadProjectCommand, ReloadProjectCommand } from "./ReloadProjectCommand";
export { openFileCommand, OpenFileCommand } from "./OpenFileCommand";
export { formatDocumentCommand, FormatDocumentCommand } from "./FormatDocumentCommand";
export { openSettingsCommand, OpenSettingsCommand } from "./OpenSettingsCommand";

import { helpCommand } from "./HelpCommand";
import { createCommand } from "./CreateCommand";
import { addCommand } from "./AddCommand";
import { removeCommand } from "./RemoveCommand";
import { renameCommand } from "./RenameCommand";
import { scriptCommand } from "./ScriptCommand";
import { openSampleCommand } from "./OpenSampleCommand";
import { validateCommand } from "./ValidateCommand";
import { infoCommand } from "./InfoCommand";
import { exportCommand } from "./ExportCommand";
import { deployCommand } from "./DeployCommand";
import { switchModeCommand } from "./SwitchModeCommand";
import { toggleInspectorCommand } from "./ToggleInspectorCommand";
import { reloadProjectCommand } from "./ReloadProjectCommand";
import { openFileCommand } from "./OpenFileCommand";
import { formatDocumentCommand } from "./FormatDocumentCommand";
import { openSettingsCommand } from "./OpenSettingsCommand";
import type { IToolCommand } from "../IToolCommand";
import { ToolCommandRegistry } from "../ToolCommandRegistry";

/**
 * All built-in ToolCommands that are safe for all build targets (web, Node.js, Electron).
 * ServerCommand is excluded because it transitively imports Node.js-only modules.
 */
export const allToolCommands: IToolCommand[] = [
  helpCommand,
  createCommand,
  addCommand,
  removeCommand,
  renameCommand,
  scriptCommand,
  openSampleCommand,
  validateCommand,
  infoCommand,
  exportCommand,
  deployCommand,
  switchModeCommand,
  toggleInspectorCommand,
  reloadProjectCommand,
  openFileCommand,
  formatDocumentCommand,
  openSettingsCommand,
];

/**
 * Register all platform-safe built-in commands with the registry.
 */
export function registerAllToolCommands(): void {
  ToolCommandRegistry.instance.registerAll(allToolCommands);
}

/**
 * Commands index - Aggregates all CLI commands for registration
 *
 * Commands are organized by category:
 * - validate/: Validation commands (validate, aggregateReports, search, profileValidation)
 * - project/: Project commands (create, add, fix, set, info, deploy, export*)
 * - server/: Server commands (serve, mcp, dedicatedserve, passcodes, setserverprops, eula)
 * - render/: Render commands (rendermodel, rendervanilla, renderstructure, buildstructure)
 * - docs/: Documentation commands (docs*)
 * - world/: World commands (world, ensureworld)
 * - content/: Content commands (view, edit, autotest, runtests, version)
 */

import { ICommand } from "../core/ICommand";
import { commandRegistry } from "../core/CommandRegistry";

// ============================================================================
// Validate commands
// ============================================================================
import { validateCommand } from "./validate/ValidateCommand";
import { aggregateReportsCommand } from "./validate/AggregateReportsCommand";
import { searchCommand } from "./validate/SearchCommand";
import { profileValidationCommand } from "./validate/ProfileValidationCommand";

// ============================================================================
// Project commands
// ============================================================================
import { infoCommand } from "./project/InfoCommand";
import { createCommand } from "./project/CreateCommand";
import { addCommand } from "./project/AddCommand";
import { fixCommand } from "./project/FixCommand";
import { setupCommand } from "./project/SetupCommand";
import { setCommand } from "./project/SetCommand";
import { deployCommand } from "./project/DeployCommand";
import { exportAddonCommand } from "./project/ExportAddonCommand";
import { exportWorldCommand } from "./project/ExportWorldCommand";

// ============================================================================
// Server commands
// ============================================================================
import { serveCommand } from "./server/ServeCommand";
import { mcpCommand } from "./server/McpCommand";
import { dedicatedServeCommand } from "./server/DedicatedServeCommand";
import { passcodesCommand } from "./server/PasscodesCommand";
import { setServerPropsCommand } from "./server/SetServerPropsCommand";
import { eulaCommand } from "./server/EulaCommand";

// ============================================================================
// Render commands
// ============================================================================
import { renderModelCommand } from "./render/RenderModelCommand";
import { renderVanillaCommand } from "./render/RenderVanillaCommand";
import { renderStructureCommand } from "./render/RenderStructureCommand";
import { buildStructureCommand } from "./render/BuildStructureCommand";

// ============================================================================
// Docs commands
// ============================================================================
import { docsUpdateFormSourceCommand } from "./docs/DocsUpdateFormSourceCommand";
import { docsUpdateMCCatCommand } from "./docs/DocsUpdateMCCatCommand";
import { docsGenerateFormJsonCommand } from "./docs/DocsGenerateFormJsonCommand";
import { docsGenerateMarkdownCommand } from "./docs/DocsGenerateMarkdownCommand";
import { docsGenerateTypesCommand } from "./docs/DocsGenerateTypesCommand";
import { docsGenerateJsonSchemaCommand } from "./docs/DocsGenerateJsonSchemaCommand";
import { generateSchemaPackageCommand } from "./docs/GenerateSchemaPackageCommand";

// ============================================================================
// World commands
// ============================================================================
import { worldCommand } from "./world/WorldCommand";
import { ensureWorldCommand } from "./world/EnsureWorldCommand";

// ============================================================================
// Content commands
// ============================================================================
import { versionCommand } from "./content/VersionCommand";
import { viewCommand } from "./content/ViewCommand";
import { editCommand } from "./content/EditCommand";
import { autotestCommand } from "./content/AutotestCommand";

// ============================================================================
// Aggregate all commands
// ============================================================================
const allCommands: ICommand[] = [
  // Validate commands
  validateCommand,
  aggregateReportsCommand,
  searchCommand,
  profileValidationCommand,

  // Project commands
  infoCommand,
  createCommand,
  addCommand,
  fixCommand,
  setupCommand,
  setCommand,
  deployCommand,
  exportAddonCommand,
  exportWorldCommand,

  // Server commands
  serveCommand,
  mcpCommand,
  dedicatedServeCommand,
  passcodesCommand,
  setServerPropsCommand,
  eulaCommand,

  // Render commands
  renderModelCommand,
  renderVanillaCommand,
  renderStructureCommand,
  buildStructureCommand,

  // Docs commands
  docsUpdateFormSourceCommand,
  docsUpdateMCCatCommand,
  docsGenerateFormJsonCommand,
  docsGenerateMarkdownCommand,
  docsGenerateTypesCommand,
  docsGenerateJsonSchemaCommand,
  generateSchemaPackageCommand,

  // World commands
  worldCommand,
  ensureWorldCommand,

  // Content commands
  versionCommand,
  viewCommand,
  editCommand,
  autotestCommand,
  // runTestsCommand is a placeholder — not registered until implemented
];

/**
 * Register all commands with the global registry.
 */
export function registerAllCommands(): void {
  commandRegistry.registerAll(allCommands);
}

/**
 * Get all commands for external use.
 */
export function getAllCommands(): ICommand[] {
  return allCommands;
}

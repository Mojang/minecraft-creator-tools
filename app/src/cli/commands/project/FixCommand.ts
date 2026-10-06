/**
 * FixCommand - Apply fixes and updates to a project
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command applies various automated fixes to a project,
 * such as updating script module versions or randomizing UUIDs.
 *
 * AVAILABLE FIXES:
 * - latestbetascriptversion: Update to latest beta script API
 * - usepackageversionscript: Use package.json version in scripts
 * - usemanifestversionscript: Use manifest.json version in scripts
 * - randomizealluids: Randomize all UUIDs in the project
 * - setnewestformatversions: Update format_version fields
 * - setnewestminengineversion: Update min_engine_version
 *
 * USAGE:
 * npx mct fix <fix-name> -i <project-folder>
 *
 * IMPLEMENTATION:
 * Uses existing manager classes from src/manager/ that implement IProjectUpdater:
 * - ScriptModuleManager: Handles script module version updates (saves the manifests itself)
 * - FormatVersionManager: Handles setnewestformatversions, which only updates world template
 *   base_game_version today
 * - MinEngineVersionManager: Handles min_engine_version updates
 * - ProjectUtilities.randomizeAllUids: Saves the project itself
 *
 * SAVING:
 * FormatVersionManager and MinEngineVersionManager only change files in memory, so this
 * command writes the files they report (writeAndReportUpdates) and counts only files that
 * reached disk. It asks them to keep comments and to never lower a version, because the target
 * comes from a network lookup that falls back to an older bundled version when it fails. If an
 * updater fails or a file can't be written, the command reports what changed, then what failed,
 * and exits with an error. --dry-run returns before any fix runs, so nothing is written.
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import ProjectUtilities from "../../../app/ProjectUtilities";
import ScriptModuleManager from "../../../manager/ScriptModuleManager";
import FormatVersionManager from "../../../manager/FormatVersionManager";
import MinEngineVersionManager from "../../../manager/MinEngineVersionManager";
import ProjectUpdateResult from "../../../updates/ProjectUpdateResult";
import { UpdateResultType } from "../../../updates/IUpdateResult";

const AVAILABLE_FIXES = [
  "latestbetascriptversion",
  "randomizealluids",
  "setnewestformatversions",
  "setnewestminengineversion",
];

/**
 * Per-fix metadata for pro-grade discoverability.
 *
 * `safety` ratings:
 *  - `safe`         — Affects metadata only; no JSON content lost; no functional change to gameplay.
 *  - `idempotent`   — Re-running produces no further change once applied. Safe to script.
 *  - `destructive`  — Modifies UUIDs, file contents, or other identifiers in ways that may break
 *                     downstream references (saved worlds, deployed packs, dependent packs).
 *
 * `reversible`: whether the fix can be reverted by re-running another fix or via git only.
 */
const FIX_DESCRIPTIONS: Record<string, string> = {
  latestbetascriptversion: "Update @minecraft script module dependencies to the latest beta versions",
  randomizealluids: "Regenerate all UUIDs in manifest files (use when cloning projects to avoid conflicts)",
  setnewestformatversions: "Update format_version fields across all definition files to the newest supported version",
  setnewestminengineversion: "Update min_engine_version in manifests to the newest supported version",
};

const FIX_METADATA: Record<string, { safety: "safe" | "idempotent" | "destructive"; reversible: string }> = {
  latestbetascriptversion: { safety: "idempotent", reversible: "Pin a specific version in package.json to revert." },
  randomizealluids: {
    safety: "destructive",
    reversible: "Not reversible by another fix. Use git to recover. Will break existing world references to this pack.",
  },
  setnewestformatversions: {
    safety: "idempotent",
    reversible: "Edit each file's format_version manually to the prior value, or revert via git.",
  },
  setnewestminengineversion: {
    safety: "idempotent",
    reversible: "Edit manifest min_engine_version manually to the prior value, or revert via git.",
  },
};

export class FixCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "fix",
    description: "Fixes or updates the project with a set of desired fixes",
    taskType: TaskType.fix,
    aliases: [],
    requiresProjects: true,
    isWriteCommand: true,
    isEditInPlace: true,
    isLongRunning: false,
    category: "Project",
    arguments: [
      {
        name: "fix",
        description: `Desired fix name:\n${AVAILABLE_FIXES.map((f) => `  ${f} - ${FIX_DESCRIPTIONS[f]}`).join("\n")}`,
        required: false,
        contextField: "subCommand",
        choices: AVAILABLE_FIXES,
      },
    ],
    globalOptionGroups: ["input", "projects", "dryRun", "json"],
    examples: [
      {
        description: "Re-randomize manifest UUIDs (after cloning a project)",
        command: "mct fix randomizealluids -i ./myproj",
      },
      {
        description: "Bump format_version fields to the newest supported",
        command: "mct fix setnewestformatversions -i ./myproj",
      },
      {
        description: "Dry run: report what would change, write nothing",
        command: "mct fix randomizealluids -i ./myproj -n",
      },
      { description: "Discover available fixes (and which are reversible)", command: "mct fix --list" },
    ],
    learnMore: [
      "Most fixes edit files in place; commit or stash before running them.",
      "Combine with `--quiet --json` in CI to suppress chatter and parse the result.",
    ],
  };

  configure(cmd: Command): void {
    // --list adds a discovery affordance for CI: prints all available fixes
    // with their descriptions, safety classifications, and reversibility hints.
    cmd.option("--list", "List all available fixes with safety/reversibility metadata, then exit.");
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    const fixName = context.subCommand;

    // --list / `mct fix list` discovery path. Honours --json for CI.
    const wantsList = fixName === "list" || Boolean(context.commandOptions?.list);
    if (wantsList) {
      const fixes = AVAILABLE_FIXES.map((id) => ({
        id,
        description: FIX_DESCRIPTIONS[id],
        safety: FIX_METADATA[id]?.safety ?? "unknown",
        reversible: FIX_METADATA[id]?.reversible ?? "Unknown — review the source before running.",
      }));
      if (context.json) {
        context.log.data(
          JSON.stringify({
            schemaVersion: "1.0.0",
            command: "fix",
            fixes,
          })
        );
      } else {
        context.log.info("Available fixes:");
        for (const f of fixes) {
          context.log.info(`  ${f.id}  [${f.safety}]`);
          context.log.info(`    ${f.description}`);
          context.log.info(`    Reversibility: ${f.reversible}`);
          context.log.info("");
        }
      }
      this.logComplete(context);
      return;
    }

    if (!fixName) {
      context.log.error(
        `No fix was specified. Use the [fix] subcommand to specify a fix. Available: ${AVAILABLE_FIXES.join(", ")}`
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const fixCanon = fixName.toLowerCase().trim();

    if (!fixCanon) {
      context.log.error("Fix name cannot be empty");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    if (!AVAILABLE_FIXES.includes(fixCanon)) {
      context.log.error(`Unknown fix: '${fixName}'. Available: ${AVAILABLE_FIXES.join(", ")}`);
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const fixResults: { project: string; fix: string; updatedCount: number }[] = [];

    for (const project of context.projects) {
      await project.inferProjectItemsFromFiles();

      if (context.dryRun) {
        context.log.info("Dry run: would apply fix '" + fixCanon + "' to project: " + project.name);
        continue;
      }

      if (!context.quiet && !context.json) {
        context.log.info(`Applying fix '${fixCanon}' to project: ${project.name}`);
      }

      switch (fixCanon) {
        case "latestbetascriptversion": {
          const scriptManager = new ScriptModuleManager();
          const results = await scriptManager.updateModulesToLatestVersion(project);
          fixResults.push({ project: project.name, fix: fixCanon, updatedCount: results.length });
          if (results.length > 0) {
            if (!context.quiet && !context.json) {
              for (const result of results) {
                context.log.info(`  ${result.message}: ${result.data || ""}`);
              }
              context.log.success(`Updated ${results.length} script module(s) in project: ${project.name}`);
            }
          } else {
            if (!context.quiet && !context.json) {
              context.log.info(`No script modules to update in project: ${project.name}`);
            }
          }
          break;
        }

        case "randomizealluids":
          await ProjectUtilities.randomizeAllUids(project);
          fixResults.push({ project: project.name, fix: fixCanon, updatedCount: 1 });
          if (!context.quiet && !context.json) {
            context.log.success(`Randomized all UUIDs in project: ${project.name}`);
          }
          break;

        case "setnewestformatversions": {
          const results = await new FormatVersionManager().updateBaseGameVersionToLatestVersion(project, {
            keepNewerVersions: true,
            preserveComments: true,
          });
          const updatedCount = await this.writeAndReportUpdates(context, project.name, results, {
            updatedNoun: "format_version(s)",
            noneMessage: "No format versions to update",
          });
          fixResults.push({ project: project.name, fix: fixCanon, updatedCount });
          break;
        }

        case "setnewestminengineversion": {
          const results = await new MinEngineVersionManager().updateMinEngineVersionToLatestVersion(project, {
            keepNewerVersions: true,
            preserveComments: true,
          });
          const updatedCount = await this.writeAndReportUpdates(context, project.name, results, {
            updatedNoun: "min_engine_version(s)",
            noneMessage: "No min engine versions to update",
          });
          fixResults.push({ project: project.name, fix: fixCanon, updatedCount });
          break;
        }
      }
    }

    if (context.json) {
      context.log.data(JSON.stringify({ fixes: fixResults, projectCount: context.projects.length }));
    }

    this.logComplete(context);
  }

  /**
   * Writes the files an updater changed in memory, reports the ones that reached disk, and returns
   * how many did. Updater errors, such as a failed version lookup, and files that can't be written
   * are listed after the updates, followed by a count of failed writes, and set a failing exit code.
   */
  private async writeAndReportUpdates(
    context: ICommandContext,
    projectName: string,
    results: ProjectUpdateResult[],
    text: { updatedNoun: string; noneMessage: string }
  ): Promise<number> {
    const written: ProjectUpdateResult[] = [];
    const errors: string[] = [];
    let failedWrites = 0;

    for (const result of results) {
      if (result.resultType === UpdateResultType.internalProcessingError) {
        errors.push(result.message);
        continue;
      }

      const file = result.projectItem?.primaryFile;

      if (result.resultType !== UpdateResultType.updatedFile || !file?.needsSave) {
        continue;
      }

      try {
        await file.saveContent();
        written.push(result);
      } catch (e: unknown) {
        errors.push(`Could not save ${file.fullPath}: ${e instanceof Error ? e.message : String(e)}`);
        failedWrites++;
      }
    }

    if (!context.quiet && !context.json) {
      if (written.length > 0) {
        for (const result of written) {
          context.log.info(`  ${result.message}: ${result.data || ""}`);
        }
        context.log.success(`Updated ${written.length} ${text.updatedNoun} in project: ${projectName}`);
      } else if (errors.length === 0) {
        context.log.info(`${text.noneMessage} in project: ${projectName}`);
      }
    }

    for (const error of errors) {
      context.log.error(error);
    }

    if (failedWrites > 0) {
      context.log.error(`Could not update ${failedWrites} ${text.updatedNoun} in project: ${projectName}`);
    }

    if (errors.length > 0) {
      context.setExitCode(ErrorCodes.INIT_ERROR);
    }

    return written.length;
  }
}

export const fixCommand = new FixCommand();

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
 * - ScriptModuleManager: Handles script module version updates
 * - FormatVersionManager: Handles format_version updates
 * - MinEngineVersionManager: Handles min_engine_version updates
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import ProjectUtilities from "../../../app/ProjectUtilities";
import ScriptModuleManager from "../../../manager/ScriptModuleManager";
import FormatVersionManager from "../../../manager/FormatVersionManager";
import MinEngineVersionManager from "../../../manager/MinEngineVersionManager";

const AVAILABLE_FIXES = [
  "latestbetascriptversion",
  "randomizealluids",
  "setnewestformatversions",
  "setnewestminengineversion",
];

const FIX_DESCRIPTIONS: Record<string, string> = {
  latestbetascriptversion: "Update @minecraft script module dependencies to the latest beta versions",
  randomizealluids: "Regenerate all UUIDs in manifest files (use when cloning projects to avoid conflicts)",
  setnewestformatversions: "Update format_version fields across all definition files to the newest supported version",
  setnewestminengineversion: "Update min_engine_version in manifests to the newest supported version",
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
  };

  configure(cmd: Command): void {
    // Arguments are configured via metadata.arguments
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    const fixName = context.subCommand;

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
          const formatManager = new FormatVersionManager();
          const results = await formatManager.update(project, 1);
          fixResults.push({ project: project.name, fix: fixCanon, updatedCount: results.length });
          if (results.length > 0) {
            if (!context.quiet && !context.json) {
              for (const result of results) {
                context.log.info(`  ${result.message}: ${result.data || ""}`);
              }
              context.log.success(`Updated ${results.length} format_version(s) in project: ${project.name}`);
            }
          } else {
            if (!context.quiet && !context.json) {
              context.log.info(`No format versions to update in project: ${project.name}`);
            }
          }
          break;
        }

        case "setnewestminengineversion": {
          const engineManager = new MinEngineVersionManager();
          const results = await engineManager.update(project, 1);
          fixResults.push({ project: project.name, fix: fixCanon, updatedCount: results.length });
          if (results.length > 0) {
            if (!context.quiet && !context.json) {
              for (const result of results) {
                context.log.info(`  ${result.message}: ${result.data || ""}`);
              }
              context.log.success(`Updated ${results.length} min_engine_version(s) in project: ${project.name}`);
            }
          } else {
            if (!context.quiet && !context.json) {
              context.log.info(`No min engine versions to update in project: ${project.name}`);
            }
          }
          break;
        }
      }
    }

    if (context.json) {
      context.log.data(JSON.stringify({ fixes: fixResults, projectCount: context.projects.length }));
    }

    this.logComplete(context);
  }
}

export const fixCommand = new FixCommand();

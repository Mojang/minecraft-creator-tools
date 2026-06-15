/**
 * ProfileValidationCommand - Profiles validation performance / memory
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * Validation runs inside Node.js worker_threads (one worker per project).
 * Profiling on the main thread would only catch the orchestration loop and
 * miss the actual work, so this command sets `profileMode` on each task —
 * TaskWorker.ts then wraps `executeTask` with the V8 inspector profiler
 * inside the worker itself.
 *
 * MODES (`--profile-mode`):
 *  - `cpu`    : `.cpuprofile` per project — where is CPU time spent?
 *  - `memory` : `.heapprofile` (sampling allocations) +
 *               `.memstats.json` (RSS / heap over time) +
 *               `.heapsnapshot` at peak RSS.
 *               Best for "what is eating all the RAM?".
 *  - `all`    : Same as `memory`, plus a final `.heapsnapshot` after work
 *               completes (useful for spotting leak/retention).
 *
 * Output lands in `<cwd>/debugoutput/`. Open `.cpuprofile` / `.heapprofile`
 * in Chrome DevTools → Performance / Memory → Load profile. Open
 * `.heapsnapshot` in Chrome DevTools → Memory tab.
 *
 * USAGE:
 *   npx mct profileValidation -i <project-folder>                 # default: memory
 *   npx mct profileValidation -i <project-folder> --profile-mode cpu
 *   npx mct profileValidation -i <project-folder> --profile-mode all
 *
 * NOTE: run with --threads 1 so worker exits cleanly and the heap snapshot
 * is taken at the right moment. The default `npx mct` threads setting
 * already honors `-t 1`.
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import IProjectStartInfo from "../../IProjectStartInfo";
import { ProfileMode } from "../../ITask";

interface IProfileValidateArgs {
  project: IProjectStartInfo;
  arguments: {
    suite?: string;
    exclusionList?: string;
    outputMci: boolean;
    outputType: number;
  };
  outputFolder?: string;
  inputFolder?: string;
  displayInfo: boolean;
  displayVerbose: boolean;
  force: boolean;
  profileMode: ProfileMode;
  profileName: string;
}

const VALID_MODES: ProfileMode[] = ["cpu", "memory", "all"];

export class ProfileValidationCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "profileValidation",
    description: "Profile validating a single project (CPU + memory). Output lands in <cwd>/debugoutput/.",
    taskType: TaskType.profileValidation,
    aliases: [],
    requiresProjects: true,
    isWriteCommand: false,
    isEditInPlace: false,
    isLongRunning: true,
    category: "Validation",
    internal: true,
  };

  configure(cmd: Command): void {
    cmd.option("--profile-mode <mode>", "Type of profile to capture: cpu | memory | all (default: memory)", "memory");
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    if (context.projectCount === 0) {
      context.log.error("No projects to profile. Use -i to specify a project folder.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Resolve profile mode from CLI option / context. Commander stores
    // --profile-mode in cmdline option flags as `profileMode`.
    const requestedMode = this.resolveProfileMode(context);

    for (let i = 0; i < context.projects.length; i++) {
      const project = context.projects[i];
      const projectStart = this.getProjectStartInfo(project);
      const profileName = (project.name || `project-${i + 1}`).replace(/[^a-z0-9._-]+/gi, "_").slice(0, 60);

      context.log.info(
        `Profiling project ${i + 1}/${context.projectCount}: ${project.name} (mode=${requestedMode}). Files land in debugoutput/.`
      );

      try {
        const taskArgs: IProfileValidateArgs = {
          project: projectStart,
          arguments: {
            suite: context.validation.suite !== undefined ? String(context.validation.suite) : undefined,
            exclusionList: context.validation.exclusionList,
            outputMci: true,
            outputType: context.outputType,
          },
          outputFolder: context.outputFolder !== context.inputFolder ? context.outputFolder : undefined,
          inputFolder: context.inputFolder,
          displayInfo: context.localEnv.displayInfo,
          displayVerbose: context.verbose,
          force: context.force,
          profileMode: requestedMode,
          profileName,
        };

        const result = await context.workerPool.execute({
          taskType: TaskType.validate,
          args: taskArgs,
        });

        if (!result.success) {
          context.log.error(`Validation failed during profiling: ${result.error}`);
          context.setExitCode(ErrorCodes.VALIDATION_INTERNALPROCESSINGERROR);
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        context.log.error(`Internal Processing Error during profiling: ${message}`);
        context.setExitCode(ErrorCodes.VALIDATION_INTERNALPROCESSINGERROR);
      }
    }

    if (context.json) {
      context.log.data(
        JSON.stringify({
          schemaVersion: "1.0.0",
          command: "profilevalidation",
          mode: requestedMode,
          success: true,
          message: "Profiling complete. Check debugoutput/ for output files.",
        })
      );
    } else {
      context.log.success(
        `Profiling (${requestedMode}) complete. Check debugoutput/ for .cpuprofile / .heapprofile / .heapsnapshot / .memstats.json files.`
      );
    }
    this.logComplete(context);
  }

  /**
   * Resolve which profile mode to use. Looks at:
   *  1. `context.commandOptions.profileMode` (set by `--profile-mode`)
   *  2. Default = "memory"
   */
  private resolveProfileMode(context: ICommandContext): ProfileMode {
    const fromOptions = context.commandOptions?.profileMode as string | undefined;
    const raw = (fromOptions || "memory").toString().toLowerCase() as ProfileMode;
    if (!VALID_MODES.includes(raw)) {
      return "memory";
    }
    return raw;
  }

  private getProjectStartInfo(project: import("../../../app/Project").default): IProjectStartInfo {
    return {
      ctorProjectName: project.name,
      localFilePath: project.localFilePath,
      localFolderPath: project.localFolderPath,
      accessoryFiles: project.accessoryFilePaths,
    };
  }
}

export const profileValidationCommand = new ProfileValidationCommand();

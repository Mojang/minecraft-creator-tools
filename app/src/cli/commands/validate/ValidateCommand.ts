/**
 * ValidateCommand - Validates Minecraft content projects
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * The validate command is the most commonly used command in MCT. It:
 * 1. Scans project files for issues
 * 2. Runs a suite of validators (configurable)
 * 3. Outputs reports in various formats
 * 4. Supports parallel execution via worker pool
 *
 * VALIDATION SUITES:
 * - main (default): Most common validations
 * - addon: Add-on specific checks
 * - currentplatform: Platform-specific checks
 * - all: All available validators
 *
 * OUTPUT MODES:
 * - Normal: Individual report files per project
 * - noReports: Suppress report generation
 * - aggregate: Combine reports across all projects
 *
 * PARALLELIZATION:
 * When threads > 1, validation is distributed across worker threads.
 * Each worker gets a serialized ITask and returns IProjectMetaState.
 *
 * RELATED FILES:
 * - TaskWorker.ts: Worker thread implementation
 * - ProjectInfoSet.ts: Validation result container
 * - info/generators/*: Individual validator implementations
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes, IWorkerTask } from "../../core/ICommandContext";
import { TaskType, OutputType } from "../../ClUtils";
import IProjectMetaState from "../../../info/IProjectMetaState";
import ProjectInfoSet from "../../../info/ProjectInfoSet";
import { InfoItemType } from "../../../info/IInfoItemData";
import IProjectStartInfo from "../../IProjectStartInfo";
import StorageUtilities from "../../../storage/StorageUtilities";
import NodeStorage from "../../../local/NodeStorage";
import NodeFile from "../../../local/NodeFile";
import NodeFolder from "../../../local/NodeFolder";
import ContentIndex from "../../../core/ContentIndex";
import DistributedContentIndex from "../../../storage/DistributedContentIndex";
import IIndexJson from "../../../storage/IIndexJson";
import Utilities from "../../../core/Utilities";

/**
 * Arguments specific to validation tasks sent to workers.
 */
interface IValidateTaskArgs {
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
}

/**
 * ValidateCommand runs validation on projects.
 */
export class ValidateCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "validate",
    description: "Validate the current project.",
    taskType: TaskType.validate,
    aliases: ["val"],
    requiresProjects: true,
    isWriteCommand: false,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Validation",
    arguments: [
      {
        name: "suite",
        description:
          "Specifies the type of validation suite to run: " +
          "'main' (default, most common checks), " +
          "'addon' (add-on packaging and structure checks), " +
          "'currentplatform' (platform-specific compatibility checks), " +
          "'all' (every available validator), " +
          "'default' (alias for main)",
        required: false,
        defaultValue: "main",
        choices: ["all", "default", "addon", "currentplatform", "main"],
        contextField: "suite",
      },
      {
        name: "exclusions",
        description: "Specifies a comma-separated list of tests to exclude, e.g., PATHLENGTH,PACKSIZE",
        required: false,
        contextField: "exclusions",
      },
      {
        name: "aggregateReports",
        description: "Specify 'aggregate' to aggregate reports across projects at the end of the run.",
        required: false,
        contextField: "aggregateReports",
        choices: ["aggregatenoindex", "aggregate", "true", "false", "1", "0"],
      },
    ],
  };

  configure(cmd: Command): void {
    // Arguments are configured via metadata.arguments
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    const projectList: IProjectMetaState[] = [];

    if (context.projects.length === 0) {
      if (context.json) {
        context.log.data(
          JSON.stringify({
            schemaVersion: "1.0.0",
            command: "validate",
            projects: [],
            errors: 0,
            warnings: 0,
            recommendations: 0,
          })
        );
      } else {
        context.log.warn("No projects found to validate. Use -i to specify a project folder.");
      }
      return;
    }

    // Use sequential processing if threads=1, otherwise use worker pool
    if (context.threads === 1) {
      await this.processSequentially(context, projectList);
    } else {
      await this.processWithWorkers(context, projectList);
    }

    // Aggregate reports if requested
    if (context.validation.aggregateReports) {
      if (!context.json) {
        context.log.info(`Aggregating reports across ${projectList.length} projects.`);
      }
      await this.saveAggregatedReports(context, projectList);
    }

    if (context.json) {
      this.outputJson(context, projectList);
    }

    this.logComplete(context);
  }

  /**
   * Process projects sequentially in the main thread.
   */
  private async processSequentially(context: ICommandContext, projectList: IProjectMetaState[]): Promise<void> {
    for (let i = 0; i < context.projects.length; i++) {
      const project = context.projects[i];
      const projectStart = this.getProjectStartInfo(project);

      if (!context.json) {
        context.log.info(`Processing project ${i + 1}/${context.projectCount}: ${project.name}`);
      }

      try {
        const taskArgs = this.buildTaskArgs(context, projectStart);

        // Execute via worker pool (which handles single-threaded case too)
        const result = await context.workerPool.execute<IValidateTaskArgs, IProjectMetaState[]>({
          taskType: TaskType.validate,
          args: taskArgs,
        });

        if (result.success && result.result) {
          await this.processValidationResult(context, result.result, projectStart, projectList);
        } else if (!result.success) {
          if (!context.json) {
            context.log.error(`Validation failed for ${project.name}: ${result.error}`);
          }
          context.setExitCode(ErrorCodes.VALIDATION_INTERNALPROCESSINGERROR);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        const stack = e instanceof Error ? e.stack : undefined;
        if (!context.json) {
          context.log.error(`Processing Error for ${project.name}: ${message}${stack ? "\n" + stack : ""}`);
        }
        context.setExitCode(ErrorCodes.VALIDATION_INTERNALPROCESSINGERROR);
      }
    }
  }

  /**
   * Process projects in parallel using worker pool.
   */
  private async processWithWorkers(context: ICommandContext, projectList: IProjectMetaState[]): Promise<void> {
    // Build tasks for all projects
    const tasks: IWorkerTask<IValidateTaskArgs, IProjectMetaState[]>[] = [];
    const projectStarts: IProjectStartInfo[] = [];

    for (const project of context.projects) {
      const projectStart = this.getProjectStartInfo(project);
      projectStarts.push(projectStart);

      tasks.push({
        taskType: TaskType.validate,
        args: this.buildTaskArgs(context, projectStart),
      });
    }

    // Execute all tasks via worker pool
    const results = await context.workerPool.executeBatch(tasks, (completed, total) => {
      context.log.progress(completed, total, "projects validated");
    });

    // Process results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const projectStart = projectStarts[i];

      if (result.success && result.result) {
        await this.processValidationResult(context, result.result, projectStart, projectList);
      } else if (!result.success) {
        if (!context.json) {
          context.log.error(`Worker process error for ${projectStart.ctorProjectName}: ${result.error}`);
        }
        context.setExitCode(ErrorCodes.VALIDATION_INTERNALPROCESSINGERROR);
      }
    }
  }

  /**
   * Build task arguments for a project.
   */
  private buildTaskArgs(context: ICommandContext, projectStart: IProjectStartInfo): IValidateTaskArgs {
    return {
      project: projectStart,
      arguments: {
        suite: context.validation.suite,
        exclusionList: context.validation.exclusionList,
        outputMci:
          context.validation.outputMci ||
          context.validation.aggregateReports ||
          context.outputType === OutputType.noReports,
        outputType: context.outputType,
      },
      outputFolder: context.outputFolder !== context.inputFolder ? context.outputFolder : undefined,
      inputFolder: context.inputFolder,
      displayInfo: context.localEnv.displayInfo,
      displayVerbose: context.verbose,
      force: context.force,
    };
  }

  /**
   * Convert Project to IProjectStartInfo for worker serialization.
   */
  private getProjectStartInfo(project: import("../../../app/Project").default): IProjectStartInfo {
    return {
      ctorProjectName: project.name,
      localFilePath: project.localFilePath,
      localFolderPath: project.localFolderPath,
      accessoryFiles: project.accessoryFilePaths,
    };
  }

  /**
   * Process validation results from a worker.
   */
  private async processValidationResult(
    context: ICommandContext,
    result: IProjectMetaState[] | string,
    projectStart: IProjectStartInfo,
    projectList: IProjectMetaState[]
  ): Promise<void> {
    if (typeof result === "string") {
      if (!context.json) {
        context.log.error(`${projectStart.ctorProjectName} error: ${result}`);
      }
      context.setExitCode(ErrorCodes.VALIDATION_INTERNALPROCESSINGERROR);
      return;
    }

    for (const metaState of result) {
      // Clear icons to save memory for aggregation
      if (metaState.infoSetData?.info?.["defaultIcon"]) {
        metaState.infoSetData.info["defaultIcon"] = undefined;
      }

      projectList.push(metaState);

      const infoSet = metaState.infoSetData;
      if (!infoSet?.items) continue;

      for (const item of infoSet.items) {
        if (item.iTp === InfoItemType.internalProcessingError) {
          if (!context.json) {
            const errorMessage =
              "Internal Processing Error: " + ProjectInfoSet.getExtendedMessageFromData(infoSet, item);
            if (context.validation.warnOnly) {
              context.log.warn(errorMessage);
            } else {
              context.log.error(errorMessage);
            }
          }
          if (!context.validation.warnOnly) {
            context.setExitCode(ErrorCodes.VALIDATION_INTERNALPROCESSINGERROR);
          }
        } else if (item.iTp === InfoItemType.testCompleteFail) {
          if (!context.json) {
            const failMessage = "Test Fail: " + ProjectInfoSet.getExtendedMessageFromData(infoSet, item);
            if (context.validation.warnOnly) {
              context.log.warn(failMessage);
            } else {
              context.log.error(failMessage);
            }
          }
          if (!context.validation.warnOnly) {
            context.setExitCode(ErrorCodes.VALIDATION_TESTFAIL);
          }
        } else if (item.iTp === InfoItemType.error) {
          if (!context.json) {
            const itemMessage = ProjectInfoSet.getExtendedMessageFromData(infoSet, item);
            if (context.validation.warnOnly) {
              context.log.warn(itemMessage);
            } else {
              context.log.error(itemMessage);
            }
          }
          if (!context.validation.warnOnly) {
            context.setExitCode(ErrorCodes.VALIDATION_ERROR);
          }
        }
      }
    }
  }

  private static infoItemTypeToString(type: InfoItemType): string {
    switch (type) {
      case InfoItemType.error:
        return "error";
      case InfoItemType.warning:
        return "warning";
      case InfoItemType.info:
        return "info";
      case InfoItemType.recommendation:
        return "recommendation";
      case InfoItemType.internalProcessingError:
        return "internalProcessingError";
      case InfoItemType.testCompleteFail:
        return "testFail";
      case InfoItemType.testCompleteSuccess:
        return "testPass";
      case InfoItemType.featureAggregate:
        return "featureAggregate";
      default:
        return "unknown";
    }
  }

  /**
   * Output structured JSON for all validation results.
   */
  private outputJson(context: ICommandContext, projectList: IProjectMetaState[]): void {
    const projects = projectList.map((meta) => {
      const infoSet = meta.infoSetData;
      const items = (infoSet?.items ?? []).map((item) => ({
        type: ValidateCommand.infoItemTypeToString(item.iTp),
        message: ProjectInfoSet.getEffectiveMessageFromData(infoSet, item) ?? "",
        data: item.d,
        path: item.p ?? undefined,
        generatorId: item.gId,
      }));

      return {
        name: meta.projectName ?? meta.projectContainerName,
        path: meta.projectPath ?? undefined,
        items,
      };
    });

    let totalErrors = 0;
    let totalWarnings = 0;
    let totalRecommendations = 0;

    for (const meta of projectList) {
      if (meta.infoSetData?.items) {
        for (const item of meta.infoSetData.items) {
          if (
            item.iTp === InfoItemType.error ||
            item.iTp === InfoItemType.testCompleteFail ||
            item.iTp === InfoItemType.internalProcessingError
          ) {
            totalErrors++;
          } else if (item.iTp === InfoItemType.warning) {
            totalWarnings++;
          } else if (item.iTp === InfoItemType.recommendation) {
            totalRecommendations++;
          }
        }
      }
    }

    context.log.data(
      JSON.stringify({
        schemaVersion: "1.0.0",
        command: "validate",
        projects,
        errors: totalErrors,
        warnings: totalWarnings,
        recommendations: totalRecommendations,
      })
    );
  }

  /**
   * Maximum number of issue lines per CSV to prevent enormous files.
   */
  private static readonly MAX_LINES_PER_CSV_FILE = 500000;

  /**
   * Save aggregated reports across all projects.
   * Generates CSV files (e.g., all.csv, allprojects.csv) and optionally
   * content index files when the 'aggregate' arg is passed to validate.
   *
   * Ported from the legacy saveAggregatedReports in index.ts.
   */
  private async saveAggregatedReports(context: ICommandContext, projectList: IProjectMetaState[]): Promise<void> {
    if (projectList.length === 0) {
      context.log.info("No projects to aggregate.");
      return;
    }

    const csvHeader = ProjectInfoSet.CommonCsvHeader;

    const sampleProjectInfoSets: { [suiteName: string]: ProjectInfoSet | undefined } = {};

    const featureSetsByName: {
      [suiteName: string]: { [setName: string]: { [measureName: string]: number | undefined } | undefined };
    } = {};
    const fieldsByName: { [suiteName: string]: { [featureName: string]: boolean | undefined } } = {};

    const issueLines: { [name: string]: string[] } = {};
    const summaryLines: { [name: string]: string[] } = {};
    const mciFileList: IIndexJson = { files: [], folders: [] };
    const megaContentIndex: ContentIndex = new ContentIndex();

    let outputStorage: NodeStorage | undefined;
    let mciFolder: NodeFolder | undefined;
    let indexFolder: NodeFolder | undefined;

    if (context.outputFolder) {
      outputStorage = new NodeStorage(context.outputFolder, "");
      indexFolder = outputStorage.rootFolder.ensureFolder("index");
      mciFolder = outputStorage.rootFolder.ensureFolder("mci");
    }

    // Phase 1: Build feature sets, fields, and content index from all projects
    let projectsProcessedOne = 0;

    for (const projectSet of projectList) {
      let suiteName = "all";

      if (projectSet.suite !== undefined) {
        suiteName = ProjectInfoSet.getSuiteString(projectSet.suite);
      }

      const pisData = projectSet.infoSetData;
      const contentIndex = new ContentIndex();
      const projectBaseName = StorageUtilities.removeContainerExtension(projectSet.projectContainerName);

      if (pisData.index) {
        contentIndex.loadFromData(pisData.index);
      }

      const pis = new ProjectInfoSet(undefined, undefined, undefined, pisData.info, pisData.items, contentIndex);

      if (pis.contentIndex) {
        megaContentIndex.mergeFrom(pis.contentIndex, projectBaseName);
      }

      if (projectSet.projectName) {
        mciFileList.files.push(projectBaseName.toLowerCase() + ".mci.json");
      }

      if (projectsProcessedOne > 0 && projectsProcessedOne % 500 === 0) {
        context.log.info(`Processed ${projectsProcessedOne} reports in phase 1 @ ${projectBaseName}`);
      }

      if (!Utilities.isUsableAsObjectKey(suiteName)) {
        context.log.error(`Invalid suite name: ${suiteName}`);
        continue;
      }

      if (featureSetsByName[suiteName] === undefined) {
        featureSetsByName[suiteName] = {};
      }

      if (fieldsByName[suiteName] === undefined) {
        fieldsByName[suiteName] = {};
      }

      pis.mergeFeatureSetsAndFieldsTo(featureSetsByName[suiteName], fieldsByName[suiteName]);
      projectsProcessedOne++;
    }

    // Phase 2: Build CSV lines and write output
    let projectsProcessedTwo = 0;

    for (const projectSet of projectList) {
      let suiteName = "all";

      if (projectSet.suite !== undefined) {
        suiteName = ProjectInfoSet.getSuiteString(projectSet.suite);
      }

      const pisData = projectSet.infoSetData;
      const projectBaseName = StorageUtilities.removeContainerExtension(projectSet.projectContainerName);
      const pis = new ProjectInfoSet(undefined, undefined, undefined, pisData.info, pisData.items);

      if (featureSetsByName[suiteName] === undefined) {
        featureSetsByName[suiteName] = {};
      }

      const featureSets = featureSetsByName[suiteName];

      if (fieldsByName[suiteName] === undefined) {
        fieldsByName[suiteName] = {};
      }

      const fields = fieldsByName[suiteName];

      pis.mergeFeatureSetsAndFieldsTo(featureSets, fields);

      if (projectsProcessedTwo > 0 && projectsProcessedTwo % 500 === 0) {
        context.log.info(`Processed ${projectsProcessedTwo} reports in phase 2 @ ${projectBaseName}`);
      }

      sampleProjectInfoSets[suiteName] = pis;

      if (issueLines[suiteName] === undefined) {
        issueLines[suiteName] = [];
      }

      if (issueLines[suiteName].length < ValidateCommand.MAX_LINES_PER_CSV_FILE) {
        const pisLines = pis.getItemCsvLines();

        for (let j = 0; j < pisLines.length; j++) {
          issueLines[suiteName].push('"' + projectBaseName + '",' + pisLines[j]);
        }
      }

      if (summaryLines[suiteName] === undefined) {
        summaryLines[suiteName] = [];
      }

      if (outputStorage) {
        summaryLines[suiteName].push(pis.getSummaryCsvLine(projectBaseName, projectSet.projectTitle, featureSets));
      }

      projectsProcessedTwo++;
    }

    context.log.info(`Saving aggregated content for ${projectList.length} projects.`);

    // Write output files
    if (outputStorage) {
      // Write issue CSV files (e.g., all.csv)
      for (const issueLinesName in issueLines) {
        if (sampleProjectInfoSets[issueLinesName]) {
          const issueLinesSet = issueLines[issueLinesName];

          if (issueLinesSet.length < ValidateCommand.MAX_LINES_PER_CSV_FILE) {
            const allCsvFile = outputStorage.rootFolder.ensureFile(issueLinesName + ".csv");

            const allCsvContent = "Project," + csvHeader + "\n" + issueLinesSet.join("\n");

            allCsvFile.setContent(allCsvContent);
            await allCsvFile.saveContent();
          }
        }
      }

      // Write mci index
      if (mciFolder) {
        const mciIndexFile = mciFolder.ensureFile("index.json");
        mciFileList.files.sort();
        mciIndexFile.setContent(JSON.stringify(mciFileList));
        await mciIndexFile.saveContent();
      }

      context.log.info("Saving summary lines.");

      // Write summary CSV files (e.g., allprojects.csv)
      for (const summaryLinesName in summaryLines) {
        if (!Utilities.isUsableAsObjectKey(summaryLinesName)) {
          context.log.error(`Unsupported token in suite name: ${summaryLinesName}`);
          continue;
        }

        if (featureSetsByName[summaryLinesName] === undefined) {
          featureSetsByName[summaryLinesName] = {};
        }

        if (sampleProjectInfoSets[summaryLinesName]) {
          const featureSets = featureSetsByName[summaryLinesName];
          const summaryLinesSet = summaryLines[summaryLinesName];

          const projectsCsvFile = outputStorage.rootFolder.ensureFile(summaryLinesName + "projects.csv");

          const projectsCsvHeaderContent = ProjectInfoSet.getSummaryCsvHeaderLine(
            sampleProjectInfoSets[summaryLinesName]!.info,
            featureSets
          );

          const allLines: string[] = [];
          allLines.push(projectsCsvHeaderContent);

          for (const projectsCsvContentLine of summaryLinesSet) {
            allLines.push(projectsCsvContentLine);
          }

          await (projectsCsvFile as NodeFile).writeContent(allLines);
        }
      }

      // Write content index
      if (indexFolder) {
        await DistributedContentIndex.saveContentIndexToFolder(megaContentIndex, indexFolder);
      }
    }

    context.log.info(`\n=== Aggregated Results for ${projectList.length} project(s) ===`);

    // Also print summary counts
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalInfo = 0;

    for (const meta of projectList) {
      if (meta.infoSetData?.items) {
        for (const item of meta.infoSetData.items) {
          if (item.iTp === InfoItemType.error || item.iTp === InfoItemType.testCompleteFail) {
            totalErrors++;
          } else if (item.iTp === InfoItemType.warning) {
            totalWarnings++;
          } else if (item.iTp === InfoItemType.info) {
            totalInfo++;
          }
        }
      }
    }

    context.log.info(`  Total errors:   ${totalErrors}`);
    context.log.info(`  Total warnings: ${totalWarnings}`);
    context.log.info(`  Total info:     ${totalInfo}`);
  }
}

// Export singleton instance
export const validateCommand = new ValidateCommand();

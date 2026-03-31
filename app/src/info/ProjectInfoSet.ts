// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/*
 * ==========================================================================================
 * PROJECTINFOSET - VALIDATION SYSTEM NOTES
 * ==========================================================================================
 *
 * OVERVIEW:
 * ---------
 * ProjectInfoSet is the central hub for project validation. It aggregates results from
 * multiple "info generators" that check different aspects of a project for errors,
 * warnings, recommendations, and informational items. It also coordinates "updaters"
 * that can automatically fix certain issues.
 *
 * VALIDATION ARCHITECTURE:
 * ------------------------
 *
 *   ProjectInfoSet
 *        │
 *        ├── IProjectInfoGenerator[] ─── Checks whole project (e.g., script versions)
 *        ├── IProjectItemInfoGenerator[] ─── Checks individual items (e.g., entity format)
 *        └── IProjectFileInfoGenerator[] ─── Checks specific files
 *
 *   Each generator produces ProjectInfoItem[] with:
 *   - itemType: error, warning, recommendation, info, testPass, testFail
 *   - generatorId: Which generator produced it (e.g., "SCRIPTMOD", "FORMATVER")
 *   - generatorIndex: Specific test within generator
 *   - message: Human-readable description
 *   - projectItem: Optional link to affected ProjectItem
 *   - data: Optional structured data for tooling
 *
 * See registered info generators in GeneratorRegistrations.ts.
 *
 * VALIDATION SUITES (ProjectInfoSuite):
 * -------------------------------------
 * Suites determine which generators run:
 * - defaultInDevelopment: Most generators except sharing-specific
 * - cooperativeAddOn: Marketplace add-on specific checks
 * - sharing: Checks for content to be shared
 * - sharingStrict: Sharing + additional strictness
 * - currentPlatformVersions: Version compatibility checks
 *
 * KEY METHODS:
 * ------------
 * - generateForProject(): Run all matching generators, populate items[]
 * - matchesSuite(): Check if generator applies to current suite
 * - getCountByType() / getSummaryByType(): Query results
 * - errorFailWarnCount: Quick error/warning count
 *
 * UPDATERS:
 * ---------
 * Some generators provide IProjectUpdater implementations:
 * - Can automatically fix issues (e.g., update script module versions)
 * - Accessed via generator.getUpdaters() method
 * - Applied via ProjectUpdateRunner, the implementation of which shadows ProjectInfoSet.
 *
 * AGGREGATION:
 * ------------
 * - info: IProjectInfo object with aggregated statistics
 * - itemsByStoragePath: Quick lookup by file path
 * - contentIndex: ContentIndex for text search across results
 *
 * GENERATOR OPTIONS:
 * ------------------
 * IGeneratorOptions controls generator behavior:
 * - performAggressiveCleanup: Release memory after processing (CLI mode)
 *   Set false when data needed later (e.g., world map rendering)
 *
 * RELATED FILES:
 * --------------
 * - IProjectInfoGenerator.ts: Generator interface
 * - ProjectInfoItem.ts: Individual validation result
 * - GeneratorRegistrations.ts: Generator registry
 * - ProjectUpdateRunner.ts: Applies updaters
 * - IInfoItemData.ts: Serialized info item format
 *
 * ==========================================================================================
 */

import ProjectItem from "../app/ProjectItem";
import Project, { ProjectErrorState } from "./../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import IProjectItemInfoGenerator from "./IProjectItemInfoGenerator";
import IProjectFileInfoGenerator from "./IProjectFileInfoGenerator";
import IProjectInfo from "./IProjectInfo";
import ProjectInfoItem from "./ProjectInfoItem";
import IFolder from "../storage/IFolder";
import IInfoItemData, { InfoItemType } from "./IInfoItemData";
import IProjectInfoGeneratorBase, { IProjectInfoTopicData } from "./IProjectInfoGeneratorBase";
import IProjectInfoData, { ProjectInfoSuite } from "./IProjectInfoData";
import { constants } from "../core/Constants";
import Utilities from "../core/Utilities";
import Log from "../core/Log";
import { StatusTopic } from "../app/Status";
import GeneratorRegistrations, { TestsToExcludeFromDefaultSuite } from "./registration/GeneratorRegistrations";
import StorageUtilities from "../storage/StorageUtilities";
import ContentIndex from "../core/ContentIndex";
import IProjectMetaState from "./IProjectMetaState";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import SummaryInfoGenerator from "./SummaryInfoGenerator";
import HashUtilities from "../core/HashUtilities";
import Database from "../minecraft/Database";
import telemetryService from "../analytics/Telemetry";
import { TelemetryEvents, TelemetryProperties } from "../analytics/TelemetryConstants";
import InfoGeneratorTopicUtilities from "./InfoGeneratorTopicUtilities";
import CrossReferenceIndexGenerator from "./CrossReferenceIndexGenerator";
import TypesInfoGenerator from "./TypesInfoGenerator";

const ItemBatchSize = 500;

/**
 * Controls how aggressively generators should constrain resource consumption.
 * Use this to balance between thoroughness and performance/memory usage.
 */
export enum ResourceConsumptionConstraint {
  /** No constraints - process all data regardless of resource usage */
  none = 0,
  /** Medium constraints - apply reasonable limits to prevent excessive resource usage */
  medium = 5,
}

/**
 * Options passed to info generators to control their behavior.
 */
export interface IGeneratorOptions {
  /**
   * When true, generators may perform aggressive memory cleanup operations
   * after processing (e.g., clearing LevelDB data, chunk caches).
   * This is appropriate for fire-and-forget contexts like CLI validation,
   * but should be false when the data may be needed by other components
   * (e.g., world map rendering in the browser).
   */
  performAggressiveCleanup?: boolean;

  /**
   * Controls how aggressively generators should limit resource consumption.
   * When set to .medium, generators may apply limits like MaxWorldRecordsToProcess
   * to prevent excessive memory or time usage on large datasets.
   * When set to .none, no such limits are applied.
   * Defaults to .medium if not specified.
   */
  constrainResourceConsumption?: ResourceConsumptionConstraint;

  /**
   * Optional callback for reporting progress during generation.
   * Generators can call this to provide granular progress updates,
   * especially for long-running operations like world data validation.
   * @param message - A descriptive message about the current operation
   * @param percentComplete - Optional percentage (0-100) of completion
   */
  onProgress?: (message: string, percentComplete?: number) => void;
}

export default class ProjectInfoSet {
  project?: Project;
  suite: ProjectInfoSuite;
  info: IProjectInfo;
  items: ProjectInfoItem[] = [];
  itemsByStoragePath: { [storagePath: string]: ProjectInfoItem[] | undefined } = {};
  contentIndex: ContentIndex;
  performAggressiveCleanup: boolean = false;
  constrainResourceConsumption: ResourceConsumptionConstraint = ResourceConsumptionConstraint.medium;

  static _generatorsById: { [name: string]: IProjectInfoGenerator } = {};
  _isGenerating: boolean = false;
  _completedGeneration: boolean = false;
  _excludeTests?: string[];
  private _pendingGenerateRequests: ((value: unknown) => void)[] = [];

  static CommonCsvHeader = "Test,TestId,Type,Item,Message,Data,Path";

  static getSuiteFromString(suiteName: string) {
    switch (suiteName.toLowerCase()) {
      case "addon":
      case "addons":
        return ProjectInfoSuite.cooperativeAddOn;

      case "sharing":
        return ProjectInfoSuite.sharing;

      case "sharingstrict":
        return ProjectInfoSuite.sharingStrict;

      case "currentplatform":
        return ProjectInfoSuite.currentPlatformVersions;

      default:
        return ProjectInfoSuite.defaultInDevelopment; // default is all infogenerators except cooperative add-on and sharing
    }
  }

  static getSuiteString(suite: ProjectInfoSuite) {
    switch (suite) {
      case ProjectInfoSuite.sharing:
        return "sharing";

      case ProjectInfoSuite.sharingStrict:
        return "sharingstrict";

      case ProjectInfoSuite.cooperativeAddOn:
        return "addon";

      case ProjectInfoSuite.currentPlatformVersions:
        return "currentplatform";

      default:
        return "all";
    }
  }

  get completedGeneration() {
    return this._completedGeneration;
  }

  /**
   * Mark generation as complete. Used when results are provided externally
   * (e.g., from a web worker).
   */
  async markGenerationCompleteAsync() {
    this._completedGeneration = true;
    this._isGenerating = false;

    // Build the itemsByStoragePath index from items array
    this._rebuildItemsByStoragePath();

    // Aggregate features from info items (needed for summary display)
    this.aggregateFeatures();

    // Build contentIndex from project files.
    // The web worker path doesn't populate the contentIndex (it only streams
    // validation items), so we must build it on the main thread.
    this._buildContentIndexFromProject();

    // Populate cross-reference and type annotations in the contentIndex.
    // These are normally populated by generators running in the worker,
    // but the worker's ContentIndex is not transferred back.
    await this._populateContentIndexAnnotationsAsync();
  }

  /**
   * Runs lightweight annotation-producing generators against the contentIndex.
   * This populates cross-reference annotations (geometry IDs, animation names,
   * entity/block/item types, etc.) that power autocomplete suggestions.
   *
   * Called after _buildContentIndexFromProject() in the web worker path,
   * since the worker's ContentIndex (with all annotations) is not transferred back.
   * The project files are already loaded in memory, so this runs quickly.
   */
  private async _populateContentIndexAnnotationsAsync() {
    if (!this.project || !this.contentIndex) {
      return;
    }

    // CrossReferenceIndexGenerator: geometry, animation, animation controller,
    // render controller, particle, fog, sound, loot table, recipe, biome,
    // spawn rule, dialogue, function, structure annotations
    const crossRefGen = new CrossReferenceIndexGenerator();
    await crossRefGen.generate(this.project, this.contentIndex);

    // TypesInfoGenerator: entity, block, item, feature type annotations
    const typesGen = new TypesInfoGenerator();
    await typesGen.generate(this.project, this.contentIndex);
    // Note: generate() returns info items which we discard here —
    // we already have the info items from the worker stream.
  }

  /**
   * Populates the contentIndex by scanning all project items and their files.
   * This is needed when the info set was generated via a web worker, which
   * doesn't build or transfer the content index.
   */
  private _buildContentIndexFromProject() {
    if (!this.project) {
      return;
    }

    const ci = new ContentIndex();
    ci.iteration = new Date().getTime();

    for (const projectItem of this.project.items) {
      if (!projectItem.projectPath) {
        continue;
      }

      const file = projectItem.defaultFile;

      if (file) {
        const fileName = file.name;

        ci.insert(StorageUtilities.getBaseFromName(fileName), projectItem.projectPath);
        ci.insert(file.storageRelativePath, projectItem.projectPath);

        if (file.content && typeof file.content === "string") {
          const fileExtension = StorageUtilities.getTypeFromName(fileName);

          switch (fileExtension) {
            case "json":
              ci.parseJsonContent(projectItem.projectPath, file.content);
              break;
            case "ts":
            case "js":
            case "mjs":
              ci.parseJsContent(projectItem.projectPath, file.content);
              break;
          }
        }
      }
    }

    this.contentIndex = ci;
  }

  /**
   * Rebuilds the itemsByStoragePath index from the items array.
   * This is needed when items are set externally (e.g., from a web worker).
   */
  private _rebuildItemsByStoragePath() {
    this.itemsByStoragePath = {};

    for (const item of this.items) {
      if (item.projectItem) {
        const path = item.projectItem.projectPath;
        if (path && typeof path === "string") {
          if (!this.itemsByStoragePath[path]) {
            this.itemsByStoragePath[path] = [];
          }
          this.itemsByStoragePath[path]?.push(item);
        }
      }
    }
  }

  get errorAndFailCount() {
    let count = 0;

    for (const item of this.items) {
      if (
        item.itemType === InfoItemType.error ||
        item.itemType === InfoItemType.internalProcessingError ||
        item.itemType === InfoItemType.testCompleteFail
      ) {
        count++;
      }
    }

    return count;
  }

  get errorFailWarnCount() {
    let count = 0;

    for (const item of this.items) {
      if (
        item.itemType === InfoItemType.error ||
        item.itemType === InfoItemType.warning ||
        item.itemType === InfoItemType.internalProcessingError ||
        item.itemType === InfoItemType.testCompleteFail
      ) {
        count++;
      }
    }

    return count;
  }

  get errorFailWarnString() {
    let str: string[] = [];

    for (const item of this.items) {
      if (
        item.itemType === InfoItemType.error ||
        item.itemType === InfoItemType.warning ||
        item.itemType === InfoItemType.internalProcessingError ||
        item.itemType === InfoItemType.testCompleteFail
      ) {
        str.push(item.toString());
      }
    }

    return str.join("\n");
  }

  constructor(
    project?: Project,
    suite?: ProjectInfoSuite,
    excludeTests?: string[],
    info?: IProjectInfo,
    items?: IInfoItemData[],
    index?: ContentIndex,
    performAggressiveCleanup?: boolean
  ) {
    this.project = project;
    this.info = info ? info : {};
    this.contentIndex = index ? index : new ContentIndex();
    this.performAggressiveCleanup = performAggressiveCleanup ?? false;

    if (items) {
      for (const item of items) {
        let projectItem = undefined;

        if (item.p) {
          if (project) {
            projectItem = project.getItemByProjectPath(item.p);
          }

          if (!this.itemsByStoragePath[item.p]) {
            this.itemsByStoragePath[item.p] = [];
          }

          let projectInfoItem = new ProjectInfoItem(
            item.iTp,
            item.gId,
            item.gIx,
            item.m,
            projectItem,
            item.d,
            item.iId,
            item.c,
            item.p
          );

          this.itemsByStoragePath[item.p]?.push(projectInfoItem);
          this.items.push(projectInfoItem);
        } else {
          this.items.push(
            new ProjectInfoItem(item.iTp, item.gId, item.gIx, item.m, projectItem, item.d, item.iId, item.c)
          );
        }
      }
    }

    if (suite) {
      this.suite = suite;
    } else {
      this.suite = ProjectInfoSuite.defaultInDevelopment;
    }

    if (index) {
      if (info) {
        for (const key in info) {
          const val = (info as any)[key];

          if (val && typeof val === "string") {
            if (ProjectInfoSet.isAggregableFieldName(key)) {
              index.parseTextContent("inspector", val);
            }
          }
        }
      }
    }

    if (excludeTests) {
      const excludeTestList = [];

      for (const excludeTest of excludeTests) {
        const vals = excludeTest.trim().split(",");

        for (const val of vals) {
          const valD = val.toUpperCase().trim();

          if (valD.length > 0) {
            excludeTestList.push(valD);
          }
        }
      }

      this._excludeTests = excludeTestList;
    }
  }

  static getTopicData(id: string, index: number): IProjectInfoTopicData | undefined {
    if (!Utilities.isUsableAsObjectKey(id)) {
      Log.unsupportedToken(id);
      throw new Error();
    }

    // First, try to get topic data from form.json file (synchronously if already loaded)
    const formTopicData = InfoGeneratorTopicUtilities.getTopicDataSync(id, index);
    if (formTopicData) {
      return formTopicData;
    }

    // Fall back to generator's getTopicData method if available
    const gen = ProjectInfoSet._generatorsById[id];

    if (gen && typeof (gen as IProjectInfoGeneratorBase).getTopicData === "function") {
      return (gen as IProjectInfoGeneratorBase).getTopicData!(index);
    }

    for (const gen of GeneratorRegistrations.projectGenerators) {
      if (gen.id === id) {
        this._generatorsById[id] = gen;

        if (typeof (gen as IProjectInfoGeneratorBase).getTopicData === "function") {
          return (gen as IProjectInfoGeneratorBase).getTopicData!(index);
        }
        return undefined;
      }
    }

    return undefined;
  }

  private static _getLineLocationFromIndex(content: string, index: number) {
    const lineNumber = content.substring(0, index).split("\n").length;
    const lastLineBreak = content.lastIndexOf("\n", index - 1);
    const column = index - (lastLineBreak + 1) + 1;
    return { lineNumber, column };
  }

  static async findLineLocationForItem(
    content: string,
    item: ProjectInfoItem
  ): Promise<{ lineNumber: number; column: number } | undefined> {
    if (!content) {
      return undefined;
    }

    const directMatch = (matchText: string | undefined) => {
      if (!matchText) {
        return undefined;
      }

      const index = content.indexOf(matchText);
      if (index >= 0) {
        return ProjectInfoSet._getLineLocationFromIndex(content, index);
      }

      return undefined;
    };

    const contentLocation = directMatch(item.content);
    if (contentLocation) {
      return contentLocation;
    }

    if (typeof item.data === "string") {
      const normalizedData = item.data.startsWith("Relevant line: ")
        ? item.data.substring("Relevant line: ".length)
        : item.data;
      const dataLocation = directMatch(normalizedData);
      if (dataLocation) {
        return dataLocation;
      }
    }

    if (item.generatorId) {
      try {
        const topicData = await InfoGeneratorTopicUtilities.getTopicData(item.generatorId, item.generatorIndex);
        if (topicData?.suggestedLineToken) {
          const token = topicData.suggestedLineToken;
          const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

          if (topicData.suggestedLineShouldHaveData && item.data) {
            const dataStr = String(item.data);
            const escapedData = dataStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const combinedPattern = new RegExp(
              `"${escapedToken}"[^\\n]*${escapedData}|${escapedData}[^\\n]*"${escapedToken}"`,
              "i"
            );
            const combinedMatch = content.match(combinedPattern);
            if (combinedMatch && combinedMatch.index !== undefined) {
              return ProjectInfoSet._getLineLocationFromIndex(content, combinedMatch.index);
            }
          }

          const tokenPattern = new RegExp(`"${escapedToken}"\\s*:\\s*[^,}\\]]+`, "i");
          const match = content.match(tokenPattern);
          if (match && match.index !== undefined) {
            return ProjectInfoSet._getLineLocationFromIndex(content, match.index);
          }

          const simpleIndex = content.indexOf(`"${token}"`);
          if (simpleIndex >= 0) {
            return ProjectInfoSet._getLineLocationFromIndex(content, simpleIndex);
          }
        }
      } catch {
        // Ignore errors loading topic data
      }
    }

    if (item.generatorId === "FORMATVER" || item.generatorId?.includes("FORMAT")) {
      const versionPattern = /"format_version"\s*:\s*"[^"]+"/i;
      const match = content.match(versionPattern);
      if (match && match.index !== undefined) {
        return ProjectInfoSet._getLineLocationFromIndex(content, match.index);
      }
    }

    if (item.generatorId === "ENTITYTYPE" || item.generatorId === "BLOCKTYPE" || item.generatorId === "ITEMTYPE") {
      const identifierPattern = /"identifier"\s*:\s*"[^"]+"/;
      const match = content.match(identifierPattern);
      if (match && match.index !== undefined) {
        return ProjectInfoSet._getLineLocationFromIndex(content, match.index);
      }
    }

    return undefined;
  }

  getCountByType(itemType: InfoItemType) {
    let count = 0;

    for (const item of this.items) {
      if (item.itemType === itemType) {
        count++;
      }
    }

    return count;
  }

  getSummaryByType(itemType: InfoItemType) {
    let str: string[] = [];

    for (const item of this.items) {
      if (str.length < 15 && item.itemType === itemType) {
        str.push(item.toString());
      }
    }

    return str.join("\n");
  }

  matchesSuite(
    generator: IProjectFileInfoGenerator | IProjectInfoGenerator | IProjectItemInfoGenerator | IProjectInfoGeneratorBase
  ) {
    if (
      this.suite === ProjectInfoSuite.defaultInDevelopment &&
      !TestsToExcludeFromDefaultSuite.includes(generator.id)
    ) {
      return true;
    }

    if (this.suite === ProjectInfoSuite.sharing || this.suite === ProjectInfoSuite.sharingStrict) {
      if (generator.id === "SHARING") {
        return true;
      }
    }

    if (this.suite === ProjectInfoSuite.sharingStrict) {
      if (generator.id === "LANGFILES" || generator.id === "VANDUPES") {
        return true;
      }
    }

    if (this.suite === ProjectInfoSuite.currentPlatformVersions) {
      if (
        generator.id === "MINENGINEVER" ||
        generator.id === "BASEGAMEVER" ||
        generator.id === "FORMATVER" ||
        generator.id === "WORLDDATA" ||
        generator.id === "CHKMANIF"
      ) {
        return true;
      }
    }

    if (this.suite === ProjectInfoSuite.cooperativeAddOn) {
      if (
        generator.id.indexOf("CADDON") >= 0 ||
        generator.id === "PACKSIZE" ||
        generator.id === "STRICT" ||
        generator.id === "TEXTURE" ||
        generator.id === "MINENGINEVER" ||
        generator.id === "WORLDDATA"
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate info items for the project.
   * @param force If true, regenerate even if already completed.
   * @param skipRelationsProcessing If true, skip the processRelations call (useful when relations
   *        have already been processed, e.g., in a combined worker operation).
   * @param onProgress Optional callback for progress updates (useful for worker thread communication).
   */
  async generateForProject(
    force?: boolean,
    skipRelationsProcessing?: boolean,
    onProgress?: (message: string, percentComplete?: number) => void
  ) {
    if (force === true && this._completedGeneration) {
      this._completedGeneration = false;
      this._isGenerating = false;
    }

    if (this._completedGeneration) {
      return;
    }

    if (!skipRelationsProcessing) {
      await this.project?.processRelations();
    }

    if (this._isGenerating) {
      const pendingGenerate = this._pendingGenerateRequests;

      const prom = (resolve: (value: unknown) => void, reject: (reason?: any) => void) => {
        pendingGenerate.push(resolve);
      };

      await new Promise(prom);
    } else {
      this._isGenerating = true;
      const generationStartTime = Date.now();

      if (!this.project) {
        Log.throwUnexpectedUndefined("PISGFP");
        return;
      }

      let baseValidationMessage = "Validating '" + this.project.simplifiedName + "'";

      const valOperId = await this.project?.creatorTools.notifyOperationStarted(
        baseValidationMessage + " (0%)",
        StatusTopic.validation
      );

      this.info.summary = undefined;

      const projGenerators: IProjectInfoGenerator[] = GeneratorRegistrations.projectGenerators;
      const itemGenerators: IProjectItemInfoGenerator[] = GeneratorRegistrations.itemGenerators;
      const fileGenerators: IProjectFileInfoGenerator[] = GeneratorRegistrations.fileGenerators;

      const genItems: ProjectInfoItem[] = [];
      const genItemsByStoragePath: { [storagePath: string]: ProjectInfoItem[] | undefined } = {};
      const genContentIndex = new ContentIndex();

      genContentIndex.iteration = new Date().getTime();

      await this.project.loc.load();
      await Database.loadVanillaCatalog();

      // Preload all topic forms for generators so sync lookups work
      const allGeneratorIds = [
        ...projGenerators.map((g) => g.id),
        ...itemGenerators.map((g) => g.id),
        ...fileGenerators.map((g) => g.id),
      ];
      await InfoGeneratorTopicUtilities.preloadAllForms(allGeneratorIds);

      if (this.project?.errorState === ProjectErrorState.cabinetFileCouldNotBeProcessed) {
        genItems.push(
          new ProjectInfoItem(
            InfoItemType.internalProcessingError,
            "PROJECTMETA",
            500,
            this.project.simplifiedName + ": " + this.project.errorMessage
          )
        );
      } else {
        const projectFolder = await this.project.ensureProjectFolder();

        const generatorTimings: { phase: string; id: string; durationMs: number }[] = [];

        const preProcessStart = Date.now();
        await this.preProcessFolder(
          this.project,
          projectFolder,
          genItems,
          genItemsByStoragePath,
          genContentIndex,
          fileGenerators,
          0
        );
        generatorTimings.push({
          phase: "preprocess",
          id: "preProcessFolder",
          durationMs: Date.now() - preProcessStart,
        });

        for (let i = 0; i < projGenerators.length; i++) {
          const gen = projGenerators[i];

          if ((!this._excludeTests || !this._excludeTests.includes(gen.id)) && gen && this.matchesSuite(gen)) {
            const projGenPercent = Math.floor(10 + (i / projGenerators.length) * 20); // 10-30%
            await this.project?.creatorTools.notifyOperationUpdate(
              valOperId,
              baseValidationMessage + " - " + gen.title + " (" + projGenPercent + "%)",
              StatusTopic.validation
            );

            // Send progress to worker callback if provided
            if (onProgress) {
              const percent = Math.floor(10 + (i / projGenerators.length) * 20); // 10-30%
              onProgress(`Validating: ${gen.title}`, percent);
            }

            GeneratorRegistrations.configureForSuite(gen, this.suite);

            try {
              const genStart = Date.now();
              const results = await gen.generate(this.project, genContentIndex);
              generatorTimings.push({ phase: "project", id: gen.id, durationMs: Date.now() - genStart });

              for (const item of results) {
                this.pushItem(genItems, genItemsByStoragePath, item);
              }
            } catch (e: any) {
              // V--- add a breakpoint to the line below to catch validator exceptions (1 of 3) ---V
              genItems.push(
                new ProjectInfoItem(
                  InfoItemType.internalProcessingError,
                  gen.id,
                  500,
                  this.project.simplifiedName + ": " + e.message + (e.stack ? " (" + e.stack + ")" : "")
                )
              );
              if (e && (!e.message || !e.message.indexOf || e.message.indexOf("etwork ") < 0)) {
                Log.debugAlert(e);
              } else {
                this.project?.creatorTools.notifyStatusUpdate(
                  "Could not connect to network to retrieve resources for validation. Details: " + e.toString()
                );
              }
            }
          }
        }

        const itemsCopy = this.project.getItemsCopy();
        const itemGenTimings: { [id: string]: number } = {};
        for (const gen of itemGenerators) {
          itemGenTimings[gen.id] = 0;
        }
        const itemLoopStart = Date.now();

        for (let i = 0; i < itemsCopy.length; i++) {
          const pi = itemsCopy[i];

          if (i % ItemBatchSize === ItemBatchSize - 1) {
            const itemPercent = Math.floor(30 + (i / itemsCopy.length) * 50); // 30-80%
            await this.project?.creatorTools.notifyOperationUpdate(
              valOperId,
              baseValidationMessage + " - items (" + itemPercent + "%)",
              StatusTopic.validation
            );

            // Send progress to worker callback if provided
            if (onProgress) {
              onProgress(`Validating items`, itemPercent);
            }
          }

          if (!pi.isContentLoaded) {
            await pi.loadContent();
          }

          for (let j = 0; j < itemGenerators.length; j++) {
            const gen = itemGenerators[j];

            if ((!this._excludeTests || !this._excludeTests.includes(gen.id)) && this.matchesSuite(gen)) {
              GeneratorRegistrations.configureForSuite(gen, this.suite);

              try {
                const itemGenStart = Date.now();
                const results = await gen.generate(pi, genContentIndex, {
                  performAggressiveCleanup: this.performAggressiveCleanup,
                  constrainResourceConsumption: this.constrainResourceConsumption,
                  onProgress: onProgress,
                });
                itemGenTimings[gen.id] += Date.now() - itemGenStart;

                for (const item of results) {
                  this.pushItem(genItems, genItemsByStoragePath, item);
                }
              } catch (e: any) {
                // V--- add a breakpoint to the line below to catch validator exceptions (2 of 3) ---V
                genItems.push(
                  new ProjectInfoItem(
                    InfoItemType.internalProcessingError,
                    gen.id,
                    501,
                    "IP2:" + this.project.simplifiedName + ": " + e.toString()
                  )
                );
              }
            }
          }
        }

        generatorTimings.push({ phase: "items-loop", id: "allItemGenerators", durationMs: Date.now() - itemLoopStart });
        for (const gen of itemGenerators) {
          if (itemGenTimings[gen.id] > 0) {
            generatorTimings.push({ phase: "item", id: gen.id, durationMs: itemGenTimings[gen.id] });
          }
        }

        const processFolderStart = Date.now();
        await this.processFolder(
          this.project,
          projectFolder,
          genItems,
          genItemsByStoragePath,
          genContentIndex,
          fileGenerators,
          0
        );
        generatorTimings.push({
          phase: "postprocess",
          id: "processFolder",
          durationMs: Date.now() - processFolderStart,
        });

        // Log timing breakdown
        generatorTimings.sort((a, b) => b.durationMs - a.durationMs);
        const totalValidationMs = Date.now() - generationStartTime;
        Log.verbose(`[Validation] Total validation time: ${totalValidationMs}ms`);
        Log.verbose(`[Validation] Top generators by time:`);
        for (const t of generatorTimings.slice(0, 20)) {
          Log.verbose(`[Validation]   ${t.phase.padEnd(12)} ${t.id.padEnd(45)} ${t.durationMs}ms`);
        }
      }

      await this.project?.creatorTools.notifyOperationUpdate(
        valOperId,
        baseValidationMessage + " - finishing (95%)",
        StatusTopic.validation
      );

      this.addTestSummations(genItems, genItemsByStoragePath, projGenerators, this._excludeTests);
      this.addTestSummations(genItems, genItemsByStoragePath, itemGenerators, this._excludeTests);
      this.addTestSummations(genItems, genItemsByStoragePath, fileGenerators, this._excludeTests);

      genItems.sort((a: ProjectInfoItem, b: ProjectInfoItem) => {
        if (a.generatorId !== b.generatorId) {
          return Utilities.staticCompare(a.generatorId, b.generatorId);
        }

        if (a.generatorIndex !== b.generatorIndex) {
          return a.generatorIndex - b.generatorIndex;
        }

        const aPath = a.projectItemPath;
        const bPath = b.projectItemPath;

        if (aPath !== bPath && aPath && bPath) {
          return Utilities.staticCompare(aPath, bPath);
        }

        if (aPath !== bPath && aPath) {
          return 1;
        }

        if (aPath !== bPath && bPath) {
          return -1;
        }

        if (a.message !== b.message && a.message && b.message) {
          return Utilities.staticCompare(a.message, b.message);
        }

        if (a.message !== b.message && a.message) {
          return 1;
        }

        if (a.message !== b.message && b.message) {
          return -1;
        }

        if (a.data !== b.data && a.data && b.data && typeof b.data === "string" && typeof a.data === "string") {
          return Utilities.staticCompare(a.data, b.data);
        }

        if (a.data !== b.data && a.data) {
          return 1;
        }

        if (a.data !== b.data && b.data) {
          return -1;
        }

        return 0;
      });

      this.items = genItems;

      this.itemsByStoragePath = genItemsByStoragePath;
      this.contentIndex = genContentIndex;

      this._completedGeneration = true;

      this.generateProjectMetaInfo();

      const pendingLoad = this._pendingGenerateRequests;
      this._pendingGenerateRequests = [];

      this.info.errorCount = this.getCountByType(InfoItemType.error);
      this.info.internalProcessingErrorCount = this.getCountByType(InfoItemType.internalProcessingError);
      this.info.warningCount = this.getCountByType(InfoItemType.warning);
      this.info.testSuccessCount = this.getCountByType(InfoItemType.testCompleteSuccess);
      this.info.testFailCount = this.getCountByType(InfoItemType.testCompleteFail);
      this.info.testNotApplicableCount = this.getCountByType(InfoItemType.testCompleteNoApplicableItemsFound);

      this.info.errorSummary = this.getSummaryByType(InfoItemType.error);
      this.info.internalProcessingErrorSummary = this.getSummaryByType(InfoItemType.internalProcessingError);
      this.info.warningSummary = this.getSummaryByType(InfoItemType.warning);
      this.info.testFailSummary = this.getSummaryByType(InfoItemType.testCompleteFail);

      const generationEndTime = Date.now();

      this.info.infoGenerationTime = generationEndTime - generationStartTime;

      if (this.project) {
        this.info.endToEndGenerationTime = generationEndTime - this.project.creationTime;
      }

      if (
        this.suite === ProjectInfoSuite.defaultInDevelopment ||
        this.suite === ProjectInfoSuite.sharing ||
        this.suite === ProjectInfoSuite.sharingStrict
      ) {
        this.info.reds = this.getRed();
      }

      this._isGenerating = false;

      if (valOperId !== undefined) {
        // End the operation - progress bar disappears immediately
        await this.project?.creatorTools.notifyOperationEnded(valOperId, "", StatusTopic.validation);
      }

      if (this.project) {
        const errorTypes: { [type: string]: number } = {};
        for (const item of genItems) {
          if (item.itemType === InfoItemType.internalProcessingError) {
            const errorType = item.generatorId || "unknown";
            errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
          }
        }

        const properties: { [key: string]: string | number } = {
          [TelemetryProperties.PROJECT_ITEM_COUNT]: this.project.items.length,
          [TelemetryProperties.INTERNAL_PROCESSING_ERROR_COUNT]: this.info.internalProcessingErrorCount || 0,
          [TelemetryProperties.SUITE_TYPE]: this.suite,
        };

        const errorTypeKeys = Object.keys(errorTypes);

        if (errorTypeKeys.length > 0) {
          properties[TelemetryProperties.ERROR_TYPES] = errorTypeKeys.join(",");
        }

        telemetryService.trackEvent({
          name: TelemetryEvents.VALIDATION_COMPLETED,
          properties,
        });
      }

      for (const prom of pendingLoad) {
        prom(undefined);
      }
    }
  }

  disconnectFromProject() {
    this.project = undefined;

    for (const pi of this.items) {
      pi.disconnect();
    }
  }

  addTestSummations(
    genItems: ProjectInfoItem[],
    genItemsByStoragePath: { [storagePath: string]: ProjectInfoItem[] | undefined },
    generators: IProjectInfoGeneratorBase[],
    excludeTests?: string[]
  ) {
    for (const gen of generators) {
      if ((!excludeTests || !excludeTests.includes(gen.id)) && this.matchesSuite(gen)) {
        const results = ProjectInfoSet.getItemsInCollection(genItems, gen.id);

        if (results.length === 0 && !gen.canAlwaysProcess) {
          this.pushItem(
            genItems,
            genItemsByStoragePath,
            new ProjectInfoItem(
              InfoItemType.testCompleteNoApplicableItemsFound,
              gen.id,
              2,
              `No applicable items found for test ${gen.title} (${gen.id})`
            )
          );
        } else {
          let errorCount = 0;
          let internalErrorCount = 0;
          let foundTestVerdict = false;

          for (const result of results) {
            if (
              result.itemType === InfoItemType.testCompleteFail ||
              result.itemType === InfoItemType.testCompleteSuccess ||
              result.itemType === InfoItemType.testCompleteNoApplicableItemsFound
            ) {
              foundTestVerdict = true;
            } else if (result.itemType === InfoItemType.error) {
              errorCount++;
            } else if (result.itemType === InfoItemType.internalProcessingError) {
              internalErrorCount++;
            }
          }

          if (!foundTestVerdict) {
            if (errorCount > 0 && internalErrorCount <= 0) {
              this.pushItem(
                genItems,
                genItemsByStoragePath,
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  gen.id,
                  0,
                  `Found ${errorCount} error${errorCount !== 1 ? "s" : ""} in ${gen.title} check`
                )
              );
            } else if (internalErrorCount > 0 && errorCount <= 0) {
              this.pushItem(
                genItems,
                genItemsByStoragePath,
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  gen.id,
                  0,
                  `Found ${internalErrorCount} internal error${internalErrorCount !== 1 ? "s" : ""} in ${gen.title} check. This may be a temporary issue with the test run.`
                )
              );
            } else if (errorCount + internalErrorCount > 0) {
              this.pushItem(
                genItems,
                genItemsByStoragePath,
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  gen.id,
                  0,
                  `Found ${errorCount} error${errorCount !== 1 ? "s" : ""} and ${internalErrorCount} internal error${internalErrorCount !== 1 ? "s" : ""} in ${gen.title} check`
                )
              );
            } else {
              this.pushItem(
                genItems,
                genItemsByStoragePath,
                new ProjectInfoItem(InfoItemType.testCompleteSuccess, gen.id, 1, `${gen.title} completed successfully`)
              );
            }
          }
        }
      }
    }
  }

  pushItem(
    itemSet: ProjectInfoItem[],
    itemsByStoragePath: { [storagePath: string]: ProjectInfoItem[] | undefined },
    item: ProjectInfoItem
  ) {
    if (
      item.projectItem &&
      item.projectItem.projectPath &&
      item.itemType !== InfoItemType.info &&
      item.itemType !== InfoItemType.featureAggregate
    ) {
      if (!itemsByStoragePath[item.projectItem.projectPath]) {
        itemsByStoragePath[item.projectItem.projectPath] = [];
      }

      itemsByStoragePath[item.projectItem.projectPath]?.push(item);
    }

    itemSet.push(item);
  }

  public mergeFeatureSetsAndFieldsTo(
    allFeatureSets: { [setName: string]: { [measureName: string]: number | undefined } | undefined },
    allFields: { [featureName: string]: boolean | undefined }
  ) {
    if (!this.info || !this.info.featureSets) {
      return;
    }

    for (const str in this.info) {
      if (str !== "features") {
        if (Utilities.isUsableAsObjectKey(str)) {
          allFields[str] = true;
        }
      }
    }

    for (const str in allFields) {
      let inf = this.info as any;

      if (ProjectInfoSet.isAggregableFieldName(str) && Utilities.isUsableAsObjectKey(str)) {
        if (inf[str] === undefined) {
          inf[str] = "";
        }
      }
    }

    for (const featureName in this.info.featureSets) {
      if (Utilities.isUsableAsObjectKey(featureName)) {
        const myFeature = this.info.featureSets[featureName];

        if (myFeature !== undefined) {
          let allFeature = allFeatureSets[featureName];

          if (allFeature === undefined) {
            allFeature = {};
            allFeatureSets[featureName] = allFeature;
          }

          for (const measureName in myFeature) {
            if (Utilities.isUsableAsObjectKey(measureName)) {
              const measureVal = myFeature[measureName];

              if (measureVal !== undefined) {
                let allMeasureVal = allFeature[measureName];

                if (allMeasureVal === undefined) {
                  allMeasureVal = measureVal;
                } else {
                  allMeasureVal += measureVal;
                }

                allFeature[measureName] = allMeasureVal;
              }
            }
          }
        }
      }
    }
  }

  ensureGenerators() {
    if (!this.info) {
      return;
    }

    if (this.info.summary !== undefined) {
      return;
    }

    this.info.summary = {};

    for (let i = 0; i < this.items.length; i++) {
      const gId = this.items[i].generatorId;
      const gIndex = this.items[i].generatorIndex;

      let gen = this.info.summary[gId];

      if (gen === undefined) {
        gen = {};

        this.info.summary[gId] = gen;
      }

      let genI = gen[gIndex];

      if (genI === undefined) {
        genI = {};

        gen[gIndex] = genI;
      }

      const topicInfo = ProjectInfoSet.getTopicData(gId, gIndex);

      if (topicInfo) {
        genI.title = topicInfo.title;
      }

      if (genI.defaultMessage === undefined && this.items[i].message !== genI.title) {
        genI.defaultMessage = this.items[i].message;
      }
    }

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const gId = item.generatorId;
      const gIndex = item.generatorIndex;

      let gen = this.info.summary[gId];

      if (gen === undefined) {
        gen = {};

        this.info.summary[gId] = gen;
      }

      let genI = gen[gIndex];

      if (genI === undefined) {
        genI = {};

        gen[gIndex] = genI;
      }

      if (item.itemType !== InfoItemType.featureAggregate) {
        switch (item.itemType) {
          case InfoItemType.error:
            genI.errors = genI.errors ? genI.errors + 1 : 1;
            break;
          case InfoItemType.testCompleteFail:
            genI.testCompleteFails = genI.testCompleteFails ? genI.testCompleteFails + 1 : 1;
            break;
          case InfoItemType.testCompleteSuccess:
            genI.testCompleteSuccesses = genI.testCompleteSuccesses ? genI.testCompleteSuccesses + 1 : 1;
            break;
          case InfoItemType.warning:
            genI.warnings = genI.warnings ? genI.warnings + 1 : 1;
            break;
          case InfoItemType.recommendation:
            genI.recommendations = genI.recommendations ? genI.recommendations + 1 : 1;
            break;
          case InfoItemType.internalProcessingError:
            genI.internalProcessingErrors = genI.internalProcessingErrors ? genI.internalProcessingErrors + 1 : 1;
            break;
        }
      }

      if (this.items[i].message === genI.defaultMessage || this.items[i].message === genI.title) {
        this.items[i].message = undefined;
      }
    }
  }

  itemToString(item: ProjectInfoItem) {
    let summaryString = item.typeSummaryShort + ": ";

    summaryString += "[" + item.generatorId + Utilities.frontPadToLength(item.generatorIndex, 3, "0") + "]";

    if (item.shortProjectItemPath) {
      summaryString += " (" + item.shortProjectItemPath + ")";
    }

    let effectiveMessage = this.getEffectiveMessage(item);

    if (effectiveMessage.length > 0) {
      summaryString += " " + effectiveMessage;
    }

    if (item.data) {
      summaryString += ": " + item.data;
    }

    const errorContent = item.contentSummary;

    if (errorContent) {
      summaryString += " [in " + errorContent + "]";
    }

    return summaryString;
  }

  static getExtendedMessageFromData(data: IProjectInfoData, item: IInfoItemData) {
    return (
      this.getEffectiveMessageFromData(data, item) + (item.d ? ": " + item.d : "") + (item.p ? " - " + item.p : "")
    );
  }

  static getEffectiveMessageFromData(data: IProjectInfoData, item: IInfoItemData) {
    if (item.m !== undefined) {
      return item.m;
    }

    if (data.info === undefined || data.info.summary === undefined) {
      return undefined;
    }

    let gen = data.info.summary[item.gId];

    if (gen === undefined) {
      return undefined;
    }

    let genI = gen[item.gIx];

    if (genI === undefined) {
      return undefined;
    }

    return genI.defaultMessage;
  }

  getEffectiveMessage(item: ProjectInfoItem) {
    if (item.message !== undefined) {
      return item.message;
    }

    if (this.info === undefined || this.info.summary === undefined) {
      return "";
    }

    let gen = this.info.summary[item.generatorId];

    if (gen === undefined) {
      return "";
    }

    let genI = gen[item.generatorIndex];

    if (genI === undefined) {
      return "";
    }

    return genI.defaultMessage ? genI.defaultMessage : "";
  }

  shouldIncludeInIndex(data: IInfoItemData) {
    if (data.gId === "JSON" || data.gId === "ESLINT") {
      return false;
    }

    return true;
  }

  getDataObject(
    sourceName?: string,
    sourcePath?: string,
    sourceHash?: string,
    isIndexOnly?: boolean,
    subsetReports?: IProjectMetaState[]
  ): IProjectInfoData {
    const items: IInfoItemData[] = [];

    this.ensureGenerators();

    for (let i = 0; i < this.items.length; i++) {
      const dataObj = this.items[i].dataObject;

      if (!isIndexOnly || this.shouldIncludeInIndex(dataObj)) {
        items.push(dataObj);
      }
    }

    Utilities.encodeObjectWithSequentialRunLengthEncodeUsingNegative(this.contentIndex.data.trie);

    return {
      info: this.info,
      items: items,
      index: this.contentIndex.data,
      generatorName: constants.name,
      suite: this.suite,
      subsetReports: subsetReports,
      generatorVersion: constants.version,
      sourceName: sourceName,
      sourcePath: sourcePath,
      sourceHash: sourceHash,
    };
  }

  static isAggregableFieldName(name: string) {
    if (name !== "features" && name !== "summary" && name !== "featureSets" && name !== "defaultIcon") {
      return true;
    }

    return false;
  }

  static isAggregableFeatureMeasureName(name: string) {
    if (!name.startsWith("#")) {
      return true;
    }

    return false;
  }

  static getSummaryCsvHeaderLine(
    projectInfo: IProjectInfo,
    allFeatures: { [setName: string]: { [measureName: string]: number | undefined } | undefined }
  ): string {
    let csvLine = "Name,Title,Area,";

    let fieldNames = [];

    for (const str in projectInfo) {
      if (ProjectInfoSet.isAggregableFieldName(str)) {
        fieldNames.push(str);
      }
    }

    fieldNames = fieldNames.sort(ProjectInfoSet.sortMinecraftFeatures);

    for (const str of fieldNames) {
      csvLine += Utilities.humanifyJsName(str) + ",";
    }

    for (const str in projectInfo) {
      if (ProjectInfoSet.isAggregableFieldName(str)) {
        fieldNames.push(str);
      }
    }

    for (const featureName in allFeatures) {
      const feature = allFeatures[featureName];

      if (feature) {
        for (const measureName in feature) {
          if (ProjectInfoSet.isAggregableFeatureMeasureName(measureName)) {
            const measure = feature[measureName];

            if (measure !== undefined) {
              csvLine += ProjectInfoSet.getDataSummary(featureName + " " + measureName) + ",";
            }
          }
        }
      }
    }

    return csvLine;
  }

  getIndexJson(sourceName?: string, sourcePath?: string, sourceHash?: string) {
    return JSON.stringify(this.getDataObject(sourceName, sourcePath, sourceHash, true));
  }

  getStrictIndexJson(sourceName?: string, sourcePath?: string, sourceHash?: string) {
    const jsonO = this.getDataObject(sourceName, sourcePath, sourceHash, true);

    if (jsonO) {
      jsonO.info = undefined;
      jsonO.items = undefined;
    }

    return JSON.stringify(jsonO);
  }

  getReportHtml(sourceName?: string, sourcePath?: string, sourceHash?: string): string {
    const lines = [];

    lines.push("<html><head>");
    lines.push("<script>");
    lines.push(`const _reportObjects = [];

function _addReportJson(data) {
  _reportObjects.push(data);
}
`);
    const dataObject = this.getDataObject(sourceName, sourcePath, sourceHash);

    dataObject.index = undefined;
    lines.push("_addReportJson(" + JSON.stringify(dataObject) + ");");
    lines.push("</script><script>");
    lines.push(`
    function getDataName(name) {
      if (typeof name === "boolean" || typeof name === "number") {
        return name.toString();
      }
    
      let retVal = "";
    
      for (let i = 0; i < name.length; i++) {
        if (i === 0) {
          retVal += name[i].toUpperCase();
        } else {
          if (name[i] >= "A" && name[i] <= "Z") {
            retVal += " ";
          }
          retVal += name[i];
        }
      }
      return retVal;
    }
    
    function getDataSummary(data) {
      if (data) {
        return data;
      }
      
      if (typeof data === "number" || typeof data === "boolean") {
        return data.toString();
      }
      
      if (typeof data === "object") {
        return JSON.stringify(data);
      }
    
      return "(not defined)";
    }  
    
    function getEmptySummary(data) {
    
      if (typeof data === "object") {
        return JSON.stringify(data);
      }
      
      if (typeof data === "number" || typeof data === "boolean") {
        return data.toString();
      }
    
      if (data) {
        return data;
      }
      
      return "";
    }  

    function getEffectiveMessage(reportObj, item) {
      if (item.m !== undefined) {
        return item.m;
      }

      if (reportObj.info === undefined || reportObj.info.summary === undefined) {
        return undefined;
      }

      let gen = reportObj.info.summary[item.gId];

      if (gen === undefined) {
        return undefined;
      }

      let genI = gen[item.gIx];
 
      if (genI === undefined) {
        return undefined;
      }

      return genI.defaultMessage;
    }	    
    
    function generateReports() {
      for (let i=0; i<_reportObjects.length; i++) {
        document.write("<h1>" + _reportObjects[i].sourceName + "</h1>");
        document.write("<h3>Summary</h3>");
    
        document.write("<table class='summary-table'>");
        document.write("<tr><th>Measure</th><th>Value</th></tr>");
        const info = _reportObjects[i].info;
    
        if (info) {
          for (const key in info) {
            const val = info[key];
    
            if (key !== 'featureSets' && key !== 'defaultIcon' && key !== 'summary') {
              document.write("<tr>");
              document.write("<td class='summary-key items-cell'>" + getDataName(key) + "</td>");
              document.write("<td class='summary-value items-cell'>" + getDataSummary(val) + "</td>");
              document.write("</tr>");
            }
          }
    
          if (info["featureSets"]) {
            for (const featureName in info.featureSets) {
              const feature = info.featureSets[featureName];
    
              for (const measureName in feature) {
                const val = feature[measureName];

                 document.write("<tr>");
                document.write("<td class='summary-key items-cell'>" + featureName + " " + measureName + "</td>");
                document.write("<td class='summary-value items-cell'>" + getDataSummary(val) + "</td>");
                document.write("</tr>");
              }
            }
          }
        }
        document.write("</table>");
      }
    
      for (let i=0; i<_reportObjects.length; i++) {
        document.write("<h3>Items</h3>");
        document.write("<table class='items-table'>");
        document.write("<tr><th>Type</th><th>Test Category</th><th>Category Id</th><th>Message</th><th>Data</th><th>Path</th></tr>");
        const info = _reportObjects[i].info;
        
        const items = _reportObjects[i].items;
    
        if (items && items.length) {
          for (const item of items) {
            if (item.itemType !== 2) {
              document.write("<tr>");
              document.write("<td class='items-type items-cell'>" + getDescriptionForItemType(item.iTp) + "</td>");
              document.write("<td class='items-generator items-cell'>" + item.gId + "</td>");
              document.write("<td class='items-generatorIndex items-cell'>" + item.gIx + "</td>");
              document.write("<td class='items-message items-cell'>" + getEmptySummary(getEffectiveMessage(_reportObjects[i], item)) + "</td>");
              document.write("<td class='items-data items-cell'>" + getEmptySummary(item.d) + "</td>");
              document.write("<td class='items-path items-cell'>" + getEmptySummary(item.p) + "</td>");
              document.write("</tr>");
            }
          }
        }
        document.write("</table>");
      }
    } 

    function getDescriptionForItemType(itemType) {
      switch (itemType) {
        case 0: 
          return "SUCCESS";
          break;
        case 1: 
          return "FAIL";
          break;
        case 3: 
          return "ERROR";
          break;
        case 4: 
          return "WARN";
          break;
        case 5: 
          return "INTERNALERR";
          break;
        case 6: 
          return "RECOMMEND";
          break;          
      }
      return "INFO";
    }

    </script>
    <style>
      body {
        font-family: Noto Sans, Arial, Helvetica, sans-serif;
        padding: 8px;
      }
    
      .items-table {
        border: solid 1px #606060;
        padding: 0px;
        max-width: 100vw;
      }
    
      .items-cell {
        border: solid 1px #606060;
        padding: 4px;
        vertical-align: top;
        font-size: x-small;
        overflow-wrap: anywhere;
        max-width: 25vw;
      }
    
      .summary-table {
        border: solid 1px #606060;
        padding: 0px;
        max-width: 100vw;
      }
    </style>
    </head><body> 
`);
    lines.push("<script>");
    lines.push("generateReports();");
    lines.push("</script>");
    lines.push("</body></html>");

    return lines.join("\n");
  }

  static getDataSummary(data: any | undefined) {
    if (typeof data === "number" || typeof data === "boolean") {
      return data.toString();
    }
    if (Array.isArray(data)) {
      const repData = data.slice();

      for (let i = 0; i < repData.length; i++) {
        repData[i] =
          "'" +
          repData[i]
            .toString()
            .replace(/'/gi, "")
            .replace(/[\r\n]+/g, " ") +
          "'";
      }
      let arrStr = repData.join(", ");

      arrStr = arrStr.replace(/"/gi, "'");

      return '"[' + arrStr + ']"';
    } else if (data) {
      return '"' + ProjectInfoSet.csvSanitize(data) + '"';
    }

    return "(not defined)";
  }

  /**
   * Sanitizes a string value for safe inclusion inside a quoted CSV field.
   * Replaces double quotes with single quotes, and strips newlines/carriage returns
   * so that the value doesn't create phantom rows in the CSV output.
   */
  static csvSanitize(value: string): string {
    return value.replace(/"/gi, "'").replace(/[\r\n]+/g, " ");
  }

  static sortMinecraftFeatures(a: string, b: string) {
    a = a.replace("minecraft:", "_");
    b = b.replace("minecraft:", "_");

    return Utilities.staticCompare(a, b);
  }

  getArea(title: string) {
    title = title.toLowerCase();

    if (title.indexOf("furniture") >= 0) {
      return "Furniture";
    }

    if (title.indexOf("skyblock") >= 0 || title.indexOf("sky block") >= 0) {
      return "Skyblock";
    }

    if (title.indexOf("oneblock") >= 0 || title.indexOf("one block") >= 0) {
      return "One block";
    }

    if (title.indexOf("lucky") >= 0) {
      return "Lucky";
    }

    if (title.indexOf("parkour") >= 0) {
      return "Parkour";
    }

    if (title.indexOf("surviv") >= 0) {
      return "Survival";
    }

    if (
      title.indexOf("weapon") >= 0 ||
      title.indexOf("potion") >= 0 ||
      title.indexOf("tool") >= 0 ||
      title.indexOf("hook") >= 0
    ) {
      return "Tools";
    }

    if (
      title.indexOf("roleplay") >= 0 ||
      title.indexOf("teen") >= 0 ||
      title.indexOf("illionair") >= 0 ||
      title.indexOf("hacker") >= 0
    ) {
      return "Roleplay";
    }

    if (
      title.indexOf("mob") >= 0 ||
      title.indexOf("pirate") >= 0 ||
      title.indexOf("unicorn") >= 0 ||
      title.indexOf("alien") >= 0 ||
      title.indexOf("animals") >= 0 ||
      title.indexOf("cats") >= 0 ||
      title.indexOf("dogs") >= 0 ||
      title.indexOf("dragon") >= 0
    ) {
      return "Mob";
    }

    if (title.indexOf("vehicles") >= 0 || title.indexOf("car") >= 0 || title.indexOf("plane") >= 0) {
      return "Vehicles";
    }

    if (
      title.indexOf("island") >= 0 ||
      title.indexOf("kingdom") >= 0 ||
      title.indexOf("tower") >= 0 ||
      title.indexOf("mansion") >= 0 ||
      title.indexOf("village") >= 0 ||
      title.indexOf("resort") >= 0 ||
      title.indexOf("castle") >= 0 ||
      title.indexOf("base") >= 0 ||
      title.indexOf("town") >= 0 ||
      title.indexOf("city") >= 0 ||
      title.indexOf("fortress") >= 0 ||
      title.indexOf("citadel") >= 0 ||
      title.indexOf("outpost") >= 0 ||
      title.indexOf("farm") >= 0 ||
      title.indexOf("hotel") >= 0 ||
      title.indexOf("castle") >= 0
    ) {
      return "Area";
    }

    if (title.indexOf("simulat") >= 0) {
      return "Simulator";
    }

    return "General";
  }

  getRed() {
    let red = 0;

    if (!this.info || !this.info.featureSets) {
      return 0;
    }

    let val = this.info.featureSets["animation.size"]?.total;

    if (val === undefined || val === null) {
      val = 0;
    }

    if (val) {
      red += val * 0.2;
    }

    val = this.info.featureSets["animationController.size"]?.total;
    if (val) {
      red += val * 0.5;
    }

    val = this.info.featureSets["attachable.size"]?.total;
    if (val) {
      red += val * 0.1;
    }

    val = this.info.featureSets["function.size"]?.total;
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["tick.size"]?.total;
    if (val) {
      red += val * 20;
    }

    val = this.info.featureSets["command.execute"]?.count;
    if (val) {
      red += val * 4;
    }

    val = this.info.featureSets["behaviorPackAnimation.size"]?.total;
    if (val) {
      red += val * 0.8;
    }

    val = this.info.featureSets["behaviorPackAnimationController.size"]?.total;
    if (val) {
      red += val * 1.2;
    }

    val = this.info.featureSets["biome.size"]?.total;
    if (val) {
      red += val * 1.2;
    }

    val = this.info.featureSets["blocks.minecraftChainCommandBlock"]?.count;
    if (val) {
      red += val * 8;
    }

    val = this.info.featureSets["blocks.minecraftCommandBlock"]?.count;
    if (val) {
      red += val * 8;
    }

    val = this.info.featureSets["blocks.minecraftRepeatingCommandBlock"]?.count;
    if (val) {
      red += val * 8;
    }

    val = this.info.featureSets["blocks.minecraftStructureBlock"]?.count;
    if (val) {
      red += val * 8;
    }

    val = this.info.featureSets["blocks.minecraftObserver"]?.count;
    if (val) {
      red += val * 4;
    }

    val = this.info.featureSets["blocks.minecraftComparator"]?.count;
    if (val) {
      red += val * 4;
    }

    val = this.info.featureSets["blocks.minecraftDropper"]?.count;
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["blocks.minecraftHopper"]?.count;
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["blocks.minecraftPressurePlate"]?.count;
    if (val) {
      red += val * 1;
    }

    val = this.info.featureSets["blocks.minecraftLever"]?.count;
    if (val) {
      red += val * 4;
    }

    val = this.info.featureSets["blocks.minecraftLitRedstoneLamp"]?.count;
    if (val) {
      red += val;
    }

    val = this.info.featureSets["blocks.minecraftRedstoneBlock"]?.count;
    if (val) {
      red += val;
    }

    val = this.info.featureSets["blocks.minecraftRedstoneTorch"]?.count;
    if (val) {
      red += val;
    }

    val = this.info.featureSets["blocks.minecraftRedstoneWire"]?.count;
    if (val) {
      red += val;
    }

    val = this.info.featureSets["entityDialogue.size"]?.total;
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["entityType.size"]?.total;
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["entityTypeResources.size"]?.total;
    if (val) {
      red += val * 1;
    }

    val = this.info.featureSets["itemType.size"]?.total;
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["itemTypeResources.size"]?.total;
    if (val) {
      red += val * 1;
    }

    val = this.info.featureSets["javaScript.size"]?.total;
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["lootTable.size"]?.total;
    if (val) {
      red += val;
    }

    val = this.info.featureSets["model.size"]?.total;
    if (val) {
      red += val * 0.1;
    }

    val = this.info.featureSets["particle.size"]?.total;
    if (val) {
      red += val * 0.4;
    }

    val = this.info.featureSets["recipe.size"]?.total;
    if (val) {
      red += val * 0.4;
    }

    val = this.info.featureSets["renderController.size"]?.total;
    if (val) {
      red += val * 0.5;
    }

    val = this.info.featureSets["spawnRule.size"]?.total;
    if (val) {
      red += val * 1;
    }

    val = this.info.featureSets["trading.size"]?.total;
    if (val) {
      red += val * 1;
    }

    val = this.info.featureSets["userInterface.size"]?.total;
    if (val) {
      red += val * 2;
    }

    return Math.round(red);
  }

  getSummaryCsvLine(
    containerName: string,
    title: string,
    allFeatures: { [setName: string]: { [measureName: string]: number | undefined } | undefined } | undefined
  ): string {
    let line =
      ProjectInfoSet.getDataSummary(containerName) +
      "," +
      ProjectInfoSet.getDataSummary(title) +
      "," +
      this.getArea(title) +
      ",";

    let fieldNames = [];

    for (const str in this.info) {
      if (ProjectInfoSet.isAggregableFieldName(str)) {
        fieldNames.push(str);
      }
    }

    fieldNames = fieldNames.sort(ProjectInfoSet.sortMinecraftFeatures);

    for (const str of fieldNames) {
      // @ts-ignore
      line += ProjectInfoSet.getDataSummary(this.info[str]) + ",";
    }

    if (this.info.featureSets) {
      for (const featureName in allFeatures) {
        const allFeature = allFeatures[featureName];
        const thisFeature = this.info.featureSets[featureName];

        if (allFeature) {
          for (const measureName in allFeature) {
            if (ProjectInfoSet.isAggregableFeatureMeasureName(measureName)) {
              if (thisFeature) {
                const measure = thisFeature[measureName];

                if (measure !== undefined) {
                  if (typeof measure === "number") {
                    line += measure;
                  }
                }
              }
              line += ",";
            }
          }
        }
      }
    }

    return line;
  }

  getItemCsvLines(): string[] {
    const lines: string[] = [];

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];

      if (item.itemType !== InfoItemType.featureAggregate) {
        let sp = "";

        if (item.projectItem && item.projectItem.projectPath) {
          sp = item.projectItem.projectPath;
        } else if (item.projectItemPath) {
          sp = item.projectItemPath;
        }

        let line =
          item.generatorId +
          "," +
          item.generatorIndex +
          "," +
          '"' +
          ProjectInfoSet.csvSanitize(item.typeSummary || "") +
          '"' +
          "," +
          '"' +
          ProjectInfoSet.csvSanitize(item.projectItem ? item.projectItem.name : "") +
          '"' +
          ',"' +
          ProjectInfoSet.csvSanitize(this.getEffectiveMessage(item)) +
          '",';

        if (item.data) {
          if (typeof item.data === "string") {
            line += '"' + ProjectInfoSet.csvSanitize(item.data) + '"';
          } else {
            line += item.data.toString();
          }
        }

        line += ',"' + ProjectInfoSet.csvSanitize(sp) + '",';

        if (item.featureSets) {
          for (const featName in item.featureSets) {
            const feature = item.featureSets[featName];

            if (feature) {
              for (const measureName in feature) {
                if (ProjectInfoSet.isAggregableFeatureMeasureName(measureName)) {
                  const measure = feature[measureName];

                  if (measure !== undefined) {
                    if (typeof measure === "number") {
                      line += featName + " " + measureName + "," + measure + ",";
                    } else if (typeof measure === "string") {
                      line += featName + " " + measureName + ',"' + ProjectInfoSet.csvSanitize(measure) + '",';
                    }
                  }
                }
              }
            }
          }
        }

        lines.push(line);
      }
    }

    return lines;
  }

  getItems(generatorId: string, itemIndex: number) {
    const resultItems: ProjectInfoItem[] = [];

    for (const genItem of this.items) {
      if (genItem.generatorId === generatorId && genItem.generatorIndex === itemIndex) {
        resultItems.push(genItem);
      }
    }

    return resultItems;
  }

  getItemsByType(generatorId: string, itemType: InfoItemType) {
    return ProjectInfoSet.getItemsInCollectionByType(this.items, generatorId, itemType);
  }

  getItemsByStoragePath(path: string) {
    if (!this.itemsByStoragePath) {
      return;
    }

    return this.itemsByStoragePath[path];
  }

  static getItemsInCollection(genItems: ProjectInfoItem[], generatorId: string) {
    const resultItems: ProjectInfoItem[] = [];

    for (const genItem of genItems) {
      if (genItem.generatorId === generatorId) {
        resultItems.push(genItem);
      }
    }

    return resultItems;
  }

  static getItemsInCollectionByType(genItems: ProjectInfoItem[], generatorId: string, itemType: InfoItemType) {
    const resultItems: ProjectInfoItem[] = [];

    for (const genItem of genItems) {
      if (genItem.generatorId === generatorId && genItem.itemType === itemType) {
        resultItems.push(genItem);
      }
    }

    return resultItems;
  }

  async preProcessFolder(
    project: Project,
    folder: IFolder,
    genItems: ProjectInfoItem[],
    genItemsByStoragePath: { [storagePath: string]: ProjectInfoItem[] | undefined },
    genContentIndex: ContentIndex,
    fileGenerators: IProjectFileInfoGenerator[],
    depth: number
  ) {
    if (!folder.isLoaded) {
      await folder.load();
    }

    for (const fileName in folder.files) {
      const file = folder.files[fileName];

      if (file) {
        if (!file.isContentLoaded) {
          await file.loadContent();
        }

        if (file.content !== null) {
          if (StorageUtilities.isContainerFile(file.storageRelativePath)) {
            const zipFolder = await StorageUtilities.getFileStorageFolder(file);

            if (zipFolder && typeof zipFolder !== "string") {
              await this.preProcessFolder(
                project,
                zipFolder,
                genItems,
                genItemsByStoragePath,
                genContentIndex,
                fileGenerators,
                depth + 1
              );
            }
          }

          const projectItem = project.getItemByFile(file);

          if (projectItem && projectItem.projectPath) {
            await HashUtilities.addHashesForFile(genContentIndex.hashCatalog, file, projectItem.projectPath);
          }
        }
      }
    }

    if (depth < 15) {
      for (const folderName in folder.folders) {
        const childFolder = folder.folders[folderName];

        if (childFolder && !childFolder.errorStatus && childFolder.name) {
          if (ProjectInfoSet.isFolderThatShouldBeProcessed(childFolder)) {
            await this.preProcessFolder(
              project,
              childFolder,
              genItems,
              genItemsByStoragePath,
              genContentIndex,
              fileGenerators,
              depth + 1
            );
          }
        }
      }
    }
  }

  async processFolder(
    project: Project,
    folder: IFolder,
    genItems: ProjectInfoItem[],
    genItemsByStoragePath: { [storagePath: string]: ProjectInfoItem[] | undefined },
    genContentIndex: ContentIndex,
    fileGenerators: IProjectFileInfoGenerator[],
    depth: number
  ) {
    if (!folder.isLoaded) {
      await folder.load();
    }

    for (const fileName in folder.files) {
      const file = folder.files[fileName];

      if (file) {
        if (!file.isContentLoaded) {
          await file.loadContent();
        }

        if (file.content !== null) {
          const projectItem = project.getItemByFile(file);

          if (projectItem && projectItem.projectPath) {
            genContentIndex.insert(StorageUtilities.getBaseFromName(fileName), projectItem.projectPath);
            genContentIndex.insert(file.storageRelativePath, projectItem.projectPath);

            if (file.content && typeof file.content === "string") {
              const fileExtension = StorageUtilities.getTypeFromName(fileName);

              if (projectItem && projectItem.projectPath) {
                switch (fileExtension) {
                  case "json":
                    // Try to use already-parsed JSON object for faster indexing
                    // instead of character-by-character text tokenization
                    const jsonObj = StorageUtilities.getJsonObject(file);
                    if (jsonObj) {
                      genContentIndex.indexJsonObject(projectItem.projectPath, jsonObj);
                    } else {
                      genContentIndex.parseJsonContent(projectItem.projectPath, file.content);
                    }
                    break;
                  case "ts":
                  case "js":
                  case "mjs":
                    genContentIndex.parseJsContent(projectItem.projectPath, file.content);
                    break;
                }
              }
            }

            for (const fileGen of fileGenerators) {
              if (this.matchesSuite(fileGen)) {
                try {
                  const results = await fileGen.generate(project, file, genContentIndex);

                  for (const item of results) {
                    this.pushItem(genItems, genItemsByStoragePath, item);
                  }
                } catch (e: any) {
                  // V--- add a breakpoint to the line below to catch validator exceptions (3 of 3) ---V
                  genItems.push(
                    new ProjectInfoItem(
                      InfoItemType.internalProcessingError,
                      fileGen.id,
                      502,
                      file.fullPath + ": " + e.toString()
                    )
                  );
                }
              }
            }
            if (StorageUtilities.isContainerFile(file.storageRelativePath)) {
              const zipFolder = await StorageUtilities.getFileStorageFolder(file);

              if (zipFolder && typeof zipFolder !== "string") {
                await this.processFolder(
                  project,
                  zipFolder,
                  genItems,
                  genItemsByStoragePath,
                  genContentIndex,
                  fileGenerators,
                  depth + 1
                );
              }
            }
          }
        }
      }
    }

    if (depth < 15) {
      for (const folderName in folder.folders) {
        const childFolder = folder.folders[folderName];

        if (childFolder && !childFolder.errorStatus && childFolder.name) {
          if (ProjectInfoSet.isFolderThatShouldBeProcessed(childFolder)) {
            await this.processFolder(
              project,
              childFolder,
              genItems,
              genItemsByStoragePath,
              genContentIndex,
              fileGenerators,
              depth + 1
            );
          }
        }
      }
    }
  }

  static isFolderThatShouldBeProcessed(folder: IFolder): boolean {
    const name = folder.name.toLowerCase();

    if (name.startsWith(".") || name.startsWith("node_modules")) {
      return false;
    }

    return true;
  }

  generateProjectMetaInfo() {
    this.info = {
      capabilities: [],
    };

    const projGenerators: IProjectInfoGenerator[] = GeneratorRegistrations.projectGenerators;
    const itemGenerators: IProjectItemInfoGenerator[] = GeneratorRegistrations.itemGenerators;
    const fileGenerators: IProjectFileInfoGenerator[] = GeneratorRegistrations.fileGenerators;

    for (let j = 0; j < projGenerators.length; j++) {
      projGenerators[j].summarize(this.info, this);
    }

    for (let j = 0; j < itemGenerators.length; j++) {
      itemGenerators[j].summarize(this.info, this);
    }

    for (let j = 0; j < fileGenerators.length; j++) {
      fileGenerators[j].summarize(this.info, this);
    }

    for (let j = 0; j < projGenerators.length; j++) {
      if (projGenerators[j] instanceof SummaryInfoGenerator) {
        (projGenerators[j] as SummaryInfoGenerator).summarizePhase2(this.info, this);
      }
    }

    this.aggregateFeatures();
  }

  addObjectsToArray(validatorName: string, validatorId: number, parentArray: object[]) {
    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId && item.data) {
        if (typeof item.data === "object") {
          parentArray.push(item.data);
        }
      }
    }
  }

  getFirstStringValue(validatorName: string, validatorId: number) {
    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId && item.data) {
        if (typeof item.data === "string") {
          return item.data;
        }
      }
    }

    return undefined;
  }

  removeItems(validatorName: string, validatorIds: number[]) {
    const itemsNext = [];
    for (const item of this.items) {
      if (item.generatorId !== validatorName || !validatorIds.includes(item.generatorIndex)) {
        itemsNext.push(item);
      }
    }

    this.items = itemsNext;
  }

  getGeneratorForItem(item: ProjectInfoItem): IProjectInfoGeneratorBase | undefined {
    const itemGens = GeneratorRegistrations.itemGenerators;

    for (const itemGen of itemGens) {
      if (itemGen.id === item.generatorId) {
        return itemGen;
      }
    }

    const fileGens = GeneratorRegistrations.fileGenerators;
    for (const fileGen of fileGens) {
      if (fileGen.id === item.generatorId) {
        return fileGen;
      }
    }

    const projGens = GeneratorRegistrations.projectGenerators;

    for (const projGen of projGens) {
      if (projGen.id === item.generatorId) {
        return projGen;
      }
    }

    return undefined;
  }

  getItemSummary(item: ProjectInfoItem) {
    // First, try to get topic data from form.json file
    const formTopicData = InfoGeneratorTopicUtilities.getTopicDataSync(item.generatorId, item.generatorIndex);
    if (formTopicData) {
      return formTopicData.title;
    }

    // Fall back to generator's getTopicData method if available
    const gen = this.getGeneratorForItem(item);

    if (gen && typeof (gen as IProjectInfoGeneratorBase).getTopicData === "function") {
      const topic = (gen as IProjectInfoGeneratorBase).getTopicData!(item.generatorIndex);

      if (topic) {
        return topic.title;
      }
    }

    return item.generatorId + "-" + item.generatorIndex;
  }

  /**
   * Gets a stable key for aggregation purposes based on the form.json field title.
   * Uses getItemSummary() which returns the form.json title (e.g., "Texture Images"),
   * then convertToJsonKey() transforms it to camelCase (e.g., "textureImages").
   * This produces consistent JSON keys in validation reports.
   */
  getItemAggregationKey(item: ProjectInfoItem) {
    // Use getItemSummary which returns the form.json title or falls back to generator data
    return this.getItemSummary(item);
  }

  aggregateFeatures() {
    if (this.info === undefined) {
      return;
    }

    this.info.featureSets = {};

    for (const item of this.items) {
      if (item.featureSets) {
        for (const featureSetName in item.featureSets) {
          const featureSet = item.featureSets[featureSetName];

          const aggFeatureSetName =
            Utilities.convertToJsonKey(this.getItemAggregationKey(item)) +
            "." +
            Utilities.ensureFirstCharIsLowerCase(featureSetName);

          for (const measureName in featureSet) {
            const measure = featureSet[measureName];

            if (typeof measure === "number") {
              let feature = this.info.featureSets[aggFeatureSetName];

              if (feature === undefined) {
                feature = {};
                this.info.featureSets[aggFeatureSetName] = feature;
              }

              let aggVal = feature[measureName];

              if (aggVal === undefined) {
                aggVal = measure;
              } else if (measureName.startsWith("max_")) {
                aggVal = Math.max(aggVal, measure);
              } else if (featureSetName.startsWith("min_")) {
                aggVal = Math.min(aggVal, measure);
              } else {
                aggVal += measure;
              }

              feature[measureName] = aggVal;
            }
          }
        }
      }
    }
  }

  getFirstNumberDataValue(validatorName: string, validatorId: number) {
    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId && item.data) {
        if (typeof item.data === "number") {
          return item.data;
        }
      }
    }

    return 0;
  }

  getAverageFeatureValue(validatorName: string, validatorId: number, setName: string, measureName: string) {
    let sum = 0;
    let count = 0;
    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId) {
        const feat = item.getFeatureMeasureNumber(setName, measureName);

        if (typeof feat === "number") {
          sum += feat;
          count++;
        }
      }
    }

    if (count === 0) {
      return 0;
    }

    return sum / count;
  }

  getSummedFeatureValue(validatorName: string, validatorId: number, setName: string, measureName: string) {
    let sum = 0;
    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId) {
        const feat = item.getFeatureMeasureNumber(setName, measureName);

        if (typeof feat === "number") {
          sum += feat;
        }
      }
    }

    return sum;
  }

  getFeaturesWithInstances(validatorName: string, validatorId: number) {
    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId) {
        return item.getNonZeroFeatureMeasures();
      }
    }

    return [];
  }

  getSummedDataValue(validatorName: string, validatorId: number) {
    let sum = 0;
    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId && item.data) {
        if (typeof item.data === "number") {
          sum += item.data;
        }
      }
    }

    return sum;
  }

  getCount(validatorName: string, validatorId: number) {
    let sum = 0;

    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId) {
        sum++;
      }
    }

    return sum;
  }

  getMinNumberArrayValueAsVersionString(validatorName: string, validatorId: number) {
    let minVerNum = -1;
    let minVerStr = undefined;

    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId && item.data) {
        let val = item.data;
        if (typeof val === "string") {
          const strArr = val.split(".");
          const numArr: number[] = [];

          for (const strNum of strArr) {
            try {
              const num = parseInt(strNum);
              if (!isNaN(num)) {
                numArr.push(num);
              }
            } catch (e) {
              throw e;
            }
          }

          val = numArr;
        }

        if (val instanceof Array && val.length && val.length > 0) {
          let ret = "";
          for (let i = 0; i < val.length; i++) {
            if (ret.length > 0) {
              ret += ".";
            }

            ret += val[i];
          }

          const verNum = MinecraftUtilities.getVersionNumber(ret);

          if (minVerNum < 0 || verNum < minVerNum) {
            minVerNum = verNum;
            minVerStr = ret;
          }
        }
      }
    }
    return minVerStr;
  }

  getFirstNumberArrayValueAsVersionString(validatorName: string, validatorId: number) {
    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId && item.data) {
        const val = item.data;
        if (typeof val === "string") {
          return val;
        } else if (val instanceof Array && val.length && val.length > 0) {
          let ret = "";
          for (let i = 0; i < val.length; i++) {
            if (ret.length > 0) {
              ret += ".";
            }

            ret += val[i];
          }

          return ret;
        }
      }
    }

    return undefined;
  }

  async getInfoForItem(projectItem: ProjectItem, contentIndex: ContentIndex) {
    const itemGenerators: IProjectItemInfoGenerator[] = GeneratorRegistrations.itemGenerators;
    let genItems: ProjectInfoItem[] = [];

    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    for (let j = 0; j < itemGenerators.length; j++) {
      try {
        const infoItems = await itemGenerators[j].generate(projectItem, contentIndex);

        for (const infoItem of infoItems) {
          genItems.push(infoItem);
        }
      } catch (e: any) {
        genItems.push(
          new ProjectInfoItem(InfoItemType.internalProcessingError, itemGenerators[j].id, 504, e.toString())
        );
      }
    }

    return genItems;
  }

  /**
   * Gets the hash catalog as JSON string
   */
  getHashCatalogJson(): string {
    return JSON.stringify(this.contentIndex.hashCatalog);
  }
}

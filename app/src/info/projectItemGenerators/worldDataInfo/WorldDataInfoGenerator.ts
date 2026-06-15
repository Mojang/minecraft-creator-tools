// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../../ProjectInfoItem";
import ProjectItem from "../../../app/ProjectItem";
import IProjectInfoItemGenerator from "../../IProjectItemInfoGenerator";
import { ProjectItemType } from "../../../app/IProjectItemData";
import MCWorld from "../../../minecraft/MCWorld";
import IWorldScanCache from "../../../minecraft/IWorldScanCache";
import Log from "../../../core/Log";
import { InfoItemType } from "../../IInfoItemData";
import { StatusTopic } from "../../../app/Status";
import CommandStructure from "../../../app/CommandStructure";
import ProjectInfoSet from "../../ProjectInfoSet";
import CommandRegistry from "../../../app/CommandRegistry";
import Dialogue from "../../../minecraft/Dialogue";
import ContentIndex, { AnnotationCategory } from "../../../core/ContentIndex";
import { NbtTagType } from "../../../minecraft/NbtBinaryTag";
import AnimationControllerBehaviorDefinition from "../../../minecraft/AnimationControllerBehaviorDefinition";
import AnimationBehaviorDefinition from "../../../minecraft/AnimationBehaviorDefinition";
import ProjectInfoUtilities from "../../ProjectInfoUtilities";
import { GameType } from "../../../minecraft/WorldLevelDat";
import { IGeneratorOptions, ResourceConsumptionConstraint } from "../../ProjectInfoSet";
import { WorldDataInfoGeneratorTest, MaxWorldRecordsToProcess } from "./WorldDataInfoData";

export { WorldDataInfoGeneratorTest, MaxWorldRecordsToProcess };

/**
 * Validates and aggregates world data including command blocks and level.dat information.
 *
 * @see {@link ../../../../public/data/forms/mctoolsval/worlddata.form.json} for topic definitions
 */
export default class WorldDataInfoGenerator implements IProjectInfoItemGenerator {
  id = "WORLDDATA";
  title = "World Data Validation";

  modernCommandVersion = 33; // corresponds to 1.20.0 versions of Minecraft.

  performAddOnValidations = false;
  performPlatformVersionValidations: boolean = false;

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.chunkCount = infoSet.getSummedDataValue("WORLDDATA", WorldDataInfoGeneratorTest.chunks);

    info.subchunkLessChunkCount = infoSet.getSummedDataValue(
      "WORLDDATA",
      WorldDataInfoGeneratorTest.subchunklessChunks
    );

    info.completedWorldDataProcessing =
      infoSet.getCount("WORLDDATA", WorldDataInfoGeneratorTest.couldNotProcessWorld) === 0;

    info.worldLoadErrors = infoSet.getCount("WORLDDATA", WorldDataInfoGeneratorTest.errorProcessingWorld);

    const levelItems = infoSet.getItems(this.id, WorldDataInfoGeneratorTest.levelDat);
    const capabilitiesSet = new Set(info.capabilities);

    for (const levelItem of levelItems) {
      if (levelItem && levelItem.featureSets) {
        const gameType = levelItem.featureSets.GameType;

        if (gameType !== undefined) {
          if (gameType[GameType.adventure] !== undefined && gameType[GameType.adventure] > 0) {
            if (!capabilitiesSet.has("adventure")) {
              info.capabilities.push("adventure");
              capabilitiesSet.add("adventure");
            }
          }
          if (gameType[GameType.survival] !== undefined && gameType[GameType.survival] > 0) {
            if (!capabilitiesSet.has("survival")) {
              info.capabilities.push("survival");
              capabilitiesSet.add("survival");
            }
          }
          if (gameType[GameType.creative] !== undefined && gameType[GameType.creative] > 0) {
            if (!capabilitiesSet.has("creative")) {
              info.capabilities.push("creative");
              capabilitiesSet.add("creative");
            }
          }
        }
      }
    }

    info.commands = [];
    const commandsSet = new Set<string>();

    const commandItems = infoSet.getItems(this.id, WorldDataInfoGeneratorTest.command);
    const subCommandItems = infoSet.getItems(this.id, WorldDataInfoGeneratorTest.executeSubCommand);

    for (const commandItem of commandItems) {
      let commandNames = commandItem.featureSets;

      if (commandNames) {
        for (const commandName in commandNames) {
          if (!commandsSet.has(commandName)) {
            info.commands.push(commandName);
            commandsSet.add(commandName);
          }
        }
      }
    }

    for (const subCommandItem of subCommandItems) {
      let commandNames = subCommandItem.featureSets;

      if (commandNames) {
        for (const commandName in commandNames) {
          if (!commandsSet.has(commandName)) {
            info.commands.push(commandName);
            commandsSet.add(commandName);
          }
        }
      }
    }
  }

  processListOfCommands(
    commandList: string[],
    items: ProjectInfoItem[],
    projectItem: ProjectItem,
    commandsPi: ProjectInfoItem,
    subCommandsPi: ProjectInfoItem,
    checkForSlash: boolean
  ) {
    for (let i = 0; i < commandList.length; i++) {
      if (commandList[i].trim().length > 0 && (!checkForSlash || commandList[i].startsWith("/"))) {
        const command = CommandStructure.parse(commandList[i]);

        if (command.fullName.length === 0) {
          continue;
        }

        if (CommandRegistry.isMinecraftBuiltInCommand(command.fullName)) {
          if (this.performAddOnValidations && CommandRegistry.isAddOnBlockedCommand(command.fullName)) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.warning,
                this.id,
                WorldDataInfoGeneratorTest.containsWorldImpactingCommand,
                "Contains command '" +
                  command.fullName +
                  "' which is impacts the state of the entire world, and generally shouldn't be used in an add-on",
                projectItem,
                command.fullName,
                undefined,
                commandList[i]
              )
            );
          }
          commandsPi.incrementFeature(command.fullName);

          if (command.fullName === "execute") {
            let foundRun = false;
            for (const arg of command.commandArguments) {
              if (arg === "run") {
                foundRun = true;
              } else if (foundRun && CommandRegistry.isMinecraftBuiltInCommand(arg)) {
                subCommandsPi.incrementFeature(arg);
                break;
              }
            }
          }
        } else if (!this.performPlatformVersionValidations && !this.performAddOnValidations) {
          items.push(
            new ProjectInfoItem(
              InfoItemType.error,
              this.id,
              WorldDataInfoGeneratorTest.unexpectedCommandInCommandBlock,
              "Unexpected command '" + command.fullName + "'",
              projectItem,
              command.fullName,
              undefined,
              commandList[i]
            )
          );
        }
      }
    }
  }

  /**
   * Apply a pre-built {@link IWorldScanCache} to this generator's suite-specific
   * scoring rules. Pure transform — does not touch MCWorld state, does not
   * iterate chunks, can be called repeatedly across suites with no side effects.
   */
  private applyScanToInfoItems(
    scan: IWorldScanCache,
    items: ProjectInfoItem[],
    projectItem: ProjectItem,
    blocksPi: ProjectInfoItem | undefined,
    blockActorsPi: ProjectInfoItem | undefined,
    commandsPi: ProjectInfoItem,
    subCommandsPi: ProjectInfoItem
  ) {
    // Per-actor-id counts. The cache's `blockActorCounts` includes EVERY
    // actor (command blocks + signs + everything else), matching the legacy
    // "increment per actor.id seen" behavior.
    if (blockActorsPi) {
      for (const [actorId, count] of scan.blockActorCounts) {
        blockActorsPi.incrementFeature(actorId, "count", count);
      }
    }

    // Block-type counts.
    if (blocksPi) {
      for (const [typeName, count] of scan.blockTypeCounts) {
        let type = typeName;
        if (type.indexOf(":") >= 0 && type.indexOf("minecraft:") < 0) {
          type = "(custom)";
        }
        blocksPi.incrementFeature(type, "count", count);
      }
    }

    // Command-block-specific scoring. The cache already contributed each
    // command-block's `id` to `blockActorCounts` above; here we apply the
    // suite-sensitive rules (version recommendation, addon-blocked command,
    // unexpected commands) and feed the per-command-name counters.
    for (const cba of scan.commandBlockActors) {
      if (cba.version !== undefined && blockActorsPi) {
        blockActorsPi.spectrumIntFeature("Command Version", cba.version);
      }

      if (cba.version !== undefined && cba.version < this.modernCommandVersion) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.recommendation,
            this.id,
            WorldDataInfoGeneratorTest.commandIsFromOlderMinecraftVersion,
            "Command '" + cba.command + "' is from an older Minecraft version (" + cba.version + ") ",
            projectItem,
            "(Command at location " + cba.x + ", " + cba.y + ", " + cba.z + ")",
            undefined,
            cba.command
          )
        );
      }

      if (cba.command && cba.command.trim().length > 0) {
        const command = CommandStructure.parse(cba.command);

        if (command.fullName.length === 0) {
          // Skip empty command names (e.g., command block containing just "/")
        } else if (CommandRegistry.isMinecraftBuiltInCommand(command.fullName)) {
          if (this.performAddOnValidations && CommandRegistry.isAddOnBlockedCommand(command.fullName)) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.warning,
                this.id,
                WorldDataInfoGeneratorTest.containsWorldImpactingCommand,
                "Contains command '" +
                  command.fullName +
                  "' which is impacts the state of the entire world, and generally shouldn't be used in an add-on",
                projectItem,
                command.fullName,
                undefined,
                cba.command
              )
            );
          }

          commandsPi.incrementFeature(command.fullName);

          if (command.fullName === "execute") {
            let foundRun = false;
            for (const arg of command.commandArguments) {
              if (arg === "run") {
                foundRun = true;
              } else if (foundRun && CommandRegistry.isMinecraftBuiltInCommand(arg)) {
                subCommandsPi.incrementFeature(arg);
                break;
              }
            }
          }
        } else if (!this.performAddOnValidations && !this.performPlatformVersionValidations) {
          items.push(
            new ProjectInfoItem(
              InfoItemType.error,
              this.id,
              WorldDataInfoGeneratorTest.unexpectedCommandInCommandBlock,
              "Unexpected command '" + command.fullName + "'",
              projectItem,
              command.fullName,
              undefined,
              cba.command
            )
          );
        }
      }
    }
  }

  async generate(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    options?: IGeneratorOptions
  ): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    const onProgress = options?.onProgress;

    if (
      projectItem.itemType !== ProjectItemType.MCWorld &&
      projectItem.itemType !== ProjectItemType.MCTemplate &&
      projectItem.itemType !== ProjectItemType.worldFolder &&
      projectItem.itemType !== ProjectItemType.dialogueBehaviorJson &&
      projectItem.itemType !== ProjectItemType.animationControllerBehaviorJson &&
      projectItem.itemType !== ProjectItemType.animationBehaviorJson &&
      projectItem.itemType !== ProjectItemType.MCFunction
    ) {
      return items;
    }

    // Determine if this is a world-type item (needs all aggregates) or just command-related
    const isWorldType =
      projectItem.itemType === ProjectItemType.MCWorld ||
      projectItem.itemType === ProjectItemType.MCTemplate ||
      projectItem.itemType === ProjectItemType.worldFolder;

    // World-specific aggregates - only create for world items
    let blocksPi: ProjectInfoItem | undefined;
    let blockActorsPi: ProjectInfoItem | undefined;
    let nbtPi: ProjectInfoItem | undefined;
    let nbtExperimentsPi: ProjectInfoItem | undefined;

    if (isWorldType) {
      blocksPi = new ProjectInfoItem(
        InfoItemType.featureAggregate,
        this.id,
        WorldDataInfoGeneratorTest.blocks,
        ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, WorldDataInfoGeneratorTest.blocks),
        projectItem
      );
      items.push(blocksPi);

      blockActorsPi = new ProjectInfoItem(
        InfoItemType.featureAggregate,
        this.id,
        WorldDataInfoGeneratorTest.blockData,
        ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, WorldDataInfoGeneratorTest.blockData),
        projectItem
      );
      items.push(blockActorsPi);

      nbtPi = new ProjectInfoItem(
        InfoItemType.featureAggregate,
        this.id,
        WorldDataInfoGeneratorTest.levelDat,
        ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, WorldDataInfoGeneratorTest.levelDat),
        projectItem
      );
      items.push(nbtPi);

      nbtExperimentsPi = new ProjectInfoItem(
        InfoItemType.featureAggregate,
        this.id,
        WorldDataInfoGeneratorTest.levelDatExperiments,
        ProjectInfoUtilities.getTitleFromEnum(
          WorldDataInfoGeneratorTest,
          WorldDataInfoGeneratorTest.levelDatExperiments
        ),
        projectItem
      );
      items.push(nbtExperimentsPi);
    }

    // Command aggregates - used by all supported item types
    const commandsPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      WorldDataInfoGeneratorTest.command,
      ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, WorldDataInfoGeneratorTest.command),
      projectItem
    );
    items.push(commandsPi);

    const subCommandsPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      WorldDataInfoGeneratorTest.executeSubCommand,
      ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, WorldDataInfoGeneratorTest.executeSubCommand),
      projectItem
    );
    items.push(subCommandsPi);

    if (projectItem.itemType === ProjectItemType.dialogueBehaviorJson) {
      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (projectItem.primaryFile) {
        const diaManifest = await Dialogue.ensureOnFile(projectItem.primaryFile);

        if (diaManifest && diaManifest.definition && diaManifest.definition["minecraft:npc_dialogue"]) {
          let scenes = diaManifest.definition["minecraft:npc_dialogue"].scenes;

          for (const scene of scenes) {
            if (scene.on_open_commands) {
              this.processListOfCommands(scene.on_open_commands, items, projectItem, commandsPi, subCommandsPi, true);
            }
            if (scene.on_close_commands) {
              this.processListOfCommands(scene.on_close_commands, items, projectItem, commandsPi, subCommandsPi, true);
            }
          }
          let buttons = diaManifest.getAllButtons();

          for (const button of buttons) {
            if (button.commands) {
              this.processListOfCommands(button.commands, items, projectItem, commandsPi, subCommandsPi, true);
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.animationControllerBehaviorJson) {
      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (projectItem.primaryFile) {
        const acManifest = await AnimationControllerBehaviorDefinition.ensureOnFile(projectItem.primaryFile);

        if (acManifest && acManifest.data && acManifest.data.animation_controllers) {
          let states = acManifest.getAllStates();

          for (const state of states) {
            if (state.state.on_entry) {
              this.processListOfCommands(state.state.on_entry, items, projectItem, commandsPi, subCommandsPi, true);
            }

            if (state.state.on_exit) {
              this.processListOfCommands(state.state.on_exit, items, projectItem, commandsPi, subCommandsPi, true);
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.animationBehaviorJson) {
      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (projectItem.primaryFile) {
        const animManifest = await AnimationBehaviorDefinition.ensureOnFile(projectItem.primaryFile);

        if (animManifest && animManifest.data && animManifest.data.animations) {
          let timelines = animManifest.getAllTimeline();

          for (const timeline of timelines) {
            if (timeline.timeline) {
              this.processListOfCommands(timeline.timeline, items, projectItem, commandsPi, subCommandsPi, true);
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.MCFunction) {
      let content = await projectItem.getStringContent();

      if (content !== undefined) {
        let contentLines = content.split("\n");

        this.processListOfCommands(contentLines, items, projectItem, commandsPi, subCommandsPi, false);
      }
    }

    if (
      projectItem.itemType === ProjectItemType.MCWorld ||
      projectItem.itemType === ProjectItemType.MCTemplate ||
      projectItem.itemType === ProjectItemType.worldFolder
    ) {
      let mcworld: MCWorld | undefined = await MCWorld.ensureOnItem(projectItem);

      if (!mcworld) {
        Log.debugAlert("Could not find respective world.");
        return items;
      }

      await mcworld.loadMetaFiles(false);

      // Determine whether to apply record processing limits based on resource consumption constraint
      const constrainResources = options?.constrainResourceConsumption !== ResourceConsumptionConstraint.none;
      const maxRecordsToProcess = constrainResources ? MaxWorldRecordsToProcess : undefined;

      let didProcessWorldData = await mcworld.loadLevelDb(false, {
        maxNumberOfRecordsToProcess: maxRecordsToProcess,
      });

      // A truncated load still counts as "loaded" so subsequent calls into
      // `loadLevelDb` / `getDimensionInfo` short-circuit. But we still want
      // to emit the "couldNotProcessWorld" info item so the report flags
      // that downstream stats only reflect a partial scan.
      const wasTruncated = mcworld.wasLoadTruncated;

      if (
        mcworld.isInErrorState &&
        mcworld.errorMessages &&
        !this.performAddOnValidations &&
        !this.performPlatformVersionValidations
      ) {
        for (const err of mcworld.errorMessages) {
          items.push(
            new ProjectInfoItem(
              InfoItemType.error,
              this.id,
              WorldDataInfoGeneratorTest.errorProcessingWorld,
              ProjectInfoUtilities.getTitleFromEnum(
                WorldDataInfoGeneratorTest,
                WorldDataInfoGeneratorTest.errorProcessingWorld
              ),
              projectItem,
              err.message + (err.context ? " - " + err.context : ""),
              mcworld.name
            )
          );
        }

        didProcessWorldData = false;
      }

      if (!didProcessWorldData || wasTruncated) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.info,
            this.id,
            WorldDataInfoGeneratorTest.couldNotProcessWorld,
            ProjectInfoUtilities.getTitleFromEnum(
              WorldDataInfoGeneratorTest,
              WorldDataInfoGeneratorTest.couldNotProcessWorld
            ),
            projectItem,
            mcworld.name
          )
        );
      }

      if (
        projectItem.projectPath &&
        contentIndex &&
        mcworld.levelData &&
        mcworld.levelData.nbt &&
        mcworld.levelData.nbt.singleRoot
      ) {
        const children = mcworld.levelData.nbt.singleRoot.getTagChildren();

        for (const child of children) {
          if (child.name === "experiments") {
            for (const experimentChild of child.getTagChildren()) {
              if (
                experimentChild.type === NbtTagType.int ||
                experimentChild.type === NbtTagType.byte ||
                experimentChild.type === NbtTagType.string
              ) {
                nbtExperimentsPi?.incrementFeature(experimentChild.name, experimentChild.valueAsString);

                contentIndex.insert(
                  experimentChild.name + "==" + experimentChild.valueAsString,
                  projectItem.projectPath,
                  AnnotationCategory.experiment
                );
              }
            }
          } else if (
            child.type === NbtTagType.int ||
            child.type === NbtTagType.byte ||
            child.type === NbtTagType.string
          ) {
            if (
              child.name !== "LevelName" &&
              child.name !== "FlatWorldLayers" &&
              child.name !== "lightningTime" &&
              child.name !== "EducationOid" &&
              child.name !== "EducationProductId" &&
              child.name !== "rainTime" &&
              child.name !== "worldTemplateUUID" &&
              !child.name.startsWith("LimitedWorld") &&
              !child.name.startsWith("SpawnX") &&
              !child.name.startsWith("SpawnY") &&
              !child.name.startsWith("SpawnZ")
            ) {
              if (child.name.indexOf("ersion") >= 0 && !child.valueAsString.startsWith("1.")) {
                nbtPi?.incrementFeature(child.name, "(unknown version)");
              } else {
                nbtPi?.incrementFeature(child.name, child.valueAsString);
              }

              contentIndex.insert(
                child.name + "==" + child.valueAsString,
                projectItem.projectPath,
                AnnotationCategory.worldProperty
              );
            }
          }
        }
      }

      items.push(
        new ProjectInfoItem(
          InfoItemType.info,
          this.id,
          WorldDataInfoGeneratorTest.chunks,
          ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, WorldDataInfoGeneratorTest.chunks),
          projectItem,
          mcworld.chunkCount,
          mcworld.name
        )
      );

      if (didProcessWorldData) {
        // CONTRACT
        // --------
        // World-scoped validation generators (this one,
        // CustomDimensionWorldDataInfoGenerator, etc.) MUST NOT mutate
        // world state. They read facts via `mcworld.getOrBuildScanSummary`,
        // which is idempotent and project-scoped — every generator gets the
        // same canonical answer regardless of call order.
        //
        // A typical CLI validate run invokes WorldDataInfoGenerator from
        // 1-3 ProjectInfoSets (defaultInDevelopment, cooperativeAddOn,
        // currentPlatformVersions). Each pass needs the same per-chunk facts
        // (block counts, block-actor ids, command-block actor list) but
        // emits DIFFERENT ProjectInfoItems based on its suite-specific
        // rule gates (e.g. `performAddOnValidations`). The summary is built
        // once on the first call and reused for free on every subsequent
        // call.
        //
        // The final memory teardown (clearing chunk maps, LevelDB keys,
        // and the scan cache) happens externally in
        // `TaskWorker.releaseHeavyItemManagers` after all suites finish.
        const scan = await mcworld.getOrBuildScanSummary({
          progressCallback: async (processed, total) => {
            const worldName = mcworld.name ?? "unknown";
            const chunkPercent = total > 0 ? Math.floor((processed / total) * 100) : 0;
            const mess =
              "World validation: scanned " +
              Math.floor(processed / 1000) +
              "K of " +
              Math.floor(total / 1000) +
              "K chunks in " +
              worldName;

            // Map chunk progress (0-100%) to the 30-80% range of overall validation
            if (onProgress) {
              const overallPercent = Math.floor(30 + chunkPercent * 0.5); // 30-80%
              onProgress(mess, overallPercent);
            }

            await projectItem.project.creatorTools.notifyStatusUpdate(mess, StatusTopic.validation);
          },
        });

        this.applyScanToInfoItems(scan, items, projectItem, blocksPi, blockActorsPi, commandsPi, subCommandsPi);

        items.push(
          new ProjectInfoItem(
            InfoItemType.info,
            this.id,
            WorldDataInfoGeneratorTest.subchunklessChunks,
            "Subchunkless Chunks",
            projectItem,
            scan.subchunkLessChunkCount,
            mcworld.name
          )
        );

        if (blocksPi) {
          blocksPi.data = scan.blockCount;
        }
      }

      items.push(
        new ProjectInfoItem(
          InfoItemType.info,
          this.id,
          WorldDataInfoGeneratorTest.minX,
          ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, WorldDataInfoGeneratorTest.minX),
          projectItem,
          mcworld.minX,
          mcworld.name
        )
      );
      items.push(
        new ProjectInfoItem(
          InfoItemType.info,
          this.id,
          WorldDataInfoGeneratorTest.minZ,
          ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, WorldDataInfoGeneratorTest.minZ),
          projectItem,
          mcworld.minZ,
          mcworld.name
        )
      );
      items.push(
        new ProjectInfoItem(
          InfoItemType.info,
          this.id,
          WorldDataInfoGeneratorTest.maxX,
          ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, WorldDataInfoGeneratorTest.maxX),
          projectItem,
          mcworld.maxX,
          mcworld.name
        )
      );
      items.push(
        new ProjectInfoItem(
          InfoItemType.info,
          this.id,
          WorldDataInfoGeneratorTest.maxZ,
          ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, WorldDataInfoGeneratorTest.maxZ),
          projectItem,
          mcworld.maxZ,
          mcworld.name
        )
      );

      // NO clearAllData() HERE.
      // ----------------------
      // This generator is one of several world-scoped validators that may
      // run during a single project validation (defaultInDevelopment ->
      // cooperativeAddOn -> currentPlatformVersions; plus
      // CustomDimensionWorldDataInfoGenerator immediately after this one).
      // Clearing world state here forces every subsequent generator to
      // re-decompress and re-parse the entire LevelDB — on a 179 MB world
      // template that's gigabytes of extra wasted work and memory churn.
      //
      // Memory pressure during the scan itself is already bounded by
      // `getOrBuildScanSummary`, which uses `clearAllAfterProcess: true`
      // per chunk and collapses the world into a small primitive summary.
      // Final teardown happens once in `TaskWorker.releaseHeavyItemManagers`
      // after all suites finish.
    }

    return items;
  }
}

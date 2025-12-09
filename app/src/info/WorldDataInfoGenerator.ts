// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import MCWorld from "../minecraft/MCWorld";
import Log from "../core/Log";
import { InfoItemType } from "./IInfoItemData";
import CommandBlockActor from "../minecraft/blockActors/CommandBlockActor";
import { StatusTopic } from "../app/Status";
import CommandStructure from "../app/CommandStructure";
import ProjectInfoSet from "./ProjectInfoSet";
import CommandRegistry from "../app/CommandRegistry";
import Dialogue from "../minecraft/Dialogue";
import ContentIndex, { AnnotationCategory } from "../core/ContentIndex";
import { NbtTagType } from "../minecraft/NbtBinaryTag";
import AnimationControllerBehaviorDefinition from "../minecraft/AnimationControllerBehaviorDefinition";
import AnimationBehaviorDefinition from "../minecraft/AnimationBehaviorDefinition";
import ProjectInfoUtilities from "./ProjectInfoUtilities";
import { GameType } from "../minecraft/WorldLevelDat";

import { IGeneratorOptions } from "./ProjectInfoSet";

export const MaxWorldRecordsToProcess = 3000000; // very crudely, this equates to about 100K chunks

export enum WorldDataInfoGeneratorTest {
  unexpectedCommandInMCFunction = 101,
  unexpectedCommandInCommandBlock = 102,
  minX = 103,
  minZ = 104,
  maxX = 105,
  maxZ = 106,
  containsWorldImpactingCommand = 112,
  blocks = 121,
  blockData = 122,
  command = 123,
  executeSubCommand = 124,
  levelDat = 125,
  levelDatExperiments = 126,
  subchunklessChunks = 127,
  chunks = 128,
  commandIsFromOlderMinecraftVersion = 212,
  couldNotProcessWorld = 216,
  errorProcessingWorld = 400,
  unexpectedError = 401,
}

export default class WorldDataInfoGenerator implements IProjectInfoItemGenerator {
  id = "WORLDDATA";
  title = "World Data Validation";

  modernCommandVersion = 33; // corresponds to 1.20.0 versions of Minecraft.

  performAddOnValidations = false;
  performPlatformVersionValidations: boolean = false;

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, topicId),
    };
  }

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

    for (const commandItem of subCommandItems) {
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

    info.commands.sort();
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
      if (commandList[i].trim().length > 2 && (!checkForSlash || commandList[i].startsWith("/"))) {
        const command = CommandStructure.parse(commandList[i]);

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

  async generate(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    options?: IGeneratorOptions
  ): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    const performAggressiveCleanup = options?.performAggressiveCleanup ?? false;

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

    const blocksPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      WorldDataInfoGeneratorTest.blocks,
      ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, WorldDataInfoGeneratorTest.blocks),
      projectItem
    );
    items.push(blocksPi);

    const blockActorsPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      WorldDataInfoGeneratorTest.blockData,
      ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, WorldDataInfoGeneratorTest.blockData),
      projectItem
    );
    items.push(blockActorsPi);

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

    const nbtPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      WorldDataInfoGeneratorTest.levelDat,
      ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, WorldDataInfoGeneratorTest.levelDat),
      projectItem
    );
    items.push(nbtPi);

    const nbtExperimentsPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      WorldDataInfoGeneratorTest.levelDatExperiments,
      ProjectInfoUtilities.getTitleFromEnum(WorldDataInfoGeneratorTest, WorldDataInfoGeneratorTest.levelDatExperiments),
      projectItem
    );
    items.push(nbtExperimentsPi);

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

      let didProcessWorldData = await mcworld.loadLevelDb(false, {
        maxNumberOfRecordsToProcess: MaxWorldRecordsToProcess,
      });

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

      if (!didProcessWorldData) {
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
                nbtExperimentsPi.incrementFeature(experimentChild.name, experimentChild.valueAsString);

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
                nbtPi.incrementFeature(child.name, "(unknown version)");
              } else {
                nbtPi.incrementFeature(child.name, child.valueAsString);
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
        let blockCount = 0;
        let chunkCount = 0;
        let subchunkLessChunkCount = 0;

        // Use the memory-efficient chunk iterator with aggressive data clearing
        // This prevents heap exhaustion on large worlds by clearing chunk data after processing
        await mcworld.forEachChunk(
          async (chunk, x, z, dimIndex) => {
            chunkCount++;

            if (chunk.subChunks.length <= 0) {
              subchunkLessChunkCount++;
            }

            const blockActors = chunk.blockActors;

            for (let i = 0; i < blockActors.length; i++) {
              const blockActor = blockActors[i];

              if (blockActor.id) {
                blockActorsPi.incrementFeature(blockActor.id);
              }

              if (blockActor instanceof CommandBlockActor) {
                let cba = blockActor as CommandBlockActor;
                if (cba.version) {
                  blockActorsPi.spectrumIntFeature("Command Version", cba.version);
                }

                if (cba.version && cba.version < this.modernCommandVersion) {
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

                if (cba.command && cba.command.trim().length > 2) {
                  let command = CommandStructure.parse(cba.command);

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

            // Use memory-efficient block type counting instead of getBlockList()
            // This avoids allocating massive arrays of Block objects
            const blockTypeCounts = chunk.countBlockTypes();

            for (const [typeName, count] of blockTypeCounts) {
              blockCount += count;

              let type = typeName;
              if (type.indexOf(":") >= 0 && type.indexOf("minecraft:") < 0) {
                type = "(custom)";
              }

              blocksPi.incrementFeature(type, "count", count);
            }
          },
          {
            // Always clear parsed/cached data after processing each chunk to prevent OOM.
            // This is non-destructive - raw LevelKeyValue bytes are preserved, so chunks
            // can be re-parsed on demand (e.g., when the world map needs them).
            clearCacheAfterProcess: true,
            // Only clear raw LevelKeyValue data when in aggressive cleanup mode (CLI validation).
            // In browser contexts, we preserve raw data so the world map can re-parse chunks.
            clearAllAfterProcess: performAggressiveCleanup,
            progressCallback: async (processed, total) => {
              // Use worldName captured from outside closure to avoid TypeScript null check issue
              const worldName = mcworld?.name ?? "unknown";
              let mess =
                "World data validation: scanned " +
                Math.floor(processed / 1000) +
                "K of " +
                Math.floor(total / 1000) +
                "K chunks in " +
                worldName;
              await projectItem.project.creatorTools.notifyStatusUpdate(mess, StatusTopic.validation);
            },
          }
        );

        items.push(
          new ProjectInfoItem(
            InfoItemType.info,
            this.id,
            WorldDataInfoGeneratorTest.subchunklessChunks,
            "Subchunkless Chunks",
            projectItem,
            subchunkLessChunkCount,
            mcworld.name
          )
        );

        blocksPi.data = blockCount;
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
    }

    return items;
  }
}

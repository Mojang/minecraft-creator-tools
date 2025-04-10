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

export enum WorldDataInfoGeneratorTest {
  blocks = 1,
  blockData = 2,
  command = 3,
  executeSubCommand = 4,
  levelDat = 5,
  levelDatExperiments = 6,
  subchunklessChunks = 7,
  chunks = 8,
  unexpectedCommandInMCFunction = 101,
  minX = 103,
  minZ = 104,
  maxX = 105,
  maxZ = 106,
  unexpectedCommandInCommandBlock = 102,
  containsWorldImpactingCommand = 112,
  commandIsFromOlderMinecraftVersion = 212,
  errorProcessingWorld = 400,
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
    info.chunkCount = infoSet.getSummedNumberValue(
      "WORLDDATA",
      WorldDataInfoGeneratorTest.unexpectedCommandInMCFunction
    );

    info.subchunkLessChunkCount = infoSet.getSummedNumberValue(
      "WORLDDATA",
      WorldDataInfoGeneratorTest.subchunklessChunks
    );

    info.worldLoadErrors = infoSet.getCount("WORLDDATA", WorldDataInfoGeneratorTest.errorProcessingWorld);
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

        if (CommandRegistry.isMinecraftBuiltInCommand(command.name)) {
          if (this.performAddOnValidations && CommandRegistry.isAddOnBlockedCommand(command.name)) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.warning,
                this.id,
                WorldDataInfoGeneratorTest.containsWorldImpactingCommand,
                "Contains command '" +
                  command.name +
                  "' which is impacts the state of the entire world, and generally shouldn't be used in an add-on",
                projectItem,
                command.name,
                undefined,
                commandList[i]
              )
            );
          }
          commandsPi.incrementFeature(command.name);

          if (command.name === "execute") {
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
              401,
              "Unexpected command '" + command.name + "'",
              projectItem,
              command.name,
              undefined,
              commandList[i]
            )
          );
        }
      }
    }
  }

  async generate(projectItem: ProjectItem, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

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
      await projectItem.ensureFileStorage();

      if (projectItem.availableFile) {
        const diaManifest = await Dialogue.ensureOnFile(projectItem.availableFile);

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
      await projectItem.ensureFileStorage();

      if (projectItem.availableFile) {
        const acManifest = await AnimationControllerBehaviorDefinition.ensureOnFile(projectItem.availableFile);

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
      await projectItem.ensureFileStorage();

      if (projectItem.availableFile) {
        const animManifest = await AnimationBehaviorDefinition.ensureOnFile(projectItem.availableFile);

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

      await mcworld.load(false);

      await mcworld.loadData(false);

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

      let blockCount = 0;
      let chunkCount = 0;
      let subchunkLessChunkCount = 0;

      for (const dimIndex in mcworld.chunks) {
        let dim = mcworld.chunks[dimIndex];

        for (const chunkSliverIndex in dim) {
          const chunkSliver = dim[chunkSliverIndex];

          if (chunkSliver) {
            for (const chunkId in chunkSliver) {
              const chunk = chunkSliver[chunkId];

              if (chunk) {
                chunkCount++;

                if (chunk.subChunks.length <= 0) {
                  subchunkLessChunkCount++;
                }

                if (chunkCount % 1000 === 0) {
                  await projectItem.project.carto.notifyStatusUpdate(
                    "World data validation: scanned " +
                      chunkCount / 1000 +
                      "K of " +
                      Math.floor(mcworld.chunkCount / 1000) +
                      "K chunks in " +
                      mcworld.name,
                    StatusTopic.validation
                  );
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

                      if (CommandRegistry.isMinecraftBuiltInCommand(command.name)) {
                        if (this.performAddOnValidations && CommandRegistry.isAddOnBlockedCommand(command.name)) {
                          items.push(
                            new ProjectInfoItem(
                              InfoItemType.warning,
                              this.id,
                              WorldDataInfoGeneratorTest.containsWorldImpactingCommand,
                              "Contains command '" +
                                command.name +
                                "' which is impacts the state of the entire world, and generally shouldn't be used in an add-on",
                              projectItem,
                              command.name,
                              undefined,
                              cba.command
                            )
                          );
                        }

                        commandsPi.incrementFeature(command.name);

                        if (command.name === "execute") {
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
                            "Unexpected command '" + command.name + "'",
                            projectItem,
                            command.name,
                            undefined,
                            cba.command
                          )
                        );
                      }
                    }
                  }
                }

                const blockList = chunk.getBlockList();

                for (let i = 0; i < blockList.length; i++) {
                  const block = blockList[i];

                  if (block) {
                    blockCount++;
                    if (block.typeName) {
                      let type = block.typeName;

                      if (type.indexOf(":") >= 0 && type.indexOf("minecraft:") < 0) {
                        type = "(custom)";
                      }

                      blocksPi.incrementFeature(type);
                    }
                  }
                }

                chunk.clearCachedData();
              }
            }
          }
        }
      }

      blocksPi.data = blockCount;

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
    }

    return items;
  }
}

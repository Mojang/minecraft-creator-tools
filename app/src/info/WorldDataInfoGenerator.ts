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
import BehaviorAnimationController from "../minecraft/BehaviorAnimationController";
import BehaviorAnimation from "../minecraft/BehaviorAnimation";
import Dialogue from "../minecraft/Dialogue";
import ProjectItemUtilities from "../app/ProjectItemUtilities";

export default class WorldDataInfoGenerator implements IProjectInfoItemGenerator {
  id = "WORLDDATA";
  title = "World Data Validation";

  performAddOnValidations = false;

  getTopicData(topicId: number) {
    switch (topicId) {
      case 1:
        return { title: "Block" };
      case 2:
        return { title: "Block Data" };
      case 3:
        return { title: "Command" };
      case 101:
        return { title: "Unexpected command in MCFunction" };
      case 102:
        return { title: "Unexpected command in Command Block" };
    }

    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.chunkCount = infoSet.getSummedNumberValue("WORLDDATA", 101);
  }

  processListOfCommands(
    commandList: string[],
    items: ProjectInfoItem[],
    projectItem: ProjectItem,
    commandsPi: ProjectInfoItem,
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
                112,
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
        } else {
          items.push(
            new ProjectInfoItem(
              InfoItemType.error,
              this.id,
              101,
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

  async generate(projectItem: ProjectItem): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (
      projectItem.itemType === ProjectItemType.MCAddon ||
      projectItem.itemType === ProjectItemType.MCPack ||
      projectItem.itemType === ProjectItemType.MCProject ||
      projectItem.itemType === ProjectItemType.js ||
      projectItem.itemType === ProjectItemType.ts ||
      projectItem.itemType === ProjectItemType.testJs ||
      projectItem.itemType === ProjectItemType.structure ||
      ProjectItemUtilities.isImageType(projectItem.itemType)
    ) {
      return items;
    }

    const blocksPi = new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 1, "Blocks", projectItem);
    items.push(blocksPi);

    const blockActorsPi = new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 2, "Block Data", projectItem);
    items.push(blockActorsPi);

    const commandsPi = new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 3, "Commands", projectItem);
    items.push(commandsPi);

    if (projectItem.itemType === ProjectItemType.dialogueBehaviorJson) {
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const diaManifest = await Dialogue.ensureOnFile(projectItem.file);

        if (diaManifest && diaManifest.definition && diaManifest.definition["minecraft:npc_dialogue"]) {
          let scenes = diaManifest.definition["minecraft:npc_dialogue"].scenes;

          for (const scene of scenes) {
            if (scene.on_open_commands) {
              this.processListOfCommands(scene.on_open_commands, items, projectItem, commandsPi, true);
            }
            if (scene.on_close_commands) {
              this.processListOfCommands(scene.on_close_commands, items, projectItem, commandsPi, true);
            }
          }
          let buttons = diaManifest.getAllButtons();

          for (const button of buttons) {
            if (button.commands) {
              this.processListOfCommands(button.commands, items, projectItem, commandsPi, true);
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.animationControllerBehaviorJson) {
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const acManifest = await BehaviorAnimationController.ensureOnFile(projectItem.file);

        if (acManifest && acManifest.definition && acManifest.definition.animation_controllers) {
          let states = acManifest.getAllStates();

          for (const state of states) {
            if (state.state.on_entry) {
              this.processListOfCommands(state.state.on_entry, items, projectItem, commandsPi, true);
            }

            if (state.state.on_exit) {
              this.processListOfCommands(state.state.on_exit, items, projectItem, commandsPi, true);
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.animationBehaviorJson) {
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const animManifest = await BehaviorAnimation.ensureOnFile(projectItem.file);

        if (animManifest && animManifest.definition && animManifest.definition.animations) {
          let timelines = animManifest.getAllTimeline();

          for (const timeline of timelines) {
            if (timeline.timeline) {
              this.processListOfCommands(timeline.timeline, items, projectItem, commandsPi, true);
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.MCFunction) {
      let content = await projectItem.getStringContent();

      if (content !== undefined) {
        let contentLines = content.split("\n");

        this.processListOfCommands(contentLines, items, projectItem, commandsPi, false);
      }
    }

    if (
      projectItem.itemType === ProjectItemType.MCWorld ||
      projectItem.itemType === ProjectItemType.MCTemplate ||
      projectItem.itemType === ProjectItemType.worldFolder
    ) {
      let mcworld: MCWorld | undefined = undefined;

      if (projectItem.folder) {
        mcworld = await MCWorld.ensureMCWorldOnFolder(projectItem.folder, projectItem.project);
      } else if (projectItem.file) {
        mcworld = await MCWorld.ensureOnFile(projectItem.file, projectItem.project);
      }

      if (!mcworld) {
        Log.debugAlert("Could not find respective world.");
        return items;
      }

      await mcworld.load(false);

      await mcworld.loadData(false);

      items.push(
        new ProjectInfoItem(InfoItemType.info, this.id, 101, "Chunks", projectItem, mcworld.chunkCount, mcworld.name)
      );

      let blockCount = 0;
      let chunkCount = 0;
      for (const dimIndex in mcworld.chunks) {
        let dim = mcworld.chunks[dimIndex];

        for (const chunkSliverIndex in dim) {
          const chunkSliver = dim[chunkSliverIndex];

          if (chunkSliver) {
            for (const chunkId in chunkSliver) {
              const chunk = chunkSliver[chunkId];

              if (chunk) {
                chunkCount++;

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

                chunk.ensureBlockActors();

                const blockActors = chunk.blockActors;

                for (let i = 0; i < blockActors.length; i++) {
                  const blockActor = blockActors[i];

                  if (blockActor.id) {
                    blockActorsPi.incrementFeature(blockActor.id, 1);
                  }

                  if (blockActor instanceof CommandBlockActor) {
                    let cba = blockActor as CommandBlockActor;
                    if (cba.version) {
                      blockActorsPi.spectrumIntFeature("Command Version", cba.version);
                    }

                    if (cba.command && cba.command.trim().length > 2) {
                      let command = CommandStructure.parse(cba.command);

                      if (CommandRegistry.isMinecraftBuiltInCommand(command.name)) {
                        if (this.performAddOnValidations && CommandRegistry.isAddOnBlockedCommand(command.name)) {
                          items.push(
                            new ProjectInfoItem(
                              InfoItemType.warning,
                              this.id,
                              112,
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
                      } else {
                        items.push(
                          new ProjectInfoItem(
                            InfoItemType.error,
                            this.id,
                            102,
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

                      blocksPi.incrementFeature(type, 1);
                    }
                  }
                }
              }
            }
          }
        }
      }

      blocksPi.data = blockCount;

      items.push(
        new ProjectInfoItem(InfoItemType.info, this.id, 103, "Min X", projectItem, mcworld.minX, mcworld.name)
      );
      items.push(
        new ProjectInfoItem(InfoItemType.info, this.id, 104, "Min Z", projectItem, mcworld.minZ, mcworld.name)
      );
      items.push(
        new ProjectInfoItem(InfoItemType.info, this.id, 105, "Max X", projectItem, mcworld.maxX, mcworld.name)
      );
      items.push(
        new ProjectInfoItem(InfoItemType.info, this.id, 106, "Max Z", projectItem, mcworld.maxZ, mcworld.name)
      );
    }

    return items;
  }
}

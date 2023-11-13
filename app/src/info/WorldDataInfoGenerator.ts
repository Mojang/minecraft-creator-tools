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

export default class WorldDataInfoGenerator implements IProjectInfoItemGenerator {
  id = "WORLDDATA";
  title = "World Data Validation";

  getTopicData(topicId: number) {
    switch (topicId) {
      case 1:
        return { title: "Block" };
      case 2:
        return { title: "Block Data" };
      case 3:
        return { title: "Command" };
    }

    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.chunkCount = infoSet.getSummedNumberValue("WORLDDATA", 101);
  }

  async generate(projectItem: ProjectItem): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    const blocksPi = new ProjectInfoItem(InfoItemType.info, this.id, 1, "Blocks", projectItem);
    items.push(blocksPi);

    const blockActorsPi = new ProjectInfoItem(InfoItemType.info, this.id, 2, "Block Data", projectItem);
    items.push(blockActorsPi);

    const commandsPi = new ProjectInfoItem(InfoItemType.info, this.id, 3, "Commands", projectItem);
    items.push(commandsPi);

    if (projectItem.itemType === ProjectItemType.MCFunction) {
      let content = await projectItem.getStringContent();

      if (content !== undefined) {
        let contentLines = content.split("\n");

        for (let i = 0; i < contentLines.length; i++) {
          if (contentLines[i].trim().length > 2) {
            const command = CommandStructure.parse(contentLines[i]);

            commandsPi.incrementFeature(command.name);
          }
        }
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
        mcworld = await MCWorld.ensureMCWorldOnFile(projectItem.file, projectItem.project);
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

                await chunk.ensureBlockActors();

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

                      commandsPi.incrementFeature(command.name);
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

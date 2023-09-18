import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import MCWorld from "../minecraft/MCWorld";
import Log from "../core/Log";
import { InfoItemType } from "./IInfoItemData";

export default class WorldItemInfoGenerator implements IProjectInfoItemGenerator {
  id = "WORLD";
  title = "World Validation";

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  async generate(projectItem: ProjectItem): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (
      projectItem.itemType === ProjectItemType.MCWorld ||
      projectItem.itemType === ProjectItemType.MCTemplate ||
      projectItem.itemType === ProjectItemType.worldFolder
    ) {
      let mcworld: MCWorld | undefined = undefined;

      if (projectItem.file) {
        mcworld = await MCWorld.ensureMCWorldOnFile(projectItem.file, projectItem.project);
      } else if (projectItem.folder) {
        mcworld = await MCWorld.ensureMCWorldOnFolder(projectItem.folder, projectItem.project);
      }

      if (!mcworld) {
        Log.debugAlert("Could not find respective world.");
        return items;
      }

      await mcworld.load(false);

      items.push(
        new ProjectInfoItem(
          InfoItemType.info,
          this.id,
          101,
          "Game test experiment",
          projectItem,
          mcworld.betaApisExperiment,
          mcworld.name
        )
      );

      items.push(
        new ProjectInfoItem(
          InfoItemType.info,
          this.id,
          102,
          "Chunk count",
          projectItem,
          mcworld.chunkCount,
          mcworld.name
        )
      );

      items.push(
        new ProjectInfoItem(InfoItemType.info, "WORLD", 103, "Min X", projectItem, mcworld.minX, mcworld.name)
      );
      items.push(
        new ProjectInfoItem(InfoItemType.info, "WORLD", 104, "Min Z", projectItem, mcworld.minZ, mcworld.name)
      );
      items.push(
        new ProjectInfoItem(InfoItemType.info, "WORLD", 105, "Max X", projectItem, mcworld.maxX, mcworld.name)
      );
      items.push(
        new ProjectInfoItem(InfoItemType.info, "WORLD", 106, "Max Z", projectItem, mcworld.maxZ, mcworld.name)
      );

      if (mcworld.manifest && mcworld.manifest.header && mcworld.manifest.header.base_game_version) {
        let val: any = mcworld.manifest.header.base_game_version;

        if (val.join) {
          val = val.join(".");
        }

        val = val.toString();

        items.push(
          new ProjectInfoItem(InfoItemType.info, this.id, 107, "Base game version", projectItem, val, mcworld.name)
        );
        items.push(
          new ProjectInfoItem(
            InfoItemType.info,
            "WORLD",
            108,
            "Name",
            projectItem,
            mcworld.manifest.header.name,
            mcworld.name
          )
        );

        items.push(
          new ProjectInfoItem(
            InfoItemType.info,
            "WORLD",
            109,
            "Description",
            projectItem,
            mcworld.manifest.header.description,
            mcworld.name
          )
        );
      }
    }

    return items;
  }
}

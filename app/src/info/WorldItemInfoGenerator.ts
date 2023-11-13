import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import MCWorld from "../minecraft/MCWorld";
import Log from "../core/Log";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";

export default class WorldItemInfoGenerator implements IProjectInfoItemGenerator {
  id = "WORLD";
  title = "World Validation";

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.baseGameVersion = infoSet.getFirstStringValue(this.id, 107);
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
          "Beta APIs experiment: " + mcworld.betaApisExperiment,
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
          "Data Driven Items experiment: " + mcworld.dataDrivenItemsExperiment,
          projectItem,
          mcworld.dataDrivenItemsExperiment,
          mcworld.name
        )
      );

      items.push(
        new ProjectInfoItem(
          InfoItemType.info,
          this.id,
          103,
          "Deferred Technical Preview experiment: " + mcworld.deferredTechnicalPreviewExperiment,
          projectItem,
          mcworld.deferredTechnicalPreviewExperiment,
          mcworld.name
        )
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

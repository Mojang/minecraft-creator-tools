// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import MCWorld from "../minecraft/MCWorld";
import Log from "../core/Log";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import ProjectInfoUtilities from "./ProjectInfoUtilities";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";

export enum WorldItemInfoGeneratorTest {
  betaApisExperiment = 101,
  dataDrivenItemsExperiment = 102,
  deferredTechnicalPreviewExperiment = 103,
  baseGameVersion = 107,
  worldName = 108,
  worldDescription = 109,
}

export default class WorldItemInfoGenerator implements IProjectInfoItemGenerator {
  id = "WORLD";
  title = "World Validation";

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.baseGameVersion = infoSet.getFirstStringValue(this.id, WorldItemInfoGeneratorTest.baseGameVersion);

    info.minBaseGameVersionString = infoSet.getMinNumberArrayValueAsVersionString(
      this.id,
      WorldItemInfoGeneratorTest.baseGameVersion
    );

    info.minBaseGameVersion = MinecraftUtilities.getVersionNumber(info.minBaseGameVersionString);
  }

  async generate(projectItem: ProjectItem): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

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

      items.push(
        new ProjectInfoItem(
          InfoItemType.info,
          this.id,
          WorldItemInfoGeneratorTest.betaApisExperiment,
          ProjectInfoUtilities.getTitleFromEnum(
            WorldItemInfoGeneratorTest,
            WorldItemInfoGeneratorTest.betaApisExperiment
          ),
          projectItem,
          mcworld.betaApisExperiment,
          mcworld.name
        )
      );

      items.push(
        new ProjectInfoItem(
          InfoItemType.info,
          this.id,
          WorldItemInfoGeneratorTest.dataDrivenItemsExperiment,
          ProjectInfoUtilities.getTitleFromEnum(
            WorldItemInfoGeneratorTest,
            WorldItemInfoGeneratorTest.dataDrivenItemsExperiment
          ),
          projectItem,
          mcworld.dataDrivenItemsExperiment,
          mcworld.name
        )
      );

      items.push(
        new ProjectInfoItem(
          InfoItemType.info,
          this.id,
          WorldItemInfoGeneratorTest.deferredTechnicalPreviewExperiment,
          ProjectInfoUtilities.getTitleFromEnum(
            WorldItemInfoGeneratorTest,
            WorldItemInfoGeneratorTest.deferredTechnicalPreviewExperiment
          ),
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
          new ProjectInfoItem(
            InfoItemType.info,
            this.id,
            WorldItemInfoGeneratorTest.baseGameVersion,
            "Base game version",
            projectItem,
            val,
            mcworld.name
          )
        );

        items.push(
          new ProjectInfoItem(
            InfoItemType.info,
            "WORLD",
            WorldItemInfoGeneratorTest.worldName,
            ProjectInfoUtilities.getTitleFromEnum(WorldItemInfoGeneratorTest, WorldItemInfoGeneratorTest.worldName),
            projectItem,
            mcworld.manifest.header.name,
            mcworld.name
          )
        );

        items.push(
          new ProjectInfoItem(
            InfoItemType.info,
            "WORLD",
            WorldItemInfoGeneratorTest.worldDescription,
            ProjectInfoUtilities.getTitleFromEnum(
              WorldItemInfoGeneratorTest,
              WorldItemInfoGeneratorTest.worldDescription
            ),
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

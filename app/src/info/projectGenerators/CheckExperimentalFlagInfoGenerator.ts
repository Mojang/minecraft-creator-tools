// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../ProjectInfoItem";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import { InfoItemType } from "../IInfoItemData";
import ProjectInfoSet from "../ProjectInfoSet";
import ProjectInfoUtilities from "../ProjectInfoUtilities";
import { ProjectItemType } from "../../app/IProjectItemData";
import Project from "../../app/Project";
import MCWorld from "../../minecraft/MCWorld";

export enum CheckExperimentalFlagInfoGeneratorTest {
  flagIsOrWasTrue = 101,
  levelDatNotFound = 102,
  worldNotFound = 103,
}

/***********
 * Generator for Checking Experimental Flag for world
 *
 * Will ensure:
 *  * experimental flag is false and has always been false or null
 *
 */

export default class CheckExperimentalFlagInfoGenerator implements IProjectInfoGenerator {
  id = "EXPFLAG";
  title = "Check Experimental Flag";

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(CheckExperimentalFlagInfoGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.flagIsOrWasTrue = infoSet.getSummedDataValue(this.id, CheckExperimentalFlagInfoGeneratorTest.flagIsOrWasTrue);
    info.levelDatNotFound = infoSet.getSummedDataValue(
      this.id,
      CheckExperimentalFlagInfoGeneratorTest.levelDatNotFound
    );
    info.worldNotFound = infoSet.getSummedDataValue(this.id, CheckExperimentalFlagInfoGeneratorTest.worldNotFound);
  }

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    const projItems = project.getItemsCopy();

    for (const item of projItems) {
      if (
        item.itemType !== ProjectItemType.MCWorld &&
        item.itemType !== ProjectItemType.MCTemplate &&
        item.itemType !== ProjectItemType.worldFolder &&
        item.itemType !== ProjectItemType.levelDat &&
        item.itemType !== ProjectItemType.levelDatOld
      ) {
        continue;
      }

      const mcworld = await MCWorld.ensureOnItem(item);
      if (!mcworld) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.warning,
            this.id,
            CheckExperimentalFlagInfoGeneratorTest.worldNotFound,
            "Could not load world.",
            item
          )
        );
        continue;
      }

      await mcworld.load();
      await mcworld.loadData(false);

      if (!mcworld.levelData) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.warning,
            this.id,
            CheckExperimentalFlagInfoGeneratorTest.levelDatNotFound,
            "Could not load world file.",
            item
          )
        );
        continue;
      }

      if (mcworld.levelData.experimentalGameplay === true || mcworld.levelData.experimentsEverUsed === true) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.warning,
            this.id,
            CheckExperimentalFlagInfoGeneratorTest.flagIsOrWasTrue,
            "Experimental gameplay is or was enabled in this world. Marketplace submissions cannot use experimental features.",
            item
          )
        );
      }
    }

    return items;
  }
}

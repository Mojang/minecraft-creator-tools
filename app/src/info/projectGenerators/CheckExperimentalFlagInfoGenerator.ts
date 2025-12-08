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
import { WorldLevelDat } from "../../index.lib";
import Utilities from "../../core/Utilities";

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
    info.experimentalFlagIsOrWasTrue = infoSet.getSummedDataValue(
      this.id,
      CheckExperimentalFlagInfoGeneratorTest.flagIsOrWasTrue
    );
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

      let levelDat = undefined;

      if (
        item.itemType === ProjectItemType.MCWorld ||
        item.itemType === ProjectItemType.MCTemplate ||
        item.itemType === ProjectItemType.worldFolder
      ) {
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

        await mcworld.loadMetaFiles();

        if (!mcworld.levelData) {
          items.push(
            new ProjectInfoItem(
              InfoItemType.warning,
              this.id,
              CheckExperimentalFlagInfoGeneratorTest.levelDatNotFound,
              "Level.dat not found in a broader world file.",
              item
            )
          );
          continue;
        }

        levelDat = mcworld.levelData;
      } else if (item.itemType === ProjectItemType.levelDat || item.itemType === ProjectItemType.levelDatOld) {
        if (!item.isContentLoaded) {
          await item.loadContent();
        }

        if (item.primaryFile && item.primaryFile.content && item.primaryFile.content instanceof Uint8Array) {
          levelDat = new WorldLevelDat();
          levelDat.loadFromNbtBytes(item.primaryFile.content);
        }
      }

      if (levelDat && (levelDat.experimentalGameplay === true || levelDat.experimentsEverUsed === true)) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.warning,
            this.id,
            CheckExperimentalFlagInfoGeneratorTest.flagIsOrWasTrue,
            "Experimental gameplay is or was enabled in this world. Shareable content should not use experimental features.",
            item
          )
        );
      }
    }

    return items;
  }
}

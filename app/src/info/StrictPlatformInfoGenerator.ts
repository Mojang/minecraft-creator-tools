// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import ProjectInfoSet from "./ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import ItemTypeBehaviorDefinition from "../minecraft/ItemTypeBehaviorDefinition";
import ProjectInfoUtilities from "./ProjectInfoUtilities";

export enum StrictPlatformInfoGeneratorTest {
  entityTypeUsesAMinecraftIdentifier = 100,
  entityTypeUsesAMinecraftRuntimeIdentifier = 101,
  itemTypeUsesAMinecraftIdentifier = 104,
}

export default class StrictPlatformInfoGenerator implements IProjectInfoGenerator {
  id = "STRICT";
  title = "Strict Platform Info Generator";

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(StrictPlatformInfoGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const infoItems: ProjectInfoItem[] = [];

    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.itemType === ProjectItemType.entityTypeBehavior) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const bpEntityType = await EntityTypeDefinition.ensureOnFile(pi.file);

          if (bpEntityType) {
            await bpEntityType.load();

            if (bpEntityType && bpEntityType._data && bpEntityType._data.description) {
              const desc = bpEntityType._data.description;

              if (desc.identifier !== undefined && desc.identifier.toLowerCase().startsWith("minecraft:")) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.testCompleteFail,
                    this.id,
                    StrictPlatformInfoGeneratorTest.entityTypeUsesAMinecraftIdentifier,
                    `Uses a minecraft: identifier override`,
                    pi,
                    desc.identifier
                  )
                );
              }

              if (
                desc.runtime_identifier !== undefined &&
                desc.runtime_identifier.toLowerCase !== undefined &&
                desc.runtime_identifier.toLowerCase().startsWith("minecraft:")
              ) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.testCompleteFail,
                    this.id,
                    StrictPlatformInfoGeneratorTest.entityTypeUsesAMinecraftRuntimeIdentifier,
                    `Uses a runtime_identifier override`,
                    pi,
                    desc.runtime_identifier
                  )
                );
              }
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.itemTypeBehavior) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const bpItemType = await ItemTypeBehaviorDefinition.ensureOnFile(pi.file);

          if (bpItemType) {
            await bpItemType.load();

            if (bpItemType && bpItemType.data && bpItemType.data.description) {
              const desc = bpItemType.data.description;

              if (desc.identifier !== undefined && desc.identifier.toLowerCase().startsWith("minecraft:")) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.testCompleteFail,
                    this.id,
                    StrictPlatformInfoGeneratorTest.itemTypeUsesAMinecraftIdentifier,
                    `Uses a minecraft: identifier override`,
                    pi,
                    desc.identifier
                  )
                );
              }
            }
          }
        }
      }
    }

    return infoItems;
  }
}

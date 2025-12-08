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
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import ProjectInfoUtilities from "./ProjectInfoUtilities";

export enum StrictPlatformInfoGeneratorTest {
  entityTypeUsesAMinecraftIdentifier = 100,
  entityTypeUsesAMinecraftRuntimeIdentifier = 101,
  itemTypeUsesAMinecraftIdentifier = 104,
}

export default class StrictPlatformInfoGenerator implements IProjectInfoGenerator {
  id = "STRICT";
  title = "Strict Platform Info Generator";
  canAlwaysProcess = true;

  identifierOverridesAreErrors = false;

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
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const bpEntityType = await EntityTypeDefinition.ensureOnFile(pi.primaryFile);

          if (bpEntityType) {
            await bpEntityType.load();

            if (bpEntityType && bpEntityType._data && bpEntityType._data.description) {
              const desc = bpEntityType._data.description;

              if (desc.identifier !== undefined && desc.identifier.toLowerCase().startsWith("minecraft:")) {
                infoItems.push(
                  new ProjectInfoItem(
                    this.identifierOverridesAreErrors ? InfoItemType.error : InfoItemType.warning,
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
                    this.identifierOverridesAreErrors ? InfoItemType.error : InfoItemType.warning,
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
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const bpItemType = await ItemTypeDefinition.ensureOnFile(pi.primaryFile);

          if (bpItemType) {
            await bpItemType.load();

            if (bpItemType && bpItemType.data && bpItemType.data.description) {
              const desc = bpItemType.data.description;

              if (desc.identifier !== undefined && desc.identifier.toLowerCase().startsWith("minecraft:")) {
                infoItems.push(
                  new ProjectInfoItem(
                    this.identifierOverridesAreErrors ? InfoItemType.error : InfoItemType.warning,
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

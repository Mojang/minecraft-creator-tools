// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import { IProjectInfoTopicData } from "./IProjectInfoGeneratorBase";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import ProjectInfoSet from "./ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";

export default class StrictPlatformInfoGenerator implements IProjectInfoGenerator {
  id = "STRICT";
  title = "Strict Platform Info Generator";

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    switch (topicId) {
      case 100:
        return {
          title: "Uses a minecraft identifier",
        };

      case 101:
        return {
          title: "Uses a minecraft runtime identifier",
        };
    }
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const infoItems: ProjectInfoItem[] = [];

    for (let i = 0; i < project.items.length; i++) {
      const pi = project.items[i];

      if (pi.itemType === ProjectItemType.entityTypeBehaviorJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const bpEntityType = await EntityTypeDefinition.ensureOnFile(pi.file);

          if (bpEntityType) {
            await bpEntityType.load();

            if (
              bpEntityType &&
              bpEntityType.behaviorPackEntityTypeDef &&
              bpEntityType.behaviorPackEntityTypeDef.description
            ) {
              const desc = bpEntityType.behaviorPackEntityTypeDef.description;

              if (desc.identifier !== undefined && desc.identifier.toLowerCase().startsWith("minecraft:")) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.testCompleteFail,
                    this.id,
                    100,
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
                    100,
                    `Uses a runtime_identifier override`,
                    pi,
                    desc.runtime_identifier
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

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { ProjectItemStorageType, ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import { MaxItemTypes } from "../app/IProjectItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import ContentIndex from "../core/ContentIndex";
import BehaviorManifestDefinition from "../minecraft/BehaviorManifestDefinition";
import { BasicValidators } from "../storage/BasicValidators";

export enum SharingInfoGeneratorTest {
  requiresCustomCapabilities = 100,
  hasStrongLanguageContent = 101,
}

const TopicTestIdBase = 500;

const UnsupportedForSharingTypes = [
  ProjectItemType.textureSetJson,
  ProjectItemType.atmosphericsJson,
  ProjectItemType.shadowsJson,
  ProjectItemType.pbrJson,
  ProjectItemType.pointLightsJson,
  ProjectItemType.waterJson,
  ProjectItemType.colorGradingJson,
  ProjectItemType.lightingJson,
  ProjectItemType.aimAssistJson,
];

export default class SharingInfoGenerator implements IProjectInfoGenerator {
  id = "SHARING";
  title = "Sharing Best Practices Information";
  canAlwaysProcess = true;

  getTopicData(topicId: number) {
    if (topicId >= TopicTestIdBase) {
      return {
        title: ProjectItemUtilities.getDescriptionForType(topicId - TopicTestIdBase),
      };
    }

    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    const itemsByType: { [index: number]: ProjectInfoItem } = {};
    const lineSizeCounts: number[] = [];

    for (let i = 0; i < MaxItemTypes; i++) {
      lineSizeCounts[i] = 0;
    }

    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];
      let projInfoItem = undefined;

      if (pi.storageType === ProjectItemStorageType.singleFile) {
        await pi.ensureFileStorage();

        if (pi.availableFile) {
          let strongLanguageContent = await BasicValidators.hasStrongLanguageContent(pi.availableFile);
          if (strongLanguageContent) {
            projInfoItem = new ProjectInfoItem(
              InfoItemType.error,
              this.id,
              SharingInfoGeneratorTest.hasStrongLanguageContent,
              `Contains strong language content: ` + strongLanguageContent,
              pi
            );
            itemsByType[pi.itemType] = projInfoItem;
            items.push(projInfoItem);
          }
        }
      }

      if (UnsupportedForSharingTypes.includes(pi.itemType)) {
        projInfoItem = new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          TopicTestIdBase + pi.itemType,
          ProjectItemUtilities.getDescriptionForType(pi.itemType) +
            " is not supported for sharing - probably because this item is still an experimental feature.",
          pi
        );
        itemsByType[pi.itemType] = projInfoItem;
        items.push(projInfoItem);
      } else if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
        await pi.ensureFileStorage();

        if (pi.availableFile) {
          const bpManifest = await BehaviorManifestDefinition.ensureOnFile(pi.availableFile);

          if (bpManifest) {
            await bpManifest.load();

            if (bpManifest && bpManifest.definition && bpManifest.definition.capabilities) {
              projInfoItem = new ProjectInfoItem(
                InfoItemType.error,
                this.id,
                SharingInfoGeneratorTest.requiresCustomCapabilities,
                `Declares a custom capabilities requirement, which is not recommended for sharing.`,
                pi,
                JSON.stringify(bpManifest.definition.capabilities, null, 2)
              );
              itemsByType[pi.itemType] = projInfoItem;
              items.push(projInfoItem);
            }
          }
        }
      }
    }

    return items;
  }
}

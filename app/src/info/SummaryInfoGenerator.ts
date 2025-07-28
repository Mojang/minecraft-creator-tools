// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import ProjectInfoSet from "./ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import { constants } from "../core/Constants";
import { ProjectItemType } from "../app/IProjectItemData";
import ResourceManifestDefinition from "../minecraft/ResourceManifestDefinition";
import BehaviorManifestDefinition from "../minecraft/BehaviorManifestDefinition";
import { InfoItemType } from "./IInfoItemData";

export interface ISummaryInfoGeneratorResults {
  size: number;
  fileCounts: number;
  folderCounts: number;
  contentSize: number;
  contentFileCounts: number;
  contentFolderCounts: number;
}

export enum SummaryInfoGeneratorTest {
  resourceManifest = 101,
  behaviorManifest = 102,
}

export default class SummaryInfoGenerator implements IProjectInfoGenerator {
  id = "SUMMARY";
  title = "Summary Information";
  canAlwaysProcess = true;

  performAddOnValidations = false;

  getTopicData(topicId: number) {
    return {
      title: "",
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.mctoolsVersion = MinecraftUtilities.getVersionNumber(constants.version);

    let typesInUse: string[] = [];

    const typesInUseSet = new Set<string>();

    const resourceFeatureMeasures = infoSet.getFeaturesWithInstances(
      this.id,
      SummaryInfoGeneratorTest.resourceManifest
    );

    for (const resourceFeatureMeasure of resourceFeatureMeasures) {
      if (resourceFeatureMeasure === "pbr") {
        info.capabilities.push("vvcompat");
      }

      if (!info.capabilities.includes(resourceFeatureMeasure)) {
        info.capabilities.push(resourceFeatureMeasure);
      }
    }

    const behaviorFeatureMeasures = infoSet.getFeaturesWithInstances(
      this.id,
      SummaryInfoGeneratorTest.behaviorManifest
    );

    for (const behaviorFeatureMeasure of behaviorFeatureMeasures) {
      if (!info.capabilities.includes(behaviorFeatureMeasure)) {
        info.capabilities.push(behaviorFeatureMeasure);
      }
    }

    if (infoSet.project) {
      const itemsCopy = infoSet.project.getItemsCopy();
      for (const item of itemsCopy) {
        const typeDesc = ProjectItemUtilities.getDescriptionForType(item.itemType);

        if (item.itemType === ProjectItemType.behaviorPackManifestJson) {
          if (!info.capabilities.includes("behaviorPack")) {
            info.capabilities.push("behaviorPack");
          }
        } else if (item.itemType === ProjectItemType.resourcePackManifestJson) {
          if (!info.capabilities.includes("resourcePack")) {
            info.capabilities.push("resourcePack");
          }
        } else if (item.itemType === ProjectItemType.skinPackManifestJson) {
          if (!info.capabilities.includes("skinPack")) {
            info.capabilities.push("skinPack");
          }
        } else if (item.itemType === ProjectItemType.js) {
          if (!info.capabilities.includes("scripting")) {
            info.capabilities.push("scripting");
          }
        } else if (item.itemType === ProjectItemType.tickJson) {
          if (!info.capabilities.includes("tickJson")) {
            info.capabilities.push("tickJson");
          }
        } else if (item.itemType === ProjectItemType.MCFunction) {
          if (!info.capabilities.includes("functions")) {
            info.capabilities.push("functions");
          }
        } else if (item.itemType === ProjectItemType.animationBehaviorJson) {
          if (!info.capabilities.includes("behaviorAnimations")) {
            info.capabilities.push("behaviorAnimations");
          }
        } else if (ProjectItemUtilities.isVibrantVisualsRelated(item)) {
          if (!info.capabilities.includes("vvfiles")) {
            info.capabilities.push("vvfiles");
          }
        }

        if (!typesInUseSet.has(typeDesc)) {
          typesInUse.push(typeDesc);
          typesInUseSet.add(typeDesc);
        }
      }
    }

    typesInUse.sort();

    info.itemTypes = typesInUse;
  }

  // this should run after every other summarize pass has happened.
  summarizePhase2(info: any, infoSet: ProjectInfoSet) {
    let hasCameraJson = false;

    if (infoSet.project) {
      for (const item of infoSet.project.items) {
        if (item.itemType === ProjectItemType.cameraBehaviorJson) {
          hasCameraJson = true;
          break; // Early exit once found
        }
      }
    }

    const commands = info.commands;
    const apisUsed = info.apisUsed;
    const capabilitiesSet = new Set(info.capabilities);

    if (hasCameraJson || commands.includes("camera") || apisUsed.includes("setCamera")) {
      if (!capabilitiesSet.has("camera")) {
        info.capabilities.push("camera");
      }
    }

    info.capabilities.sort();
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const itemsCopy = project.getItemsCopy();
    const items: ProjectInfoItem[] = [];

    const resourceManifestPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      SummaryInfoGeneratorTest.resourceManifest,
      "Resource Manifests"
    );

    items.push(resourceManifestPi);

    const behaviorManifestPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      SummaryInfoGeneratorTest.behaviorManifest,
      "Behavior Manifests"
    );

    items.push(behaviorManifestPi);

    for (const item of itemsCopy) {
      if (item.itemType === ProjectItemType.behaviorPackManifestJson) {
        const manifestFile = item.primaryFile;

        if (!manifestFile) {
          continue;
        }

        const manifest = await BehaviorManifestDefinition.ensureOnFile(manifestFile);

        if (!manifest) {
          continue;
        }

        if (manifest.capabilities) {
          for (const capability of manifest.capabilities) {
            behaviorManifestPi.incrementFeature(capability);
          }
        }
      } else if (item.itemType === ProjectItemType.resourcePackManifestJson) {
        const manifestFile = item.primaryFile;

        if (!manifestFile) {
          continue;
        }

        const manifest = await ResourceManifestDefinition.ensureOnFile(manifestFile);

        if (!manifest) {
          continue;
        }

        if (manifest.capabilities) {
          for (const capability of manifest.capabilities) {
            resourceManifestPi.incrementFeature(capability);
          }
        }
      }
    }

    return items;
  }
}

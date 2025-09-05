// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import IAddonManifest, { IResourcePackManifest } from "../minecraft/IAddonManifest";
import ProjectInfoSet from "./ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import StorageUtilities from "../storage/StorageUtilities";
import Utilities from "../core/Utilities";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import ProjectInfoUtilities from "./ProjectInfoUtilities";

const MemoryTierBase = 40;

export enum PackInfoGeneratorTest {
  behaviorPackName = 104,
  behaviorPackDescription = 105,
  behaviorPackId = 106,
  behaviorPackMinEngineVersion = 107,
  behaviorPackUuid = 108,
  behaviorPackManifest = 109,
  resourcePackMinEngineVersion = 111,
  resourcePackUuid = 112,
  resourcePackManifest = 113,
  resourcePackName = 114,
  resourcePackDescription = 115,
  resourcePackId = 116,
  resourcePackFormatVersion = 117,
  subPacks = 118,
  resourcePackIcon = 121,
  behaviorPackIcon = 122,
  skinPackIcon = 123,
  subpackTiers = 245,
}

export default class PackInfoGenerator implements IProjectInfoGenerator {
  id = "PACK";
  title = "General info";
  canAlwaysProcess = true;

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.defaultBehaviorPackUuid = infoSet.getFirstStringValue(this.id, PackInfoGeneratorTest.behaviorPackUuid);

    info.defaultIcon = infoSet.getFirstStringValue(this.id, PackInfoGeneratorTest.resourcePackIcon);

    if (info.defaultIcon === undefined) {
      info.defaultIcon = infoSet.getFirstStringValue(this.id, PackInfoGeneratorTest.behaviorPackIcon);
    }

    // because it's heavy, remove pack icon from this list of issues. Though the summarize op is probably
    // the wrong place to do this.
    infoSet.removeItems(this.id, [PackInfoGeneratorTest.resourcePackIcon, PackInfoGeneratorTest.behaviorPackIcon]);

    info.defaultBehaviorPackMinEngineVersion = infoSet.getFirstNumberArrayValueAsVersionString(
      this.id,
      PackInfoGeneratorTest.behaviorPackMinEngineVersion
    );

    info.minBehaviorPackMinEngineVersionString = infoSet.getMinNumberArrayValueAsVersionString(
      this.id,
      PackInfoGeneratorTest.behaviorPackMinEngineVersion
    );

    info.minBehaviorPackMinEngineVersion = MinecraftUtilities.getVersionNumber(
      info.minBehaviorPackMinEngineVersionString
    );

    info.defaultBehaviorPackName = infoSet.getFirstNumberArrayValueAsVersionString(
      this.id,
      PackInfoGeneratorTest.behaviorPackName
    );

    info.defaultBehaviorPackDescription = infoSet.getFirstNumberArrayValueAsVersionString(
      this.id,
      PackInfoGeneratorTest.behaviorPackDescription
    );

    info.defaultResourcePackUuid = infoSet.getFirstStringValue(this.id, PackInfoGeneratorTest.resourcePackUuid);

    info.defaultResourcePackMinEngineVersion = infoSet.getFirstNumberArrayValueAsVersionString(
      this.id,
      PackInfoGeneratorTest.resourcePackMinEngineVersion
    );

    info.minResourcePackMinEngineVersionString = infoSet.getMinNumberArrayValueAsVersionString(
      this.id,
      PackInfoGeneratorTest.resourcePackMinEngineVersion
    );

    info.minResourcePackMinEngineVersion = MinecraftUtilities.getVersionNumber(
      info.minResourcePackMinEngineVersionString
    );

    info.defaultResourcePackName = infoSet.getFirstNumberArrayValueAsVersionString(
      this.id,
      PackInfoGeneratorTest.resourcePackName
    );

    info.defaultResourcePackDescription = infoSet.getFirstNumberArrayValueAsVersionString(
      this.id,
      PackInfoGeneratorTest.resourcePackDescription
    );

    info.subpackCount = infoSet.getFirstNumberDataValue(this.id, PackInfoGeneratorTest.subPacks);
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const memoryTiersPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      PackInfoGeneratorTest.subpackTiers,
      "Entity Geometry"
    );

    const items: ProjectInfoItem[] = [memoryTiersPi];

    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.itemType === ProjectItemType.packIconImage) {
        const itemFile = pi.primaryFile;
        if (itemFile) {
          if (
            StorageUtilities.getBaseFromName(itemFile.name) === "pack_icon" &&
            StorageUtilities.getTypeFromName(itemFile.name) === "png"
          ) {
            if (!itemFile.isContentLoaded) {
              await itemFile.loadContent(false);
            }

            if (itemFile.content && typeof itemFile.content !== "string") {
              let index = PackInfoGeneratorTest.resourcePackIcon;

              if (MinecraftUtilities.pathLooksLikeBehaviorPackName(itemFile.storageRelativePath)) {
                index = PackInfoGeneratorTest.behaviorPackIcon;
              } else if (MinecraftUtilities.pathLooksLikeSkinPackName(itemFile.storageRelativePath)) {
                index = PackInfoGeneratorTest.skinPackIcon;
              }

              items.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  index,
                  ProjectInfoUtilities.getTitleFromEnum(PackInfoGeneratorTest, index),
                  pi,
                  Utilities.uint8ArrayToBase64(itemFile.content)
                )
              );
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
        const obj = (await pi.getJsonObject()) as IAddonManifest;

        if (obj) {
          items.push(
            new ProjectInfoItem(
              InfoItemType.info,
              this.id,
              PackInfoGeneratorTest.behaviorPackManifest,
              ProjectInfoUtilities.getTitleFromEnum(PackInfoGeneratorTest, PackInfoGeneratorTest.behaviorPackManifest),
              pi
            )
          );

          if (obj.format_version) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                PackInfoGeneratorTest.behaviorPackMinEngineVersion,
                ProjectInfoUtilities.getTitleFromEnum(
                  PackInfoGeneratorTest,
                  PackInfoGeneratorTest.behaviorPackMinEngineVersion
                ),
                pi,
                obj.format_version
              )
            );
          }

          if (obj.header) {
            if (obj.header.uuid) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  PackInfoGeneratorTest.behaviorPackUuid,
                  ProjectInfoUtilities.getTitleFromEnum(PackInfoGeneratorTest, PackInfoGeneratorTest.behaviorPackUuid),
                  pi,
                  obj.header.uuid
                )
              );
            }

            if (obj.header.uuid && obj.header.version) {
              if (obj.header.version.length === 3) {
                items.push(
                  new ProjectInfoItem(
                    InfoItemType.info,
                    this.id,
                    PackInfoGeneratorTest.behaviorPackId,
                    ProjectInfoUtilities.getTitleFromEnum(PackInfoGeneratorTest, PackInfoGeneratorTest.behaviorPackId),
                    pi,
                    obj.header.uuid +
                      "|" +
                      obj.header.version[0] +
                      "." +
                      obj.header.version[1] +
                      "." +
                      obj.header.version[2]
                  )
                );
              }
            }

            if (obj.header.name) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  PackInfoGeneratorTest.behaviorPackName,
                  ProjectInfoUtilities.getTitleFromEnum(PackInfoGeneratorTest, PackInfoGeneratorTest.behaviorPackName),
                  pi,
                  project.loc.getExpandedValue(obj.header.name)
                )
              );
            }

            if (obj.header.description) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  PackInfoGeneratorTest.behaviorPackDescription,
                  ProjectInfoUtilities.getTitleFromEnum(
                    PackInfoGeneratorTest,
                    PackInfoGeneratorTest.behaviorPackDescription
                  ),
                  pi,
                  project.loc.getExpandedValue(obj.header.description)
                )
              );
            }

            if (obj.header.min_engine_version) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  PackInfoGeneratorTest.behaviorPackMinEngineVersion,
                  ProjectInfoUtilities.getTitleFromEnum(
                    PackInfoGeneratorTest,
                    PackInfoGeneratorTest.behaviorPackMinEngineVersion
                  ),
                  pi,
                  obj.header.min_engine_version
                )
              );
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.resourcePackManifestJson) {
        const obj = (await pi.getJsonObject()) as IResourcePackManifest;

        if (obj) {
          items.push(
            new ProjectInfoItem(
              InfoItemType.info,
              this.id,
              PackInfoGeneratorTest.resourcePackManifest,
              ProjectInfoUtilities.getTitleFromEnum(PackInfoGeneratorTest, PackInfoGeneratorTest.resourcePackManifest),
              pi
            )
          );

          if (obj.subpacks) {
            if (Array.isArray(obj.subpacks)) {
              items.push(new ProjectInfoItem(InfoItemType.info, this.id, 18, "Subpacks", pi, obj.subpacks.length));

              for (const sp of obj.subpacks) {
                if (sp.memory_tier) {
                  memoryTiersPi.spectrumIntFeature("Memory Tier", sp.memory_tier);

                  items.push(
                    new ProjectInfoItem(
                      InfoItemType.info,
                      this.id,
                      MemoryTierBase + sp.memory_tier,
                      "Subpack Memory Tier " + sp.memory_tier,
                      pi,
                      sp.name
                    )
                  );
                }
              }
            }
          }

          if (obj.format_version) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                PackInfoGeneratorTest.resourcePackFormatVersion,
                ProjectInfoUtilities.getTitleFromEnum(
                  PackInfoGeneratorTest,
                  PackInfoGeneratorTest.resourcePackFormatVersion
                ),
                pi,
                obj.format_version
              )
            );
          }

          if (obj.header) {
            if (obj.header.uuid) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  PackInfoGeneratorTest.resourcePackUuid,
                  ProjectInfoUtilities.getTitleFromEnum(PackInfoGeneratorTest, PackInfoGeneratorTest.resourcePackUuid),
                  pi,
                  obj.header.uuid
                )
              );
            }
            if (obj.header.uuid && obj.header.version) {
              if (obj.header.version.length === 3) {
                items.push(
                  new ProjectInfoItem(
                    InfoItemType.info,
                    this.id,
                    PackInfoGeneratorTest.resourcePackId,
                    ProjectInfoUtilities.getTitleFromEnum(PackInfoGeneratorTest, PackInfoGeneratorTest.resourcePackId),
                    pi,
                    obj.header.uuid +
                      "|" +
                      obj.header.version[0] +
                      "." +
                      obj.header.version[1] +
                      "." +
                      obj.header.version[2]
                  )
                );
              }
            }

            if (obj.header.name) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  PackInfoGeneratorTest.resourcePackName,
                  ProjectInfoUtilities.getTitleFromEnum(PackInfoGeneratorTest, PackInfoGeneratorTest.resourcePackName),
                  pi,
                  project.loc.getExpandedValue(obj.header.name)
                )
              );
            }

            if (obj.header.description) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  PackInfoGeneratorTest.resourcePackDescription,
                  ProjectInfoUtilities.getTitleFromEnum(
                    PackInfoGeneratorTest,
                    PackInfoGeneratorTest.resourcePackDescription
                  ),
                  pi,
                  project.loc.getExpandedValue(obj.header.description)
                )
              );
            }

            if (obj.header.min_engine_version) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  PackInfoGeneratorTest.resourcePackMinEngineVersion,
                  ProjectInfoUtilities.getTitleFromEnum(
                    PackInfoGeneratorTest,
                    PackInfoGeneratorTest.resourcePackMinEngineVersion
                  ),
                  pi,
                  obj.header.min_engine_version
                )
              );
            }
          }
        }
      }
    }

    return items;
  }
}

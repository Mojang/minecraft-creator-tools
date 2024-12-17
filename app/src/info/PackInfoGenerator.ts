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
  behaviorPackMinEngineVersion = 1,
  behaviorPackUuid = 2,
  behaviorPackManfiest = 3,
  behaviorPackName = 4,
  behaviorPackDescription = 5,
  behaviorPackId = 6,
  resourcePackMinEngineVersion = 11,
  resourcePackUuid = 12,
  resourcePackManifest = 13,
  resourcePackName = 14,
  resourcePackDescription = 15,
  resourcePackId = 16,
  resourcePackFormatVersion = 17,
  subPacks = 18,
  resourcePackIcon = 21,
  behaviorPackIcon = 22,
  skinPackIcon = 23,
  subpackTier1Count = 41,
  subpackTier2Count = 42,
  subpackTier3Count = 43,
  subpackTier4Count = 44,
}

export default class PackInfoGenerator implements IProjectInfoGenerator {
  id = "PACK";
  title = "General info";

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

    info.defaultBehaviorPackMinEngineVersion = infoSet.getFirstNumberArrayValue(
      this.id,
      PackInfoGeneratorTest.behaviorPackMinEngineVersion
    );
    info.defaultBehaviorPackName = infoSet.getFirstNumberArrayValue(this.id, PackInfoGeneratorTest.behaviorPackName);
    info.defaultBehaviorPackDescription = infoSet.getFirstNumberArrayValue(
      this.id,
      PackInfoGeneratorTest.behaviorPackDescription
    );
    info.defaultResourcePackUuid = infoSet.getFirstStringValue(this.id, PackInfoGeneratorTest.resourcePackUuid);
    info.defaultResourcePackMinEngineVersion = infoSet.getFirstNumberArrayValue(
      this.id,
      PackInfoGeneratorTest.resourcePackMinEngineVersion
    );
    info.defaultResourcePackName = infoSet.getFirstNumberArrayValue(this.id, PackInfoGeneratorTest.resourcePackName);
    info.defaultResourcePackDescription = infoSet.getFirstNumberArrayValue(
      this.id,
      PackInfoGeneratorTest.resourcePackDescription
    );

    info.subpackCount = infoSet.getFirstNumberValue(this.id, PackInfoGeneratorTest.subPacks);

    info.subpackTier1Count = infoSet.getCount(this.id, PackInfoGeneratorTest.subpackTier1Count);
    info.subpackTier2Count = infoSet.getCount(this.id, PackInfoGeneratorTest.subpackTier2Count);
    info.subpackTier3Count = infoSet.getCount(this.id, PackInfoGeneratorTest.subpackTier3Count);
    info.subpackTier4Count = infoSet.getCount(this.id, PackInfoGeneratorTest.subpackTier4Count);
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.itemType === ProjectItemType.iconImage) {
        if (pi.file) {
          if (
            StorageUtilities.getBaseFromName(pi.file.name) === "pack_icon" &&
            StorageUtilities.getTypeFromName(pi.file.name) === "png"
          ) {
            await pi.file.loadContent(false);

            if (pi.file.content && typeof pi.file.content !== "string") {
              let index = PackInfoGeneratorTest.resourcePackIcon;

              if (MinecraftUtilities.pathLooksLikeBehaviorPackName(pi.file.storageRelativePath)) {
                index = PackInfoGeneratorTest.behaviorPackIcon;
              } else if (MinecraftUtilities.pathLooksLikeSkinPackName(pi.file.storageRelativePath)) {
                index = PackInfoGeneratorTest.skinPackIcon;
              }

              items.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  index,
                  ProjectInfoUtilities.getTitleFromEnum(PackInfoGeneratorTest, index),
                  pi,
                  Utilities.uint8ArrayToBase64(pi.file.content)
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
              PackInfoGeneratorTest.behaviorPackManfiest,
              ProjectInfoUtilities.getTitleFromEnum(PackInfoGeneratorTest, PackInfoGeneratorTest.behaviorPackManfiest),
              pi,
              obj
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
              pi,
              obj
            )
          );

          if (obj.subpacks) {
            if (Array.isArray(obj.subpacks)) {
              items.push(new ProjectInfoItem(InfoItemType.info, this.id, 18, "Subpacks", pi, obj.subpacks.length));

              for (const sp of obj.subpacks) {
                if (sp.memory_tier) {
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

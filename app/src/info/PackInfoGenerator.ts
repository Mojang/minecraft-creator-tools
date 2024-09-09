// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import IAddonManifest from "../minecraft/IAddonManifest";
import ProjectInfoSet from "./ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import StorageUtilities from "../storage/StorageUtilities";
import Utilities from "../core/Utilities";

export default class PackInformationGenerator implements IProjectInfoGenerator {
  id = "PACK";
  title = "General info";

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.defaultBehaviorPackUuid = infoSet.getFirstStringValue("PACK", 2);
    info.defaultIcon = infoSet.getFirstStringValue("PACK", 21);

    if (info.defaultIcon === undefined) {
      info.defaultIcon = infoSet.getFirstStringValue("PACK", 22);
    }

    // because it's heavy, remove pack icon from this list of issues. Though the summarize op is probably
    // the wrong place to do this.
    infoSet.removeItems("PACK", [21, 22]);

    info.defaultBehaviorPackMinEngineVersion = infoSet.getFirstNumberArrayValue("PACK", 1);
    info.defaultBehaviorPackName = infoSet.getFirstNumberArrayValue("PACK", 4);
    info.defaultBehaviorPackDescription = infoSet.getFirstNumberArrayValue("PACK", 5);
    info.defaultResourcePackUuid = infoSet.getFirstStringValue("PACK", 12);
    info.defaultResourcePackMinEngineVersion = infoSet.getFirstNumberArrayValue("PACK", 11);
    info.defaultResourcePackName = infoSet.getFirstNumberArrayValue("PACK", 14);
    info.defaultResourcePackDescription = infoSet.getFirstNumberArrayValue("PACK", 15);
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
              let index = 21;
              let description = "Resource pack icon";

              if (
                pi.file.storageRelativePath.indexOf("behavior") >= 0 ||
                pi.file.storageRelativePath.indexOf("bp") >= 0
              ) {
                index = 22;
                description = "Behavior pack icon";
              }

              items.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  index,
                  description,
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
          items.push(new ProjectInfoItem(InfoItemType.info, this.id, 3, "Behavior pack manifest", pi, obj));

          if (obj.format_version) {
            items.push(
              new ProjectInfoItem(InfoItemType.info, this.id, 1, "Behavior pack format version", pi, obj.format_version)
            );
          }

          if (obj.header) {
            if (obj.header.uuid) {
              items.push(new ProjectInfoItem(InfoItemType.info, this.id, 2, "Behavior pack UUID", pi, obj.header.uuid));
            }

            if (obj.header.uuid && obj.header.version) {
              if (obj.header.version.length === 3) {
                items.push(
                  new ProjectInfoItem(
                    InfoItemType.info,
                    this.id,
                    6,
                    "Behavior pack Id",
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
                  4,
                  "Behavior pack name",
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
                  5,
                  "Behavior pack description",
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
                  1,
                  "Behavior pack min_engine version",
                  pi,
                  obj.header.min_engine_version
                )
              );
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.resourcePackManifestJson) {
        const obj = (await pi.getJsonObject()) as IAddonManifest;

        if (obj) {
          items.push(new ProjectInfoItem(InfoItemType.info, this.id, 13, "Resource pack manifest", pi, obj));

          if (obj.format_version) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                10,
                "Resource pack format version",
                pi,
                obj.format_version
              )
            );
          }

          if (obj.header) {
            if (obj.header.uuid) {
              items.push(
                new ProjectInfoItem(InfoItemType.info, this.id, 12, "Resource pack UUID", pi, obj.header.uuid)
              );
            }
            if (obj.header.uuid && obj.header.version) {
              if (obj.header.version.length === 3) {
                items.push(
                  new ProjectInfoItem(
                    InfoItemType.info,
                    this.id,
                    16,
                    "Resource pack Id",
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
                  14,
                  "Resource pack name",
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
                  15,
                  "Resource pack description",
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
                  11,
                  "Behavior pack min_engine version",
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

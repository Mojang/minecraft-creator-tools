import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import IAddonManifest from "../minecraft/IAddonManifest";

export default class PackInformationGenerator implements IProjectInfoGenerator {
  id = "PACK";
  title = "General info";

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    for (let i = 0; i < project.items.length; i++) {
      const pi = project.items[i];

      if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
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

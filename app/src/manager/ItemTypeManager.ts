// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../info/ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "../info/IProjectInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "../info/IInfoItemData";
import Database from "../minecraft/Database";
import IProjectUpdater from "../updates/IProjectUpdater";
import ProjectUpdateResult from "../updates/ProjectUpdateResult";
import { UpdateResultType } from "../updates/IUpdateResult";
import { IProjectInfoTopicData } from "../info/IProjectInfoGeneratorBase";
import ProjectInfoSet from "../info/ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import ItemTypeBehaviorDefinition from "../minecraft/ItemTypeBehaviorDefinition";
import ProjectInfoUtilities from "../info/ProjectInfoUtilities";

export enum ItemTypeUpdate {
  UpdateFormatVersionToLatest = 1,
}

export enum ItemTypeInfo {
  Identifier = 53,
  Metadata = 54,
  FormatVersionDefined = 100,
  FormatVersionMajorVersionLowerThanCurrent = 110,
  FormatVersionMajorVersionHigherThanCurrent = 111,
  FormatVersionMinorVersionLowerThanCurrent = 120,
  FormatVersionMinorVersionHigherThanCurrent = 121,
  FormatVersionPatchVersionLowerThanCurrent = 130,
  FormatVersionPatchVersionHigherThanCurrent = 131,
  FailedToRetrieveLatestMinecraftVersion = 500,
  FailedToParseLatestMinecraftVersion = 501,
}

export default class ItemTypeManager implements IProjectInfoGenerator, IProjectUpdater {
  id = "ITEMTYPE";
  title = "Item Type";

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    const formatVersion = {
      updaterId: this.id,
      updaterIndex: ItemTypeUpdate.UpdateFormatVersionToLatest,
      action: "Set behavior pack item type format version to latest version.",
    };

    const title = ProjectInfoUtilities.getTitleFromEnum(ItemTypeInfo, topicId);

    switch (topicId) {
      case ItemTypeInfo.FormatVersionMajorVersionLowerThanCurrent:
      case ItemTypeInfo.FormatVersionMajorVersionHigherThanCurrent:
      case ItemTypeInfo.FormatVersionMinorVersionLowerThanCurrent:
      case ItemTypeInfo.FormatVersionMinorVersionHigherThanCurrent:
      case ItemTypeInfo.FormatVersionPatchVersionLowerThanCurrent:
      case ItemTypeInfo.FormatVersionPatchVersionHigherThanCurrent:
        return {
          title: title,
          updaters: [formatVersion],
        };
    }

    return {
      title: title,
    };
  }

  getUpdaterData(updaterId: number) {
    return {
      title: updaterId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const infoItems: ProjectInfoItem[] = [];

    const ver = await Database.getLatestVersionInfo(project.effectiveTrack);

    if (!ver) {
      infoItems.push(
        new ProjectInfoItem(InfoItemType.internalProcessingError, this.id, 500, "Could not retrieve version.")
      );
      return infoItems;
    }

    const verSplit = ver.split(".");
    if (verSplit.length < 3 || verSplit.length > 4) {
      infoItems.push(
        new ProjectInfoItem(
          InfoItemType.internalProcessingError,
          this.id,
          ItemTypeInfo.FailedToRetrieveLatestMinecraftVersion,
          "Could not latest product retrieve version.",
          undefined,
          ver
        )
      );
      return infoItems;
    }

    const piiIdentifier = new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 3, "Item Type Identifier");
    const piiCategory = new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 4, "Item Type Category");

    infoItems.push(piiIdentifier);

    infoItems.push(piiCategory);

    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.itemType === ProjectItemType.itemTypeBehavior) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const bpItemType = await ItemTypeBehaviorDefinition.ensureOnFile(pi.file);

          if (bpItemType) {
            await bpItemType.load();

            if (bpItemType && bpItemType.data && bpItemType.data.description) {
              const desc = bpItemType.data.description;

              if (desc.identifier !== undefined && desc.identifier.toLowerCase().startsWith("minecraft:")) {
                piiIdentifier.incrementFeature(desc.identifier.toLowerCase());
              } else {
                piiIdentifier.incrementFeature("(no override identifier)");
              }

              if (desc.category) {
                if (desc.category.startsWith("minecraft:") || desc.category.indexOf(":") <= 0) {
                  piiCategory.incrementFeature(desc.category);
                }
              }
            } else {
              piiCategory.incrementFeature("Item Type without description");
            }

            const fv = bpItemType.getFormatVersion();

            if (!bpItemType || !bpItemType.wrapper || !bpItemType.wrapper.format_version || !fv) {
              infoItems.push(
                new ProjectInfoItem(InfoItemType.error, this.id, 100, "Item Type does not define a format_version.", pi)
              );
            } else {
              if (fv.length > 0 && fv[0] < parseInt(verSplit[0])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.recommendation,
                    this.id,
                    ItemTypeInfo.FormatVersionMajorVersionLowerThanCurrent,
                    "Behavior pack Item Type format version (" +
                      fv.join(".") +
                      ") has a lower major version number compared to current version (" +
                      ver +
                      ")",
                    pi
                  )
                );
              } else if (fv[0] > parseInt(verSplit[0])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    ItemTypeInfo.FormatVersionMajorVersionHigherThanCurrent,
                    "Behavior pack Item Type format version (" +
                      fv.join(".") +
                      ") has a higher major version number compared to current version (" +
                      ver +
                      ")",
                    pi
                  )
                );
              } else if (fv[1] < parseInt(verSplit[1]) - 1) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.recommendation,
                    this.id,
                    ItemTypeInfo.FormatVersionMinorVersionLowerThanCurrent,
                    "Behavior pack Item Type format version (" +
                      fv.join(".") +
                      ") has a lower minor version number compared to the current version or the previous current minor version (" +
                      ver +
                      ")",
                    pi
                  )
                );
              } else if (fv[1] > parseInt(verSplit[1])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    ItemTypeInfo.FormatVersionMinorVersionHigherThanCurrent,
                    "Behavior pack Item Type format version (" +
                      fv.join(".") +
                      ") has a higher minor version number compared to current version (" +
                      ver +
                      ")",
                    pi
                  )
                );
              } else if (fv[2] < parseInt(verSplit[2])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.recommendation,
                    this.id,
                    ItemTypeInfo.FormatVersionPatchVersionLowerThanCurrent,
                    "Behavior pack item type format version (" +
                      fv.join(".") +
                      ") has a lower patch version number compared to current version (" +
                      ver +
                      ")",
                    pi
                  )
                );
              } else if (fv[2] > parseInt(verSplit[2]) && fv[1] === parseInt(verSplit[1])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    ItemTypeInfo.FormatVersionPatchVersionHigherThanCurrent,
                    "Behavior pack item type format version (" +
                      fv.join(".") +
                      ") has a higher patch version number compared to current version (" +
                      ver +
                      ")",
                    pi
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

  async update(project: Project, updateId: number): Promise<ProjectUpdateResult[]> {
    const results: ProjectUpdateResult[] = [];

    switch (updateId) {
      case ItemTypeUpdate.UpdateFormatVersionToLatest:
        const localResults = await this.updateFormatVersionToLatestVersion(project);

        results.push(...localResults);
        break;
    }

    return results;
  }

  getUpdateIds() {
    return [ItemTypeUpdate.UpdateFormatVersionToLatest];
  }

  async updateFormatVersionToLatestVersion(project: Project) {
    const results: ProjectUpdateResult[] = [];

    const ver = await Database.getLatestVersionInfo(project.effectiveTrack);

    if (!ver) {
      results.push(
        new ProjectUpdateResult(UpdateResultType.internalProcessingError, this.id, 199, "Could not retrieve version.")
      );

      return results;
    }

    const verSplit = ver.split(".");
    if (verSplit.length < 3 || verSplit.length > 4) {
      results.push(
        new ProjectUpdateResult(
          UpdateResultType.internalProcessingError,
          this.id,
          200,
          "Could not retrieve latest product version.",
          undefined,
          ver
        )
      );
      return results;
    }

    const major = parseInt(verSplit[0]);
    const minor = parseInt(verSplit[1]);
    const patch = parseInt(verSplit[2]);

    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const wtManifest = await ItemTypeBehaviorDefinition.ensureOnFile(pi.file);

          if (wtManifest) {
            const mev = wtManifest.wrapper?.format_version;

            if (mev) {
              const mevY = mev?.split(".");

              if (
                mevY &&
                (mevY.length < 3 ||
                  mevY.length > 4 ||
                  parseInt(mevY[0]) !== major ||
                  parseInt(mevY[1]) !== minor ||
                  parseInt(mevY[2]) !== patch)
              ) {
                wtManifest.setBehaviorPackFormatVersion(major + "." + minor + "." + patch);
                wtManifest.persist();

                results.push(
                  new ProjectUpdateResult(
                    UpdateResultType.updatedFile,
                    this.id,
                    200,
                    "Updated behavior pack Item Type manager format_version to '" +
                      major +
                      "." +
                      minor +
                      "." +
                      patch +
                      "'.",
                    pi,
                    ver
                  )
                );
              }
            }
          }
        }
      }
    }

    return results;
  }
}

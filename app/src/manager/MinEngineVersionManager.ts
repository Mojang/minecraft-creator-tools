// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../info/ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "../info/IProjectInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "../info/IInfoItemData";
import BehaviorManifestDefinition from "../minecraft/BehaviorManifestDefinition";
import Database from "../minecraft/Database";
import IProjectUpdater from "../updates/IProjectUpdater";
import ProjectUpdateResult from "../updates/ProjectUpdateResult";
import ResourceManifestDefinition from "../minecraft/ResourceManifestDefinition";
import { UpdateResultType } from "../updates/IUpdateResult";
import { IProjectInfoTopicData } from "../info/IProjectInfoGeneratorBase";
import ProjectInfoSet from "../info/ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";

export default class MinEngineVersionManager implements IProjectInfoGenerator, IProjectUpdater {
  id = "MINENGINEVER";
  title = "Min Engine Version";

  performPlatformVersionValidations: boolean = false;

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    const updateMinEngineVersion = {
      updaterId: this.id,
      updaterIndex: 1,
      action: "Set min_engine_version to latest version.",
    };

    switch (topicId) {
      case 100:
        return {
          title: "Behavior Pack Min Engine Version Defined",
        };

      case 110:
        return {
          title: "Behavior Pack Min Engine Version Major Version Lower than Current",
          updaters: [updateMinEngineVersion],
        };

      case 111:
        return {
          title: "Behavior Pack Min Engine Version Major Version Higher than Current",
          updaters: [updateMinEngineVersion],
        };

      case 120:
        return {
          title: "Behavior Pack Min Engine Version Minor Version Lower than Current",
          updaters: [updateMinEngineVersion],
        };

      case 121:
        return {
          title: "Behavior Pack Min Engine Version Minor Version Higher than Current",
          updaters: [updateMinEngineVersion],
        };

      case 130:
        return {
          title: "Behavior Pack Min Engine Version Patch Version Lower than Current",
          updaters: [updateMinEngineVersion],
        };

      case 131:
        return {
          title: "Behavior Pack Min Engine Version Patch Version Higher than Current",
          updaters: [updateMinEngineVersion],
        };

      case 200:
        return {
          title: "Resource Pack Min Engine Version Defined",
        };

      case 210:
        return {
          title: "Resource Pack Min Engine Version Major Version Lower than Current",
          updaters: [updateMinEngineVersion],
        };

      case 211:
        return {
          title: "Resource Pack Min Engine Version Major Version Higher than Current",
          updaters: [updateMinEngineVersion],
        };

      case 220:
        return {
          title: "Resource Pack Min Engine Version Minor Version Lower than Current",
          updaters: [updateMinEngineVersion],
        };

      case 221:
        return {
          title: "Resource Pack Min Engine Version Minor Version Higher than Current",
          updaters: [updateMinEngineVersion],
        };

      case 230:
        return {
          title: "Resource Pack Min Engine Version Patch Version Lower than Current",
          updaters: [updateMinEngineVersion],
        };

      case 231:
        return {
          title: "Resource Pack Min Engine Version Patch Version Higher than Current",
          updaters: [updateMinEngineVersion],
        };

      case 500:
        return {
          title: "Retrieve Latest Minecraft Version",
        };
      case 501:
        return {
          title: "Parse Latest Minecraft Version",
        };
    }
    return {
      title: topicId.toString(),
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

    const ver = await Database.getLatestVersionInfo(false);
    let foundBpManifest = false;
    let foundRpManifest = false;
    let foundError = false;

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
          501,
          "Could not latest product retrieve version.",
          undefined,
          ver
        )
      );
      return infoItems;
    }

    const verShort = verSplit[0] + "." + verSplit[1] + "." + verSplit[2];

    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          foundBpManifest = true;
          const bpManifest = await BehaviorManifestDefinition.ensureOnFile(pi.file);

          if (bpManifest) {
            if (
              !bpManifest.definition ||
              !bpManifest.definition.header ||
              !bpManifest.definition.header.min_engine_version
            ) {
              infoItems.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  100,
                  "Behavior pack manifest does not define a header/min_engine_version.",
                  pi
                )
              );
              foundError = true;
            } else {
              const bpVer = bpManifest?.definition?.header.min_engine_version;

              if (bpVer[0] < parseInt(verSplit[0])) {
                infoItems.push(
                  new ProjectInfoItem(
                    this.performPlatformVersionValidations ? InfoItemType.error : InfoItemType.recommendation,
                    this.id,
                    110,
                    "Behavior pack manifest (" +
                      bpVer.join(".") +
                      ") has a lower major version number compared to current version (" +
                      verShort +
                      ")",
                    pi
                  )
                );
              } else if (bpVer[0] > parseInt(verSplit[0])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    111,
                    "Behavior pack manifest (" +
                      bpVer.join(".") +
                      ") has a higher major version number compared to current version (" +
                      verShort +
                      ")",
                    pi
                  )
                );
                foundError = true;
              } else if (bpVer[1] < parseInt(verSplit[1]) - 1) {
                infoItems.push(
                  new ProjectInfoItem(
                    this.performPlatformVersionValidations ? InfoItemType.error : InfoItemType.recommendation,
                    this.id,
                    120,
                    "Behavior pack manifest (" +
                      bpVer.join(".") +
                      ") has a lower minor version number compared to the current version or the previous current minor version (" +
                      verShort +
                      ")",
                    pi
                  )
                );
              } else if (bpVer[1] > parseInt(verSplit[1])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    121,
                    "Behavior pack manifest (" +
                      bpVer.join(".") +
                      ") has a higher minor version number compared to current version (" +
                      verShort +
                      ")",
                    pi
                  )
                );
                foundError = true;
              } /*else if (bpVer[2] < parseInt(verSplit[2])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.recommendation,
                    this.id,
                    130,
                    "Behavior pack manifest (" +
                      bpVer.join(".") +
                      ") has a lower patch version number compared to current version (" +
                      verShort +
                      ")",
                    pi
                  )
                );
                foundError = true;
              } else if (bpVer[2] > parseInt(verSplit[2])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    131,
                    "Behavior pack manifest (" +
                      bpVer.join(".") +
                      ") has a higher patch version number compared to current version (" +
                      verShort +
                      ")",
                    pi
                  )
                );
                foundError = true;
              }*/
            }
          }
        }
      }

      if (pi.itemType === ProjectItemType.resourcePackManifestJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const rpManifest = await ResourceManifestDefinition.ensureOnFile(pi.file);
          if (rpManifest) {
            foundRpManifest = true;
            if (
              !rpManifest.definition ||
              !rpManifest.definition.header ||
              !rpManifest.definition.header.min_engine_version
            ) {
              infoItems.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  200,
                  "Resource pack manifest does not define a header/min_engine_version.",
                  pi
                )
              );
            } else {
              const rpVer = rpManifest?.definition?.header.min_engine_version;

              if (rpVer[0] < parseInt(verSplit[0])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    210,
                    "Resource pack manifest (" +
                      rpVer.join(".") +
                      ") has a lower major version number compared to current version (" +
                      verShort +
                      ")",
                    pi
                  )
                );
              } else if (rpVer[0] > parseInt(verSplit[0])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    211,
                    "Resource pack manifest (" +
                      rpVer.join(".") +
                      ") has a higher major version number compared to current version (" +
                      verShort +
                      ")",
                    pi
                  )
                );
              } else if (rpVer[1] < parseInt(verSplit[1]) - 1) {
                infoItems.push(
                  new ProjectInfoItem(
                    this.performPlatformVersionValidations ? InfoItemType.error : InfoItemType.recommendation,
                    this.id,
                    220,
                    "Resource pack manifest (" +
                      rpVer.join(".") +
                      ") has a lower minor version number compared to current version or the previous current minor version (" +
                      verShort +
                      ")",
                    pi
                  )
                );
              } else if (rpVer[1] > parseInt(verSplit[1])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    221,
                    "Resource pack manifest (" +
                      rpVer.join(".") +
                      ") has a higher minor version number compared to current version (" +
                      verShort +
                      ")",
                    pi
                  )
                );
              } /*else if (rpVer[2] < parseInt(verSplit[2])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.recommendation,
                    this.id,
                    230,
                    "Resource pack manifest (" +
                      rpVer.join(".") +
                      ") has a lower patch version number compared to current version (" +
                      verShort +
                      ")",
                    pi
                  )
                );
              } else if (rpVer[2] > parseInt(verSplit[2])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    231,
                    "Resource pack manifest (" +
                      rpVer.join(".") +
                      ") has a higher patch version number compared to current version (" +
                      verShort +
                      ")",
                    pi
                  )
                );
              }*/
            }
          }
        }
      }
    }

    if (!foundBpManifest) {
      infoItems.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteSuccess,
          this.id,
          260,
          "No behavior pack manifest was found; min engine version check for BP manifests passes."
        )
      );
    }

    if (!foundRpManifest) {
      infoItems.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteSuccess,
          this.id,
          263,
          "No resource pack manifest was found; min engine version check for RP manifests passes."
        )
      );
    }

    if (foundError) {
      infoItems.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteFail,
          this.id,
          261,
          "Errors found with minimum engine version check."
        )
      );
    } else if (foundError) {
      infoItems.push(
        new ProjectInfoItem(InfoItemType.testCompleteSuccess, this.id, 262, "Min engine version check passes.")
      );
    }

    return infoItems;
  }

  async update(project: Project, updateId: number): Promise<ProjectUpdateResult[]> {
    const results: ProjectUpdateResult[] = [];

    switch (updateId) {
      case 1:
        const localResults = await this.updateMinEngineVersionToLatestVersion(project);

        results.push(...localResults);
        break;
    }

    return results;
  }

  getUpdateIds() {
    return [1];
  }

  async updateMinEngineVersionToLatestVersion(project: Project) {
    const results: ProjectUpdateResult[] = [];

    const ver = await Database.getLatestVersionInfo(false);

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
          const bpManifest = await BehaviorManifestDefinition.ensureOnFile(pi.file);

          if (bpManifest) {
            const mev = bpManifest.minEngineVersion;

            if (!mev || mev.length < 3 || mev.length > 4 || mev[0] !== major || mev[1] !== minor || mev[2] !== patch) {
              bpManifest.setMinEngineVersion([major, minor, patch], project);
              bpManifest.persist();

              results.push(
                new ProjectUpdateResult(
                  UpdateResultType.updatedFile,
                  this.id,
                  200,
                  "Updated behavior pack min_engine_version to '" + major + "." + minor + "." + patch + "'.",
                  pi,
                  ver
                )
              );
            }
          }
        }
      }

      if (pi.itemType === ProjectItemType.resourcePackManifestJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const rpManifest = await ResourceManifestDefinition.ensureOnFile(pi.file);

          if (rpManifest) {
            const mev = rpManifest.minEngineVersion;

            if (!mev || mev.length < 3 || mev.length > 4 || mev[0] !== major || mev[1] !== minor || mev[2] !== patch) {
              rpManifest.setMinEngineVersion([major, minor, patch], project);
              rpManifest.persist();

              results.push(
                new ProjectUpdateResult(
                  UpdateResultType.updatedFile,
                  this.id,
                  201,
                  "Updated resource pack min_engine_version to '" + major + "." + minor + "." + patch + "'.",
                  pi,
                  ver
                )
              );
            }
          }
        }
      }
    }

    return results;
  }
}

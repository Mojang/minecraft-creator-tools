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
import SkinManifestDefinition from "../minecraft/SkinManifestDefinition";
import WorldTemplateManifestDefinition from "../minecraft/WorldTemplateManifestDefinition";
import PersonaManifestDefinition from "../minecraft/PersonaManifestDefinition";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import SemanticVersion from "../core/versioning/SemanticVersion";

export enum MinEngineVersionManagerTest {
  behaviorPackMinEngineVersion = 100,
  behaviorPackMinEngineVersionMajorLowerThanCurrent = 110,
  behaviorPackMinEngineVersionMajorHigherThanCurrent = 111,
  behaviorPackMinEngineVersionMinorLowerThanCurrent = 120,
  behaviorPackMinEngineVersionMinorHigherThanCurrent = 121,
  behaviorPackMinEngineVersionPatchLowerThanCurrent = 130,
  behaviorPackMinEngineVersionPatchHigherThanCurrent = 131,
  noPackManifestFound = 180,
  versionProcessingErrorsFound = 181,
  resourcePackMinEngineVersion = 200,
  resourcePackMinEngineVersionMajorLowerThanCurrent = 210,
  resourcePackMinEngineVersionMajorHigherThanCurrent = 211,
  resourcePackMinEngineVersionMinorLowerThanCurrent = 220,
  resourcePackMinEngineVersionMinorHigherThanCurrent = 221,
  resourcePackMinEngineVersionPatchLowerThanCurrent = 230,
  resourcePackMinEngineVersionPatchHigherThanCurrent = 231,
  retrieveLatestMinecraftVersion = 500,
  parseLatestMinecraftVersion = 501,
}

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
      case MinEngineVersionManagerTest.behaviorPackMinEngineVersion:
        return {
          title: "Behavior Pack Min Engine Version Defined",
        };

      case MinEngineVersionManagerTest.behaviorPackMinEngineVersionMajorLowerThanCurrent:
        return {
          title: "Behavior Pack Min Engine Version Major Version Lower than Current",
          updaters: [updateMinEngineVersion],
        };

      case MinEngineVersionManagerTest.behaviorPackMinEngineVersionMajorHigherThanCurrent:
        return {
          title: "Behavior Pack Min Engine Version Major Version Higher than Current",
          updaters: [updateMinEngineVersion],
        };

      case MinEngineVersionManagerTest.behaviorPackMinEngineVersionMinorLowerThanCurrent:
        return {
          title: "Behavior Pack Min Engine Version Minor Version Lower than Current",
          updaters: [updateMinEngineVersion],
        };

      case MinEngineVersionManagerTest.behaviorPackMinEngineVersionMinorHigherThanCurrent:
        return {
          title: "Behavior Pack Min Engine Version Minor Version Higher than Current",
          updaters: [updateMinEngineVersion],
        };

      case MinEngineVersionManagerTest.behaviorPackMinEngineVersionPatchLowerThanCurrent:
        return {
          title: "Behavior Pack Min Engine Version Patch Version Lower than Current",
          updaters: [updateMinEngineVersion],
        };

      case MinEngineVersionManagerTest.behaviorPackMinEngineVersionPatchHigherThanCurrent:
        return {
          title: "Behavior Pack Min Engine Version Patch Version Higher than Current",
          updaters: [updateMinEngineVersion],
        };

      case MinEngineVersionManagerTest.resourcePackMinEngineVersion:
        return {
          title: "Resource Pack Min Engine Version Defined",
        };

      case MinEngineVersionManagerTest.resourcePackMinEngineVersionMajorLowerThanCurrent:
        return {
          title: "Resource Pack Min Engine Version Major Version Lower than Current",
          updaters: [updateMinEngineVersion],
        };

      case MinEngineVersionManagerTest.resourcePackMinEngineVersionMajorHigherThanCurrent:
        return {
          title: "Resource Pack Min Engine Version Major Version Higher than Current",
          updaters: [updateMinEngineVersion],
        };

      case MinEngineVersionManagerTest.resourcePackMinEngineVersionMinorLowerThanCurrent:
        return {
          title: "Resource Pack Min Engine Version Minor Version Lower than Current",
          updaters: [updateMinEngineVersion],
        };

      case MinEngineVersionManagerTest.resourcePackMinEngineVersionMinorHigherThanCurrent:
        return {
          title: "Resource Pack Min Engine Version Minor Version Higher than Current",
          updaters: [updateMinEngineVersion],
        };

      case MinEngineVersionManagerTest.resourcePackMinEngineVersionPatchLowerThanCurrent:
        return {
          title: "Resource Pack Min Engine Version Patch Version Lower than Current",
          updaters: [updateMinEngineVersion],
        };

      case MinEngineVersionManagerTest.resourcePackMinEngineVersionPatchHigherThanCurrent:
        return {
          title: "Resource Pack Min Engine Version Patch Version Higher than Current",
          updaters: [updateMinEngineVersion],
        };

      case MinEngineVersionManagerTest.retrieveLatestMinecraftVersion:
        return {
          title: "Retrieve Latest Minecraft Version",
        };

      case MinEngineVersionManagerTest.parseLatestMinecraftVersion:
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

    const ver = await Database.getLatestVersionInfo(project.effectiveTrack);
    let foundBpManifest = false;
    let foundRpManifest = false;
    let foundSpManifest = false;
    let foundWorldTemplateManifest = false;
    let foundPersonaManifest = false;

    if (!ver) {
      infoItems.push(
        new ProjectInfoItem(
          InfoItemType.internalProcessingError,
          this.id,
          MinEngineVersionManagerTest.retrieveLatestMinecraftVersion,
          "Could not retrieve version."
        )
      );
      return infoItems;
    }

    const verSplit = ver.split(".");
    if (verSplit.length < 3 || verSplit.length > 4) {
      infoItems.push(
        new ProjectInfoItem(
          InfoItemType.internalProcessingError,
          this.id,
          MinEngineVersionManagerTest.parseLatestMinecraftVersion,
          "Could not process latest product version.",
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
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          foundBpManifest = true;
          const bpManifest = await BehaviorManifestDefinition.ensureOnFile(pi.primaryFile);

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
                  MinEngineVersionManagerTest.behaviorPackMinEngineVersion,
                  "Behavior pack manifest does not define a header/min_engine_version.",
                  pi
                )
              );
            } else {
              infoItems.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  600 + (pi.itemType as number),
                  ProjectItemUtilities.getDescriptionForType(pi.itemType) + " min_engine_version",
                  pi,
                  bpManifest.minEngineVersion
                )
              );

              const sv = SemanticVersion.from(bpManifest.definition.header.min_engine_version);

              if (sv) {
                const bpVer = sv.asArray();

                if (bpVer[0] < parseInt(verSplit[0])) {
                  infoItems.push(
                    new ProjectInfoItem(
                      this.performPlatformVersionValidations ? InfoItemType.error : InfoItemType.recommendation,
                      this.id,
                      MinEngineVersionManagerTest.behaviorPackMinEngineVersionMajorLowerThanCurrent,
                      "Behavior pack manifest (" +
                        bpVer.join(".") +
                        ") has a lower major version number compared to current version",
                      pi
                    )
                  );
                } else if (bpVer[0] > parseInt(verSplit[0])) {
                  infoItems.push(
                    new ProjectInfoItem(
                      InfoItemType.error,
                      this.id,
                      MinEngineVersionManagerTest.behaviorPackMinEngineVersionMajorHigherThanCurrent,
                      "Behavior pack manifest (" +
                        bpVer.join(".") +
                        ") has a higher major version number compared to current version",
                      pi
                    )
                  );
                } else if (bpVer[1] < parseInt(verSplit[1]) - 1) {
                  infoItems.push(
                    new ProjectInfoItem(
                      this.performPlatformVersionValidations ? InfoItemType.error : InfoItemType.recommendation,
                      this.id,
                      MinEngineVersionManagerTest.behaviorPackMinEngineVersionMinorLowerThanCurrent,
                      "Behavior pack manifest (" +
                        bpVer.join(".") +
                        ") has a lower minor version number compared to the current version or the previous current minor version)",
                      pi
                    )
                  );
                } else if (bpVer[1] > parseInt(verSplit[1])) {
                  infoItems.push(
                    new ProjectInfoItem(
                      InfoItemType.error,
                      this.id,
                      MinEngineVersionManagerTest.behaviorPackMinEngineVersionMinorHigherThanCurrent,
                      "Behavior pack manifest (" +
                        bpVer.join(".") +
                        ") has a higher minor version number compared to current version",
                      pi
                    )
                  );
                }
              }
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.resourcePackManifestJson) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const rpManifest = await ResourceManifestDefinition.ensureOnFile(pi.primaryFile);
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
                  MinEngineVersionManagerTest.resourcePackMinEngineVersion,
                  "Resource pack manifest does not define a header/min_engine_version.",
                  pi
                )
              );
            } else {
              infoItems.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  600 + (pi.itemType as number),
                  ProjectItemUtilities.getDescriptionForType(pi.itemType) + " format_version",
                  pi,
                  rpManifest.minEngineVersion
                )
              );

              const sv = SemanticVersion.from(rpManifest.definition.header.min_engine_version);

              if (sv) {
                const rpVer = sv.asArray();

                if (rpVer[0] < parseInt(verSplit[0])) {
                  infoItems.push(
                    new ProjectInfoItem(
                      InfoItemType.error,
                      this.id,
                      MinEngineVersionManagerTest.resourcePackMinEngineVersionMajorLowerThanCurrent,
                      "Resource pack manifest (" +
                        rpVer.join(".") +
                        ") has a lower major version number compared to current version",
                      pi
                    )
                  );
                } else if (rpVer[0] > parseInt(verSplit[0])) {
                  infoItems.push(
                    new ProjectInfoItem(
                      InfoItemType.error,
                      this.id,
                      MinEngineVersionManagerTest.resourcePackMinEngineVersionMajorHigherThanCurrent,
                      "Resource pack manifest (" +
                        rpVer.join(".") +
                        ") has a higher major version number compared to current version",
                      pi
                    )
                  );
                } else if (rpVer[1] < parseInt(verSplit[1]) - 1) {
                  infoItems.push(
                    new ProjectInfoItem(
                      this.performPlatformVersionValidations ? InfoItemType.error : InfoItemType.recommendation,
                      this.id,
                      MinEngineVersionManagerTest.resourcePackMinEngineVersionMinorLowerThanCurrent,
                      "Resource pack manifest (" +
                        rpVer.join(".") +
                        ") has a lower minor version number compared to current version or the previous current minor version",
                      pi
                    )
                  );
                } else if (rpVer[1] > parseInt(verSplit[1])) {
                  infoItems.push(
                    new ProjectInfoItem(
                      InfoItemType.error,
                      this.id,
                      MinEngineVersionManagerTest.resourcePackMinEngineVersionMinorHigherThanCurrent,
                      "Resource pack manifest (" +
                        rpVer.join(".") +
                        ") has a higher minor version number compared to current version",
                      pi
                    )
                  );
                }
              }
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.skinPackManifestJson) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const spManifest = await SkinManifestDefinition.ensureOnFile(pi.primaryFile);

          if (spManifest) {
            foundSpManifest = true;
          }
        }
      } else if (pi.itemType === ProjectItemType.worldTemplateManifestJson) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const wtManifest = await WorldTemplateManifestDefinition.ensureOnFile(pi.primaryFile);

          if (wtManifest) {
            foundWorldTemplateManifest = true;
          }
        }
      } else if (pi.itemType === ProjectItemType.personaManifestJson) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const paManifest = await PersonaManifestDefinition.ensureOnFile(pi.primaryFile);

          if (paManifest) {
            foundPersonaManifest = true;
          }
        }
      }
    }

    if (
      !foundBpManifest &&
      !foundRpManifest &&
      !foundSpManifest &&
      !foundWorldTemplateManifest &&
      !foundPersonaManifest
    ) {
      infoItems.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          MinEngineVersionManagerTest.noPackManifestFound,
          "No resource/behavior/skin pack manifest or world template manifest was found."
        )
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
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const bpManifest = await BehaviorManifestDefinition.ensureOnFile(pi.primaryFile);

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
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const rpManifest = await ResourceManifestDefinition.ensureOnFile(pi.primaryFile);

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

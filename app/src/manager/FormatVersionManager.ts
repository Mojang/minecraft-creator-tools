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
import { IProjectInfoTopicData, IProjectUpdaterReference } from "../info/IProjectInfoGeneratorBase";
import ProjectInfoSet from "../info/ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import ProjectItem from "../app/ProjectItem";
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import RecipeBehaviorDefinition from "../minecraft/RecipeBehaviorDefinition";
import AnimationControllerBehaviorDefinition from "../minecraft/AnimationBehaviorDefinition";
import SpawnRulesBehaviorDefinition from "../minecraft/SpawnRulesBehaviorDefinition";
import AnimationControllerResourceDefinition from "../minecraft/AnimationControllerResourceDefinition";
import AnimationResourceDefinition from "../minecraft/AnimationResourceDefinition";
import AttachableResourceDefinition from "../minecraft/AttachableResourceDefinition";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import FogResourceDefinition from "../minecraft/FogResourceDefinition";
import WorldTemplateManifestDefinition from "../minecraft/WorldTemplateManifestDefinition";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import { isMinorVersionTooOld } from "../core/versioning/MinecraftVersionRules";

export default class FormatVersionManager implements IProjectInfoGenerator, IProjectUpdater {
  id = "FORMATVER";
  title = "Format Version";

  performPlatformVersionValidations: boolean = false;

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    const formatVersion = {
      updaterId: this.id,
      updaterIndex: 1,
      action: "Set format_versions to latest version.",
    };

    const blockTypeCheck = this.getTypeFormatVersionDescriptor(topicId, 110, "Block type", formatVersion);
    if (blockTypeCheck) {
      return blockTypeCheck;
    }

    const itemTypeCheck = this.getTypeFormatVersionDescriptor(topicId, 130, "Item type", formatVersion);
    if (itemTypeCheck) {
      return itemTypeCheck;
    }

    const recipeCheck = this.getTypeFormatVersionDescriptor(topicId, 150, "Recipe", formatVersion);
    if (recipeCheck) {
      return recipeCheck;
    }

    const behaviorAnimationCheck = this.getTypeFormatVersionDescriptor(
      topicId,
      170,
      "Behavior animation",
      formatVersion
    );
    if (behaviorAnimationCheck) {
      return behaviorAnimationCheck;
    }

    const behaviorAnimationControllerCheck = this.getTypeFormatVersionDescriptor(
      topicId,
      190,
      "Behavior animation controller",
      formatVersion
    );
    if (behaviorAnimationControllerCheck) {
      return behaviorAnimationControllerCheck;
    }

    const resourceAnimationCheck = this.getTypeFormatVersionDescriptor(
      topicId,
      210,
      "Resource animation",
      formatVersion
    );
    if (resourceAnimationCheck) {
      return resourceAnimationCheck;
    }

    const resourceAnimationControllerCheck = this.getTypeFormatVersionDescriptor(
      topicId,
      230,
      "Resource animation controller",
      formatVersion
    );
    if (resourceAnimationControllerCheck) {
      return resourceAnimationControllerCheck;
    }

    switch (topicId) {
      case 100:
        return {
          title: "Format Version Defined",
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

  getTypeFormatVersionDescriptor(
    requestedIdentifier: number,
    startIndex: number,
    typeName: string,
    formatVersion: IProjectUpdaterReference
  ) {
    switch (requestedIdentifier) {
      case startIndex:
        return {
          title: typeName + " Version Major Version Lower than Current",
          updaters: [formatVersion],
        };

      case startIndex + 2:
        return {
          title: typeName + " Version Major Version Higher than Current",
          updaters: [formatVersion],
        };

      case startIndex + 4:
        return {
          title: typeName + " Version Minor Version Lower than Current",
          updaters: [formatVersion],
        };

      case startIndex + 6:
        return {
          title: typeName + " Version Minor Version Higher than Current",
          updaters: [formatVersion],
        };

      case startIndex + 8:
        return {
          title: typeName + " Version Patch Version Lower than Current",
          updaters: [formatVersion],
        };

      case startIndex + 10:
        return {
          title: typeName + " Version Patch Version Higher than Current",
          updaters: [formatVersion],
        };
    }

    return undefined;
  }

  getUpdaterData(updaterId: number) {
    return {
      title: updaterId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, content: ContentIndex): Promise<ProjectInfoItem[]> {
    const infoItems: ProjectInfoItem[] = [];

    const ver = await Database.getLatestVersionInfo(project.effectiveTrack);

    if (!ver) {
      infoItems.push(
        new ProjectInfoItem(InfoItemType.internalProcessingError, this.id, 500, "Could not retrieve version.")
      );
      return infoItems;
    }

    const modernGameVersionSplit = ver.split(".");
    if (modernGameVersionSplit.length < 3 || modernGameVersionSplit.length > 4) {
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

    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.itemType === ProjectItemType.blockTypeBehavior) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const btdef = await BlockTypeDefinition.ensureOnFile(pi.primaryFile);

          if (btdef) {
            const ver = btdef.getFormatVersion();

            this.checkVersions(ver, modernGameVersionSplit, infoItems, pi, "Block type", 110);
            infoItems.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                600 + (pi.itemType as number),
                ProjectItemUtilities.getDescriptionForType(pi.itemType) + " format_version",
                pi,
                btdef?.getFormatVersion()
              )
            );
          }
        }
      } else if (pi.itemType === ProjectItemType.itemTypeBehavior) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const itdef = await ItemTypeDefinition.ensureOnFile(pi.primaryFile);

          if (itdef) {
            const ver = itdef.getFormatVersion();

            this.checkVersions(ver, modernGameVersionSplit, infoItems, pi, "Item type", 130);
            infoItems.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                600 + (pi.itemType as number),
                ProjectItemUtilities.getDescriptionForType(pi.itemType) + " format_version",
                pi,
                itdef.getFormatVersion()
              )
            );
          }
        }
      } else if (pi.itemType === ProjectItemType.recipeBehavior) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const rbdef = await RecipeBehaviorDefinition.ensureOnFile(pi.primaryFile);

          if (rbdef) {
            const ver = rbdef.getFormatVersion();

            this.checkVersions(ver, modernGameVersionSplit, infoItems, pi, "Recipe", 150);

            infoItems.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                600 + (pi.itemType as number),
                ProjectItemUtilities.getDescriptionForType(pi.itemType) + " format_version",
                pi,
                rbdef.getFormatVersion()
              )
            );
          }
        }
      } else if (pi.itemType === ProjectItemType.animationBehaviorJson) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const abdef = await AnimationControllerBehaviorDefinition.ensureOnFile(pi.primaryFile);

          if (abdef) {
            const ver = abdef.getFormatVersion();

            this.checkVersions(ver, ["1", "10", "0"], infoItems, pi, "Behavior animation", 170);
            infoItems.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                600 + (pi.itemType as number),
                ProjectItemUtilities.getDescriptionForType(pi.itemType) + " format_version",
                pi,
                abdef.getFormatVersion()
              )
            );
          }
        }
      } else if (pi.itemType === ProjectItemType.animationControllerBehaviorJson) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const abdef = await AnimationControllerBehaviorDefinition.ensureOnFile(pi.primaryFile);

          if (abdef) {
            const ver = abdef.getFormatVersion();

            this.checkVersions(ver, ["1", "10", "0"], infoItems, pi, "Behavior animation controller", 190);

            infoItems.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                600 + (pi.itemType as number),
                ProjectItemUtilities.getDescriptionForType(pi.itemType) + " format_version",
                pi,
                abdef.getFormatVersion()
              )
            );
          }
        }
      } else if (pi.itemType === ProjectItemType.animationResourceJson) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const ardef = await AnimationResourceDefinition.ensureOnFile(pi.primaryFile);

          if (ardef) {
            const ver = ardef.getFormatVersion();

            this.checkVersions(ver, ["1", "10", "0"], infoItems, pi, "Resource animation", 210);

            infoItems.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                600 + (pi.itemType as number),
                ProjectItemUtilities.getDescriptionForType(pi.itemType) + " format_version",
                pi,
                ardef.getFormatVersion()
              )
            );
          }
        }
      } else if (pi.itemType === ProjectItemType.animationControllerResourceJson) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const acrdef = await AnimationControllerResourceDefinition.ensureOnFile(pi.primaryFile);

          if (acrdef) {
            const ver = acrdef.getFormatVersion();

            this.checkVersions(ver, ["1", "10", "0"], infoItems, pi, "Resource animation controller", 230);

            infoItems.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                600 + (pi.itemType as number),
                ProjectItemUtilities.getDescriptionForType(pi.itemType) + " format_version",
                pi,
                acrdef.getFormatVersion()
              )
            );
          }
        }
      } else if (pi.itemType === ProjectItemType.spawnRuleBehavior) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const srbdef = await SpawnRulesBehaviorDefinition.ensureOnFile(pi.primaryFile);

          if (srbdef) {
            const ver = srbdef.getFormatVersion();

            this.checkVersions(ver, ["1", "12", "0"], infoItems, pi, "Spawn rules", 250);

            infoItems.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                600 + (pi.itemType as number),
                ProjectItemUtilities.getDescriptionForType(pi.itemType) + " format_version",
                pi,
                srbdef.getFormatVersion()
              )
            );
          }
        }
      } else if (pi.itemType === ProjectItemType.attachableResourceJson) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const srbdef = await AttachableResourceDefinition.ensureOnFile(pi.primaryFile);

          if (srbdef) {
            const ver = srbdef.getFormatVersion();

            this.checkVersions(ver, ["1", "10", "0"], infoItems, pi, "Attachables", 270, true);
            infoItems.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                600 + (pi.itemType as number),
                ProjectItemUtilities.getDescriptionForType(pi.itemType) + " format_version",
                pi,
                srbdef.getFormatVersion()
              )
            );
          }
        }
      } else if (pi.itemType === ProjectItemType.entityTypeResource) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const etrdef = await EntityTypeResourceDefinition.ensureOnFile(pi.primaryFile);

          if (etrdef) {
            const ver = etrdef.getFormatVersion();

            this.checkVersions(ver, modernGameVersionSplit, infoItems, pi, "Entity type resource", 290);
            infoItems.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                600 + (pi.itemType as number),
                ProjectItemUtilities.getDescriptionForType(pi.itemType) + " format_version",
                pi,
                etrdef.getFormatVersion()
              )
            );
          }
        }
      } else if (pi.itemType === ProjectItemType.fogResourceJson) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const etrdef = await FogResourceDefinition.ensureOnFile(pi.primaryFile);

          if (etrdef) {
            const ver = etrdef.getFormatVersion();

            this.checkVersions(ver, modernGameVersionSplit, infoItems, pi, "Fog resource", 310);

            infoItems.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                600 + (pi.itemType as number),
                ProjectItemUtilities.getDescriptionForType(pi.itemType) + " format_version",
                pi,
                etrdef.getFormatVersion()
              )
            );
          }
        }
      }
    }

    return infoItems;
  }

  checkVersions(
    ver: number[] | undefined,
    currentVersion: string[],
    infoItems: ProjectInfoItem[],
    pi: ProjectItem,
    typeString: string,
    identifierOffset: number,
    allowHigherVersions?: boolean
  ) {
    const verShort = currentVersion[0] + "." + currentVersion[1] + "." + currentVersion[2];

    if (!ver || ver.length !== 3) {
      infoItems.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          identifierOffset,
          typeString + " does not define a format_version.",
          pi
        )
      );
      return true;
    } else {
      if (ver[0] < parseInt(currentVersion[0])) {
        infoItems.push(
          new ProjectInfoItem(
            this.performPlatformVersionValidations ? InfoItemType.error : InfoItemType.recommendation,
            this.id,
            identifierOffset + 2,
            typeString +
              " version (" +
              ver.join(".") +
              ") has a lower major version number compared to the expected version (" +
              verShort +
              ")",
            pi
          )
        );
      } else if (ver[0] > parseInt(currentVersion[0]) && !allowHigherVersions) {
        infoItems.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            identifierOffset + 4,
            typeString +
              " version (" +
              ver.join(".") +
              ") has a higher major version number compared to the expected version (" +
              verShort +
              ")",
            pi
          )
        );
        return true;
      } else if (isMinorVersionTooOld(parseInt(currentVersion[0]), parseInt(currentVersion[1]), ver[1])) {
        infoItems.push(
          new ProjectInfoItem(
            this.performPlatformVersionValidations ? InfoItemType.error : InfoItemType.recommendation,
            this.id,
            identifierOffset + 6,
            typeString +
              " version (" +
              ver.join(".") +
              ") has a lower minor version number compared to the expected version (" +
              verShort +
              ") or its previous minor version",
            pi
          )
        );
      } else if (
        ver[1] > parseInt(currentVersion[1]) &&
        !this.performPlatformVersionValidations &&
        !allowHigherVersions
      ) {
        infoItems.push(
          new ProjectInfoItem(
            InfoItemType.warning,
            this.id,
            identifierOffset + 8,
            typeString +
              " version (" +
              ver.join(".") +
              ") has a higher minor version number compared to the expected version (" +
              verShort +
              ")",
            pi
          )
        );
        return true;
      } else if (ver[2] < parseInt(currentVersion[2])) {
        infoItems.push(
          new ProjectInfoItem(
            InfoItemType.recommendation,
            this.id,
            identifierOffset + 10,
            typeString +
              " version (" +
              ver.join(".") +
              ") has a lower patch version number compared to the expected version (" +
              verShort +
              ")",
            pi
          )
        );
      } else if (
        ver[2] > parseInt(currentVersion[2]) &&
        ver[1] === parseInt(currentVersion[1]) &&
        !this.performPlatformVersionValidations &&
        !allowHigherVersions
      ) {
        infoItems.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            identifierOffset + 12,
            typeString +
              " version (" +
              ver.join(".") +
              ") has a higher patch version number compared to the expected version (" +
              verShort +
              ")",
            pi
          )
        );
        return true;
      }
    }
    return false;
  }

  async update(project: Project, updateId: number): Promise<ProjectUpdateResult[]> {
    const results: ProjectUpdateResult[] = [];

    switch (updateId) {
      case 1:
        const localResults = await this.updateBaseGameVersionToLatestVersion(project);

        results.push(...localResults);
        break;
    }

    return results;
  }

  getUpdateIds() {
    return [1];
  }

  async updateBaseGameVersionToLatestVersion(project: Project) {
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

      if (pi.itemType === ProjectItemType.worldTemplateManifestJson) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const wtManifest = await WorldTemplateManifestDefinition.ensureOnFile(pi.primaryFile);

          if (wtManifest) {
            const mev = wtManifest.baseGameVersion;

            if (!mev || mev.length < 3 || mev.length > 4 || mev[0] !== major || mev[1] !== minor || mev[2] !== patch) {
              wtManifest.setBaseGameVersion([major, minor, patch], project);
              wtManifest.persist();

              results.push(
                new ProjectUpdateResult(
                  UpdateResultType.updatedFile,
                  this.id,
                  200,
                  "Updated world template base_game_version to '" + major + "." + minor + "." + patch + "'.",
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

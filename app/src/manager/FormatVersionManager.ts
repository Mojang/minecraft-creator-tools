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
import BlockTypeBehaviorDefinition from "../minecraft/BlockTypeBehaviorDefinition";
import ProjectItem from "../app/ProjectItem";
import ItemTypeBehaviorDefinition from "../minecraft/ItemTypeBehaviorDefinition";
import RecipeBehaviorDefinition from "../minecraft/RecipeBehaviorDefinition";
import AnimationControllerBehaviorDefinition from "../minecraft/AnimationBehaviorDefinition";
import SpawnRulesBehaviorDefinition from "../minecraft/SpawnRulesBehaviorDefinition";
import AnimationControllerResourceDefinition from "../minecraft/AnimationControllerResourceDefinition";
import AnimationResourceDefinition from "../minecraft/AnimationResourceDefinition";
import AttachableResourceDefinition from "../minecraft/AttachableResourceDefinition";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import FogResourceDefinition from "../minecraft/FogResourceDefinition";
import WorldTemplateManifestDefinition from "../minecraft/WorldTemplateManifestDefinition";

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
    let foundError = false;

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
        await pi.ensureFileStorage();

        if (pi.file) {
          const btdef = await BlockTypeBehaviorDefinition.ensureOnFile(pi.file);

          if (btdef) {
            const ver = btdef.getFormatVersion();

            if (this.checkVersions(ver, modernGameVersionSplit, infoItems, pi, "Block type", 110)) {
              foundError = true;
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.itemTypeBehavior) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const itdef = await ItemTypeBehaviorDefinition.ensureOnFile(pi.file);

          if (itdef) {
            const ver = itdef.getFormatVersion();

            if (this.checkVersions(ver, modernGameVersionSplit, infoItems, pi, "Item type", 130)) {
              foundError = true;
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.recipeBehavior) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const rbdef = await RecipeBehaviorDefinition.ensureOnFile(pi.file);

          if (rbdef) {
            const ver = rbdef.getFormatVersion();

            if (this.checkVersions(ver, modernGameVersionSplit, infoItems, pi, "Recipe", 150)) {
              foundError = true;
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.animationBehaviorJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const abdef = await AnimationControllerBehaviorDefinition.ensureOnFile(pi.file);

          if (abdef) {
            const ver = abdef.getFormatVersion();

            if (this.checkVersions(ver, ["1", "10", "0"], infoItems, pi, "Behavior animation", 170)) {
              foundError = true;
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.animationControllerBehaviorJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const abdef = await AnimationControllerBehaviorDefinition.ensureOnFile(pi.file);

          if (abdef) {
            const ver = abdef.getFormatVersion();

            if (this.checkVersions(ver, ["1", "10", "0"], infoItems, pi, "Behavior animation controller", 190)) {
              foundError = true;
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.animationResourceJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const ardef = await AnimationResourceDefinition.ensureOnFile(pi.file);

          if (ardef) {
            const ver = ardef.getFormatVersion();

            if (this.checkVersions(ver, ["1", "10", "0"], infoItems, pi, "Resource animation", 210)) {
              foundError = true;
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.animationControllerResourceJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const acrdef = await AnimationControllerResourceDefinition.ensureOnFile(pi.file);

          if (acrdef) {
            const ver = acrdef.getFormatVersion();

            if (this.checkVersions(ver, ["1", "10", "0"], infoItems, pi, "Resource animation controller", 230)) {
              foundError = true;
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.spawnRuleBehavior) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const srbdef = await SpawnRulesBehaviorDefinition.ensureOnFile(pi.file);

          if (srbdef) {
            const ver = srbdef.getFormatVersion();

            if (this.checkVersions(ver, ["1", "12", "0"], infoItems, pi, "Spawn rules", 250)) {
              foundError = true;
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.attachableResourceJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const srbdef = await AttachableResourceDefinition.ensureOnFile(pi.file);

          if (srbdef) {
            const ver = srbdef.getFormatVersion();

            if (this.checkVersions(ver, ["1", "10", "0"], infoItems, pi, "Attachables", 270)) {
              foundError = true;
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.entityTypeResource) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const etrdef = await EntityTypeResourceDefinition.ensureOnFile(pi.file);

          if (etrdef) {
            const ver = etrdef.getFormatVersion();

            if (this.checkVersions(ver, modernGameVersionSplit, infoItems, pi, "Entity type resource", 290)) {
              foundError = true;
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.fogResourceJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const etrdef = await FogResourceDefinition.ensureOnFile(pi.file);

          if (etrdef) {
            const ver = etrdef.getFormatVersion();

            if (this.checkVersions(ver, modernGameVersionSplit, infoItems, pi, "Fog resource", 310)) {
              foundError = true;
            }
          }
        }
      }
    }

    if (foundError) {
      infoItems.push(new ProjectInfoItem(InfoItemType.testCompleteFail, this.id, 461, "Format version check fails."));
    } else if (foundError) {
      infoItems.push(
        new ProjectInfoItem(InfoItemType.testCompleteSuccess, this.id, 462, "Format version check passes.")
      );
    }

    return infoItems;
  }

  checkVersions(
    ver: number[] | undefined,
    currentVersion: string[],
    infoItems: ProjectInfoItem[],
    pi: ProjectItem,
    typeString: string,
    identifierOffset: number
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
              ") has a lower major version number compared to current version (" +
              verShort +
              ")",
            pi
          )
        );
      } else if (ver[0] > parseInt(currentVersion[0])) {
        infoItems.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            identifierOffset + 4,
            typeString +
              " version (" +
              ver.join(".") +
              ") has a higher major version number compared to current version (" +
              verShort +
              ")",
            pi
          )
        );
        return true;
      } else if (ver[1] < parseInt(currentVersion[1]) - 1) {
        infoItems.push(
          new ProjectInfoItem(
            this.performPlatformVersionValidations ? InfoItemType.error : InfoItemType.recommendation,
            this.id,
            identifierOffset + 6,
            typeString +
              " version (" +
              ver.join(".") +
              ") has a lower minor version number compared to the current version or the previous current minor version (" +
              verShort +
              ")",
            pi
          )
        );
      } else if (ver[1] > parseInt(currentVersion[1]) && !this.performPlatformVersionValidations) {
        infoItems.push(
          new ProjectInfoItem(
            InfoItemType.warning,
            this.id,
            identifierOffset + 8,
            typeString +
              " version (" +
              ver.join(".") +
              ") has a higher minor version number compared to current version (" +
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
              ") has a lower patch version number compared to current version (" +
              verShort +
              ")",
            pi
          )
        );
      } else if (
        ver[2] > parseInt(currentVersion[2]) &&
        ver[1] === parseInt(currentVersion[1]) &&
        !this.performPlatformVersionValidations
      ) {
        infoItems.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            identifierOffset + 12,
            typeString +
              " version (" +
              ver.join(".") +
              ") has a higher patch version number compared to current version (" +
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
        await pi.ensureFileStorage();

        if (pi.file) {
          const wtManifest = await WorldTemplateManifestDefinition.ensureOnFile(pi.file);

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

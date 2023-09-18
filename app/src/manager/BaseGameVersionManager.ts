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
import WorldTemplateManifestJson from "../minecraft/WorldTemplateManifestJson";

export default class BaseGameVersionManager implements IProjectInfoGenerator, IProjectUpdater {
  id = "BASEGAMEVER";
  title = "Base Game Version";

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    const baseGameVersion = {
      updaterId: this.id,
      updaterIndex: 1,
      action: "Set base_game_version to latest version.",
    };

    switch (topicId) {
      case 100:
        return {
          title: "World Template Base Game Version Defined",
        };

      case 110:
        return {
          title: "World Template Base Game Version Major Version Lower than Current",
          updaters: [baseGameVersion],
        };

      case 111:
        return {
          title: "World Template Base Game Version Major Version Higher than Current",
          updaters: [baseGameVersion],
        };

      case 120:
        return {
          title: "World Template Base Game Version Minor Version Lower than Current",
          updaters: [baseGameVersion],
        };

      case 121:
        return {
          title: "World Template Base Game Version Minor Version Higher than Current",
          updaters: [baseGameVersion],
        };

      case 130:
        return {
          title: "World Template Base Game Version Patch Version Lower than Current",
          updaters: [baseGameVersion],
        };

      case 131:
        return {
          title: "World Template Base Game Version Patch Version Higher than Current",
          updaters: [baseGameVersion],
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

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const infoItems: ProjectInfoItem[] = [];

    const ver = await Database.getLatestVersionInfo(false);
    let foundWorldTemplate = false;
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

    for (let i = 0; i < project.items.length; i++) {
      const pi = project.items[i];

      if (pi.itemType === ProjectItemType.worldTemplateManifestJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          foundWorldTemplate = true;
          const bpManifest = await WorldTemplateManifestJson.ensureOnFile(pi.file);

          if (bpManifest) {
            if (
              !bpManifest.definition ||
              !bpManifest.definition.header ||
              !bpManifest.definition.header.base_game_version
            ) {
              infoItems.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  100,
                  "World template manifest does not define a header/base_game_version.",
                  pi
                )
              );
              foundError = true;
            } else {
              const bpVer = bpManifest?.definition?.header.base_game_version;

              if (bpVer[0] < parseInt(verSplit[0])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.recommendation,
                    this.id,
                    110,
                    "World template manifest base game version (" +
                      bpVer.join(".") +
                      ") has a lower major version number compared to current version (" +
                      ver +
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
                    "World template manifest base game version (" +
                      bpVer.join(".") +
                      ") has a higher major version number compared to current version (" +
                      ver +
                      ")",
                    pi
                  )
                );
                foundError = true;
              } else if (bpVer[1] < parseInt(verSplit[1]) - 1) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.recommendation,
                    this.id,
                    120,
                    "World template manifest base game version (" +
                      bpVer.join(".") +
                      ") has a lower minor version number compared to the current version or the previous current minor version (" +
                      ver +
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
                    "World template manifest base game version (" +
                      bpVer.join(".") +
                      ") has a higher minor version number compared to current version (" +
                      ver +
                      ")",
                    pi
                  )
                );
                foundError = true;
              } else if (bpVer[2] < parseInt(verSplit[2])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.recommendation,
                    this.id,
                    130,
                    "World template manifest base game version (" +
                      bpVer.join(".") +
                      ") has a lower patch version number compared to current version (" +
                      ver +
                      ")",
                    pi
                  )
                );
              } else if (bpVer[2] > parseInt(verSplit[2]) && bpVer[1] === parseInt(verSplit[1])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    131,
                    "World template manifest base game version (" +
                      bpVer.join(".") +
                      ") has a higher patch version number compared to current version (" +
                      ver +
                      ")",
                    pi
                  )
                );
                foundError = true;
              }
            }
          }
        }
      }
    }

    if (!foundWorldTemplate) {
      infoItems.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteSuccess,
          this.id,
          260,
          "No world template was found; base game version check passes."
        )
      );
    } else if (foundError) {
      infoItems.push(
        new ProjectInfoItem(InfoItemType.testCompleteFail, this.id, 261, "Base game version check fails.")
      );
    } else if (foundError) {
      infoItems.push(
        new ProjectInfoItem(InfoItemType.testCompleteSuccess, this.id, 262, "Base game version check passes.")
      );
    }

    return infoItems;
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

    for (let i = 0; i < project.items.length; i++) {
      const pi = project.items[i];

      if (pi.itemType === ProjectItemType.worldTemplateManifestJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const wtManifest = await WorldTemplateManifestJson.ensureOnFile(pi.file);

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

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
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import ProjectInfoSet from "../info/ProjectInfoSet";

export default class BehaviorPackEntityTypeManager implements IProjectInfoGenerator, IProjectUpdater {
  id = "BPENTITYTYPE";
  title = "Entity Type Behavior Pack";

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    const formatVersion = {
      updaterId: this.id,
      updaterIndex: 1,
      action: "Set behavior pack entity type format to latest version.",
    };

    switch (topicId) {
      case 2:
        return {
          title: "Entity Type Runtime Identifier",
        };
      case 3:
        return {
          title: "Entity Type Identifier",
        };
      case 4:
        return {
          title: "Entity Type Metadata",
        };
      case 100:
        return {
          title: "Behavior Pack Entity Type Format Version defined",
        };

      case 110:
        return {
          title: "Behavior Pack Entity Type Format Version Major Version Lower than Current",
          updaters: [formatVersion],
        };

      case 111:
        return {
          title: "Behavior Pack Entity Type Format Version Major Version Higher than Current",
          updaters: [formatVersion],
        };

      case 120:
        return {
          title: "Behavior Pack Entity Type Format Version Minor Version Lower than Current",
          updaters: [formatVersion],
        };

      case 121:
        return {
          title: "Behavior Pack Entity Type Format Version Minor Version Higher than Current",
          updaters: [formatVersion],
        };

      case 130:
        return {
          title: "Behavior Pack Entity Type Format Version Patch Version Lower than Current",
          updaters: [formatVersion],
        };

      case 131:
        return {
          title: "Behavior Pack Entity Type Format Version Patch Version Higher than Current",
          updaters: [formatVersion],
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

    const piiRuntimeIdentifier = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      2,
      "Entity Type Runtime Identifier"
    );
    const piiIdentifier = new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 3, "Entity Type Identifier");
    const piiMetadata = new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 4, "Entity Type Metadata");

    infoItems.push(piiRuntimeIdentifier);

    infoItems.push(piiIdentifier);

    infoItems.push(piiMetadata);

    for (let i = 0; i < project.items.length; i++) {
      const pi = project.items[i];

      if (pi.itemType === ProjectItemType.entityTypeBehaviorJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          foundWorldTemplate = true;
          const bpEntityType = await EntityTypeDefinition.ensureEntityTypeOnFile(pi.file);

          if (bpEntityType) {
            await bpEntityType.load();

            if (
              bpEntityType &&
              bpEntityType.behaviorPackEntityTypeDef &&
              bpEntityType.behaviorPackEntityTypeDef.description
            ) {
              const desc = bpEntityType.behaviorPackEntityTypeDef.description;

              if (desc.identifier !== undefined && desc.identifier.toLowerCase().startsWith("minecraft:")) {
                piiIdentifier.incrementFeature(desc.identifier.toLowerCase());
              } else {
                piiIdentifier.incrementFeature("(no override identifier)");
              }

              if (
                desc.runtime_identifier !== undefined &&
                desc.runtime_identifier.toLowerCase !== undefined &&
                desc.runtime_identifier.toLowerCase().startsWith("minecraft:")
              ) {
                piiRuntimeIdentifier.incrementFeature(desc.runtime_identifier.toLowerCase());
              } else {
                piiRuntimeIdentifier.incrementFeature("(no runtime identifier)");
              }

              if (desc.is_experimental) {
                piiMetadata.incrementFeature("Experimental Entity Type");
              }

              if (desc.is_spawnable) {
                piiMetadata.incrementFeature("Spawnable Entity Type");
              }

              if (desc.is_summonable) {
                piiMetadata.incrementFeature("Summonable Entity Type");
              }
            } else {
              piiMetadata.incrementFeature("Entity Type without description");
            }

            const fv = bpEntityType.getFormatVersion();
            if (
              !bpEntityType ||
              !bpEntityType.behaviorPackWrapper ||
              !bpEntityType.behaviorPackWrapper.format_version ||
              !fv
            ) {
              infoItems.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  100,
                  "Entity type does not define a format_version.",
                  pi
                )
              );
              foundError = true;
            } else {
              if (fv.length > 0 && fv[0] < parseInt(verSplit[0])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.recommendation,
                    this.id,
                    110,
                    "Behavior pack entity type format version (" +
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
                    111,
                    "Behavior pack entity type format version (" +
                      fv.join(".") +
                      ") has a higher major version number compared to current version (" +
                      ver +
                      ")",
                    pi
                  )
                );
                foundError = true;
              } else if (fv[1] < parseInt(verSplit[1]) - 1) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.recommendation,
                    this.id,
                    120,
                    "Behavior pack entity type format version (" +
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
                    121,
                    "Behavior pack entity type format version (" +
                      fv.join(".") +
                      ") has a higher minor version number compared to current version (" +
                      ver +
                      ")",
                    pi
                  )
                );
                foundError = true;
              } else if (fv[2] < parseInt(verSplit[2])) {
                infoItems.push(
                  new ProjectInfoItem(
                    InfoItemType.recommendation,
                    this.id,
                    130,
                    "Behavior pack entity type format version (" +
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
                    131,
                    "Behavior pack entity type format version (" +
                      fv.join(".") +
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
          "No entity type behavior format version was found; base game version check passes."
        )
      );
    } else if (foundError) {
      infoItems.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteFail,
          this.id,
          261,
          "Behavior pack entity type format version check fails."
        )
      );
    } else if (foundError) {
      infoItems.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteSuccess,
          this.id,
          262,
          "Behavior pack entity type format version check passes."
        )
      );
    }

    return infoItems;
  }

  async update(project: Project, updateId: number): Promise<ProjectUpdateResult[]> {
    const results: ProjectUpdateResult[] = [];

    switch (updateId) {
      case 1:
        const localResults = await this.updateFormatVersionToLatestVersion(project);

        results.push(...localResults);
        break;
    }

    return results;
  }

  getUpdateIds() {
    return [1];
  }

  async updateFormatVersionToLatestVersion(project: Project) {
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

      if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const wtManifest = await EntityTypeDefinition.ensureEntityTypeOnFile(pi.file);

          if (wtManifest) {
            const mev = wtManifest.behaviorPackWrapper?.format_version;

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
                    "Updated behavior pack entity type manager format_version to '" +
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

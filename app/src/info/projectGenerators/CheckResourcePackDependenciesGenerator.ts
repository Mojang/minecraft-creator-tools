import ProjectInfoItem from "../ProjectInfoItem";
import Project from "../../app/Project";
import ProjectInfoSet from "../ProjectInfoSet";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import { InfoItemType } from "../IInfoItemData";
import ProjectInfoUtilities from "../ProjectInfoUtilities";
import { ProjectItemType } from "../../app/IProjectItemData";
import Utilities from "../../core/Utilities";
import ProjectItem from "../../app/ProjectItem";
import BehaviorManifestDefinition from "../../minecraft/BehaviorManifestDefinition";
import ResourceManifestDefinition from "../../minecraft/ResourceManifestDefinition";

export enum CheckResourcePackDependenciesGeneratorTest {
  invalidManifestJson = 101,
  missingResourcePackDependency = 102,
  internalProcessingError = 103,
}

export default class CheckResourcePackDependenciesGenerator implements IProjectInfoGenerator {
  id = "RPDEPENDS";
  title = "Resource Pack Dependencies";
  canAlwaysProcess = true;

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(CheckResourcePackDependenciesGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.invalidManifestJson = infoSet.getSummedDataValue(
      this.id,
      CheckResourcePackDependenciesGeneratorTest.invalidManifestJson
    );

    info.missingResourcePackDependencies = infoSet.getSummedDataValue(
      this.id,
      CheckResourcePackDependenciesGeneratorTest.missingResourcePackDependency
    );

    info.internalProcessingErrors = infoSet.getSummedDataValue(
      this.id,
      CheckResourcePackDependenciesGeneratorTest.internalProcessingError
    );
  }

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    const projItems = project.getItemsCopy();
    const manifestDependencies: { uuid: string; manifestItem: ProjectItem }[] = [];
    const availablePacks: { uuid: string; manifestItem: ProjectItem }[] = [];

    // Loop through once to find and store all uuids of various packs
    for (const item of projItems) {
      if (
        item.itemType !== ProjectItemType.resourcePackManifestJson &&
        item.itemType !== ProjectItemType.behaviorPackManifestJson
      ) {
        continue;
      }

      if (!item.isContentLoaded) {
        await item.loadContent();
      }

      if (!item.primaryFile) {
        continue;
      }

      if (!item.primaryFile.isContentLoaded) {
        await item.primaryFile.loadContent();
      }

      try {
        if (item.itemType === ProjectItemType.resourcePackManifestJson) {
          const resourceManifest = await ResourceManifestDefinition.ensureOnFile(item.primaryFile);

          if (!resourceManifest || !resourceManifest.isLoaded) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.error,
                this.id,
                CheckResourcePackDependenciesGeneratorTest.invalidManifestJson,
                this.getTopicData(CheckResourcePackDependenciesGeneratorTest.invalidManifestJson).title,
                item
              )
            );
            continue;
          }

          if (resourceManifest.id && Utilities.isValidUuid(resourceManifest.id)) {
            availablePacks.push({
              uuid: resourceManifest.id,
              manifestItem: item,
            });
          }

          if (resourceManifest.dependencies) {
            for (const dependency of resourceManifest.dependencies) {
              if (dependency.uuid && typeof dependency.uuid === "string" && Utilities.isValidUuid(dependency.uuid)) {
                manifestDependencies.push({
                  uuid: dependency.uuid,
                  manifestItem: item,
                });
              }
            }
          }
        } else if (item.itemType === ProjectItemType.behaviorPackManifestJson) {
          const behaviorManifest = await BehaviorManifestDefinition.ensureOnFile(item.primaryFile);

          if (!behaviorManifest || !behaviorManifest.isLoaded) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.error,
                this.id,
                CheckResourcePackDependenciesGeneratorTest.invalidManifestJson,
                this.getTopicData(CheckResourcePackDependenciesGeneratorTest.invalidManifestJson).title,
                item
              )
            );
            continue;
          }

          if (behaviorManifest.id && Utilities.isValidUuid(behaviorManifest.id)) {
            availablePacks.push({
              uuid: behaviorManifest.id,
              manifestItem: item,
            });
          }
        }
      } catch (error) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            CheckResourcePackDependenciesGeneratorTest.internalProcessingError,
            `Error processing manifest ${item.name}: ${error}`,
            item
          )
        );
      }
    }

    // Loop through again to check if each dependency exists in available packs
    for (const dependency of manifestDependencies) {
      const foundPack = availablePacks.find((pack) => pack.uuid === dependency.uuid);

      if (!foundPack) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            CheckResourcePackDependenciesGeneratorTest.missingResourcePackDependency,
            `Dependency with uuid [${dependency.uuid}] specified but uuid is not located in any included resource or behavior packs.`,
            dependency.manifestItem
          )
        );
      }
    }

    return items;
  }
}

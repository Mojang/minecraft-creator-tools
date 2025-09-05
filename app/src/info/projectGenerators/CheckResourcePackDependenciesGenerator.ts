import ProjectInfoItem from "../ProjectInfoItem";
import Project from "../../app/Project";
import ProjectInfoSet from "../ProjectInfoSet";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import { InfoItemType } from "../IInfoItemData";
import ProjectInfoUtilities from "../ProjectInfoUtilities";
import { ProjectItemType } from "../../app/IProjectItemData";
import StorageUtilities from "../../storage/StorageUtilities";
import Utilities from "../../core/Utilities";
import ProjectItem from "../../app/ProjectItem";

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

      await item.ensureStorage();
      if (!item.primaryFile) {
        continue;
      }

      await item.primaryFile.loadContent();
      const content = item.primaryFile.content;

      if (!content || typeof content !== "string") {
        continue;
      }

      const parsedContent = StorageUtilities.getJsonObject(item.primaryFile);

      if (!parsedContent) {
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

      // Collect available pack UUIDs from headers
      if (parsedContent.header && parsedContent.header.uuid && typeof parsedContent.header.uuid === "string") {
        if (Utilities.isValidUuid(parsedContent.header.uuid)) {
          availablePacks.push({
            uuid: parsedContent.header.uuid,
            manifestItem: item,
          });
        }
      }

      // Collect dependencies
      if (
        item.itemType === ProjectItemType.resourcePackManifestJson &&
        parsedContent.dependencies &&
        Array.isArray(parsedContent.dependencies)
      ) {
        for (const dependency of parsedContent.dependencies) {
          if (dependency.uuid && typeof dependency.uuid === "string") {
            if (Utilities.isValidUuid(dependency.uuid)) {
              manifestDependencies.push({
                uuid: dependency.uuid,
                manifestItem: item,
              });
            }
          }
        }
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

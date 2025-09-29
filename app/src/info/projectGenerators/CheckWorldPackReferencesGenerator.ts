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
import ResourceManifestDefinition from "../../minecraft/ResourceManifestDefinition";
import BehaviorManifestDefinition from "../../minecraft/BehaviorManifestDefinition";

export enum CheckWorldPackReferencesGeneratorTest {
  invalidWorldPackReferencesJson = 201,
  missingWorldPackReferencesFile = 202,
  invalidPackId = 203,
  missingManifestVersion = 204,
  invalidManifestVersion = 205,
  packReferenceNotFound = 206,
  internalProcessingError = 207,
}

export default class CheckWorldPackReferencesGenerator implements IProjectInfoGenerator {
  id = "WPACKREFS";
  title = "World Pack References";
  canAlwaysProcess = true;

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(CheckWorldPackReferencesGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.invalidWorldPackReferencesJson = infoSet.getSummedDataValue(
      this.id,
      CheckWorldPackReferencesGeneratorTest.invalidWorldPackReferencesJson
    );

    info.missingWorldPackReferencesFile = infoSet.getSummedDataValue(
      this.id,
      CheckWorldPackReferencesGeneratorTest.missingWorldPackReferencesFile
    );

    info.invalidPackIds = infoSet.getSummedDataValue(this.id, CheckWorldPackReferencesGeneratorTest.invalidPackId);

    info.missingManifestVersion = infoSet.getSummedDataValue(
      this.id,
      CheckWorldPackReferencesGeneratorTest.missingManifestVersion
    );

    info.invalidManifestVersion = infoSet.getSummedDataValue(
      this.id,
      CheckWorldPackReferencesGeneratorTest.invalidManifestVersion
    );

    info.packReferencesNotFound = infoSet.getSummedDataValue(
      this.id,
      CheckWorldPackReferencesGeneratorTest.packReferenceNotFound
    );

    info.internalProcessingErrors = infoSet.getSummedDataValue(
      this.id,
      CheckWorldPackReferencesGeneratorTest.internalProcessingError
    );
  }

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    const projItems = project.getItemsCopy();
    const availablePacks: { uuid: string; manifestItem: ProjectItem }[] = [];

    try {
      // First, collect all available pack UUIDs from manifests
      await this.collectAvailablePacks(projItems, availablePacks, items);

      // Check for pack reference files
      for (const item of projItems) {
        if (item.itemType === ProjectItemType.resourcePackListJson) {
          await this.checkPackReferences(item, availablePacks, items);
        } else if (item.itemType === ProjectItemType.behaviorPackListJson) {
          await this.checkPackReferences(item, availablePacks, items);
        }
      }
    } catch (error) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          CheckWorldPackReferencesGeneratorTest.internalProcessingError,
          `Internal processing error: ${error}`,
          undefined
        )
      );
    }

    return items;
  }

  private async collectAvailablePacks(
    projItems: ProjectItem[],
    availablePacks: { uuid: string; manifestItem: ProjectItem }[],
    items: ProjectInfoItem[]
  ): Promise<void> {
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
          if (resourceManifest && resourceManifest.id && Utilities.isValidUuid(resourceManifest.id)) {
            availablePacks.push({
              uuid: resourceManifest.id,
              manifestItem: item,
            });
          }
        } else if (item.itemType === ProjectItemType.behaviorPackManifestJson) {
          const behaviorManifest = await BehaviorManifestDefinition.ensureOnFile(item.primaryFile);
          if (behaviorManifest && behaviorManifest.id && Utilities.isValidUuid(behaviorManifest.id)) {
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
            CheckWorldPackReferencesGeneratorTest.internalProcessingError,
            `Error processing manifest ${item.name}: ${error}`,
            item
          )
        );
      }
    }
  }

  private async checkPackReferences(
    packReferencesFile: ProjectItem,
    availablePacks: { uuid: string; manifestItem: ProjectItem }[],
    items: ProjectInfoItem[]
  ): Promise<void> {
    if (!packReferencesFile.isContentLoaded) {
      await packReferencesFile.loadContent();
    }

    if (!packReferencesFile.primaryFile) {
      return;
    }

    if (!packReferencesFile.primaryFile.isContentLoaded) {
      await packReferencesFile.primaryFile.loadContent();
    }

    const parsedContent = StorageUtilities.getJsonObject(packReferencesFile.primaryFile);

    if (!parsedContent || !Array.isArray(parsedContent)) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          CheckWorldPackReferencesGeneratorTest.invalidWorldPackReferencesJson,
          `Invalid JSON format in ${packReferencesFile.name}. Expected an array of pack references.`,
          packReferencesFile
        )
      );
      return;
    }

    const packRefsFoundInJson: string[] = [];

    // Validate each pack reference object
    for (let i = 0; i < parsedContent.length; i++) {
      const packRef = parsedContent[i];

      if (typeof packRef !== "object" || packRef === null) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            CheckWorldPackReferencesGeneratorTest.invalidWorldPackReferencesJson,
            `Invalid pack reference object at index ${i} in ${packReferencesFile.name}`,
            packReferencesFile
          )
        );
        continue;
      }

      // Validate pack_id
      if (!packRef.pack_id || typeof packRef.pack_id !== "string") {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            CheckWorldPackReferencesGeneratorTest.invalidPackId,
            `Missing or invalid pack_id at index ${i} in ${packReferencesFile.name}`,
            packReferencesFile
          )
        );
        continue;
      }

      if (!Utilities.isValidUuid(packRef.pack_id)) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            CheckWorldPackReferencesGeneratorTest.invalidPackId,
            `Invalid UUID format for pack_id [${packRef.pack_id}] at index ${i} in ${packReferencesFile.name}`,
            packReferencesFile
          )
        );
        continue;
      }

      // Valid pack_id found, add to list
      packRefsFoundInJson.push(packRef.pack_id);

      // Validate version
      const versionValidation = ResourceManifestDefinition.validatePackReferenceVersion(packRef.version);
      if (!versionValidation.isValid) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            CheckWorldPackReferencesGeneratorTest.invalidManifestVersion,
            `${versionValidation.errorMessage} for pack_id [${packRef.pack_id}] at index ${i} in ${packReferencesFile.name}`,
            packReferencesFile
          )
        );
        continue;
      }
    }

    // Check if each referenced pack exists in the available packs
    for (const packRef of packRefsFoundInJson) {
      const foundPack = availablePacks.find((pack) => pack.uuid === packRef);

      if (!foundPack) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            CheckWorldPackReferencesGeneratorTest.packReferenceNotFound,
            `Pack reference [${packRef}] not found in project.`,
            packReferencesFile
          )
        );
      }
    }
  }
}

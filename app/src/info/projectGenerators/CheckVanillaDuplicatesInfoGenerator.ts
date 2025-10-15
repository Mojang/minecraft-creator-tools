// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../ProjectInfoItem";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import { InfoItemType } from "../IInfoItemData";
import ProjectInfoSet from "../ProjectInfoSet";
import ProjectInfoUtilities from "../ProjectInfoUtilities";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import Database from "../../minecraft/Database";
import ContentIndex from "../../core/ContentIndex";

export enum CheckVanillaDuplicatesInfoGeneratorTest {
  completeVanillaCopy = 101,
  partialVanillaCopy = 102,
}

// Files that are allowed to be complete copies of vanilla
const ALLOWLISTED_FILES = ["texts/languages.json"];

// Files that are restricted from being partial copies
const RESTRICTED_FILES = [
  "/ui/",
  "/materials/",
  "models/mobs.json",
  "sounds/sound_definitions.json",
  "textures/item_texture.json",
  "textures/terrain_texture.json",
  "blocks.json",
];

// Extensions to check for partial copies
const EXTENSIONS = [".json", ".material"];

// Message suffix matching C# implementation
const RESOURCE_PACK_SUFFIX = "Vanilla files can be seen at https://aka.ms/resourcepacktemplate.";

/***********
 * Generator for Checking Vanilla Duplicates
 *
 * Will check:
 *  * Complete copies of vanilla files
 *  * Partial copies of vanilla files (for restricted files)
 *
 */

export default class CheckVanillaDuplicatesInfoGenerator implements IProjectInfoGenerator {
  id = "VANDUPES";
  title = "Check Vanilla Duplicates";

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(CheckVanillaDuplicatesInfoGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.completeVanillaCopy = infoSet.getSummedDataValue(
      this.id,
      CheckVanillaDuplicatesInfoGeneratorTest.completeVanillaCopy
    );

    info.partialVanillaCopy = infoSet.getSummedDataValue(
      this.id,
      CheckVanillaDuplicatesInfoGeneratorTest.partialVanillaCopy
    );
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    // Get the hash catalog from the content index
    const hashCatalog = contentIndex.hashCatalog;

    // Load vanilla hash catalog for comparison
    await Database.loadReleaseVanillaInfoHashes();

    const projItems = project.getItemsCopy();

    for (const item of projItems) {
      const itemPath = item.projectPath || "";

      if (ALLOWLISTED_FILES.some((allowedFile) => itemPath.includes(allowedFile))) {
        continue;
      }

      await item.ensureStorage();

      if (!item.primaryFile) {
        continue;
      }

      // Find hashes for this file in the catalog
      const fileHashes = Object.entries(hashCatalog).filter(([hash, details]) => details.filePath === item.projectPath);

      // Check for complete copy of vanilla file (file with empty propertyName)
      const completeFileHash = fileHashes.find(([hash, details]) => details.propertyName === "");
      if (completeFileHash) {
        const completeHashResult = await this.checkCompleteVanillaCopy(completeFileHash[0], item);
        if (completeHashResult) {
          items.push(completeHashResult);
          continue;
        }
      }

      // Check for partial copies (properties with non-empty propertyName)
      if (this.isRestrictedFile(itemPath) && this.hasRestrictedExtension(item.primaryFile.fullPath)) {
        const propertyHashes = fileHashes.filter(([hash, details]) => details.propertyName !== "");
        const partialHashResults = await this.checkPartialVanillaCopy(propertyHashes, item);
        items.push(...partialHashResults);
      }
    }

    return items;
  }

  private isRestrictedFile(filePath: string): boolean {
    return RESTRICTED_FILES.some((restrictedFile) => filePath.includes(restrictedFile));
  }

  private hasRestrictedExtension(filePath: string): boolean {
    // Extract file extension from path
    const extension = "." + filePath.split(".").pop()?.toLowerCase() || "";
    return EXTENSIONS.includes(extension);
  }

  private async checkCompleteVanillaCopy(fileHash: string, item: ProjectItem): Promise<ProjectInfoItem | null> {
    // Check if this hash exists in the vanilla hash catalog

    if (!Database.releaseVanillaContentHashes) {
      return null;
    }

    const vanillaDetails = Database.releaseVanillaContentHashes[fileHash];
    if (vanillaDetails && vanillaDetails.propertyName === "") {
      // This is a complete file match
      return new ProjectInfoItem(
        InfoItemType.warning,
        this.id,
        CheckVanillaDuplicatesInfoGeneratorTest.completeVanillaCopy,
        `Complete copy of a vanilla file [${vanillaDetails.fileName}]. ${RESOURCE_PACK_SUFFIX}`,
        item,
        item.name
      );
    }

    return null;
  }

  private async checkPartialVanillaCopy(
    propertyHashes: [string, any][],
    item: ProjectItem
  ): Promise<ProjectInfoItem[]> {
    const results: ProjectInfoItem[] = [];

    if (!Database.releaseVanillaContentHashes) {
      return results;
    }

    try {
      // Check each property hash from the catalog
      for (const [hash, details] of propertyHashes) {
        // Check if this property hash exists in the vanilla hash catalog
        const vanillaDetails = Database.releaseVanillaContentHashes[hash];

        if (
          vanillaDetails &&
          vanillaDetails.propertyName !== "" &&
          item.name.toLowerCase() === vanillaDetails.fileName.toLowerCase()
        ) {
          results.push(
            new ProjectInfoItem(
              InfoItemType.warning,
              this.id,
              CheckVanillaDuplicatesInfoGeneratorTest.partialVanillaCopy,
              `Partial copy of a vanilla file [${item.name}] at property [${details.propertyName}]. ${RESOURCE_PACK_SUFFIX}`,
              item,
              details.propertyName
            )
          );
        }
      }
    } catch (error) {
      console.error("Error checking partial vanilla copy:", error);
    }

    return results;
  }
}

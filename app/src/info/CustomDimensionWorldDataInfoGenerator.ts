// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import MCWorld from "../minecraft/MCWorld";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import { IGeneratorOptions } from "./ProjectInfoSet";
import Project from "../app/Project";
import ProjectUtilities, { ProjectMetaCategory } from "../app/ProjectUtilities";

const CUSTOM_DIMENSION_ID_START = 1000;

const VanillaIdToString: Record<number, string> = {
  0: "Overworld",
  1: "Nether",
  2: "The End",
};

export enum CustomDimensionWorldDataTest {
  nameIdMappingTableMissing = 101,
  vanillaDimensionChunkData = 102,
  unclaimedDimensionMappings = 103,
}

export default class CustomDimensionWorldDataInfoGenerator implements IProjectInfoItemGenerator {
  id = "CDWORLDDATA";
  title = "Custom Dimension World Data Validation";

  /**
   * Per-project cache for {@link isAddOnContextForWorld}. Avoids re-running
   * the (manifest-reading) meta-category detection on every world item in a
   * multi-world project.
   */
  #addOnContextCache: WeakMap<Project, Promise<boolean>> = new WeakMap();

  /**
   * Rule 102 ("Vanilla Dimension Chunk Data") is meaningful only when the
   * surrounding project is shaped like an add-on. For a standalone world
   * template — or any "general world data" project — Overworld/Nether/End
   * chunk data is normal and expected, not a defect.
   *
   * Delegates to the canonical {@link ProjectUtilities.getMetaCategory}, the
   * shared classifier used elsewhere (e.g. {@link TextureImageInfoGenerator})
   * to gate add-on-only validations. We use `getMetaCategory` rather than
   * `getIsAddon` because the latter excludes any project containing world
   * items — but this generator only ever runs on world items, so that check
   * would always fail. `getMetaCategory` evaluates pack shape independently
   * and returns `worldTemplate` (not `addOn`) when a template manifest is
   * present, which gives us the correct gating for free.
   *
   * Result is cached per Project for the lifetime of the generator instance.
   */
  private async isAddOnContextForWorld(project: Project | undefined): Promise<boolean> {
    if (!project) {
      return false;
    }

    const cached = this.#addOnContextCache.get(project);
    if (cached) {
      return cached;
    }

    const promise = ProjectUtilities.getMetaCategory(project).then((cat) => cat === ProjectMetaCategory.addOn);
    this.#addOnContextCache.set(project, promise);
    return promise;
  }

  getTopicData(topicId: number) {
    switch (topicId) {
      case CustomDimensionWorldDataTest.nameIdMappingTableMissing:
        return {
          title: "Name-ID Mapping Table Missing",
          description:
            "The LevelDB contains custom dimension chunk data but is missing the required DimensionNameIdTable key. " +
            "This table is needed to map dimension names to IDs for correct chunk data association on load.",
        };
      case CustomDimensionWorldDataTest.vanillaDimensionChunkData:
        return {
          title: "Vanilla Dimension Chunk Data",
          description:
            "The LevelDB contains chunk data for vanilla dimensions (Overworld, Nether, or The End). " +
            "Creator content must only include chunk data for custom dimensions (ID >= 1000).",
        };
      case CustomDimensionWorldDataTest.unclaimedDimensionMappings:
        return {
          title: "Unclaimed Dimension Mappings",
          description:
            "The DimensionNameIdTable contains name-ID mappings for dimensions that have no corresponding " +
            "chunk data in the LevelDB. This may indicate incomplete cleanup or leftover development data.",
        };
      default:
        return undefined;
    }
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    const customDimensionErrors = infoSet.getCount(this.id, CustomDimensionWorldDataTest.vanillaDimensionChunkData);
    const nameIdTableMissing = infoSet.getCount(this.id, CustomDimensionWorldDataTest.nameIdMappingTableMissing);
    const unclaimedMappings = infoSet.getCount(this.id, CustomDimensionWorldDataTest.unclaimedDimensionMappings);

    // Only add summary fields when there are actual findings.
    // This avoids adding zero-value fields to validation output for content
    // that has no world data (e.g., add-on packs), keeping existing baselines stable.
    if (customDimensionErrors > 0 || nameIdTableMissing > 0 || unclaimedMappings > 0) {
      info.customDimensionErrors = customDimensionErrors;
      info.nameIdTableMissing = nameIdTableMissing;
      info.unclaimedMappings = unclaimedMappings;
    }
  }

  async generate(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    options?: IGeneratorOptions
  ): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (
      projectItem.itemType !== ProjectItemType.MCWorld &&
      projectItem.itemType !== ProjectItemType.MCTemplate &&
      projectItem.itemType !== ProjectItemType.worldFolder
    ) {
      return items;
    }

    const mcworld: MCWorld | undefined = await MCWorld.ensureOnItem(projectItem);

    if (!mcworld) {
      return items;
    }

    await mcworld.loadLevelDb(false);

    if (!mcworld.levelDb) {
      return items;
    }

    const dimensionIds = mcworld.dimensionIdsInChunks;

    // No chunk data at all — nothing to validate
    if (dimensionIds.size === 0) {
      return items;
    }

    const hasCustomDimChunks = Array.from(dimensionIds).some((id) => id >= CUSTOM_DIMENSION_ID_START);
    const vanillaDimIds = Array.from(dimensionIds).filter((id) => id < CUSTOM_DIMENSION_ID_START);

    // Rule 102: Vanilla dimension chunk data found in LevelDB.
    // Only meaningful when this project is shaped like an add-on that bundles
    // a starter world. World templates and "general world data" projects are
    // expected to contain vanilla chunk data — emitting an error there is a
    // false positive.
    const inAddOnContext = vanillaDimIds.length > 0 ? await this.isAddOnContextForWorld(projectItem.project) : false;

    if (inAddOnContext) {
      for (const dimId of vanillaDimIds) {
        const dimName = VanillaIdToString[dimId] ?? `ID ${dimId}`;

        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            CustomDimensionWorldDataTest.vanillaDimensionChunkData,
            `LevelDB contains chunk data for vanilla dimension '${dimName}' (ID ${dimId}). ` +
              "Creator content must only include chunk data for custom dimensions (ID >= 1000).",
            projectItem,
            dimId
          )
        );
      }
    }

    // Rule 101: DimensionNameIdTable required when custom dimension chunk data is present
    if (hasCustomDimChunks && !mcworld.hasDimensionNameIdTable) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          CustomDimensionWorldDataTest.nameIdMappingTableMissing,
          "LevelDB contains custom dimension chunk data but is missing the required DimensionNameIdTable key. " +
            "This table is needed by Chunker to correctly associate dimension names with their chunk data.",
          projectItem
        )
      );
    }

    // Rule 103: Unclaimed dimension mappings (name-ID entries with no corresponding chunk data)
    const nameIdTable = mcworld.dimensionNameIdTable;

    if (nameIdTable && nameIdTable.size > 0) {
      for (const [dimName, dimId] of nameIdTable) {
        if (!dimensionIds.has(dimId)) {
          items.push(
            new ProjectInfoItem(
              InfoItemType.warning,
              this.id,
              CustomDimensionWorldDataTest.unclaimedDimensionMappings,
              `DimensionNameIdTable contains mapping '${dimName}' -> ID ${dimId} ` +
                "but no corresponding chunk data exists in the LevelDB.",
              projectItem,
              dimName
            )
          );
        }
      }
    }

    return items;
  }
}

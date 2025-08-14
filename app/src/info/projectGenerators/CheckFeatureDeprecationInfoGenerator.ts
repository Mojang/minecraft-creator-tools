// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../ProjectInfoItem";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import { InfoItemType } from "../IInfoItemData";
import ProjectInfoSet from "../ProjectInfoSet";
import ProjectInfoUtilities from "../ProjectInfoUtilities";
import Project from "../../app/Project";
import StorageUtilities from "../../storage/StorageUtilities";

export enum CheckFeatureDeprecationInfoGeneratorTest {
  deprecatedBlockOverride = 101,
  deprecatedTerrainTexture = 102,
  deprecatedTexture = 103,
  jsonParseError = 104,
}

const DEPRECATED_BLOCKS = ["fletching_table", "smithing_table"];

const DEPRECATED_TEXTURES = [
  "smithing_table_top.png",
  "smithing_table_side1.png",
  "smithing_table_side2.png",
  "fletcher_table_top.png",
  "fletcher_table_side1.png",
  "fletcher_table_side2.png",
];

const DEPRECATED_TEXTURE_ENTRIES = [
  "smithing_table_top",
  "smithing_table_side_a",
  "smithing_table_side_b",
  "fletching_table_top",
  "fletching_table_side1",
  "fletching_table_side2",
];

/***********
 * Generator for Checking Feature Deprecation
 *
 * Will check:
 *  * blocks.json for deprecated block overrides (fletching_table, smithing_table)
 *  * terrain_texture.json for deprecated texture entries
 *  * textures/blocks/ folder for deprecated textures
 *
 */

export default class CheckFeatureDeprecationInfoGenerator implements IProjectInfoGenerator {
  id = "CHECKFEATUREDEPRECATION";
  title = "Check Feature Deprecation";

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(CheckFeatureDeprecationInfoGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.deprecatedBlockOverride = infoSet.getSummedDataValue(
      this.id,
      CheckFeatureDeprecationInfoGeneratorTest.deprecatedBlockOverride
    );

    info.deprecatedTerrainTexture = infoSet.getSummedDataValue(
      this.id,
      CheckFeatureDeprecationInfoGeneratorTest.deprecatedTerrainTexture
    );

    info.deprecatedTexture = infoSet.getSummedDataValue(
      this.id,
      CheckFeatureDeprecationInfoGeneratorTest.deprecatedTexture
    );
  }

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    const projItems = project.getItemsCopy();

    for (const item of projItems) {
      if (item.name === "blocks.json") {
        await item.ensureStorage();
        if (!item.primaryFile) {
          continue;
        }

        await item.primaryFile.loadContent();

        const content = item.primaryFile.content;
        if (!content || typeof content !== "string") {
          continue;
        }

        try {
          const parsedContent = StorageUtilities.getJsonObject(item.primaryFile);
          if (parsedContent) {
            for (const deprecatedBlock of DEPRECATED_BLOCKS) {
              if (parsedContent[deprecatedBlock]) {
                items.push(
                  new ProjectInfoItem(
                    InfoItemType.warning,
                    this.id,
                    CheckFeatureDeprecationInfoGeneratorTest.deprecatedBlockOverride,
                    `Entity [${deprecatedBlock}] will be affected in an upcoming client update.`,
                    item,
                    deprecatedBlock
                  )
                );
              }
            }
          }
        } catch (error) {
          items.push(
            new ProjectInfoItem(
              InfoItemType.warning,
              this.id,
              CheckFeatureDeprecationInfoGeneratorTest.jsonParseError,
              `Failed to parse JSON for entity. Error: ${error}`,
              item
            )
          );
        }
      }

      if (item.name === "terrain_texture.json") {
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
        try {
          if (parsedContent) {
            for (const deprecatedTexture of DEPRECATED_TEXTURE_ENTRIES) {
              if (parsedContent.texture_data[deprecatedTexture]) {
                items.push(
                  new ProjectInfoItem(
                    InfoItemType.warning,
                    this.id,
                    CheckFeatureDeprecationInfoGeneratorTest.deprecatedTerrainTexture,
                    `Entity [${deprecatedTexture}] will be affected in an upcoming client update.`,
                    item,
                    deprecatedTexture
                  )
                );
              }
            }
          }
        } catch (error) {
          items.push(
            new ProjectInfoItem(
              InfoItemType.warning,
              this.id,
              CheckFeatureDeprecationInfoGeneratorTest.jsonParseError,
              `Failed to parse JSON for entity. Error: ${error}`,
              item
            )
          );
        }
      }

      if (item.getFolder()?.name === "blocks") {
        if (DEPRECATED_TEXTURES.includes(item.name)) {
          items.push(
            new ProjectInfoItem(
              InfoItemType.warning,
              this.id,
              CheckFeatureDeprecationInfoGeneratorTest.deprecatedTexture,
              `Texture [${item.name}] will be affected in an upcoming client update. Please resubmit with no modifications to this texture.`,
              item,
              item.name
            )
          );
        }
      }
    }

    return items;
  }
}

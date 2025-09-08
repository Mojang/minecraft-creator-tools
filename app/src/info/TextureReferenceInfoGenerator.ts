// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import Project from "../app/Project";
import BlocksCatalogDefinition from "../minecraft/BlocksCatalogDefinition";
import TerrainTextureCatalogDefinition from "../minecraft/TerrainTextureCatalogDefinition";
import ItemTextureCatalogDefinition from "../minecraft/ItemTextureCatalogDefinition";
import ContentIndex, { AnnotationCategory } from "../core/ContentIndex";
import ProjectInfoUtilities from "./ProjectInfoUtilities";

export enum TextureReferenceInfoGeneratorTest {
  textureReferences = 101,
}

export default class TextureReferenceInfoGenerator implements IProjectInfoGenerator {
  id = "TEXTUREREF";
  title = "Texture Reference Info Aggregation";

  performAddOnValidations = false;

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(TextureReferenceInfoGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.textureCount = infoSet.getSummedDataValue(this.id, TextureReferenceInfoGeneratorTest.textureReferences);
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    const textureRefCountPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      TextureReferenceInfoGeneratorTest.textureReferences,
      "Texture References"
    );
    items.push(textureRefCountPi);

    const itemsCopy = project.getItemsCopy();

    for (const projectItem of itemsCopy) {
      if (projectItem.itemType === ProjectItemType.blocksCatalogResourceJson) {
        if (!projectItem.isContentLoaded) {
          await projectItem.loadContent();
        }

        if (projectItem.primaryFile) {
          const blockCat = await BlocksCatalogDefinition.ensureOnFile(projectItem.primaryFile);

          if (blockCat && blockCat.blocksCatalog && projectItem.projectPath) {
            const textureRefs = blockCat.getTextureReferences();

            for (const textureRef of textureRefs) {
              contentIndex.insert(
                textureRef,
                projectItem.projectPath,
                AnnotationCategory.blockTextureReferenceDependent
              );
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.terrainTextureCatalogResourceJson) {
        if (!projectItem.isContentLoaded) {
          await projectItem.loadContent();
        }

        if (projectItem.primaryFile) {
          const blockCat = await TerrainTextureCatalogDefinition.ensureOnFile(projectItem.primaryFile);

          if (blockCat && projectItem.projectPath) {
            const textureRefs = blockCat.getTextureReferences();

            for (const textureRef of textureRefs) {
              contentIndex.insert(textureRef, projectItem.projectPath, AnnotationCategory.blockTextureReferenceSource);
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.itemTextureJson) {
        if (!projectItem.isContentLoaded) {
          await projectItem.loadContent();
        }

        if (projectItem.primaryFile) {
          const itemCat = await ItemTextureCatalogDefinition.ensureOnFile(projectItem.primaryFile);

          if (itemCat && projectItem.projectPath) {
            const textureRefs = itemCat.getTextureReferences();

            for (const textureRef of textureRefs) {
              contentIndex.insert(textureRef, projectItem.projectPath, AnnotationCategory.itemTextureReferenceSource);
            }
          }
        }
      }
    }

    return items;
  }
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import Project from "../app/Project";
import ContentIndex, { AnnotationCategory } from "../core/ContentIndex";
import ProjectInfoUtilities from "./ProjectInfoUtilities";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import BlocksCatalogDefinition from "../minecraft/BlocksCatalogDefinition";

export enum TypesInfoGeneratorTest {
  types = 101,
}

export default class TypesInfoGenerator implements IProjectInfoGenerator {
  id = "TYPES";
  title = "Types Info Aggregation";

  performAddOnValidations = false;

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(TypesInfoGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.textureCount = infoSet.getSummedDataValue(this.id, TypesInfoGeneratorTest.types);
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    const typesCountPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      TypesInfoGeneratorTest.types,
      "Types"
    );
    items.push(typesCountPi);

    const itemsCopy = project.getItemsCopy();

    for (const projectItem of itemsCopy) {
      if (projectItem.itemType === ProjectItemType.entityTypeBehavior) {
        if (!projectItem.isContentLoaded) {
          await projectItem.loadContent();
        }

        if (projectItem.primaryFile) {
          const etd = await EntityTypeDefinition.ensureOnFile(projectItem.primaryFile);

          if (etd && etd.id && projectItem.projectPath) {
            contentIndex.insert(etd.id, projectItem.projectPath, AnnotationCategory.entityTypeSource);
          }
        }
      } else if (projectItem.itemType === ProjectItemType.blockTypeBehavior) {
        if (!projectItem.isContentLoaded) {
          await projectItem.loadContent();
        }

        if (projectItem.primaryFile) {
          const blockTypeDef = await BlockTypeDefinition.ensureOnFile(projectItem.primaryFile);

          if (blockTypeDef && blockTypeDef.id && projectItem.projectPath) {
            contentIndex.insert(blockTypeDef.id, projectItem.projectPath, AnnotationCategory.blockTypeSource);

            let colon = blockTypeDef.id.indexOf(":");

            if (colon >= 0) {
              contentIndex.insert(
                blockTypeDef.id.substring(colon + 1),
                projectItem.projectPath,
                AnnotationCategory.blockTypeSource
              );
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.blocksCatalogResourceJson) {
        if (!projectItem.isContentLoaded) {
          await projectItem.loadContent();
        }

        if (projectItem.primaryFile) {
          const blockCatalog = await BlocksCatalogDefinition.ensureOnFile(projectItem.primaryFile);

          if (blockCatalog && projectItem.projectPath && blockCatalog.blocksCatalog) {
            for (const name in blockCatalog.blocksCatalog) {
              let adjustedName = name;

              let colon = adjustedName.indexOf(":");

              if (colon < 0 && project.isVanillaSourceProject) {
                adjustedName = "minecraft:" + adjustedName;

                contentIndex.insert(adjustedName, projectItem.projectPath, AnnotationCategory.blockTypeSource);
              }

              contentIndex.insert(name, projectItem.projectPath, AnnotationCategory.blockTypeSource);
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.itemTypeBehavior) {
        if (!projectItem.isContentLoaded) {
          await projectItem.loadContent();
        }

        if (projectItem.primaryFile) {
          const itemTypeDef = await ItemTypeDefinition.ensureOnFile(projectItem.primaryFile);

          if (itemTypeDef && itemTypeDef.id && projectItem.projectPath) {
            contentIndex.insert(itemTypeDef.id, projectItem.projectPath, AnnotationCategory.itemTypeSource);
          }
        }
      }
    }

    return items;
  }
}

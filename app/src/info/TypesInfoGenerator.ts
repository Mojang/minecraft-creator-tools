// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import Project from "../app/Project";
import ContentIndex, { AnnotationCategory } from "../core/ContentIndex";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import BlocksCatalogDefinition from "../minecraft/BlocksCatalogDefinition";
import FeatureDefinition from "../minecraft/FeatureDefinition";

export enum TypesInfoGeneratorTest {
  types = 101,
}

/**
 * Aggregates content type information (entities, blocks, items) from the project.
 *
 * @see {@link ../../public/data/forms/mctoolsval/types.form.json} for topic definitions
 */
export default class TypesInfoGenerator implements IProjectInfoGenerator {
  id = "TYPES";
  title = "Types Info Aggregation";

  performAddOnValidations = false;

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
      } else if (projectItem.itemType === ProjectItemType.featureBehavior) {
        if (!projectItem.isContentLoaded) {
          await projectItem.loadContent();
        }

        if (projectItem.primaryFile) {
          const featureDef = await FeatureDefinition.ensureOnFile(projectItem.primaryFile);

          if (featureDef && featureDef.id && projectItem.projectPath) {
            contentIndex.insert(featureDef.id, projectItem.projectPath, AnnotationCategory.featureSource);

            // Also index without namespace prefix for easier lookup
            let colon = featureDef.id.indexOf(":");
            if (colon >= 0) {
              contentIndex.insert(
                featureDef.id.substring(colon + 1),
                projectItem.projectPath,
                AnnotationCategory.featureSource
              );
            }
          }
        }
      }
    }

    return items;
  }
}

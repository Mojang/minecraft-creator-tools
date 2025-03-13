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
import ItemTypeBehaviorDefinition from "../minecraft/ItemTypeBehaviorDefinition";

export enum TypesInfoGeneratorTest {
  types = 1,
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
    info.textureCount = infoSet.getSummedNumberValue(this.id, TypesInfoGeneratorTest.types);
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    const typesCountPi = new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 1, "Types");
    items.push(typesCountPi);

    const itemsCopy = project.getItemsCopy();

    for (const projectItem of itemsCopy) {
      if (projectItem.itemType === ProjectItemType.entityTypeBehavior) {
        await projectItem.ensureFileStorage();

        if (projectItem.file) {
          const etd = await EntityTypeDefinition.ensureOnFile(projectItem.file);

          if (etd && etd.id && projectItem.projectPath) {
            contentIndex.insert(etd.id, projectItem.projectPath, AnnotationCategory.entityTypeSource);
          }
        }
      } else if (projectItem.itemType === ProjectItemType.blockTypeBehavior) {
        await projectItem.ensureFileStorage();

        if (projectItem.file) {
          const blockTypeDef = await BlockTypeDefinition.ensureOnFile(projectItem.file);

          if (blockTypeDef && blockTypeDef.id && projectItem.projectPath) {
            contentIndex.insert(blockTypeDef.id, projectItem.projectPath, AnnotationCategory.blockTypeSource);
          }
        }
      } else if (projectItem.itemType === ProjectItemType.itemTypeBehavior) {
        await projectItem.ensureFileStorage();

        if (projectItem.file) {
          const itemTypeDef = await ItemTypeBehaviorDefinition.ensureOnFile(projectItem.file);

          if (itemTypeDef && itemTypeDef.id && projectItem.projectPath) {
            contentIndex.insert(itemTypeDef.id, projectItem.projectPath, AnnotationCategory.itemTypeSource);
          }
        }
      }
    }

    return items;
  }
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import Project from "../app/Project";
import ContentIndex from "../core/ContentIndex";
import ProjectInfoUtilities from "./ProjectInfoUtilities";
import ModelGeometryDefinition from "../minecraft/ModelGeometryDefinition";

export enum GeometryInfoGeneratorTest {
  blockGeometry = 1,
  entityGeometry = 2,
  itemGeometry = 3,
  overlyComplexBlockGeometry = 501,
}

export default class GeometryInfoGenerator implements IProjectInfoGenerator {
  id = "GEOMETRY";
  title = "Model Geometry Validation";

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(GeometryInfoGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const itemsCopy = project.getItemsCopy();

    const blockGeometryPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      GeometryInfoGeneratorTest.blockGeometry,
      "Block Geometry"
    );

    const entityGeometryPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      GeometryInfoGeneratorTest.entityGeometry,
      "Entity Geometry"
    );

    const itemGeometryPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      GeometryInfoGeneratorTest.itemGeometry,
      "Items Geometry"
    );

    const items: ProjectInfoItem[] = [blockGeometryPi, entityGeometryPi, itemGeometryPi];

    for (const projectItem of itemsCopy) {
      if (projectItem.itemType === ProjectItemType.modelGeometryJson) {
        await projectItem.ensureFileStorage();

        if (projectItem.primaryFile) {
          const srPath = projectItem.primaryFile.storageRelativePath.toLowerCase();
          const modGeo = await ModelGeometryDefinition.ensureOnFile(projectItem.primaryFile);

          if (modGeo && modGeo.definitions) {
            for (const geoDef of modGeo.definitions) {
              if (geoDef.bones) {
                let totalCubes = 0;
                for (const bone of geoDef.bones) {
                  if (bone.cubes) {
                    totalCubes += bone.cubes.length;
                  }
                }

                if (srPath.indexOf("/blocks/") >= 0) {
                  blockGeometryPi.spectrumIntFeature("Cubes", totalCubes);

                  const blockCubeBudget = 50;
                  if (totalCubes > blockCubeBudget) {
                    items.push(
                      new ProjectInfoItem(
                        InfoItemType.warning,
                        this.id,
                        GeometryInfoGeneratorTest.overlyComplexBlockGeometry,
                        `More than ${blockCubeBudget} cubes in custom blocks may lead to degraded performance. Cubes used`,
                        projectItem,
                        totalCubes
                      )
                    );
                  }
                } else if (srPath.indexOf("/items/") >= 0 || srPath.indexOf("/attachable") >= 0) {
                  // note that sometimes this is in /entity, e.g., /entity/attachables, so this check needs to be first
                  itemGeometryPi.spectrumIntFeature("Cubes", totalCubes);
                } else if (srPath.indexOf("/entity/") >= 0) {
                  entityGeometryPi.spectrumIntFeature("Cubes", totalCubes);
                }
              }
            }
          }
        }
      }
    }

    return items;
  }
}

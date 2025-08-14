// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../ProjectInfoItem";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import { InfoItemType } from "../IInfoItemData";
import ProjectInfoSet from "../ProjectInfoSet";
import ProjectInfoUtilities from "../ProjectInfoUtilities";
import Project from "../../app/Project";
import { ProjectItemType } from "../../app/IProjectItemData";
import { IGeometry } from "../../minecraft/IModelGeometry";
import StorageUtilities from "../../storage/StorageUtilities";

export enum CheckGeometryFormatInfoGeneratorTest {
  restrictedPolyMeshFound = 101,
  jsonParseError = 102,
}

/***********
 * Generator for Checking Geometry Format
 *
 * Will check:
 *  * models folder JSON files for restricted "poly_mesh" string if project is not first party
 *
 */

export default class CheckGeometryFormatInfoGenerator implements IProjectInfoGenerator {
  id = "GEOFMT";
  title = "Geometry Format";
  canAlwaysProcess = true;

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(CheckGeometryFormatInfoGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.restrictedPolyMeshFound = infoSet.getSummedDataValue(
      this.id,
      CheckGeometryFormatInfoGeneratorTest.restrictedPolyMeshFound
    );

    info.jsonParseError = infoSet.getSummedDataValue(this.id, CheckGeometryFormatInfoGeneratorTest.jsonParseError);
  }

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    // This restriction is only on content from a 3rd party. poly_mesh is restricted to first party content.
    if (project.isMinecraftCreator === false) {
      const projItems = project.getItemsCopy();

      for (const item of projItems) {
        if (item.itemType === ProjectItemType.modelGeometryJson) {
          await item.ensureStorage();
          if (!item.primaryFile) {
            continue;
          }

          try {
            const jsonData = StorageUtilities.getJsonObject(item.primaryFile);

            if (jsonData && jsonData["minecraft:geometry"]) {
              const geometries: IGeometry[] = Array.isArray(jsonData["minecraft:geometry"])
                ? jsonData["minecraft:geometry"]
                : [jsonData["minecraft:geometry"]];

              for (const geometry of geometries) {
                if (geometry && geometry.bones) {
                  for (const bone of geometry.bones) {
                    if (bone && bone.poly_mesh) {
                      items.push(
                        new ProjectInfoItem(
                          InfoItemType.error,
                          this.id,
                          CheckGeometryFormatInfoGeneratorTest.restrictedPolyMeshFound,
                          `Geometry bone "${
                            bone.name || "unnamed"
                          }" contains poly_mesh definition. This feature is not allowed!`,
                          item,
                          bone.name || "unnamed bone"
                        )
                      );
                    }
                  }
                }
              }
            }
          } catch (error) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.error,
                this.id,
                CheckGeometryFormatInfoGeneratorTest.jsonParseError,
                `Failed to parse JSON for geometry file. Error: ${error}`,
                item
              )
            );
          }
        }
      }
    }

    return items;
  }
}

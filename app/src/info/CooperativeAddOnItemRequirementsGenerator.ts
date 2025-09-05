// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";

import ProjectInfoSet from "./ProjectInfoSet";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import CooperativeAddOnRequirementsGenerator from "./CooperativeAddOnRequirementsGenerator";
import RenderControllerSetDefinition from "../minecraft/RenderControllerSetDefinition";
import ResourceManifestDefinition from "../minecraft/ResourceManifestDefinition";
import ModelGeometryDefinition from "../minecraft/ModelGeometryDefinition";
import Material from "../minecraft/Material";
import ContentIndex from "../core/ContentIndex";
import AnimationResourceDefinition from "../minecraft/AnimationResourceDefinition";
import AnimationBehaviorDefinition from "../minecraft/AnimationBehaviorDefinition";
import AnimationControllerBehaviorDefinition from "../minecraft/AnimationControllerBehaviorDefinition";
import AnimationControllerResourceDefinition from "../minecraft/AnimationControllerResourceDefinition";
import MinecraftDefinitions from "../minecraft/MinecraftDefinitions";
import ProjectInfoUtilities from "./ProjectInfoUtilities";

// rule name/check. For validation errors, name should be a terse description of "your problem"
export enum CooperativeAddOnItemRequirementsGeneratorTest {
  behaviorAnimationControllerIdNotInExpectedForm = 100,
  behaviorAnimationControllerNameNotInExpectedForm = 101,
  behaviorAnimationIdNotInExpectedForm = 110,
  behaviorAnimationNameNotInExpectedForm = 111,
  jsonIdentifierNotInExpectedForm = 112,
  resourceAnimationControllerIdNotInExpectedForm = 120,
  resourceAnimationControllerNameNotInExpectedForm = 121,
  resourceAnimationIdNotInExpectedForm = 130,
  resourceAnimationNameNotInExpectedForm = 131,
  renderControllerIdNotInExpectedForm = 140,
  renderControllerNameNotInExpectedForm = 141,
  geometryIdNotInExpectedForm = 150,
  geometryNameNotInExpectedForm = 151,
  materialsIdentifierNotInExpectedForm = 160,
  materialsFirstSegmentNotInExpectedForm = 161,
  resourcePackDoesNotHavePackScopeWorld = 170,
  noDimensionJson = 191,
}

export default class CooperativeAddOnItemRequirementsGenerator implements IProjectInfoItemGenerator {
  id = "CADDONIREQ";
  title = "Cooperative Add-On Item Requirements Generator";
  canAlwaysProcess = true;

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(CooperativeAddOnItemRequirementsGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(projectItem: ProjectItem, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (projectItem.itemType === ProjectItemType.dimensionJson) {
      // CADDONIREQ191
      items.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          CooperativeAddOnItemRequirementsGeneratorTest.noDimensionJson,
          `Dimension definition resources are not permitted in an add-on targeted behavior pack`,
          projectItem
        )
      );
    } else if (projectItem.itemType === ProjectItemType.resourcePackManifestJson) {
      await projectItem.loadFileContent();

      if (projectItem.primaryFile) {
        const rpManifest = await ResourceManifestDefinition.ensureOnFile(projectItem.primaryFile);

        if (rpManifest) {
          await rpManifest.load();

          if (!rpManifest.packScope) {
            // CADDONIREQ170
            items.push(
              new ProjectInfoItem(
                InfoItemType.error,
                this.id,
                CooperativeAddOnItemRequirementsGeneratorTest.resourcePackDoesNotHavePackScopeWorld,
                `Resource pack manifest does not specify that header/pack_scope that should be 'world'`,
                projectItem
              )
            );
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.animationControllerBehaviorJson) {
      await projectItem.loadFileContent();

      if (projectItem.primaryFile) {
        const bacManifest = await AnimationControllerBehaviorDefinition.ensureOnFile(projectItem.primaryFile);

        if (bacManifest && bacManifest.data && bacManifest.data.animation_controllers) {
          for (let bacName in bacManifest.data.animation_controllers) {
            let bacNameBreak = bacName.split(".");

            if (bacNameBreak.length < 3 || bacNameBreak[0] !== "controller" || bacNameBreak[1] !== "animation") {
              // CADDONIREQ100
              items.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.behaviorAnimationControllerIdNotInExpectedForm,
                  `Behavior pack animation controller identifier is not in the expected form of controller.animation.xyz`,
                  projectItem,
                  bacName
                )
              );
            } else if (!CooperativeAddOnRequirementsGenerator.isNamespacedString(bacNameBreak[2])) {
              // CADDONIREQ101
              items.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.behaviorAnimationControllerNameNotInExpectedForm,
                  `Behavior pack animation controller name section is not in the expected form of controller.animation.creatorshortname_projectshortname`,
                  projectItem,
                  bacName
                )
              );
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.animationBehaviorJson) {
      await projectItem.loadFileContent();

      if (projectItem.primaryFile) {
        const baManifest = await AnimationBehaviorDefinition.ensureOnFile(projectItem.primaryFile);

        if (baManifest && baManifest.data && baManifest.data.animations) {
          for (let aName in baManifest.data.animations) {
            let baNameBreak = aName.split(".");

            if (baNameBreak.length < 2 || baNameBreak[0] !== "animation") {
              // CADDONIREQ110
              items.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.behaviorAnimationIdNotInExpectedForm,
                  `Behavior animation identifier is not in the expected form of animation.xyz.animation_name`,
                  projectItem,
                  aName
                )
              );
            } else if (!CooperativeAddOnRequirementsGenerator.isNamespacedString(baNameBreak[1])) {
              // CADDONIREQ111
              items.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.behaviorAnimationNameNotInExpectedForm,
                  `Behavior pack animation name section is not in the expected form of animation.creatorshortname_projectshortname.animation_name`,
                  projectItem,
                  aName
                )
              );
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.animationControllerResourceJson) {
      await projectItem.loadFileContent();

      if (projectItem.primaryFile) {
        const racManifest = await AnimationControllerResourceDefinition.ensureOnFile(projectItem.primaryFile);

        if (racManifest && racManifest.data && racManifest.data.animation_controllers) {
          for (let racName in racManifest.data.animation_controllers) {
            let racNameBreak = racName.split(".");

            if (racNameBreak.length < 3 || racNameBreak[0] !== "controller" || racNameBreak[1] !== "animation") {
              // CADDONIREQ120
              items.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.resourceAnimationControllerIdNotInExpectedForm,
                  `Resource pack animation controller identifier is not in the expected form of controller.animation.xyz`,
                  projectItem,
                  racName
                )
              );
            } else if (!CooperativeAddOnRequirementsGenerator.isNamespacedString(racNameBreak[2])) {
              // CADDONIREQ121
              items.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.resourceAnimationControllerNameNotInExpectedForm,
                  `Resource pack animation controller name section is not in the expected form of controller.animation.creatorshortname_projectshortname`,
                  projectItem,
                  racName
                )
              );
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.animationResourceJson) {
      await projectItem.loadFileContent();

      if (projectItem.primaryFile) {
        const raManifest = await AnimationResourceDefinition.ensureOnFile(projectItem.primaryFile);

        if (raManifest && raManifest.animations) {
          for (let aName in raManifest.animations) {
            let raNameBreak = aName.split(".");

            if (raNameBreak.length < 2 || raNameBreak[0] !== "animation") {
              // CADDONIREQ130
              items.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.resourceAnimationIdNotInExpectedForm,
                  `Resource animation identifier is not in the expected form of animation.xyz.animation_name`,
                  projectItem,
                  aName
                )
              );
            } else if (!CooperativeAddOnRequirementsGenerator.isNamespacedString(raNameBreak[1])) {
              // CADDONIREQ131
              items.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.resourceAnimationNameNotInExpectedForm,
                  `Resource animation name section is not in the expected form of animation.creatorshortname_projectshortname.animation_name`,
                  projectItem,
                  aName
                )
              );
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.renderControllerJson) {
      await projectItem.loadFileContent();

      if (projectItem.primaryFile) {
        const racManifest = await RenderControllerSetDefinition.ensureOnFile(projectItem.primaryFile);

        if (racManifest && racManifest.data && racManifest.data.render_controllers) {
          for (let rrcName in racManifest.data.render_controllers) {
            let racNameBreak = rrcName.split(".");

            if (racNameBreak.length < 3 || racNameBreak[0] !== "controller" || racNameBreak[1] !== "render") {
              // CADDONIREQ140
              items.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.renderControllerIdNotInExpectedForm,
                  `Resource pack render controller identifier is not in the expected form of controller.render.creatorshortname_projectshortname.other`,
                  projectItem,
                  rrcName
                )
              );
            } else if (!CooperativeAddOnRequirementsGenerator.isNamespacedString(racNameBreak[2])) {
              // CADDONIREQ141
              items.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.renderControllerNameNotInExpectedForm,
                  `Resource pack render controller name section is not in the expected form of controller.render.creatorshortname_projectshortname`,
                  projectItem,
                  rrcName
                )
              );
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.modelGeometryJson) {
      await projectItem.loadFileContent();

      if (projectItem.primaryFile) {
        const modGeo = await ModelGeometryDefinition.ensureOnFile(projectItem.primaryFile);

        if (modGeo) {
          for (const modId of modGeo.identifiers) {
            if (modGeo && modId) {
              let modGeoBreaks = modId.split(".");

              if (modGeoBreaks.length < 2 || modGeoBreaks[0] !== "geometry") {
                // CADDONIREQ150
                items.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    CooperativeAddOnItemRequirementsGeneratorTest.geometryIdNotInExpectedForm,
                    `Geometry is not in the expected form of geometry.creatorshortname_projectshortname.other`,
                    projectItem,
                    modId
                  )
                );
              } else if (!CooperativeAddOnRequirementsGenerator.isNamespacedString(modGeoBreaks[1])) {
                // CADDONIREQ151
                items.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    CooperativeAddOnItemRequirementsGeneratorTest.geometryNameNotInExpectedForm,
                    `Geometry identifier section is not in the expected form of geometry.creatorshortname_projectshortname`,
                    projectItem,
                    modId
                  )
                );
              }
            }
          }
        }
      }
    } else if (
      projectItem.itemType === ProjectItemType.recipeBehavior ||
      projectItem.itemType === ProjectItemType.entityTypeBehavior ||
      projectItem.itemType === ProjectItemType.blockTypeBehavior ||
      projectItem.itemType === ProjectItemType.itemTypeBehavior
    ) {
      await projectItem.loadFileContent();

      if (projectItem.primaryFile) {
        const projectItemDef = await MinecraftDefinitions.get(projectItem);

        if (projectItemDef && projectItemDef.id) {
          if (!CooperativeAddOnRequirementsGenerator.isNamespacedString(projectItemDef.id)) {
            // CADDONIREQ112
            items.push(
              new ProjectInfoItem(
                InfoItemType.error,
                this.id,
                CooperativeAddOnItemRequirementsGeneratorTest.jsonIdentifierNotInExpectedForm,
                `JSON namespaced identifier is not in the expected form of creatorshortname_projectshortname:myitem`,
                projectItem,
                projectItemDef.id
              )
            );
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.material) {
      await projectItem.loadFileContent();

      if (projectItem.primaryFile) {
        const mat = await Material.ensureOnFile(projectItem.primaryFile);

        if (mat && mat.definition && mat.definition.materials) {
          for (const modId in mat.definition.materials) {
            let modIdBreaks = modId.split(":");
            // CADDONIREQ160
            if (modIdBreaks.length < 1) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.materialsIdentifierNotInExpectedForm,
                  `Materials section identifier is not in the expected form of creatorshortname_projectshortname:other`,
                  projectItem,
                  modId
                )
              );
            } else if (
              modIdBreaks[0] !== "version" &&
              (!CooperativeAddOnRequirementsGenerator.isNamespacedString(modIdBreaks[0]) ||
                CooperativeAddOnRequirementsGenerator.isCommonMaterialName(modIdBreaks[0]))
            ) {
              // CADDONIREQ161
              items.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.materialsFirstSegmentNotInExpectedForm,
                  `First segment of a Materials section identifier is not in the expected form of creatorshortname_projectshortname_materialname or creatorshortname_projectshortname_materialname:baseitem`,
                  projectItem,
                  modId
                )
              );
            }
          }
        }
      }
    }

    return items;
  }
}

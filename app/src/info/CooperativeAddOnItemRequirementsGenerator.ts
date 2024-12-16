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
  BehaviorAnimationControllerIdNotInExpectedForm = 100,
  BehaviorAnimationControllerNameNotInExpectedForm = 101,
  BehaviorAnimationIdNotInExpectedForm = 110,
  BehaviorAnimationNameNotInExpectedForm = 111,
  JsonIdentifierNotInExpectedForm = 112,
  ResourceAnimationControllerIdNotInExpectedForm = 120,
  ResourceAnimationControllerNameNotInExpectedForm = 121,
  ResourceAnimationIdNotInExpectedForm = 130,
  ResourceAnimationNameNotInExpectedForm = 131,
  RenderControllerIdNotInExpectedForm = 140,
  RenderControllerNameNotInExpectedForm = 141,
  GeometryIdNotInExpectedForm = 150,
  GeometryNameNotInExpectedForm = 151,
  MaterialsIdentifierNotInExpectedForm = 160,
  MaterialsFirstSegmentNotInExpectedForm = 161,
  ResourcePackDoesNotHavePackScopeWorld = 170,
  NoDimensionJson = 191,
}

export default class CooperativeAddOnItemRequirementsGenerator implements IProjectInfoItemGenerator {
  id = "CADDONIREQ";
  title = "Cooperative Add-On Item Requirements Generator";

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
          InfoItemType.testCompleteFail,
          this.id,
          CooperativeAddOnItemRequirementsGeneratorTest.NoDimensionJson,
          `Dimension definition resources are not permitted in an add-on targeted behavior pack`,
          projectItem
        )
      );
    } else if (projectItem.itemType === ProjectItemType.resourcePackManifestJson) {
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const rpManifest = await ResourceManifestDefinition.ensureOnFile(projectItem.file);

        if (rpManifest) {
          await rpManifest.load();

          if (!rpManifest.packScope) {
            // CADDONIREQ170
            items.push(
              new ProjectInfoItem(
                InfoItemType.testCompleteFail,
                this.id,
                CooperativeAddOnItemRequirementsGeneratorTest.ResourcePackDoesNotHavePackScopeWorld,
                `Resource pack manifest does not specify that header/pack_scope that should be 'world'`,
                projectItem
              )
            );
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.animationControllerBehaviorJson) {
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const bacManifest = await AnimationControllerBehaviorDefinition.ensureOnFile(projectItem.file);

        if (bacManifest && bacManifest.data && bacManifest.data.animation_controllers) {
          for (let bacName in bacManifest.data.animation_controllers) {
            let bacNameBreak = bacName.split(".");

            if (bacNameBreak.length < 3 || bacNameBreak[0] !== "controller" || bacNameBreak[1] !== "animation") {
              // CADDONIREQ100
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.BehaviorAnimationControllerIdNotInExpectedForm,
                  `Behavior pack animation controller identifier is not in expected form of controller.animation.xyz`,
                  projectItem,
                  bacName
                )
              );
            } else if (!CooperativeAddOnRequirementsGenerator.isNamespacedString(bacNameBreak[2])) {
              // CADDONIREQ101
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.BehaviorAnimationControllerNameNotInExpectedForm,
                  `Behavior pack animation controller name section is not in expected form of controller.animation.creatorshortname_projectshortname`,
                  projectItem,
                  bacName
                )
              );
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.animationBehaviorJson) {
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const baManifest = await AnimationBehaviorDefinition.ensureOnFile(projectItem.file);

        if (baManifest && baManifest.data && baManifest.data.animations) {
          for (let aName in baManifest.data.animations) {
            let baNameBreak = aName.split(".");

            if (baNameBreak.length < 2 || baNameBreak[0] !== "animation") {
              // CADDONIREQ110
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.BehaviorAnimationIdNotInExpectedForm,
                  `Behavior animation identifier is not in expected form of animation.xyz.animation_name`,
                  projectItem,
                  aName
                )
              );
            } else if (!CooperativeAddOnRequirementsGenerator.isNamespacedString(baNameBreak[1])) {
              // CADDONIREQ111
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.BehaviorAnimationControllerNameNotInExpectedForm,
                  `Behavior pack animation name section is not in expected form of animation.creatorshortname_projectshortname.animation_name`,
                  projectItem,
                  aName
                )
              );
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.animationControllerResourceJson) {
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const racManifest = await AnimationControllerResourceDefinition.ensureOnFile(projectItem.file);

        if (racManifest && racManifest.data && racManifest.data.animation_controllers) {
          for (let racName in racManifest.data.animation_controllers) {
            let racNameBreak = racName.split(".");

            if (racNameBreak.length < 3 || racNameBreak[0] !== "controller" || racNameBreak[1] !== "animation") {
              // CADDONIREQ120
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.ResourceAnimationControllerIdNotInExpectedForm,
                  `Resource pack animation controller identifier is not in expected form of controller.animation.xyz`,
                  projectItem,
                  racName
                )
              );
            } else if (!CooperativeAddOnRequirementsGenerator.isNamespacedString(racNameBreak[2])) {
              // CADDONIREQ121
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.ResourceAnimationControllerNameNotInExpectedForm,
                  `Resource pack animation controller name section is not in expected form of controller.animation.creatorshortname_projectshortname`,
                  projectItem,
                  racName
                )
              );
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.animationResourceJson) {
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const raManifest = await AnimationResourceDefinition.ensureOnFile(projectItem.file);

        if (raManifest && raManifest.animations) {
          for (let aName in raManifest.animations) {
            let raNameBreak = aName.split(".");

            if (raNameBreak.length < 2 || raNameBreak[0] !== "animation") {
              // CADDONIREQ130
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.ResourceAnimationIdNotInExpectedForm,
                  `Resource animation identifier is not in expected form of animation.xyz.animation_name`,
                  projectItem,
                  aName
                )
              );
            } else if (!CooperativeAddOnRequirementsGenerator.isNamespacedString(raNameBreak[1])) {
              // CADDONIREQ131
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.ResourceAnimationNameNotInExpectedForm,
                  `Resource animation name section is not in expected form of animation.creatorshortname_projectshortname.animation_name`,
                  projectItem,
                  aName
                )
              );
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.renderControllerJson) {
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const racManifest = await RenderControllerSetDefinition.ensureOnFile(projectItem.file);

        if (racManifest && racManifest.data && racManifest.data.render_controllers) {
          for (let rrcName in racManifest.data.render_controllers) {
            let racNameBreak = rrcName.split(".");

            if (racNameBreak.length < 3 || racNameBreak[0] !== "controller" || racNameBreak[1] !== "render") {
              // CADDONIREQ140
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.RenderControllerIdNotInExpectedForm,
                  `Resource pack render controller identifier is not in expected form of controller.render.creatorshortname_projectshortname.other`,
                  projectItem,
                  rrcName
                )
              );
            } else if (!CooperativeAddOnRequirementsGenerator.isNamespacedString(racNameBreak[2])) {
              // CADDONIREQ141
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.RenderControllerNameNotInExpectedForm,
                  `Resource pack render controller name section is not in expected form of controller.render.creatorshortname_projectshortname`,
                  projectItem,
                  rrcName
                )
              );
            }
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.modelGeometryJson) {
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const modGeo = await ModelGeometryDefinition.ensureOnFile(projectItem.file);

        if (modGeo) {
          for (const modId of modGeo.identifiers) {
            if (modGeo && modId) {
              let modGeoBreaks = modId.split(".");

              if (modGeoBreaks.length < 2 || modGeoBreaks[0] !== "geometry") {
                // CADDONIREQ150
                items.push(
                  new ProjectInfoItem(
                    InfoItemType.testCompleteFail,
                    this.id,
                    CooperativeAddOnItemRequirementsGeneratorTest.GeometryIdNotInExpectedForm,
                    `Geometry is not in expected form of geometry.creatorshortname_projectshortname.other`,
                    projectItem,
                    modId
                  )
                );
              } else if (!CooperativeAddOnRequirementsGenerator.isNamespacedString(modGeoBreaks[1])) {
                // CADDONIREQ151
                items.push(
                  new ProjectInfoItem(
                    InfoItemType.testCompleteFail,
                    this.id,
                    CooperativeAddOnItemRequirementsGeneratorTest.GeometryNameNotInExpectedForm,
                    `Geometry identifier section is not in expected form of geometry.creatorshortname_projectshortname`,
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
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const projectItemDef = await MinecraftDefinitions.get(projectItem);

        if (projectItemDef && projectItemDef.id) {
          if (!CooperativeAddOnRequirementsGenerator.isNamespacedString(projectItemDef.id)) {
            // CADDONIREQ112
            items.push(
              new ProjectInfoItem(
                InfoItemType.testCompleteFail,
                this.id,
                CooperativeAddOnItemRequirementsGeneratorTest.JsonIdentifierNotInExpectedForm,
                `JSON namespaced identifier is not in expected form of creatorshortname_projectshortname:myitem`,
                projectItem,
                projectItemDef.id
              )
            );
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.material) {
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const mat = await Material.ensureOnFile(projectItem.file);

        if (mat && mat.definition && mat.definition.materials) {
          for (const modId in mat.definition.materials) {
            let modIdBreaks = modId.split(":");
            // CADDONIREQ160
            if (modIdBreaks.length < 1) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.MaterialsIdentifierNotInExpectedForm,
                  `Materials section identifier is not in expected form of creatorshortname_projectshortname:other`,
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
                  InfoItemType.testCompleteFail,
                  this.id,
                  CooperativeAddOnItemRequirementsGeneratorTest.MaterialsFirstSegmentNotInExpectedForm,
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

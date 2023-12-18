import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";

import ProjectInfoSet from "./ProjectInfoSet";
import { ProjectItemType } from "../app/IProjectItemData";
import BehaviorAnimationController from "../minecraft/BehaviorAnimationController";
import { InfoItemType } from "./IInfoItemData";
import AddOnRequirementsGenerator from "./AddOnRequirementsGenerator";
import BehaviorAnimation from "../minecraft/BehaviorAnimation";
import ResourceAnimationController from "../minecraft/ResourceAnimationController";
import ResourceAnimation from "../minecraft/ResourceAnimation";
import ResourceRenderController from "../minecraft/ResourceRenderController";
import ResourceManifestJson from "../minecraft/ResourceManifestJson";
import BehaviorManifestJson from "../minecraft/BehaviorManifestJson";

export default class AddOnItemRequirementsGenerator implements IProjectInfoItemGenerator {
  id = "ADDONIREQ";
  title = "Addon Item Requirements Generator";

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(projectItem: ProjectItem): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (projectItem.itemType === ProjectItemType.resourcePackManifestJson) {
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const rpManifest = await ResourceManifestJson.ensureOnFile(projectItem.file);

        if (rpManifest) {
          await rpManifest.load();

          if (!rpManifest.packScope) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.testCompleteFail,
                this.id,
                140,
                `Resource pack manifest does not specify that header/pack_scope that should be 'world'`,
                projectItem
              )
            );
          }
          if (!rpManifest.productType) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.testCompleteFail,
                this.id,
                141,
                `Resource pack manifest does not specify a metadata/product_type that should be 'addon'`,
                projectItem
              )
            );
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.behaviorPackManifestJson) {
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const bpManifest = await BehaviorManifestJson.ensureOnFile(projectItem.file);

        if (bpManifest) {
          await bpManifest.load();

          if (!bpManifest.productType) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.testCompleteFail,
                this.id,
                142,
                `Behavior pack manifest does not specify a metadata/product_type that should be 'addon'`,
                projectItem
              )
            );
          }
        }
      }
    } else if (projectItem.itemType === ProjectItemType.animationControllerBehaviorJson) {
      await projectItem.ensureFileStorage();

      if (projectItem.file) {
        const bacManifest = await BehaviorAnimationController.ensureOnFile(projectItem.file);

        if (bacManifest && bacManifest.definition && bacManifest.definition.animation_controllers) {
          for (let bacName in bacManifest.definition.animation_controllers) {
            let bacNameBreak = bacName.split(".");

            if (bacNameBreak.length < 3 || bacNameBreak[0] !== "controller" || bacNameBreak[1] !== "animation") {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  100,
                  `Behavior pack animation controller identifier is not in expected form of controller.animation.xyz`,
                  projectItem,
                  bacName
                )
              );
            } else if (!AddOnRequirementsGenerator.isNamespacedString(bacNameBreak[2])) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  101,
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
        const baManifest = await BehaviorAnimation.ensureOnFile(projectItem.file);

        if (baManifest && baManifest.definition && baManifest.definition.animations) {
          for (let aName in baManifest.definition.animations) {
            let baNameBreak = aName.split(".");

            if (baNameBreak.length < 3 || baNameBreak[0] !== "animation") {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  110,
                  `Behavior animation identifier is not in expected form of animation.xyz.animation_name`,
                  projectItem,
                  aName
                )
              );
            } else if (!AddOnRequirementsGenerator.isNamespacedString(baNameBreak[1])) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  111,
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
        const racManifest = await ResourceAnimationController.ensureOnFile(projectItem.file);

        if (racManifest && racManifest.definition && racManifest.definition.animation_controllers) {
          for (let racName in racManifest.definition.animation_controllers) {
            let racNameBreak = racName.split(".");

            if (racNameBreak.length < 3 || racNameBreak[0] !== "controller" || racNameBreak[1] !== "animation") {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  120,
                  `Resource pack animation controller identifier is not in expected form of controller.animation.xyz`,
                  projectItem,
                  racName
                )
              );
            } else if (!AddOnRequirementsGenerator.isNamespacedString(racNameBreak[2])) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  121,
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
        const raManifest = await ResourceAnimation.ensureOnFile(projectItem.file);

        if (raManifest && raManifest.definition && raManifest.definition.animations) {
          for (let aName in raManifest.definition.animations) {
            let raNameBreak = aName.split(".");

            if (raNameBreak.length < 3 || raNameBreak[0] !== "animation") {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  130,
                  `Resource animation identifier is not in expected form of animation.xyz.animation_name`,
                  projectItem,
                  aName
                )
              );
            } else if (!AddOnRequirementsGenerator.isNamespacedString(raNameBreak[1])) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  131,
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
        const racManifest = await ResourceRenderController.ensureOnFile(projectItem.file);

        if (racManifest && racManifest.definition && racManifest.definition.render_controllers) {
          for (let rrcName in racManifest.definition.render_controllers) {
            let racNameBreak = rrcName.split(".");

            if (racNameBreak.length < 3 || racNameBreak[0] !== "controller" || racNameBreak[1] !== "render") {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  140,
                  `Resource pack animation controller identifier is not in expected form of controller.render.xyz`,
                  projectItem,
                  rrcName
                )
              );
            } else if (!AddOnRequirementsGenerator.isNamespacedString(racNameBreak[2])) {
              items.push(
                new ProjectInfoItem(
                  InfoItemType.testCompleteFail,
                  this.id,
                  141,
                  `Resource pack animation controller name section is not in expected form of controller.render.creatorshortname_projectshortname`,
                  projectItem,
                  rrcName
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

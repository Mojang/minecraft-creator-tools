// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import Project from "../app/Project";
import ContentIndex from "../core/ContentIndex";
import AnimationResourceDefinition from "../minecraft/AnimationResourceDefinition";
import ProjectInfoUtilities from "./ProjectInfoUtilities";

export enum AnimationResourceInfoGeneratorTest {
  animations = 1,
  bones = 2,
}

export default class AnimationResourceInfoGenerator implements IProjectInfoGenerator {
  id = "RESOURCEANIMATION";
  title = "Resource Animation";

  performAddOnValidations = false;

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(AnimationResourceInfoGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.animationCount = infoSet.getSummedNumberValue("RESOURCEANIMATION", 1);
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    const animationCountPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      AnimationResourceInfoGeneratorTest.animations,
      ProjectInfoUtilities.getTitleFromEnum(
        AnimationResourceInfoGeneratorTest,
        AnimationResourceInfoGeneratorTest.animations
      )
    );
    items.push(animationCountPi);

    const boneCountPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      AnimationResourceInfoGeneratorTest.bones,
      ProjectInfoUtilities.getTitleFromEnum(
        AnimationResourceInfoGeneratorTest,
        AnimationResourceInfoGeneratorTest.bones
      )
    );
    items.push(boneCountPi);

    const itemsCopy = project.getItemsCopy();

    for (const projectItem of itemsCopy) {
      if (projectItem.itemType === ProjectItemType.animationResourceJson) {
        await projectItem.ensureFileStorage();

        if (projectItem.availableFile) {
          const ra = await AnimationResourceDefinition.ensureOnFile(projectItem.availableFile);

          if (ra && ra.animations) {
            for (const animationName in ra.animations) {
              const animation = ra.animations[animationName];

              animationCountPi.incrementFeature("Resource", "Count", 1);

              if (animation && animation.bones) {
                for (const boneName in animation.bones) {
                  const bone = animation.bones[boneName];

                  if (bone) {
                    boneCountPi.incrementFeature("Resource Animation Bone", "Count", 1);

                    if (bone.position) {
                      this.processAnimationValue(boneCountPi, bone.position, "Position");
                    }

                    if (bone.rotation) {
                      this.processAnimationValue(boneCountPi, bone.rotation, "Rotation");
                    }

                    if (bone.scale) {
                      this.processAnimationValue(boneCountPi, bone.scale, "Scale");
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return items;
  }

  processAnimationValue(boneCountPi: ProjectInfoItem, value: any, type: string) {
    let isKeyframedBoneAnimation = false;

    if (typeof value === "string") {
      boneCountPi.incrementFeature("Resource Animation Bone " + type + " Expression", "Count", 1);
      return;
    }

    for (const key in value) {
      const val = value[key];

      if ((val as any).constructor === Array) {
        isKeyframedBoneAnimation = true;
        break;
      }
    }

    if (isKeyframedBoneAnimation) {
      boneCountPi.incrementFeature("Resource Animation Bone " + type + " Keyframe", "Count", 1);

      for (const key in value) {
        const val = value[key];

        if ((val as any).constructor === Array) {
          for (const valAtom of val) {
            if (typeof valAtom === "string") {
              boneCountPi.incrementFeature("Resource Animation Bone " + type + " Keyframe with Molang", "Count", 1);
            } else {
              boneCountPi.incrementFeature("Resource Animation Bone " + type + " Keyframe", "Count", 1);
            }
          }
        }
      }
    } else {
      boneCountPi.incrementFeature("Resource Animation Bone " + type + " Continuous", "Count", 1);

      if ((value as any).constructor === Array) {
        for (const val of value) {
          if (typeof val.position === "string") {
            boneCountPi.incrementFeature("Resource Animation Bone " + type + " Continuous with Molang", "Count", 1);
          } else {
            boneCountPi.incrementFeature("Resource Animation Bone " + type + " Continuous", "Count", 1);
          }
        }
      }
    }
  }
}

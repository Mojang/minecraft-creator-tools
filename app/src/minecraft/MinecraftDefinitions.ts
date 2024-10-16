import { ProjectItemType } from "../app/IProjectItemData";
import ProjectItem from "../app/ProjectItem";
import AnimationBehaviorDefinition from "./AnimationBehaviorDefinition";
import AnimationControllerBehaviorDefinition from "./AnimationControllerBehaviorDefinition";
import AnimationControllerResourceDefinition from "./AnimationControllerResourceDefinition";
import AnimationResourceDefinition from "./AnimationResourceDefinition";
import BehaviorManifestDefinition from "./BehaviorManifestDefinition";
import BlockTypeBehaviorDefinition from "./BlockTypeBehaviorDefinition";
import EntityTypeDefinition from "./EntityTypeDefinition";
import FlipbookTextureCatalogDefinition from "./FlipbookTextureCatalogDefinition";
import ItemTypeBehaviorDefinition from "./ItemTypeBehaviorDefinition";
import ResourceManifestDefinition from "./ResourceManifestDefinition";

export default class MinecraftDefinitions {
  static async get(projectItem: ProjectItem) {
    if (!projectItem.file || !projectItem.file.content || typeof projectItem.file.content !== "string") {
      return undefined;
    }

    switch (projectItem.itemType) {
      case ProjectItemType.entityTypeBehavior:
        return await EntityTypeDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.itemTypeBehaviorJson:
        return await ItemTypeBehaviorDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.blockTypeBehavior:
        return await BlockTypeBehaviorDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.flipbookTexturesJson:
        return await FlipbookTextureCatalogDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.behaviorPackManifestJson:
        return await BehaviorManifestDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.resourcePackManifestJson:
        return await ResourceManifestDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.animationControllerBehaviorJson:
        return await AnimationControllerBehaviorDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.animationControllerResourceJson:
        return await AnimationControllerResourceDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.animationBehaviorJson:
        return await AnimationBehaviorDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.animationResourceJson:
        return await AnimationResourceDefinition.ensureOnFile(projectItem.file);
    }

    return undefined;
  }

  static async formatVersionIsCurrent(projectItem: ProjectItem) {
    const def = await MinecraftDefinitions.get(projectItem);

    if (def && (def as any).getFormatVersionIsCurrent) {
      return await (def as any).getFormatVersionIsCurrent();
    }

    return true;
  }

  static async getFormatVersion(projectItem: ProjectItem) {
    const def = await MinecraftDefinitions.get(projectItem);

    if (def && (def as any).getFormatVersion) {
      const fv = await (def as any).getFormatVersion();

      if (!(fv instanceof Array)) {
        return undefined;
      }

      return fv;
    }

    return undefined;
  }
}

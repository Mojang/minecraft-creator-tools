import { ProjectItemType } from "../app/IProjectItemData";
import ProjectItem from "../app/ProjectItem";
import BehaviorAnimation from "./BehaviorAnimation";
import BehaviorAnimationController from "./BehaviorAnimationController";
import BehaviorManifestDefinition from "./BehaviorManifestDefinition";
import BlockTypeBehaviorDefinition from "./BlockTypeBehaviorDefinition";
import EntityTypeDefinition from "./EntityTypeDefinition";
import FlipbookTextureCatalogDefinition from "./FlipbookTextureCatalogDefinition";
import ItemTypeBehaviorDefinition from "./ItemTypeBehaviorDefinition";
import ResourceAnimation from "./ResourceAnimation";
import ResourceAnimationController from "./ResourceAnimationController";
import ResourceManifestDefinition from "./ResourceManifestDefinition";

export default class MinecraftDefinitions {
  static async get(projectItem: ProjectItem) {
    if (!projectItem.file || !projectItem.file.content || typeof projectItem.file.content !== "string") {
      return undefined;
    }

    switch (projectItem.itemType) {
      case ProjectItemType.entityTypeBehaviorJson:
        return await EntityTypeDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.itemTypeBehaviorJson:
        return await ItemTypeBehaviorDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.blockTypeBehaviorJson:
        return await BlockTypeBehaviorDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.flipbookTexturesJson:
        return await FlipbookTextureCatalogDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.behaviorPackManifestJson:
        return await BehaviorManifestDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.resourcePackManifestJson:
        return await ResourceManifestDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.animationControllerBehaviorJson:
        return await BehaviorAnimationController.ensureOnFile(projectItem.file);
      case ProjectItemType.animationControllerResourceJson:
        return await ResourceAnimationController.ensureOnFile(projectItem.file);
      case ProjectItemType.animationBehaviorJson:
        return await BehaviorAnimation.ensureOnFile(projectItem.file);
      case ProjectItemType.animationResourceJson:
        return await ResourceAnimation.ensureOnFile(projectItem.file);
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
      return await (def as any).getFormatVersion();
    }

    return undefined;
  }
}

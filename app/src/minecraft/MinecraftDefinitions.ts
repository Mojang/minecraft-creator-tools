import { ProjectItemType } from "../app/IProjectItemData";
import ProjectItem from "../app/ProjectItem";
import AnimationBehaviorDefinition from "./AnimationBehaviorDefinition";
import AnimationControllerBehaviorDefinition from "./AnimationControllerBehaviorDefinition";
import AnimationControllerResourceDefinition from "./AnimationControllerResourceDefinition";
import AnimationResourceDefinition from "./AnimationResourceDefinition";
import AudioFileDefinition from "./AudioFileDefinition";
import BehaviorManifestDefinition from "./BehaviorManifestDefinition";
import BlockTypeDefinition from "./BlockTypeDefinition";
import EntityTypeDefinition from "./EntityTypeDefinition";
import EntityTypeResourceDefinition from "./EntityTypeResourceDefinition";
import FlipbookTextureCatalogDefinition from "./FlipbookTextureCatalogDefinition";
import IDefinition from "./IDefinition";
import ItemTypeBehaviorDefinition from "./ItemTypeBehaviorDefinition";
import MusicDefinitionCatalogDefinition from "./MusicDefinitionCatalogDefinition";
import RenderControllerSetDefinition from "./RenderControllerSetDefinition";
import ResourceManifestDefinition from "./ResourceManifestDefinition";
import SoundCatalogDefinition from "./SoundCatalogDefinition";
import SoundDefinitionCatalogDefinition from "./SoundDefinitionCatalogDefinition";

export default class MinecraftDefinitions {
  static async get(projectItem: ProjectItem): Promise<IDefinition | undefined> {
    if (!projectItem.file || !projectItem.file.content || typeof projectItem.file.content !== "string") {
      await projectItem.ensureFileStorage();

      if (!projectItem.file) {
        return undefined;
      }

      await projectItem.file.loadContent();

      if (!projectItem.file.content || typeof projectItem.file.content !== "string") {
        return undefined;
      }
    }

    switch (projectItem.itemType) {
      case ProjectItemType.entityTypeBehavior:
        return await EntityTypeDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.entityTypeResource:
        return await EntityTypeResourceDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.itemTypeBehavior:
        return await ItemTypeBehaviorDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.blockTypeBehavior:
        return await BlockTypeDefinition.ensureOnFile(projectItem.file);
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
      case ProjectItemType.soundDefinitionCatalog:
        return await SoundDefinitionCatalogDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.soundCatalog:
        return await SoundCatalogDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.musicDefinitionJson:
        return await MusicDefinitionCatalogDefinition.ensureOnFile(projectItem.file);
      case ProjectItemType.renderControllerJson:
        return await RenderControllerSetDefinition.ensureOnFile(projectItem.file);
    }

    return undefined;
  }

  static async ensureFoundationalDependencies(item: ProjectItem) {
    if (item.itemType === ProjectItemType.audio) {
      await item.ensureStorage();

      if (item.file) {
        const audioFile = await AudioFileDefinition.ensureOnFile(item.file);

        if (audioFile) {
          await audioFile.ensureSoundDefinitionsForFile(item.project);
        }
      }
    }
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

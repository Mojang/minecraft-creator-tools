import { ProjectItemType } from "../app/IProjectItemData";
import ProjectItem from "../app/ProjectItem";
import AnimationBehaviorDefinition from "./AnimationBehaviorDefinition";
import AnimationControllerBehaviorDefinition from "./AnimationControllerBehaviorDefinition";
import AnimationControllerResourceDefinition from "./AnimationControllerResourceDefinition";
import AnimationResourceDefinition from "./AnimationResourceDefinition";
import AudioDefinition from "./AudioDefinition";
import BehaviorManifestDefinition from "./BehaviorManifestDefinition";
import BiomeBehaviorDefinition from "./BiomeBehaviorDefinition";
import BiomeResourceDefinition from "./BiomeResourceDefinition";
import BlockTypeDefinition from "./BlockTypeDefinition";
import EntityTypeDefinition from "./EntityTypeDefinition";
import EntityTypeResourceDefinition from "./EntityTypeResourceDefinition";
import FlipbookTextureCatalogDefinition from "./FlipbookTextureCatalogDefinition";
import IDefinition from "./IDefinition";
import ItemTypeDefinition from "./ItemTypeDefinition";
import JigsawProcessorListDefinition from "./JigsawProcessorListDefinition";
import JigsawStructureDefinition from "./JigsawStructureDefinition";
import JigsawStructureSetDefinition from "./JigsawStructureSetDefinition";
import JigsawTemplatePoolDefinition from "./JigsawTemplatePoolDefinition";
import MusicDefinitionCatalogDefinition from "./MusicDefinitionCatalogDefinition";
import RenderControllerSetDefinition from "./RenderControllerSetDefinition";
import ResourceManifestDefinition from "./ResourceManifestDefinition";
import SoundCatalogDefinition from "./SoundCatalogDefinition";
import SoundDefinitionCatalogDefinition from "./SoundDefinitionCatalogDefinition";

export default class MinecraftDefinitions {
  static async get(projectItem: ProjectItem): Promise<IDefinition | undefined> {
    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (
      !projectItem.primaryFile ||
      !projectItem.primaryFile.content ||
      typeof projectItem.primaryFile.content !== "string"
    ) {
      if (!projectItem.primaryFile) {
        return undefined;
      }

      if (!projectItem.primaryFile.isContentLoaded) {
        await projectItem.primaryFile.loadContent();
      }

      if (!projectItem.primaryFile.content || typeof projectItem.primaryFile.content !== "string") {
        return undefined;
      }
    }

    switch (projectItem.itemType) {
      case ProjectItemType.entityTypeBehavior:
        return await EntityTypeDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.entityTypeResource:
        return await EntityTypeResourceDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.itemTypeBehavior:
        return await ItemTypeDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.blockTypeBehavior:
        return await BlockTypeDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.flipbookTexturesJson:
        return await FlipbookTextureCatalogDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.behaviorPackManifestJson:
        return await BehaviorManifestDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.resourcePackManifestJson:
        return await ResourceManifestDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.animationControllerBehaviorJson:
        return await AnimationControllerBehaviorDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.animationControllerResourceJson:
        return await AnimationControllerResourceDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.animationBehaviorJson:
        return await AnimationBehaviorDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.animationResourceJson:
        return await AnimationResourceDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.soundDefinitionCatalog:
        return await SoundDefinitionCatalogDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.soundCatalog:
        return await SoundCatalogDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.musicDefinitionJson:
        return await MusicDefinitionCatalogDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.renderControllerJson:
        return await RenderControllerSetDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.biomeBehavior:
        return await BiomeBehaviorDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.biomeResource:
        return await BiomeResourceDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.jigsawProcessorList:
        return await JigsawProcessorListDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.jigsawStructureSet:
        return await JigsawStructureSetDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.jigsawTemplatePool:
        return await JigsawTemplatePoolDefinition.ensureOnFile(projectItem.primaryFile);
      case ProjectItemType.jigsawStructure:
        return await JigsawStructureDefinition.ensureOnFile(projectItem.primaryFile);
    }

    return undefined;
  }

  static async ensureFoundationalDependencies(item: ProjectItem) {
    if (item.itemType === ProjectItemType.audio) {
      if (!item.isContentLoaded) {
        await item.loadContent();
      }

      if (item.primaryFile) {
        const audioFile = await AudioDefinition.ensureOnFile(item.primaryFile);

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

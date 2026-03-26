// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CrossReferenceIndexGenerator - Indexes cross-file references into ContentIndex
 *
 * ARCHITECTURE:
 * This generator populates the ContentIndex trie with annotated entries for all
 * content types that can be referenced across files. This data powers autocomplete
 * suggestions in both Monaco (web editor) and VS Code.
 *
 * REFERENCE TYPES INDEXED:
 * - Geometry identifiers (from .geo.json files)
 * - Animation identifiers (from animation files)
 * - Animation controller identifiers
 * - Render controller identifiers
 * - Particle identifiers
 * - Fog identifiers
 * - Sound event names (from sound_definitions.json)
 * - Loot table paths
 * - Recipe identifiers
 * - Biome identifiers
 * - Spawn rule identifiers
 * - Dialogue paths
 * - Function paths (.mcfunction files)
 * - Structure paths
 *
 * TYPES ALREADY INDEXED ELSEWHERE (not duplicated here):
 * - Entity IDs → TypesInfoGenerator (AnnotationCategory.entityTypeSource)
 * - Block IDs → TypesInfoGenerator (AnnotationCategory.blockTypeSource)
 * - Item IDs → TypesInfoGenerator (AnnotationCategory.itemTypeSource)
 * - Feature IDs → TypesInfoGenerator (AnnotationCategory.featureSource)
 * - Texture file paths → TextureInfoGenerator (AnnotationCategory.textureFile)
 *
 * RELATED FILES:
 * - ContentIndex.ts — The trie data structure and AnnotationCategory enum
 * - TypesInfoGenerator.ts — Indexes entity, block, item, feature IDs
 * - TextureInfoGenerator.ts — Indexes texture file paths
 * - langcore/json/CrossReferenceCompletionSource.ts — Queries this data for completions
 *
 * Last updated: February 2026
 */

import ProjectInfoItem from "./ProjectInfoItem";
import { ProjectItemType } from "../app/IProjectItemData";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import Project from "../app/Project";
import ContentIndex, { AnnotationCategory } from "../core/ContentIndex";
import ProjectInfoSet from "./ProjectInfoSet";
import ModelGeometryDefinition from "../minecraft/ModelGeometryDefinition";
import AnimationResourceDefinition from "../minecraft/AnimationResourceDefinition";
import AnimationBehaviorDefinition from "../minecraft/AnimationBehaviorDefinition";
import AnimationControllerResourceDefinition from "../minecraft/AnimationControllerResourceDefinition";
import AnimationControllerBehaviorDefinition from "../minecraft/AnimationControllerBehaviorDefinition";
import RenderControllerSetDefinition from "../minecraft/RenderControllerSetDefinition";
import ParticleEffectResourceDefinition from "../minecraft/ParticleEffectResourceDefinition";
import FogResourceDefinition from "../minecraft/FogResourceDefinition";
import RecipeBehaviorDefinition from "../minecraft/RecipeBehaviorDefinition";
import BiomeBehaviorDefinition from "../minecraft/BiomeBehaviorDefinition";
import SpawnRulesBehaviorDefinition from "../minecraft/SpawnRulesBehaviorDefinition";
import SoundDefinitionCatalogDefinition from "../minecraft/SoundDefinitionCatalogDefinition";
import StorageUtilities from "../storage/StorageUtilities";
import ProjectItem from "../app/ProjectItem";

export default class CrossReferenceIndexGenerator implements IProjectInfoGenerator {
  id = "CROSSREFINDEX";
  title = "Cross-Reference Index";

  performAddOnValidations = false;

  summarize(_info: any, _infoSet: ProjectInfoSet) {
    // No summary needed — this generator only populates the content index
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const itemsCopy = project.getItemsCopy();

    for (const projectItem of itemsCopy) {
      const path = projectItem.projectPath;
      if (!path) {
        continue;
      }

      switch (projectItem.itemType) {
        case ProjectItemType.modelGeometryJson:
          await this.indexGeometry(projectItem, contentIndex, path);
          break;

        case ProjectItemType.animationResourceJson:
          await this.indexAnimationResource(projectItem, contentIndex, path);
          break;

        case ProjectItemType.animationBehaviorJson:
          await this.indexAnimationBehavior(projectItem, contentIndex, path);
          break;

        case ProjectItemType.animationControllerResourceJson:
          await this.indexAnimationControllerResource(projectItem, contentIndex, path);
          break;

        case ProjectItemType.animationControllerBehaviorJson:
          await this.indexAnimationControllerBehavior(projectItem, contentIndex, path);
          break;

        case ProjectItemType.renderControllerJson:
          await this.indexRenderController(projectItem, contentIndex, path);
          break;

        case ProjectItemType.particleJson:
          await this.indexParticle(projectItem, contentIndex, path);
          break;

        case ProjectItemType.fogResourceJson:
          await this.indexFog(projectItem, contentIndex, path);
          break;

        case ProjectItemType.soundDefinitionCatalog:
          await this.indexSoundDefinitions(projectItem, contentIndex, path);
          break;

        case ProjectItemType.lootTableBehavior:
          this.indexLootTable(projectItem, contentIndex, path);
          break;

        case ProjectItemType.recipeBehavior:
          await this.indexRecipe(projectItem, contentIndex, path);
          break;

        case ProjectItemType.biomeBehavior:
          await this.indexBiome(projectItem, contentIndex, path);
          break;

        case ProjectItemType.spawnRuleBehavior:
          await this.indexSpawnRule(projectItem, contentIndex, path);
          break;

        case ProjectItemType.dialogueBehaviorJson:
          this.indexDialogue(projectItem, contentIndex, path);
          break;

        case ProjectItemType.MCFunction:
          this.indexFunction(projectItem, contentIndex, path);
          break;

        case ProjectItemType.structure:
          this.indexStructure(projectItem, contentIndex, path);
          break;
      }
    }

    return [];
  }

  private async indexGeometry(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (projectItem.primaryFile) {
      const modGeo = await ModelGeometryDefinition.ensureOnFile(projectItem.primaryFile);
      if (modGeo && modGeo.identifiers) {
        for (const geoId of modGeo.identifiers) {
          contentIndex.insert(geoId, path, AnnotationCategory.geometrySource);
        }
      }
    }
  }

  private async indexAnimationResource(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (projectItem.primaryFile) {
      const animDef = await AnimationResourceDefinition.ensureOnFile(projectItem.primaryFile);
      if (animDef && animDef.animations) {
        for (const animName in animDef.animations) {
          contentIndex.insert(animName, path, AnnotationCategory.animationSource);
        }
      }
    }
  }

  private async indexAnimationBehavior(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (projectItem.primaryFile) {
      const animDef = await AnimationBehaviorDefinition.ensureOnFile(projectItem.primaryFile);
      if (animDef) {
        const data = animDef.data;
        if (data && data.animations) {
          for (const animName in data.animations) {
            contentIndex.insert(animName, path, AnnotationCategory.animationSource);
          }
        }
      }
    }
  }

  private async indexAnimationControllerResource(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (projectItem.primaryFile) {
      const acDef = await AnimationControllerResourceDefinition.ensureOnFile(projectItem.primaryFile);
      if (acDef && acDef.idList) {
        for (const acId of acDef.idList) {
          contentIndex.insert(acId, path, AnnotationCategory.animationControllerSource);
        }
      }
    }
  }

  private async indexAnimationControllerBehavior(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (projectItem.primaryFile) {
      const acDef = await AnimationControllerBehaviorDefinition.ensureOnFile(projectItem.primaryFile);
      if (acDef) {
        const data = acDef.data;
        if (data && data.animation_controllers) {
          for (const acId in data.animation_controllers) {
            contentIndex.insert(acId, path, AnnotationCategory.animationControllerSource);
          }
        }
      }
    }
  }

  private async indexRenderController(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (projectItem.primaryFile) {
      const rcDef = await RenderControllerSetDefinition.ensureOnFile(projectItem.primaryFile);
      if (rcDef && rcDef.idList) {
        for (const rcId of rcDef.idList) {
          contentIndex.insert(rcId, path, AnnotationCategory.renderControllerSource);
        }
      }
    }
  }

  private async indexParticle(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (projectItem.primaryFile) {
      const particleDef = await ParticleEffectResourceDefinition.ensureOnFile(projectItem.primaryFile);
      if (particleDef && particleDef.id) {
        contentIndex.insert(particleDef.id, path, AnnotationCategory.particleSource);
      }
    }
  }

  private async indexFog(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (projectItem.primaryFile) {
      const fogDef = await FogResourceDefinition.ensureOnFile(projectItem.primaryFile);
      if (fogDef && fogDef.id) {
        contentIndex.insert(fogDef.id, path, AnnotationCategory.fogSource);
      }
    }
  }

  private async indexSoundDefinitions(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (projectItem.primaryFile) {
      const soundDef = await SoundDefinitionCatalogDefinition.ensureOnFile(projectItem.primaryFile);
      if (soundDef) {
        const soundNames = soundDef.getSoundDefinitionSetNameList();
        if (soundNames) {
          for (const soundName of soundNames) {
            contentIndex.insert(soundName, path, AnnotationCategory.soundEventSource);
          }
        }
      }
    }
  }

  private indexLootTable(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    // Loot tables are referenced by their path relative to the pack root
    // e.g., "loot_tables/entities/zombie.json"
    const normalizedPath = path.replace(/\\/g, "/");
    const lootTablesIdx = normalizedPath.indexOf("loot_tables/");
    if (lootTablesIdx >= 0) {
      const lootPath = normalizedPath.substring(lootTablesIdx);
      contentIndex.insert(lootPath, path, AnnotationCategory.lootTableSource);
    }
  }

  private async indexRecipe(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (projectItem.primaryFile) {
      const recipeDef = await RecipeBehaviorDefinition.ensureOnFile(projectItem.primaryFile);
      if (recipeDef && recipeDef.id) {
        contentIndex.insert(recipeDef.id, path, AnnotationCategory.recipeSource);
      }
    }
  }

  private async indexBiome(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (projectItem.primaryFile) {
      const biomeDef = await BiomeBehaviorDefinition.ensureOnFile(projectItem.primaryFile);
      if (biomeDef && biomeDef.id) {
        contentIndex.insert(biomeDef.id, path, AnnotationCategory.biomeSource);
      }
    }
  }

  private async indexSpawnRule(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (projectItem.primaryFile) {
      const spawnDef = await SpawnRulesBehaviorDefinition.ensureOnFile(projectItem.primaryFile);
      if (spawnDef && spawnDef.id) {
        contentIndex.insert(spawnDef.id, path, AnnotationCategory.spawnRuleSource);
      }
    }
  }

  private indexDialogue(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    // Dialogues are referenced by their scene tag, but we index path as well
    const normalizedPath = path.replace(/\\/g, "/");
    const baseName = StorageUtilities.getBaseFromName(normalizedPath);
    if (baseName) {
      contentIndex.insert(baseName, path, AnnotationCategory.dialogueSource);
    }
  }

  private indexFunction(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    // Functions are referenced by path relative to functions/ folder, without extension
    // e.g., "my_function" from "functions/my_function.mcfunction"
    const normalizedPath = path.replace(/\\/g, "/");
    const functionsIdx = normalizedPath.indexOf("functions/");
    if (functionsIdx >= 0) {
      let funcPath = normalizedPath.substring(functionsIdx + "functions/".length);
      // Remove .mcfunction extension
      if (funcPath.endsWith(".mcfunction")) {
        funcPath = funcPath.substring(0, funcPath.length - ".mcfunction".length);
      }
      contentIndex.insert(funcPath, path, AnnotationCategory.functionSource);
    }
  }

  private indexStructure(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    path: string
  ) {
    // Structures are referenced by namespace:name format or by path
    const normalizedPath = path.replace(/\\/g, "/");
    const structuresIdx = normalizedPath.indexOf("structures/");
    if (structuresIdx >= 0) {
      let structPath = normalizedPath.substring(structuresIdx + "structures/".length);
      // Remove .mcstructure extension
      if (structPath.endsWith(".mcstructure")) {
        structPath = structPath.substring(0, structPath.length - ".mcstructure".length);
      }
      contentIndex.insert(structPath, path, AnnotationCategory.structureSource);
    }
  }
}

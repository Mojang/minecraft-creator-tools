// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import Project from "../app/Project";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import BlocksCatalogDefinition from "../minecraft/BlocksCatalogDefinition";
import TerrainTextureCatalogDefinition from "../minecraft/TerrainTextureCatalogDefinition";
import ParticleEffectResourceDefinition from "../minecraft/ParticleEffectResourceDefinition";
import ItemTextureCatalogDefinition from "../minecraft/ItemTextureCatalogDefinition";
import AttachableResourceDefinition from "../minecraft/AttachableResourceDefinition";
import FlipbookTextureCatalogDefinition from "../minecraft/FlipbookTextureCatalogDefinition";
import Database from "../minecraft/Database";
import JsonUIResourceDefinition from "../minecraft/JsonUIResourceDefinition";
import ContentIndex, { AnnotationCategory } from "../core/ContentIndex";
import TextureDefinition from "../minecraft/TextureDefinition";

export enum TextureInfoGeneratorTest {
  tooManyTextureHandles = 100,
  textures = 101,
}

/**
 * Validates texture references and aggregates texture usage information.
 *
 * @see {@link ../../public/data/forms/mctoolsval/texture.form.json} for topic definitions
 */
export default class TextureInfoGenerator implements IProjectInfoGenerator {
  id = "TEXTURE";
  title = "Texture Validation";

  performAddOnValidations = false;

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.textureCount = infoSet.getSummedDataValue("TEXTURE", TextureInfoGeneratorTest.textures);
  }

  /**
   * Cache for Database.matchesVanillaPath() results across calls.
   * The same texture paths are checked many times; caching eliminates redundant folder I/O.
   */
  private _vanillaPathCache: Map<string, boolean> = new Map();

  /**
   * Cached version of Database.matchesVanillaPath() that avoids repeated folder I/O
   * for the same texture path.
   */
  private async _matchesVanillaPathCached(path: string): Promise<boolean> {
    const cached = this._vanillaPathCache.get(path);
    if (cached !== undefined) {
      return cached;
    }
    const result = await Database.matchesVanillaPath(path);
    this._vanillaPathCache.set(path, result);
    return result;
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    const textureHandles = new Set<string>();
    const allTexturePaths = new Set<string>();
    const blockTextureRefs = new Set<string>();
    const blockTexturePaths = new Set<string>();
    const entityTexturePaths = new Set<string>();
    const entityVanillaTexturePaths = new Set<string>();
    const attachableTextureRefs = new Set<string>();
    const particleTextureRefs = new Set<string>();
    const particleTexturePaths = new Set<string>();
    const particleVanillaTexturePaths = new Set<string>();
    const jsonUITextureRefs = new Set<string>();
    const jsonUITexturePaths = new Set<string>();
    const jsonUIVanillaTexturePaths = new Set<string>();

    const terrainTextureRefs = new Set<string>();
    const terrainTexturePaths = new Set<string>();
    const flipbookTextureRefs = new Set<string>();
    const flipbookTexturePaths = new Set<string>();
    const itemTexturePaths = new Set<string>();
    const itemTextureVanillaPaths = new Set<string>();
    const entitySpawnEggTextures = new Set<string>();
    const textureCountPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      TextureInfoGeneratorTest.textures,
      "Textures"
    );
    items.push(textureCountPi);

    // Process each item type separately using getItemsByType() for efficiency,
    // instead of iterating all 15K items and filtering by type.
    const blocksCatalogItems = project.getItemsByType(ProjectItemType.blocksCatalogResourceJson);
    const particleItems = project.getItemsByType(ProjectItemType.particleJson);
    const uiItems = project.getItemsByType(ProjectItemType.uiJson);
    const terrainTexItems = project.getItemsByType(ProjectItemType.terrainTextureCatalogResourceJson);
    const flipbookItems = project.getItemsByType(ProjectItemType.flipbookTexturesJson);
    const itemTexItems = project.getItemsByType(ProjectItemType.itemTextureJson);
    const entityResItems = project.getItemsByType(ProjectItemType.entityTypeResource);
    const attachableItems = project.getItemsByType(ProjectItemType.attachableResourceJson);
    const textureItems = project.getItemsByType(ProjectItemType.texture);
    const uiTextureItems = project.getItemsByType(ProjectItemType.uiTexture);

    for (const projectItem of blocksCatalogItems) {
      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (!projectItem.primaryFile) {
        continue;
      }

      const blockCat = await BlocksCatalogDefinition.ensureOnFile(projectItem.primaryFile);

      if (!blockCat?.blocksCatalog) {
        continue;
      }

      for (const resourceId in blockCat.blocksCatalog) {
        const resource = blockCat.blocksCatalog[resourceId];

        if (!resource?.textures) {
          continue;
        }

        textureCountPi.incrementFeature("Block Resource Count");
        blockTextureRefs.add(resourceId);

        if (typeof resource.textures === "string") {
          allTexturePaths.add(resource.textures);
          blockTexturePaths.add(resource.textures);
        } else {
          for (const texturePathKey in resource.textures) {
            const textureVal = (resource.textures as any)[texturePathKey];
            allTexturePaths.add(textureVal);
            blockTexturePaths.add(textureVal);
          }
        }
      }
    }

    for (const projectItem of particleItems) {
      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (!projectItem.primaryFile) {
        continue;
      }

      const particleEffect = await ParticleEffectResourceDefinition.ensureOnFile(projectItem.primaryFile);
      const desc = particleEffect?.data?.particle_effect?.description;

      if (!desc?.identifier || !desc.basic_render_parameters?.texture) {
        continue;
      }

      const texturePath = desc.basic_render_parameters.texture;
      const matchesVP = await this._matchesVanillaPathCached(desc.basic_render_parameters.texture);

      if (!matchesVP) {
        textureHandles.add(texturePath);
        particleTextureRefs.add(desc.identifier);
        allTexturePaths.add(texturePath);
        particleTexturePaths.add(texturePath);
      } else {
        particleVanillaTexturePaths.add(texturePath);
      }
    }

    for (const projectItem of uiItems) {
      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (!projectItem.primaryFile) {
        continue;
      }

      const jsonUI = await JsonUIResourceDefinition.ensureOnFile(projectItem.primaryFile);

      if (!jsonUI) {
        continue;
      }

      for (const ref of jsonUI.getControlRefs()) {
        jsonUITextureRefs.add(ref);
      }

      const texturePaths = jsonUI.getTexturePaths();

      for (const texturePath of texturePaths) {
        const matchesVP = await this._matchesVanillaPathCached(texturePath);

        if (!matchesVP) {
          textureHandles.add(texturePath);
          allTexturePaths.add(texturePath);
          jsonUITexturePaths.add(texturePath);
        } else {
          jsonUIVanillaTexturePaths.add(texturePath);
        }
      }
    }

    for (const projectItem of terrainTexItems) {
      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (!projectItem.primaryFile) {
        continue;
      }

      const terrainTextureCat = await TerrainTextureCatalogDefinition.ensureOnFile(projectItem.primaryFile);

      if (!terrainTextureCat?.data?.texture_data) {
        continue;
      }

      for (const terrainTextureId in terrainTextureCat.data.texture_data) {
        const terrainTexture = terrainTextureCat.data.texture_data[terrainTextureId];

        if (!terrainTexture?.textures) {
          continue;
        }

        textureCountPi.incrementFeature("Terrain Texture Resource Count");
        terrainTextureRefs.add(terrainTextureId);

        if (typeof terrainTexture.textures === "string") {
          terrainTexturePaths.add(terrainTexture.textures);
        }
      }
    }

    for (const projectItem of flipbookItems) {
      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (!projectItem.primaryFile) {
        continue;
      }

      const flipbookTexturesCat = await FlipbookTextureCatalogDefinition.ensureOnFile(projectItem.primaryFile);

      if (!flipbookTexturesCat?.data || !Array.isArray(flipbookTexturesCat.data)) {
        continue;
      }

      const pathId = projectItem.primaryFile.storageRelativePath + "_flipbooktextures";
      allTexturePaths.add(pathId);

      for (const flipbookTexture of flipbookTexturesCat.data) {
        if (!flipbookTexture?.flipbook_texture) {
          continue;
        }

        textureCountPi.incrementFeature("Flipbook Texture Resource Count");
        textureHandles.add(flipbookTexture.flipbook_texture);
        flipbookTextureRefs.add(flipbookTexture.atlas_tile);
        flipbookTexturePaths.add(flipbookTexture.flipbook_texture);
      }
    }

    for (const projectItem of itemTexItems) {
      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (!projectItem.primaryFile) {
        continue;
      }

      const itemTextureCat = await ItemTextureCatalogDefinition.ensureOnFile(projectItem.primaryFile);

      if (!itemTextureCat) {
        continue;
      }

      const texturePaths = itemTextureCat.getTexturePathList();

      if (!texturePaths) {
        continue;
      }

      textureCountPi.incrementFeature("Item Texture Resource Count");

      for (const str of texturePaths) {
        const matchesVP = await this._matchesVanillaPathCached(str);

        if (!matchesVP) {
          itemTexturePaths.add(str);
        } else {
          itemTextureVanillaPaths.add(str);
        }
      }
    }

    for (const projectItem of entityResItems) {
      textureCountPi.incrementFeature("Entity Resource Count");
      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (!projectItem.primaryFile) {
        continue;
      }

      const entityTypeResourceDef = await EntityTypeResourceDefinition.ensureOnFile(projectItem.primaryFile);
      const textures = entityTypeResourceDef?.data?.textures;

      if (!textures) {
        continue;
      }

      let textureCount = 0;

      for (const texture in textures) {
        const texturePath = textures[texture];

        if (texturePath) {
          const matchesVP = await this._matchesVanillaPathCached(texturePath);

          if (!matchesVP) {
            textureHandles.add(texturePath);
            entityTexturePaths.add(texturePath);
            allTexturePaths.add(texturePath);
          } else {
            entityVanillaTexturePaths.add(texturePath);
          }
        }
        textureCount++;
      }

      textureCountPi.incrementFeature("Texture References", "Count", textureCount);
      textureCountPi.incrementFeature("Entity References", "Count", textureCount);
    }

    for (const projectItem of attachableItems) {
      textureCountPi.incrementFeature("Attachable Resource Count");

      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (!projectItem.primaryFile) {
        continue;
      }

      const attachableResourceDef = await AttachableResourceDefinition.ensureOnFile(projectItem.primaryFile);
      const textures = attachableResourceDef?.data?.textures;

      if (!textures) {
        continue;
      }

      let textureCount = 0;

      for (const texture in textures) {
        const texturePath = textures[texture];

        if (texturePath) {
          textureHandles.add(texturePath);
          attachableTextureRefs.add(texturePath);
          allTexturePaths.add(texturePath);
          textureCount++;
        }
      }

      textureCountPi.incrementFeature("Texture References", "Count", textureCount);
      textureCountPi.incrementFeature("Attachable References", "Count", textureCount);
    }

    // Process texture and UI texture items
    const allTextureSourceItems = [...textureItems, ...uiTextureItems];
    for (const projectItem of allTextureSourceItems) {
      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (!projectItem.primaryFile) {
        continue;
      }

      textureCountPi.incrementFeature("File Count");

      const textureResourceDef = await TextureDefinition.ensureOnFile(projectItem.primaryFile);

      if (!textureResourceDef?.data) {
        continue;
      }

      const texturePath = textureResourceDef.getReferencePath();

      if (texturePath && projectItem.projectPath) {
        contentIndex.insert(texturePath, projectItem.projectPath, AnnotationCategory.textureFile);
      }
    }

    if (textureHandles.size > 0) {
      textureCountPi.incrementFeature("Unique Texture Handles (estimated)", "Count", textureHandles.size);
    }
    if (allTexturePaths.size > 0) {
      textureCountPi.incrementFeature("Unique Texture Paths", "Count", allTexturePaths.size);
    }

    if (particleTextureRefs.size > 0) {
      textureCountPi.incrementFeature("Unique Particle Texture References", "Count", particleTextureRefs.size);
    }
    if (particleTexturePaths.size > 0) {
      textureCountPi.incrementFeature("Unique Particle Texture Paths", "Count", particleTexturePaths.size);
    }

    if (particleVanillaTexturePaths.size > 0) {
      textureCountPi.incrementFeature(
        "Unique Particle Texture Vanilla Paths",
        "Count",
        particleVanillaTexturePaths.size
      );
    }

    if (jsonUITextureRefs.size > 0) {
      textureCountPi.incrementFeature("Unique JSON UI Texture References", "Count", jsonUITextureRefs.size);
    }

    if (jsonUITexturePaths.size > 0) {
      textureCountPi.incrementFeature("Unique JSON UI Texture Paths", "Count", jsonUITexturePaths.size);
    }
    if (jsonUIVanillaTexturePaths.size > 0) {
      textureCountPi.incrementFeature(
        "Unique JSON UI Texture Vanilla Paths",
        "Count",
        jsonUIVanillaTexturePaths.size
      );
    }

    if (entityTexturePaths.size > 0) {
      textureCountPi.incrementFeature("Unique Entity Texture Paths", "Count", entityTexturePaths.size);
    }

    if (entityVanillaTexturePaths.size > 0) {
      textureCountPi.incrementFeature("Unique Entity Texture Vanilla Paths", "Count", entityVanillaTexturePaths.size);
    }

    if (attachableTextureRefs.size > 0) {
      textureCountPi.incrementFeature("Unique Attachable Texture References", "Count", attachableTextureRefs.size);
    }

    if (terrainTextureRefs.size > 0) {
      textureCountPi.incrementFeature("Unique Terrain Texture References", "Count", terrainTextureRefs.size);
    }

    if (terrainTexturePaths.size > 0) {
      textureCountPi.incrementFeature("Unique Terrain Texture Paths", "Count", terrainTexturePaths.size);
    }

    if (itemTexturePaths.size > 0) {
      textureCountPi.incrementFeature("Unique Item Texture Paths", "Count", itemTexturePaths.size);
    }

    if (flipbookTextureRefs.size > 0) {
      textureCountPi.incrementFeature("Unique Flipbook Texture References", "Count", flipbookTextureRefs.size);
    }

    if (flipbookTexturePaths.size > 0) {
      textureCountPi.incrementFeature("Unique Flipbook Texture Paths", "Count", flipbookTexturePaths.size);
    }

    if (blockTextureRefs.size > 0) {
      textureCountPi.incrementFeature("Unique Block Texture References", "Count", blockTextureRefs.size);
    }

    if (blockTexturePaths.size > 0) {
      textureCountPi.incrementFeature("Unique Block Texture Paths", "Count", blockTexturePaths.size);
    }

    if (entitySpawnEggTextures.size > 0) {
      textureCountPi.incrementFeature(
        "Unique Entity Spawn Egg Texture References",
        "Count",
        entitySpawnEggTextures.size
      );
    }

    if (this.performAddOnValidations && textureHandles.size > 800) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          TextureInfoGeneratorTest.tooManyTextureHandles,
          "Uses more than 800 texture handles, which could impact overall Minecraft usage",
          undefined,
          textureHandles.size
        )
      );
    }

    return items;
  }
}

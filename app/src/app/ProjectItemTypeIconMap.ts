// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* ═══════════════════════════════════════════════════════════════════════════
   PROJECT ITEM TYPE ICON MAP - SVG File Mappings
   
   Maps ProjectItemType enum values to external SVG icon file paths.
   Icons are stored in /public/res/icons/itemtypes/ and loaded dynamically.
   
   Fallback Order:
   1. Specific icon for the exact item type
   2. Group icon for the item's semantic category
   3. Default generic icon
   ═══════════════════════════════════════════════════════════════════════════ */

import { ProjectItemType } from "./IProjectItemData";
import { ProjectItemTypeGroup, getProjectItemTypeGroup } from "./ProjectItemTypeInfo";

/**
 * Base path for item type SVG icons.
 */
export const ICON_BASE_PATH = "/res/icons/itemtypes";

/**
 * Maps specific ProjectItemType values to their SVG icon filenames.
 * If a type is not listed here, it falls back to its group icon.
 */
export const ProjectItemTypeIconFiles: Partial<Record<ProjectItemType, string>> = {
  // ═══ Scripts & Logic ═══
  [ProjectItemType.ts]: "ts.svg",
  [ProjectItemType.js]: "js.svg",
  [ProjectItemType.MCFunction]: "mcfunction.svg",
  [ProjectItemType.testJs]: "test.svg",
  [ProjectItemType.buildProcessedJs]: "build-process.svg",
  [ProjectItemType.tickJson]: "tick.svg",
  [ProjectItemType.animationBehaviorJson]: "animation.svg",
  [ProjectItemType.animationControllerBehaviorJson]: "animation-controller.svg",

  // ═══ Entity Types ═══
  [ProjectItemType.entityTypeBehavior]: "entity-type-behavior.svg",
  [ProjectItemType.entityTypeResource]: "entity-type-resource.svg",
  [ProjectItemType.spawnRuleBehavior]: "spawn-rule.svg",
  [ProjectItemType.dialogueBehaviorJson]: "dialogue.svg",
  [ProjectItemType.behaviorTreeJson]: "behavior-tree.svg",

  // ═══ Item Types ═══
  [ProjectItemType.itemTypeBehavior]: "item-type-behavior.svg",
  [ProjectItemType.itemTypeLegacyResource]: "item-type-resource.svg",
  [ProjectItemType.attachableResourceJson]: "attachable.svg",
  [ProjectItemType.lootTableBehavior]: "loot-table.svg",
  [ProjectItemType.recipeBehavior]: "recipe.svg",
  [ProjectItemType.tradingBehaviorJson]: "trading.svg",
  [ProjectItemType.itemTextureJson]: "item-texture.svg",

  // ═══ Block Types ═══
  [ProjectItemType.blockTypeBehavior]: "block-type-behavior.svg",
  [ProjectItemType.blockTypeResourceJsonDoNotUse]: "block-type-resource.svg",
  [ProjectItemType.blocksCatalogResourceJson]: "blocks-catalog.svg",
  [ProjectItemType.blockCulling]: "block-culling.svg",
  [ProjectItemType.terrainTextureCatalogResourceJson]: "terrain-texture.svg",
  [ProjectItemType.voxelShapeBehavior]: "voxel-shape.svg",

  // ═══ World & Worldgen ═══
  [ProjectItemType.worldFolder]: "world.svg",
  [ProjectItemType.MCWorld]: "mcworld.svg",
  [ProjectItemType.MCTemplate]: "mctemplate.svg",
  [ProjectItemType.MCProject]: "mcproject.svg",
  [ProjectItemType.levelDat]: "level-dat.svg",
  [ProjectItemType.levelDatOld]: "level-dat.svg",
  [ProjectItemType.levelDbLdb]: "leveldb.svg",
  [ProjectItemType.levelDbLog]: "leveldb.svg",
  [ProjectItemType.levelDbCurrent]: "leveldb.svg",
  [ProjectItemType.levelDbManifest]: "leveldb.svg",
  [ProjectItemType.biomeBehavior]: "biome.svg",
  [ProjectItemType.biomeResource]: "biome.svg",
  [ProjectItemType.featureRuleBehavior]: "feature-rule.svg",
  [ProjectItemType.featureBehavior]: "feature.svg",
  [ProjectItemType.jigsawStructureSet]: "jigsaw.svg",
  [ProjectItemType.jigsawStructure]: "jigsaw.svg",
  [ProjectItemType.jigsawTemplatePool]: "jigsaw.svg",
  [ProjectItemType.jigsawProcessorList]: "jigsaw.svg",
  [ProjectItemType.dimensionJson]: "dimension.svg",
  [ProjectItemType.volumeBehaviorJson]: "volume.svg",
  [ProjectItemType.structure]: "structure.svg",
  [ProjectItemType.worldTemplateManifestJson]: "world-template.svg",

  // ═══ Models & Animations ═══
  [ProjectItemType.modelGeometryJson]: "model-geometry.svg",
  [ProjectItemType.animationResourceJson]: "animation.svg",
  [ProjectItemType.animationControllerResourceJson]: "animation-controller.svg",
  [ProjectItemType.renderControllerJson]: "render-controller.svg",
  [ProjectItemType.particleJson]: "particle.svg",

  // ═══ Textures & Audio ═══
  [ProjectItemType.texture]: "texture.svg",
  [ProjectItemType.image]: "image.svg",
  [ProjectItemType.packIconImage]: "pack-icon.svg",
  [ProjectItemType.marketingAssetImage]: "marketing-asset.svg",
  [ProjectItemType.storeAssetImage]: "store-asset.svg",
  [ProjectItemType.flipbookTexturesJson]: "flipbook-textures.svg",
  [ProjectItemType.audio]: "audio.svg",
  [ProjectItemType.soundCatalog]: "sound-catalog.svg",
  [ProjectItemType.soundDefinitionCatalog]: "sound-definition.svg",
  [ProjectItemType.musicDefinitionJson]: "music-definition.svg",
  [ProjectItemType.fogResourceJson]: "fog.svg",
  [ProjectItemType.textureSetJson]: "texture-set.svg",

  // ═══ Vibrant Visuals ═══
  [ProjectItemType.lightingJson]: "lighting.svg",
  [ProjectItemType.colorGradingJson]: "lighting.svg",
  [ProjectItemType.atmosphericsJson]: "fog.svg",
  [ProjectItemType.pbrJson]: "texture-set.svg",
  [ProjectItemType.pointLightsJson]: "lighting.svg",

  // ═══ UI/UX ═══
  [ProjectItemType.uiJson]: "ui.svg",
  [ProjectItemType.lang]: "language.svg",
  [ProjectItemType.languagesCatalogJson]: "language.svg",

  // ═══ Config & Dev ═══
  [ProjectItemType.tsconfigJson]: "tsconfig.svg",
  [ProjectItemType.packageJson]: "package-json.svg",
  [ProjectItemType.packageLockJson]: "package-json.svg",
  [ProjectItemType.esLintConfigMjs]: "eslint-config.svg",
  [ProjectItemType.env]: "env-file.svg",
  [ProjectItemType.behaviorPackManifestJson]: "manifest.svg",
  [ProjectItemType.resourcePackManifestJson]: "manifest.svg",
  [ProjectItemType.behaviorPackFolder]: "behavior-pack.svg",
  [ProjectItemType.resourcePackFolder]: "resource-pack.svg",
  [ProjectItemType.cameraBehaviorJson]: "camera.svg",
  [ProjectItemType.cameraResourceJson]: "camera.svg",
  [ProjectItemType.materialsResourceJson]: "material.svg",
  [ProjectItemType.material]: "material.svg",

  // ═══ Packaging ═══
  [ProjectItemType.MCAddon]: "mcaddon.svg",
  [ProjectItemType.MCPack]: "mcpack.svg",
  [ProjectItemType.zip]: "zip.svg",

  // ═══ Skins & Personas ═══
  [ProjectItemType.skinCatalogJson]: "skin.svg",
  [ProjectItemType.skinPackManifestJson]: "skin-pack.svg",
  [ProjectItemType.skinPackFolder]: "skin-pack.svg",

  // ═══ Meta/Documentation ═══
  [ProjectItemType.dataForm]: "dataform.svg",
  [ProjectItemType.docInfoJson]: "doc.svg",
  [ProjectItemType.markdownDocumentation]: "markdown.svg",
  [ProjectItemType.commandSetDefinitionJson]: "command-set.svg",

  // ═══ Design ═══
  [ProjectItemType.actionSet]: "action-set.svg",
  [ProjectItemType.designPackFolder]: "design-pack.svg",

  // ═══ Unknown/Other ═══
  [ProjectItemType.unknown]: "unknown.svg",
  [ProjectItemType.unknownJson]: "json.svg",
};

/**
 * Maps ProjectItemTypeGroup to their SVG icon filenames.
 * Used as fallback when no specific icon exists for an item type.
 */
export const ProjectItemTypeGroupIconFiles: Record<ProjectItemTypeGroup, string> = {
  [ProjectItemTypeGroup.scriptsLogic]: "ts.svg",
  [ProjectItemTypeGroup.entityTypes]: "entity-type-behavior.svg",
  [ProjectItemTypeGroup.itemTypes]: "item-type-behavior.svg",
  [ProjectItemTypeGroup.blockTypes]: "block-type-behavior.svg",
  [ProjectItemTypeGroup.worldWorldgen]: "world.svg",
  [ProjectItemTypeGroup.modelsAnimations]: "model-geometry.svg",
  [ProjectItemTypeGroup.texturesAudio]: "texture.svg",
  [ProjectItemTypeGroup.vibrantVisuals]: "lighting.svg",
  [ProjectItemTypeGroup.uiUx]: "ui.svg",
  [ProjectItemTypeGroup.configDev]: "properties.svg",
  [ProjectItemTypeGroup.packaging]: "mcpack.svg",
  [ProjectItemTypeGroup.skinPersona]: "skin.svg",
  [ProjectItemTypeGroup.meta]: "doc.svg",
  [ProjectItemTypeGroup.design]: "design-pack.svg",
  [ProjectItemTypeGroup.unknown]: "default.svg",
};

/**
 * Gets the SVG icon filename for a specific project item type.
 * Falls back to group icon if no specific icon is defined.
 */
export function getIconFilenameForProjectItemType(itemType: ProjectItemType): string {
  const specificIcon = ProjectItemTypeIconFiles[itemType];
  if (specificIcon) {
    return specificIcon;
  }

  const group = getProjectItemTypeGroup(itemType);
  return ProjectItemTypeGroupIconFiles[group] || "default.svg";
}

/**
 * Gets the full path to the SVG icon for a project item type.
 */
export function getIconPathForProjectItemType(itemType: ProjectItemType): string {
  const filename = getIconFilenameForProjectItemType(itemType);
  return `${ICON_BASE_PATH}/${filename}`;
}

/**
 * Gets the full path to the SVG icon for a project item type group.
 */
export function getIconPathForProjectItemTypeGroup(group: ProjectItemTypeGroup): string {
  const filename = ProjectItemTypeGroupIconFiles[group] || "default.svg";
  return `${ICON_BASE_PATH}/${filename}`;
}

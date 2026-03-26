// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* ═══════════════════════════════════════════════════════════════════════════
   PROJECT ITEM TYPE INFO - Semantic Color System & Categorization
   
   This module provides a unified system for categorizing, coloring, and
   providing icons for all Minecraft project item types. The design uses
   Minecraft-themed colors inspired by in-game materials and concepts.
   
   CATEGORY GROUPS (semantic groupings for UI display):
   ─────────────────────────────────────────────────────
   1. Scripts/Logic (Emerald Green)    - TypeScript, JavaScript, functions
   2. Entity Types (Minecraft Green)  - Entities, spawn rules, dialogues
   3. Item Types (Gold/Amber)          - Items, loot tables, recipes, trading
   4. Block Types (Stone Gray)         - Blocks, terrain, culling
   5. World/Worldgen (Grass Lime)      - Biomes, features, dimensions, worlds
   6. Models/Animations (Diamond Cyan) - Geometry, animations, render controllers
   7. Textures/Audio (Minecraft Green) - Textures, sounds, particles
   8. Vibrant Visuals (Minecraft Green) - Lighting, atmospherics, PBR
   9. UI/UX (Pumpkin Orange)           - JSON UI, global variables
   10. Config/Dev (Iron Slate)         - Package.json, tsconfig, VS Code
   11. Design (Lapis Blue)             - Design pack content
   12. Packaging (Redstone Red)        - MCAddon, MCPack, ZIP files
   
   See: docs/ux/ColorSystem.md for full color palette
   ═══════════════════════════════════════════════════════════════════════════ */

import IColor from "../core/IColor";
import { ProjectItemType } from "./IProjectItemData";

/**
 * Semantic category groups for project items.
 * These map to visual groupings in the UI item list.
 */
export enum ProjectItemTypeGroup {
  design = "design",
  scriptsLogic = "scriptsLogic",
  entityTypes = "entityTypes",
  itemTypes = "itemTypes",
  blockTypes = "blockTypes",
  worldWorldgen = "worldWorldgen",
  modelsAnimations = "modelsAnimations",
  texturesAudio = "texturesAudio",
  vibrantVisuals = "vibrantVisuals",
  uiUx = "uiUx",
  configDev = "configDev",
  packaging = "packaging",
  skinPersona = "skinPersona",
  meta = "meta",
  unknown = "unknown",
}

/**
 * Color palette for project item type groups.
 * Colors are inspired by Minecraft materials and items.
 */
export const ProjectItemTypeGroupColors: Record<ProjectItemTypeGroup, IColor> = {
  // Emerald Green - Scripts and logic
  [ProjectItemTypeGroup.scriptsLogic]: { red: 16, green: 185, blue: 129 }, // #10b981

  // Minecraft Green - Entity types
  [ProjectItemTypeGroup.entityTypes]: { red: 82, green: 165, blue: 53 }, // #52a535

  // Gold/Amber - Item types
  [ProjectItemTypeGroup.itemTypes]: { red: 245, green: 158, blue: 11 }, // #f59e0b

  // Stone Gray - Block types
  [ProjectItemTypeGroup.blockTypes]: { red: 120, green: 113, blue: 108 }, // #78716c

  // Grass Lime - World and worldgen
  [ProjectItemTypeGroup.worldWorldgen]: { red: 132, green: 204, blue: 22 }, // #84cc16

  // Diamond Cyan - Models and animations
  [ProjectItemTypeGroup.modelsAnimations]: { red: 6, green: 182, blue: 212 }, // #06b6d4

  // Minecraft Green - Textures and audio
  [ProjectItemTypeGroup.texturesAudio]: { red: 82, green: 165, blue: 53 }, // #52a535

  // Minecraft Green - Vibrant visuals
  [ProjectItemTypeGroup.vibrantVisuals]: { red: 82, green: 165, blue: 53 }, // #52a535

  // Pumpkin Orange - UI/UX
  [ProjectItemTypeGroup.uiUx]: { red: 249, green: 115, blue: 22 }, // #f97316

  // Iron Slate - Config and dev tools
  [ProjectItemTypeGroup.configDev]: { red: 100, green: 116, blue: 139 }, // #64748b

  // Lapis Blue - Design pack content
  [ProjectItemTypeGroup.design]: { red: 59, green: 130, blue: 246 }, // #3b82f6

  // Redstone Red - Packaging
  [ProjectItemTypeGroup.packaging]: { red: 239, green: 68, blue: 68 }, // #ef4444

  // Leather Brown - Skins and personas
  [ProjectItemTypeGroup.skinPersona]: { red: 180, green: 128, blue: 90 }, // #b4805a

  // Book Brown - Meta/documentation
  [ProjectItemTypeGroup.meta]: { red: 146, green: 114, blue: 87 }, // #927257

  // Coal Gray - Unknown
  [ProjectItemTypeGroup.unknown]: { red: 82, green: 82, blue: 91 }, // #52525b
};

/**
 * Maps each ProjectItemType to its semantic group.
 */
export function getProjectItemTypeGroup(itemType: ProjectItemType): ProjectItemTypeGroup {
  switch (itemType) {
    // ═══ Design Pack ═══
    case ProjectItemType.designTexture:
    case ProjectItemType.designPackManifestJson:
    case ProjectItemType.designPackFolder:
    case ProjectItemType.actionSet:
      return ProjectItemTypeGroup.design;

    // ═══ Scripts & Logic ═══
    case ProjectItemType.ts:
    case ProjectItemType.js:
    case ProjectItemType.MCFunction:
    case ProjectItemType.testJs:
    case ProjectItemType.buildProcessedJs:
    case ProjectItemType.catalogIndexJs:
    case ProjectItemType.entityTypeBaseJs:
    case ProjectItemType.entityTypeBaseTs:
    case ProjectItemType.blockTypeBaseJs:
    case ProjectItemType.blockTypeBaseTs:
    case ProjectItemType.tickJson:
    case ProjectItemType.functionEventJson:
    case ProjectItemType.animationBehaviorJson:
    case ProjectItemType.animationControllerBehaviorJson:
      return ProjectItemTypeGroup.scriptsLogic;

    // ═══ Entity Types ═══
    case ProjectItemType.entityTypeBehavior:
    case ProjectItemType.entityTypeResource:
    case ProjectItemType.spawnRuleBehavior:
    case ProjectItemType.spawnGroupJson:
    case ProjectItemType.dialogueBehaviorJson:
    case ProjectItemType.behaviorTreeJson:
      return ProjectItemTypeGroup.entityTypes;

    // ═══ Item Types ═══
    case ProjectItemType.itemTypeBehavior:
    case ProjectItemType.itemTypeLegacyResource:
    case ProjectItemType.attachableResourceJson:
    case ProjectItemType.lootTableBehavior:
    case ProjectItemType.recipeBehavior:
    case ProjectItemType.tradingBehaviorJson:
    case ProjectItemType.craftingItemCatalog:
    case ProjectItemType.itemTextureJson:
      return ProjectItemTypeGroup.itemTypes;

    // ═══ Block Types ═══
    case ProjectItemType.blockTypeBehavior:
    case ProjectItemType.blocksCatalogResourceJson:
    case ProjectItemType.blockTypeResourceJsonDoNotUse:
    case ProjectItemType.blockCulling:
    case ProjectItemType.blockMaterialsBehaviorJson:
    case ProjectItemType.terrainTextureCatalogResourceJson:
    case ProjectItemType.voxelShapeBehavior:
      return ProjectItemTypeGroup.blockTypes;

    // ═══ World & Worldgen ═══
    case ProjectItemType.worldFolder:
    case ProjectItemType.worldTemplateManifestJson:
    case ProjectItemType.MCWorld:
    case ProjectItemType.MCTemplate:
    case ProjectItemType.MCProject:
    case ProjectItemType.levelDat:
    case ProjectItemType.levelDatOld:
    case ProjectItemType.behaviorPackListJson:
    case ProjectItemType.resourcePackListJson:
    case ProjectItemType.behaviorPackHistoryListJson:
    case ProjectItemType.resourcePackHistoryListJson:
    case ProjectItemType.levelDbLdb:
    case ProjectItemType.levelDbLog:
    case ProjectItemType.levelDbCurrent:
    case ProjectItemType.levelDbManifest:
    case ProjectItemType.worldTest:
    case ProjectItemType.biomeBehavior:
    case ProjectItemType.biomeResource:
    case ProjectItemType.biomesClientCatalogResource:
    case ProjectItemType.featureRuleBehavior:
    case ProjectItemType.featureBehavior:
    case ProjectItemType.jigsawStructureSet:
    case ProjectItemType.jigsawStructure:
    case ProjectItemType.jigsawTemplatePool:
    case ProjectItemType.jigsawProcessorList:
    case ProjectItemType.dimensionJson:
    case ProjectItemType.volumeBehaviorJson:
    case ProjectItemType.structure:
      return ProjectItemTypeGroup.worldWorldgen;

    // ═══ Models & Animations ═══
    case ProjectItemType.modelGeometryJson:
    case ProjectItemType.animationResourceJson:
    case ProjectItemType.animationControllerResourceJson:
    case ProjectItemType.renderControllerJson:
    case ProjectItemType.particleJson:
      return ProjectItemTypeGroup.modelsAnimations;

    // ═══ Textures & Audio ═══
    case ProjectItemType.texture:
    case ProjectItemType.image:
    case ProjectItemType.packIconImage:
    case ProjectItemType.marketingAssetImage:
    case ProjectItemType.storeAssetImage:
    case ProjectItemType.textureListJson:
    case ProjectItemType.flipbookTexturesJson:
    case ProjectItemType.audio:
    case ProjectItemType.soundCatalog:
    case ProjectItemType.soundDefinitionCatalog:
    case ProjectItemType.musicDefinitionJson:
    case ProjectItemType.fogResourceJson:
      return ProjectItemTypeGroup.texturesAudio;

    // ═══ Vibrant Visuals ═══
    case ProjectItemType.lightingJson:
    case ProjectItemType.colorGradingJson:
    case ProjectItemType.atmosphericsJson:
    case ProjectItemType.pbrJson:
    case ProjectItemType.pointLightsJson:
    case ProjectItemType.waterJson:
    case ProjectItemType.shadowsJson:
    case ProjectItemType.textureSetJson:
      return ProjectItemTypeGroup.vibrantVisuals;

    // ═══ UI/UX ═══
    case ProjectItemType.uiJson:
    case ProjectItemType.uiTexture:
    case ProjectItemType.ninesliceJson:
    case ProjectItemType.globalVariablesJson:
    case ProjectItemType.lang:
    case ProjectItemType.languagesCatalogJson:
    case ProjectItemType.loadingMessagesJson:
    case ProjectItemType.splashesJson:
    case ProjectItemType.emoticonsJson:
    case ProjectItemType.fontMetadataJson:
      return ProjectItemTypeGroup.uiUx;

    // ═══ Config & Dev ═══
    case ProjectItemType.tsconfigJson:
    case ProjectItemType.packageJson:
    case ProjectItemType.packageLockJson:
    case ProjectItemType.vsCodeLaunchJson:
    case ProjectItemType.vsCodeTasksJson:
    case ProjectItemType.vsCodeSettingsJson:
    case ProjectItemType.vsCodeExtensionsJson:
    case ProjectItemType.justConfigTs:
    case ProjectItemType.jsMap:
    case ProjectItemType.esLintConfigMjs:
    case ProjectItemType.env:
    case ProjectItemType.prettierRcJson:
    case ProjectItemType.jsconfigJson:
    case ProjectItemType.behaviorPackManifestJson:
    case ProjectItemType.resourcePackManifestJson:
    case ProjectItemType.behaviorPackFolder:
    case ProjectItemType.resourcePackFolder:
    case ProjectItemType.cameraBehaviorJson:
    case ProjectItemType.cameraResourceJson:
    case ProjectItemType.aimAssistPresetJson:
    case ProjectItemType.aimAssistCategoryJson:
    case ProjectItemType.educationJson:
    case ProjectItemType.fileListArrayJson:
    case ProjectItemType.sdlLayout:
    case ProjectItemType.lodJson:
    case ProjectItemType.rendererJson:
    case ProjectItemType.uniformsJson:
    case ProjectItemType.materialsResourceJson:
    case ProjectItemType.material:
    case ProjectItemType.materialSetJson:
    case ProjectItemType.materialVertex:
    case ProjectItemType.materialFragment:
    case ProjectItemType.materialGeometry:
      return ProjectItemTypeGroup.configDev;

    // ═══ Packaging ═══
    case ProjectItemType.MCAddon:
    case ProjectItemType.MCPack:
    case ProjectItemType.zip:
    case ProjectItemType.contentsJson:
      return ProjectItemTypeGroup.packaging;

    // ═══ Skins & Personas ═══
    case ProjectItemType.skinCatalogJson:
    case ProjectItemType.skinPackGeometryJson:
    case ProjectItemType.skinPackTextureBackCompatJson:
    case ProjectItemType.skinPackManifestJson:
    case ProjectItemType.skinPackFolder:
    case ProjectItemType.personaJson:
    case ProjectItemType.personaManifestJson:
    case ProjectItemType.personaPackFolder:
      return ProjectItemTypeGroup.skinPersona;

    // ═══ Meta/Documentation ═══
    case ProjectItemType.dataForm:
    case ProjectItemType.docInfoJson:
    case ProjectItemType.scriptTypesJson:
    case ProjectItemType.commandSetDefinitionJson:
    case ProjectItemType.docfxJson:
    case ProjectItemType.jsdocJson:
    case ProjectItemType.markdownDocumentation:
    case ProjectItemType.documentedTypeFolder:
    case ProjectItemType.documentedCommandFolder:
    case ProjectItemType.contentIndexJson:
    case ProjectItemType.contentReportJson:
    case ProjectItemType.mcToolsProjectPreferences:
    case ProjectItemType.projectSummaryMetadata:
    case ProjectItemType.engineOrderingJson:
    case ProjectItemType.vanillaDataJson:
    case ProjectItemType.tagsMetadata:
      return ProjectItemTypeGroup.meta;

    // ═══ Unknown ═══
    case ProjectItemType.unknown:
    case ProjectItemType.unknownJson:
    default:
      return ProjectItemTypeGroup.unknown;
  }
}

/**
 * Gets the semantic color for a project item type.
 */
export function getColorForProjectItemType(itemType: ProjectItemType): IColor {
  const group = getProjectItemTypeGroup(itemType);
  return { ...ProjectItemTypeGroupColors[group] };
}

/**
 * Gets the hex color string for a project item type.
 */
export function getHexColorForProjectItemType(itemType: ProjectItemType): string {
  const color = getColorForProjectItemType(itemType);
  return `#${color.red.toString(16).padStart(2, "0")}${color.green.toString(16).padStart(2, "0")}${color.blue
    .toString(16)
    .padStart(2, "0")}`;
}

/**
 * Display order for groups in the UI item list.
 * Order: Design → Scripts → Entities → Items → Blocks → World → Models → Textures → VV → UI → Config → Packaging → Skins → Meta → Unknown
 */
export const ProjectItemTypeGroupSortOrder: ProjectItemTypeGroup[] = [
  ProjectItemTypeGroup.design,
  ProjectItemTypeGroup.scriptsLogic,
  ProjectItemTypeGroup.entityTypes,
  ProjectItemTypeGroup.itemTypes,
  ProjectItemTypeGroup.blockTypes,
  ProjectItemTypeGroup.worldWorldgen,
  ProjectItemTypeGroup.modelsAnimations,
  ProjectItemTypeGroup.texturesAudio,
  ProjectItemTypeGroup.vibrantVisuals,
  ProjectItemTypeGroup.uiUx,
  ProjectItemTypeGroup.skinPersona,
  ProjectItemTypeGroup.configDev,
  ProjectItemTypeGroup.packaging,
  ProjectItemTypeGroup.meta,
  ProjectItemTypeGroup.unknown,
];

/**
 * Gets the sort order index for a project item type group.
 */
export function getGroupSortOrder(group: ProjectItemTypeGroup): number {
  const index = ProjectItemTypeGroupSortOrder.indexOf(group);
  return index >= 0 ? index : ProjectItemTypeGroupSortOrder.length;
}

/**
 * Gets the sort order for a project item type based on its group.
 */
export function getSortOrderForProjectItemType(itemType: ProjectItemType): number {
  const group = getProjectItemTypeGroup(itemType);
  const groupOrder = getGroupSortOrder(group);
  // Multiply by 1000 to leave room for sub-ordering within groups
  // Add the item type number for stable ordering within groups
  return groupOrder * 1000 + itemType;
}

/**
 * Display name for each group.
 */
export const ProjectItemTypeGroupNames: Record<ProjectItemTypeGroup, string> = {
  [ProjectItemTypeGroup.design]: "Design",
  [ProjectItemTypeGroup.scriptsLogic]: "Scripts & Logic",
  [ProjectItemTypeGroup.entityTypes]: "Entity Types",
  [ProjectItemTypeGroup.itemTypes]: "Item Types",
  [ProjectItemTypeGroup.blockTypes]: "Block Types",
  [ProjectItemTypeGroup.worldWorldgen]: "World & Worldgen",
  [ProjectItemTypeGroup.modelsAnimations]: "Models & Animations",
  [ProjectItemTypeGroup.texturesAudio]: "Textures & Audio",
  [ProjectItemTypeGroup.vibrantVisuals]: "Vibrant Visuals",
  [ProjectItemTypeGroup.uiUx]: "UI & Localization",
  [ProjectItemTypeGroup.configDev]: "Config & Dev",
  [ProjectItemTypeGroup.packaging]: "Packages",
  [ProjectItemTypeGroup.skinPersona]: "Skins & Personas",
  [ProjectItemTypeGroup.meta]: "Documentation",
  [ProjectItemTypeGroup.unknown]: "Other",
};

/**
 * SVG path data for each project item type group icon.
 * Icons are designed on a 16x16 grid with a blocky Minecraft aesthetic.
 */
export const ProjectItemTypeGroupIcons: Record<ProjectItemTypeGroup, string> = {
  // Design - Paintbrush/palette
  [ProjectItemTypeGroup.design]: `M3 12L5 10L11 4L13 6L7 12L5 14L3 12ZM12 3L13 2L14 3L13 4L12 3ZM4 11L5 12L4 13L3 12L4 11Z`,

  // Scripts/Logic - Code brackets with lightning bolt
  [ProjectItemTypeGroup.scriptsLogic]: `M2 3H5L4 8H2L2 3ZM11 3H14V8H12L11 3ZM7 2L9 7H7L9 14H7L5 9H7L5 2H7Z`,

  // Entity Types - Mob face (creeper-inspired)
  [ProjectItemTypeGroup.entityTypes]: `M3 2H13V14H3V2ZM5 5H7V7H5V5ZM9 5H11V7H9V5ZM6 9H10V10H9V12H7V10H6V9Z`,

  // Item Types - Diamond/gem shape
  [ProjectItemTypeGroup.itemTypes]: `M8 1L14 7L8 15L2 7L8 1ZM8 4L5 7L8 12L11 7L8 4Z`,

  // Block Types - 3D cube
  [ProjectItemTypeGroup.blockTypes]: `M8 2L14 5V11L8 14L2 11V5L8 2ZM8 4L4 6.5V10.5L8 12L12 10.5V6.5L8 4Z`,

  // World/Worldgen - Globe with terrain
  [ProjectItemTypeGroup.worldWorldgen]: `M8 1A7 7 0 1 0 8 15A7 7 0 1 0 8 1ZM8 3A5 5 0 1 1 8 13A5 5 0 1 1 8 3ZM4 8H6L7 6H9L10 8H12M5 10L8 11L11 10`,

  // Models/Animations - Bone/skeleton arm
  [ProjectItemTypeGroup.modelsAnimations]: `M2 4H4V6H6V4H10V6H12V4H14V8H12V10H14V14H10V12H6V14H2V10H4V8H2V4ZM6 8V10H10V8H6Z`,

  // Textures/Audio - Image frame with music note
  [ProjectItemTypeGroup.texturesAudio]: `M2 2H11V3H3V11H2V2ZM5 5H14V14H5V5ZM7 7V12H12V7H7ZM11 8V10C11 11 10 11 10 10V8H11Z`,

  // Vibrant Visuals - Sun/light rays
  [ProjectItemTypeGroup.vibrantVisuals]: `M8 4A4 4 0 1 0 8 12A4 4 0 1 0 8 4ZM8 1V2M8 14V15M1 8H2M14 8H15M3 3L4 4M12 12L13 13M13 3L12 4M3 13L4 12`,

  // UI/UX - Window with grid
  [ProjectItemTypeGroup.uiUx]: `M2 2H14V14H2V2ZM3 3V5H13V3H3ZM3 6V13H7V6H3ZM8 6V13H13V6H8ZM4 4H5V4.5H4V4ZM6 4H7V4.5H6V4Z`,

  // Config/Dev - Gear/cog
  [ProjectItemTypeGroup.configDev]: `M7 1H9V3L10 3.5L11.5 2L13 3.5L11.5 5L12 6H14V8H12L11.5 9L13 10.5L11.5 12L10 10.5L9 11V13H7V11L6 10.5L4.5 12L3 10.5L4.5 9L4 8H2V6H4L4.5 5L3 3.5L4.5 2L6 3.5L7 3V1ZM8 5A3 3 0 1 0 8 11A3 3 0 1 0 8 5Z`,

  // Packaging - Box/package
  [ProjectItemTypeGroup.packaging]: `M2 4L8 1L14 4V12L8 15L2 12V4ZM8 3L4 5V7L8 9L12 7V5L8 3ZM3 8V11L8 13V10L3 8ZM13 8L8 10V13L13 11V8Z`,

  // Skins/Personas - Player head
  [ProjectItemTypeGroup.skinPersona]: `M4 2H12V10H10V12H12V14H4V12H6V10H4V2ZM6 4V8H10V4H6ZM7 5H8V6H7V5ZM9 5H10V6H9V5Z`,

  // Meta/Documentation - Book
  [ProjectItemTypeGroup.meta]: `M3 2C3 2 4 1 8 1C12 1 13 2 13 2V13C13 13 12 14 8 14C4 14 3 13 3 13V2ZM5 4H11V5H5V4ZM5 6H11V7H5V6ZM5 8H9V9H5V8Z`,

  // Unknown - Question mark
  [ProjectItemTypeGroup.unknown]: `M6 4C6 2 10 2 10 4C10 6 8 6 8 8V9H7V8C7 5.5 9 5.5 9 4C9 3 7 3 7 4H6ZM7 11H9V13H7V11Z`,
};

/**
 * Gets the SVG icon path for a project item type group.
 */
export function getIconPathForGroup(group: ProjectItemTypeGroup): string {
  return ProjectItemTypeGroupIcons[group] || ProjectItemTypeGroupIcons[ProjectItemTypeGroup.unknown];
}

/**
 * Gets the SVG icon path for a project item type.
 */
export function getIconPathForProjectItemType(itemType: ProjectItemType): string {
  const group = getProjectItemTypeGroup(itemType);
  return getIconPathForGroup(group);
}

/**
 * Individual item type icons - more specific icons for commonly used types.
 * Falls back to group icon if not defined.
 */
export const ProjectItemTypeSpecificIcons: Partial<Record<ProjectItemType, string>> = {
  // TypeScript - TS letters
  [ProjectItemType.ts]: `M2 4H14V12H2V4ZM4 6V10H5V7.5H6.5V10H7.5V6H4ZM8 7H10V7.5H9V8H10V9.5H8V9H9V8.5H8V7Z`,

  // JavaScript - JS letters
  [ProjectItemType.js]: `M2 4H14V12H2V4ZM4 6V9.5H5V10H6V9H5V6H4ZM7 6V10H10V8.5H8V8H10V6H7ZM8 7H9V7.5H8V7Z`,

  // MCFunction - Command block
  [ProjectItemType.MCFunction]: `M3 3H13V13H3V3ZM5 5V11H11V5H5ZM6 7H10V9H6V7Z`,

  // Entity behavior - Mob head with gear
  [ProjectItemType.entityTypeBehavior]: `M3 2H13V11H11V13H5V11H3V2ZM5 4H7V6H5V4ZM9 4H11V6H9V4ZM6 8H10V9H6V8ZM12 11A2 2 0 1 0 12 15A2 2 0 1 0 12 11Z`,

  // Entity resource - Mob head with paint
  [ProjectItemType.entityTypeResource]: `M3 2H13V11H11V13H5V11H3V2ZM5 4H7V6H5V4ZM9 4H11V6H9V4ZM6 8H10V9H6V8ZM1 12L3 10L4 11L3 13L1 12Z`,

  // Item behavior - Sword
  [ProjectItemType.itemTypeBehavior]: `M12 1L14 3L6 11L4 13L3 12L5 10L13 2L12 1ZM2 14L4 12L5 13L3 15L2 14Z`,

  // Block behavior - Cube with gear
  [ProjectItemType.blockTypeBehavior]: `M8 2L13 5V10L8 13L3 10V5L8 2ZM8 4L5 5.5V9L8 11L11 9V5.5L8 4ZM12 12A2 2 0 1 0 12 16A2 2 0 1 0 12 12Z`,

  // Loot table - Chest
  [ProjectItemType.lootTableBehavior]: `M2 5H14V13H2V5ZM3 6V8H13V6H3ZM3 9V12H13V9H3ZM7 10H9V11H7V10ZM1 4H15V5H1V4Z`,

  // Recipe - Crafting grid
  [ProjectItemType.recipeBehavior]: `M3 3H13V13H3V3ZM4 4V6H6V4H4ZM7 4V6H9V4H7ZM10 4V6H12V4H10ZM4 7V9H6V7H4ZM7 7V9H9V7H7ZM10 7V9H12V7H10ZM4 10V12H6V10H4ZM7 10V12H9V10H7ZM10 10V12H12V10H10Z`,

  // Spawn rule - Egg
  [ProjectItemType.spawnRuleBehavior]: `M8 2C5 2 4 5 4 8C4 12 6 14 8 14C10 14 12 12 12 8C12 5 11 2 8 2ZM8 4C9.5 4 10 6 10 8C10 10.5 9 12 8 12C7 12 6 10.5 6 8C6 6 6.5 4 8 4Z`,

  // Model geometry - Wireframe cube
  [ProjectItemType.modelGeometryJson]: `M8 1L14 4V11L8 14L2 11V4L8 1ZM8 3L4 5L8 7L12 5L8 3ZM3 6V10L7 12V8L3 6ZM13 6L9 8V12L13 10V6Z`,

  // Texture - Image
  [ProjectItemType.texture]: `M2 3H14V13H2V3ZM3 4V12H13V4H3ZM5 6A1 1 0 1 0 5 8A1 1 0 1 0 5 6ZM4 11L6 8L8 10L10 7L12 11H4Z`,

  // Audio - Speaker/sound waves
  [ProjectItemType.audio]: `M3 5H5L9 2V14L5 11H3V5ZM11 5V6C12 6.5 12 9.5 11 10V11C13 10 13 6 11 5ZM11 3V4C14 5 14 11 11 12V13C15 11.5 15 4.5 11 3Z`,

  // Biome - Mountain/tree
  [ProjectItemType.biomeBehavior]: `M8 2L13 10H10L12 14H4L6 10H3L8 2ZM8 5L6 8H7L5.5 12H10.5L9 8H10L8 5Z`,

  // Particle - Sparkle
  [ProjectItemType.particleJson]: `M8 1V4M8 12V15M1 8H4M12 8H15M3 3L5 5M11 11L13 13M13 3L11 5M3 13L5 11M8 6A2 2 0 1 0 8 10A2 2 0 1 0 8 6Z`,

  // Animation - Film strip
  [ProjectItemType.animationResourceJson]: `M2 2H4V14H2V2ZM12 2H14V14H12V2ZM5 3H11V6H5V3ZM5 7H11V10H5V7ZM5 11H11V14H5V11ZM3 3V4M3 6V7M3 9V10M3 12V13M13 3V4M13 6V7M13 9V10M13 12V13`,

  // Lighting - Light bulb
  [ProjectItemType.lightingJson]: `M8 1C5 1 4 4 4 6C4 8 5 9 6 10V12H10V10C11 9 12 8 12 6C12 4 11 1 8 1ZM6 13H10V14H6V13ZM7 14H9V15H7V14Z`,

  // UI JSON - Window
  [ProjectItemType.uiJson]: `M2 2H14V14H2V2ZM3 3V4H13V3H3ZM3 5V13H13V5H3ZM4 6H8V8H4V6ZM9 6H12V12H9V6ZM4 9H8V12H4V9Z`,

  // World folder - Globe
  [ProjectItemType.worldFolder]: `M8 1A7 7 0 1 0 8 15A7 7 0 1 0 8 1ZM8 3C9 3 10 4 10.5 6H5.5C6 4 7 3 8 3ZM4 8C4 7.3 4.1 6.7 4.3 6H6C5.9 6.6 5.8 7.3 5.8 8C5.8 8.7 5.9 9.4 6 10H4.3C4.1 9.3 4 8.7 4 8ZM8 13C7 13 6 12 5.5 10H10.5C10 12 9 13 8 13ZM10 10C10.1 9.4 10.2 8.7 10.2 8C10.2 7.3 10.1 6.6 10 6H11.7C11.9 6.7 12 7.3 12 8C12 8.7 11.9 9.3 11.7 10H10Z`,

  // Package JSON - NPM box
  [ProjectItemType.packageJson]: `M2 4L8 1L14 4V12L8 15L2 12V4ZM3 5V11L8 13.5L13 11V5L8 2.5L3 5ZM5 6H11V10H9V7H7V10H5V6Z`,
};

/**
 * Gets the specific SVG icon path for a project item type.
 * Falls back to the group icon if no specific icon is defined.
 */
export function getSpecificIconPathForProjectItemType(itemType: ProjectItemType): string {
  return ProjectItemTypeSpecificIcons[itemType] || getIconPathForProjectItemType(itemType);
}

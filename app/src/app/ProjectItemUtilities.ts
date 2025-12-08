// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IColor from "../core/IColor";
import Utilities from "../core/Utilities";
import { PackType } from "../minecraft/Pack";
import { VibrantVisualsFileExtensionVariants } from "../minecraft/TextureDefinition";
import StorageUtilities from "../storage/StorageUtilities";
import { ProjectItemCategory, ProjectItemType } from "./IProjectItemData";
import IProjectItemRelationship from "./IProjectItemRelationship";
import Project from "./Project";
import ProjectItem from "./ProjectItem";
import ProjectUtilities from "./ProjectUtilities";

// an attempt to group related things together via sort order. Used in the UI item list
// general order is design stuff, then script & logic, then behavior stuff, then resource stuff, then skin stuff, then world stuff, then misc stuff (e.g., dev things)
export const ProjectItemSortOrder = [
  // VVV--- design stuff area
  ProjectItemType.designTexture,
  ProjectItemType.designPackManifestJson,
  ProjectItemType.designPackFolder,

  // VVV--- script & logic area
  ProjectItemType.ts,
  ProjectItemType.js,
  ProjectItemType.MCFunction,
  ProjectItemType.actionSet,
  ProjectItemType.entityTypeBaseJs,
  ProjectItemType.entityTypeBaseTs,
  ProjectItemType.blockTypeBaseJs,
  ProjectItemType.blockTypeBaseTs,
  ProjectItemType.catalogIndexJs,
  ProjectItemType.animationBehaviorJson,
  ProjectItemType.animationControllerBehaviorJson,
  ProjectItemType.testJs,

  // VVV--- behavior stuff area
  ProjectItemType.entityTypeBehavior,
  ProjectItemType.spawnRuleBehavior,
  ProjectItemType.spawnGroupJson,
  ProjectItemType.functionEventJson,
  ProjectItemType.itemTypeBehavior,
  ProjectItemType.craftingItemCatalog,
  ProjectItemType.recipeBehavior,
  ProjectItemType.blockTypeBehavior,
  ProjectItemType.blockMaterialsBehaviorJson,
  ProjectItemType.tradingBehaviorJson,
  ProjectItemType.volumeBehaviorJson,
  ProjectItemType.lootTableBehavior,
  ProjectItemType.dialogueBehaviorJson,
  //      VV-- Worldgen subarea
  ProjectItemType.featureRuleBehavior,
  ProjectItemType.featureBehavior,
  ProjectItemType.jigsawStructureSet,
  ProjectItemType.jigsawStructure,
  ProjectItemType.jigsawTemplatePool,
  ProjectItemType.jigsawProcessorList,
  ProjectItemType.biomeBehavior,
  ProjectItemType.dimensionJson,
  //      VV-- Misc uncommon subarea
  ProjectItemType.tickJson,
  ProjectItemType.cameraBehaviorJson,
  ProjectItemType.aimAssistPresetJson,
  ProjectItemType.aimAssistCategoryJson,
  ProjectItemType.behaviorTreeJson,
  ProjectItemType.behaviorPackFolder,
  ProjectItemType.behaviorPackManifestJson,

  // VVV--- resource stuff area
  ProjectItemType.entityTypeResource,
  ProjectItemType.attachableResourceJson,
  ProjectItemType.itemTypeLegacyResource,
  ProjectItemType.blocksCatalogResourceJson,
  ProjectItemType.blockTypeResourceJsonDoNotUse,
  ProjectItemType.blockCulling,
  ProjectItemType.terrainTextureCatalogResourceJson,
  ProjectItemType.particleJson,
  ProjectItemType.modelGeometryJson,
  ProjectItemType.itemTextureJson,
  ProjectItemType.texture,
  ProjectItemType.textureSetJson,
  ProjectItemType.animationResourceJson,
  ProjectItemType.animationControllerResourceJson,
  ProjectItemType.renderControllerJson,
  ProjectItemType.flipbookTexturesJson,
  //      VV-- Vibrant visuals subarea
  ProjectItemType.lightingJson,
  ProjectItemType.colorGradingJson,
  ProjectItemType.atmosphericsJson,
  ProjectItemType.pbrJson,
  ProjectItemType.pointLightsJson,
  ProjectItemType.waterJson,
  ProjectItemType.shadowsJson,
  //      VV-- JSON UI subarea
  ProjectItemType.uiJson,
  ProjectItemType.ninesliceJson,
  ProjectItemType.uiTexture,
  //      VV-- Misc uncommon visual stuff subarea
  ProjectItemType.cameraResourceJson,
  ProjectItemType.fogResourceJson,
  ProjectItemType.biomeResource,
  ProjectItemType.biomesClientCatalogResource,
  ProjectItemType.globalVariablesJson,
  ProjectItemType.sdlLayout,
  ProjectItemType.lodJson,
  ProjectItemType.rendererJson,
  ProjectItemType.loadingMessagesJson,
  ProjectItemType.fontMetadataJson,
  ProjectItemType.emoticonsJson,
  ProjectItemType.splashesJson,
  //      VV-- Sound/audio subarea
  ProjectItemType.soundCatalog,
  ProjectItemType.soundDefinitionCatalog,
  ProjectItemType.musicDefinitionJson,
  ProjectItemType.audio,
  //      VV-- (legacy) Materials subarea
  ProjectItemType.materialsResourceJson,
  ProjectItemType.material,
  ProjectItemType.materialSetJson,
  ProjectItemType.materialVertex,
  ProjectItemType.materialFragment,
  ProjectItemType.materialGeometry,
  ProjectItemType.languagesCatalogJson,
  ProjectItemType.lang,
  ProjectItemType.resourcePackManifestJson,
  ProjectItemType.textureListJson,
  ProjectItemType.fileListArrayJson,
  ProjectItemType.resourcePackFolder,

  // VVV--- world stuff area
  ProjectItemType.worldFolder,
  ProjectItemType.worldTemplateManifestJson,
  ProjectItemType.levelDat,
  ProjectItemType.levelDatOld,
  ProjectItemType.behaviorPackListJson,
  ProjectItemType.resourcePackListJson,
  ProjectItemType.behaviorPackHistoryListJson,
  ProjectItemType.resourcePackHistoryListJson,
  ProjectItemType.levelDbLdb,
  ProjectItemType.levelDbLog,
  ProjectItemType.levelDbCurrent,
  ProjectItemType.levelDbManifest,
  ProjectItemType.worldTest,
  ProjectItemType.MCWorld,
  ProjectItemType.MCProject,
  ProjectItemType.MCTemplate,

  // VVV--- skin stuff area
  ProjectItemType.skinCatalogJson,
  ProjectItemType.skinPackGeometryJson,
  ProjectItemType.skinPackTextureBackCompatJson,
  ProjectItemType.skinPackManifestJson,
  ProjectItemType.skinPackFolder,

  // VVV--- persona area
  ProjectItemType.personaJson,
  ProjectItemType.personaManifestJson,
  ProjectItemType.personaPackFolder,

  // VVV--- dev stuff area
  ProjectItemType.tsconfigJson,
  ProjectItemType.packageJson,
  ProjectItemType.packageLockJson,
  ProjectItemType.vsCodeLaunchJson,
  ProjectItemType.vsCodeTasksJson,
  ProjectItemType.vsCodeSettingsJson,
  ProjectItemType.vsCodeExtensionsJson,
  ProjectItemType.justConfigTs,
  ProjectItemType.jsMap,
  ProjectItemType.esLintConfigMjs,
  ProjectItemType.env,
  ProjectItemType.prettierRcJson,
  ProjectItemType.buildProcessedJs,

  // VVV--- marketing area
  ProjectItemType.marketingAssetImage,
  ProjectItemType.storeAssetImage,

  // VVV--- metaproject
  ProjectItemType.dataForm,
  ProjectItemType.docInfoJson,
  ProjectItemType.scriptTypesJson,
  ProjectItemType.commandSetDefinitionJson,
  ProjectItemType.jsconfigJson,
  ProjectItemType.docfxJson,
  ProjectItemType.jsdocJson,
  ProjectItemType.markdownDocumentation,
  ProjectItemType.documentedTypeFolder,
  ProjectItemType.documentedCommandFolder,
  ProjectItemType.contentIndexJson,
  ProjectItemType.contentReportJson,
  ProjectItemType.mcToolsProjectPreferences,
  ProjectItemType.projectSummaryMetadata,
  ProjectItemType.engineOrderingJson,
  ProjectItemType.vanillaDataJson,
  ProjectItemType.tagsMetadata,

  // VVV--- uncategorized artifacts
  ProjectItemType.image,
  ProjectItemType.uniformsJson,
  ProjectItemType.unknownJson,

  // VVV--- packaging artifacts
  ProjectItemType.packIconImage,
  ProjectItemType.educationJson,
  ProjectItemType.contentsJson,
  ProjectItemType.MCAddon,
  ProjectItemType.MCPack,
  ProjectItemType.zip,
  ProjectItemType.unknown,
];

export const FormMappings: {
  [typeIdAsString: string]: {
    formCategory: string;
    formName: string;
    select?: string;
  };
} = {
  /*  ["" + ProjectItemType.atmosphericsJson]: {
    formCategory: "client_deferred_rendering",
    formName: "atmosphericscattering_atmosphericscatteringconfigsettings",
    select: "minecraft:atmosphere_settings",
  },
  ["" + ProjectItemType.colorGradingJson]: {
    formCategory: "client_deferred_rendering",
    formName: "colorgraderconfig_colorgradingparameterssrc",
    select: "minecraft:color_grading_settings",
  },
  ["" + ProjectItemType.lightingJson]: {
    formCategory: "client_deferred_rendering",
    formName: "lightinggroup_lightingimpl_1_21_70",
    select: "minecraft:lighting_settings",
  },
  ["" + ProjectItemType.pbrJson]: {
    formCategory: "client_deferred_rendering",
    formName: "pbrfallbackconfig_pbrfallbackconfigsettings",
    select: "minecraft:pbr_fallback_settings",
  },
  ["" + ProjectItemType.waterJson]: {
    formCategory: "client_deferred_rendering",
    formName: "waterconfig_waterconfigsettingsv1",
    select: "minecraft:water_settings",
  },
  ["" + ProjectItemType.shadowsJson]: {
    formCategory: "client_deferred_rendering",
    formName: "shadowstylizationconfig_shadowstylizationconfigsettings",
    select: "minecraft:shadow_settings",
  },
  ["" + ProjectItemType.pointLightsJson]: {
    formCategory: "client_deferred_rendering",
    formName: "pointlightconfig_pointlightconfigsettings",
    select: "minecraft:point_light_settings",
  },*/
};

export default class ProjectItemUtilities {
  static inferTypeFromContent(
    content: Uint8Array | string,
    fileName: string
  ): { itemType: ProjectItemType; packType?: PackType; path?: string } {
    const type = StorageUtilities.getTypeFromName(fileName);

    if (typeof content === "string") {
      switch (type) {
        case "json":
          return ProjectItemUtilities.inferTypeFromJsonContent(content, fileName);
      }
    } else {
      switch (type) {
        case "png":
          return { itemType: ProjectItemType.texture, packType: PackType.resource, path: "/textures/ " };
      }
    }

    return { itemType: ProjectItemType.unknown, packType: PackType.behavior, path: "/" };
  }

  static getFormPathForType(itemType: ProjectItemType) {
    switch (itemType) {
      case ProjectItemType.entityTypeBehavior:
        return "entity/actor_document";
      case ProjectItemType.biomeBehavior:
        return "biome/biome_json_file";
      case ProjectItemType.blockCulling:
        return "block_culling/blockculling";
      case ProjectItemType.biomesClientCatalogResource:
        return "client_biome/client_biome_json_file";
      case ProjectItemType.atmosphericsJson:
        return "client_deferred_rendering/atmosphericscattering_atmosphericscatteringconfigsettings";
      case ProjectItemType.colorGradingJson:
        return "client_deferred_rendering/colorgraderconfig_colorgradingparameterssrc";
      case ProjectItemType.lightingJson:
        return "client_deferred_rendering/lightinggroup_lightingimpl_1_21_70";
      case ProjectItemType.pbrJson:
        return "client_deferred_rendering/pbrfallbackconfig_pbrfallbackconfigsettings";
      case ProjectItemType.pointLightsJson:
        return "client_deferred_rendering/pointlightconfig_pointlightconfigsettings";
      case ProjectItemType.shadowsJson:
        return "client_deferred_rendering/shadowstylizationconfig_shadowstylizationconfigsettings";
      case ProjectItemType.waterJson:
        return "client_deferred_rendering/waterconfig_waterconfigsettingsv1";
      case ProjectItemType.itemTypeLegacyResource:
        return "client_item/resource";
      case ProjectItemType.featureRuleBehavior:
        return "feature/feature_rule_definition";
      case ProjectItemType.featureBehavior:
        return "features/features";
      case ProjectItemType.fogResourceJson:
        return "fogs/fogs";
      case ProjectItemType.jigsawStructure:
        return "jigsaw/minecraft_jigsaw_structure_metadata";
      case ProjectItemType.spawnRuleBehavior:
        return "spawn/spawn_rules";
      case ProjectItemType.modelGeometryJson:
        return "visual/geometry.v1.21.0";
      default:
        return undefined;
    }
  }

  static getSchemaPathForType(itemType: ProjectItemType) {
    switch (itemType) {
      case ProjectItemType.behaviorPackManifestJson:
        return "general/manifest.json";
      case ProjectItemType.behaviorPackListJson:
        return "general/world_x_packs.json";
      case ProjectItemType.resourcePackListJson:
        return "general/world_x_packs.json";
      case ProjectItemType.animationControllerBehaviorJson:
        return "behavior/animation_controllers/animation_controller.json";
      case ProjectItemType.animationBehaviorJson:
        return "behavior/animations/animations.json";
      case ProjectItemType.blockTypeBehavior:
        return "behavior/blocks/blocks.json";
      case ProjectItemType.itemTypeBehavior:
        return "behavior/items/items.json";
      case ProjectItemType.lootTableBehavior:
        return "behavior/loot_tables/loot_tables.json";
      case ProjectItemType.dialogueBehaviorJson:
        return "behavior/dialogue/dialogue.json";
      case ProjectItemType.entityTypeBehavior:
        return "behavior/entities/entities.json";
      case ProjectItemType.atmosphericsJson:
        return "resource/atmospherics/atmospherics.json";
      case ProjectItemType.blocksCatalogResourceJson:
        return "resource/blocks.json";
      case ProjectItemType.soundCatalog:
        return "resource/sounds.json";
      case ProjectItemType.animationResourceJson:
        return "resource/animations/actor_animation.json";
      case ProjectItemType.animationControllerResourceJson:
        return "resource/animation_controllers/animation_controller.json";
      case ProjectItemType.entityTypeResource:
        return "resource/entity/entity.json";
      case ProjectItemType.fogResourceJson:
        return "resource/fog/fog.json";
      case ProjectItemType.modelGeometryJson:
        return "resource/models/entity/model_entity.json";
      case ProjectItemType.biomesClientCatalogResource:
        return "resource/biomes_client.json";
      case ProjectItemType.particleJson:
        return "resource/particles/particles.json";
      case ProjectItemType.renderControllerJson:
        return "resource/render_controllers/render_controllers.json";
      case ProjectItemType.blockCulling:
        return "resource/block_culling/block_culling.json";
      case ProjectItemType.craftingItemCatalog:
        return "behavior/item_catalog/crafting_item_catalog.json";
      //     case ProjectItemType.uiTextureJson:
      //        return "resource/textures/ui_texture_definition.json";
      case ProjectItemType.languagesCatalogJson:
        return "language/languages.json";
      case ProjectItemType.featureBehavior:
        return "behavior/features/features.json";
      case ProjectItemType.featureRuleBehavior:
        return "behavior/feature_rules/feature_rules.json";
      case ProjectItemType.functionEventJson:
        return "behavior/functions/tick.json";
      case ProjectItemType.recipeBehavior:
        return "behavior/recipes/recipes.json";
      case ProjectItemType.spawnRuleBehavior:
        return "behavior/spawn_rules/spawn_rules.json";
      case ProjectItemType.tradingBehaviorJson:
        return "behavior/trading/trading.json";
      case ProjectItemType.attachableResourceJson:
        return "resource/attachables/attachables.json";
      case ProjectItemType.itemTypeLegacyResource:
        return "resource/items/items.json";
      case ProjectItemType.materialsResourceJson:
        return "resource/materials/materials.json";
      case ProjectItemType.musicDefinitionJson:
        return "resource/sounds/music_definitions.json";
      case ProjectItemType.soundDefinitionCatalog:
        return "resource/sounds/sound_definitions.json";
      case ProjectItemType.blockTypeResourceJsonDoNotUse:
        return "resource/blocks.json";
      case ProjectItemType.uiJson:
        return "resource/ui/ui.json";
      case ProjectItemType.tickJson:
        return "behavior/functions/tick.json";
      case ProjectItemType.flipbookTexturesJson:
        return "resource/textures/flipbook_textures.json";
      case ProjectItemType.itemTextureJson:
        return "resource/textures/item_texture.json";
      case ProjectItemType.terrainTextureCatalogResourceJson:
        return "resource/textures/terrain_texture.json";
      case ProjectItemType.globalVariablesJson:
        return "resource/ui/_global_variables.json";

      default:
        return undefined;
    }
  }

  static inferTypeFromJsonContent(
    jsonContent: string,
    fileName: string
  ): { itemType: ProjectItemType; packType?: PackType; path?: string } {
    const fileBaseName = StorageUtilities.getBaseFromName(fileName);

    if (fileBaseName) {
      if (fileBaseName.endsWith(".mci")) {
        return { itemType: ProjectItemType.contentIndexJson };
      } else if (fileBaseName.endsWith(".mcr")) {
        return { itemType: ProjectItemType.contentReportJson };
      }
    }

    const firstHundred = jsonContent.substring(0, 100);

    if (
      firstHundred.indexOf('"minecraft:recipe_shaped"') >= 0 ||
      firstHundred.indexOf('"minecraft:recipe_shapeless"') >= 0
    ) {
      return { itemType: ProjectItemType.recipeBehavior };
    } else if (firstHundred.indexOf('"minecraft:entity"') >= 0) {
      return { itemType: ProjectItemType.entityTypeBehavior };
    } else if (firstHundred.indexOf('"minecraft:item"') >= 0) {
      return { itemType: ProjectItemType.itemTypeBehavior };
    } else if (firstHundred.indexOf('"pools"') >= 0) {
      return { itemType: ProjectItemType.itemTypeBehavior };
    } else if (firstHundred.indexOf('"minecraft:spawn_rules"') >= 0) {
      return { itemType: ProjectItemType.spawnRuleBehavior };
    } else if (firstHundred.indexOf('"tiers"') >= 0) {
      return { itemType: ProjectItemType.tradingBehaviorJson };
    } else if (firstHundred.indexOf('"animation_controllers"') >= 0) {
      return { itemType: ProjectItemType.animationControllerResourceJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"animations"') >= 0) {
      return { itemType: ProjectItemType.animationResourceJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"animations"') >= 0) {
      return { itemType: ProjectItemType.animationResourceJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"minecraft:attachable"') >= 0) {
      return { itemType: ProjectItemType.attachableResourceJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"minecraft:client_entity"') >= 0) {
      return { itemType: ProjectItemType.entityTypeResource, packType: PackType.resource };
    } else if (firstHundred.indexOf('"minecraft:fog_settings"') >= 0) {
      return { itemType: ProjectItemType.fogResourceJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"minecraft:geometry"') >= 0) {
      return { itemType: ProjectItemType.modelGeometryJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"particle_effect"') >= 0) {
      return { itemType: ProjectItemType.particleJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"render_controllers"') >= 0) {
      return { itemType: ProjectItemType.renderControllerJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"block_culling"') >= 0) {
      return { itemType: ProjectItemType.blockCulling, packType: PackType.resource };
    } else if (firstHundred.indexOf('"item_catalog"') >= 0) {
      return { itemType: ProjectItemType.craftingItemCatalog, packType: PackType.behavior };
    } else if (firstHundred.indexOf('"namespace"') >= 0) {
      return { itemType: ProjectItemType.uiJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"sound_definitions"') >= 0) {
      return { itemType: ProjectItemType.soundDefinitionCatalog, packType: PackType.resource };
    } else if (fileBaseName === "manifest") {
      const jsonO = Utilities.getJsonObject(jsonContent);

      if (jsonO !== undefined && jsonO["modules"]) {
        for (const mod of jsonO["modules"]) {
          if (mod && mod["type"]) {
            switch (mod["type"]) {
              case "script":
              case "data":
                return { itemType: ProjectItemType.behaviorPackManifestJson };
              case "resources":
                return { itemType: ProjectItemType.resourcePackManifestJson };
            }
          }
        }
      }
    }

    return { itemType: ProjectItemType.unknown };
  }

  static isDescendentOfPath(projectItem: ProjectItem, projectPath: string) {
    if (projectItem.projectPath === projectPath) {
      return true;
    }

    if (!projectItem.parentItems) {
      return false;
    }

    for (const relationship of projectItem.parentItems) {
      if (this.isDescendentOfPath(relationship.parentItem, projectPath)) {
        return true;
      }
    }

    return false;
  }

  static getSortOrder(itemType: ProjectItemType): number {
    for (let i = 0; i < ProjectItemSortOrder.length; i++) {
      if (ProjectItemSortOrder[i] === itemType) {
        return i;
      }
    }

    return ProjectItemSortOrder.length + itemType;
  }

  static getItemByTypeAndName(project: Project, name: string, projectItemType: ProjectItemType) {
    const itemsCopy = project.getItemsByType(projectItemType);

    for (const item of itemsCopy) {
      if (item.itemType === projectItemType && (item.name === name || item.name.startsWith(name.toLowerCase() + "."))) {
        return item;
      }
    }

    return undefined;
  }

  static getAccessoryFolderPathFromFilePath(projectItem: ProjectItem): string {
    let relativePath = projectItem.projectPath;

    if (!relativePath) {
      return projectItem.name + " " + ProjectItemUtilities.getDescriptionForType(projectItem.itemType);
    }

    relativePath = relativePath.replace(/\./gi, "_");

    return relativePath;
  }

  static getCategory(itemType: ProjectItemType) {
    switch (itemType) {
      case ProjectItemType.MCFunction:
      case ProjectItemType.testJs:
      case ProjectItemType.actionSet:
      case ProjectItemType.animationBehaviorJson:
      case ProjectItemType.animationControllerBehaviorJson:
      case ProjectItemType.tickJson:
      case ProjectItemType.js:
      case ProjectItemType.ts:
      case ProjectItemType.buildProcessedJs:
      case ProjectItemType.catalogIndexJs:
        return ProjectItemCategory.logic;

      case ProjectItemType.image:
      case ProjectItemType.texture:
      case ProjectItemType.storeAssetImage:
      case ProjectItemType.marketingAssetImage:
      case ProjectItemType.designTexture:
      case ProjectItemType.uiTexture:
      case ProjectItemType.packIconImage:
      case ProjectItemType.soundDefinitionCatalog:
      case ProjectItemType.soundCatalog:
      case ProjectItemType.resourcePackManifestJson:
      case ProjectItemType.resourcePackListJson:
      case ProjectItemType.renderControllerJson:
      case ProjectItemType.lightingJson:
      case ProjectItemType.textureSetJson:
      case ProjectItemType.modelGeometryJson:
      case ProjectItemType.material:
      case ProjectItemType.materialSetJson:
      case ProjectItemType.animationControllerResourceJson:
      case ProjectItemType.animationResourceJson:
      case ProjectItemType.itemTextureJson:
      case ProjectItemType.flipbookTexturesJson:
      case ProjectItemType.terrainTextureCatalogResourceJson:
      case ProjectItemType.globalVariablesJson:
      case ProjectItemType.uiJson:
      case ProjectItemType.lang:
      case ProjectItemType.languagesCatalogJson:
      case ProjectItemType.ninesliceJson:
      case ProjectItemType.attachableResourceJson:
      case ProjectItemType.audio:
      case ProjectItemType.designPackManifestJson:
      case ProjectItemType.designPackFolder:
        return ProjectItemCategory.assets;

      case ProjectItemType.entityTypeBehavior:
      case ProjectItemType.entityTypeResource:
      case ProjectItemType.entityTypeBaseJs:
      case ProjectItemType.entityTypeBaseTs:
      case ProjectItemType.blockTypeBehavior:
      case ProjectItemType.blocksCatalogResourceJson:
      case ProjectItemType.blockTypeResourceJsonDoNotUse:
      case ProjectItemType.itemTypeBehavior:
      case ProjectItemType.fogResourceJson:
      case ProjectItemType.tradingBehaviorJson:
      case ProjectItemType.particleJson:
      case ProjectItemType.structure:
      case ProjectItemType.recipeBehavior:
      case ProjectItemType.biomeBehavior:
      case ProjectItemType.biomeResource:
      case ProjectItemType.biomesClientCatalogResource:
      case ProjectItemType.lootTableBehavior:
      case ProjectItemType.spawnRuleBehavior:
      case ProjectItemType.dialogueBehaviorJson:
      case ProjectItemType.MCWorld:
      case ProjectItemType.worldTemplateManifestJson:
      case ProjectItemType.itemTypeLegacyResource:
      case ProjectItemType.featureBehavior:
      case ProjectItemType.featureRuleBehavior:
        return ProjectItemCategory.types;

      case ProjectItemType.esLintConfigMjs:
      case ProjectItemType.env:
      case ProjectItemType.justConfigTs:
      case ProjectItemType.packageLockJson:
      case ProjectItemType.jsconfigJson:
      case ProjectItemType.prettierRcJson:
      case ProjectItemType.tsconfigJson:
      case ProjectItemType.docfxJson:
      case ProjectItemType.jsMap:
      case ProjectItemType.jsdocJson:
      case ProjectItemType.vsCodeExtensionsJson:
      case ProjectItemType.vsCodeLaunchJson:
      case ProjectItemType.vsCodeSettingsJson:
      case ProjectItemType.vsCodeTasksJson:
        return ProjectItemCategory.build;

      case ProjectItemType.mcToolsProjectPreferences:
        return ProjectItemCategory.mctools;

      case ProjectItemType.zip:
      case ProjectItemType.MCAddon:
      case ProjectItemType.MCPack:
      case ProjectItemType.MCTemplate:
      case ProjectItemType.MCProject:
      case ProjectItemType.personaPackFolder:
      case ProjectItemType.behaviorPackFolder:
      case ProjectItemType.resourcePackFolder:
      case ProjectItemType.skinPackFolder:
        return ProjectItemCategory.package;
    }

    return ProjectItemCategory.unknown;
  }
  static isTextureType(itemType: ProjectItemType) {
    if (
      itemType === ProjectItemType.texture ||
      itemType === ProjectItemType.designTexture ||
      itemType === ProjectItemType.uiTexture
    ) {
      return true;
    }

    return false;
  }

  static isImageType(itemType: ProjectItemType) {
    if (
      ProjectItemUtilities.isTextureType(itemType) ||
      itemType === ProjectItemType.image ||
      itemType === ProjectItemType.storeAssetImage ||
      itemType === ProjectItemType.marketingAssetImage ||
      itemType === ProjectItemType.packIconImage
    ) {
      return true;
    }

    return false;
  }

  static isAudioType(itemType: ProjectItemType) {
    if (itemType === ProjectItemType.audio) {
      return true;
    }

    return false;
  }

  static isPackageType(itemType: ProjectItemType) {
    if (
      itemType === ProjectItemType.zip ||
      itemType === ProjectItemType.MCAddon ||
      itemType === ProjectItemType.MCPack ||
      itemType === ProjectItemType.MCProject ||
      itemType === ProjectItemType.MCWorld ||
      itemType === ProjectItemType.MCTemplate
    ) {
      return true;
    }

    return false;
  }

  static isBinaryType(itemType: ProjectItemType) {
    if (this.isImageType(itemType) || this.isPackageType(itemType) || this.isAudioType(itemType)) {
      return true;
    }

    return false;
  }

  static isVibrantVisualsTypeRelated(itemType: ProjectItemType) {
    if (
      itemType === ProjectItemType.atmosphericsJson ||
      itemType === ProjectItemType.colorGradingJson ||
      itemType === ProjectItemType.lightingJson ||
      itemType === ProjectItemType.shadowsJson ||
      itemType === ProjectItemType.pbrJson ||
      itemType === ProjectItemType.pointLightsJson ||
      itemType === ProjectItemType.waterJson ||
      itemType ===
        ProjectItemType.textureSetJson /* not 100% sure there might not be some legit usages of this outside of VV */
    ) {
      return true;
    }

    return false;
  }

  static isVibrantVisualsRelated(item: ProjectItem) {
    if (this.isVibrantVisualsTypeRelated(item.itemType)) {
      return true;
    }

    if (item.itemType === ProjectItemType.texture) {
      const fileName = item.name.toLowerCase();

      for (const ext of VibrantVisualsFileExtensionVariants) {
        if (fileName.endsWith(ext)) {
          return true;
        }
      }

      if (this.isTextureSetTexture(item)) {
        return true;
      }
    }

    return false;
  }

  static getMimeTypes(item: ProjectItem) {
    switch (item.itemType) {
      case ProjectItemType.js:
      case ProjectItemType.testJs:
      case ProjectItemType.entityTypeBaseJs:
      case ProjectItemType.buildProcessedJs:
      case ProjectItemType.catalogIndexJs:
      case ProjectItemType.entityTypeBaseTs:
      case ProjectItemType.esLintConfigMjs:
      case ProjectItemType.blockTypeBaseJs:
        return ["application/javascript"];

      case ProjectItemType.justConfigTs:
      case ProjectItemType.ts:
      case ProjectItemType.blockTypeBaseTs:
        return ["application/typescript"];

      case ProjectItemType.personaJson:
      case ProjectItemType.tsconfigJson:
      case ProjectItemType.prettierRcJson:
      case ProjectItemType.jsconfigJson:
      case ProjectItemType.docfxJson:
      case ProjectItemType.jsdocJson:
      case ProjectItemType.packageJson:
      case ProjectItemType.packageLockJson:
      case ProjectItemType.docInfoJson:
      case ProjectItemType.scriptTypesJson:
      case ProjectItemType.vanillaDataJson:
      case ProjectItemType.engineOrderingJson:
      case ProjectItemType.commandSetDefinitionJson:
      case ProjectItemType.skinPackManifestJson:
      case ProjectItemType.blockCulling:
      case ProjectItemType.craftingItemCatalog:
      case ProjectItemType.personaManifestJson:
      case ProjectItemType.vsCodeLaunchJson:
      case ProjectItemType.vsCodeTasksJson:
      case ProjectItemType.vsCodeSettingsJson:
      case ProjectItemType.vsCodeExtensionsJson:
      case ProjectItemType.designPackManifestJson:
      case ProjectItemType.sdlLayout:
      case ProjectItemType.splashesJson:
      case ProjectItemType.loadingMessagesJson:
      case ProjectItemType.fontMetadataJson:
      case ProjectItemType.emoticonsJson:
      case ProjectItemType.unknownJson:
      case ProjectItemType.behaviorPackManifestJson:
      case ProjectItemType.resourcePackManifestJson:
      case ProjectItemType.entityTypeBehavior:
      case ProjectItemType.tickJson:
      case ProjectItemType.aimAssistPresetJson:
      case ProjectItemType.waterJson:
      case ProjectItemType.shadowsJson:
      case ProjectItemType.pbrJson:
      case ProjectItemType.atmosphericsJson:
      case ProjectItemType.pointLightsJson:
      case ProjectItemType.colorGradingJson:
      case ProjectItemType.cameraBehaviorJson:
      case ProjectItemType.actionSet:
      case ProjectItemType.worldTest:
      case ProjectItemType.behaviorPackListJson:
      case ProjectItemType.resourcePackListJson:
      case ProjectItemType.animationBehaviorJson:
      case ProjectItemType.animationControllerBehaviorJson:
      case ProjectItemType.blockTypeBehavior:
      case ProjectItemType.blockMaterialsBehaviorJson:
      case ProjectItemType.itemTypeBehavior:
      case ProjectItemType.lootTableBehavior:
      case ProjectItemType.biomesClientCatalogResource:
      case ProjectItemType.fileListArrayJson:
      case ProjectItemType.blocksCatalogResourceJson:
      case ProjectItemType.soundCatalog:
      case ProjectItemType.animationResourceJson:
      case ProjectItemType.animationControllerResourceJson:
      case ProjectItemType.entityTypeResource:
      case ProjectItemType.fogResourceJson:
      case ProjectItemType.modelGeometryJson:
      case ProjectItemType.particleJson:
      case ProjectItemType.renderControllerJson:
      case ProjectItemType.ninesliceJson:
      case ProjectItemType.uiJson:
      case ProjectItemType.languagesCatalogJson:
      case ProjectItemType.biomeBehavior:
      case ProjectItemType.biomeResource:
      case ProjectItemType.dialogueBehaviorJson:
      case ProjectItemType.featureRuleBehavior:
      case ProjectItemType.featureBehavior:
      case ProjectItemType.functionEventJson:
      case ProjectItemType.recipeBehavior:
      case ProjectItemType.spawnRuleBehavior:
      case ProjectItemType.tradingBehaviorJson:
      case ProjectItemType.volumeBehaviorJson:
      case ProjectItemType.attachableResourceJson:
      case ProjectItemType.itemTypeLegacyResource:
      case ProjectItemType.materialsResourceJson:
      case ProjectItemType.musicDefinitionJson:
      case ProjectItemType.soundDefinitionCatalog:
      case ProjectItemType.contentIndexJson:
      case ProjectItemType.contentReportJson:
      case ProjectItemType.worldTemplateManifestJson:
      case ProjectItemType.textureSetJson:
      case ProjectItemType.textureListJson:
      case ProjectItemType.lightingJson:
      case ProjectItemType.flipbookTexturesJson:
      case ProjectItemType.itemTextureJson:
      case ProjectItemType.terrainTextureCatalogResourceJson:
      case ProjectItemType.globalVariablesJson:
      case ProjectItemType.dataForm:
      case ProjectItemType.mcToolsProjectPreferences:
      case ProjectItemType.dimensionJson:
      case ProjectItemType.behaviorPackHistoryListJson:
      case ProjectItemType.resourcePackHistoryListJson:
      case ProjectItemType.contentsJson:
      case ProjectItemType.jigsawProcessorList:
      case ProjectItemType.jigsawStructure:
      case ProjectItemType.jigsawTemplatePool:
      case ProjectItemType.jigsawStructureSet:
      case ProjectItemType.educationJson:
        return ["application/json"];

      case ProjectItemType.MCWorld:
      case ProjectItemType.MCTemplate:
      case ProjectItemType.MCProject:
      case ProjectItemType.MCAddon:
      case ProjectItemType.MCPack:
      case ProjectItemType.zip:
        return ["application/zip"];

      case ProjectItemType.structure:
        return ["application/octet-stream"];

      case ProjectItemType.MCFunction:
      case ProjectItemType.material:
      case ProjectItemType.materialGeometry:
      case ProjectItemType.materialFragment:
      case ProjectItemType.materialSetJson:
      case ProjectItemType.materialVertex:
      case ProjectItemType.env:
      case ProjectItemType.lang:
        return ["text/plain"];

      case ProjectItemType.audio:
        return ["audio/wav", "audio/mp3", "audio/ogg"];

      case ProjectItemType.image:
      case ProjectItemType.texture:
      case ProjectItemType.uiTexture:
      case ProjectItemType.designTexture:
      case ProjectItemType.packIconImage:
      case ProjectItemType.marketingAssetImage:
      case ProjectItemType.storeAssetImage:
        return ["image/png", "image/tiff"];

      default:
        return ["application/octet-stream"];
    }
  }

  static getDescriptionForType(type: ProjectItemType) {
    switch (type) {
      case ProjectItemType.skinCatalogJson:
        return "Skins Catalog";
      case ProjectItemType.personaJson:
        return "Persona";
      case ProjectItemType.sdlLayout:
        return "SDL Layout";
      case ProjectItemType.rendererJson:
        return "Renderer";
      case ProjectItemType.splashesJson:
        return "Splashes";
      case ProjectItemType.loadingMessagesJson:
        return "Loading Messages";
      case ProjectItemType.fontMetadataJson:
        return "Font Metadata";
      case ProjectItemType.emoticonsJson:
        return "Emoticons";
      case ProjectItemType.js:
        return "JavaScript";
      case ProjectItemType.buildProcessedJs:
        return "Built JavaScript";
      case ProjectItemType.ts:
        return "TypeScript";
      case ProjectItemType.unknownJson:
        return "General json file";
      case ProjectItemType.designPackManifestJson:
        return "Design pack manifest";
      case ProjectItemType.behaviorPackManifestJson:
        return "Behavior pack manifest";
      case ProjectItemType.resourcePackManifestJson:
        return "Resource pack manifest";
      case ProjectItemType.testJs:
        return "Test JavaScript file";
      case ProjectItemType.entityTypeBaseJs:
        return "Entity type JavaScript";
      case ProjectItemType.entityTypeBaseTs:
        return "Entity type TypeScript";
      case ProjectItemType.entityTypeBehavior:
        return "Entity type";
      case ProjectItemType.MCTemplate:
        return "Minecraft template";
      case ProjectItemType.MCWorld:
        return "Minecraft world";
      case ProjectItemType.MCProject:
        return "Minecraft project";
      case ProjectItemType.MCAddon:
        return "Minecraft addon";
      case ProjectItemType.MCPack:
        return "Minecraft pack";
      case ProjectItemType.zip:
        return "Minecraft zip";
      case ProjectItemType.worldFolder:
        return "Minecraft world";
      case ProjectItemType.structure:
        return "Structure";
      case ProjectItemType.MCFunction:
        return "Function";
      case ProjectItemType.tickJson:
        return "Tick";
      case ProjectItemType.material:
        return "Material";
      case ProjectItemType.materialSetJson:
        return "Material Set";
      case ProjectItemType.materialGeometry:
        return "Geometry";
      case ProjectItemType.materialFragment:
        return "Fragment";
      case ProjectItemType.materialVertex:
        return "Vertex";
      case ProjectItemType.shadowsJson:
        return "Shadow";
      case ProjectItemType.waterJson:
        return "Water";
      case ProjectItemType.jigsawProcessorList:
        return "Jigsaw Processor List";
      case ProjectItemType.jigsawStructure:
        return "Jigsaw Structure";
      case ProjectItemType.jigsawTemplatePool:
        return "Jigsaw Template Pool";
      case ProjectItemType.contentsJson:
        return "Contents Catalog";
      case ProjectItemType.jigsawStructureSet:
        return "Jigsaw Structure Set";
      case ProjectItemType.pbrJson:
        return "PBR";
      case ProjectItemType.atmosphericsJson:
        return "Atmospherics";
      case ProjectItemType.pointLightsJson:
        return "Point Light";
      case ProjectItemType.colorGradingJson:
        return "Color Grading";
      case ProjectItemType.cameraBehaviorJson:
        return "Camera";
      case ProjectItemType.aimAssistPresetJson:
        return "Aim Assist Preset";
      case ProjectItemType.aimAssistCategoryJson:
        return "Aim Assist Category";
      case ProjectItemType.behaviorTreeJson:
        return "Behavior Tree";
      case ProjectItemType.spawnGroupJson:
        return "Spawn Group";
      case ProjectItemType.catalogIndexJs:
        return "Catalog index";
      case ProjectItemType.personaPackFolder:
        return "Persona pack";
      case ProjectItemType.designPackFolder:
        return "Design pack";
      case ProjectItemType.behaviorPackFolder:
        return "Behavior pack";
      case ProjectItemType.resourcePackFolder:
        return "Resource pack";
      case ProjectItemType.skinPackFolder:
        return "Skin pack";
      case ProjectItemType.actionSet:
        return "Action Set";
      case ProjectItemType.worldTest:
        return "World test";
      case ProjectItemType.behaviorPackListJson:
        return "World behavior pack list";
      case ProjectItemType.resourcePackListJson:
        return "World resource pack list";
      case ProjectItemType.animationBehaviorJson:
        return "Behavior pack animation";
      case ProjectItemType.animationControllerBehaviorJson:
        return "Behavior pack animation controller";
      case ProjectItemType.blockTypeBehavior:
        return "Block type";
      case ProjectItemType.itemTypeBehavior:
        return "Item type";
      case ProjectItemType.lootTableBehavior:
        return "Loot table";
      case ProjectItemType.biomesClientCatalogResource:
        return "Biome resources";
      case ProjectItemType.fileListArrayJson:
        return "File list";
      case ProjectItemType.craftingItemCatalog:
        return "Crafting Item catalog";
      case ProjectItemType.blocksCatalogResourceJson:
        return "Block resource catalog";
      case ProjectItemType.soundCatalog:
        return "Sound catalog";
      case ProjectItemType.animationResourceJson:
        return "Animation";
      case ProjectItemType.animationControllerResourceJson:
        return "Animation controller";
      case ProjectItemType.entityTypeResource:
        return "Entity type visuals/audio";
      case ProjectItemType.fogResourceJson:
        return "Fog";
      case ProjectItemType.modelGeometryJson:
        return "Model";
      case ProjectItemType.particleJson:
        return "Particle";
      case ProjectItemType.renderControllerJson:
        return "Render controller";
      case ProjectItemType.blockCulling:
        return "Block culling";
      case ProjectItemType.uiJson:
        return "User interface";
      case ProjectItemType.languagesCatalogJson:
        return "Language catalog";
      case ProjectItemType.biomeBehavior:
        return "Biome";
      case ProjectItemType.biomeResource:
        return "Biome Resources";
      case ProjectItemType.dialogueBehaviorJson:
        return "Entity dialogue";
      case ProjectItemType.featureRuleBehavior:
        return "World feature rule";
      case ProjectItemType.featureBehavior:
        return "Feature";
      case ProjectItemType.functionEventJson:
        return "Function event";
      case ProjectItemType.recipeBehavior:
        return "Recipe";
      case ProjectItemType.spawnRuleBehavior:
        return "Spawn rule";
      case ProjectItemType.tradingBehaviorJson:
        return "Trading";
      case ProjectItemType.volumeBehaviorJson:
        return "Volume";
      case ProjectItemType.attachableResourceJson:
        return "Attachable";
      case ProjectItemType.itemTypeLegacyResource:
        return "Item type resources";
      case ProjectItemType.materialsResourceJson:
        return "Materials";
      case ProjectItemType.musicDefinitionJson:
        return "Music catalog";
      case ProjectItemType.soundDefinitionCatalog:
        return "Sound catalog";
      case ProjectItemType.audio:
        return "Audio";
      case ProjectItemType.contentIndexJson:
        return "Content Description";
      case ProjectItemType.contentReportJson:
        return "Content Report";
      case ProjectItemType.tsconfigJson:
        return "TypeScript config";
      case ProjectItemType.prettierRcJson:
        return "Prettier JavaScript/JSON style config";
      case ProjectItemType.jsconfigJson:
        return "JavaScript config";
      case ProjectItemType.docfxJson:
        return "DocFX definition";
      case ProjectItemType.jsdocJson:
        return "JSDoc definition";
      case ProjectItemType.packageJson:
        return "NPM package definition";
      case ProjectItemType.packageLockJson:
        return "NPM package lock definition";
      case ProjectItemType.env:
        return "Environment File";
      case ProjectItemType.levelDatOld:
        return "Level Data (old)";
      case ProjectItemType.levelDat:
        return "Level Data";
      case ProjectItemType.jsMap:
        return "JavaScript Map";
      case ProjectItemType.esLintConfigMjs:
        return "ESLint config";
      case ProjectItemType.justConfigTs:
        return "Just config";
      case ProjectItemType.docInfoJson:
        return "Doc info json";
      case ProjectItemType.ninesliceJson:
        return "Nine-slice scaling config";
      case ProjectItemType.scriptTypesJson:
        return "Script types definition";
      case ProjectItemType.vanillaDataJson:
        return "Vanilla data definition";
      case ProjectItemType.engineOrderingJson:
        return "Engine ordering definition";
      case ProjectItemType.commandSetDefinitionJson:
        return "Command definition";
      case ProjectItemType.skinPackManifestJson:
        return "Skin pack manifest";
      case ProjectItemType.personaManifestJson:
        return "Persona manifest";
      case ProjectItemType.blockTypeBaseJs:
        return "Block type base JavaScript";
      case ProjectItemType.blockTypeBaseTs:
        return "Block type base TypeScript";
      case ProjectItemType.image:
        return "Image";
      case ProjectItemType.texture:
        return "Texture";
      case ProjectItemType.uiTexture:
        return "UI texture";
      case ProjectItemType.designTexture:
        return "Design texture";
      case ProjectItemType.packIconImage:
        return "Icon";
      case ProjectItemType.marketingAssetImage:
        return "Marketing image";
      case ProjectItemType.storeAssetImage:
        return "Store image";
      case ProjectItemType.vsCodeLaunchJson:
        return "VS Code launch file";
      case ProjectItemType.vsCodeTasksJson:
        return "VS Code tasks";
      case ProjectItemType.vsCodeSettingsJson:
        return "VS Code settings";
      case ProjectItemType.vsCodeExtensionsJson:
        return "VS Code extensions";
      case ProjectItemType.lang:
        return "Language translations";
      case ProjectItemType.worldTemplateManifestJson:
        return "World template manifest";
      case ProjectItemType.textureSetJson:
        return "Texture set";
      case ProjectItemType.textureListJson:
        return "Texture list";
      case ProjectItemType.lightingJson:
        return "Lighting";
      case ProjectItemType.flipbookTexturesJson:
        return "Flipbook texture set";
      case ProjectItemType.itemTextureJson:
        return "Item texture";
      case ProjectItemType.terrainTextureCatalogResourceJson:
        return "Terrain texture";
      case ProjectItemType.globalVariablesJson:
        return "UI global variables";
      case ProjectItemType.dataForm:
        return "Form";
      case ProjectItemType.dimensionJson:
        return "Dimension";
      case ProjectItemType.mcToolsProjectPreferences:
        return "MCTools preferences";
      case ProjectItemType.behaviorPackHistoryListJson:
        return "Behavior pack history";
      case ProjectItemType.resourcePackHistoryListJson:
        return "Resource pack history";
      case ProjectItemType.educationJson:
        return "Education manifest";
      default:
        return "Unknown";
    }
  }

  static wouldBeCircular(
    candidate: ProjectItem,
    considering?: ProjectItem,
    visitedPaths?: Set<string>,
    dontGoUpward?: boolean,
    dontGoDownward?: boolean
  ) {
    if (!visitedPaths) {
      visitedPaths = new Set<string>();
    }

    if (!candidate.projectPath) {
      return false;
    }

    if (!considering) {
      considering = candidate;
    }

    if (considering.projectPath) {
      if (visitedPaths.has(considering.projectPath)) {
        return true;
      }

      visitedPaths.add(considering.projectPath);
    } else {
      return false;
    }

    if (considering.parentItems && !dontGoUpward) {
      for (const parentItem of considering.parentItems) {
        if (parentItem.parentItem) {
          if (this.wouldBeCircular(candidate, parentItem.parentItem, visitedPaths, false, true)) {
            return true;
          }
        }
      }
    }

    if (considering.childItems && !dontGoDownward) {
      for (const childItem of considering.childItems) {
        if (childItem.childItem) {
          if (this.wouldBeCircular(candidate, childItem.childItem, visitedPaths, true, false)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  static isTextureSetTexture(projectItem: ProjectItem) {
    if (projectItem.parentItems) {
      for (const parentItem of projectItem.parentItems) {
        if (parentItem.parentItem) {
          if (parentItem.parentItem.itemType === ProjectItemType.textureSetJson) {
            return true;
          }
        }
      }
    }

    return false;
  }

  static isBlock(type: ProjectItemType) {
    return (
      type === ProjectItemType.blockCulling ||
      type === ProjectItemType.terrainTextureCatalogResourceJson ||
      type === ProjectItemType.blockTypeBehavior ||
      type === ProjectItemType.blocksCatalogResourceJson ||
      type === ProjectItemType.blockMaterialsBehaviorJson
    );
  }

  static isBlockRelated(projectItem: ProjectItem, dontGoUpward?: boolean, dontGoDownward?: boolean) {
    if (projectItem.parentItems && !dontGoUpward) {
      for (const parentItem of projectItem.parentItems) {
        if (parentItem.parentItem) {
          if (this.isBlock(parentItem.parentItem.itemType)) {
            return true;
          }

          if (this.isBlockRelated(parentItem.parentItem, false, true)) {
            return true;
          }
        }
      }
    }

    if (projectItem.childItems && !dontGoDownward) {
      for (const parentItem of projectItem.childItems) {
        if (parentItem.childItem) {
          if (this.isBlock(parentItem.childItem.itemType)) {
            return true;
          }

          if (this.isBlockRelated(parentItem.childItem, true, false)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  static isUI(type: ProjectItemType) {
    return type === ProjectItemType.uiJson || type === ProjectItemType.uiTexture;
  }

  static isUIRelated(
    projectItem: ProjectItem,
    goUpwardOnly?: boolean,
    goDownwardOnly?: boolean,
    visited?: Set<ProjectItem>
  ) {
    // Track visited items to prevent infinite recursion from circular dependencies
    if (visited === undefined) {
      visited = new Set<ProjectItem>();
    }

    if (visited.has(projectItem)) {
      return false; // Already visited, avoid infinite loop
    }
    visited.add(projectItem);

    if (projectItem.parentItems && (goUpwardOnly || goUpwardOnly === undefined)) {
      for (const parentItem of projectItem.parentItems) {
        if (parentItem.parentItem) {
          if (this.isUI(parentItem.parentItem.itemType)) {
            return true;
          }

          if (this.isUIRelated(parentItem.parentItem, true, false, visited)) {
            return true;
          }
        }
      }
    }

    if (projectItem.childItems && (goDownwardOnly || goDownwardOnly === undefined)) {
      for (const childItem of projectItem.childItems) {
        if (childItem.childItem) {
          if (this.isUI(childItem.childItem.itemType)) {
            return true;
          }

          if (this.isUIRelated(childItem.childItem, false, true, visited)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  static isBehaviorRelated(itemType: ProjectItemType) {
    if (
      itemType === ProjectItemType.spawnRuleBehavior ||
      itemType === ProjectItemType.lootTableBehavior ||
      itemType === ProjectItemType.recipeBehavior ||
      itemType === ProjectItemType.biomeBehavior ||
      itemType === ProjectItemType.featureBehavior ||
      itemType === ProjectItemType.featureRuleBehavior ||
      itemType === ProjectItemType.jigsawProcessorList ||
      itemType === ProjectItemType.jigsawStructure ||
      itemType === ProjectItemType.jigsawStructureSet ||
      itemType === ProjectItemType.jigsawTemplatePool
    ) {
      return true;
    }

    return false;
  }

  static getRootAncestorItems(item: ProjectItem, ancestorList?: ProjectItem[]) {
    if (ancestorList === undefined) {
      ancestorList = [];
    }

    if (item.parentItems) {
      for (const parentItem of item.parentItems) {
        if (parentItem.parentItem) {
          this.getRootAncestorItems(parentItem.parentItem, ancestorList);
        }
      }
    } else {
      ancestorList.push(item);
    }

    return ancestorList;
  }

  static getRelationshipDescription(itemRel: IProjectItemRelationship) {
    if (!itemRel.parentItem || !itemRel.childItem) {
      return undefined;
    }

    if (
      itemRel.parentItem.itemType === ProjectItemType.entityTypeBehavior &&
      itemRel.childItem.itemType === ProjectItemType.entityTypeResource
    ) {
      return StorageUtilities.getBaseFromName(itemRel.parentItem.name) + " visuals/audio";
    }

    return undefined;
  }

  static isDesignRelated(itemType: ProjectItemType) {
    if (
      itemType === ProjectItemType.designTexture ||
      itemType === ProjectItemType.designPackFolder ||
      itemType === ProjectItemType.actionSet ||
      itemType === ProjectItemType.designPackManifestJson
    ) {
      return true;
    }

    return false;
  }

  static isResourceRelated(itemType: ProjectItemType) {
    if (ProjectItemUtilities.isVibrantVisualsTypeRelated(itemType)) {
      return true;
    }

    if (
      itemType === ProjectItemType.attachableResourceJson ||
      itemType === ProjectItemType.animationControllerResourceJson ||
      itemType === ProjectItemType.animationResourceJson ||
      itemType === ProjectItemType.entityTypeResource ||
      itemType === ProjectItemType.renderControllerJson ||
      itemType === ProjectItemType.modelGeometryJson ||
      itemType === ProjectItemType.biomeResource ||
      itemType === ProjectItemType.biomesClientCatalogResource ||
      itemType === ProjectItemType.texture ||
      itemType === ProjectItemType.uiJson ||
      itemType === ProjectItemType.uiTexture ||
      itemType === ProjectItemType.audio ||
      itemType === ProjectItemType.itemTypeLegacyResource ||
      itemType === ProjectItemType.blocksCatalogResourceJson
    ) {
      return true;
    }

    return false;
  }

  static isItem(type: ProjectItemType) {
    return (
      type === ProjectItemType.itemTextureJson ||
      type === ProjectItemType.itemTypeBehavior ||
      type === ProjectItemType.attachableResourceJson ||
      type === ProjectItemType.itemTypeLegacyResource
    );
  }

  static isItemRelated(projectItem: ProjectItem, dontGoUpward?: boolean, dontGoDownward?: boolean) {
    if (projectItem.parentItems && !dontGoUpward) {
      for (const parentItem of projectItem.parentItems) {
        if (parentItem.parentItem) {
          if (this.isItem(parentItem.parentItem.itemType)) {
            return true;
          }

          if (this.isItemRelated(parentItem.parentItem, false, true)) {
            return true;
          }
        }
      }
    }

    if (projectItem.childItems && !dontGoDownward) {
      for (const parentItem of projectItem.childItems) {
        if (parentItem.childItem) {
          if (this.isItem(parentItem.childItem.itemType)) {
            return true;
          }

          if (this.isItemRelated(parentItem.childItem, true, false)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  static isEntity(type: ProjectItemType) {
    return (
      type === ProjectItemType.entityTypeBehavior ||
      type === ProjectItemType.entityTypeResource ||
      type === ProjectItemType.renderControllerJson
    );
  }

  static isEntityRelated(projectItem: ProjectItem, dontGoUpward?: boolean, dontGoDownward?: boolean) {
    if (projectItem.parentItems && !dontGoUpward) {
      for (const parentItem of projectItem.parentItems) {
        if (parentItem.parentItem) {
          if (this.isEntity(parentItem.parentItem.itemType)) {
            return true;
          }

          if (this.isEntityRelated(parentItem.parentItem, false, true)) {
            return true;
          }
        }
      }
    }

    if (projectItem.childItems && !dontGoDownward) {
      for (const parentItem of projectItem.childItems) {
        if (parentItem.childItem) {
          if (this.isEntity(parentItem.childItem.itemType)) {
            return true;
          }

          if (this.isEntityRelated(parentItem.childItem, true, false)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  static isParticle(type: ProjectItemType) {
    return type === ProjectItemType.particleJson;
  }

  static isParticleRelated(projectItem: ProjectItem, dontGoUpward?: boolean, dontGoDownward?: boolean) {
    if (projectItem.parentItems && !dontGoUpward) {
      for (const parentItem of projectItem.parentItems) {
        if (parentItem.parentItem) {
          if (this.isParticle(parentItem.parentItem.itemType)) {
            return true;
          }

          if (this.isParticleRelated(parentItem.parentItem, false, true)) {
            return true;
          }
        }
      }
    }

    if (projectItem.childItems && !dontGoDownward) {
      for (const parentItem of projectItem.childItems) {
        if (parentItem.childItem) {
          if (this.isParticle(parentItem.childItem.itemType)) {
            return true;
          }

          if (this.isParticleRelated(parentItem.childItem, true, false)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  static getNewItemName(type: ProjectItemType) {
    return ProjectItemUtilities.getDescriptionForType(type).toLowerCase();
  }

  static getColorForType(type: ProjectItemType): IColor {
    const cat = ProjectItemUtilities.getCategory(type);

    switch (cat) {
      case ProjectItemCategory.logic:
        return {
          red: (type % 4) * 24 + 160,
          green: (Math.floor(type / 4) % 4) * 12 + 104,
          blue: (Math.floor(type / 16) % 4) * 12 + 104,
        };

      case ProjectItemCategory.assets:
        return {
          red: (Math.floor(type / 4) % 4) * 12 + 104,
          green: (type % 4) * 24 + 160,
          blue: (Math.floor(type / 16) % 4) * 12 + 104,
        };

      case ProjectItemCategory.types:
        return {
          red: (Math.floor(type / 16) % 4) * 12 + 104,
          green: (Math.floor(type / 4) % 4) * 12 + 104,
          blue: (type % 4) * 24 + 160,
        };

      default:
        return {
          red: (Math.floor(type / 4) % 4) * 24 + 128,
          green: (Math.floor(type / 4) % 4) * 24 + 128,
          blue: (Math.floor(type / 4) % 4) * 24 + 128,
        };
    }
  }

  static getPluralDescriptionForType(type: ProjectItemType) {
    // override non-"plus s" plural-ifications here
    switch (type) {
      case ProjectItemType.audio:
        return "Audio";
      case ProjectItemType.ts:
        return "TypeScript files";
      case ProjectItemType.js:
        return "JavaScript files";
      case ProjectItemType.itemTypeLegacyResource:
        return "Item type visuals and audio";
      case ProjectItemType.entityTypeResource:
        return "Entity type visuals/audio";
      case ProjectItemType.catalogIndexJs:
        return "Catalog indexes";
      case ProjectItemType.behaviorPackHistoryListJson:
        return "Behavior pack histories";
      case ProjectItemType.resourcePackHistoryListJson:
        return "Resource pack histories";
      case ProjectItemType.globalVariablesJson:
      case ProjectItemType.materialGeometry:
      case ProjectItemType.atmosphericsJson:
      case ProjectItemType.biomesClientCatalogResource:
      case ProjectItemType.vsCodeTasksJson:
      case ProjectItemType.vsCodeSettingsJson:
      case ProjectItemType.vsCodeExtensionsJson:
      case ProjectItemType.mcToolsProjectPreferences:
      case ProjectItemType.materialsResourceJson:
      case ProjectItemType.lang:
        return this.getDescriptionForType(type);
      default:
        const str = this.getDescriptionForType(type);

        if (!str.endsWith("s")) {
          return str + "s";
        }

        return str;
    }
  }

  static getCousinOfType(projectItem: ProjectItem, itemType: ProjectItemType): ProjectItem | undefined {
    if (!projectItem.parentItems) {
      return undefined;
    }

    for (const parentRel of projectItem.parentItems) {
      const result = this.getFirstDescendentOfType(parentRel.parentItem, itemType);
      if (result) {
        return result;
      }
    }

    return undefined;
  }

  static getFirstDescendentOfType(projectItem: ProjectItem, itemType: ProjectItemType): ProjectItem | undefined {
    if (!projectItem.childItems) {
      return undefined;
    }

    for (const rel of projectItem.childItems) {
      if (rel.childItem.itemType === itemType) {
        return rel.childItem;
      }
    }

    for (const rel of projectItem.childItems) {
      const found = this.getFirstDescendentOfType(rel.childItem, itemType);

      if (found) {
        return found;
      }
    }

    return undefined;
  }

  static async getDefaultFolderForType(project: Project, itemType: ProjectItemType) {
    const paths = ProjectItemUtilities.getFolderRootsForType(itemType);

    if (paths === undefined || paths.length === 0) {
      return undefined;
    }

    await project.ensureLoadedProjectFolder();

    if (!project.projectFolder) {
      return undefined;
    }

    switch (itemType) {
      case ProjectItemType.js:
      case ProjectItemType.ts:
        const scriptsFolder = await project.getMainScriptsFolder();

        return scriptsFolder;

      case ProjectItemType.entityTypeBehavior:
      case ProjectItemType.MCFunction:
        const defaultBpFolder = await project.getDefaultBehaviorPackFolder();

        if (!defaultBpFolder) {
          return undefined;
        }

        return defaultBpFolder.ensureFolderFromRelativePath(paths[0]);

      case ProjectItemType.entityTypeResource:
      case ProjectItemType.modelGeometryJson:
        const defaultRpFolder = await project.getDefaultResourcePackFolder();

        if (!defaultRpFolder) {
          return undefined;
        }

        return defaultRpFolder.ensureFolderFromRelativePath(paths[0]);

      case ProjectItemType.spawnRuleBehavior:
      case ProjectItemType.lootTableBehavior:
      case ProjectItemType.recipeBehavior:
      case ProjectItemType.featureBehavior:
      case ProjectItemType.featureRuleBehavior:
      case ProjectItemType.jigsawProcessorList:
      case ProjectItemType.jigsawStructure:
      case ProjectItemType.jigsawTemplatePool:
      case ProjectItemType.jigsawStructureSet:
        return await ProjectUtilities.getDefaultBehaviorPackFolder(project, paths);

      case ProjectItemType.designTexture:
        const defaultDpFolder = await project.getDefaultDesignPackFolder();

        if (!defaultDpFolder) {
          return undefined;
        }

        return defaultDpFolder.ensureFolderFromRelativePath(StorageUtilities.ensureStartsWithDelimiter(paths[0]));

      case ProjectItemType.uiTexture:
        const defaultRpFolderA = await project.getDefaultResourcePackFolder();

        if (!defaultRpFolderA) {
          return undefined;
        }

        return defaultRpFolderA.ensureFolderFromRelativePath(paths.join("/"));
    }

    return undefined;
  }

  static getNewItemTechnicalName(type: ProjectItemType) {
    const roots = this.getFolderRootsForType(type);

    if (roots.length > 0) {
      let str = roots[roots.length - 1];

      if (str === "entities") {
        str = "entity";
      } else if (str.endsWith("s")) {
        str = str.substring(0, str.length - 1);
      }

      return str;
    }

    return "item";
  }

  static getFolderRootsForType(itemType: ProjectItemType) {
    switch (itemType) {
      case ProjectItemType.MCFunction:
        return ["functions"];

      case ProjectItemType.featureRuleBehavior:
        return ["feature_rules"];

      case ProjectItemType.actionSet:
        return ["action_sets"];

      case ProjectItemType.designTexture:
        return ["design_textures"];

      case ProjectItemType.featureBehavior:
        return ["features"];

      case ProjectItemType.js:
      case ProjectItemType.ts:
        return ["scripts"];

      case ProjectItemType.image:
        return ["subpacks"];

      case ProjectItemType.craftingItemCatalog:
        return ["item_catalog"];

      case ProjectItemType.lightingJson:
        return ["lighting"];

      case ProjectItemType.tickJson:
        return ["functions"];

      case ProjectItemType.uiTexture:
        return ["textures", "ui"];

      case ProjectItemType.jigsawProcessorList:
        return ["worldgen", "processors"];

      case ProjectItemType.jigsawStructure:
        return ["worldgen", "jigsaw_structures"];

      case ProjectItemType.jigsawTemplatePool:
        return ["worldgen", "template_pools"];

      case ProjectItemType.jigsawStructureSet:
        return ["worldgen", "structure_sets"];

      case ProjectItemType.biomeResource:
      case ProjectItemType.biomeBehavior:
        return ["biomes"];

      case ProjectItemType.texture:
      case ProjectItemType.terrainTextureCatalogResourceJson:
      case ProjectItemType.itemTextureJson:
      case ProjectItemType.flipbookTexturesJson:
        return ["textures"];

      case ProjectItemType.packIconImage:
        return [
          "resource_packs",
          "rps",
          "development_resource_packs",
          "behavior_packs",
          "bps",
          "development_behavior_packs",
        ];

      case ProjectItemType.modelGeometryJson:
        return ["models"];
      case ProjectItemType.soundCatalog:
        return ["resource_packs", "rps", "development_resource_packs"];
      case ProjectItemType.soundDefinitionCatalog:
        return ["sounds"];
      case ProjectItemType.entityTypeResource:
        return ["entity"];
      case ProjectItemType.animationControllerResourceJson:
      case ProjectItemType.animationControllerBehaviorJson:
        return ["animation_controllers"];
      case ProjectItemType.animationResourceJson:
      case ProjectItemType.animationBehaviorJson:
        return ["animations"];
      case ProjectItemType.renderControllerJson:
        return ["render_controllers"];
      case ProjectItemType.attachableResourceJson:
        return ["attachables"];
      case ProjectItemType.entityTypeBehavior:
        return ["entities"];
      case ProjectItemType.itemTypeBehavior:
      case ProjectItemType.itemTypeLegacyResource:
        return ["items"];
      case ProjectItemType.blockTypeBehavior:
        return ["blocks"];
      case ProjectItemType.documentedTypeFolder:
        return ["script_modules"];
      case ProjectItemType.commandSetDefinitionJson:
        return ["command_modules"];
      case ProjectItemType.lootTableBehavior:
        return ["loot_tables"];
      case ProjectItemType.recipeBehavior:
        return ["recipes"];
      case ProjectItemType.spawnRuleBehavior:
        return ["spawn_rules"];
      case ProjectItemType.particleJson:
        return ["particles"];
      case ProjectItemType.structure:
        return ["structures"];
      case ProjectItemType.worldFolder:
      case ProjectItemType.MCWorld:
        return ["worlds"];
      case ProjectItemType.colorGradingJson:
        return ["color_grading"];
      case ProjectItemType.atmosphericsJson:
        return ["atmospherics"];
      case ProjectItemType.pbrJson:
        return ["pbr"];
      case ProjectItemType.pointLightsJson:
        return ["point_lights"];
      case ProjectItemType.shadowsJson:
        return ["shadows"];
      case ProjectItemType.waterJson:
        return ["water"];
      case ProjectItemType.aimAssistPresetJson:
        return ["cameras"];
      case ProjectItemType.dimensionJson:
        return ["dimensions"];
      case ProjectItemType.fogResourceJson:
        return ["fogs"];
      case ProjectItemType.dataForm:
        return ["forms"];
      case ProjectItemType.scriptTypesJson:
        return ["checkpoint_input", "script_modules"];
      case ProjectItemType.engineOrderingJson:
        return ["checkpoint_input", "engine_modules"];
      case ProjectItemType.vanillaDataJson:
        return ["checkpoint_input", "vanilladata_modules"];
      case ProjectItemType.marketingAssetImage:
        return ["marketing art"];
      case ProjectItemType.storeAssetImage:
        return ["store art"];
      case ProjectItemType.audio:
        return ["sounds"];
      case ProjectItemType.materialSetJson:
      case ProjectItemType.materialsResourceJson:
      case ProjectItemType.material:
        return ["materials"];
    }

    return [];
  }
}

export function getEnsuredFile(items: readonly ProjectItem[], predicate: (item: ProjectItem) => boolean) {
  const foundItem = items.find(predicate);

  return foundItem ? foundItem.loadFileContent() : Promise.resolve(undefined);
}

export const getEnsuredFileOfType = (items: readonly ProjectItem[], type: ProjectItemType) =>
  getEnsuredFile(items, (item) => item.itemType === type);

export function findEnsuredFiles(items: readonly ProjectItem[], predicate: (item: ProjectItem) => boolean) {
  const filteredItems = items.filter(predicate);

  return Promise.all(filteredItems.map((item) => item.loadFileContent()));
}

export const findEnsuredFilesOfType = (items: readonly ProjectItem[], type: ProjectItemType) =>
  findEnsuredFiles(items, (item) => item.itemType === type);

export function getNeighborFiles(items: readonly ProjectItem[], subject: ProjectItem): ProjectItem[] {
  const projectPath = subject.projectPath?.toLowerCase();
  if (!projectPath) {
    throw new Error(`No Project path found for project item: ${subject.name}`);
  }
  const folderProjectPath = projectPath.substring(0, projectPath.length - subject.name.length);

  const neighbors =
    folderProjectPath && items.filter((item) => item.projectPath?.toLocaleLowerCase().startsWith(folderProjectPath));
  return neighbors || [];
}

export function getWorldTemplates(items: readonly ProjectItem[]) {
  return items
    .filter((item) => item.itemType === ProjectItemType.worldTemplateManifestJson)
    .map((worldManifest) => ({ name: worldManifest.name, items: getNeighborFiles(items, worldManifest) }));
}

export function getMarketContent(items: readonly ProjectItem[]) {
  const marketContentTypes = new Set([ProjectItemType.storeAssetImage, ProjectItemType.marketingAssetImage]);

  return items.filter((item) => marketContentTypes.has(item.itemType));
}

export async function tryEnsureFiles(items: ProjectItem[], predicate: (item: ProjectItem) => boolean = () => true) {
  const filteredItems = items.filter(predicate);

  const fileReads = await Promise.all(filteredItems.map(async (item) => [item, await item.loadFileContent()] as const));

  const success: ProjectItem[] = [];
  const failed: ProjectItem[] = [];

  for (const [item, file] of fileReads) {
    if (!file) {
      failed.push(item);
    } else {
      success.push(item);
    }
  }

  return [success, failed] as const;
}

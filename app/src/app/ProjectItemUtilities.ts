// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IColor from "../core/IColor";
import Utilities from "../core/Utilities";
import { PackType } from "../minecraft/Pack";
import StorageUtilities from "../storage/StorageUtilities";
import { ProjectItemCategory, ProjectItemType } from "./IProjectItemData";
import Project from "./Project";
import ProjectItem from "./ProjectItem";
import ProjectUtilities from "./ProjectUtilities";

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
      case ProjectItemType.biomeBehaviorJson:
        return "behavior/blocks/blocks.json";
      case ProjectItemType.dialogueBehaviorJson:
        return "behavior/dialogue/dialogue.json";
      case ProjectItemType.entityTypeBehavior:
        return "behavior/entities/entities.json";
      case ProjectItemType.atmosphericsJson:
        return "behavior/lighting/atmospherics.json";
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
      case ProjectItemType.biomeResourceJson:
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
      case ProjectItemType.languagesCatalogResourceJson:
        return "language/languages.json";
      case ProjectItemType.featureBehavior:
        return "behavior/features/features.json";
      case ProjectItemType.featureRuleBehaviorJson:
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
      case ProjectItemType.itemTypeResourceJson:
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

  static getSortOrder(itemType: ProjectItemType): number {
    // default order is item type * 100;
    switch (itemType) {
      case ProjectItemType.resourcePackManifestJson: // sort next to .behaviorPackManifestJson
        return 510;

      case ProjectItemType.entityTypeBehavior:
        return 1851;

      case ProjectItemType.blockTypeBehavior:
        return 1852;

      case ProjectItemType.itemTypeBehavior:
        return 1853;

      case ProjectItemType.recipeBehavior:
        return 1860;

      case ProjectItemType.particleJson:
        return 1870;

      case ProjectItemType.tickJson:
        return 903;

      case ProjectItemType.soundCatalog:
        return 9901;

      case ProjectItemType.modelGeometryJson:
        return 5001;

      case ProjectItemType.renderControllerJson:
        return 5003;

      // sort all the world-y and container-y stuff next to each other
      case ProjectItemType.structure:
      case ProjectItemType.MCWorld:
      case ProjectItemType.MCTemplate:
      case ProjectItemType.MCPack:
      case ProjectItemType.MCProject:
      case ProjectItemType.zip:
        return 1600 + itemType;
    }

    return itemType * 100;
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
      case ProjectItemType.uiTexture:
      case ProjectItemType.iconImage:
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
      case ProjectItemType.languagesCatalogResourceJson:
      case ProjectItemType.ninesliceJson:
      case ProjectItemType.attachableResourceJson:
      case ProjectItemType.audio:
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
      case ProjectItemType.biomeBehaviorJson:
      case ProjectItemType.biomeResourceJson:
      case ProjectItemType.lootTableBehavior:
      case ProjectItemType.spawnRuleBehavior:
      case ProjectItemType.dialogueBehaviorJson:
      case ProjectItemType.MCWorld:
      case ProjectItemType.worldTemplateManifestJson:
      case ProjectItemType.itemTypeResourceJson:
      case ProjectItemType.featureBehavior:
      case ProjectItemType.featureRuleBehaviorJson:
        return ProjectItemCategory.types;

      case ProjectItemType.esLintConfigMjs:
      case ProjectItemType.env:
      case ProjectItemType.justConfigTs:
      case ProjectItemType.packageLockJson:
      case ProjectItemType.jsconfigJson:
      case ProjectItemType.prettierRcJson:
      case ProjectItemType.tsconfigJson:
      case ProjectItemType.docfxJson:
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
      case ProjectItemType.behaviorPackFolder:
      case ProjectItemType.resourcePackFolder:
      case ProjectItemType.skinPackFolder:
        return ProjectItemCategory.package;
    }

    return ProjectItemCategory.unknown;
  }

  static isImageType(itemType: ProjectItemType) {
    if (
      itemType === ProjectItemType.image ||
      itemType === ProjectItemType.texture ||
      itemType === ProjectItemType.storeAssetImage ||
      itemType === ProjectItemType.marketingAssetImage ||
      itemType === ProjectItemType.uiTexture ||
      itemType === ProjectItemType.iconImage
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

      case ProjectItemType.json:
      case ProjectItemType.behaviorPackManifestJson:
      case ProjectItemType.resourcePackManifestJson:
      case ProjectItemType.entityTypeBehavior:
      case ProjectItemType.tickJson:
      case ProjectItemType.aimAssistJson:
      case ProjectItemType.waterJson:
      case ProjectItemType.shadowsJson:
      case ProjectItemType.pbrJson:
      case ProjectItemType.atmosphericsJson:
      case ProjectItemType.pointLightsJson:
      case ProjectItemType.colorGradingJson:
      case ProjectItemType.cameraJson:
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
      case ProjectItemType.biomeResourceJson:
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
      case ProjectItemType.languagesCatalogResourceJson:
      case ProjectItemType.biomeBehaviorJson:
      case ProjectItemType.dialogueBehaviorJson:
      case ProjectItemType.featureRuleBehaviorJson:
      case ProjectItemType.featureBehavior:
      case ProjectItemType.functionEventJson:
      case ProjectItemType.recipeBehavior:
      case ProjectItemType.spawnRuleBehavior:
      case ProjectItemType.tradingBehaviorJson:
      case ProjectItemType.volumeBehaviorJson:
      case ProjectItemType.attachableResourceJson:
      case ProjectItemType.itemTypeResourceJson:
      case ProjectItemType.materialsResourceJson:
      case ProjectItemType.musicDefinitionJson:
      case ProjectItemType.soundDefinitionCatalog:
      case ProjectItemType.contentIndexJson:
      case ProjectItemType.contentReportJson:
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
      case ProjectItemType.iconImage:
      case ProjectItemType.marketingAssetImage:
      case ProjectItemType.storeAssetImage:
        return ["image/png", "image/tiff"];

      default:
        return ["application/octet-stream"];
    }
  }

  static getDescriptionForType(type: ProjectItemType) {
    switch (type) {
      case ProjectItemType.js:
        return "JavaScript";
      case ProjectItemType.buildProcessedJs:
        return "Built JavaScript";
      case ProjectItemType.ts:
        return "TypeScript";
      case ProjectItemType.json:
        return "General json file";
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
      case ProjectItemType.pbrJson:
        return "PBR";
      case ProjectItemType.atmosphericsJson:
        return "Atmospherics";
      case ProjectItemType.pointLightsJson:
        return "Point Light";
      case ProjectItemType.colorGradingJson:
        return "Color Grading";
      case ProjectItemType.cameraJson:
        return "Camera";
      case ProjectItemType.aimAssistJson:
        return "Aim Assist";
      case ProjectItemType.catalogIndexJs:
        return "Catalog index";
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
      case ProjectItemType.biomeResourceJson:
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
      case ProjectItemType.languagesCatalogResourceJson:
        return "Language catalog";
      case ProjectItemType.biomeBehaviorJson:
        return "Biome";
      case ProjectItemType.dialogueBehaviorJson:
        return "Entity dialogue";
      case ProjectItemType.featureRuleBehaviorJson:
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
      case ProjectItemType.itemTypeResourceJson:
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
      case ProjectItemType.iconImage:
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
    paths?: string[],
    dontGoUpward?: boolean,
    dontGoDownward?: boolean
  ) {
    if (!paths) {
      paths = [];
    }

    if (!candidate.projectPath) {
      return false;
    }

    if (paths.includes(candidate.projectPath)) {
      return true;
    }

    if (!considering) {
      considering = candidate;
    } else if (considering.projectPath) {
      paths.push(considering.projectPath);
    }

    if (considering.parentItems && !dontGoUpward) {
      for (const parentItem of considering.parentItems) {
        if (parentItem.parentItem) {
          if (this.wouldBeCircular(candidate, parentItem.parentItem, paths, false, true)) {
            return true;
          }
        }
      }
    }

    if (considering.childItems && !dontGoDownward) {
      for (const childItem of considering.childItems) {
        if (childItem.childItem) {
          if (this.wouldBeCircular(candidate, childItem.childItem, paths, true, false)) {
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

          if (this.isBlockRelated(parentItem.parentItem, true, false)) {
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

  static isUIRelated(projectItem: ProjectItem, dontGoUpward?: boolean, dontGoDownward?: boolean) {
    if (projectItem.parentItems && !dontGoUpward) {
      for (const parentItem of projectItem.parentItems) {
        if (parentItem.parentItem) {
          if (this.isUI(parentItem.parentItem.itemType)) {
            return true;
          }

          if (this.isUIRelated(parentItem.parentItem, false, true)) {
            return true;
          }
        }
      }
    }

    if (projectItem.childItems && !dontGoDownward) {
      for (const parentItem of projectItem.childItems) {
        if (parentItem.childItem) {
          if (this.isUI(parentItem.childItem.itemType)) {
            return true;
          }

          if (this.isUIRelated(parentItem.parentItem, true, false)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  static isItem(type: ProjectItemType) {
    return (
      type === ProjectItemType.itemTextureJson ||
      type === ProjectItemType.itemTypeBehavior ||
      type === ProjectItemType.attachableResourceJson ||
      type === ProjectItemType.itemTypeResourceJson
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

          if (this.isItemRelated(parentItem.parentItem, true, false)) {
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

          if (this.isEntityRelated(parentItem.parentItem, true, false)) {
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

          if (this.isParticleRelated(parentItem.parentItem, true, false)) {
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
      case ProjectItemType.itemTypeResourceJson:
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
      case ProjectItemType.biomeResourceJson:
      case ProjectItemType.vsCodeTasksJson:
      case ProjectItemType.vsCodeSettingsJson:
      case ProjectItemType.vsCodeExtensionsJson:
      case ProjectItemType.mcToolsProjectPreferences:
      case ProjectItemType.materialsResourceJson:
      case ProjectItemType.lang:
        return this.getDescriptionForType(type);
      default:
        return this.getDescriptionForType(type) + "s";
    }
  }

  static async getDefaultFolderForType(project: Project, itemType: ProjectItemType) {
    const path = ProjectItemUtilities.getFolderRootsForType(itemType);

    if (path === undefined || path.length === 0) {
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

        return defaultBpFolder.ensureFolderFromRelativePath(path[0]);

      case ProjectItemType.entityTypeResource:
      case ProjectItemType.modelGeometryJson:
        const defaultRpFolder = await project.getDefaultResourcePackFolder();

        if (!defaultRpFolder) {
          return undefined;
        }

        return defaultRpFolder.ensureFolderFromRelativePath(path[0]);

      case ProjectItemType.spawnRuleBehavior:
        return await ProjectUtilities.getDefaultSpawnRulesFolder(project);

      case ProjectItemType.lootTableBehavior:
        return await ProjectUtilities.getDefaultLootTableFolder(project);

      case ProjectItemType.uiTexture:
        const defaultRpFolderA = await project.getDefaultResourcePackFolder();

        if (!defaultRpFolderA) {
          return undefined;
        }

        return defaultRpFolderA.ensureFolderFromRelativePath(path.join("/"));
    }

    return undefined;
  }

  static getFolderRootsForType(itemType: ProjectItemType) {
    switch (itemType) {
      case ProjectItemType.MCFunction:
        return ["functions"];

      case ProjectItemType.js:
      case ProjectItemType.ts:
        return ["scripts"];

      case ProjectItemType.image:
        return ["subpacks"];

      case ProjectItemType.lightingJson:
        return ["lighting"];

      case ProjectItemType.tickJson:
        return ["functions"];

      case ProjectItemType.uiTexture:
        return ["textures", "ui"];
      case ProjectItemType.texture:
      case ProjectItemType.terrainTextureCatalogResourceJson:
      case ProjectItemType.itemTextureJson:
      case ProjectItemType.flipbookTexturesJson:
        return ["textures"];
      case ProjectItemType.iconImage:
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
      case ProjectItemType.renderControllerJson:
        return ["render_controllers"];
      case ProjectItemType.attachableResourceJson:
        return ["attachables"];
      case ProjectItemType.entityTypeBehavior:
        return ["entities"];
      case ProjectItemType.itemTypeBehavior:
      case ProjectItemType.itemTypeResourceJson:
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
      case ProjectItemType.aimAssistJson:
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

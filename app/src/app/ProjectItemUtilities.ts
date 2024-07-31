// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IColor from "../core/IColor";
import Utilities from "../core/Utilities";
import { PackType } from "../minecraft/Pack";
import StorageUtilities from "../storage/StorageUtilities";
import { ProjectItemCategory, ProjectItemType } from "./IProjectItemData";
import Project from "./Project";

export default class ProjectItemUtilities {
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
      return { itemType: ProjectItemType.recipeBehaviorJson };
    } else if (firstHundred.indexOf('"minecraft:entity"') >= 0) {
      return { itemType: ProjectItemType.entityTypeBehaviorJson };
    } else if (firstHundred.indexOf('"minecraft:item"') >= 0) {
      return { itemType: ProjectItemType.itemTypeBehaviorJson };
    } else if (firstHundred.indexOf('"pools"') >= 0) {
      return { itemType: ProjectItemType.itemTypeBehaviorJson };
    } else if (firstHundred.indexOf('"minecraft:spawn_rules"') >= 0) {
      return { itemType: ProjectItemType.spawnRuleBehaviorJson };
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
      return { itemType: ProjectItemType.entityTypeResourceJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"minecraft:fog_settings"') >= 0) {
      return { itemType: ProjectItemType.fogResourceJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"minecraft:geometry"') >= 0) {
      return { itemType: ProjectItemType.modelGeometryJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"particle_effect"') >= 0) {
      return { itemType: ProjectItemType.particleJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"render_controllers"') >= 0) {
      return { itemType: ProjectItemType.renderControllerJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"namespace"') >= 0) {
      return { itemType: ProjectItemType.uiJson, packType: PackType.resource };
    } else if (firstHundred.indexOf('"sound_definitions"') >= 0) {
      return { itemType: ProjectItemType.soundDefinitionJson, packType: PackType.resource };
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

      case ProjectItemType.entityTypeBehaviorJson:
        return 1851;

      case ProjectItemType.blockTypeBehaviorJson:
        return 1852;

      case ProjectItemType.itemTypeBehaviorJson:
        return 1853;
      case ProjectItemType.recipeBehaviorJson:
        return 1860;
      case ProjectItemType.particleJson:
        return 1870;
      case ProjectItemType.tickJson:
        return 903;

      case ProjectItemType.soundsCatalogResourceJson:
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
      case ProjectItemType.actionSetJson:
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
      case ProjectItemType.soundDefinitionJson:
      case ProjectItemType.soundsCatalogResourceJson:
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
      case ProjectItemType.uiTextureJson:
      case ProjectItemType.attachableResourceJson:
      case ProjectItemType.audio:
        return ProjectItemCategory.assets;

      case ProjectItemType.entityTypeBehaviorJson:
      case ProjectItemType.entityTypeResourceJson:
      case ProjectItemType.entityTypeBaseJs:
      case ProjectItemType.entityTypeBaseTs:
      case ProjectItemType.blockTypeBehaviorJson:
      case ProjectItemType.blocksCatalogResourceJson:
      case ProjectItemType.blockTypeResourceJson:
      case ProjectItemType.itemTypeBehaviorJson:
      case ProjectItemType.fogResourceJson:
      case ProjectItemType.tradingBehaviorJson:
      case ProjectItemType.particleJson:
      case ProjectItemType.structure:
      case ProjectItemType.recipeBehaviorJson:
      case ProjectItemType.biomeBehaviorJson:
      case ProjectItemType.biomeResourceJson:
      case ProjectItemType.lootTableBehaviorJson:
      case ProjectItemType.spawnRuleBehaviorJson:
      case ProjectItemType.dialogueBehaviorJson:
      case ProjectItemType.MCWorld:
      case ProjectItemType.worldTemplateManifestJson:
      case ProjectItemType.itemTypeResourceJson:
      case ProjectItemType.featureBehaviorJson:
      case ProjectItemType.featureRuleBehaviorJson:
        return ProjectItemCategory.types;

      case ProjectItemType.esLintMjs:
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
      case ProjectItemType.entityTypeBehaviorJson:
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
      case ProjectItemType.cameraJson:
        return "Camera";
      case ProjectItemType.catalogIndexJs:
        return "Catalog index";
      case ProjectItemType.behaviorPackFolder:
        return "Behavior pack";
      case ProjectItemType.resourcePackFolder:
        return "Resource pack";
      case ProjectItemType.skinPackFolder:
        return "Skin pack";
      case ProjectItemType.actionSetJson:
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
      case ProjectItemType.blockTypeBehaviorJson:
        return "Block type";
      case ProjectItemType.blockMaterialsBehaviorJson:
        return "Block type materials";
      case ProjectItemType.itemTypeBehaviorJson:
        return "Item type";
      case ProjectItemType.lootTableBehaviorJson:
        return "Loot table";
      case ProjectItemType.biomeResourceJson:
        return "Biome resources";
      case ProjectItemType.fileListArrayJson:
        return "File list";
      case ProjectItemType.blocksCatalogResourceJson:
        return "Block resource catalog";
      case ProjectItemType.soundsCatalogResourceJson:
        return "Sound catalog";
      case ProjectItemType.animationResourceJson:
        return "Animation";
      case ProjectItemType.animationControllerResourceJson:
        return "Animation controller";
      case ProjectItemType.entityTypeResourceJson:
        return "Entity type resources";
      case ProjectItemType.fogResourceJson:
        return "Fog";
      case ProjectItemType.modelGeometryJson:
        return "Model";
      case ProjectItemType.particleJson:
        return "Particle";
      case ProjectItemType.renderControllerJson:
        return "Render controller";
      case ProjectItemType.uiTextureJson:
        return "UI texture";
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
      case ProjectItemType.featureBehaviorJson:
        return "Feature";
      case ProjectItemType.functionEventJson:
        return "Function event";
      case ProjectItemType.recipeBehaviorJson:
        return "Recipe";
      case ProjectItemType.spawnRuleBehaviorJson:
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
      case ProjectItemType.soundDefinitionJson:
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
      case ProjectItemType.esLintMjs:
        return "ESLint Config";
      case ProjectItemType.justConfigTs:
        return "Just Config";
      case ProjectItemType.docInfoJson:
        return "Doc info json";
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
      case ProjectItemType.dataFormJson:
        return "Form";
      case ProjectItemType.dimensionJson:
        return "Dimension";
      case ProjectItemType.behaviorPackHistoryListJson:
        return "Behavior pack history";
      case ProjectItemType.resourcePackHistoryListJson:
        return "Resource pack history";
      default:
        return "Unknown";
    }
  }

  static getNewItemName(type: ProjectItemType) {
    return ProjectItemUtilities.getDescriptionForType(type);
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
      case ProjectItemType.ts:
        return "TypeScript files";
      case ProjectItemType.js:
        return "JavaScript files";
      case ProjectItemType.vsCodeTasksJson:
        return "VS Code task sets";
      case ProjectItemType.vsCodeSettingsJson:
        return "VS Code settings sets";
      case ProjectItemType.globalVariablesJson:
        return "UI global variable sets";
      case ProjectItemType.itemTypeResourceJson:
        return "Item type resource sets";
      case ProjectItemType.entityTypeResourceJson:
        return "Entity type resource sets";
      case ProjectItemType.materialGeometry:
        return "Geometries";
      case ProjectItemType.catalogIndexJs:
        return "Catalog indexes";
      case ProjectItemType.behaviorPackHistoryListJson:
        return "Behavior pack histories";
      case ProjectItemType.resourcePackHistoryListJson:
        return "Resource pack histories";
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

      case ProjectItemType.entityTypeBehaviorJson:
      case ProjectItemType.MCFunction:
        const defaultBpFolder = await project.getDefaultBehaviorPackFolder();

        if (!defaultBpFolder) {
          return undefined;
        }

        return defaultBpFolder.ensureFolderFromRelativePath(path[0]);

      case ProjectItemType.entityTypeResourceJson:
      case ProjectItemType.modelGeometryJson:
        const defaultRpFolder = await project.getDefaultResourcePackFolder();

        if (!defaultRpFolder) {
          return undefined;
        }

        return defaultRpFolder.ensureFolderFromRelativePath(path[0]);

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
      case ProjectItemType.soundsCatalogResourceJson:
        return ["resource_packs", "rps", "development_resource_packs"];
      case ProjectItemType.soundDefinitionJson:
        return ["sounds"];
      case ProjectItemType.renderControllerJson:
        return ["render_controllers"];
      case ProjectItemType.attachableResourceJson:
        return ["attachables"];
      case ProjectItemType.entityTypeBehaviorJson:
        return ["entities"];
      case ProjectItemType.itemTypeBehaviorJson:
      case ProjectItemType.itemTypeResourceJson:
        return ["items"];
      case ProjectItemType.blockTypeBehaviorJson:
        return ["blocks"];
      case ProjectItemType.documentedTypeFolder:
        return ["script_modules"];
      case ProjectItemType.commandSetDefinitionJson:
        return ["command_modules"];
      case ProjectItemType.lootTableBehaviorJson:
        return ["loot_tables"];
      case ProjectItemType.recipeBehaviorJson:
        return ["recipes"];
      case ProjectItemType.spawnRuleBehaviorJson:
        return ["spawn_rules"];
      case ProjectItemType.particleJson:
        return ["particles"];
      case ProjectItemType.structure:
        return ["structures"];
      case ProjectItemType.worldFolder:
      case ProjectItemType.MCWorld:
        return ["worlds"];
      case ProjectItemType.cameraJson:
        return ["cameras"];
      case ProjectItemType.dimensionJson:
        return ["dimensions"];
      case ProjectItemType.fogResourceJson:
        return ["fogs"];
      case ProjectItemType.dataFormJson:
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

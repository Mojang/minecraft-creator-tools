import Log from "../../../core/Log";
import { ProjectItemType } from "../../IProjectItemData";
import { IProjectItemDefaults } from "./IProjectItemDefaults";

const ProjectItemValues = new Map<ProjectItemType, IProjectItemDefaults>([
  [ProjectItemType.MCFunction, { folderRoots: ["functions"] }],
  [ProjectItemType.featureRuleBehavior, { folderRoots: ["feature_rules"] }],
  [ProjectItemType.actionSet, { folderRoots: ["action_sets"] }],
  [ProjectItemType.designTexture, { folderRoots: ["design_textures"] }],
  [ProjectItemType.featureBehavior, { folderRoots: ["features"] }],
  [ProjectItemType.js, { folderRoots: ["scripts"] }],
  [ProjectItemType.ts, { folderRoots: ["scripts"] }],
  [ProjectItemType.image, { folderRoots: ["subpacks"] }],
  [ProjectItemType.craftingItemCatalog, { folderRoots: ["item_catalog"] }],
  [ProjectItemType.lightingJson, { folderRoots: ["lighting"] }],
  [ProjectItemType.tickJson, { folderRoots: ["functions"] }],
  [ProjectItemType.uiTexture, { folderRoots: ["textures", "ui"] }],
  [ProjectItemType.jigsawProcessorList, { folderRoots: ["worldgen", "processors"] }],
  [ProjectItemType.jigsawStructure, { folderRoots: ["worldgen", "jigsaw_structures"] }],
  [ProjectItemType.jigsawTemplatePool, { folderRoots: ["worldgen", "template_pools"] }],
  [ProjectItemType.jigsawStructureSet, { folderRoots: ["worldgen", "structure_sets"] }],
  [ProjectItemType.biomeResource, { folderRoots: ["biomes"] }],
  [ProjectItemType.biomeBehavior, { folderRoots: ["biomes"] }],
  [ProjectItemType.texture, { folderRoots: ["textures"] }],
  [ProjectItemType.terrainTextureCatalogResourceJson, { folderRoots: ["textures"] }],
  [ProjectItemType.itemTextureJson, { folderRoots: ["textures"] }],
  [ProjectItemType.flipbookTexturesJson, { folderRoots: ["textures"] }],
  [
    ProjectItemType.packIconImage,
    {
      folderRoots: [
        "resource_packs",
        "rps",
        "development_resource_packs",
        "behavior_packs",
        "bps",
        "development_behavior_packs",
      ],
    },
  ],
  [ProjectItemType.modelGeometryJson, { folderRoots: ["models"] }],
  [ProjectItemType.soundCatalog, { folderRoots: ["resource_packs", "rps", "development_resource_packs"] }],
  [ProjectItemType.soundDefinitionCatalog, { folderRoots: ["sounds"] }],
  [ProjectItemType.entityTypeResource, { folderRoots: ["entity"] }],
  [ProjectItemType.animationControllerResourceJson, { folderRoots: ["animation_controllers"] }],
  [ProjectItemType.animationControllerBehaviorJson, { folderRoots: ["animation_controllers"] }],
  [ProjectItemType.animationResourceJson, { folderRoots: ["animations"] }],
  [ProjectItemType.animationBehaviorJson, { folderRoots: ["animations"] }],
  [ProjectItemType.renderControllerJson, { folderRoots: ["render_controllers"] }],
  [ProjectItemType.attachableResourceJson, { folderRoots: ["attachables"] }],
  [ProjectItemType.entityTypeBehavior, { folderRoots: ["entities"] }],
  [ProjectItemType.itemTypeBehavior, { folderRoots: ["items"] }],
  [ProjectItemType.itemTypeLegacyResource, { folderRoots: ["items"] }],
  [ProjectItemType.blockTypeBehavior, { folderRoots: ["blocks"] }],
  [ProjectItemType.documentedTypeFolder, { folderRoots: ["script_modules"] }],
  [ProjectItemType.commandSetDefinitionJson, { folderRoots: ["command_modules"] }],
  [ProjectItemType.lootTableBehavior, { folderRoots: ["loot_tables"] }],
  [ProjectItemType.recipeBehavior, { folderRoots: ["recipes"] }],
  [ProjectItemType.spawnRuleBehavior, { folderRoots: ["spawn_rules"] }],
  [ProjectItemType.particleJson, { folderRoots: ["particles"] }],
  [ProjectItemType.structure, { folderRoots: ["structures"] }],
  [ProjectItemType.worldFolder, { folderRoots: ["worlds"] }],
  [ProjectItemType.MCWorld, { folderRoots: ["worlds"] }],
  [ProjectItemType.colorGradingJson, { folderRoots: ["color_grading"] }],
  [ProjectItemType.atmosphericsJson, { folderRoots: ["atmospherics"] }],
  [ProjectItemType.pbrJson, { folderRoots: ["pbr"] }],
  [ProjectItemType.pointLightsJson, { folderRoots: ["point_lights"] }],
  [ProjectItemType.shadowsJson, { folderRoots: ["shadows"] }],
  [ProjectItemType.waterJson, { folderRoots: ["water"] }],
  [ProjectItemType.aimAssistPresetJson, { folderRoots: ["cameras"] }],
  [ProjectItemType.dimensionJson, { folderRoots: ["dimensions"] }],
  [ProjectItemType.fogResourceJson, { folderRoots: ["fogs"] }],
  [ProjectItemType.dataForm, { folderRoots: ["forms"] }],
  [ProjectItemType.scriptTypesJson, { folderRoots: ["checkpoint_input", "script_modules"] }],
  [ProjectItemType.engineOrderingJson, { folderRoots: ["checkpoint_input", "engine_modules"] }],
  [ProjectItemType.vanillaDataJson, { folderRoots: ["checkpoint_input", "vanilladata_modules"] }],
  [ProjectItemType.marketingAssetImage, { folderRoots: ["marketing art"] }],
  [ProjectItemType.storeAssetImage, { folderRoots: ["store art"] }],
  [ProjectItemType.audio, { folderRoots: ["sounds"] }],
  [ProjectItemType.voxelShapeBehavior, { folderRoots: ["voxel_shapes"] }],
  [ProjectItemType.materialSetJson, { folderRoots: ["materials"] }],
  [ProjectItemType.materialsResourceJson, { folderRoots: ["materials"] }],
  [ProjectItemType.material, { folderRoots: ["materials"] }],
  [ProjectItemType.tradingBehaviorJson, { folderRoots: ["trading"] }],
  [ProjectItemType.blockCulling, { folderRoots: ["block_culling"] }],
]);

export const getProjectItemDefaults = (itemType: ProjectItemType): IProjectItemDefaults => {
  const defaults = ProjectItemValues.get(itemType);
  if (!defaults) {
    Log.verbose("No defaults found for item type: " + itemType);
    return { folderRoots: [] };
  }

  return defaults;
};

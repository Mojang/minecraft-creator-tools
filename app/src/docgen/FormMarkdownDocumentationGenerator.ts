import Utilities from "../core/Utilities";
import IFormDefinition from "../dataform/IFormDefinition";
import { IFormOverload, IFormOverloadParam } from "../dataform/IFormDefinition";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import IIndexJson from "../storage/IIndexJson";
import StorageUtilities from "../storage/StorageUtilities";
import DataFormUtilities from "../dataform/DataFormUtilities";
import IField, { FieldDataType } from "../dataform/IField";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import { ComparisonType } from "../dataform/ICondition";
import FieldUtilities from "../dataform/FieldUtilities";
import Log from "../core/Log";
import ValidationRulesMarkdownGenerator from "./ValidationRulesMarkdownGenerator";

// note: leave ms.date as a fixed date, to keep trivial noisy diffs from happening on every
// docgen run. Update manually when significant changes are made to the generator that
// warrant a new "version" of the generated docs.
export const MarkdownTop = `---
author: mammerla
ms.author: mikeam
title: "{0}"
description: "{1}"
ai-usage: ai-assisted
ms.service: minecraft-bedrock-edition
ms.date: 02/11/2025 
---
`;

export enum ExportMode {
  other = 0,
  triggers = 1,
  blockComponents = 2,
  itemComponents = 3,
  entityComponents = 4,
  AIGoals = 5,
  visuals = 6,
  fogs = 7,
  websockets = 8,
  filters = 9,
  MCToolsVal = 10,
  eventResponses = 11,
  clientBiomes = 12,
  biomes = 13,
  features = 14,
  featureCore = 15,
  deferredRendering = 16,
  molang = 17,
  culling = 18,
  manifest = 19,
  blockCullingComponents = 20,
  recipes = 21,
  lootTables = 22,
  spawnRules = 23,
  animations = 24,
  camera = 25,
  dialogue = 26,
  particles = 27,
  commands = 28,
  jigsaw = 29,
  dimensions = 30,
  attachables = 31,
  jsonUi = 32,
  tradeTables = 33,
  featureRules = 34,
  voxelShapes = 35,
}

export default class FormMarkdownDocumentationGenerator {
  private _referenceFolder: IFolder | undefined;
  private _skippedFiles: string[] = [];

  /** Keyword param types that represent literal tokens in command syntax, not user-supplied values. */
  private static readonly KEYWORD_PARAM_TYPES = new Set([
    "SET",
    "EASE",
    "POS",
    "ROT",
    "FACING",
    "DEFAULT",
    "CLEAR",
    "FADE",
    "TIME",
    "COLOR",
    "ATTACH_TO_ENTITY",
    "DETACH_FROM_ENTITY",
    "TARGET_ENTITY",
    "TARGET_CENTER_OFFSET",
    "REMOVE_TARGET",
    "VIEW_OFFSET",
    "ENTITY_OFFSET",
    "FOV_SET",
    "FOV_CLEAR",
    "PLAY_SPLINE",
    // Execute subcommand keywords
    "OPTION_AS",
    "OPTION_AT",
    "OPTION_IN",
    "OPTION_POSITIONED",
    "OPTION_ROTATED",
    "OPTION_FACING",
    "OPTION_ALIGN",
    "OPTION_ANCHORED",
    "OPTION_IF",
    "OPTION_UNLESS",
    "OPTION_RUN",
  ]);

  /**
   * Generate markdown documentation from form JSON files.
   * @param formJsonInputFolder The folder containing form.json files
   * @param outputFolder The folder to write generated markdown to
   * @param referenceFolder Optional folder containing existing docs - files that exist here will be skipped
   */
  public async generateMarkdown(formJsonInputFolder: IFolder, outputFolder: IFolder, referenceFolder?: IFolder) {
    this._referenceFolder = referenceFolder;
    this._skippedFiles = [];

    const formsByPath: { [name: string]: IFormDefinition } = {};

    await this.loadFormJsonFromFolder(formsByPath, formJsonInputFolder, outputFolder);

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.features,
      "/FeaturesReference/Examples/Features/",
      "/features/minecraft_",
      "Feature",
      "Feature Type"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.features,
      "/FeaturesReference/Examples/FeatureList.md",
      "/features/minecraft_",
      "Features",
      "Features"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.featureCore,
      "/FeaturesReference/Examples/Features/",
      "/feature/",
      "Feature",
      "Feature Type"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.features,
      "/FeaturesReference/Examples/Features/TOC.yml",
      "/features/minecraft_",
      "- name: Features List\n  href: ../FeatureList.md",
      "minecraft_"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.AIGoals,
      "/EntityReference/Examples/EntityGoals/",
      "/entity/minecraft_behavior",
      "Entity",
      "AI Behavior Component"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.visuals,
      "/VisualReference/",
      "/visual/",
      "Visuals",
      "Visual Element"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.fogs,
      "/FogsReference/",
      "/fogs/",
      "Fogs",
      "Fog Element"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.websockets,
      "/WebsocketsReference/",
      "/websockets/",
      "Websockets",
      "Websocket Packet"
    );

    await this.exportValidatorMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.MCToolsVal,
      "/MCToolsValReference/",
      "/mctoolsval/",
      "MCTools Validation Rules",
      "MCTools Validation Rules"
    );

    // Generate detailed validation rules documentation (user-friendly format with how-to-fix guidance)
    const validationRulesGenerator = new ValidationRulesMarkdownGenerator();
    // Access child folder directly - formJsonInputFolder should already be loaded
    await formJsonInputFolder.load(false);
    const mctoolsvalFolder = formJsonInputFolder.folders["mctoolsval"];
    if (mctoolsvalFolder) {
      await validationRulesGenerator.generateValidationDocs(mctoolsvalFolder, outputFolder);
    }

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.triggers,
      "/EntityReference/Examples/EntityTriggers/",
      "/entity/minecraft_on",
      "Entity",
      "Entity Trigger"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.filters,
      "/EntityReference/Examples/Filters/",
      "/entityfilters/",
      "Entity Filters",
      "Entity Filter Element"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.eventResponses,
      "/EntityReference/Examples/EventActions/",
      "/entityevents/",
      "Entity Actions",
      "Entity Action Types"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.blockCullingComponents,
      "/BlockCullingReference/Examples/BlockCullingRules/",
      "/client_block/",
      "Block Culling",
      "Block Culling"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.blockComponents,
      "/BlockReference/Examples/BlockComponents/",
      "/block/minecraft_",
      "Block Components",
      "Block Component"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.itemComponents,
      "/ItemReference/Examples/ItemComponents/",
      "/item_components/minecraft_",
      "Items",
      "Item Component"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.entityComponents,
      "/EntityReference/Examples/EntityComponents/",
      "/entity/minecraft_",
      "Entity",
      "Entity Component"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.deferredRendering,
      "/DeferredRendering/",
      "/client_deferred_rendering/",
      "Deferred Rendering",
      "Deferred Rendering"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.clientBiomes,
      "/ClientBiomesReference/Examples/Components/",
      "/client_biome/",
      "Client Biome",
      "Client Biome"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.manifest,
      "/ManifestReference/",
      "/3.0.0/",
      "Pack Manifest",
      "Pack Manifest"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.clientBiomes,
      "/ClientBiomesReference/Examples/ComponentList.md",
      "/client_biome/minecraft_",
      "Client Biomes",
      "Components"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.clientBiomes,
      "/ClientBiomesReference/Examples/Components/TOC.yml",
      "/client_biome/minecraft_",
      "- name: Components List\r\n  href: ../ComponentList.md",
      "minecraftClientBiomes_"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.entityComponents,
      "/EntityReference/Examples/ComponentList.md",
      "/entity/minecraft_",
      "Entity Components",
      "EntityComponents"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.entityComponents,
      "/EntityReference/Examples/EntityComponents/TOC.yml",
      "/entity/minecraft_",
      "- name: Components List\n  href: ../ComponentList.md",
      "minecraftComponent_"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.biomes,
      "/BiomesReference/Examples/Components/",
      "/biome/",
      "Biome",
      "Biome"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.biomes,
      "/BiomesReference/Examples/ComponentList.md",
      "/biome/minecraft_",
      "Biomes",
      "Components",
      ["capped.", "frozen_ocean.", "mesa.", "overworld.", "swamp", "the_end."] // these end up as children of surface_builder
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.biomes,
      "/BiomesReference/Examples/Components/TOC.yml",
      "/biome/minecraft_",
      "- name: Components List\n  href: ../ComponentList.md",
      "minecraftBiomes_",
      ["capped.", "frozen_ocean.", "mesa.", "overworld.", "swamp.", "the_end."]
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.blockComponents,
      "/BlockReference/Examples/BlockComponents/BlockComponentsList.md",
      "/block/minecraft_",
      "Block Components",
      "."
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.blockComponents,
      "/BlockReference/Examples/BlockComponents/TOC.yml",
      "/block/minecraft_",
      "- name: Block Components List\n  href: BlockComponentsList.md"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.itemComponents,
      "/ItemReference/Examples/ItemComponentList.md",
      "/item_components/minecraft_",
      "Item Components",
      "./ItemComponents"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.itemComponents,
      "/ItemReference/Examples/ItemComponents/TOC.yml",
      "/item_components/minecraft_",
      "- name: Item Components List\n  href: ../ItemComponentList.md"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.culling,
      "/BlockCullingReference/",
      "/block_culling/",
      "Block Culling",
      "Block Culling"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.culling,
      "/BlockCullingReference/TOC.yml",
      "/block_culling/"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.triggers,
      "/EntityReference/Examples/TriggerList.md",
      "/entity/minecraft_on",
      "Entity Triggers",
      "EntityTriggers"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.entityComponents,
      "/EntityReference/Examples/EntityTriggers/TOC.yml",
      "/entity/minecraft_on",
      "- name: Triggers List\n  href: ../TriggerList.md",
      "minecraftTrigger_"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.AIGoals,
      "/EntityReference/Examples/AIGoalList.md",
      "/entity/minecraft_behavior",
      "Entity Behavior (AI) Components",
      "EntityGoals"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.AIGoals,
      "/EntityReference/Examples/EntityGoals/TOC.yml",
      "/entity/minecraft_behavior",
      "- name: AI Component List\n  href: ../AIGoalList.md"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.filters,
      "/EntityReference/Examples/FilterList.md",
      "/entityfilters/",
      "Entity Filter Types",
      "Filters"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.filters,
      "/EntityReference/Examples/Filters/TOC.yml",
      "/entityfilters/",
      "- name: Entity Filter List\n  href: ../FilterList.md"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.eventResponses,
      "/EntityReference/Examples/EventActions.md",
      "/entityevents/",
      "Event Actions",
      "EventActions"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.eventResponses,
      "/EntityReference/Examples/EventActions/TOC.yml",
      "/entityevents/",
      "- name: Entity Event List\n  href: ../EventActions.md"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.molang,
      "/MolangReference/Examples/MolangConcepts/QueryFunctions/",
      "/molang/query_",
      "Molang",
      "Molang"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.molang,
      "/MolangReference/Examples/MolangConcepts/QueryFunctions.md",
      "/molang/query_",
      "Molang Query Functions",
      "queryfunctions"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.eventResponses,
      "/MolangReference/Examples/MolangConcepts/QueryFunctions/TOC.yml",
      "/molang/query_",
      "- name: Molang Query Function List\n  href: ../QueryFunctions.md"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.molang,
      "/MolangReference/Examples/MolangConcepts/MathFunctions/",
      "/molang/math_",
      "Molang",
      "Molang"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.molang,
      "/MolangReference/Examples/MolangConcepts/MathFunctions.md",
      "/molang/math_",
      "Molang Math Functions",
      "mathfunctions"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.eventResponses,
      "/MolangReference/Examples/MolangConcepts/MathFunctions/TOC.yml",
      "/molang/math_",
      "- name: Molang Math Function List\n  href: ../MathFunctions.md"
    );

    // Recipe documentation
    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.recipes,
      "/RecipeReference/Examples/RecipeDefinitions/",
      "/recipe/recipe_",
      "Recipes",
      "Recipe Definition"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.recipes,
      "/RecipeReference/Examples/RecipeList.md",
      "/recipe/recipe_",
      "Recipes",
      "RecipeDefinitions"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.recipes,
      "/RecipeReference/Examples/RecipeDefinitions/TOC.yml",
      "/recipe/recipe_",
      "- name: Recipe List\n  href: ../RecipeList.md"
    );

    // Loot Table documentation
    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.lootTables,
      "/LootTableReference/Examples/LootTableComponents/",
      "/loot/loot_",
      "Loot Tables",
      "Loot Table Component"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.lootTables,
      "/LootTableReference/Examples/LootTableList.md",
      "/loot/loot_",
      "Loot Tables",
      "LootTableComponents"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.lootTables,
      "/LootTableReference/Examples/LootTableComponents/TOC.yml",
      "/loot/loot_",
      "- name: Loot Table List\n  href: ../LootTableList.md"
    );

    // Spawn Rules documentation
    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.spawnRules,
      "/SpawnRulesReference/Examples/SpawnRulesComponents/",
      "/spawn/spawn_",
      "Spawn Rules",
      "Spawn Rule Component"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.spawnRules,
      "/SpawnRulesReference/Examples/SpawnRulesList.md",
      "/spawn/spawn_",
      "Spawn Rules",
      "SpawnRulesComponents"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.spawnRules,
      "/SpawnRulesReference/Examples/SpawnRulesComponents/TOC.yml",
      "/spawn/spawn_",
      "- name: Spawn Rules List\n  href: ../SpawnRulesList.md"
    );

    // Animation documentation
    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.animations,
      "/AnimationsReference/Examples/AnimationDefinitions/",
      "/animation/animation_",
      "Animations",
      "Animation Definition"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.animations,
      "/AnimationsReference/Examples/AnimationList.md",
      "/animation/animation_",
      "Animations",
      "AnimationDefinitions"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.animations,
      "/AnimationsReference/Examples/AnimationDefinitions/TOC.yml",
      "/animation/animation_",
      "- name: Animation List\n  href: ../AnimationList.md"
    );

    // Camera Aim Assist documentation
    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.camera,
      "/CameraReference/Examples/CameraDefinitions/",
      "/camera/",
      "Camera",
      "Camera Definition"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.camera,
      "/CameraReference/Examples/CameraList.md",
      "/camera/",
      "Camera Definitions",
      "CameraDefinitions"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.camera,
      "/CameraReference/Examples/CameraDefinitions/TOC.yml",
      "/camera/",
      "- name: Camera List\n  href: ../CameraList.md"
    );

    // NPC Dialogue documentation
    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.dialogue,
      "/DialogueReference/Examples/DialogueDefinitions/",
      "/dialogue/dialogue_",
      "Dialogue",
      "Dialogue Definition"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.dialogue,
      "/DialogueReference/Examples/DialogueList.md",
      "/dialogue/dialogue_",
      "NPC Dialogue",
      "DialogueDefinitions"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.dialogue,
      "/DialogueReference/Examples/DialogueDefinitions/TOC.yml",
      "/dialogue/dialogue_",
      "- name: Dialogue List\n  href: ../DialogueList.md"
    );

    // Particle Effects documentation
    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.particles,
      "/ParticlesReference/Examples/ParticleComponents/",
      "/client_particles/",
      "Particles",
      "Particle Component"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.particles,
      "/ParticlesReference/Examples/ParticleList.md",
      "/client_particles/",
      "Particle Effects",
      "ParticleComponents"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.particles,
      "/ParticlesReference/Examples/ParticleComponents/TOC.yml",
      "/client_particles/",
      "- name: Particle List\n  href: ../ParticleList.md"
    );

    // Commands documentation
    await this.exportCommandMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      "/CommandsReference/Examples/Commands/",
      "/command/cmd_"
    );

    await this.exportCommandListPage(
      formsByPath,
      outputFolder,
      "/CommandsReference/Examples/CommandList.md",
      "/command/cmd_"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.commands,
      "/CommandsReference/Examples/Commands/TOC.yml",
      "/command/cmd_",
      "- name: Command List\n  href: ../CommandList.md"
    );

    // Command Types documentation (argument types for commands)
    await this.exportCommandTypeMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      "/CommandsReference/Examples/CommandTypes/",
      "/command/type_"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.commands,
      "/CommandsReference/Examples/CommandTypeList.md",
      "/command/type_",
      "Command Argument Types",
      "CommandTypes"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.commands,
      "/CommandsReference/Examples/CommandTypes/TOC.yml",
      "/command/type_",
      "- name: Command Type List\n  href: ../CommandTypeList.md"
    );

    // Jigsaw Structures documentation
    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.jigsaw,
      "/JigsawReference/Examples/JigsawComponents/",
      "/jigsaw/",
      "Jigsaw Structures",
      "Jigsaw Component"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.jigsaw,
      "/JigsawReference/Examples/JigsawList.md",
      "/jigsaw/",
      "Jigsaw Structures",
      "JigsawComponents"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.jigsaw,
      "/JigsawReference/Examples/JigsawComponents/TOC.yml",
      "/jigsaw/",
      "- name: Jigsaw List\n  href: ../JigsawList.md"
    );

    // Dimensions documentation
    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.dimensions,
      "/DimensionReference/Examples/DimensionComponents/",
      "/dimension/",
      "Dimensions",
      "Dimension Component"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.dimensions,
      "/DimensionReference/Examples/DimensionList.md",
      "/dimension/",
      "Dimensions",
      "DimensionComponents"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.dimensions,
      "/DimensionReference/Examples/DimensionComponents/TOC.yml",
      "/dimension/",
      "- name: Dimension List\n  href: ../DimensionList.md"
    );

    // Attachables documentation
    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.attachables,
      "/AttachableReference/Examples/AttachableDefinitions/",
      "/attachable/",
      "Attachables",
      "Attachable Definition"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.attachables,
      "/AttachableReference/Examples/AttachableList.md",
      "/attachable/",
      "Attachables",
      "AttachableDefinitions"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.attachables,
      "/AttachableReference/Examples/AttachableDefinitions/TOC.yml",
      "/attachable/",
      "- name: Attachable List\n  href: ../AttachableList.md"
    );

    // JSON UI documentation
    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.jsonUi,
      "/JsonUiReference/Examples/JsonUiComponents/",
      "/ui/ui_",
      "JSON UI",
      "JSON UI Component"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.jsonUi,
      "/JsonUiReference/Examples/JsonUiList.md",
      "/ui/ui_",
      "JSON UI",
      "JsonUiComponents"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.jsonUi,
      "/JsonUiReference/Examples/JsonUiComponents/TOC.yml",
      "/ui/ui_",
      "- name: JSON UI List\n  href: ../JsonUiList.md"
    );

    // Trade Tables documentation
    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.tradeTables,
      "/TradeTableReference/Examples/TradeTableComponents/",
      "/trade/trade",
      "Trade Tables",
      "Trade Table Component"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.tradeTables,
      "/TradeTableReference/Examples/TradeTableList.md",
      "/trade/trade",
      "Trade Tables",
      "TradeTableComponents"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.tradeTables,
      "/TradeTableReference/Examples/TradeTableComponents/TOC.yml",
      "/trade/trade",
      "- name: Trade Table List\n  href: ../TradeTableList.md"
    );

    // Feature Rules documentation
    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.featureRules,
      "/FeatureRulesReference/Examples/FeatureRulesComponents/",
      "/feature_rules/",
      "Feature Rules",
      "Feature Rule Component"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.featureRules,
      "/FeatureRulesReference/Examples/FeatureRulesList.md",
      "/feature_rules/",
      "Feature Rules",
      "FeatureRulesComponents"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.featureRules,
      "/FeatureRulesReference/Examples/FeatureRulesComponents/TOC.yml",
      "/feature_rules/",
      "- name: Feature Rules List\n  href: ../FeatureRulesList.md"
    );

    // Voxel Shapes documentation
    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.voxelShapes,
      "/VoxelShapesReference/Examples/VoxelShapesComponents/",
      "/voxel_shapes/",
      "Voxel Shapes",
      "Voxel Shape Component"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.voxelShapes,
      "/VoxelShapesReference/Examples/VoxelShapesList.md",
      "/voxel_shapes/",
      "Voxel Shapes",
      "VoxelShapesComponents"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.voxelShapes,
      "/VoxelShapesReference/Examples/VoxelShapesComponents/TOC.yml",
      "/voxel_shapes/",
      "- name: Voxel Shapes List\n  href: ../VoxelShapesList.md"
    );

    // Log skipped files summary
    if (this._skippedFiles.length > 0) {
      Log.debug(
        `[FormMarkdownDocGen] Skipped ${this._skippedFiles.length} files that already exist in reference folder:`
      );
      for (const skipped of this._skippedFiles) {
        Log.verbose(`[FormMarkdownDocGen]   - ${skipped}`);
      }
    }
  }

  /**
   * Check if a file exists in the reference folder (existing docs).
   * Also checks for common naming variations (e.g., minecraft_ prefix).
   */
  private async existsInReferenceFolder(relativePath: string): Promise<boolean> {
    if (!this._referenceFolder) {
      return false;
    }

    // Normalize path separators
    const normalizedPath = relativePath.replace(/\\/g, "/");

    // Check exact path
    const exactFile = await this._referenceFolder.getFileFromRelativePath(normalizedPath);
    if (exactFile && (await exactFile.exists())) {
      return true;
    }

    // Check with minecraft prefix variations
    const pathParts = normalizedPath.split("/");
    const fileName = pathParts.pop() || "";
    const dirPath = pathParts.join("/");

    // Extract base name without extension for variations
    const baseName = fileName.replace(/\.md$/i, "");

    // Helper to capitalize first letter after underscore or prefix
    const toTitleCase = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

    // Try minecraftX_ prefix variations (common in existing docs)
    // e.g., recipe_shaped.md -> minecraftRecipe_Shaped.md
    const prefixVariations: string[] = [];

    // For recipe_X -> minecraftRecipe_X (capitalized)
    if (baseName.startsWith("recipe_")) {
      const suffix = baseName.substring(7); // remove "recipe_"
      prefixVariations.push("minecraftRecipe_" + toTitleCase(suffix) + ".md");
    }

    // For emitter_X -> minecraftEmitter_X (capitalized)
    if (baseName.startsWith("emitter_")) {
      const suffix = baseName.substring(8); // remove "emitter_"
      prefixVariations.push("minecraftEmitter_" + suffix + ".md");
    }

    // For particle_X -> minecraftParticle_X
    if (baseName.startsWith("particle_")) {
      const suffix = baseName.substring(9); // remove "particle_"
      prefixVariations.push("minecraftParticle_" + suffix + ".md");
    }

    // For loot_X -> various loot table file patterns
    if (baseName.startsWith("loot_")) {
      // Existing loot docs use different structure (enchantingtables.md, etc.)
      // Skip individual loot component files if any loot doc exists
      prefixVariations.push("enchantingtables.md");
      prefixVariations.push("itemmodtables.md");
      prefixVariations.push("miscellaneoustables.md");
    }

    // Generic minecraft prefix (minecraft + capitalized first letter)
    prefixVariations.push("minecraft" + toTitleCase(baseName) + ".md");

    for (const variation of prefixVariations) {
      const variantPath = dirPath ? `${dirPath}/${variation}` : variation;
      const variantFile = await this._referenceFolder.getFileFromRelativePath(variantPath);
      if (variantFile && (await variantFile.exists())) {
        return true;
      }
    }

    return false;
  }

  private getFileNameFromBaseName(baseName: string, exportMode: ExportMode) {
    let fileName = baseName;

    if (exportMode === ExportMode.triggers && fileName.startsWith("minecraft_on_")) {
      fileName = "minecraftTrigger_" + baseName.substring(10);
    } else if (exportMode === ExportMode.triggers && fileName.startsWith("minecraft_on_")) {
      fileName = "minecraftTrigger_" + baseName.substring(10);
    } else if (exportMode === ExportMode.AIGoals && fileName.startsWith("minecraft_behavior")) {
      fileName = "minecraftB" + baseName.substring(11);
    } else if (exportMode === ExportMode.entityComponents && fileName.startsWith("minecraft_")) {
      fileName = "minecraftComponent_" + baseName.substring(10);
    } else if (exportMode === ExportMode.blockComponents && fileName.startsWith("minecraft_")) {
      fileName = "minecraftBlock_" + baseName.substring(10);
    } else if (exportMode === ExportMode.itemComponents && fileName.startsWith("minecraft_")) {
      fileName = "minecraft_" + baseName.substring(10);
    } else if (exportMode === ExportMode.clientBiomes && fileName.startsWith("minecraft_")) {
      fileName = "minecraftClientBiomes_" + baseName.substring(10);
    } else if (exportMode === ExportMode.biomes && fileName.startsWith("minecraft_")) {
      fileName = "minecraftBiomes_" + baseName.substring(10);
    } else if (exportMode === ExportMode.commands && fileName.startsWith("cmd_")) {
      fileName = baseName.substring(4);
    }

    fileName = fileName.replace("_horse_", "_horse.");
    fileName = fileName.replace("_jump_", "_jump.");

    if (fileName.indexOf("movement_tracking") < 0) {
      fileName = fileName.replace("_movement_", "_movement.");
    }
    fileName = fileName.replace("_navigation_", "_navigation.");
    fileName = fileName.replace("_player_", "_player.");

    return fileName;
  }

  public async exportMarkdownAggregatedPage(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    exportMode: ExportMode,
    filePath: string,
    formsPath: string,
    category: string,
    categoryExtended: string,
    exclusionList?: string[]
  ) {
    const targetFolder = await outputFolder.ensureFolderFromRelativePath(filePath);

    if (!targetFolder) {
      return;
    }

    let hasEnsuredFolder = false;

    formsByPath = this.getFormsFromFilter(formsByPath, formsPath, exportMode, exclusionList);

    for (const formPath in formsByPath) {
      const formO = formsByPath[formPath];

      if (formO) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        let fileName = this.getFileNameFromBaseName(baseName, exportMode);
        const relativeFilePath = filePath + fileName + ".md";

        // Skip if file exists in reference folder
        if (await this.existsInReferenceFolder(relativeFilePath)) {
          this._skippedFiles.push(relativeFilePath);
          continue;
        }

        if (!hasEnsuredFolder) {
          await targetFolder.ensureExists();
          hasEnsuredFolder = true;
        }

        const markdownFile = targetFolder.ensureFile(fileName + ".md");

        await this.saveMarkdownDocFromForm(markdownFile, formO, baseName, exportMode, category, categoryExtended);
      }
    }
  }

  public async exportValidatorMarkdownCatalogDocs(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    exportMode: ExportMode,
    subFolderPath: string,
    formsPath: string,
    categoryPlural: string,
    categorySingular: string,
    exclusionList?: string[]
  ) {
    const targetFolder = await outputFolder.ensureFolderFromRelativePath(subFolderPath);

    if (!targetFolder) {
      return;
    }

    let hasEnsuredFolder = false;

    formsByPath = this.getFormsFromFilter(formsByPath, formsPath, exportMode, exclusionList);

    for (const formPath in formsByPath) {
      const formO = formsByPath[formPath];

      if (formO) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        let fileName = this.getFileNameFromBaseName(baseName, exportMode);
        const relativeFilePath = subFolderPath + fileName + ".md";

        // Skip if file exists in reference folder
        if (await this.existsInReferenceFolder(relativeFilePath)) {
          this._skippedFiles.push(relativeFilePath);
          continue;
        }

        if (!hasEnsuredFolder) {
          await targetFolder.ensureExists();
          hasEnsuredFolder = true;
        }

        const markdownFile = targetFolder.ensureFile(fileName + ".md");

        await this.saveValidatorMarkdownDocFromForm(
          markdownFile,
          formO,
          baseName,
          exportMode,
          categoryPlural,
          categorySingular
        );
      }
    }
  }

  public async exportMarkdownCatalogDocs(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    exportMode: ExportMode,
    subFolderPath: string,
    formsPath: string,
    categoryPlural: string,
    categorySingular: string,
    exclusionList?: string[]
  ) {
    const targetFolder = await outputFolder.ensureFolderFromRelativePath(subFolderPath);

    if (!targetFolder) {
      return;
    }

    let hasEnsuredFolder = false;

    formsByPath = this.getFormsFromFilter(formsByPath, formsPath, exportMode, exclusionList);

    for (const formPath in formsByPath) {
      const formO = formsByPath[formPath];

      if (formO) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        let fileName = this.getFileNameFromBaseName(baseName, exportMode);
        const relativeFilePath = subFolderPath + fileName + ".md";

        // Skip if file exists in reference folder
        if (await this.existsInReferenceFolder(relativeFilePath)) {
          this._skippedFiles.push(relativeFilePath);
          continue;
        }

        if (!hasEnsuredFolder) {
          await targetFolder.ensureExists();
          hasEnsuredFolder = true;
        }

        const markdownFile = targetFolder.ensureFile(fileName + ".md");

        await this.saveMarkdownDocFromForm(markdownFile, formO, baseName, exportMode, categoryPlural, categorySingular);
      }
    }
  }

  public async exportMarkdownDocListPage(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    exportMode: ExportMode,
    subFolderPath: string,
    formsPath: string,
    category: string,
    subFolderName: string,
    exclusionList?: string[]
  ) {
    // Skip if list page exists in reference folder
    if (await this.existsInReferenceFolder(subFolderPath)) {
      this._skippedFiles.push(subFolderPath);
      return;
    }

    const targetFile = await outputFolder.ensureFileFromRelativePath(subFolderPath);

    if (!targetFile) {
      return;
    }

    formsByPath = this.getFormsFromFilter(formsByPath, formsPath, exportMode, exclusionList);

    const content: string[] = [];
    content.push(
      Utilities.stringFormat(
        MarkdownTop,
        category + " Documentation - " + category,
        "A reference document describing all current " + category
      )
    );

    let internalDepCount = 0;

    content.push("# " + category + " Documentation\n");
    content.push("| " + category + " | Description |");
    content.push("|:-----|:----------|");

    for (const formPath in formsByPath) {
      const formO = formsByPath[formPath];

      if (formO && !formO.isDeprecated && !formO.isInternal) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        let canonName = EntityTypeDefinition.getComponentFromBaseFileName(baseName);

        if (exportMode === ExportMode.commands && formO.title) {
          // For commands, prefer the friendly title (e.g., "camera") over the id (e.g., "cmd_camera")
          canonName = formO.title;
        } else if (formO.id) {
          canonName = formO.id;
        } else if (formO.title) {
          canonName = formO.title;
        }

        canonName = canonName?.replace(/\`/gi, "");

        content.push(
          "| [" +
            canonName +
            "](" +
            subFolderName +
            "/" +
            this.getFileNameFromBaseName(baseName, exportMode) +
            ".md)| " +
            (formO.description ? this.sanitizeForTable(this.getFirstSentence(formO.description)) : "") +
            " |"
        );
      } else if (formO) {
        internalDepCount++;
      }
    }

    if (internalDepCount > 0) {
      content.push("");
      content.push("## Internal/Deprecated Components");
      content.push("These components are either deprecated or internal to Minecraft and not usable in custom content.");
      content.push("");

      content.push("| " + category + " | Description |");
      content.push("|:-----|:----------|");

      for (const formPath in formsByPath) {
        const formO = formsByPath[formPath];

        if (formO && (formO.isDeprecated || formO.isInternal)) {
          let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

          if (baseName.endsWith(".form")) {
            baseName = baseName.substring(0, baseName.length - 5);
          }

          let canonName = EntityTypeDefinition.getComponentFromBaseFileName(baseName);

          content.push(
            "| [" +
              canonName +
              "](" +
              subFolderName +
              "/" +
              this.getFileNameFromBaseName(baseName, exportMode) +
              ".md)| " +
              (formO.description ? this.sanitizeForTable(this.getFirstSentence(formO.description)) : "") +
              " |"
          );
        }
      }
    }

    targetFile.setContent(content.join("\n"));

    await targetFile.saveContent();
  }

  public async exportListYml(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    exportMode: ExportMode,
    subFolderPath: string,
    formsPath: string,
    header?: string,
    prefix?: string,
    exclusionList?: string[]
  ) {
    // Skip if TOC.yml exists in reference folder
    if (await this.existsInReferenceFolder(subFolderPath)) {
      this._skippedFiles.push(subFolderPath);
      return;
    }

    const targetFile = await outputFolder.ensureFileFromRelativePath(subFolderPath);

    if (!targetFile) {
      return;
    }
    const content: string[] = [];

    if (header) {
      content.push(header);
    }

    formsByPath = this.getFormsFromFilter(formsByPath, formsPath, exportMode, exclusionList);

    for (const formPath in formsByPath) {
      const formO = formsByPath[formPath];

      if (formO && !formO.isDeprecated && !formO.isInternal) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        if (prefix && baseName.startsWith("minecraftComponent_")) {
          baseName = prefix + baseName.substring(19);
        } else if (prefix && baseName.startsWith("minecraft_")) {
          baseName = prefix + baseName.substring(10);
        } else if (prefix) {
          baseName = prefix + baseName;
        }

        let name: string | undefined;

        if (exportMode === ExportMode.commands && formO.title) {
          // For commands, prefer the friendly title over the id
          name = formO.title;
        } else {
          name = formO.id ? formO.id : formO.title;
        }

        name = name?.replace(/\`/gi, "");

        content.push("- name: " + name);
        content.push("  href: " + this.getFileNameFromBaseName(baseName, exportMode) + ".md");
      }
    }

    targetFile.setContent(content.join("\n"));

    await targetFile.saveContent();
  }

  private getFirstSentence(description: string) {
    let endOfSentence = description.indexOf(". ");

    if (endOfSentence >= 0) {
      description = description.substring(0, endOfSentence + 1);
    }

    return description;
  }

  public async saveMarkdownDocFromForm(
    markdownFile: IFile,
    form: IFormDefinition,
    baseName: string,
    exportMode: ExportMode,
    category: string,
    categoryExtended: string
  ) {
    const content: string[] = [];

    let canonName = "minecraft:" + EntityTypeDefinition.getComponentFromBaseFileName(baseName);

    if (exportMode === ExportMode.websockets && form.id) {
      canonName = form.id;
    }

    content.push(
      Utilities.stringFormat(
        MarkdownTop,
        category + " Documentation - " + canonName,
        "Describes the " + canonName + " " + categoryExtended.toLowerCase()
      )
    );

    content.push("# " + category + " Documentation - " + canonName + "\n");

    if (form.isDeprecated) {
      content.push("> [!IMPORTANT]");
      content.push("> This type is now deprecated, and no longer in use in the latest versions of Minecraft.");
      content.push("");
    }

    if (form.isInternal) {
      content.push("> [!IMPORTANT]");
      content.push(
        "> This type is internal to vanilla Minecraft usage, and is not functional or supported within custom Minecraft content."
      );
      content.push("");
    }

    // Render the form body first, then extract headings for a TOC.
    // This guarantees TOC bookmarks match the actual rendered headings exactly.
    const bodyContent: string[] = [];
    await this.appendForm(form, bodyContent, 0);

    // Extract top-level sub-section headings (### level) from rendered body for the TOC
    const tocEntries: { text: string; bookmark: string }[] = [];
    for (const line of bodyContent) {
      // Match ### headings (depth-1 sub-sections). Lines may start with \n.
      const match = line.match(/^\n?### (.+)$/);
      if (match) {
        const headingText = match[1].trim();
        // Skip "Properties" headings and "choices" tables — they're sub-headings, not TOC-worthy
        if (!headingText.endsWith("Properties") && !headingText.endsWith("choices")) {
          const bookmark = this.getMarkdownBookmark(headingText);
          if (!tocEntries.some((e) => e.bookmark === bookmark)) {
            tocEntries.push({ text: headingText, bookmark });
          }
        }
      }
    }

    if (tocEntries.length > 4) {
      content.push("## Contents\n");
      for (const entry of tocEntries) {
        content.push("- [" + entry.text + "](#" + entry.bookmark + ")");
      }
      content.push("");
    }

    content.push(...bodyContent);

    if (form.samples) {
      content.push("\n## Samples\n");
      let samplesAdded = 0;
      const linesAdded: string[] = [];

      for (const samplePath in form.samples) {
        let sampleArr = form.samples[samplePath];
        let addedHeader = false;

        if (sampleArr && samplesAdded < 12) {
          const sampBaseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(samplePath));

          let targetPath = samplePath;

          if (!Array.isArray(sampleArr)) {
            Log.debug("Malformed sample node at `" + samplePath + "` for file at `" + markdownFile.fullPath + "`");
          } else {
            for (const sample of sampleArr) {
              let line = "\n```json\n";

              if (
                baseName.startsWith("minecraft_") &&
                (typeof sample.content !== "string" || !sample.content.startsWith("minecraft:"))
              ) {
                line += '"' + canonName + '": ';
              }

              if (typeof sample.content === "object" || Array.isArray(sample.content)) {
                line += JSON.stringify(sample.content, undefined, 2) + "\n```\n";
              } else {
                if (typeof sample.content === "string") {
                  let cont = sample.content.trim();

                  if (cont.startsWith("{") && cont.endsWith("}")) {
                    line += cont + "\n```\n";
                  } else {
                    line += '"' + cont + '"\n```\n';
                  }
                } else {
                  line += sample.content + "\n```\n";
                }
              }

              if (!linesAdded.includes(line)) {
                if (!addedHeader) {
                  addedHeader = true;

                  if (targetPath !== "samples" && targetPath !== "sample") {
                    if (targetPath.startsWith("/vanilla")) {
                      targetPath = "https://github.com/Mojang/bedrock-samples/tree/preview" + targetPath.substring(8);
                    } else if (targetPath.startsWith("/samples")) {
                      targetPath = "https://github.com/microsoft/minecraft-samples/tree/main" + targetPath.substring(8);
                    }

                    const humanName = Utilities.humanifyMinecraftName(
                      sampBaseName.substring(0, 1).toUpperCase() + sampBaseName.substring(1)
                    );

                    // Only render as a link if the path was converted to a full URL
                    if (targetPath.startsWith("http")) {
                      content.push("#### [" + humanName + "](" + targetPath + ")\n");
                    } else {
                      content.push("#### " + humanName + "\n");
                    }
                  }
                }

                if (sampleArr.length > 1) {
                  content.push("At " + sample.path + ": ");
                }

                linesAdded.push(line);
                content.push(line);
                samplesAdded++;
              }
            }
          }
        }
      }
    }

    markdownFile.setContent(content.join("\n"));

    await markdownFile.saveContent();
  }

  public async saveValidatorMarkdownDocFromForm(
    markdownFile: IFile,
    form: IFormDefinition,
    baseName: string,
    exportMode: ExportMode,
    category: string,
    categoryExtended: string
  ) {
    const content: string[] = [];

    let canonName = "minecraft:" + EntityTypeDefinition.getComponentFromBaseFileName(baseName);

    if (exportMode === ExportMode.websockets && form.id) {
      canonName = form.id;
    }

    content.push(
      Utilities.stringFormat(
        MarkdownTop,
        category + " Documentation - " + canonName,
        "Describes the " + canonName + " " + categoryExtended.toLowerCase()
      )
    );

    content.push("# " + category + " Documentation - " + canonName + "\n");

    if (form.isDeprecated) {
      content.push("> [!IMPORTANT]");
      content.push("> This type is now deprecated, and no longer in use in the latest versions of Minecraft.");
      content.push("");
    }

    await this.appendValidatorForm(form, content, 0, undefined, baseName);

    markdownFile.setContent(content.join("\n"));

    await markdownFile.saveContent();
  }

  public sanitizeDescription(description: string) {
    description = description.trim();

    if (description.length > 10 && !description.endsWith(".") && !description.endsWith(":")) {
      description += ".";
    }

    return description;
  }

  /**
   * Format a long description for rendering outside a table.
   * Detects embedded definition-list patterns (lines like "term: description")
   * and renders them as a bulleted list with bold terms for readability.
   */
  public formatLongDescription(description: string): string {
    const lines = description
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 3) {
      return this.sanitizeDescription(description);
    }

    // Detect if this description contains a definition-list pattern:
    // Lines matching "term: explanation" where term has no spaces or only underscores/colons
    const defPattern = /^([a-zA-Z_][a-zA-Z0-9_.:]*): (.+)$/;
    let defLineCount = 0;
    let introLines: string[] = [];
    let defStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (defPattern.test(lines[i])) {
        defLineCount++;
        if (defStartIndex < 0) {
          defStartIndex = i;
        }
      } else if (defStartIndex < 0) {
        introLines.push(lines[i]);
      }
    }

    // If at least 3 lines match the definition pattern, format as a list
    if (defLineCount >= 3 && defStartIndex >= 0) {
      const result: string[] = [];

      // Render intro text as a paragraph
      if (introLines.length > 0) {
        result.push(this.sanitizeDescription(introLines.join(" ")) + "\n");
      }

      // Render definitions as a bulleted list with bold terms
      for (let i = defStartIndex; i < lines.length; i++) {
        const match = lines[i].match(defPattern);
        if (match) {
          result.push("- **" + match[1] + "**: " + match[2]);
        } else {
          // Non-matching lines after definitions start get appended as plain text
          result.push(lines[i]);
        }
      }

      return result.join("\n");
    }

    // No definition-list pattern; just join lines as a paragraph
    return this.sanitizeDescription(lines.join(" "));
  }

  public getFileNameFromJsonKey(key: string) {
    key = key.toLowerCase();

    key = key.replace(/ /gi, "_");
    key = key.replace(/::/gi, "_");
    key = key.replace(/:/gi, "_");

    return key;
  }

  /**
   * Compute a structural fingerprint for a sub-form based on its field IDs and types.
   * Used to detect structurally identical sub-forms and deduplicate them in the output.
   */
  private getSubFormFingerprint(form: IFormDefinition): string {
    if (!form.fields || form.fields.length === 0) {
      return "";
    }

    const parts: string[] = [];
    for (const field of form.fields) {
      parts.push(field.id + ":" + field.dataType);
      if (field.alternates) {
        for (const alt of field.alternates) {
          parts.push(alt.id + ":" + alt.dataType + ":alt");
        }
      }
    }

    parts.sort();
    return parts.join("|");
  }

  /**
   * Compute a stable key for a choices array so identical choices tables can be deduplicated.
   */
  private getChoicesFingerprint(
    choices: { id: string | number | boolean; title?: string; description?: string }[]
  ): string {
    const parts = choices.map((c) => String(c.id)).sort();
    return parts.join("|");
  }

  /**
   * Returns the markdown heading prefix for a given nesting depth.
   * depth 0 → "##", depth 1 → "###", depth 2 → "####", capping at "######".
   */
  private getHeadingPrefix(depth: number): string {
    const level = Math.min(depth + 2, 6);
    return "#".repeat(level);
  }

  public async appendForm(
    form: IFormDefinition,
    content: string[],
    depth: number,
    altTitle?: string,
    formStack?: string[],
    formsAppended?: { [name: string]: boolean },
    jsonPath?: string,
    choicesAppended?: { [fingerprint: string]: string }
  ) {
    if (!formStack) {
      formStack = [];
    } else {
      formStack = formStack.slice();
    }

    if (!formsAppended) {
      formsAppended = {};
    }

    if (!choicesAppended) {
      choicesAppended = {};
    }

    const formId = form.id ? form.id : form.title ? form.title : JSON.stringify(form.fields);

    if (formStack.includes(formId)) {
      Log.message("Dependency loop in the stack with " + formId + " in " + formStack.join(" -> ") + " detected.");
      return;
    }

    formStack.push(formId);

    if (form.description) {
      content.push(this.sanitizeDescription(form.description) + "\n");
    }

    if (form.technicalDescription) {
      content.push(this.sanitizeDescription(form.technicalDescription) + "\n");
    }

    if (form.note) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note) + "\n");
    }

    if (form.note2) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note2) + "\n");
    }

    if (form.note3) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note3) + "\n");
    }

    if (form.versionIntroduced || form.versionDeprecated) {
      content.push("> [!Note]");

      if (form.versionDeprecated) {
        content.push("> This item no longer works after format versions of at least " + form.versionDeprecated + ".\n");
      }

      if (form.versionIntroduced) {
        content.push("> This item requires a format version of at least " + form.versionIntroduced + ".\n");
      }
    }

    if (form.requires) {
      let descStr = "";
      const entityComponents = [];

      if (!Array.isArray(form.requires)) {
        Log.debug("Malformed requires node at `" + JSON.stringify(form.requires) + "`");
      } else {
        for (const dep of form.requires) {
          if (dep.type === "tame_owner") {
            content.push("> [!Note]");
            content.push(
              "> Requires a player to be set as the tame owner via taming (or the `tame` command, or the tame API on EntityTameableComponent) in order to work properly."
            );
          } else if (dep.type === "targeting_entity_component") {
            content.push("> [!Note]");
            content.push(
              "> Requires a target in order to work properly. Entities can generate targets via one of the following behaviors:"
            );
            content.push("> ");
            content.push(
              "> * [minecraft:behavior.nearest_attackable_target](../EntityGoals/minecraftBehavior_nearest_attackable_target.md)"
            );
            content.push("> * [minecraft:behavior.hurt_by_target](../EntityGoals/minecraftBehavior_hurt_by_target.md)");
          } else if (
            dep.type === "entity_component" ||
            dep.type === "item_component" ||
            dep.type === "block_component"
          ) {
            if (dep.description) {
              if (descStr.length > 0) {
                descStr += " ";
              }
              descStr += dep.description;
            }
            entityComponents.push(dep.id);
          }
        }
      }

      if (entityComponents.length > 0) {
        content.push("> [!Note]");
        if (entityComponents.length === 1) {
          content.push("> Requires the following component in order to work properly:");
        } else {
          content.push("> Requires the following components in order to work properly:");
        }
        content.push("> ");
        for (const entityComponent of entityComponents) {
          content.push(
            "> * [" +
              Utilities.humanifyMinecraftName(entityComponent) +
              " (" +
              entityComponent +
              ")](../EntityComponents/minecraftComponent_" +
              this.getFileNameFromJsonKey(entityComponent.substring(10)) +
              ".md)"
          );
        }

        if (descStr.length >= 0) {
          content.push("> " + descStr);
        }
      }
    }

    if (form.restrictions) {
      const entityTypes = [];
      let descStr = "";

      for (const restriction of form.restrictions) {
        if (restriction.type === "entity_type") {
          entityTypes.push(restriction.id);

          if (restriction.description) {
            if (descStr.length > 0) {
              descStr += " ";
            }
            descStr += restriction.description;
          }
        }
      }

      if (entityTypes.length > 0) {
        content.push("> [!Note]");
        if (entityTypes.length === 1) {
          content.push("> Can only be used on the following type of entity:");
        } else {
          content.push("> Can only be used on the following types of entity:");
        }
        content.push("> ");

        for (const entityType of entityTypes) {
          content.push("> * " + Utilities.humanifyMinecraftName(entityType) + " (" + entityType + ")");
        }

        if (descStr.length >= 0) {
          content.push("> " + descStr);
        }
      }
    }

    const scalarField = DataFormUtilities.getScalarField(form);

    if (scalarField) {
      content.push("## Alternate Simple Representations\n");

      for (const scalarFieldInst of DataFormUtilities.getFieldAndAlternates(scalarField)) {
        content.push(
          "This item can also be represented as a `" +
            DataFormUtilities.getFieldTypeDescription(scalarFieldInst.dataType) +
            "`."
        );
      }

      content.push("");
    }

    let title = undefined;

    if (form.title) {
      if (form.title === form.id) {
        title = Utilities.humanifyMinecraftName(form.id, true);
      } else {
        title = form.title;
      }
    } else if (form.id) {
      title = Utilities.humanifyMinecraftName(form.id, true);
    } else if (altTitle) {
      title = altTitle;
    } else {
      title = "Item";
    }

    if (form.fields && form.fields.length > 0) {
      const subContent: string[] = [];
      const longDescriptions: { fieldId: string; description: string }[] = [];
      // For nested sub-forms (depth > 0), the Properties heading should be one level
      // below the sub-form title heading (which was rendered at `depth` by the parent).
      const propsHeadingDepth = depth > 0 ? depth + 1 : depth;
      const heading = this.getHeadingPrefix(propsHeadingDepth);

      content.push("\n" + heading + " " + title + " Properties\n");

      if (jsonPath && depth > 0) {
        content.push("**JSON path:** `" + jsonPath + "`\n");
      }

      // Pre-scan fields to check if any have sample values
      const hasSamples = form.fields.some((f) => {
        if (f.samples && Object.keys(f.samples).length > 0) return true;
        if (f.alternates) {
          return f.alternates.some((alt) => alt.samples && Object.keys(alt.samples).length > 0);
        }
        return false;
      });

      if (hasSamples) {
        content.push("|Name       |Default Value |Type |Description |Example Values |");
        content.push("|:----------|:-------------|:----|:-----------|:------------- |");
      } else {
        content.push("|Name       |Default Value |Type |Description |");
        content.push("|:----------|:-------------|:----|:-----------|");
      }

      form.fields.sort((a: IField, b: IField) => {
        if (a.isDeprecated && !b.isDeprecated) {
          return 1;
        } else if (!a.isDeprecated && b.isDeprecated) {
          return -1;
        }
        return a.id.localeCompare(b.id);
      });

      let fullFieldList: IField[] = [];

      for (const field of form.fields) {
        fullFieldList.push(field);

        if (field.alternates) {
          let i = 0;
          for (const altField of field.alternates) {
            i++;

            if (!altField.id || altField.id === field.id) {
              // Generate descriptive alternate label instead of generic numbering
              let altLabel: string | undefined;
              const altSubForm = altField.subForm;
              if (altSubForm && altSubForm.title) {
                altLabel = field.id + " (" + altSubForm.title + ")";
              } else if (altField.dataType !== undefined && altField.dataType !== field.dataType) {
                altLabel = field.id + " (as " + DataFormUtilities.getFieldTypeDescription(altField.dataType) + ")";
              } else {
                altLabel = field.id + " (Alternate " + i + ")";
              }
              altField.id = altLabel;
            }

            fullFieldList.push(altField);
          }
        }
      }

      // Track fingerprints for structurally identical sub-forms
      const subFormFingerprintNames: { [fingerprint: string]: string } = {};

      for (const field of fullFieldList) {
        let modifiedSubFieldId = field.id;
        let subFormTitle = undefined;
        let subForm = await FieldUtilities.getSubForm(field);

        if (subForm) {
          subFormTitle = subForm.title
            ? subForm.title
            : subForm.id
              ? Utilities.humanifyMinecraftName(subForm.id)
              : undefined;

          if (subFormTitle) {
            const lastAlt = modifiedSubFieldId.lastIndexOf("(Alternate");

            if (lastAlt >= 0) {
              modifiedSubFieldId = modifiedSubFieldId.substring(0, lastAlt);
              modifiedSubFieldId += "(" + subFormTitle + ")";
            } else {
              modifiedSubFieldId += " (" + subFormTitle + ")";
            }
          } else {
            subFormTitle = "item type";
          }
        }

        if (field.isDeprecated) {
          modifiedSubFieldId = "(deprecated) " + modifiedSubFieldId;
        }

        let fieldRow = "| " + (field.alternates ? modifiedSubFieldId : field.id) + " | ";

        if (field.defaultValue !== undefined) {
          fieldRow += this.getValueAsString(field.defaultValue);
        } else {
          fieldRow += "*not set*";
        }

        let fieldName = Utilities.humanifyMinecraftName(modifiedSubFieldId);
        const subHeading = this.getHeadingPrefix(depth + 1);
        const childFieldJsonPath = jsonPath ? jsonPath + " > " + field.id.split(" (")[0] : field.id.split(" (")[0];

        if (subForm && subForm.fields && subForm.fields.length > 0 && subFormTitle && field.subFormId) {
          const fieldLink = "(#" + this.getMarkdownBookmark(subFormTitle) + ")";

          if (field.dataType === FieldDataType.objectArray) {
            fieldRow += " | Array of [" + fieldName + "]" + fieldLink + " items | ";
          } else if (field.dataType === FieldDataType.keyedObjectCollection) {
            fieldRow += " | Key/item pairs of [" + fieldName + "]" + fieldLink + " items | ";
          } else {
            fieldRow += " | [" + fieldName + "]" + fieldLink + " item | ";
          }

          if (!formsAppended[subFormTitle]) {
            // Check for structurally identical sub-forms
            const fingerprint = this.getSubFormFingerprint(subForm);
            const existingName = fingerprint ? subFormFingerprintNames[fingerprint] : undefined;

            if (existingName && existingName !== subFormTitle) {
              subContent.push("\n" + subHeading + " " + subFormTitle + "\n");
              subContent.push(
                "Same structure as [" + existingName + "](#" + this.getMarkdownBookmark(existingName) + ").\n"
              );
            } else {
              if (fingerprint) {
                subFormFingerprintNames[fingerprint] = subFormTitle;
              }
              subContent.push("\n" + subHeading + " " + subFormTitle);

              await this.appendForm(
                subForm,
                subContent,
                depth + 1,
                subFormTitle,
                formStack,
                formsAppended,
                childFieldJsonPath,
                choicesAppended
              );
            }
            formsAppended[subFormTitle] = true;
          }
        } else if (subForm && subForm.fields && subForm.fields.length > 0 && subFormTitle) {
          const fieldLink = "(#" + this.getMarkdownBookmark(fieldName) + ")";

          if (field.dataType === FieldDataType.objectArray) {
            fieldRow += " | Array of [" + fieldName + "]" + fieldLink + " items | ";
          } else if (field.dataType === FieldDataType.keyedObjectCollection) {
            fieldRow += " | Key/item pairs of [" + fieldName + "]" + fieldLink + " items | ";
          } else {
            fieldRow += " | [" + fieldName + "]" + fieldLink + " item | ";
          }

          if (!formsAppended[fieldName]) {
            // Check for structurally identical sub-forms
            const fingerprint = this.getSubFormFingerprint(subForm);
            const existingName = fingerprint ? subFormFingerprintNames[fingerprint] : undefined;

            if (existingName && existingName !== fieldName) {
              subContent.push("\n" + subHeading + " " + fieldName + "\n");
              subContent.push(
                "Same structure as [" + existingName + "](#" + this.getMarkdownBookmark(existingName) + ").\n"
              );
            } else {
              if (fingerprint) {
                subFormFingerprintNames[fingerprint] = fieldName;
              }
              subContent.push("\n" + subHeading + " " + fieldName);

              await this.appendForm(
                subForm,
                subContent,
                depth + 1,
                fieldName,
                formStack,
                formsAppended,
                childFieldJsonPath,
                choicesAppended
              );
            }
            formsAppended[fieldName] = true;
          }
        } else if (field.choices) {
          // Deduplicate identical choices tables
          const choicesFingerprint = this.getChoicesFingerprint(field.choices);
          const existingChoicesName = choicesAppended[choicesFingerprint];

          if (existingChoicesName) {
            // Reuse the existing choices section's bookmark
            const fieldLink = "(#" + this.getMarkdownBookmark(existingChoicesName) + "-choices)";
            fieldRow += " | [" + fieldName + "]" + fieldLink + " choices | ";
          } else {
            const fieldLink = "(#" + this.getMarkdownBookmark(fieldName) + "-choices)";
            fieldRow += " | [" + fieldName + "]" + fieldLink + " choices | ";

            choicesAppended[choicesFingerprint] = fieldName;

            subContent.push("\n### " + fieldName + " choices\n");

            subContent.push("|Value       |Title |Description |");
            subContent.push("|:-----------|:-----|:-----------|");

            for (const choice of field.choices) {
              let choiceRow = "";

              choiceRow += "| " + choice.id;
              choiceRow +=
                " | " +
                (choice.title ? this.sanitizeForTable(choice.title) : Utilities.humanifyMinecraftName(choice.id));
              choiceRow += " | " + (choice.description ? this.sanitizeForTable(choice.description) : "") + "|";

              subContent.push(choiceRow);
            }
          }
        } else if (field.dataType === FieldDataType.minecraftEventTrigger) {
          fieldRow +=
            " | [" +
            DataFormUtilities.getFieldTypeDescription(field.dataType) +
            "](../Definitions/NestedTables/triggers.md) | ";
        } else {
          let fieldTypes = "";

          fieldTypes = DataFormUtilities.getFieldTypeDescription(field.dataType);

          fieldRow += " | " + fieldTypes + " | ";
        }

        if (field.description) {
          let descrip = field.description;

          descrip += " " + this.addAdditionalNotes(field);

          if (field.technicalDescription) {
            descrip += " " + field.technicalDescription;
          }

          descrip = descrip.trim();

          if (field.isDeprecated) {
            descrip = "Deprecated - no longer in use. " + descrip;
          }

          if (field.versionDeprecated) {
            descrip +=
              " This property no longer works after format versions of at least " + field.versionDeprecated + ".";
          }

          if (field.versionIntroduced) {
            descrip += " This item requires a format version of at least " + field.versionIntroduced + ".";
          }

          if (field.note) {
            descrip += " " + field.note;
          }
          if (field.note2) {
            descrip += " " + field.note2;
          }
          if (field.note3) {
            descrip += " " + field.note3;
          }

          // If the description is very long, extract it below the table instead of inline
          const longDescriptionThreshold = 200;
          if (descrip.length > longDescriptionThreshold) {
            // Put a short summary in the table cell (first sentence or truncated)
            const firstSentenceMatch = descrip.match(/^[^.!?]*[.!?]/);
            const shortDescrip = firstSentenceMatch
              ? firstSentenceMatch[0]
              : descrip.substring(0, longDescriptionThreshold) + "...";

            fieldRow += this.sanitizeForTable(shortDescrip);

            // Queue the full description for rendering below the table
            longDescriptions.push({
              fieldId: field.id,
              description: descrip,
            });
          } else {
            fieldRow += this.sanitizeForTable(descrip);
          }
        }

        fieldRow += " | ";

        if (hasSamples && field.samples) {
          let samplesAdded = 0;
          const samplesUsed: string[] = [];
          let addedKey = false;

          for (const samplePath in field.samples) {
            let sampleArr = field.samples[samplePath];

            if (sampleArr && samplesAdded < 3) {
              const sampleSet: { [id: string]: string } = {};

              for (const sample of sampleArr) {
                const sampleVal = JSON.stringify(sample.content);

                if (!samplesUsed.includes(sampleVal)) {
                  samplesUsed.push(sampleVal);
                  const baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(samplePath));

                  samplesAdded++;

                  const key = baseName.substring(0, 1).toUpperCase() + baseName.substring(1);

                  if (!sampleSet[key]) {
                    sampleSet[key] = "`" + sampleVal + "`";
                  } else {
                    sampleSet[key] = sampleSet[key] + ", `" + sampleVal + "`";
                  }
                }
              }

              for (const key in sampleSet) {
                if (addedKey) {
                  fieldRow += ", ";
                }

                fieldRow += Utilities.humanifyMinecraftName(key) + ": " + this.sanitizeForTable(sampleSet[key]);
                addedKey = true;
              }
            }
          }

          fieldRow += " | ";
        } else if (hasSamples) {
          fieldRow += " | ";
        }

        content.push(fieldRow);
      }

      // Render long descriptions that were extracted from the table
      if (longDescriptions.length > 0) {
        content.push("");
        const detailsHeading = this.getHeadingPrefix(depth + 1);
        for (const ld of longDescriptions) {
          content.push(detailsHeading + " " + ld.fieldId + "\n");
          content.push(this.formatLongDescription(ld.description) + "\n");
        }
      }

      content.push(...subContent);
    }
  }

  public addAdditionalNotes(field: IField) {
    let descrip = "";

    if (field.minLength) {
      descrip += "Value must have at least " + field.minLength + " items. ";
    }
    if (field.maxLength) {
      descrip += "Value must have at most " + field.maxLength + " items. ";
    }
    if (field.validity) {
      for (const cond of field.validity) {
        if (cond.comparison === ComparisonType.matchesPattern) {
          descrip += 'Value must match a regular expression pattern of "' + cond.value + '". ';
        } else if (cond.comparison) {
          descrip += "Value must be " + cond.comparison + " " + cond.value + ". ";
        }
      }
    }
    return descrip;
  }

  public async appendValidatorForm(
    form: IFormDefinition,
    content: string[],
    depth: number,
    altTitle?: string,
    filePrefix?: string
  ) {
    if (form.description) {
      content.push(this.sanitizeDescription(form.description) + "\n");
    }

    if (form.technicalDescription) {
      content.push(this.sanitizeDescription(form.technicalDescription) + "\n");
    }

    if (form.note) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note) + "\n");
    }

    if (form.note2) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note2) + "\n");
    }

    if (form.note3) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note3) + "\n");
    }

    let title = undefined;

    if (form.title) {
      if (form.title === form.id) {
        title = Utilities.humanifyMinecraftName(form.id);
      } else {
        title = form.title;
      }
    } else if (form.id) {
      title = Utilities.humanifyMinecraftName(form.id);
    } else if (altTitle) {
      title = altTitle;
    } else {
      title = "Item";
    }

    if (form.fields && form.fields.length > 0) {
      const subContent: string[] = [];
      if (depth > 0) {
        content.push("\n#### " + title + " Validation Rules\n");
      } else {
        content.push("\n## " + title + " Validation Rules\n");
      }

      form.fields.sort((a: IField, b: IField) => {
        return a.id.localeCompare(b.id);
      });

      let fullFieldList: IField[] = [];

      for (const field of form.fields) {
        fullFieldList.push(field);

        if (field.alternates) {
          let i = 0;
          for (const altField of field.alternates) {
            i++;

            if (!altField.id || altField.id === field.id) {
              altField.id = field.id + " (Alternate " + i + ")";
            }

            fullFieldList.push(altField);
          }
        }
      }

      // Output each validation rule as a detailed section
      // Build the file prefix for rule IDs (e.g., "CPARTI" from "cparti")
      const rulePrefix = filePrefix ? filePrefix.toUpperCase() : "";

      for (const field of fullFieldList) {
        // Determine severity label (no emojis)
        const messageType = field.messageType || "info";
        let severityLabel = "Info";
        if (messageType === "error") {
          severityLabel = "Error";
        } else if (messageType === "warning") {
          severityLabel = "Warning";
        } else if (messageType === "recommendation") {
          severityLabel = "Recommendation";
        }

        // Rule header with PREFIX+ID format (e.g., "CPARTI101: File Read Error")
        const ruleTitle = field.title || Utilities.humanifyMinecraftName(field.id);
        const ruleHeader = rulePrefix + field.id + ": " + ruleTitle;
        content.push("\n### " + ruleHeader + "\n");

        // Rule ID
        content.push("**Rule ID:** `" + rulePrefix + field.id + "`\n");
        content.push("**Severity:** " + severityLabel + "\n");

        // Description
        if (field.description) {
          content.push("**What it checks:** " + this.sanitizeDescription(field.description) + "\n");
        }

        // How to fix (howToUse field)
        if (field.howToUse) {
          content.push("**How to fix:** " + this.sanitizeDescription(field.howToUse) + "\n");
        }

        // Technical description
        if (field.technicalDescription) {
          content.push("**Technical details:** " + this.sanitizeDescription(field.technicalDescription) + "\n");
        }

        // Notes
        if (field.note) {
          content.push("> [!Note]");
          content.push("> " + this.sanitizeDescription(field.note) + "\n");
        }

        if (field.note2) {
          content.push("> [!Note]");
          content.push("> " + this.sanitizeDescription(field.note2) + "\n");
        }

        if (field.note3) {
          content.push("> [!Note]");
          content.push("> " + this.sanitizeDescription(field.note3) + "\n");
        }

        // Auto-fix availability
        if (field.matchedValues) {
          const hasAutoFix = this.validatorFieldHasAutoFix(field);
          if (hasAutoFix) {
            content.push("**Auto-fix available:** Yes - This issue can be automatically fixed by MCTools.\n");
          }
        }
      }

      content.push(...subContent);
    }
  }

  /**
   * Checks if a validation field has auto-fix actions available.
   */
  private validatorFieldHasAutoFix(field: IField): boolean {
    if (!field.matchedValues) {
      return false;
    }

    // matchedValues can be either an object or an array
    if (Array.isArray(field.matchedValues)) {
      return field.matchedValues.length > 0;
    }

    // Object format
    return Object.keys(field.matchedValues).length > 0;
  }

  public getValueAsString(value: any) {
    if (Array.isArray(value)) {
      let result = "[";

      let index = 0;
      for (const subVal of value) {
        if (index > 0) {
          result += ", ";
        }

        result += subVal.toString();

        index++;
      }
      return result + "]";
    } else if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return value.toString();
  }

  public sanitizeForTable(value: string) {
    value = value.replace(/\\r/gi, " ");
    value = value.replace(/\\t/gi, " ");
    value = value.replace(/\\n/gi, " ");
    value = value.replace(/\\"/gi, '"');
    value = value.replace(/\r/gi, " ");
    value = value.replace(/\n/gi, " ");
    value = value.replace(/  /gi, " ");
    value = value.replace(/  /gi, " ");
    value = value.trim();

    return value;
  }

  public getMarkdownBookmark(id: string) {
    return id.toLowerCase().replace(/ /gi, "-").replace(/\(/gi, "").replace(/\)/gi, "");
  }

  public getFormsFromFilter(
    formsByPath: { [name: string]: IFormDefinition },
    formsPath: string,
    mode: ExportMode,
    exclusionList?: string[]
  ) {
    const filteredList: { [name: string]: IFormDefinition } = {};

    for (const formPath in formsByPath) {
      let includeFile = true;

      if (
        formPath.indexOf("index") >= 0 ||
        formPath.indexOf("overview") >= 0 ||
        formPath.indexOf("describes") >= 0 ||
        formPath.indexOf("versioned") >= 0
      ) {
        includeFile = false;
      }

      if (exclusionList && includeFile) {
        for (const exclude of exclusionList) {
          if (formPath.indexOf(exclude) >= 0) {
            includeFile = false;
            break;
          }
        }
      }

      if (
        includeFile &&
        formPath.toLowerCase().startsWith(formsPath) &&
        formsByPath[formPath] &&
        Utilities.isUsableAsObjectKey(formPath) &&
        (formsPath.indexOf("behavior") >= 0 || formPath.indexOf("behavior") < 0) &&
        (formsPath.indexOf("_on") >= 0 || formPath.indexOf("minecraft_on") < 0)
      ) {
        filteredList[formPath] = formsByPath[formPath];
      }
    }

    return filteredList;
  }

  public async loadFormJsonFromFolder(
    formsByPath: { [name: string]: IFormDefinition },
    inputFolder: IFolder,
    outputFolder: IFolder
  ) {
    if (!inputFolder.isLoaded) {
      await inputFolder.load();
    }

    const fileList: IIndexJson = { files: [], folders: [] };

    for (const folderName in inputFolder.folders) {
      const folder = inputFolder.folders[folderName];

      if (folder) {
        await this.loadFormJsonFromFolder(formsByPath, folder, outputFolder.ensureFolder(folderName));

        fileList.folders.push(folderName);
      }
    }

    for (const fileName in inputFolder.files) {
      const file = inputFolder.files[fileName];

      if (file) {
        if (!file.isContentLoaded) {
          await file.loadContent();
        }

        const jsonO = StorageUtilities.getJsonObject(file);

        if (jsonO) {
          formsByPath[file.storageRelativePath] = jsonO;
        }

        // Unload file content after extracting JSON to save memory during bulk processing
        file.unload();
      }
    }
  }

  // ================================================================================
  // COMMAND DOCUMENTATION GENERATION
  //
  // These methods render command-specific markdown documentation from cmd_*.form.json
  // files. Unlike component docs (which use appendForm for property tables), commands
  // have overloads, syntax lines, permission levels, and per-overload argument tables.
  //
  // Key concepts:
  // - Each cmd form has `overloads[]` with ordered `params[]`
  // - Overloads are grouped by their first distinguishing param (the "verb")
  // - Fields carry `commandType` and `isOptional` as JSON-only properties
  // - Type forms (type_*.form.json) are linked via `subFormId` on fields
  // ================================================================================

  /**
   * Static category map for grouping commands in the TOC.
   * When a command is not listed here it goes into "Other".
   */
  private static readonly COMMAND_CATEGORIES: { [category: string]: string[] } = {
    "World Editing": [
      "clone",
      "fill",
      "setblock",
      "structure",
      "place",
      "spreadplayers",
      "setworldspawn",
      "clearspawnpoint",
      "spawnpoint",
    ],
    "Entity Management": [
      "summon",
      "kill",
      "ride",
      "damage",
      "event",
      "effect",
      "enchant",
      "tag",
      "playanimation",
      "replaceitem",
    ],
    Player: ["give", "clear", "teleport", "gamemode", "xp", "hud", "inputpermission", "aimassist", "controlscheme"],
    Camera: ["camera", "camerashake"],
    "World Settings": [
      "gamerule",
      "difficulty",
      "time",
      "weather",
      "daylock",
      "toggledownfall",
      "mobevent",
      "tickingarea",
      "changesetting",
    ],
    "Chat & Communication": ["say", "tell", "tellraw", "title", "titleraw", "me", "dialogue"],
    "Data & Logic": ["scoreboard", "testfor", "testforblock", "testforblocks", "function", "schedule", "execute"],
    "Server & Admin": [
      "op",
      "deop",
      "kick",
      "allowlist",
      "permission",
      "save",
      "stop",
      "reload",
      "reloadconfig",
      "reloadpacketlimitconfig",
      "transfer",
      "wsserver",
      "setmaxplayers",
      "list",
      "packstack",
      "sendshowstoreoffer",
    ],
    Scripting: ["script", "scriptevent", "gametest"],
    "Sound & Visuals": ["playsound", "stopsound", "music", "fog", "particle"],
    "Loot & Recipes": ["loot", "recipe"],
    Help: ["help"],
  };

  /**
   * Map a numeric permission level to its human-readable label.
   */
  private getPermissionLevelName(level: number | undefined): string {
    switch (level) {
      case 0:
        return "Any";
      case 1:
        return "Game Directors";
      case 2:
        return "Admin";
      case 3:
        return "Host";
      case 4:
        return "Owner";
      default:
        return "Unknown";
    }
  }

  /**
   * Determine whether a command parameter type is a "keyword" (literal token in the syntax)
   * vs. a "value" parameter that accepts user input.
   *
   * Keyword types appear as bare text in the syntax line: `/camera <players> set <preset> ease ...`
   * Value types appear as `<name: type>` or `[name: type]`.
   */
  private isKeywordParamType(commandType: string): boolean {
    if (FormMarkdownDocumentationGenerator.KEYWORD_PARAM_TYPES.has(commandType)) {
      return true;
    }

    // Types containing "ACTION" are subcommand selectors (e.g., CAMERASHAKEACTIONADD → "add")
    if (commandType.indexOf("ACTION") >= 0) {
      return true;
    }

    return false;
  }

  /**
   * Extract a human-readable subcommand name from an ACTION-type commandType.
   * e.g., CAMERASHAKEACTIONADD → "add", MUSICPLAYACTION → "play",
   *        SCOREBOARDADDACTION → "add", DIALOGUEOPENACTION → "open"
   *
   * Uses the command name to strip the known prefix from the type string.
   */
  private getActionKeywordName(commandType: string, commandName?: string): string {
    const typeUpper = commandType.toUpperCase();
    const actionIdx = typeUpper.indexOf("ACTION");

    if (actionIdx >= 0) {
      // Try suffix after ACTION (CAMERASHAKEACTIONADD → ADD)
      const suffix = typeUpper.substring(actionIdx + 6);
      if (suffix.length > 0) {
        return suffix.toLowerCase();
      }

      // Suffix is empty — the subcommand is embedded before ACTION.
      // Strip the command name prefix to isolate the subcommand.
      // e.g., DIALOGUEOPENACTION with commandName="dialogue" → strip DIALOGUE → OPEN
      const prefix = typeUpper.substring(0, actionIdx);

      if (commandName) {
        const cmdUpper = commandName.toUpperCase();
        if (prefix.startsWith(cmdUpper)) {
          const subcommand = prefix.substring(cmdUpper.length);
          if (subcommand.length > 0) {
            return subcommand.toLowerCase();
          }
        }
      }

      // Fallback: return the whole prefix lowercased
      return prefix.toLowerCase();
    }

    return commandType.toLowerCase();
  }

  /**
   * Look up a field definition by its id from the command form's fields array.
   * The fields in command forms carry `commandType`, `isOptional`, `subFormId`, etc.
   * as raw JSON properties (not all are in the IField TypeScript interface).
   */
  private getCommandField(form: IFormDefinition, fieldName: string): IField | undefined {
    if (!form.fields) {
      return undefined;
    }

    for (const field of form.fields) {
      if (field.id === fieldName) {
        return field;
      }
    }

    return undefined;
  }

  /**
   * Get a human-readable type name for a command parameter.
   * Uses the field's subFormId (type form title) if available, otherwise
   * falls back to humanifying the commandType string.
   */
  private getCommandParamTypeName(field: IField | undefined): string {
    if (!field) {
      return "value";
    }

    const commandType = field.commandType;

    if (!commandType) {
      return "value";
    }

    // Map common commandType values to friendlier names
    switch (commandType) {
      case "SELECTION":
        return "target";
      case "POSITION_FLOAT":
        return "x y z";
      case "POSITION":
        return "x y z";
      case "INT":
        return "int";
      case "VAL":
        return "float";
      case "RVAL":
        return "rotation";
      case "BLOCK":
        return "Block";
      case "ITEM":
        return "Item";
      case "STRING":
        return "string";
      case "MESSAGE":
        return "message";
      case "JSON":
        return "json";
      case "JSON_OBJECT":
        return "json";
      case "BOOLEAN":
        return "Boolean";
      case "CAMERAPRESETS":
        return "CameraPresets";
      case "EASING":
        return "Easing";
      default:
        return commandType.toLowerCase();
    }
  }

  /**
   * Build a syntax line string from an overload's params and the form's fields.
   *
   * Example output:
   *   `/camera <players: target> set <preset: CameraPresets> ease <easeTime: float> <easeType: Easing>`
   */
  private buildSyntaxLine(commandName: string, overload: IFormOverload, form: IFormDefinition): string {
    let syntax = "/" + commandName;

    for (const param of overload.params) {
      const field = this.getCommandField(form, param.name);
      // For ACTION types, prefer the param's type from the overload (which varies per-overload)
      // over the field's commandType (which is shared and may only reflect one variant).
      const fieldCommandType = field ? (field.commandType as string) : undefined;
      const commandType = param.type.indexOf("ACTION") >= 0 ? param.type : fieldCommandType || param.type;

      if (this.isKeywordParamType(commandType || param.type)) {
        // Keyword params render as bare text
        if ((commandType || param.type).indexOf("ACTION") >= 0) {
          // ACTION types render as the subcommand name extracted from the type
          syntax += " " + this.getActionKeywordName(commandType || param.type, commandName);
        } else {
          const title = field ? field.title || param.name : param.name;
          syntax += " " + title;
        }
      } else {
        // Value params render as <name: type> or [name: type]
        const title = field ? field.title || param.name : param.name;
        const typeName = this.getCommandParamTypeName(field);

        if (param.isOptional) {
          syntax += " [" + title + ": " + typeName + "]";
        } else {
          syntax += " <" + title + ": " + typeName + ">";
        }
      }
    }

    return syntax;
  }

  /**
   * Group overloads by their first distinguishing parameter (the "verb").
   * For most commands, params[0] is the target selector and params[1] is the verb.
   * For commands with no target selector at start, params[0] is the verb.
   *
   * Returns an ordered array of groups to preserve a natural order.
   */
  private groupOverloadsByVerb(
    overloads: IFormOverload[],
    form: IFormDefinition
  ): { verb: string; verbTitle: string; overloads: IFormOverload[] }[] {
    // First, check if overloads have distinct verbs by examining the first keyword param
    const verbKeys = new Set<string>();

    for (const overload of overloads) {
      for (const param of overload.params) {
        if (param.type !== "SELECTION") {
          verbKeys.add(param.name);
          break;
        }
      }
    }

    // If all overloads share the same verb (or there's only one overload), don't group
    if (verbKeys.size <= 1) {
      return [{ verb: "_all", verbTitle: "", overloads: overloads }];
    }

    const groups: { verb: string; verbTitle: string; overloads: IFormOverload[] }[] = [];
    const groupMap: { [verb: string]: { verb: string; verbTitle: string; overloads: IFormOverload[] } } = {};

    for (const overload of overloads) {
      // Find the first non-SELECTION param as the verb
      let verbParam: IFormOverloadParam | undefined;
      for (const param of overload.params) {
        if (param.type !== "SELECTION") {
          verbParam = param;
          break;
        }
      }

      const verbKey = verbParam ? verbParam.name : "_default";
      const field = verbParam ? this.getCommandField(form, verbParam.name) : undefined;
      const verbTitle = field ? field.title || verbParam?.name || "default" : verbParam?.name || "default";

      if (!groupMap[verbKey]) {
        const group = { verb: verbKey, verbTitle: verbTitle, overloads: [] as IFormOverload[] };
        groupMap[verbKey] = group;
        groups.push(group);
      }

      groupMap[verbKey].overloads.push(overload);
    }

    return groups;
  }

  /**
   * Generate a descriptive title for an overload when the form's title is a placeholder
   * like "Overload 27" or empty.
   *
   * Builds a description from the parameter names that distinguish this overload
   * from others in the same verb group.
   */
  private generateOverloadTitle(overload: IFormOverload, form: IFormDefinition): string {
    if (overload.title && !overload.title.startsWith("Overload ")) {
      return overload.title;
    }

    // Build from param names, skipping the target selector and the verb
    const distinctParams: string[] = [];
    let skippedVerb = false;

    for (const param of overload.params) {
      if (param.type === "SELECTION") {
        continue;
      }

      const field = this.getCommandField(form, param.name);
      const commandType = field ? (field.commandType as string) : param.type;

      if (!skippedVerb && this.isKeywordParamType(commandType)) {
        skippedVerb = true;
        continue;
      }

      const title = field ? field.title || param.name : param.name;

      distinctParams.push(title);
    }

    if (distinctParams.length === 0) {
      return "Basic usage";
    }

    return "With " + distinctParams.join(", ");
  }

  /**
   * Sub-group overloads within a verb group by their second distinguishing keyword.
   *
   * For example, the "set" verb group of the camera command has overloads that use
   * ease, pos, rot, facing, view_offset, entity_offset, etc. This groups them into
   * semantic sub-categories like "With easing", "Position and rotation only", etc.
   */
  private subGroupOverloads(
    overloads: IFormOverload[],
    form: IFormDefinition,
    verbKey: string
  ): { title: string; description?: string; overloads: IFormOverload[] }[] {
    if (overloads.length <= 6) {
      return [{ title: "", overloads: overloads }];
    }

    // Find the common params (shared by all overloads in this verb group)
    const commonParams = new Set<string>();
    if (overloads.length > 0) {
      for (const param of overloads[0].params) {
        commonParams.add(param.name);
      }

      for (let i = 1; i < overloads.length; i++) {
        const paramNames = new Set(overloads[i].params.map((p) => p.name));
        for (const common of commonParams) {
          if (!paramNames.has(common)) {
            commonParams.delete(common);
          }
        }
      }
    }

    // Group by the first keyword param that's NOT in the common set and NOT the verb itself
    const subGroups: { title: string; description?: string; overloads: IFormOverload[] }[] = [];
    const subGroupMap: { [key: string]: { title: string; description?: string; overloads: IFormOverload[] } } = {};

    for (const overload of overloads) {
      let subGroupKey = "_other";
      let subGroupTitle = "Other variants";

      for (const param of overload.params) {
        if (commonParams.has(param.name)) {
          continue;
        }

        const field = this.getCommandField(form, param.name);
        const commandType = field ? (field.commandType as string) : param.type;

        if (this.isKeywordParamType(commandType)) {
          const title = field ? field.title || param.name : param.name;
          subGroupKey = param.name;
          subGroupTitle = "With " + title;

          if (field && field.description) {
            // Use first sentence of the field description as the sub-group description
            const desc = field.description as string;
            const firstSentence = desc.split(/[.!?]/)[0];
            if (firstSentence && firstSentence.trim().length > 0) {
              subGroupTitle = firstSentence.trim();
            }
          }
          break;
        }
      }

      if (!subGroupMap[subGroupKey]) {
        const sg = { title: subGroupTitle, overloads: [] as IFormOverload[] };
        subGroupMap[subGroupKey] = sg;
        subGroups.push(sg);
      }

      subGroupMap[subGroupKey].overloads.push(overload);
    }

    return subGroups;
  }

  /**
   * Save a command documentation markdown file from a cmd_*.form.json definition.
   *
   * Output structure:
   * - YAML frontmatter
   * - # /commandname heading + description
   * - Permission/cheats table
   * - Syntax overview (all overload syntax lines)
   * - Overloads grouped by verb, each with syntax + argument table
   * - Flat arguments reference at the bottom
   */
  public async saveCommandMarkdownDocFromForm(
    markdownFile: IFile,
    form: IFormDefinition,
    baseName: string,
    formsByPath: { [name: string]: IFormDefinition }
  ) {
    const content: string[] = [];
    const commandName = form.title || baseName.replace("cmd_", "");

    // YAML frontmatter
    content.push(
      Utilities.stringFormat(
        MarkdownTop,
        commandName + " Command",
        "Description and usage of the /" + commandName + " command"
      )
    );

    // Page heading
    content.push("# `/" + commandName + "` Command\n");

    if (form.description) {
      content.push(this.sanitizeDescription(form.description) + "\n");
    }

    // Aliases
    if (form.aliases && form.aliases.length > 0) {
      content.push("**Aliases:** " + form.aliases.map((a) => "`/" + a + "`").join(", ") + "\n");
    }

    // Permission level and cheats table
    content.push("| | |");
    content.push("|:---|:---|");
    content.push("| **Permission Level** | " + this.getPermissionLevelName(form.permissionLevel) + " |");
    content.push("| **Requires Cheats** | " + (form.requiresCheats ? "Yes" : "No") + " |");
    content.push("");

    if (!form.overloads || form.overloads.length === 0) {
      // No overloads — fall back to rendering fields as a simple form
      await this.appendForm(form, content, 0);
      markdownFile.setContent(content.join("\n"));
      await markdownFile.saveContent();
      return;
    }

    // Syntax Overview
    // For commands with many overloads, show a grouped summary instead of all syntax lines
    const groups = this.groupOverloadsByVerb(form.overloads, form);

    if (form.overloads.length > 10 && groups.length > 1) {
      // Grouped summary for complex commands with sub-commands
      content.push("## Sub-commands\n");
      for (const group of groups) {
        const verbField = this.getCommandField(form, group.verb);
        const verbDescription =
          verbField && verbField.description ? " — " + this.getFirstSentence(verbField.description) : "";
        const bookmark = this.getMarkdownBookmark(group.verbTitle);
        if (group.overloads.length === 1) {
          content.push("- [**" + group.verbTitle + "**](#" + bookmark + ")" + verbDescription);
          content.push("  `" + this.buildSyntaxLine(commandName, group.overloads[0], form) + "`");
        } else {
          content.push(
            "- [**" +
              group.verbTitle +
              "**](#" +
              bookmark +
              ") (" +
              group.overloads.length +
              " variants)" +
              verbDescription
          );
        }
      }
      content.push("");
    } else if (groups.length > 1) {
      // Sub-commands listing for moderate-complexity commands
      content.push("## Sub-commands\n");
      for (const group of groups) {
        const verbField = this.getCommandField(form, group.verb);
        const verbDescription =
          verbField && verbField.description ? " — " + this.getFirstSentence(verbField.description) : "";
        const bookmark = this.getMarkdownBookmark(group.verbTitle);
        content.push("- [**" + group.verbTitle + "**](#" + bookmark + ")" + verbDescription);
      }
      content.push("");
    } else {
      // Compact listing for simpler commands
      content.push("## Syntax Overview\n");
      for (const overload of form.overloads) {
        content.push("`" + this.buildSyntaxLine(commandName, overload, form) + "`\n");
      }
    }

    for (const group of groups) {
      // Verb group heading (skip for single-group commands)
      if (group.verb !== "_all" && groups.length > 1) {
        content.push("## " + group.verbTitle + "\n");

        // Add verb field description if available
        const verbField = this.getCommandField(form, group.verb);
        if (verbField && verbField.description) {
          content.push(this.sanitizeDescription(verbField.description) + "\n");
        }

        // For large verb groups, show a condensed syntax table before the overloads
        if (group.overloads.length > 6) {
          content.push("**Syntax variants:**\n");
          for (const overload of group.overloads) {
            content.push("`" + this.buildSyntaxLine(commandName, overload, form) + "`\n");
          }
        }
      } else if (group.verb === "_all") {
        content.push("## Usage\n");
      }

      // Sub-group large verb groups by their second distinguishing keyword
      const subGroups = this.subGroupOverloads(group.overloads, form, group.verb);

      for (const subGroup of subGroups) {
        // Sub-group heading for large verb groups
        if (subGroup.title && subGroups.length > 1 && group.overloads.length > 6) {
          content.push("### " + subGroup.title + "\n");
          if (subGroup.description) {
            content.push(subGroup.description + "\n");
          }
        }

        for (const overload of subGroup.overloads) {
          const overloadTitle = this.generateOverloadTitle(overload, form);
          const headingLevel = subGroups.length > 1 && group.overloads.length > 6 ? "####" : "###";

          // Overload sub-heading — skip for single-overload verb groups since
          // the verb heading already describes the usage
          if (group.overloads.length > 1) {
            content.push(headingLevel + " " + overloadTitle + "\n");
          }

          // Syntax line
          content.push("`" + this.buildSyntaxLine(commandName, overload, form) + "`\n");

          // Description
          if (overload.description) {
            content.push(this.sanitizeDescription(overload.description) + "\n");
          }

          // Per-overload argument table
          const valueParams = overload.params.filter((p: IFormOverloadParam) => {
            const field = this.getCommandField(form, p.name);
            const fieldCt = field ? (field.commandType as string) : undefined;
            // For ACTION types, use the param's type (varies per overload) instead of field's type
            const ct = p.type.indexOf("ACTION") >= 0 ? p.type : fieldCt || p.type;
            return !this.isKeywordParamType(ct);
          });

          if (valueParams.length > 0) {
            content.push("| Argument | Type | Required | Description |");
            content.push("|:---------|:-----|:---------|:------------|");

            for (const param of valueParams) {
              const field = this.getCommandField(form, param.name);
              const title = field ? field.title || param.name : param.name;
              const typeName = this.getCommandParamTypeName(field);

              // Optionally link to type doc page if a subFormId exists
              let typeDisplay = typeName;
              if (field && field.subFormId) {
                const typeFormId = field.subFormId as string;
                const typeForm = this.findFormBySubFormId(formsByPath, typeFormId);
                const typeTitle = typeForm ? typeForm.title || typeName : typeName;
                typeDisplay = "[" + typeTitle + "](../CommandTypes/" + typeFormId + ".md)";
              }

              const required = param.isOptional ? "Optional" : "Required";
              const description = field && field.description ? this.sanitizeForTable(field.description) : "";

              content.push("| " + title + " | " + typeDisplay + " | " + required + " | " + description + " |");
            }

            content.push("");
          }

          // Per-overload examples
          if (overload.samples && overload.samples.length > 0) {
            content.push("**Examples:**\n");
            for (const sample of overload.samples) {
              if (sample.description) {
                content.push(sample.description + ":\n");
              }
              content.push("```\n" + sample.command + "\n```\n");
            }
          }
        }
      }
    }

    // Form-level examples section (for general command usage patterns)
    if (form.commandSamples && form.commandSamples.length > 0) {
      content.push("## Examples\n");
      for (const sample of form.commandSamples) {
        if (sample.description) {
          content.push("### " + sample.description + "\n");
        }
        content.push("```\n" + sample.command + "\n```\n");
      }
    }

    // Arguments Reference — flat alphabetical list of all unique value arguments
    const allFields = form.fields || [];
    const valueFields = allFields.filter((f: IField) => {
      const ct = f.commandType;
      if (!ct || this.isKeywordParamType(ct)) {
        return false;
      }

      // Also exclude fields that are only ever used as ACTION-type keywords in overloads
      if (form.overloads) {
        const usedAsAction = form.overloads.every((ol) => {
          const paramForField = ol.params.find((p) => p.name === f.id);
          return (
            !paramForField || paramForField.type.indexOf("ACTION") >= 0 || this.isKeywordParamType(paramForField.type)
          );
        });

        if (usedAsAction) {
          return false;
        }
      }

      return true;
    });

    if (valueFields.length > 0) {
      content.push("## Arguments Reference\n");
      content.push("| Argument | Type | Description |");
      content.push("|:---------|:-----|:------------|");

      const sortedFields = [...valueFields].sort((a: IField, b: IField) => {
        const aTitle = a.title || a.id;
        const bTitle = b.title || b.id;
        return aTitle.localeCompare(bTitle);
      });

      for (const field of sortedFields) {
        const title = field.title || field.id;
        const typeName = this.getCommandParamTypeName(field);

        let typeDisplay = typeName;
        if (field.subFormId) {
          const typeForm = this.findFormBySubFormId(formsByPath, field.subFormId);
          const typeTitle = typeForm ? typeForm.title || typeName : typeName;
          typeDisplay = "[" + typeTitle + "](../CommandTypes/" + field.subFormId + ".md)";
        }

        const description = field.description ? this.sanitizeForTable(field.description) : "";
        content.push("| " + title + " | " + typeDisplay + " | " + description + " |");
      }

      content.push("");
    }

    markdownFile.setContent(content.join("\n"));
    await markdownFile.saveContent();
  }

  /**
   * Find a form definition by its subFormId reference.
   * SubFormIds like "type_selection" map to paths like "/command/type_selection.form.json".
   */
  private findFormBySubFormId(
    formsByPath: { [name: string]: IFormDefinition },
    subFormId: string
  ): IFormDefinition | undefined {
    for (const formPath in formsByPath) {
      // Match exact filename segment (e.g., "type_int" matches "command/type_int" but not "command/type_interact")
      const segments = formPath.split("/");
      const fileName = segments[segments.length - 1];
      if (fileName === subFormId || formPath === subFormId) {
        return formsByPath[formPath];
      }
    }

    return undefined;
  }

  /**
   * Save a command type documentation markdown file from a type_*.form.json definition.
   *
   * These are simpler reference pages for argument types (like "Entity Selector", "Position", etc.).
   */
  public async saveCommandTypeMarkdownDocFromForm(markdownFile: IFile, form: IFormDefinition, baseName: string) {
    const content: string[] = [];
    const typeName = form.title || Utilities.humanifyMinecraftName(baseName.replace("type_", ""));

    // YAML frontmatter
    content.push(
      Utilities.stringFormat(
        MarkdownTop,
        typeName + " - Command Argument Type",
        "Reference for the " + typeName + " command argument type"
      )
    );

    content.push("# " + typeName + "\n");

    if (form.description) {
      content.push(this.sanitizeDescription(form.description) + "\n");
    }

    // Format hint
    if (form.formatHint) {
      content.push("**Format:** `" + form.formatHint + "`\n");
    }

    // Aliases
    if (form.aliasOf && form.aliasOf.length > 0) {
      content.push("**Alias of:** " + form.aliasOf.join(", ") + "\n");
    }

    // Samples
    if (form.samples) {
      content.push("## Examples\n");

      for (const sampleCategory in form.samples) {
        const samples = form.samples[sampleCategory];

        if (Array.isArray(samples) && samples.length > 0) {
          content.push("### " + Utilities.humanifyMinecraftName(sampleCategory, true) + "\n");

          content.push("| Example | Description |");
          content.push("|:--------|:------------|");

          for (const sample of samples) {
            const sampleContent = typeof sample.content === "string" ? sample.content : JSON.stringify(sample.content);
            const path = sample.path || "";
            content.push("| `" + sampleContent + "` | " + path + " |");
          }

          content.push("");
        }
      }
    }

    // Fields (some type forms have sub-fields, e.g. block state specifiers)
    if (form.fields && form.fields.length > 0) {
      await this.appendForm(form, content, 0);
    }

    markdownFile.setContent(content.join("\n"));
    await markdownFile.saveContent();
  }

  /**
   * Export command catalog docs, calling the command-specific renderer
   * instead of the generic component renderer.
   */
  public async exportCommandMarkdownCatalogDocs(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    subFolderPath: string,
    formsPath: string
  ) {
    const targetFolder = await outputFolder.ensureFolderFromRelativePath(subFolderPath);

    if (!targetFolder) {
      return;
    }

    let hasEnsuredFolder = false;

    const filteredForms = this.getFormsFromFilter(formsByPath, formsPath, ExportMode.commands);

    for (const formPath in filteredForms) {
      const formO = filteredForms[formPath];

      if (formO) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        let fileName = this.getFileNameFromBaseName(baseName, ExportMode.commands);
        const relativeFilePath = subFolderPath + fileName + ".md";

        // Skip if file exists in reference folder
        if (await this.existsInReferenceFolder(relativeFilePath)) {
          this._skippedFiles.push(relativeFilePath);
          continue;
        }

        if (!hasEnsuredFolder) {
          await targetFolder.ensureExists();
          hasEnsuredFolder = true;
        }

        const markdownFile = targetFolder.ensureFile(fileName + ".md");

        await this.saveCommandMarkdownDocFromForm(markdownFile, formO, baseName, formsByPath);
      }
    }
  }

  /**
   * Export command type catalog docs using the type-specific renderer.
   */
  public async exportCommandTypeMarkdownCatalogDocs(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    subFolderPath: string,
    formsPath: string
  ) {
    const targetFolder = await outputFolder.ensureFolderFromRelativePath(subFolderPath);

    if (!targetFolder) {
      return;
    }

    let hasEnsuredFolder = false;

    const filteredForms = this.getFormsFromFilter(formsByPath, formsPath, ExportMode.commands);

    for (const formPath in filteredForms) {
      const formO = filteredForms[formPath];

      if (formO) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        const relativeFilePath = subFolderPath + baseName + ".md";

        // Skip if file exists in reference folder
        if (await this.existsInReferenceFolder(relativeFilePath)) {
          this._skippedFiles.push(relativeFilePath);
          continue;
        }

        if (!hasEnsuredFolder) {
          await targetFolder.ensureExists();
          hasEnsuredFolder = true;
        }

        const markdownFile = targetFolder.ensureFile(baseName + ".md");

        await this.saveCommandTypeMarkdownDocFromForm(markdownFile, formO, baseName);
      }
    }
  }

  /**
   * Export a categorized command list page organized by category.
   */
  public async exportCommandListPage(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    subFolderPath: string,
    formsPath: string
  ) {
    // Skip if file exists in reference folder
    if (await this.existsInReferenceFolder(subFolderPath)) {
      this._skippedFiles.push(subFolderPath);
      return;
    }

    const targetFile = await outputFolder.ensureFileFromRelativePath(subFolderPath);

    if (!targetFile) {
      return;
    }

    const filteredForms = this.getFormsFromFilter(formsByPath, formsPath, ExportMode.commands);

    const content: string[] = [];
    content.push(
      Utilities.stringFormat(
        MarkdownTop,
        "Commands Documentation - Commands",
        "A reference document describing all current Commands"
      )
    );

    content.push("# Commands Documentation\n");

    // Collect all command entries
    const commandEntries: { name: string; href: string; description: string }[] = [];

    for (const formPath in filteredForms) {
      const formO = filteredForms[formPath];

      if (formO && !formO.isDeprecated && !formO.isInternal) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        const fileName = this.getFileNameFromBaseName(baseName, ExportMode.commands);
        const cmdName = formO.title || fileName;
        const description = formO.description ? this.sanitizeForTable(this.getFirstSentence(formO.description)) : "";

        commandEntries.push({
          name: cmdName,
          href: "Commands/" + fileName + ".md",
          description: description,
        });
      }
    }

    // Organize into categories
    const categorized: { [category: string]: { name: string; href: string; description: string }[] } = {};
    const uncategorized: { name: string; href: string; description: string }[] = [];

    for (const entry of commandEntries) {
      let found = false;

      for (const category in FormMarkdownDocumentationGenerator.COMMAND_CATEGORIES) {
        const cmds = FormMarkdownDocumentationGenerator.COMMAND_CATEGORIES[category];

        if (cmds.includes(entry.name.toLowerCase())) {
          if (!categorized[category]) {
            categorized[category] = [];
          }

          categorized[category].push(entry);
          found = true;
          break;
        }
      }

      if (!found) {
        uncategorized.push(entry);
      }
    }

    // Render categorized tables
    for (const category in FormMarkdownDocumentationGenerator.COMMAND_CATEGORIES) {
      const entries = categorized[category];

      if (entries && entries.length > 0) {
        entries.sort((a, b) => a.name.localeCompare(b.name));

        content.push("## " + category + "\n");
        content.push("| Command | Description |");
        content.push("|:--------|:------------|");

        for (const entry of entries) {
          content.push("| [" + entry.name + "](" + entry.href + ")| " + entry.description + " |");
        }

        content.push("");
      }
    }

    // Render uncategorized
    if (uncategorized.length > 0) {
      uncategorized.sort((a, b) => a.name.localeCompare(b.name));

      content.push("## Other\n");
      content.push("| Command | Description |");
      content.push("|:--------|:------------|");

      for (const entry of uncategorized) {
        content.push("| [" + entry.name + "](" + entry.href + ")| " + entry.description + " |");
      }

      content.push("");
    }

    targetFile.setContent(content.join("\n"));
    await targetFile.saveContent();
  }

  /**
   * Export a grouped TOC.yml for commands, organized by category.
   */
  public async exportCommandListYml(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    subFolderPath: string,
    formsPath: string
  ) {
    const targetFile = await outputFolder.ensureFileFromRelativePath(subFolderPath);

    if (!targetFile) {
      return;
    }

    const content: string[] = [];

    content.push("- name: Command List");
    content.push("  href: ../CommandList.md");

    const filteredForms = this.getFormsFromFilter(formsByPath, formsPath, ExportMode.commands);

    // Build a map of commandName → { name, href }
    const commandEntries: { name: string; href: string; title: string }[] = [];

    for (const formPath in filteredForms) {
      const formO = filteredForms[formPath];

      if (formO && !formO.isDeprecated && !formO.isInternal) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        const fileName = this.getFileNameFromBaseName(baseName, ExportMode.commands);
        const cmdName = formO.title || fileName;

        commandEntries.push({
          name: cmdName,
          href: fileName + ".md",
          title: cmdName,
        });
      }
    }

    // Organize into categories
    const categorized: { [category: string]: { name: string; href: string }[] } = {};
    const uncategorized: { name: string; href: string }[] = [];

    for (const entry of commandEntries) {
      let found = false;

      for (const category in FormMarkdownDocumentationGenerator.COMMAND_CATEGORIES) {
        const cmds = FormMarkdownDocumentationGenerator.COMMAND_CATEGORIES[category];

        if (cmds.includes(entry.title.toLowerCase())) {
          if (!categorized[category]) {
            categorized[category] = [];
          }

          categorized[category].push(entry);
          found = true;
          break;
        }
      }

      if (!found) {
        uncategorized.push(entry);
      }
    }

    // Output categorized commands
    for (const category in FormMarkdownDocumentationGenerator.COMMAND_CATEGORIES) {
      const entries = categorized[category];

      if (entries && entries.length > 0) {
        entries.sort((a, b) => a.name.localeCompare(b.name));

        content.push("- name: " + category);
        content.push("  items:");

        for (const entry of entries) {
          content.push("  - name: " + entry.name);
          content.push("    href: " + entry.href);
        }
      }
    }

    // Output uncategorized commands under "Other"
    if (uncategorized.length > 0) {
      uncategorized.sort((a, b) => a.name.localeCompare(b.name));

      content.push("- name: Other");
      content.push("  items:");

      for (const entry of uncategorized) {
        content.push("  - name: " + entry.name);
        content.push("    href: " + entry.href);
      }
    }

    targetFile.setContent(content.join("\n"));
    await targetFile.saveContent();
  }
}

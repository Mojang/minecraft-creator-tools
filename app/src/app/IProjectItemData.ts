// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IGitHubInfo from "./IGitHubInfo";
import IProjectItemVariant from "./IProjectItemVariant";

export const MaxItemTypes = 162;

export enum ProjectItemCategory {
  assets,
  logic,
  types,
  build,
  documentation,
  meta,
  package,
  unknown,
  mctools,
}

// these integer numbers are used in the project data file formats, so do not change them. See ProjectItemUtilities/Sort Order for a more logical sort order.
export enum ProjectItemType {
  unknown = 0,
  testJs = 1,
  js = 2,
  catalogIndexJs = 3,
  structure = 4,
  behaviorPackManifestJson = 5,
  unknownJson = 6,
  MCWorld = 7,
  MCTemplate = 8,
  MCFunction = 9,
  entityTypeBehavior = 10,
  entityTypeBaseJs = 11, // <--- not in use, in favor of just general .js + generated
  actionSet = 12,
  ts = 13,
  resourcePackManifestJson = 14,
  worldTest = 15,
  worldFolder = 16,
  behaviorPackListJson = 17,
  resourcePackListJson = 18,
  animationBehaviorJson = 19,
  animationControllerBehaviorJson = 20,
  blockTypeBehavior = 21,
  blockMaterialsBehaviorJson = 22,
  itemTypeBehavior = 23,
  lootTableBehavior = 24,
  biomesClientResource = 25,
  blocksCatalogResourceJson = 26,
  soundCatalog = 27,
  animationResourceJson = 28,
  animationControllerResourceJson = 29,
  entityTypeResource = 30,
  fogResourceJson = 31,
  modelGeometryJson = 32,
  particleJson = 33,
  renderControllerJson = 34,
  ninesliceJson = 35,
  uiJson = 36,
  languagesCatalogResourceJson = 37,
  biomeBehavior = 38,
  dialogueBehaviorJson = 39,
  featureRuleBehavior = 40,
  featureBehavior = 41,
  functionEventJson = 42,
  recipeBehavior = 43,
  spawnRuleBehavior = 44,
  tradingBehaviorJson = 45,
  volumeBehaviorJson = 46,
  attachableResourceJson = 47,
  itemTypeLegacyResource = 48, // note this is the 1.10 definition of item resources, more modern items use attachables?
  materialsResourceJson = 49,
  musicDefinitionJson = 50,
  soundDefinitionCatalog = 51,
  blockTypeResourceJsonDoNotUse = 52, // deprecated - Duplicate of blocksCatalogResourceJson
  MCAddon = 53,
  zip = 54,
  MCPack = 55,
  documentedTypeFolder = 56,
  documentedCommandFolder = 57,
  tsconfigJson = 58,
  packageJson = 59,
  packageLockJson = 60,
  docInfoJson = 61,
  scriptTypesJson = 62,
  commandSetDefinitionJson = 63,
  jsconfigJson = 64,
  docfxJson = 65,
  jsdocJson = 66,
  skinPackManifestJson = 67,
  worldTemplateManifestJson = 68,
  buildProcessedJs = 69,
  entityTypeBaseTs = 70, // <--- not in use, in favor of just general .ts + generated
  blockTypeBaseJs = 71, // <--- not in use, in favor of just general .js + generated
  blockTypeBaseTs = 72, // <--- not in use, in favor of just general .ts + generated
  MCProject = 73,
  image = 74,
  vsCodeLaunchJson = 75,
  vsCodeTasksJson = 76,
  vsCodeSettingsJson = 77,
  vsCodeExtensionsJson = 78,
  lang = 79,
  projectSummaryMetadata = 80,
  tickJson = 81,
  cameraBehaviorJson = 82,
  material = 83,
  materialSetJson = 84,
  materialVertex = 85,
  materialFragment = 86,
  materialGeometry = 87, // NOTE: this is a /materials specific .geometry file, and not a .geo.json type file (which is modelGeometryJson)
  lightingJson = 88,
  textureSetJson = 89,
  flipbookTexturesJson = 91,
  itemTextureJson = 92,
  terrainTextureCatalogResourceJson = 93,
  globalVariablesJson = 94,
  dataForm = 95,
  dimensionJson = 96,
  behaviorPackHistoryListJson = 97,
  resourcePackHistoryListJson = 98,
  texture = 99,
  marketingAssetImage = 100,
  storeAssetImage = 101,
  uiTexture = 102,
  packIconImage = 103,
  textureListJson = 104,
  fileListArrayJson = 105,
  vanillaDataJson = 106,
  engineOrderingJson = 107,
  audio = 108,
  behaviorPackFolder = 109,
  resourcePackFolder = 110,
  skinPackFolder = 111,
  contentIndexJson = 112,
  contentReportJson = 113,
  levelDbLdb = 114,
  levelDbLog = 115,
  levelDbCurrent = 116,
  levelDbManifest = 117,
  levelDat = 118,
  justConfigTs = 119,
  esLintConfigMjs = 120,
  env = 121,
  prettierRcJson = 122,
  skinCatalogJson = 123,
  tagsMetadata = 124,
  personaManifestJson = 125,
  personaPackFolder = 126,
  blockCulling = 127,
  craftingItemCatalog = 128,
  mcToolsProjectPreferences = 129,
  educationJson = 130,
  aimAssistPresetJson = 131,
  colorGradingJson = 132,
  atmosphericsJson = 133,
  pbrJson = 134,
  pointLightsJson = 135,
  waterJson = 136,
  shadowsJson = 137,
  contentsJson = 138,
  jigsawStructureSet = 139,
  jigsawStructure = 140,
  jigsawTemplatePool = 141,
  jigsawProcessorList = 142,
  aimAssistCategoryJson = 143,
  behaviorTreeJson = 144,
  spawnGroupJson = 145,
  designPackManifestJson = 146,
  designPackFolder = 147,
  designTexture = 148,
  personaJson = 149,
  sdlLayout = 150,
  lodJson = 151,
  rendererJson = 152,
  loadingMessagesJson = 153,
  splashesJson = 154,
  cameraResourceJson = 155,
  fontMetadataJson = 156,
  emoticonsJson = 157,
  skinPackGeometryJson = 158,
  skinPackTextureBackCompatJson = 159,
  uniformsJson = 160,
  biomeResource = 161,
}

export enum ProjectItemStorageType {
  singleFile = 0,
  folder = 1,
}

export enum ProjectItemEditPreference {
  projectDefault = 0,
  forceEditor = 1,
  forceRaw = 2,
}

export enum ProjectItemErrorStatus {
  none = 0,
  unprocessable = 1,
}

export enum ProjectItemCreationType {
  normal = 0,
  generated = 1,
  build = 2,
  dist = 3,
}

export default interface IProjectItemData {
  itemType: ProjectItemType;
  projectPath: string | null | undefined;
  storagePath?: string | null | undefined; // legacy name for projectPath, no longer used.
  variants: { [label: string]: IProjectItemVariant };
  tags: string[];
  name: string;
  source?: string;
  isInWorld?: boolean;
  storageType: ProjectItemStorageType | undefined;
  gitHubReference?: IGitHubInfo;
  creationType?: ProjectItemCreationType;
  editPreference?: ProjectItemEditPreference;
  errorMessage?: string;
  errorStatus?: ProjectItemErrorStatus;
  items?: IProjectItemData[];
}

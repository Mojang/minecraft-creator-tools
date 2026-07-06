// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ScriptModuleManager from "../../manager/ScriptModuleManager";
import VsCodeFileManager from "../../manager/VsCodeFileManager";
import MinEngineVersionManager from "../../manager/MinEngineVersionManager";
import BaseGameVersionManager from "../../manager/BaseGameVersionManager";
import PackMetaDataInformationGenerator from "../projectGenerators/packMetaDataInfo/PackMetaDataInfoGenerator";
import CooperativeAddOnRequirementsGenerator from "../projectGenerators/cooperativeAddOnRequirements/CooperativeAddOnRequirementsGenerator";
import StrictPlatformInfoGenerator from "../projectGenerators/strictPlatformInfo/StrictPlatformInfoGenerator";
import CooperativeAddOnItemRequirementsGenerator from "../projectItemGenerators/cooperativeAddOnItemRequirements/CooperativeAddOnItemRequirementsGenerator";
import PathLengthFileGenerator from "../fileGenerators/pathLength/PathLengthFileGenerator";
import ItemCountsInfoGenerator from "../projectGenerators/itemCountsInfo/ItemCountsInfoGenerator";
import PackInfoGenerator from "../projectGenerators/packInfo/PackInfoGenerator";
import LineSizeInfoGenerator from "../projectGenerators/lineSizeInfo/LineSizeInfoGenerator";
import FormSchemaItemInfoGenerator from "../projectItemGenerators/formSchemaItemInfo/FormSchemaItemInfoGenerator";
import UnknownItemGenerator from "../projectItemGenerators/unknownItem/UnknownItemGenerator";
import UnknownFileGenerator from "../fileGenerators/unknownFile/UnknownFileGenerator";
import WorldItemInfoGenerator from "../projectItemGenerators/worldItemInfo/WorldItemInfoGenerator";
import JsonFileTagsInfoGenerator from "../projectGenerators/jsonFileTagsInfo/JsonFileTagsInfoGenerator";
import WorldDataInfoGenerator from "../projectItemGenerators/worldDataInfo/WorldDataInfoGenerator";
import { ProjectInfoSuite } from "../IProjectInfoData";
import IProjectFileInfoGenerator from "../IProjectFileInfoGenerator";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import IProjectItemInfoGenerator from "../IProjectItemInfoGenerator";
import IProjectInfoGeneratorBase from "../IProjectInfoGeneratorBase";
import TextureInfoGenerator from "../projectGenerators/textureInfo/TextureInfoGenerator";
import PackSizeInfoGenerator from "../projectGenerators/packSizeInfo/PackSizeInfoGenerator";
import TextureImageInfoGenerator from "../projectGenerators/textureImageInfo/TextureImageInfoGenerator";
import FormatVersionManager from "../../manager/FormatVersionManager";
import AnimationResourceInfoGenerator from "../projectGenerators/animationResourceInfo/AnimationResourceInfoGenerator";
import UnlinkedItemInfoGenerator from "../projectItemGenerators/unlinkedItemInfo/UnlinkedItemInfoGenerator";
import GeometryInfoGenerator from "../projectGenerators/geometryInfo/GeometryInfoGenerator";
import TextureReferenceInfoGenerator from "../projectGenerators/textureReferenceInfo/TextureReferenceInfoGenerator";
import TypesInfoGenerator from "../projectGenerators/typesInfo/TypesInfoGenerator";
import ValidFileGenerator from "../fileGenerators/validFile/ValidFileGenerator";
import BlocksCatalogManager from "../../manager/BlocksCatalogManager";
import EntityTypeManager from "../../manager/EntityTypeManager";
import ItemTypeManager from "../../manager/ItemTypeManager";
import SharingInfoGenerator from "../projectGenerators/sharingInfo/SharingInfoGenerator";
import CheckVanillaDuplicatesInfoGenerator from "../projectGenerators/checkVanillaDuplicatesInfo/CheckVanillaDuplicatesInfoGenerator";
import CheckNoBOMGenerator from "../fileGenerators/checkNoBOM/CheckNoBOMGenerator";
import MCFunctionInfoGenerator from "../projectGenerators/mcFunctionInfo/MCFunctionInfoGenerator";
import CheckPackIconsGenerator from "../projectGenerators/checkPackIcons/CheckPackIconsGenerator";
import CheckWorldIconsGenerator from "../projectGenerators/CheckWorldIcons/CheckWorldIconsGenerator";
import SoundsDefinitionInfoGenerator from "../projectGenerators/SoundDefinitionsInfo/SoundDefinitionsInfoGenerator";
import SummaryInfoGenerator from "../projectGenerators/summaryInfo/SummaryInfoGenerator";
import ScriptInfoGenerator from "../projectGenerators/scriptInfo/ScriptInfoGenerator";
import CheckParticleIdentifierGenerator from "../projectGenerators/checkParticleIdentifier/CheckParticleIdentifierGenerator";
import CheckSkinPackJsonGenerator from "../projectGenerators/checkSkinPackJson/CheckSkinPackJsonGenerator";
import CommunitySchemaItemInfoGenerator from "../projectItemGenerators/communitySchemaItemInfo/CommunitySchemaItemInfoGenerator";
import JsonSchemaItemInfoGenerator from "../projectItemGenerators/jsonSchemaItemInfo/JsonSchemaItemInfoGenerator";
import CheckForbiddenFilesGenerator from "../projectGenerators/checkForbiddenFiles/CheckForbiddenFiles";
import CheckProjectIntegrityGenerator from "../projectGenerators/checkProjectIntegrity/CheckProjectIntegrityGenerator";
import CheckBetaFeaturesGenerator from "../projectGenerators/checkBetaFeatures/CheckBetaFeaturesGenerator";
import CheckExperimentalFlagInfoGenerator from "../projectGenerators/checkExperimentalFlagInfo/CheckExperimentalFlagInfoGenerator";
import CheckFeatureDeprecationInfoGenerator from "../projectGenerators/checkFeatureDeprecationInfo/CheckFeatureDeprecationInfoGenerator";
import CheckGeometryFormatInfoGenerator from "../projectGenerators/checkGeometryFormatInfo/CheckGeometryFormatInfoGenerator";
import CheckLangFilesGenerator from "../projectGenerators/checkLangFiles/CheckLangFilesGenerator";
import { SuiteConfigs } from "./RegistrationData";
import CheckManifestGenerator from "../projectGenerators/checkManifest/CheckManifestGenerator";
import CheckResourcePackDependenciesGenerator from "../projectGenerators/checkResourcePackDependencies/CheckResourcePackDependenciesGenerator";
import CheckWorldPackReferencesGenerator from "../projectGenerators/CheckWorldPackReferences/CheckWorldPackReferencesGenerator";
import CrossReferenceIndexGenerator from "../projectGenerators/crossReferenceIndex/CrossReferenceIndexGenerator";
import CustomDimensionWorldDataInfoGenerator from "../CustomDimensionWorldDataInfoGenerator";
import CheckTextureListGenerator from "../projectGenerators/checkTextureList/CheckTextureListGenerator";
import VanillaProtectedAssetsInfoGenerator from "../projectGenerators/vanillaProtectedAssetsInfo/VanillaProtectedAssetsInfoGenerator";

export const TestsToExcludeFromDefaultSuite = ["CADDONREQ", "CADDONIREQ", "LANGFILES", "SHARING", "VANDUPES"];

export default class GeneratorRegistrations {
  static managers = [
    new ScriptModuleManager(),
    new VsCodeFileManager(),
    new MinEngineVersionManager(),
    new BaseGameVersionManager(),
    new BlocksCatalogManager(),
    new EntityTypeManager(),
    new ItemTypeManager(),
  ];

  static projectGenerators = [
    new ItemCountsInfoGenerator(),
    new LineSizeInfoGenerator(),
    new PackSizeInfoGenerator(),
    new PackInfoGenerator(),
    new JsonFileTagsInfoGenerator(),
    new FormatVersionManager(),
    new ScriptInfoGenerator(),
    new SharingInfoGenerator(),
    new SummaryInfoGenerator(),
    new CheckVanillaDuplicatesInfoGenerator(),
    new PackMetaDataInformationGenerator(),
    new AnimationResourceInfoGenerator(),
    new CooperativeAddOnRequirementsGenerator(),
    new StrictPlatformInfoGenerator(),
    new TextureInfoGenerator(),
    new TextureReferenceInfoGenerator(),
    new TypesInfoGenerator(),
    new TextureImageInfoGenerator(),
    new GeometryInfoGenerator(),
    new MCFunctionInfoGenerator(),
    new CheckPackIconsGenerator(),
    new CheckWorldIconsGenerator(),
    new SoundsDefinitionInfoGenerator(),
    new CheckParticleIdentifierGenerator(),
    new CheckSkinPackJsonGenerator(),
    new CheckExperimentalFlagInfoGenerator(),
    new CheckFeatureDeprecationInfoGenerator(),
    new CheckForbiddenFilesGenerator(),
    new CheckProjectIntegrityGenerator(),
    new CheckBetaFeaturesGenerator(),
    new CheckManifestGenerator(),
    new CheckGeometryFormatInfoGenerator(),
    new CheckLangFilesGenerator(),
    new CheckResourcePackDependenciesGenerator(),
    new CheckWorldPackReferencesGenerator(),
    new CrossReferenceIndexGenerator(),
    new CheckTextureListGenerator(),
    new VanillaProtectedAssetsInfoGenerator(),
    ...this.managers,
  ];

  static updaters = this.managers;

  static itemGenerators = [
    new UnknownItemGenerator(),
    new FormSchemaItemInfoGenerator(),
    new JsonSchemaItemInfoGenerator(),
    new CommunitySchemaItemInfoGenerator(),
    new WorldItemInfoGenerator(),
    new WorldDataInfoGenerator(),
    new CustomDimensionWorldDataInfoGenerator(),
    new CooperativeAddOnItemRequirementsGenerator(),
    new UnlinkedItemInfoGenerator(),
  ];

  static fileGenerators = [
    new UnknownFileGenerator(),
    new ValidFileGenerator(),
    new PathLengthFileGenerator(),
    new CheckNoBOMGenerator(),
  ];

  static configureForSuite(
    generator:
      | IProjectFileInfoGenerator
      | IProjectInfoGenerator
      | IProjectItemInfoGenerator
      | IProjectInfoGeneratorBase,
    suite: ProjectInfoSuite
  ) {
    const config = SuiteConfigs[suite];

    if ("performAddOnValidations" in generator) {
      generator.performAddOnValidations = config.performAddOnValidations;
    }
    if ("performPlatformVersionValidations" in generator) {
      generator.performPlatformVersionValidations = config.performPlatformVersionValidations;
    }

    if ("identifierOverridesAreErrors" in generator) {
      generator.identifierOverridesAreErrors = config.identifierOverridesAreErrors;
    }
  }
}

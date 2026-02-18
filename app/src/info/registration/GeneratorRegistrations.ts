// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ScriptModuleManager from "../../manager/ScriptModuleManager";
import VsCodeFileManager from "../../manager/VsCodeFileManager";
import MinEngineVersionManager from "../../manager/MinEngineVersionManager";
import BaseGameVersionManager from "../../manager/BaseGameVersionManager";
import PackMetaDataInformationGenerator from "../PackMetaDataInfoGenerator";
import CooperativeAddOnRequirementsGenerator from "../CooperativeAddOnRequirementsGenerator";
import StrictPlatformInfoGenerator from "../StrictPlatformInfoGenerator";
import CooperativeAddOnItemRequirementsGenerator from "../CooperativeAddOnItemRequirementsGenerator";
import PathLengthFileGenerator from "../PathLengthFileGenerator";
import ItemCountsInfoGenerator from "../ItemCountsInfoGenerator";
import PackInfoGenerator from "../PackInfoGenerator";
import LineSizeInfoGenerator from "../LineSizeInfoGenerator";
import FormSchemaItemInfoGenerator from "../FormSchemaItemInfoGenerator";
import UnknownItemGenerator from "../UnknownItemGenerator";
import UnknownFileGenerator from "../UnknownFileGenerator";
import WorldItemInfoGenerator from "../WorldItemInfoGenerator";
import JsonFileTagsInfoGenerator from "../JsonFileTagsInfoGenerator";
import WorldDataInfoGenerator from "../WorldDataInfoGenerator";
import { ProjectInfoSuite } from "../IProjectInfoData";
import IProjectFileInfoGenerator from "../IProjectFileInfoGenerator";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import IProjectItemInfoGenerator from "../IProjectItemInfoGenerator";
import IProjectInfoGeneratorBase from "../IProjectInfoGeneratorBase";
import TextureInfoGenerator from "../TextureInfoGenerator";
import PackSizeInfoGenerator from "../PackSizeInfoGenerator";
import TextureImageInfoGenerator from "../TextureImageInfoGenerator";
import FormatVersionManager from "../../manager/FormatVersionManager";
import AnimationResourceInfoGenerator from "../AnimationResourceInfoGenerator";
import UnlinkedItemInfoGenerator from "../UnlinkedItemInfoGenerator";
import GeometryInfoGenerator from "../GeometryInfoGenerator";
import TextureReferenceInfoGenerator from "../TextureReferenceInfoGenerator";
import TypesInfoGenerator from "../TypesInfoGenerator";
import ValidFileGenerator from "../ValidFileGenerator";
import BlocksCatalogManager from "../../manager/BlocksCatalogManager";
import EntityTypeManager from "../../manager/EntityTypeManager";
import ItemTypeManager from "../../manager/ItemTypeManager";
import SharingInfoGenerator from "../SharingInfoGenerator";
import CheckVanillaDuplicatesInfoGenerator from "../projectGenerators/CheckVanillaDuplicatesInfoGenerator";
import CheckNoBOMGenerator from "../fileGenerators/CheckNoBOMGenerator";
import MCFunctionInfoGenerator from "../MCFunctionInfoGenerator";
import CheckPackIconsGenerator from "../projectGenerators/CheckPackIconsGenerator";
import CheckWorldIconsGenerator from "../projectGenerators/CheckWorldIconsGenerator";
import SoundsDefinitionInfoGenerator from "../projectGenerators/SoundDefinitionsInfoGenerator";
import SummaryInfoGenerator from "../SummaryInfoGenerator";
import ScriptInfoGenerator from "../ScriptInfoGenerator";
import CheckParticleIdentifierGenerator from "../projectGenerators/CheckParticleIdentifierGenerator";
import CheckSkinPackJsonGenerator from "../projectGenerators/CheckSkinPackJsonGenerator";
import SchemaItemInfoGenerator from "../SchemaItemInfoGenerator";
import CheckForbiddenFilesGenerator from "../projectGenerators/CheckForbiddenFiles";
import CheckProjectIntegrityGenerator from "../projectGenerators/CheckProjectIntegrityGenerator";
import CheckBetaFeaturesGenerator from "../projectGenerators/CheckBetaFeaturesGenerator";
import CheckExperimentalFlagInfoGenerator from "../projectGenerators/CheckExperimentalFlagInfoGenerator";
import CheckFeatureDeprecationInfoGenerator from "../projectGenerators/CheckFeatureDeprecationInfoGenerator";
import CheckGeometryFormatInfoGenerator from "../projectGenerators/CheckGeometryFormatInfoGenerator";
import CheckLangFilesGenerator from "../projectGenerators/CheckLangFilesGenerator";
import { SuiteConfigs } from "./RegistrationData";
import CheckManifestGenerator from "../projectGenerators/checkManifest/CheckManifestGenerator";
import CheckResourcePackDependenciesGenerator from "../projectGenerators/CheckResourcePackDependenciesGenerator";
import CheckWorldPackReferencesGenerator from "../projectGenerators/CheckWorldPackReferencesGenerator";

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
    ...this.managers,
  ];

  static updaters = this.managers;

  static itemGenerators = [
    new UnknownItemGenerator(),
    new FormSchemaItemInfoGenerator(),
    new SchemaItemInfoGenerator(),
    new WorldItemInfoGenerator(),
    new WorldDataInfoGenerator(),
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

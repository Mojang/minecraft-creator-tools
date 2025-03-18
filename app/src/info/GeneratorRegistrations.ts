// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ScriptModuleManager from "../manager/ScriptModuleManager";
import VsCodeFileManager from "../manager/VsCodeFileManager";
import MinEngineVersionManager from "../manager/MinEngineVersionManager";
import BaseGameVersionManager from "../manager/BaseGameVersionManager";
import PackMetaDataInformationGenerator from "./PackMetaDataInfoGenerator";
import CooperativeAddOnRequirementsGenerator from "./CooperativeAddOnRequirementsGenerator";
import StrictPlatformInfoGenerator from "./StrictPlatformInfoGenerator";
import CooperativeAddOnItemRequirementsGenerator from "./CooperativeAddOnItemRequirementsGenerator";
import PathLengthFileGenerator from "./PathLengthFileGenerator";
import ItemCountsInfoGenerator from "./ItemCountsInfoGenerator";
import PackInfoGenerator from "./PackInfoGenerator";
import LineSizeInfoGenerator from "./LineSizeInfoGenerator";
import SchemaItemInfoGenerator from "./SchemaItemInfoGenerator";
import UnknownItemGenerator from "./UnknownItemGenerator";
import UnknownFileGenerator from "./UnknownFileGenerator";
import WorldItemInfoGenerator from "./WorldItemInfoGenerator";
import JsonFileTagsInfoGenerator from "./JsonFileTagsInfoGenerator";
import WorldDataInfoGenerator from "./WorldDataInfoGenerator";
import { ProjectInfoSuite } from "./IProjectInfoData";
import IProjectFileInfoGenerator from "./IProjectFileInfoGenerator";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import IProjectItemInfoGenerator from "./IProjectItemInfoGenerator";
import IProjectInfoGeneratorBase from "./IProjectInfoGeneratorBase";
import TextureInfoGenerator from "./TextureInfoGenerator";
import PackSizeInfoGenerator from "./PackSizeInfoGenerator";
import TextureImageInfoGenerator from "./TextureImageInfoGenerator";
import FormatVersionManager from "../manager/FormatVersionManager";
import AnimationResourceInfoGenerator from "./AnimationResourceInfoGenerator";
import UnlinkedItemInfoGenerator from "./UnlinkedItemInfoGenerator";
import GeometryInfoGenerator from "./GeometryInfoGenerator";
import TextureReferenceInfoGenerator from "./TextureReferenceInfoGenerator";
import TypesInfoGenerator from "./TypesInfoGenerator";
import ValidFileGenerator from "./ValidFileGenerator";
import BlocksCatalogManager from "../manager/BlocksCatalogManager";
import EntityTypeManager from "../manager/EntityTypeManager";
import ItemTypeManager from "../manager/ItemTypeManager";

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
    new PackMetaDataInformationGenerator(),
    new AnimationResourceInfoGenerator(),
    new CooperativeAddOnRequirementsGenerator(),
    new StrictPlatformInfoGenerator(),
    new TextureInfoGenerator(),
    new TextureReferenceInfoGenerator(),
    new TypesInfoGenerator(),
    new TextureImageInfoGenerator(),
    new GeometryInfoGenerator(),
    ...this.managers,
  ];

  static updaters = this.managers;

  static itemGenerators = [
    new UnknownItemGenerator(),
    new SchemaItemInfoGenerator(),
    new WorldItemInfoGenerator(),
    new WorldDataInfoGenerator(),
    new CooperativeAddOnItemRequirementsGenerator(),
    new UnlinkedItemInfoGenerator(),
  ];

  static fileGenerators = [new UnknownFileGenerator(), new ValidFileGenerator(), new PathLengthFileGenerator()];

  static configureForSuite(
    generator:
      | IProjectFileInfoGenerator
      | IProjectInfoGenerator
      | IProjectItemInfoGenerator
      | IProjectInfoGeneratorBase,
    suite: ProjectInfoSuite
  ) {
    if (suite === ProjectInfoSuite.cooperativeAddOn) {
      if (generator.id === "WORLDDATA") {
        (generator as WorldDataInfoGenerator).performAddOnValidations = true;
      } else if (generator.id === "TEXTURE") {
        (generator as TextureInfoGenerator).performAddOnValidations = true;
      } else if (generator.id === "PACKSIZE") {
        (generator as PackSizeInfoGenerator).performAddOnValidations = true;
      }
    } else {
      if (generator.id === "WORLDDATA") {
        (generator as WorldDataInfoGenerator).performAddOnValidations = false;
      } else if (generator.id === "TEXTURE") {
        (generator as TextureInfoGenerator).performAddOnValidations = false;
      } else if (generator.id === "PACKSIZE") {
        (generator as PackSizeInfoGenerator).performAddOnValidations = false;
      }
    }

    if (suite === ProjectInfoSuite.currentPlatformVersions) {
      if (generator.id === "FORMATVER") {
        (generator as FormatVersionManager).performPlatformVersionValidations = true;
      } else if (generator.id === "BASEGAMEVER") {
        (generator as BaseGameVersionManager).performPlatformVersionValidations = true;
      } else if (generator.id === "MINENGINEVER") {
        (generator as MinEngineVersionManager).performPlatformVersionValidations = true;
      } else if (generator.id === "WORLDDATA") {
        (generator as WorldDataInfoGenerator).performPlatformVersionValidations = true;
      }
    } else {
      if (generator.id === "FORMATVER") {
        (generator as FormatVersionManager).performPlatformVersionValidations = false;
      } else if (generator.id === "BASEGAMEVER") {
        (generator as BaseGameVersionManager).performPlatformVersionValidations = false;
      } else if (generator.id === "MINENGINEVER") {
        (generator as MinEngineVersionManager).performPlatformVersionValidations = false;
      } else if (generator.id === "WORLDDATA") {
        (generator as WorldDataInfoGenerator).performPlatformVersionValidations = false;
      }
    }
  }
}

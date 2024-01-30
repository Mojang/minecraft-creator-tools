import ScriptModuleManager from "../manager/ScriptModuleManager";
import VsCodeFileManager from "../manager/VsCodeFileManager";
import MinEngineVersionManager from "../manager/MinEngineVersionManager";
import BaseGameVersionManager from "../manager/BaseGameVersionManager";
import BehaviorPackEntityTypeManager from "../manager/BehaviorPackEntityTypeManager";
import PackMetaDataInformationGenerator from "./PackMetaDataInfoGenerator";
import AddOnRequirementsGenerator from "./AddOnRequirementsGenerator";
import StrictPlatformInfoGenerator from "./StrictPlatformInfoGenerator";
import AddOnItemRequirementsGenerator from "./AddOnItemRequirementsGenerator";
import PathLengthFileGenerator from "./PathLengthFileGenerator";
import ItemCountsInfoGenerator from "./ItemCountsInfoGenerator";
import PackInformationGenerator from "./PackInfoGenerator";
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

export default class GeneratorRegistrations {
  static projectGenerators = [
    new ItemCountsInfoGenerator(),
    new LineSizeInfoGenerator(),
    new PackInformationGenerator(),
    new JsonFileTagsInfoGenerator(),
    new ScriptModuleManager(),
    new VsCodeFileManager(),
    new MinEngineVersionManager(),
    new BaseGameVersionManager(),
    new BehaviorPackEntityTypeManager(),
    new AddOnRequirementsGenerator(),
    new StrictPlatformInfoGenerator(),
    new TextureInfoGenerator(),
  ];

  static itemGenerators = [
    new UnknownItemGenerator(),
    new PackMetaDataInformationGenerator(),
    new SchemaItemInfoGenerator(),
    new WorldItemInfoGenerator(),
    new WorldDataInfoGenerator(),
    new AddOnItemRequirementsGenerator(),
  ];

  static fileGenerators = [new UnknownFileGenerator(), new PathLengthFileGenerator()];

  static configureForSuite(
    generator:
      | IProjectFileInfoGenerator
      | IProjectInfoGenerator
      | IProjectItemInfoGenerator
      | IProjectInfoGeneratorBase,
    suite: ProjectInfoSuite
  ) {
    if (suite === ProjectInfoSuite.addOn) {
      if (generator.id === "WORLDDATA") {
        (generator as WorldDataInfoGenerator).performAddOnValidations = true;
      } else if (generator.id === "TEXTURE") {
        (generator as TextureInfoGenerator).performAddOnValidations = true;
      }
    } else {
      if (generator.id === "WORLDDATA") {
        (generator as WorldDataInfoGenerator).performAddOnValidations = false;
      } else if (generator.id === "TEXTURE") {
        (generator as TextureInfoGenerator).performAddOnValidations = false;
      }
    }
  }
}

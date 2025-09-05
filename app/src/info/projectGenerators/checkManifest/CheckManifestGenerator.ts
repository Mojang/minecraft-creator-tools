import Project from "../../../app/Project";
import ProjectItem from "../../../app/ProjectItem";
import SubpackTypes from "../../../app/subpacks/SubpackTypes";
import Versioning from "../../../app/Versioning";
import { filterAndSeparate, findDuplicates } from "../../../core/ArrayUtilities";
import ContentIndex from "../../../core/ContentIndex";
import { findMissingProperty, notEmpty } from "../../../core/ObjectUtilities";
import Utilities from "../../../core/Utilities";
import SemanticVersion from "../../../core/versioning/SemanticVersion";
import { PackType } from "../../../minecraft/Pack";
import IProjectInfoGenerator from "../../IProjectInfoGenerator";
import { IProjectInfoTopicData } from "../../IProjectInfoGeneratorBase";
import ProjectInfoItem from "../../ProjectInfoItem";
import ProjectInfoUtilities from "../../ProjectInfoUtilities";
import { getTestTitleById, resultFromTest } from "../../tests/TestDefinition";
import Manifest, { parseManifest } from "../../../minecraft/manifests/Manifest";
import { Tests } from "./CheckManifestData";
import * as ValidationData from "./CheckManifestData";
import { ProjectItemType } from "../../../app/IProjectItemData";

type PackDesc = {
  type?: PackType;
  isWorld?: boolean;
  isEDUOffer?: boolean;
};

export default class CheckManifestGenerator implements IProjectInfoGenerator {
  id: string = "CHKMANIF";
  title: string = "Check Manifest Generator";
  canAlwaysProcess = true;

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const packs = project.packs;

    const invalidManifests = packs
      .filter((pack) => {
        const manifests = pack.getPackItems().filter((item) => item.name === "manifest.json");
        return manifests.length === 0 || manifests.length > 1;
      })
      .map(() => resultFromTest(Tests.InvalidNumberOfManifests, { id: this.id }));

    if (invalidManifests.length > 0) {
      return invalidManifests;
    }

    const packManifests = packs.map((pack) => [pack.getManifest(), pack] as const);
    const worldManifests = project.items
      .filter((item) => item.itemType === ProjectItemType.worldTemplateManifestJson)
      .map<[ProjectItem, PackDesc]>((manifest) => [manifest, { isWorld: true }]);

    const allManifests = [...worldManifests, ...packManifests];

    const results = await Promise.all(allManifests.map(([desc, manifest]) => this.validateManifest(desc, manifest)));
    return results.flat();
  }

  async validateManifest(manifestItem: ProjectItem, pack: PackDesc): Promise<ProjectInfoItem[]> {
    const json = await manifestItem.getContentAsJson();
    const [manifest, parseErrors] = parseManifest(json);

    if (parseErrors) {
      return parseErrors
        .map((error) => ({ id: this.id, message: error.message, item: manifestItem, data: error.propertyName }))
        .map((resultData) => resultFromTest(Tests.InvalidManifestSchema, resultData));
    }

    const results = [
      ...this.validateFormatVersion(pack, manifest, manifestItem),
      ...this.validateIds(pack, manifest, manifestItem),
      ...this.validateHeader(pack, manifest, manifestItem),
      ...this.validateModules(pack, manifest, manifestItem),
      ...this.validateDependencies(pack, manifest, manifestItem),
      ...this.validateSubpacks(pack, manifest, manifestItem),
      ...this.validateCapabilties(pack, manifest, manifestItem),
      ...this.validateSettings(pack, manifest, manifestItem),
    ];

    return results;
  }

  private validateIds(pack: PackDesc, manifest: Manifest, manifestItem: ProjectItem) {
    const allIds = [
      manifest.header.uuid,
      ...(manifest.modules?.map((module) => module.uuid) || []),
      ...(manifest.dependencies?.map((dep) => dep.uuid).filter(notEmpty) || []),
    ];

    const [validIds, invalidIds] = filterAndSeparate(allIds, (id) => Utilities.isValidUuid(id));

    const invalidIdResults = invalidIds
      .map((invalid) => ({ id: this.id, item: manifestItem, data: invalid }))
      .map((data) => resultFromTest(Tests.InvalidId, data));

    const dupIdResults = findDuplicates(validIds)
      .map((dupId) => ({ id: this.id, item: manifestItem, data: dupId }))
      .map((data) => resultFromTest(Tests.DuplicateId, data));

    return [...invalidIdResults, ...dupIdResults];
  }
  private validateSettings(pack: PackDesc, manifest: Manifest, manifestItem: ProjectItem) {
    const settings = manifest.settings;
    if (!settings) {
      return [];
    }

    const dupNameResults = findDuplicates(settings.map((setting) => setting.name))
      .map((dup) => ({ id: this.id, data: dup, item: manifestItem }))
      .map((data) => resultFromTest(Tests.DuplicateSettingsName, data));

    const noNamespaces = settings
      .filter((setting) => setting.name && ValidationData.NamespaceFormat.test(setting.name))
      .map((setting) => ({ id: this.id, item: manifestItem, data: setting.name }))
      .map((data) => resultFromTest(Tests.SettingsNamespaceRequired, data));

    const toggles = settings.filter((setting) => setting.type === "toggle");
    const sliders = settings.filter((setting) => setting.type === "slider");
    const dropdowns = settings.filter((setting) => setting.type === "dropdown");

    const knownTypes = new Set(["label", "toggle", "slider", "dropdown"]);
    const invalidTypes = settings
      .filter((settings) => !knownTypes.has(settings.type))
      .map((settings) => ({ id: this.id, data: settings.type, item: manifestItem }))
      .map((data) => resultFromTest(Tests.InvalidSettingType, data));

    //note: type and text are always required, so we use the schema to validate that
    //for other properties that are only conditionally required, we'll confirm post parsing

    const missingPropResults = [
      ...toggles
        .map((toggle) => [toggle, findMissingProperty(toggle, ["name", "default"])] as const)
        .filter(([, missingProperty]) => !!missingProperty)
        .map(([, missingProperty]) => ({ id: this.id, item: manifestItem, data: missingProperty }))
        .map((data) => resultFromTest(Tests.MissingSettingsProperty, data)),

      ...sliders
        .map((slider) => [slider, findMissingProperty(slider, ["name", "min", "max", "step", "default"])] as const)
        .filter(([, missingProperty]) => !!missingProperty)
        .map(([, missingProperty]) => ({ id: this.id, item: manifestItem, data: missingProperty }))
        .map((data) => resultFromTest(Tests.MissingSettingsProperty, data)),

      ...dropdowns
        .map((dropdown) => [dropdown, findMissingProperty(dropdown, ["name", "default", "options"])] as const)
        .filter(([, missingProperty]) => !!missingProperty)
        .map(([, missingProperty]) => ({ id: this.id, item: manifestItem, data: missingProperty }))
        .map((data) => resultFromTest(Tests.MissingSettingsProperty, data)),
    ];

    const invalidMins = sliders
      // undefined values are reported by the missing property result, ignore for now
      .filter((slider) => !!slider.min && !!slider.max)
      // we've already filtered undefined values, '!' is safe
      .filter((slider) => slider.min! > slider.max!)
      .map((slider) => ({ id: this.id, item: manifestItem, data: slider.min }))
      .map((data) => resultFromTest(Tests.InvalidSettingsMin, data));

    const invalidDefaults = sliders
      .filter((slider) => !!slider.default && !!slider.min && !!slider.max)
      // we've already filtered undefined values, '!' is safe
      .filter(
        (slider) => typeof slider.default !== "number" || slider.default > slider.max! || slider.default < slider.min!
      )
      .map((slider) => ({ id: this.id, item: manifestItem, data: slider.default }))
      .map((data) => resultFromTest(Tests.InvalidSliderDefault, data));

    const invalidSteps = sliders
      .filter((slider) => !!slider.step && !!slider.min && !!slider.max)
      // we've already filtered undefined values, '!' is safe
      .filter((slider) => slider.step! <= 0 || slider.step! > slider.max! - slider.min!)
      .map((slider) => ({ id: this.id, item: manifestItem, data: slider.step }))
      .map((data) => resultFromTest(Tests.InvalidSettingsStep, data));

    const notEnoughOptions = dropdowns
      .filter((dropdown) => !dropdown.options || dropdown.options.length < ValidationData.MinDropDownOptions)
      .map(() => ({ id: this.id, item: manifestItem }))
      .map((data) => resultFromTest(Tests.NotEnoughSettingsOptions, data));

    const duplicateOptions = dropdowns
      .flatMap((dropdown) => (dropdown.options ? findDuplicates(dropdown.options.map((opt) => opt.name)) : []))
      .map((duplicate) => ({ id: this.id, item: manifestItem, data: duplicate }))
      .map((data) => resultFromTest(Tests.DuplicateOptions, data));

    const badDefaults = dropdowns
      .filter(
        (dropdown) =>
          dropdown.options &&
          typeof dropdown.default === "string" &&
          dropdown.options.map((opt) => opt.name).includes(dropdown.default)
      )
      .map((dropdown) => ({ id: this.id, item: manifestItem, data: dropdown.default }))
      .map((data) => resultFromTest(Tests.InvalidSliderDefault, data));

    return [
      ...noNamespaces,
      ...dupNameResults,
      ...invalidTypes,
      ...missingPropResults,
      ...invalidMins,
      ...invalidDefaults,
      ...invalidSteps,
      ...notEnoughOptions,
      ...duplicateOptions,
      ...badDefaults,
    ];
  }

  private validateCapabilties(pack: PackDesc, manifest: Manifest, manifestItem: ProjectItem) {
    const capabilities = manifest.capabilities;
    if (!capabilities) {
      return [];
    }

    return capabilities
      .filter((capability) => !ValidationData.AllowedCapabilities.has(capability))
      .map((capability) => ({ id: this.id, item: manifestItem, data: capability }))
      .map((data) => resultFromTest(Tests.InvalidCapability, data));
  }

  private validateSubpacks(pack: PackDesc, manifest: Manifest, manifestItem: ProjectItem) {
    const subpacks = manifest.subpacks;
    if (!subpacks) {
      return [];
    }

    const dupFolderResults = findDuplicates(subpacks.map((subp) => subp.folderName))
      .map((folder) => ({ id: this.id, item: manifestItem, data: folder }))
      .map((data) => resultFromTest(Tests.DuplicateSubpackFolder, data));

    const dupNameResults = findDuplicates(subpacks.map((subp) => subp.name))
      .map((name) => ({ id: this.id, item: manifestItem, data: name }))
      .map((data) => resultFromTest(Tests.DuplicateSubpackName, data));

    const validNames = new Set(Object.values(SubpackTypes).map((type) => type.name));

    const invalidNameResults = subpacks
      .filter((subp) => !validNames.has(subp.name))
      .map((subp) => ({ id: this.id, item: manifestItem, data: subp.name }))
      .map((data) => resultFromTest(Tests.InvalidSubpackName, data));

    const invalidMemoryTierResults = subpacks
      .map((subp) => [subp, SubpackTypes[subp.name]?.minTier] as const)
      .filter(([, minTier]) => !!minTier)
      .filter(([subp, minTier]) => subp.memoryTier < minTier)
      .map(([subp]) => ({ id: this.id, item: manifestItem, data: subp.memoryTier }))
      .map((data) => resultFromTest(Tests.InvalidSubpackMemoryTier, data));

    return [...dupFolderResults, ...dupNameResults, ...invalidNameResults, ...invalidMemoryTierResults];
  }

  private validateDependencies(pack: PackDesc, manifest: Manifest, manifestItem: ProjectItem) {
    const dependencies = manifest.dependencies;
    if (!dependencies) {
      return [];
    }

    const noIdResults = dependencies
      .filter((dependency) => !dependency.uuid && !dependency.moduleName)
      .map(() => resultFromTest(Tests.NoDependencyIdentifier, { id: this.id, item: manifestItem }));

    const multipleIdResults = dependencies
      .filter((dependency) => !!dependency.uuid && !!dependency.moduleName)
      .map(() => resultFromTest(Tests.MultipleDependencyIdentifier, { id: this.id, item: manifestItem }));

    const allowedDependencyModulesResults = dependencies
      .filter(
        (dependency) => !!dependency.moduleName && !ValidationData.AllowedDependencyModules[dependency.moduleName]
      )
      .map((dependency) => ({ id: this.id, item: manifestItem, data: dependency.moduleName }))
      .map((data) => resultFromTest(Tests.ModuleNameNotAllowed, data));

    const dependencyVersions = dependencies.map((dep) => [dep, SemanticVersion.parse(dep.version)] as const);
    const invalidVersionResults = dependencyVersions
      .filter(([, version]) => !version)
      .map(([dep]) => ({ id: this.id, item: manifestItem, data: dep.version }))
      .map((data) => resultFromTest(Tests.UnableToParseVersion, data));

    const versionsBelowMinResults = dependencyVersions
      // we only care about dependencies that use module name, non-allowed modules are handled by a different check
      .filter(
        ([dep, version]) => !!dep.moduleName && !!ValidationData.AllowedDependencyModules[dep.moduleName] && !!version
      )
      //  '!' is safe here, we've already filtered falsey moduleNames and versions
      .filter(([dep, version]) => version!.compareTo(ValidationData.AllowedDependencyModules[dep.moduleName!]) <= 0)
      .map(([dep]) => resultFromTest(Tests.BelowMinVersion, { id: this.id, item: manifestItem, data: dep.version }));

    return [
      ...noIdResults,
      ...multipleIdResults,
      ...allowedDependencyModulesResults,
      ...invalidVersionResults,
      ...versionsBelowMinResults,
    ];
  }

  private validateModules(pack: PackDesc, manifest: Manifest, manifestItem: ProjectItem) {
    const modules = manifest.modules;

    if (!modules) {
      return [];
    }

    if (modules.filter((module) => module.type === ValidationData.WorldTemplateModuleName).length > 1) {
      return [resultFromTest(Tests.TooManyWorldTemplates, { id: this.id, item: manifestItem })];
    }

    return modules
      .filter((module) => !ValidationData.KnownModuleTypes.has(module.type))
      .map((module) => resultFromTest(Tests.InvalidModuleType, { id: this.id, item: manifestItem, data: module.type }));
  }

  private validateHeader(pack: PackDesc, manifest: Manifest, manifestItem: ProjectItem): ProjectInfoItem[] {
    const header = manifest.header;

    const results = [];
    const isemptyDescriptionAllowed = pack.type === PackType.skin;
    if (!header.description && !isemptyDescriptionAllowed) {
      results.push(
        resultFromTest(Tests.MissingHeaderProperty, { id: this.id, item: manifestItem, data: "description" })
      );
    }

    if (pack.isWorld) {
      if (!!header.baseGameVersion && manifest.formatVersion < ValidationData.FormatVersion2) {
        const data = { id: this.id, item: manifestItem, data: header.baseGameVersion };
        results.push(resultFromTest(Tests.InvalidBaseGameVersion, data));
      }

      if (header.baseGameVersion === "*") {
        const data = { id: this.id, item: manifestItem, data: header.baseGameVersion };
        results.push(resultFromTest(Tests.WildCardGameVersion, data));
      }

      if (manifest.formatVersion > ValidationData.FormatVersion1 && header.lockTemplateOptions === undefined) {
        const data = { id: this.id, item: manifestItem, data: "lock_template_options" };
        results.push(resultFromTest(Tests.HeaderPropertyRequiredV2, data));
      }
    }

    if (pack.type === PackType.resource) {
      const infoItem = this.validateMinEngineVersion(
        header.minEngineVersion,
        pack,
        manifest.formatVersion,
        manifestItem
      );
      if (infoItem) {
        results.push(infoItem);
      }
    }

    if (header.packscope && ValidationData.AllowedPackScopes.has(header.packscope)) {
      results.push(resultFromTest(Tests.InvalidPackScope, { id: this.id, item: manifestItem, data: header.packscope }));
    }

    return results;
  }

  private validateMinEngineVersion(
    mev: string | number[] | undefined,
    pack: PackDesc,
    formatVersion: number,
    manifestItem: ProjectItem
  ): ProjectInfoItem | null {
    const minVersion = SemanticVersion.parse(mev);
    if (!minVersion && formatVersion > ValidationData.FormatVersion1) {
      const data = { id: this.id, item: manifestItem, data: "min_engine_version" };
      return resultFromTest(Tests.HeaderPropertyRequiredV2, data);
    }

    const requiredVer = this.getMinimalVersionThatRequiresV2(pack.isEDUOffer === true);
    if (minVersion && minVersion.compareTo(requiredVer) >= 0 && formatVersion < ValidationData.FormatVersion2) {
      const data = { id: this.id, item: manifestItem, data: mev };
      return resultFromTest(Tests.MinEngineVersionTooHigh, data);
    }

    return null;
  }

  private getMinimalVersionThatRequiresV2(isEDUOffer: boolean) {
    return isEDUOffer ? Versioning.FirstMinEngineVersionForFormatV2EDU : Versioning.FirstMinEngineVersionForFormatV2;
  }

  private validateFormatVersion(pack: PackDesc, manifest: Manifest, manifestItem: ProjectItem) {
    const format = manifest.formatVersion;

    if (!ValidationData.ValidFormatVersions.has(format)) {
      return [resultFromTest(Tests.InvalidFormatVersion, { id: this.id, data: format })];
    }

    if (
      !(pack.type === PackType.skin || pack.type === PackType.persona) &&
      manifest.formatVersion < ValidationData.FormatVersion2
    ) {
      return [
        resultFromTest(Tests.InvalidFormatVersion, {
          id: this.id,
          data: format,
          message: `All new content targeting published client version must conform to format version [${ValidationData.FormatVersion2}].`,
        }),
      ];
    }

    return [];
  }

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    const title = ProjectInfoUtilities.getGeneralTopicTitle(topicId) || getTestTitleById(Tests, topicId);
    return { title };
  }
  summarize() {}
}

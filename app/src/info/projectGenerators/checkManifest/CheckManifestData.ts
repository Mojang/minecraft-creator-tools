import SemanticVersion from "../../../core/versioning/SemanticVersion";
import { InfoItemType } from "../../IInfoItemData";

export const MinDropDownOptions = 2;

export const AllowedPackScopes = new Set(["global", "world", "any"]);

export const AllowedCapabilities = new Set<string>(["pbr"]);
export const AllowedDependencyModules: Record<string, SemanticVersion> = {
  "@minecraft/server": new SemanticVersion(1, 0, 0),
  "@minecraft/server-ui": new SemanticVersion(1, 0, 0),
};
export const NamespaceFormat = /.+:.+/;
export const FormatVersion1 = 1;
export const FormatVersion2 = 2;
export const FormatVersion3 = 3;
export const ValidFormatVersions = new Set([FormatVersion1, FormatVersion2, FormatVersion3]);
export const WorldTemplateModuleName = "world_template";
export const KnownModuleTypes = new Set([
  "persona_piece",
  WorldTemplateModuleName,
  "skin_pack",
  "data",
  "script",
  "resources",
]);

// The mininmum min_engine_version allowed for blockbench emotes. See user story #1331327 for context
export const BlockBenchEmoteMinEngineVersion: SemanticVersion = new SemanticVersion(1, 17, 0);

export const Tests = {
  InvalidFormatVersion: { id: 101, title: "InvalidFormatVersion" },
  InvalidManifestSchema: { id: 102, title: "Invalid Json Schema For Manifest File" },
  InvalidNumberOfManifests: {
    id: 103,
    title: "Invalid Number Of Manifests",
    defaultMessage: "Packs must have exactly one manifest",
  },
  MissingHeaderProperty: {
    id: 104,
    title: "Missing Header Property",
  },
  HeaderPropertyRequiredV2: {
    id: 105,
    title: "Header Property Required",
    defaultMessage: "Header property is required for format version 2 and above.",
  },
  MinEngineVersionTooHigh: {
    id: 106,
    title: "Min Engine Version Too High For Format Version 1",
    defaultMessage: `[min_engine_version] is too high. To use a higher version, you need to use [format_version] [${FormatVersion2}].`,
  },
  InvalidPackScope: {
    id: 107,
    title: "InvalidPackScope",
    defaultMessage: `pack_scope must be one of [${[...AllowedPackScopes].join(", ")}]`,
  },
  TooManyWorldTemplates: {
    id: 108,
    title: "More Than 1 World Templates",
    defaultMessage: "manifest.modules can have only 1 world_template module.",
  },
  InvalidModuleType: {
    id: 109,
    title: "Invalid Module Type",
  },
  DuplicateId: {
    id: 110,
    title: "Duplicate Id Found",
    defaultMessage: "Duplicate UUID found. All UUIDs must be unique.",
  },
  InvalidId: {
    id: 111,
    title: "UUID is not valid",
  },
  NoDependencyIdentifier: {
    id: 112,
    title: "No Dependency Identifier",
    defaultMessage: "Dependency is invalid, no 'module_name' or 'uuid' identifier found.",
  },
  MultipleDependencyIdentifier: {
    id: 113,
    title: "Multiple Dependency Identifier",
    defaultMessage: "Dependencies should be expressed by 'module_name' or UUID, not both.",
  },
  ModuleNameNotAllowed: {
    id: 114,
    title: "Module Name Not Allowed",
  },
  UnableToParseVersion: {
    id: 115,
    title: "Unable To Parse Version",
  },
  BelowMinVersion: {
    id: 116,
    title: "Version Is Below Minimum Allowed",
  },
  InvalidCapability: {
    id: 117,
    title: "Invalid Capability",
  },
  DuplicateSubpackFolder: {
    id: 118,
    title: "Duplicate Subpack Folder",
    defaultMessage: "Subpack folder name used twice",
  },
  DuplicateSubpackName: {
    id: 119,
    title: "Duplicate Subpack Name",
    defaultMessage: "Subpack name used twice",
  },
  InvalidSubpackName: {
    id: 120,
    title: "Invalid Subpack Name",
  },
  InvalidSubpackMemoryTier: {
    id: 121,
    title: "Invalid Subpack Memory Tier",
    defaultMessage: "Memory Tier for subpack must be greater than or equal to the minimum",
  },
  MissingSettingsProperty: {
    id: 122,
    title: "Manifest Settings Missing Property",
    defaultMessage: "Property in manifest settings is missing or undefined.",
  },
  InvalidSettingType: {
    id: 123,
    title: "Invalid Setting Type",
    defaultMessage: "Manifest settings has invalid type property.",
  },
  InvalidSettingsMin: {
    id: 124,
    title: "Invalid Setting Minimum",
    defaultMessage: "Manifest min must be less max",
  },
  InvalidSliderDefault: {
    id: 125,
    title: "Invalid Slider Setting Default",
    defaultMessage: "Manifest default must be less max, greather than min, and a number if type is slider",
  },
  InvalidDropdownDefault: {
    id: 126,
    title: "Invalid Dropdown Setting Default",
    defaultMessage: "Default must exist in the options list",
  },
  InvalidSettingsStep: {
    id: 127,
    title: "Invalid Setting Step",
    defaultMessage: "Manifest step must be greater than 0 and less than (max - min)",
  },
  DuplicateSettingsName: {
    id: 128,
    title: "Duplicate Settings Name",
  },
  SettingsNamespaceRequired: {
    id: 129,
    title: "Settings Name Requires Namespace",
    defaultMessage: "Settings name must be in the format of a namespace and include ':'",
  },
  NotEnoughSettingsOptions: {
    id: 130,
    title: "Not Enough Settings Options",
    defaultMessage: `Settings dropdowns must have at least ${MinDropDownOptions} options`,
  },
  DuplicateOptions: {
    id: 131,
    title: "Duplicate Settings Options",
    defaultMessage: `Settings dropdowns must not have duplicate options`,
  },
  InvalidBaseGameVersion: {
    id: 132,
    title: "Invalid Base Game Version",
    defaultMessage: `Use of [base_game_version] requires [format_version] [${FormatVersion2}] or higher.`,
  },
  WildCardGameVersion: {
    id: 133,
    title: "WildCard Game Version",
    defaultMessage: `[base_game_version] wildcards are frowned upon.`,
    severity: InfoItemType.warning,
  },
} as const;

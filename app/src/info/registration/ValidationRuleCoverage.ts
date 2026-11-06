// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ValidationRuleCoverageReference, ValidationRuleKey } from "../tests/ValidationRuleDefinition";
import { ProjectItemType } from "../../app/IProjectItemData";
import {
  JsonSchemaErrorBase,
  OfficialSchemaItemTypes,
} from "../projectItemGenerators/jsonSchemaItemInfo/JsonSchemaItemInfoData";
import {
  CommunitySchemaErrorBase,
  CommunitySchemaItemTypes,
} from "../projectItemGenerators/communitySchemaItemInfo/CommunitySchemaItemInfoData";
import {
  UnlinkedItemNotFoundByType,
  UnlinkedItemTargetTypes,
} from "../projectItemGenerators/unlinkedItemInfo/UnlinkedItemInfoData";

/**
 * JSON/COMJSON structure-error rule indexes are per item type (base + the
 * ProjectItemType), so their keys are derived from the same constants the
 * generators report with.
 */
const jsonLootStructureRuleKey: ValidationRuleKey = `JSON:${JsonSchemaErrorBase + ProjectItemType.lootTableBehavior}`;
const comJsonLootStructureRuleKey: ValidationRuleKey = `COMJSON:${
  CommunitySchemaErrorBase + ProjectItemType.lootTableBehavior
}`;

/**
 * Kinds of validation fixtures. Only "fullPipelineE2E" fixtures — sample
 * content run through a real ProjectInfoSet.generateForProject() by a test —
 * earn E2E coverage credit in the catalog. Other kinds (e.g. "unit" for
 * fixtures fed to a generator in isolation) are legal to declare but do not
 * count as end-to-end coverage.
 */
export type ValidationFixtureKind = "fullPipelineE2E" | "unit";

export interface ValidationFixtureDefinition {
  /** Stable fixture id referenced by coverage declarations. */
  readonly id: string;
  readonly kind: ValidationFixtureKind;
  /**
   * Repo-relative path to the fixture content: either checked-in sample
   * content, or the recipe module that generates the fixture at test time
   * (see src/test/ValidationRuleHarness.ts). Never an absolute path.
   */
  readonly contentPath: string;
  /** Test file that runs the full pipeline over this fixture. */
  readonly declaredBy: string;
  readonly description: string;
}

/**
 * Registry of known validation fixtures. Coverage declarations referencing a
 * fixture id that is not listed here are reported as catalog errors.
 */
const ExplicitValidationFixtures: readonly ValidationFixtureDefinition[] = [
  {
    id: "platform_version_good",
    kind: "fullPipelineE2E",
    contentPath: "samplecontent/platform_version_good",
    declaredBy: "app/src/test/PlatformVersionValidationTest.ts",
    description: "Well-formed BP/RP content on current platform versions; version and manifest rules must pass.",
  },
  {
    id: "platform_version_errors",
    kind: "fullPipelineE2E",
    contentPath: "samplecontent/platform_version_errors",
    declaredBy: "app/src/test/PlatformVersionValidationTest.ts",
    description: "BP/RP content with outdated format and engine versions; version and manifest rules must flag.",
  },
  {
    id: "comprehensive",
    kind: "fullPipelineE2E",
    contentPath: "samplecontent/comprehensive",
    declaredBy: "app/src/test/Generators.spec.ts",
    description: "Broad multi-pack project exercised by the generator count baselines and suite matrix tests.",
  },
  {
    id: "harness-chkmanif-format-valid",
    kind: "fullPipelineE2E",
    contentPath: "app/src/test/ValidationRuleHarnessPairs.ts",
    declaredBy: "app/src/test/ValidationRuleHarnessTest.ts",
    description: "Generated behavior pack with format_version 2; the paired harness proves CHKMANIF:101 stays quiet.",
  },
  {
    id: "harness-chkmanif-format-unknown",
    kind: "fullPipelineE2E",
    contentPath: "app/src/test/ValidationRuleHarnessPairs.ts",
    declaredBy: "app/src/test/ValidationRuleHarnessTest.ts",
    description: "Generated behavior pack with format_version 99; the paired harness proves CHKMANIF:101 flags it.",
  },
] as const;

/**
 * E2E coverage declarations: which fixtures prove a rule fires (rejecting)
 * and stays quiet on good content (accepting), via a full-pipeline test.
 * Declarations must reference rules that exist in the catalog and fixtures
 * registered above — anything else is a catalog error.
 */
/**
 * Paired-harness coverage for the high-risk rule families: every entry maps
 * one catalog rule to the generated accepting/rejecting fixture ids that
 * ValidationRuleHarnessPairs.ts builds and ValidationRuleHarnessTest.ts
 * verifies through the production pipeline. The harness suite asserts a 1:1
 * correspondence between these ids and the registered coverage pairs, so a
 * declaration cannot exist without a real, passing pair behind it.
 */
const HarnessCoverage: readonly ValidationRuleCoverageReference[] = [
  { ruleKey: "MINENGINEVER:120", acceptingFixtureIds: ["harness-minenginever-current", "harness-multipack-minenginever-accept"], rejectingFixtureIds: ["harness-minenginever-minor-low", "harness-multipack-minenginever-reject"] },
  { ruleKey: "CHKMANIF:102", acceptingFixtureIds: ["harness-chkmanif-manifest-schema-accept"], rejectingFixtureIds: ["harness-chkmanif-manifest-schema-reject"] },
  { ruleKey: "CHKMANIF:103", acceptingFixtureIds: ["harness-chkmanif-manifest-count-accept"], rejectingFixtureIds: ["harness-chkmanif-manifest-count-reject"] },
  { ruleKey: "CHKMANIF:104", acceptingFixtureIds: ["harness-chkmanif-missing-description-accept"], rejectingFixtureIds: ["harness-chkmanif-missing-description-reject"] },
  { ruleKey: "CHKMANIF:105", acceptingFixtureIds: ["harness-chkmanif-header-property-required-accept"], rejectingFixtureIds: ["harness-chkmanif-header-property-required-reject"] },
  { ruleKey: "CHKMANIF:106", acceptingFixtureIds: ["harness-chkmanif-mev-too-high-for-v1-accept"], rejectingFixtureIds: ["harness-chkmanif-mev-too-high-for-v1-reject"] },
  { ruleKey: "CHKMANIF:107", acceptingFixtureIds: ["harness-chkmanif-pack-scope-accept"], rejectingFixtureIds: ["harness-chkmanif-pack-scope-reject"] },
  { ruleKey: "CHKMANIF:108", acceptingFixtureIds: ["harness-chkmanif-world-template-count-accept"], rejectingFixtureIds: ["harness-chkmanif-world-template-count-reject"] },
  { ruleKey: "CHKMANIF:109", acceptingFixtureIds: ["harness-chkmanif-module-type-accept"], rejectingFixtureIds: ["harness-chkmanif-module-type-reject"] },
  { ruleKey: "CHKMANIF:110", acceptingFixtureIds: ["harness-chkmanif-duplicate-uuid-accept"], rejectingFixtureIds: ["harness-chkmanif-duplicate-uuid-reject"] },
  { ruleKey: "CHKMANIF:111", acceptingFixtureIds: ["harness-chkmanif-invalid-uuid-accept", "harness-multipack-chkmanif-uuid-accept"], rejectingFixtureIds: ["harness-chkmanif-invalid-uuid-reject", "harness-multipack-chkmanif-uuid-reject"] },
  { ruleKey: "CHKMANIF:112", acceptingFixtureIds: ["harness-chkmanif-dependency-identifier-accept"], rejectingFixtureIds: ["harness-chkmanif-dependency-identifier-reject"] },
  { ruleKey: "CHKMANIF:113", acceptingFixtureIds: ["harness-chkmanif-dependency-both-identifiers-accept"], rejectingFixtureIds: ["harness-chkmanif-dependency-both-identifiers-reject"] },
  { ruleKey: "CHKMANIF:114", acceptingFixtureIds: ["harness-chkmanif-module-name-allowed-accept"], rejectingFixtureIds: ["harness-chkmanif-module-name-allowed-reject"] },
  { ruleKey: "CHKMANIF:115", acceptingFixtureIds: ["harness-chkmanif-dependency-version-parse-accept"], rejectingFixtureIds: ["harness-chkmanif-dependency-version-parse-reject"] },
  { ruleKey: "CHKMANIF:116", acceptingFixtureIds: ["harness-chkmanif-dependency-below-min-accept"], rejectingFixtureIds: ["harness-chkmanif-dependency-below-min-reject"] },
  { ruleKey: "CHKMANIF:117", acceptingFixtureIds: ["harness-chkmanif-capability-accept"], rejectingFixtureIds: ["harness-chkmanif-capability-reject"] },
  { ruleKey: "CHKMANIF:118", acceptingFixtureIds: ["harness-chkmanif-subpack-folder-accept"], rejectingFixtureIds: ["harness-chkmanif-subpack-folder-reject"] },
  { ruleKey: "CHKMANIF:119", acceptingFixtureIds: ["harness-chkmanif-subpack-name-accept"], rejectingFixtureIds: ["harness-chkmanif-subpack-name-reject"] },
  { ruleKey: "CHKMANIF:122", acceptingFixtureIds: ["harness-chkmanif-settings-missing-property-accept"], rejectingFixtureIds: ["harness-chkmanif-settings-missing-property-reject"] },
  { ruleKey: "CHKMANIF:123", acceptingFixtureIds: ["harness-chkmanif-settings-type-accept"], rejectingFixtureIds: ["harness-chkmanif-settings-type-reject"] },
  { ruleKey: "CHKMANIF:124", acceptingFixtureIds: ["harness-chkmanif-settings-min-accept"], rejectingFixtureIds: ["harness-chkmanif-settings-min-reject"] },
  { ruleKey: "CHKMANIF:125", acceptingFixtureIds: ["harness-chkmanif-slider-default-accept"], rejectingFixtureIds: ["harness-chkmanif-slider-default-reject"] },
  { ruleKey: "CHKMANIF:126", acceptingFixtureIds: ["harness-chkmanif-dropdown-default-accept"], rejectingFixtureIds: ["harness-chkmanif-dropdown-default-reject"] },
  { ruleKey: "CHKMANIF:127", acceptingFixtureIds: ["harness-chkmanif-settings-step-accept"], rejectingFixtureIds: ["harness-chkmanif-settings-step-reject"] },
  { ruleKey: "CHKMANIF:128", acceptingFixtureIds: ["harness-chkmanif-settings-duplicate-name-accept"], rejectingFixtureIds: ["harness-chkmanif-settings-duplicate-name-reject"] },
  { ruleKey: "CHKMANIF:129", acceptingFixtureIds: ["harness-chkmanif-settings-namespace-accept"], rejectingFixtureIds: ["harness-chkmanif-settings-namespace-reject"] },
  { ruleKey: "CHKMANIF:130", acceptingFixtureIds: ["harness-chkmanif-dropdown-option-count-accept"], rejectingFixtureIds: ["harness-chkmanif-dropdown-option-count-reject"] },
  { ruleKey: "CHKMANIF:131", acceptingFixtureIds: ["harness-chkmanif-dropdown-duplicate-options-accept"], rejectingFixtureIds: ["harness-chkmanif-dropdown-duplicate-options-reject"] },
  { ruleKey: "CHKMANIF:132", acceptingFixtureIds: ["harness-chkmanif-base-game-version-v1-accept"], rejectingFixtureIds: ["harness-chkmanif-base-game-version-v1-reject"] },
  { ruleKey: "CHKMANIF:133", acceptingFixtureIds: ["harness-chkmanif-wildcard-base-game-version-accept"], rejectingFixtureIds: ["harness-chkmanif-wildcard-base-game-version-reject"] },
  { ruleKey: "CHKMANIF:134", acceptingFixtureIds: ["harness-chkmanif-pbr-min-engine-version-accept"], rejectingFixtureIds: ["harness-chkmanif-pbr-min-engine-version-reject"] },
  { ruleKey: "CHKMANIF:135", acceptingFixtureIds: ["harness-chkmanif-pbr-capability-required-accept", "harness-multipack-chkmanif-vv-accept", "harness-chkmanif-pbr-capability-nested-vv-folder-names-accept"], rejectingFixtureIds: ["harness-chkmanif-pbr-capability-required-reject", "harness-multipack-chkmanif-vv-reject", "harness-chkmanif-pbr-capability-nested-vv-folder-names-reject"] },
  { ruleKey: "FORMATVER:110", acceptingFixtureIds: ["harness-formatver-block-type-malformed-fv-accept"], rejectingFixtureIds: ["harness-formatver-block-type-malformed-fv-reject"] },
  { ruleKey: "FORMATVER:112", acceptingFixtureIds: ["harness-formatver-block-type-lower-major-accept"], rejectingFixtureIds: ["harness-formatver-block-type-lower-major-reject"] },
  { ruleKey: "FORMATVER:114", acceptingFixtureIds: ["harness-formatver-block-type-higher-major-accept"], rejectingFixtureIds: ["harness-formatver-block-type-higher-major-reject"] },
  { ruleKey: "FORMATVER:116", acceptingFixtureIds: ["harness-formatver-block-type-minor-too-old-accept"], rejectingFixtureIds: ["harness-formatver-block-type-minor-too-old-reject"] },
  { ruleKey: "FORMATVER:118", acceptingFixtureIds: ["harness-formatver-block-type-higher-minor-accept"], rejectingFixtureIds: ["harness-formatver-block-type-higher-minor-reject"] },
  { ruleKey: "FORMATVER:120", acceptingFixtureIds: ["harness-formatver-block-type-lower-patch-accept"], rejectingFixtureIds: ["harness-formatver-block-type-lower-patch-reject"] },
  { ruleKey: "FORMATVER:122", acceptingFixtureIds: ["harness-formatver-block-type-higher-patch-accept"], rejectingFixtureIds: ["harness-formatver-block-type-higher-patch-reject"] },
  { ruleKey: "FORMATVER:130", acceptingFixtureIds: ["harness-formatver-item-type-malformed-fv-accept"], rejectingFixtureIds: ["harness-formatver-item-type-malformed-fv-reject"] },
  { ruleKey: "FORMATVER:132", acceptingFixtureIds: ["harness-formatver-item-type-lower-major-accept"], rejectingFixtureIds: ["harness-formatver-item-type-lower-major-reject"] },
  { ruleKey: "FORMATVER:134", acceptingFixtureIds: ["harness-formatver-item-type-higher-major-accept"], rejectingFixtureIds: ["harness-formatver-item-type-higher-major-reject"] },
  { ruleKey: "FORMATVER:136", acceptingFixtureIds: ["harness-formatver-item-type-minor-too-old-accept"], rejectingFixtureIds: ["harness-formatver-item-type-minor-too-old-reject"] },
  { ruleKey: "FORMATVER:138", acceptingFixtureIds: ["harness-formatver-item-type-higher-minor-accept"], rejectingFixtureIds: ["harness-formatver-item-type-higher-minor-reject"] },
  { ruleKey: "FORMATVER:140", acceptingFixtureIds: ["harness-formatver-item-type-lower-patch-accept"], rejectingFixtureIds: ["harness-formatver-item-type-lower-patch-reject"] },
  { ruleKey: "FORMATVER:142", acceptingFixtureIds: ["harness-formatver-item-type-higher-patch-accept"], rejectingFixtureIds: ["harness-formatver-item-type-higher-patch-reject"] },
  { ruleKey: "FORMATVER:150", acceptingFixtureIds: ["harness-formatver-recipe-no-fv-accept"], rejectingFixtureIds: ["harness-formatver-recipe-no-fv-reject"] },
  { ruleKey: "FORMATVER:152", acceptingFixtureIds: ["harness-formatver-recipe-lower-major-accept"], rejectingFixtureIds: ["harness-formatver-recipe-lower-major-reject"] },
  { ruleKey: "FORMATVER:154", acceptingFixtureIds: ["harness-formatver-recipe-higher-major-accept"], rejectingFixtureIds: ["harness-formatver-recipe-higher-major-reject"] },
  { ruleKey: "FORMATVER:156", acceptingFixtureIds: ["harness-formatver-recipe-minor-too-old-accept"], rejectingFixtureIds: ["harness-formatver-recipe-minor-too-old-reject"] },
  { ruleKey: "FORMATVER:158", acceptingFixtureIds: ["harness-formatver-recipe-higher-minor-accept"], rejectingFixtureIds: ["harness-formatver-recipe-higher-minor-reject"] },
  { ruleKey: "FORMATVER:160", acceptingFixtureIds: ["harness-formatver-recipe-lower-patch-accept"], rejectingFixtureIds: ["harness-formatver-recipe-lower-patch-reject"] },
  { ruleKey: "FORMATVER:162", acceptingFixtureIds: ["harness-formatver-recipe-higher-patch-accept"], rejectingFixtureIds: ["harness-formatver-recipe-higher-patch-reject"] },
  { ruleKey: "FORMATVER:170", acceptingFixtureIds: ["harness-formatver-behavior-animation-no-fv-accept"], rejectingFixtureIds: ["harness-formatver-behavior-animation-no-fv-reject"] },
  { ruleKey: "FORMATVER:172", acceptingFixtureIds: ["harness-formatver-behavior-animation-lower-major-accept"], rejectingFixtureIds: ["harness-formatver-behavior-animation-lower-major-reject"] },
  { ruleKey: "FORMATVER:174", acceptingFixtureIds: ["harness-formatver-behavior-animation-higher-major-accept"], rejectingFixtureIds: ["harness-formatver-behavior-animation-higher-major-reject"] },
  { ruleKey: "FORMATVER:176", acceptingFixtureIds: ["harness-formatver-behavior-animation-minor-too-old-accept"], rejectingFixtureIds: ["harness-formatver-behavior-animation-minor-too-old-reject"] },
  { ruleKey: "FORMATVER:178", acceptingFixtureIds: ["harness-formatver-behavior-animation-higher-minor-accept"], rejectingFixtureIds: ["harness-formatver-behavior-animation-higher-minor-reject"] },
  { ruleKey: "FORMATVER:182", acceptingFixtureIds: ["harness-formatver-behavior-animation-higher-patch-accept"], rejectingFixtureIds: ["harness-formatver-behavior-animation-higher-patch-reject"] },
  { ruleKey: "FORMATVER:190", acceptingFixtureIds: ["harness-formatver-behavior-animation-controller-no-fv-accept"], rejectingFixtureIds: ["harness-formatver-behavior-animation-controller-no-fv-reject"] },
  { ruleKey: "FORMATVER:192", acceptingFixtureIds: ["harness-formatver-behavior-animation-controller-lower-major-accept"], rejectingFixtureIds: ["harness-formatver-behavior-animation-controller-lower-major-reject"] },
  { ruleKey: "FORMATVER:194", acceptingFixtureIds: ["harness-formatver-behavior-animation-controller-higher-major-accept"], rejectingFixtureIds: ["harness-formatver-behavior-animation-controller-higher-major-reject"] },
  { ruleKey: "FORMATVER:196", acceptingFixtureIds: ["harness-formatver-behavior-animation-controller-minor-too-old-accept"], rejectingFixtureIds: ["harness-formatver-behavior-animation-controller-minor-too-old-reject"] },
  { ruleKey: "FORMATVER:198", acceptingFixtureIds: ["harness-formatver-behavior-animation-controller-higher-minor-accept"], rejectingFixtureIds: ["harness-formatver-behavior-animation-controller-higher-minor-reject"] },
  { ruleKey: "FORMATVER:202", acceptingFixtureIds: ["harness-formatver-behavior-animation-controller-higher-patch-accept"], rejectingFixtureIds: ["harness-formatver-behavior-animation-controller-higher-patch-reject"] },
  { ruleKey: "FORMATVER:210", acceptingFixtureIds: ["harness-formatver-resource-animation-no-fv-accept"], rejectingFixtureIds: ["harness-formatver-resource-animation-no-fv-reject"] },
  { ruleKey: "FORMATVER:212", acceptingFixtureIds: ["harness-formatver-resource-animation-lower-major-accept"], rejectingFixtureIds: ["harness-formatver-resource-animation-lower-major-reject"] },
  { ruleKey: "FORMATVER:214", acceptingFixtureIds: ["harness-formatver-resource-animation-higher-major-accept"], rejectingFixtureIds: ["harness-formatver-resource-animation-higher-major-reject"] },
  { ruleKey: "FORMATVER:216", acceptingFixtureIds: ["harness-formatver-resource-animation-minor-too-old-accept"], rejectingFixtureIds: ["harness-formatver-resource-animation-minor-too-old-reject"] },
  { ruleKey: "FORMATVER:218", acceptingFixtureIds: ["harness-formatver-resource-animation-higher-minor-accept"], rejectingFixtureIds: ["harness-formatver-resource-animation-higher-minor-reject"] },
  { ruleKey: "FORMATVER:222", acceptingFixtureIds: ["harness-formatver-resource-animation-higher-patch-accept"], rejectingFixtureIds: ["harness-formatver-resource-animation-higher-patch-reject"] },
  { ruleKey: "FORMATVER:230", acceptingFixtureIds: ["harness-formatver-resource-animation-controller-no-fv-accept"], rejectingFixtureIds: ["harness-formatver-resource-animation-controller-no-fv-reject"] },
  { ruleKey: "FORMATVER:232", acceptingFixtureIds: ["harness-formatver-resource-animation-controller-lower-major-accept"], rejectingFixtureIds: ["harness-formatver-resource-animation-controller-lower-major-reject"] },
  { ruleKey: "FORMATVER:234", acceptingFixtureIds: ["harness-formatver-resource-animation-controller-higher-major-accept"], rejectingFixtureIds: ["harness-formatver-resource-animation-controller-higher-major-reject"] },
  { ruleKey: "FORMATVER:236", acceptingFixtureIds: ["harness-formatver-resource-animation-controller-minor-too-old-accept"], rejectingFixtureIds: ["harness-formatver-resource-animation-controller-minor-too-old-reject"] },
  { ruleKey: "FORMATVER:238", acceptingFixtureIds: ["harness-formatver-resource-animation-controller-higher-minor-accept"], rejectingFixtureIds: ["harness-formatver-resource-animation-controller-higher-minor-reject"] },
  { ruleKey: "FORMATVER:242", acceptingFixtureIds: ["harness-formatver-resource-animation-controller-higher-patch-accept"], rejectingFixtureIds: ["harness-formatver-resource-animation-controller-higher-patch-reject"] },
  { ruleKey: "FORMATVER:250", acceptingFixtureIds: ["harness-formatver-spawn-rules-no-fv-accept"], rejectingFixtureIds: ["harness-formatver-spawn-rules-no-fv-reject"] },
  { ruleKey: "FORMATVER:252", acceptingFixtureIds: ["harness-formatver-spawn-rules-lower-major-accept"], rejectingFixtureIds: ["harness-formatver-spawn-rules-lower-major-reject"] },
  { ruleKey: "FORMATVER:254", acceptingFixtureIds: ["harness-formatver-spawn-rules-higher-major-accept"], rejectingFixtureIds: ["harness-formatver-spawn-rules-higher-major-reject"] },
  { ruleKey: "FORMATVER:256", acceptingFixtureIds: ["harness-formatver-spawn-rules-minor-too-old-accept"], rejectingFixtureIds: ["harness-formatver-spawn-rules-minor-too-old-reject"] },
  { ruleKey: "FORMATVER:258", acceptingFixtureIds: ["harness-formatver-spawn-rules-higher-minor-accept"], rejectingFixtureIds: ["harness-formatver-spawn-rules-higher-minor-reject"] },
  { ruleKey: "FORMATVER:262", acceptingFixtureIds: ["harness-formatver-spawn-rules-higher-patch-accept"], rejectingFixtureIds: ["harness-formatver-spawn-rules-higher-patch-reject"] },
  { ruleKey: "FORMATVER:270", acceptingFixtureIds: ["harness-formatver-attachable-no-fv-accept"], rejectingFixtureIds: ["harness-formatver-attachable-no-fv-reject"] },
  { ruleKey: "FORMATVER:272", acceptingFixtureIds: ["harness-formatver-attachable-lower-major-accept"], rejectingFixtureIds: ["harness-formatver-attachable-lower-major-reject"] },
  { ruleKey: "FORMATVER:276", acceptingFixtureIds: ["harness-formatver-attachable-minor-too-old-accept"], rejectingFixtureIds: ["harness-formatver-attachable-minor-too-old-reject"] },
  { ruleKey: "FORMATVER:290", acceptingFixtureIds: ["harness-formatver-entity-type-resource-malformed-fv-accept"], rejectingFixtureIds: ["harness-formatver-entity-type-resource-malformed-fv-reject"] },
  { ruleKey: "FORMATVER:292", acceptingFixtureIds: ["harness-formatver-entity-type-resource-lower-major-accept"], rejectingFixtureIds: ["harness-formatver-entity-type-resource-lower-major-reject"] },
  { ruleKey: "FORMATVER:294", acceptingFixtureIds: ["harness-formatver-entity-type-resource-higher-major-accept"], rejectingFixtureIds: ["harness-formatver-entity-type-resource-higher-major-reject"] },
  { ruleKey: "FORMATVER:296", acceptingFixtureIds: ["harness-formatver-entity-type-resource-minor-too-old-accept"], rejectingFixtureIds: ["harness-formatver-entity-type-resource-minor-too-old-reject"] },
  { ruleKey: "FORMATVER:298", acceptingFixtureIds: ["harness-formatver-entity-type-resource-higher-minor-accept"], rejectingFixtureIds: ["harness-formatver-entity-type-resource-higher-minor-reject"] },
  { ruleKey: "FORMATVER:300", acceptingFixtureIds: ["harness-formatver-entity-type-resource-lower-patch-accept"], rejectingFixtureIds: ["harness-formatver-entity-type-resource-lower-patch-reject"] },
  { ruleKey: "FORMATVER:302", acceptingFixtureIds: ["harness-formatver-entity-type-resource-higher-patch-accept"], rejectingFixtureIds: ["harness-formatver-entity-type-resource-higher-patch-reject"] },
  { ruleKey: "FORMATVER:310", acceptingFixtureIds: ["harness-formatver-fog-resource-no-fv-accept"], rejectingFixtureIds: ["harness-formatver-fog-resource-no-fv-reject"] },
  { ruleKey: "FORMATVER:312", acceptingFixtureIds: ["harness-formatver-fog-resource-lower-major-accept"], rejectingFixtureIds: ["harness-formatver-fog-resource-lower-major-reject"] },
  { ruleKey: "FORMATVER:314", acceptingFixtureIds: ["harness-formatver-fog-resource-higher-major-accept"], rejectingFixtureIds: ["harness-formatver-fog-resource-higher-major-reject"] },
  { ruleKey: "FORMATVER:316", acceptingFixtureIds: ["harness-formatver-fog-resource-minor-too-old-accept"], rejectingFixtureIds: ["harness-formatver-fog-resource-minor-too-old-reject"] },
  { ruleKey: "FORMATVER:318", acceptingFixtureIds: ["harness-formatver-fog-resource-higher-minor-accept"], rejectingFixtureIds: ["harness-formatver-fog-resource-higher-minor-reject"] },
  { ruleKey: "FORMATVER:320", acceptingFixtureIds: ["harness-formatver-fog-resource-lower-patch-accept"], rejectingFixtureIds: ["harness-formatver-fog-resource-lower-patch-reject"] },
  { ruleKey: "FORMATVER:322", acceptingFixtureIds: ["harness-formatver-fog-resource-higher-patch-accept"], rejectingFixtureIds: ["harness-formatver-fog-resource-higher-patch-reject"] },
  { ruleKey: "MINENGINEVER:100", acceptingFixtureIds: ["harness-minenginever-bp-missing-accept"], rejectingFixtureIds: ["harness-minenginever-bp-missing-reject"] },
  { ruleKey: "MINENGINEVER:110", acceptingFixtureIds: ["harness-minenginever-bp-major-low-accept"], rejectingFixtureIds: ["harness-minenginever-bp-major-low-reject"] },
  { ruleKey: "MINENGINEVER:111", acceptingFixtureIds: ["harness-minenginever-bp-major-high-accept"], rejectingFixtureIds: ["harness-minenginever-bp-major-high-reject"] },
  { ruleKey: "MINENGINEVER:121", acceptingFixtureIds: ["harness-minenginever-bp-minor-high-accept"], rejectingFixtureIds: ["harness-minenginever-bp-minor-high-reject"] },
  { ruleKey: "MINENGINEVER:180", acceptingFixtureIds: ["harness-minenginever-no-manifest-accept"], rejectingFixtureIds: ["harness-minenginever-no-manifest-reject"] },
  { ruleKey: "MINENGINEVER:200", acceptingFixtureIds: ["harness-minenginever-rp-missing-accept"], rejectingFixtureIds: ["harness-minenginever-rp-missing-reject"] },
  { ruleKey: "MINENGINEVER:210", acceptingFixtureIds: ["harness-minenginever-rp-major-low-accept"], rejectingFixtureIds: ["harness-minenginever-rp-major-low-reject"] },
  { ruleKey: "MINENGINEVER:211", acceptingFixtureIds: ["harness-minenginever-rp-major-high-accept"], rejectingFixtureIds: ["harness-minenginever-rp-major-high-reject"] },
  { ruleKey: "MINENGINEVER:220", acceptingFixtureIds: ["harness-minenginever-rp-minor-low-accept"], rejectingFixtureIds: ["harness-minenginever-rp-minor-low-reject"] },
  { ruleKey: "MINENGINEVER:221", acceptingFixtureIds: ["harness-minenginever-rp-minor-high-accept"], rejectingFixtureIds: ["harness-minenginever-rp-minor-high-reject"] },
  { ruleKey: "BASEGAMEVER:100", acceptingFixtureIds: ["harness-basegamever-missing-accept"], rejectingFixtureIds: ["harness-basegamever-missing-reject"] },
  { ruleKey: "BASEGAMEVER:110", acceptingFixtureIds: ["harness-basegamever-major-low-accept"], rejectingFixtureIds: ["harness-basegamever-major-low-reject"] },
  { ruleKey: "BASEGAMEVER:111", acceptingFixtureIds: ["harness-basegamever-major-high-accept"], rejectingFixtureIds: ["harness-basegamever-major-high-reject"] },
  { ruleKey: "BASEGAMEVER:120", acceptingFixtureIds: ["harness-basegamever-minor-low-accept"], rejectingFixtureIds: ["harness-basegamever-minor-low-reject"] },
  { ruleKey: "BASEGAMEVER:121", acceptingFixtureIds: ["harness-basegamever-minor-high-accept"], rejectingFixtureIds: ["harness-basegamever-minor-high-reject"] },
  { ruleKey: "BASEGAMEVER:130", acceptingFixtureIds: ["harness-basegamever-patch-low-accept"], rejectingFixtureIds: ["harness-basegamever-patch-low-reject"] },
  { ruleKey: "BASEGAMEVER:131", acceptingFixtureIds: ["harness-basegamever-patch-high-accept"], rejectingFixtureIds: ["harness-basegamever-patch-high-reject"] },
  { ruleKey: "TEXTUREIMAGE:402", acceptingFixtureIds: ["harness-textureimage-loose-budget-accept"], rejectingFixtureIds: ["harness-textureimage-loose-budget-reject"] },
  { ruleKey: "TEXTUREIMAGE:403", acceptingFixtureIds: ["harness-textureimage-total-budget-accept"], rejectingFixtureIds: ["harness-textureimage-total-budget-reject"] },
  { ruleKey: "TEXTUREIMAGE:405", acceptingFixtureIds: ["harness-textureimage-atlas-individual-accept"], rejectingFixtureIds: ["harness-textureimage-atlas-individual-reject"] },
  { ruleKey: "TEXTUREIMAGE:406", acceptingFixtureIds: ["harness-textureimage-atlas-total-warn-accept"], rejectingFixtureIds: ["harness-textureimage-atlas-total-warn-reject"] },
  { ruleKey: "TEXTUREIMAGE:407", acceptingFixtureIds: ["harness-textureimage-atlas-total-error-accept"], rejectingFixtureIds: ["harness-textureimage-atlas-total-error-reject"] },
  { ruleKey: "TEXTUREIMAGE:408", acceptingFixtureIds: ["harness-textureimage-unreadable-image-accept"], rejectingFixtureIds: ["harness-textureimage-unreadable-image-reject"] },
  { ruleKey: "TEXTUREIMAGE:409", acceptingFixtureIds: ["harness-textureimage-tier-ordering-accept"], rejectingFixtureIds: ["harness-textureimage-tier-ordering-reject"] },
  { ruleKey: "TEXTUREIMAGE:410", acceptingFixtureIds: ["harness-textureimage-vibrant-visuals-tiering-accept"], rejectingFixtureIds: ["harness-textureimage-vibrant-visuals-tiering-reject"] },
  { ruleKey: "TEXTUREIMAGE:411", acceptingFixtureIds: ["harness-textureimage-four-mib-mip-accept"], rejectingFixtureIds: ["harness-textureimage-four-mib-mip-reject"] },
  { ruleKey: "TEXTUREIMAGE:420", acceptingFixtureIds: ["harness-textureimage-tier-0-targeted-accept"], rejectingFixtureIds: ["harness-textureimage-tier-0-targeted-reject"] },
  { ruleKey: "TEXTUREIMAGE:421", acceptingFixtureIds: ["harness-textureimage-tier-1-targeted-accept"], rejectingFixtureIds: ["harness-textureimage-tier-1-targeted-reject"] },
  { ruleKey: "TEXTUREIMAGE:422", acceptingFixtureIds: ["harness-textureimage-tier-2-targeted-accept"], rejectingFixtureIds: ["harness-textureimage-tier-2-targeted-reject"] },
  { ruleKey: "TEXTUREIMAGE:423", acceptingFixtureIds: ["harness-textureimage-tier-3-targeted-accept"], rejectingFixtureIds: ["harness-textureimage-tier-3-targeted-reject"] },
  { ruleKey: "TEXTUREIMAGE:424", acceptingFixtureIds: ["harness-textureimage-tier-4-targeted-accept"], rejectingFixtureIds: ["harness-textureimage-tier-4-targeted-reject"] },
  { ruleKey: "TEXTUREIMAGE:425", acceptingFixtureIds: ["harness-textureimage-tier-5-targeted-accept"], rejectingFixtureIds: ["harness-textureimage-tier-5-targeted-reject"] },
  { ruleKey: "TEXTUREIMAGE:440", acceptingFixtureIds: ["harness-textureimage-tier-0-budget-accept"], rejectingFixtureIds: ["harness-textureimage-tier-0-budget-reject"] },
  { ruleKey: "TEXTUREIMAGE:441", acceptingFixtureIds: ["harness-textureimage-tier-1-budget-accept"], rejectingFixtureIds: ["harness-textureimage-tier-1-budget-reject"] },
  { ruleKey: "TEXTUREIMAGE:442", acceptingFixtureIds: ["harness-textureimage-tier-2-budget-accept"], rejectingFixtureIds: ["harness-textureimage-tier-2-budget-reject"] },
  { ruleKey: "TEXTUREIMAGE:443", acceptingFixtureIds: ["harness-textureimage-tier-3-budget-accept"], rejectingFixtureIds: ["harness-textureimage-tier-3-budget-reject"] },
  { ruleKey: "TEXTUREIMAGE:444", acceptingFixtureIds: ["harness-textureimage-tier-4-budget-accept"], rejectingFixtureIds: ["harness-textureimage-tier-4-budget-reject"] },
  { ruleKey: "TEXTUREIMAGE:445", acceptingFixtureIds: ["harness-textureimage-tier-5-budget-accept"], rejectingFixtureIds: ["harness-textureimage-tier-5-budget-reject"] },
  { ruleKey: "TEXTUREIMAGE:460", acceptingFixtureIds: ["harness-textureimage-vanilla-override-gap-accept"], rejectingFixtureIds: ["harness-textureimage-vanilla-override-gap-reject"] },
  { ruleKey: "TEXTUREIMAGE:461", acceptingFixtureIds: ["harness-textureimage-texture-pack-coverage-accept"], rejectingFixtureIds: ["harness-textureimage-texture-pack-coverage-reject"] },
  { ruleKey: "TEXTUREIMAGE:462", acceptingFixtureIds: ["harness-textureimage-mashup-coverage-accept"], rejectingFixtureIds: ["harness-textureimage-mashup-coverage-reject"] },
  { ruleKey: "TEXTUREIMAGE:463", acceptingFixtureIds: ["harness-textureimage-base-content-unused-accept"], rejectingFixtureIds: ["harness-textureimage-base-content-unused-reject"] },
  { ruleKey: "TEXTUREIMAGE:464", acceptingFixtureIds: ["harness-textureimage-tier-one-mers-accept"], rejectingFixtureIds: ["harness-textureimage-tier-one-mers-reject"] },
  { ruleKey: "TEXTURELIST:101", acceptingFixtureIds: ["harness-texturelist-unlisted-accept"], rejectingFixtureIds: ["harness-texturelist-unlisted-reject"] },
  { ruleKey: "TEXTURELIST:102", acceptingFixtureIds: ["harness-texturelist-set-image-accept"], rejectingFixtureIds: ["harness-texturelist-set-image-reject"] },
  { ruleKey: "TEXTURE:100", acceptingFixtureIds: ["harness-texture-handles-accept"], rejectingFixtureIds: ["harness-texture-handles-reject"] },
  { ruleKey: "CSPJ:101", acceptingFixtureIds: ["harness-cspj-skins-json-missing-accept"], rejectingFixtureIds: ["harness-cspj-skins-json-missing-reject"] },
  { ruleKey: "CSPJ:102", acceptingFixtureIds: ["harness-cspj-skins-json-schema-accept"], rejectingFixtureIds: ["harness-cspj-skins-json-schema-reject"] },
  { ruleKey: "CSPJ:103", acceptingFixtureIds: ["harness-cspj-loc-name-mismatch-accept"], rejectingFixtureIds: ["harness-cspj-loc-name-mismatch-reject"] },
  { ruleKey: "CSPJ:104", acceptingFixtureIds: ["harness-cspj-free-skins-accept"], rejectingFixtureIds: ["harness-cspj-free-skins-reject"] },
  { ruleKey: "CSPJ:105", acceptingFixtureIds: ["harness-cspj-duplicate-texture-accept"], rejectingFixtureIds: ["harness-cspj-duplicate-texture-reject"] },
  { ruleKey: "CSPJ:106", acceptingFixtureIds: ["harness-cspj-cape-accept"], rejectingFixtureIds: ["harness-cspj-cape-reject"] },
  { ruleKey: "CSPJ:107", acceptingFixtureIds: ["harness-cspj-texture-size-accept"], rejectingFixtureIds: ["harness-cspj-texture-size-reject"] },
  { ruleKey: "CSPJ:108", acceptingFixtureIds: ["harness-cspj-creator-property-accept"], rejectingFixtureIds: ["harness-cspj-creator-property-reject"] },
  { ruleKey: "CSPJ:109", acceptingFixtureIds: ["harness-cspj-unreadable-texture-accept"], rejectingFixtureIds: ["harness-cspj-unreadable-texture-reject"] },
  { ruleKey: "CSPJ:110", acceptingFixtureIds: ["harness-cspj-orphaned-texture-accept"], rejectingFixtureIds: ["harness-cspj-orphaned-texture-reject"] },
  { ruleKey: "CSPJ:111", acceptingFixtureIds: ["harness-cspj-missing-loc-key-accept"], rejectingFixtureIds: ["harness-cspj-missing-loc-key-reject"] },
  { ruleKey: "CSPJ:112", acceptingFixtureIds: ["harness-cspj-extra-loc-key-accept"], rejectingFixtureIds: ["harness-cspj-extra-loc-key-reject"] },
  { ruleKey: "CSPJ:113", acceptingFixtureIds: ["harness-cspj-loc-key-spacing-accept"], rejectingFixtureIds: ["harness-cspj-loc-key-spacing-reject"] },
  { ruleKey: "CSPJ:114", acceptingFixtureIds: ["harness-cspj-purchase-type-accept", "harness-multipack-cspj-accept"], rejectingFixtureIds: ["harness-cspj-purchase-type-reject", "harness-multipack-cspj-reject"] },
  { ruleKey: "CSPJ:115", acceptingFixtureIds: ["harness-cspj-model-target-accept"], rejectingFixtureIds: ["harness-cspj-model-target-reject"] },
  { ruleKey: "CSPJ:116", acceptingFixtureIds: ["harness-cspj-skin-count-accept"], rejectingFixtureIds: ["harness-cspj-skin-count-reject"] },
  { ruleKey: "WORLDDATA:102", acceptingFixtureIds: ["harness-worlddata-command-accept"], rejectingFixtureIds: ["harness-worlddata-command-reject"] },
  { ruleKey: "WORLDDATA:112", acceptingFixtureIds: ["harness-worlddata-impacting-accept"], rejectingFixtureIds: ["harness-worlddata-impacting-reject"] },
  { ruleKey: "WORLDDATA:212", acceptingFixtureIds: ["harness-worlddata-command-version-accept"], rejectingFixtureIds: ["harness-worlddata-command-version-reject"] },
  { ruleKey: "WORLDDATA:400", acceptingFixtureIds: ["harness-worlddata-world-error-accept"], rejectingFixtureIds: ["harness-worlddata-world-error-reject"] },
  { ruleKey: "CDWORLDDATA:101", acceptingFixtureIds: ["harness-cdworlddata-name-table-accept"], rejectingFixtureIds: ["harness-cdworlddata-name-table-reject"] },
  { ruleKey: "CDWORLDDATA:102", acceptingFixtureIds: ["harness-cdworlddata-vanilla-chunks-accept"], rejectingFixtureIds: ["harness-cdworlddata-vanilla-chunks-reject"] },
  { ruleKey: "CDWORLDDATA:103", acceptingFixtureIds: ["harness-cdworlddata-unclaimed-accept"], rejectingFixtureIds: ["harness-cdworlddata-unclaimed-reject"] },
  { ruleKey: "PACKSIZE:401", acceptingFixtureIds: ["harness-packsize-addon-accept"], rejectingFixtureIds: ["harness-packsize-addon-reject"] },
  { ruleKey: "PACKSIZE:402", acceptingFixtureIds: ["harness-packsize-package-accept"], rejectingFixtureIds: ["harness-packsize-package-reject"] },
  { ruleKey: "PACKSIZE:410", acceptingFixtureIds: ["harness-packsize-container-accept"], rejectingFixtureIds: ["harness-packsize-container-reject"] },
  { ruleKey: "PACKFILECOUNT:401", acceptingFixtureIds: ["harness-packfilecount-limit-accept"], rejectingFixtureIds: ["harness-packfilecount-limit-reject"] },
  { ruleKey: "PACKFILECOUNT:402", acceptingFixtureIds: ["harness-packfilecount-depth-accept"], rejectingFixtureIds: ["harness-packfilecount-depth-reject"] },
  // Language catalog and sound definition families (LanguageSoundRulePairs.ts).
  { ruleKey: "LANGFILES:101", acceptingFixtureIds: ["harness-langfiles-catalog-present-accept"], rejectingFixtureIds: ["harness-langfiles-catalog-present-reject"] },
  { ruleKey: "LANGFILES:102", acceptingFixtureIds: ["harness-langfiles-primary-lang-accept"], rejectingFixtureIds: ["harness-langfiles-primary-lang-reject"] },
  { ruleKey: "LANGFILES:103", acceptingFixtureIds: ["harness-langfiles-catalog-parses-accept"], rejectingFixtureIds: ["harness-langfiles-catalog-parses-reject"] },
  { ruleKey: "LANGFILES:104", acceptingFixtureIds: ["harness-langfiles-lang-file-present-accept"], rejectingFixtureIds: ["harness-langfiles-lang-file-present-reject"] },
  { ruleKey: "LANGFILES:105", acceptingFixtureIds: ["harness-langfiles-catalog-entry-accept"], rejectingFixtureIds: ["harness-langfiles-catalog-entry-reject"] },
  { ruleKey: "SNDSDEF:101", acceptingFixtureIds: ["harness-sndsdef-single-catalog-accept"], rejectingFixtureIds: ["harness-sndsdef-single-catalog-reject"] },
  { ruleKey: "SNDSDEF:102", acceptingFixtureIds: ["harness-sndsdef-catalog-schema-accept"], rejectingFixtureIds: ["harness-sndsdef-catalog-schema-reject"] },
  { ruleKey: "SNDSDEF:103", acceptingFixtureIds: ["harness-sndsdef-catalog-json-accept"], rejectingFixtureIds: ["harness-sndsdef-catalog-json-reject"] },
  { ruleKey: "SNDSDEF:104", acceptingFixtureIds: ["harness-sndsdef-catalog-in-pack-accept"], rejectingFixtureIds: ["harness-sndsdef-catalog-in-pack-reject"] },
  // Pack and world reference families (PackReferenceRulePairs.ts).
  { ruleKey: "RPDEPENDS:102", acceptingFixtureIds: ["harness-rpdepends-missing-dependency-accept"], rejectingFixtureIds: ["harness-rpdepends-missing-dependency-reject"] },
  { ruleKey: "RPDEPENDS:103", acceptingFixtureIds: ["harness-rpdepends-processing-accept"], rejectingFixtureIds: ["harness-rpdepends-processing-reject"] },
  { ruleKey: "WPACKREFS:201", acceptingFixtureIds: ["harness-wpackrefs-invalid-json-accept"], rejectingFixtureIds: ["harness-wpackrefs-invalid-json-reject"] },
  { ruleKey: "WPACKREFS:203", acceptingFixtureIds: ["harness-wpackrefs-invalid-pack-id-accept"], rejectingFixtureIds: ["harness-wpackrefs-invalid-pack-id-reject"] },
  { ruleKey: "WPACKREFS:205", acceptingFixtureIds: ["harness-wpackrefs-invalid-version-accept"], rejectingFixtureIds: ["harness-wpackrefs-invalid-version-reject"] },
  { ruleKey: "WPACKREFS:206", acceptingFixtureIds: ["harness-wpackrefs-unresolved-reference-accept"], rejectingFixtureIds: ["harness-wpackrefs-unresolved-reference-reject"] },
  { ruleKey: "WPACKREFS:207", acceptingFixtureIds: ["harness-wpackrefs-processing-accept"], rejectingFixtureIds: ["harness-wpackrefs-processing-reject"] },
  // Resource-asset families: geometry, particles, and icons (ResourceAssetRulePairs.ts).
  { ruleKey: "GEOFMT:101", acceptingFixtureIds: ["harness-geofmt-poly-mesh-accept"], rejectingFixtureIds: ["harness-geofmt-poly-mesh-reject"] },
  { ruleKey: "GEOMETRY:501", acceptingFixtureIds: ["harness-geometry-block-cubes-accept"], rejectingFixtureIds: ["harness-geometry-block-cubes-reject"] },
  { ruleKey: "CPARTI:101", acceptingFixtureIds: ["harness-cparti-readable-accept"], rejectingFixtureIds: ["harness-cparti-readable-reject"] },
  { ruleKey: "CPARTI:102", acceptingFixtureIds: ["harness-cparti-format-version-accept"], rejectingFixtureIds: ["harness-cparti-format-version-reject"] },
  { ruleKey: "CPARTI:103", acceptingFixtureIds: ["harness-cparti-identifier-accept"], rejectingFixtureIds: ["harness-cparti-identifier-reject"] },
  { ruleKey: "CPACKICON:101", acceptingFixtureIds: ["harness-cpackicon-present-accept"], rejectingFixtureIds: ["harness-cpackicon-present-reject"] },
  { ruleKey: "CPACKICON:102", acceptingFixtureIds: ["harness-cpackicon-single-accept"], rejectingFixtureIds: ["harness-cpackicon-single-reject"] },
  { ruleKey: "CPACKICON:103", acceptingFixtureIds: ["harness-cpackicon-image-accept"], rejectingFixtureIds: ["harness-cpackicon-image-reject"] },
  { ruleKey: "CPACKICON:104", acceptingFixtureIds: ["harness-cpackicon-size-accept"], rejectingFixtureIds: ["harness-cpackicon-size-reject"] },
  { ruleKey: "CWI:101", acceptingFixtureIds: ["harness-cwi-icon-present-accept"], rejectingFixtureIds: ["harness-cwi-icon-present-reject"] },
  { ruleKey: "CWI:102", acceptingFixtureIds: ["harness-cwi-single-icon-accept"], rejectingFixtureIds: ["harness-cwi-single-icon-reject"] },
  { ruleKey: "CWI:103", acceptingFixtureIds: ["harness-cwi-icon-image-accept"], rejectingFixtureIds: ["harness-cwi-icon-image-reject"] },
  { ruleKey: "CWI:104", acceptingFixtureIds: ["harness-cwi-icon-size-accept"], rejectingFixtureIds: ["harness-cwi-icon-size-reject"] },
  // Generic item and file families (ItemFileRulePairs.ts; UNKJSON:101 and
  // NOBOM:101 reference the original representative pairs in
  // ValidationRuleHarnessPairs.ts).
  { ruleKey: "UNKJSON:101", acceptingFixtureIds: ["harness-unkjson-recognized"], rejectingFixtureIds: ["harness-unkjson-unknown"] },
  { ruleKey: "UNLINK:191", acceptingFixtureIds: ["harness-unlink-unused-texture-accept"], rejectingFixtureIds: ["harness-unlink-unused-texture-reject"] },
  { ruleKey: "UNLINK:205", acceptingFixtureIds: ["harness-unlink-vanilla-loot-accept"], rejectingFixtureIds: ["harness-unlink-vanilla-loot-reject"] },
  { ruleKey: "UNLINK:324", acceptingFixtureIds: ["harness-unlink-loot-missing-accept"], rejectingFixtureIds: ["harness-unlink-loot-missing-reject"] },
  { ruleKey: "VALFILE:102", acceptingFixtureIds: ["harness-valfile-compliant-accept"], rejectingFixtureIds: ["harness-valfile-compliant-reject"] },
  { ruleKey: "VALFILE:103", acceptingFixtureIds: ["harness-valfile-empty-accept"], rejectingFixtureIds: ["harness-valfile-empty-reject"] },
  { ruleKey: "NOBOM:101", acceptingFixtureIds: ["harness-nobom-clean"], rejectingFixtureIds: ["harness-nobom-bom"] },
  { ruleKey: "PATHLENGTH:102", acceptingFixtureIds: ["harness-pathlength-segments-accept"], rejectingFixtureIds: ["harness-pathlength-segments-reject"] },
  { ruleKey: "PATHLENGTH:103", acceptingFixtureIds: ["harness-pathlength-length-accept"], rejectingFixtureIds: ["harness-pathlength-length-reject"] },
  { ruleKey: "PATHLENGTH:104", acceptingFixtureIds: ["harness-pathlength-casing-accept"], rejectingFixtureIds: ["harness-pathlength-casing-reject"] },
  // Schema validation family (JSON, COMJSON, JSONF).
  { ruleKey: "JSON:1", acceptingFixtureIds: ["harness-json-parse-accept"], rejectingFixtureIds: ["harness-json-parse-reject"] },
  { ruleKey: jsonLootStructureRuleKey, acceptingFixtureIds: ["harness-json-structure-accept"], rejectingFixtureIds: ["harness-json-structure-reject"] },
  { ruleKey: "COMJSON:1", acceptingFixtureIds: ["harness-comjson-parse-accept"], rejectingFixtureIds: ["harness-comjson-parse-reject"] },
  { ruleKey: comJsonLootStructureRuleKey, acceptingFixtureIds: ["harness-comjson-structure-accept"], rejectingFixtureIds: ["harness-comjson-structure-reject"] },
  { ruleKey: "JSONF:101", acceptingFixtureIds: ["harness-jsonf-scalar-string-accept"], rejectingFixtureIds: ["harness-jsonf-scalar-string-reject"] },
  { ruleKey: "JSONF:102", acceptingFixtureIds: ["harness-jsonf-scalar-boolean-accept"], rejectingFixtureIds: ["harness-jsonf-scalar-boolean-reject"] },
  { ruleKey: "JSONF:103", acceptingFixtureIds: ["harness-jsonf-scalar-number-accept"], rejectingFixtureIds: ["harness-jsonf-scalar-number-reject"] },
  { ruleKey: "JSONF:110", acceptingFixtureIds: ["harness-jsonf-type-accept"], rejectingFixtureIds: ["harness-jsonf-type-reject"] },
  { ruleKey: "JSONF:111", acceptingFixtureIds: ["harness-jsonf-minimum-accept"], rejectingFixtureIds: ["harness-jsonf-minimum-reject"] },
  { ruleKey: "JSONF:112", acceptingFixtureIds: ["harness-jsonf-maximum-accept"], rejectingFixtureIds: ["harness-jsonf-maximum-reject"] },
  { ruleKey: "JSONF:113", acceptingFixtureIds: ["harness-jsonf-string-length-accept"], rejectingFixtureIds: ["harness-jsonf-string-length-reject"] },
  { ruleKey: "JSONF:115", acceptingFixtureIds: ["harness-jsonf-choices-accept"], rejectingFixtureIds: ["harness-jsonf-choices-reject"] },
  { ruleKey: "JSONF:116", acceptingFixtureIds: ["harness-jsonf-pattern-accept"], rejectingFixtureIds: ["harness-jsonf-pattern-reject"] },
  { ruleKey: "JSONF:118", acceptingFixtureIds: ["harness-jsonf-point-size-accept"], rejectingFixtureIds: ["harness-jsonf-point-size-reject"] },
  { ruleKey: "JSONF:121", acceptingFixtureIds: ["harness-jsonf-required-accept"], rejectingFixtureIds: ["harness-jsonf-required-reject"] },
  { ruleKey: "JSONF:401", acceptingFixtureIds: ["harness-jsonf-parse-accept"], rejectingFixtureIds: ["harness-jsonf-parse-reject"] },
  // Policy and project-integrity families (PolicyIntegrityRulePairs.ts).
  { ruleKey: "CBFG:102", acceptingFixtureIds: ["harness-cbfg-parse-accept"], rejectingFixtureIds: ["harness-cbfg-parse-reject"] },
  { ruleKey: "CBFG:103", acceptingFixtureIds: ["harness-cbfg-beta-accept"], rejectingFixtureIds: ["harness-cbfg-beta-reject"] },
  { ruleKey: "EXPFLAG:101", acceptingFixtureIds: ["harness-expflag-flag-accept"], rejectingFixtureIds: ["harness-expflag-flag-reject"] },
  { ruleKey: "EXPFLAG:102", acceptingFixtureIds: ["harness-expflag-leveldat-accept"], rejectingFixtureIds: ["harness-expflag-leveldat-reject"] },
  { ruleKey: "CHECKFEATUREDEPRECATION:101", acceptingFixtureIds: ["harness-featuredep-block-accept"], rejectingFixtureIds: ["harness-featuredep-block-reject"] },
  { ruleKey: "CHECKFEATUREDEPRECATION:102", acceptingFixtureIds: ["harness-featuredep-terrain-accept"], rejectingFixtureIds: ["harness-featuredep-terrain-reject"] },
  { ruleKey: "CHECKFEATUREDEPRECATION:103", acceptingFixtureIds: ["harness-featuredep-texture-accept"], rejectingFixtureIds: ["harness-featuredep-texture-reject"] },
  { ruleKey: "CHECKFEATUREDEPRECATION:104", acceptingFixtureIds: ["harness-featuredep-parse-accept"], rejectingFixtureIds: ["harness-featuredep-parse-reject"] },
  { ruleKey: "FORBFILE:102", acceptingFixtureIds: ["harness-forbfile-ext-accept"], rejectingFixtureIds: ["harness-forbfile-ext-reject"] },
  { ruleKey: "FORBFILE:103", acceptingFixtureIds: ["harness-forbfile-name-accept"], rejectingFixtureIds: ["harness-forbfile-name-reject"] },
  { ruleKey: "FORBFILE:104", acceptingFixtureIds: ["harness-forbfile-char-accept"], rejectingFixtureIds: ["harness-forbfile-char-reject"] },
  { ruleKey: "VANDUPES:101", acceptingFixtureIds: ["harness-vandupes-complete-accept"], rejectingFixtureIds: ["harness-vandupes-complete-reject"] },
  { ruleKey: "VANDUPES:102", acceptingFixtureIds: ["harness-vandupes-partial-accept"], rejectingFixtureIds: ["harness-vandupes-partial-reject"] },
  { ruleKey: "VANPRO:101", acceptingFixtureIds: ["harness-vanpro-override-accept"], rejectingFixtureIds: ["harness-vanpro-override-reject"] },
  { ruleKey: "PRJINT:101", acceptingFixtureIds: ["harness-prjint-orphan-accept"], rejectingFixtureIds: ["harness-prjint-orphan-reject"] },
  { ruleKey: "PRJINT:102", acceptingFixtureIds: ["harness-prjint-manifest-accept"], rejectingFixtureIds: ["harness-prjint-manifest-reject"] },
  // Manager-backed families: script modules, blocks catalog, and the entity/
  // item type managers (ScriptModuleRulePairs.ts, BlocksCatalogRulePairs.ts,
  // EntityTypeRulePairs.ts, ItemTypeRulePairs.ts). VSCODEFILE has no rules at
  // a validation severity (see VsCodeFileManager.validationRules).
  { ruleKey: "SCRIPTMODULE:110", acceptingFixtureIds: ["harness-scriptmodule-package-json-registration-accept"], rejectingFixtureIds: ["harness-scriptmodule-package-json-registration-reject"] },
  { ruleKey: "SCRIPTMODULE:111", acceptingFixtureIds: ["harness-scriptmodule-npm-registration-accept"], rejectingFixtureIds: ["harness-scriptmodule-npm-registration-reject"] },
  { ruleKey: "SCRIPTMODULE:114", acceptingFixtureIds: ["harness-scriptmodule-beta-version-accept"], rejectingFixtureIds: ["harness-scriptmodule-beta-version-reject"] },
  { ruleKey: "BLOCKSCAT:100", acceptingFixtureIds: ["harness-blockscat-unused-resource-accept"], rejectingFixtureIds: ["harness-blockscat-unused-resource-reject"] },
  { ruleKey: "BLOCKSCAT:102", acceptingFixtureIds: ["harness-blockscat-vanilla-override-accept"], rejectingFixtureIds: ["harness-blockscat-vanilla-override-reject"] },
  { ruleKey: "ENTITYTYPE:100", acceptingFixtureIds: ["harness-entitytype-no-fv-accept"], rejectingFixtureIds: ["harness-entitytype-no-fv-reject"] },
  { ruleKey: "ENTITYTYPE:110", acceptingFixtureIds: ["harness-entitytype-lower-major-accept"], rejectingFixtureIds: ["harness-entitytype-lower-major-reject"] },
  { ruleKey: "ENTITYTYPE:111", acceptingFixtureIds: ["harness-entitytype-higher-major-accept"], rejectingFixtureIds: ["harness-entitytype-higher-major-reject"] },
  { ruleKey: "ENTITYTYPE:120", acceptingFixtureIds: ["harness-entitytype-lower-minor-accept"], rejectingFixtureIds: ["harness-entitytype-lower-minor-reject"] },
  { ruleKey: "ENTITYTYPE:121", acceptingFixtureIds: ["harness-entitytype-higher-minor-accept"], rejectingFixtureIds: ["harness-entitytype-higher-minor-reject"] },
  { ruleKey: "ENTITYTYPE:130", acceptingFixtureIds: ["harness-entitytype-lower-patch-accept"], rejectingFixtureIds: ["harness-entitytype-lower-patch-reject"] },
  { ruleKey: "ENTITYTYPE:131", acceptingFixtureIds: ["harness-entitytype-higher-patch-accept"], rejectingFixtureIds: ["harness-entitytype-higher-patch-reject"] },
  { ruleKey: "ITEMTYPE:100", acceptingFixtureIds: ["harness-itemtype-no-fv-accept"], rejectingFixtureIds: ["harness-itemtype-no-fv-reject"] },
  { ruleKey: "ITEMTYPE:110", acceptingFixtureIds: ["harness-itemtype-lower-major-accept"], rejectingFixtureIds: ["harness-itemtype-lower-major-reject"] },
  { ruleKey: "ITEMTYPE:111", acceptingFixtureIds: ["harness-itemtype-higher-major-accept"], rejectingFixtureIds: ["harness-itemtype-higher-major-reject"] },
  { ruleKey: "ITEMTYPE:120", acceptingFixtureIds: ["harness-itemtype-lower-minor-accept"], rejectingFixtureIds: ["harness-itemtype-lower-minor-reject"] },
  { ruleKey: "ITEMTYPE:121", acceptingFixtureIds: ["harness-itemtype-higher-minor-accept"], rejectingFixtureIds: ["harness-itemtype-higher-minor-reject"] },
  { ruleKey: "ITEMTYPE:130", acceptingFixtureIds: ["harness-itemtype-lower-patch-accept"], rejectingFixtureIds: ["harness-itemtype-lower-patch-reject"] },
  { ruleKey: "ITEMTYPE:131", acceptingFixtureIds: ["harness-itemtype-higher-patch-accept"], rejectingFixtureIds: ["harness-itemtype-higher-patch-reject"] },
] as const;

const explicitHarnessFixtureIds = new Set(ExplicitValidationFixtures.map((fixture) => fixture.id));

/** Fixture registry entries derived from the harness coverage table. */
const harnessFixtureDefinitions: ValidationFixtureDefinition[] = [];

for (const coverage of HarnessCoverage) {
  const sides: [readonly string[], string][] = [
    [coverage.acceptingFixtureIds, "accepting"],
    [coverage.rejectingFixtureIds, "rejecting"],
  ];

  for (const [fixtureIds, side] of sides) {
    for (const fixtureId of fixtureIds) {
      if (explicitHarnessFixtureIds.has(fixtureId)) {
        continue;
      }

      explicitHarnessFixtureIds.add(fixtureId);
      harnessFixtureDefinitions.push({
        id: fixtureId,
        kind: "fullPipelineE2E",
        contentPath: "app/src/test/ValidationRuleHarnessPairs.ts",
        declaredBy: "app/src/test/ValidationRuleHarnessTest.ts",
        description: `Generated ${side} fixture for ${coverage.ruleKey} in the paired validation-rule harness.`,
      });
    }
  }
}

/** Every registered fixture: the explicitly-described ones plus the harness-derived ones. */
export const ValidationFixtures: readonly ValidationFixtureDefinition[] = [
  ...ExplicitValidationFixtures,
  ...harnessFixtureDefinitions,
];

export const ValidationRuleCoverageDeclarations: readonly ValidationRuleCoverageReference[] = [
  {
    // PlatformVersionValidationTest: "flags manifest format_version < 2 as
    // error (CHKMANIF)" / "does not flag manifest format_version 2 as error".
    // ValidationRuleHarnessTest additionally proves the pair with generated
    // fixtures through the paired E2E harness.
    ruleKey: "CHKMANIF:101",
    acceptingFixtureIds: ["platform_version_good", "harness-chkmanif-format-valid"],
    rejectingFixtureIds: ["platform_version_errors", "harness-chkmanif-format-unknown"],
  },
  ...HarnessCoverage,
] as const;

/** A catalog rule that is deliberately not backed by a paired E2E fixture yet. */
export interface KnownUncoveredValidationRule {
  readonly ruleKey: ValidationRuleKey;
  readonly reason: string;
}

const uncoveredStructureKeys = (
  generatorId: string,
  base: number,
  itemTypes: readonly ProjectItemType[],
  reasonForType: (typeName: string) => string
): KnownUncoveredValidationRule[] =>
  itemTypes
    .filter((itemType) => itemType !== ProjectItemType.lootTableBehavior)
    .map((itemType) => ({
      ruleKey: `${generatorId}:${base + itemType}` as ValidationRuleKey,
      reason: reasonForType(ProjectItemType[itemType]),
    }));

/**
 * The authoritative ledger of catalog rules that stay visibly uncovered:
 * every reachable rule key is inventoried by its generator, and the ones
 * without a paired accepting/rejecting fixture are listed here with the
 * reason. ValidationRuleCatalogTest asserts the incomplete rules of every
 * target-family generator match this ledger exactly, so a rule can neither
 * silently lose coverage nor silently vanish from the denominator.
 */
export const KnownUncoveredValidationRules: readonly KnownUncoveredValidationRule[] = [
  ...uncoveredStructureKeys(
    "JSON",
    JsonSchemaErrorBase,
    OfficialSchemaItemTypes,
    (typeName) =>
      `Official-schema structure key for ${typeName}; loot tables are the paired representative of the family.`
  ),
  ...uncoveredStructureKeys(
    "COMJSON",
    CommunitySchemaErrorBase,
    CommunitySchemaItemTypes,
    (typeName) =>
      `Community-schema structure key for ${typeName}; loot tables are the paired representative of the family.`
  ),
  ...uncoveredStructureKeys(
    "UNLINK",
    UnlinkedItemNotFoundByType,
    UnlinkedItemTargetTypes,
    (typeName) =>
      `Unfulfilled-link key for ${typeName} targets; loot tables are the paired representative of the family.`
  ),
  {
    ruleKey: "GEOFMT:102",
    reason:
      "Reachable (e.g. a non-iterable bones value), but every triggering input also fails GeometryInfoGenerator " +
      "with an internal-processing error, which the paired harness rejects by design.",
  },
  {
    ruleKey: "VALFILE:104",
    reason:
      "Reachable only through browser FileSystemStorage (binary content preserved under a .json name); " +
      "no node-side E2E path exists.",
  },
] as const;

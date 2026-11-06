// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * VersionRulePairs — paired E2E coverage for the platform-version managers:
 * FORMATVER (per-definition-file format_version checks), MINENGINEVER
 * (pack manifest min_engine_version), and BASEGAMEVER (world template
 * base_game_version).
 *
 * FORMATVER pairs are generated from the same FormatVersionFamilies table
 * the production rule metadata derives from, so the fixture matrix cannot
 * drift from the rule inventory. Version boundaries are derived from the
 * pinned test Minecraft version (TestVersionPin): the "previous minor"
 * accepting fixtures sit exactly on the N-1 window edge (1.21 when current
 * is 1.26, honoring the skipped 1.22–1.25 range).
 *
 * Suites: checks whose severity or reachability depends on
 * performPlatformVersionValidations run where they can fire — higher-minor
 * (+8) and higher-patch (+12) only exist outside the platform suite and run
 * under defaultInDevelopment; everything else runs under the fast
 * currentPlatformVersions suite (where lower-version checks are errors).
 *
 * BASEGAMEVER emits nothing on fully-clean content, so accepting fixtures
 * include applicable content that trips only a benign sibling rule (e.g. a
 * patch-lower recommendation) or a companion world template, keeping the
 * generator demonstrably running while the target rule stays quiet.
 */

import { InfoItemType } from "../../info/IInfoItemData";
import { ProjectInfoSuite } from "../../info/IProjectInfoData";
import { ValidationRuleCoveragePair, ValidationResultExpectation } from "../ValidationRuleHarness";
import { ValidationRuleKey } from "../../info/tests/ValidationRuleDefinition";
import { FormatVersionFamilies, IFormatVersionFamily } from "../../manager/FormatVersionManagerData";
import {
  BpRoot,
  RpRoot,
  BpManifestPath,
  RpManifestPath,
  WtManifestPath,
  WtRoot,
  PinnedVersion,
  VersionBoundaries,
  bpManifest,
  coveragePairFromBase,
  json,
  minimalBpFiles,
  minimalRpFiles,
  rpManifest,
  worldTemplateManifest,
} from "./PairFixtureBuilders";

const versionString = (v: readonly number[]) => v.join(".");
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Per-family definition-file factory: path plus content for a format_version. */
interface IFamilyFixtureSource {
  readonly defPath: string;
  readonly packFiles: { readonly [relativePath: string]: string };
  readonly content: (formatVersion: readonly number[] | undefined) => string;
}

const withFormatVersion = (formatVersion: readonly number[] | undefined, body: object): string => {
  const value: any = { ...body };

  if (formatVersion !== undefined) {
    value.format_version = versionString(formatVersion);
  }

  return json(value);
};

const familySources: { readonly [familyKey: string]: IFamilyFixtureSource } = {
  blockType: {
    defPath: `${BpRoot}/blocks/harness_block.json`,
    packFiles: minimalBpFiles(),
    content: (fv) =>
      withFormatVersion(fv, {
        "minecraft:block": {
          description: { identifier: "test:harness_block", menu_category: { category: "construction" } },
          components: { "minecraft:destructible_by_mining": { seconds_to_destroy: 1.5 } },
        },
      }),
  },
  itemType: {
    defPath: `${BpRoot}/items/harness_item.json`,
    packFiles: minimalBpFiles(),
    content: (fv) =>
      withFormatVersion(fv, {
        "minecraft:item": {
          description: { identifier: "test:harness_item", menu_category: { category: "items" } },
          components: { "minecraft:max_stack_size": 64 },
        },
      }),
  },
  recipe: {
    defPath: `${BpRoot}/recipes/harness_recipe.json`,
    packFiles: minimalBpFiles(),
    content: (fv) =>
      withFormatVersion(fv, {
        "minecraft:recipe_shapeless": {
          description: { identifier: "test:harness_recipe" },
          tags: ["crafting_table"],
          ingredients: [{ item: "minecraft:stone" }],
          result: { item: "minecraft:cobblestone" },
        },
      }),
  },
  behaviorAnimation: {
    defPath: `${BpRoot}/animations/harness.bp_anim.json`,
    packFiles: minimalBpFiles(),
    content: (fv) =>
      withFormatVersion(fv, {
        animations: { "animation.harness.idle": { loop: true, animation_length: 1 } },
      }),
  },
  behaviorAnimationController: {
    defPath: `${BpRoot}/animation_controllers/harness.bp_ac.json`,
    packFiles: minimalBpFiles(),
    content: (fv) =>
      withFormatVersion(fv, {
        animation_controllers: {
          "controller.animation.harness": { initial_state: "default", states: { default: {} } },
        },
      }),
  },
  resourceAnimation: {
    defPath: `${RpRoot}/animations/harness.animation.json`,
    packFiles: minimalRpFiles(),
    content: (fv) =>
      withFormatVersion(fv, {
        animations: { "animation.harness.idle": { loop: true, animation_length: 1 } },
      }),
  },
  resourceAnimationController: {
    defPath: `${RpRoot}/animation_controllers/harness.animation_controllers.json`,
    packFiles: minimalRpFiles(),
    content: (fv) =>
      withFormatVersion(fv, {
        animation_controllers: {
          "controller.animation.harness": { initial_state: "default", states: { default: {} } },
        },
      }),
  },
  spawnRules: {
    defPath: `${BpRoot}/spawn_rules/harness_entity.json`,
    packFiles: minimalBpFiles(),
    content: (fv) =>
      withFormatVersion(fv, {
        "minecraft:spawn_rules": {
          description: { identifier: "test:harness_entity", population_control: "animal" },
          conditions: [{ "minecraft:spawns_on_surface": {} }],
        },
      }),
  },
  attachable: {
    defPath: `${RpRoot}/attachables/harness_attachable.json`,
    packFiles: minimalRpFiles(),
    content: (fv) =>
      withFormatVersion(fv, {
        "minecraft:attachable": {
          description: {
            identifier: "test:harness_attachable",
            textures: { default: "textures/items/harness_attachable" },
          },
        },
      }),
  },
  entityTypeResource: {
    defPath: `${RpRoot}/entity/harness_mob.entity.json`,
    packFiles: minimalRpFiles(),
    content: (fv) =>
      withFormatVersion(fv, {
        "minecraft:client_entity": {
          description: { identifier: "test:harness_mob" },
        },
      }),
  },
  fogResource: {
    defPath: `${RpRoot}/fogs/harness_fog.json`,
    packFiles: minimalRpFiles(),
    content: (fv) =>
      withFormatVersion(fv, {
        "minecraft:fog_settings": {
          description: { identifier: "test:harness_fog" },
          distance: {},
        },
      }),
  },
};

interface IVersionCase {
  readonly delta: number;
  readonly slug: string;
  readonly suite: ProjectInfoSuite;
  readonly severity: ValidationResultExpectation["severity"];
  readonly message: string;
  readonly rejectVersion: (expected: readonly number[]) => readonly number[] | undefined;
  readonly acceptVersion: (expected: readonly number[]) => readonly number[];
  /** Whether this check exists for the family. */
  readonly applies: (family: IFormatVersionFamily) => boolean;
}

const formatVersionCases: readonly IVersionCase[] = [
  {
    delta: 0,
    slug: "no-fv",
    suite: ProjectInfoSuite.currentPlatformVersions,
    severity: InfoItemType.error,
    message: "does not define a format_version",
    rejectVersion: () => undefined,
    acceptVersion: VersionBoundaries.exact,
    applies: (family) => !family.missingFormatVersionReadsAsZero,
  },
  {
    // Families that read a missing format_version as 0.0.0 never reach the +0
    // slot by omission (the lower-major check flags the 0.0.0 instead), but a
    // version with the wrong number of components still trips it. A fourth
    // component ("1.26.50.1") is the boundary the missing case cannot cover.
    delta: 0,
    slug: "malformed-fv",
    suite: ProjectInfoSuite.currentPlatformVersions,
    severity: InfoItemType.error,
    message: "does not define a format_version",
    rejectVersion: (expected) => [...expected, 1],
    acceptVersion: VersionBoundaries.exact,
    applies: (family) => family.missingFormatVersionReadsAsZero === true,
  },
  {
    delta: 2,
    slug: "lower-major",
    suite: ProjectInfoSuite.currentPlatformVersions,
    severity: InfoItemType.error,
    message: "has a lower major version number",
    rejectVersion: VersionBoundaries.lowerMajor,
    acceptVersion: VersionBoundaries.exact,
    applies: () => true,
  },
  {
    delta: 4,
    slug: "higher-major",
    suite: ProjectInfoSuite.currentPlatformVersions,
    severity: InfoItemType.error,
    message: "has a higher major version number",
    rejectVersion: VersionBoundaries.higherMajor,
    acceptVersion: VersionBoundaries.exact,
    applies: (family) => !family.allowHigherVersions,
  },
  {
    delta: 6,
    slug: "minor-too-old",
    suite: ProjectInfoSuite.currentPlatformVersions,
    severity: InfoItemType.error,
    message: "has a lower minor version number",
    rejectVersion: VersionBoundaries.minorTooOld,
    // Boundary: the newest minor still inside the supported N-1 window.
    acceptVersion: VersionBoundaries.previousMinor,
    applies: () => true,
  },
  {
    delta: 8,
    slug: "higher-minor",
    suite: ProjectInfoSuite.defaultInDevelopment,
    severity: InfoItemType.warning,
    message: "has a higher minor version number",
    rejectVersion: VersionBoundaries.higherMinor,
    acceptVersion: VersionBoundaries.exact,
    applies: (family) => !family.allowHigherVersions,
  },
  {
    delta: 10,
    slug: "lower-patch",
    suite: ProjectInfoSuite.currentPlatformVersions,
    severity: InfoItemType.recommendation,
    message: "has a lower patch version number",
    rejectVersion: VersionBoundaries.lowerPatch,
    acceptVersion: VersionBoundaries.exact,
    applies: (family) => family.expectedVersion === undefined,
  },
  {
    delta: 12,
    slug: "higher-patch",
    suite: ProjectInfoSuite.defaultInDevelopment,
    severity: InfoItemType.error,
    message: "has a higher patch version number",
    rejectVersion: VersionBoundaries.higherPatch,
    acceptVersion: VersionBoundaries.exact,
    applies: (family) => !family.allowHigherVersions,
  },
];

const kebab = (camel: string) => camel.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const formatVersionPairs: ValidationRuleCoveragePair[] = FormatVersionFamilies.flatMap((family) => {
  const source = familySources[family.key];

  if (!source) {
    throw new Error(`No fixture source defined for FORMATVER family '${family.key}'.`);
  }

  const expected = family.expectedVersion ?? PinnedVersion;
  const fileName = source.defPath.substring(source.defPath.lastIndexOf("/") + 1);
  const pathPattern = new RegExp(`${escapeRegExp(fileName)}$`);

  return formatVersionCases
    .filter((versionCase) => versionCase.applies(family))
    .map((versionCase) => {
      const stem = `formatver-${kebab(family.key)}-${versionCase.slug}`;
      const rejectVersion = versionCase.rejectVersion(expected);
      const acceptVersion = versionCase.acceptVersion(expected);

      return coveragePairFromBase({
        ruleKey: `FORMATVER:${family.offset + versionCase.delta}` as ValidationRuleKey,
        category: "manager",
        suite: versionCase.suite,
        baseFiles: source.packFiles,
        accepting: {
          id: `harness-${stem}-accept`,
          description: `${family.label} definition at format_version ${versionString(
            acceptVersion
          )}; FORMATVER:${family.offset + versionCase.delta} must stay quiet.`,
          files: { [source.defPath]: source.content(acceptVersion) },
        },
        rejecting: {
          id: `harness-${stem}-reject`,
          description: `${family.label} definition ${
            rejectVersion ? `at format_version ${versionString(rejectVersion)}` : "without a format_version"
          }; FORMATVER:${family.offset + versionCase.delta} must flag it.`,
          files: { [source.defPath]: source.content(rejectVersion) },
        },
        rejectingExpectation: {
          severity: versionCase.severity,
          count: 1,
          projectPath: pathPattern,
          message: versionCase.message,
        },
      });
    });
});

// ---------------------------------------------------------------------------
// MINENGINEVER — pack manifest min_engine_version. MINENGINEVER:120 keeps its
// original pair in ValidationRuleHarnessPairs.ts.
// ---------------------------------------------------------------------------

const mevPair = (spec: {
  ruleIndex: number;
  slug: string;
  baseFiles: { readonly [relativePath: string]: string };
  acceptingDescription: string;
  acceptingFiles?: { readonly [relativePath: string]: string };
  rejectingDescription: string;
  rejectingFiles: { readonly [relativePath: string]: string };
  expectation: ValidationResultExpectation;
}): ValidationRuleCoveragePair =>
  coveragePairFromBase({
    ruleKey: `MINENGINEVER:${spec.ruleIndex}` as ValidationRuleKey,
    category: "manager",
    suite: ProjectInfoSuite.currentPlatformVersions,
    baseFiles: spec.baseFiles,
    accepting: {
      id: `harness-minenginever-${spec.slug}-accept`,
      description: spec.acceptingDescription,
      files: spec.acceptingFiles,
    },
    rejecting: {
      id: `harness-minenginever-${spec.slug}-reject`,
      description: spec.rejectingDescription,
      files: spec.rejectingFiles,
    },
    rejectingExpectation: spec.expectation,
  });

const bpWithMev = (mev: readonly number[]) => json(bpManifest({ minEngineVersion: mev }));
const rpWithMev = (mev: readonly number[]) => json(rpManifest({ minEngineVersion: mev }));

const minEngineVersionPairs: ValidationRuleCoveragePair[] = [
  mevPair({
    ruleIndex: 100,
    slug: "bp-missing",
    baseFiles: {},
    acceptingDescription: "Behavior pack manifest declaring min_engine_version; MINENGINEVER:100 must stay quiet.",
    acceptingFiles: minimalBpFiles(),
    rejectingDescription: "Behavior pack manifest without min_engine_version; MINENGINEVER:100 must flag it.",
    rejectingFiles: { [BpManifestPath]: json(bpManifest({ minEngineVersion: undefined })) },
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "does not define a header/min_engine_version",
    },
  }),
  mevPair({
    ruleIndex: 110,
    slug: "bp-major-low",
    baseFiles: {},
    acceptingDescription: "Behavior pack min_engine_version on the current major; MINENGINEVER:110 must stay quiet.",
    acceptingFiles: minimalBpFiles(),
    rejectingDescription: "Behavior pack min_engine_version a major version behind; MINENGINEVER:110 must flag it.",
    rejectingFiles: { [BpManifestPath]: bpWithMev(VersionBoundaries.lowerMajor(PinnedVersion)) },
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "has a lower major version number",
    },
  }),
  mevPair({
    ruleIndex: 111,
    slug: "bp-major-high",
    baseFiles: {},
    acceptingDescription: "Behavior pack min_engine_version on the current major; MINENGINEVER:111 must stay quiet.",
    acceptingFiles: minimalBpFiles(),
    rejectingDescription: "Behavior pack min_engine_version a major version ahead; MINENGINEVER:111 must flag it.",
    rejectingFiles: { [BpManifestPath]: bpWithMev(VersionBoundaries.higherMajor(PinnedVersion)) },
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "has a higher major version number",
    },
  }),
  mevPair({
    ruleIndex: 121,
    slug: "bp-minor-high",
    baseFiles: {},
    acceptingDescription: "Behavior pack min_engine_version on the current minor; MINENGINEVER:121 must stay quiet.",
    acceptingFiles: minimalBpFiles(),
    rejectingDescription: "Behavior pack min_engine_version a minor version ahead; MINENGINEVER:121 must flag it.",
    rejectingFiles: { [BpManifestPath]: bpWithMev(VersionBoundaries.higherMinor(PinnedVersion)) },
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "has a higher minor version number",
    },
  }),
  mevPair({
    ruleIndex: 180,
    slug: "no-manifest",
    baseFiles: { [`${BpRoot}/functions/harness.mcfunction`]: "say harness\n" },
    acceptingDescription: "Project with a behavior pack manifest present; MINENGINEVER:180 must stay quiet.",
    acceptingFiles: minimalBpFiles(),
    rejectingDescription: "Project with content but no pack manifest of any kind; MINENGINEVER:180 must flag it.",
    rejectingFiles: {},
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      message: "No resource/behavior/skin pack manifest or world template manifest was found",
    },
  }),
  mevPair({
    ruleIndex: 200,
    slug: "rp-missing",
    baseFiles: {},
    acceptingDescription: "Resource pack manifest declaring min_engine_version; MINENGINEVER:200 must stay quiet.",
    acceptingFiles: minimalRpFiles(),
    rejectingDescription: "Resource pack manifest without min_engine_version; MINENGINEVER:200 must flag it.",
    rejectingFiles: { [RpManifestPath]: json(rpManifest({ minEngineVersion: undefined })) },
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "does not define a header/min_engine_version",
    },
  }),
  mevPair({
    ruleIndex: 210,
    slug: "rp-major-low",
    baseFiles: {},
    acceptingDescription: "Resource pack min_engine_version on the current major; MINENGINEVER:210 must stay quiet.",
    acceptingFiles: minimalRpFiles(),
    rejectingDescription: "Resource pack min_engine_version a major version behind; MINENGINEVER:210 must flag it.",
    rejectingFiles: { [RpManifestPath]: rpWithMev(VersionBoundaries.lowerMajor(PinnedVersion)) },
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "has a lower major version number",
    },
  }),
  mevPair({
    ruleIndex: 211,
    slug: "rp-major-high",
    baseFiles: {},
    acceptingDescription: "Resource pack min_engine_version on the current major; MINENGINEVER:211 must stay quiet.",
    acceptingFiles: minimalRpFiles(),
    rejectingDescription: "Resource pack min_engine_version a major version ahead; MINENGINEVER:211 must flag it.",
    rejectingFiles: { [RpManifestPath]: rpWithMev(VersionBoundaries.higherMajor(PinnedVersion)) },
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "has a higher major version number",
    },
  }),
  mevPair({
    ruleIndex: 220,
    slug: "rp-minor-low",
    baseFiles: {},
    acceptingDescription:
      "Resource pack min_engine_version on the N-1 window edge (previous supported minor); MINENGINEVER:220 must stay quiet.",
    acceptingFiles: minimalRpFiles(rpManifest({ minEngineVersion: VersionBoundaries.previousMinor(PinnedVersion) })),
    rejectingDescription:
      "Resource pack min_engine_version one minor below the supported window; MINENGINEVER:220 must flag it.",
    rejectingFiles: { [RpManifestPath]: rpWithMev(VersionBoundaries.minorTooOld(PinnedVersion)) },
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "has a lower minor version number",
    },
  }),
  mevPair({
    ruleIndex: 221,
    slug: "rp-minor-high",
    baseFiles: {},
    acceptingDescription: "Resource pack min_engine_version on the current minor; MINENGINEVER:221 must stay quiet.",
    acceptingFiles: minimalRpFiles(),
    rejectingDescription: "Resource pack min_engine_version a minor version ahead; MINENGINEVER:221 must flag it.",
    rejectingFiles: { [RpManifestPath]: rpWithMev(VersionBoundaries.higherMinor(PinnedVersion)) },
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "has a higher minor version number",
    },
  }),
];

// ---------------------------------------------------------------------------
// BASEGAMEVER — world template base_game_version. The generator emits nothing
// on clean content, so each accepting fixture keeps it applicable via a
// benign sibling trigger: either the target template's own patch-lower
// recommendation or a companion template in a second world folder.
// ---------------------------------------------------------------------------

const Wt2Root = "world_templates/test_wt_companion";
const Wt2ManifestPath = `${Wt2Root}/manifest.json`;

/** Companion world template that only trips the patch-lower recommendation (130). */
const companionPatchLower: { [relativePath: string]: string } = {
  [Wt2ManifestPath]: json(
    worldTemplateManifest({
      headerUuid: "e58f1a6e-4b2d-4c6a-8f5e-1a2b3c4d5ea0",
      moduleUuid: "e58f1a6e-4b2d-4c6a-8f5e-1a2b3c4d5ea1",
      baseGameVersion: VersionBoundaries.lowerPatch(PinnedVersion),
    })
  ),
  [`${Wt2Root}/levelname.txt`]: "Validation Harness Companion World",
};

/** Companion world template that only trips the missing-base_game_version error (100). */
const companionMissingBgv: { [relativePath: string]: string } = {
  [Wt2ManifestPath]: json(
    worldTemplateManifest({
      headerUuid: "e58f1a6e-4b2d-4c6a-8f5e-1a2b3c4d5ea2",
      moduleUuid: "e58f1a6e-4b2d-4c6a-8f5e-1a2b3c4d5ea3",
      baseGameVersion: undefined,
    })
  ),
  [`${Wt2Root}/levelname.txt`]: "Validation Harness Companion World",
};

const bgvPair = (spec: {
  ruleIndex: number;
  slug: string;
  companion?: { readonly [relativePath: string]: string };
  acceptingBgv: readonly number[] | undefined;
  acceptingDescription: string;
  rejectingBgv: readonly number[] | undefined;
  rejectingDescription: string;
  expectation: ValidationResultExpectation;
}): ValidationRuleCoveragePair =>
  coveragePairFromBase({
    ruleKey: `BASEGAMEVER:${spec.ruleIndex}` as ValidationRuleKey,
    category: "manager",
    suite: ProjectInfoSuite.currentPlatformVersions,
    baseFiles: { ...(spec.companion ?? {}), [`${WtRoot}/levelname.txt`]: "Validation Harness World" },
    accepting: {
      id: `harness-basegamever-${spec.slug}-accept`,
      description: spec.acceptingDescription,
      files: { [WtManifestPath]: json(worldTemplateManifest({ baseGameVersion: spec.acceptingBgv })) },
    },
    rejecting: {
      id: `harness-basegamever-${spec.slug}-reject`,
      description: spec.rejectingDescription,
      files: { [WtManifestPath]: json(worldTemplateManifest({ baseGameVersion: spec.rejectingBgv })) },
    },
    rejectingExpectation: spec.expectation,
  });

const baseGameVersionPairs: ValidationRuleCoveragePair[] = [
  bgvPair({
    ruleIndex: 100,
    slug: "missing",
    acceptingBgv: VersionBoundaries.lowerPatch(PinnedVersion),
    acceptingDescription:
      "World template declaring base_game_version (one patch behind, tripping only the patch recommendation); BASEGAMEVER:100 must stay quiet.",
    rejectingBgv: undefined,
    rejectingDescription: "World template without base_game_version; BASEGAMEVER:100 must flag it.",
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "does not define a header/base_game_version",
    },
  }),
  bgvPair({
    ruleIndex: 110,
    slug: "major-low",
    companion: companionPatchLower,
    acceptingBgv: VersionBoundaries.exact(PinnedVersion),
    acceptingDescription: "World template base_game_version on the current major; BASEGAMEVER:110 must stay quiet.",
    rejectingBgv: VersionBoundaries.lowerMajor(PinnedVersion),
    rejectingDescription: "World template base_game_version a major version behind; BASEGAMEVER:110 must flag it.",
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /test_wt\/manifest\.json$/,
      message: "has a lower major version number",
    },
  }),
  bgvPair({
    ruleIndex: 111,
    slug: "major-high",
    companion: companionPatchLower,
    acceptingBgv: VersionBoundaries.exact(PinnedVersion),
    acceptingDescription: "World template base_game_version on the current major; BASEGAMEVER:111 must stay quiet.",
    rejectingBgv: VersionBoundaries.higherMajor(PinnedVersion),
    rejectingDescription: "World template base_game_version a major version ahead; BASEGAMEVER:111 must flag it.",
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /test_wt\/manifest\.json$/,
      message: "has a higher major version number",
    },
  }),
  bgvPair({
    ruleIndex: 120,
    slug: "minor-low",
    acceptingBgv: VersionBoundaries.previousMinor(PinnedVersion),
    acceptingDescription:
      "World template base_game_version on the N-1 window edge (previous supported minor); BASEGAMEVER:120 must stay quiet.",
    rejectingBgv: VersionBoundaries.minorTooOld(PinnedVersion),
    rejectingDescription:
      "World template base_game_version one minor below the supported window; BASEGAMEVER:120 must flag it.",
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "has a lower minor version number",
    },
  }),
  bgvPair({
    ruleIndex: 121,
    slug: "minor-high",
    companion: companionPatchLower,
    acceptingBgv: VersionBoundaries.exact(PinnedVersion),
    acceptingDescription: "World template base_game_version on the current minor; BASEGAMEVER:121 must stay quiet.",
    rejectingBgv: VersionBoundaries.higherMinor(PinnedVersion),
    rejectingDescription: "World template base_game_version a minor version ahead; BASEGAMEVER:121 must flag it.",
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /test_wt\/manifest\.json$/,
      message: "has a higher minor version number",
    },
  }),
  bgvPair({
    ruleIndex: 130,
    slug: "patch-low",
    companion: companionMissingBgv,
    acceptingBgv: VersionBoundaries.exact(PinnedVersion),
    acceptingDescription: "World template base_game_version on the current patch; BASEGAMEVER:130 must stay quiet.",
    rejectingBgv: VersionBoundaries.lowerPatch(PinnedVersion),
    rejectingDescription: "World template base_game_version one patch behind; BASEGAMEVER:130 must recommend updating.",
    expectation: {
      severity: InfoItemType.recommendation,
      count: 1,
      projectPath: /test_wt\/manifest\.json$/,
      message: "has a lower patch version number",
    },
  }),
  bgvPair({
    ruleIndex: 131,
    slug: "patch-high",
    companion: companionPatchLower,
    acceptingBgv: VersionBoundaries.exact(PinnedVersion),
    acceptingDescription: "World template base_game_version on the current patch; BASEGAMEVER:131 must stay quiet.",
    rejectingBgv: VersionBoundaries.higherPatch(PinnedVersion),
    rejectingDescription: "World template base_game_version one patch ahead; BASEGAMEVER:131 must flag it.",
    expectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /test_wt\/manifest\.json$/,
      message: "has a higher patch version number",
    },
  }),
];

export const VersionRulePairs: readonly ValidationRuleCoveragePair[] = [
  ...formatVersionPairs,
  ...minEngineVersionPairs,
  ...baseGameVersionPairs,
];

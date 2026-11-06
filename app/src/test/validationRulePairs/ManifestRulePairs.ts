// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ManifestRulePairs — paired E2E coverage for the CHKMANIF manifest-family
 * rules (format, header, module, UUID, dependency, capability, subpack,
 * settings, and Vibrant Visuals checks). One accepting/rejecting pair per
 * production rule; CHKMANIF:101 keeps its original pair in
 * ValidationRuleHarnessPairs.ts.
 *
 * All pairs run under the currentPlatformVersions suite (CHKMANIF is a
 * member) because that suite runs only five generators, keeping the paired
 * pipeline runs fast without changing what the target rule sees.
 *
 * Boundary values covered here: min_engine_version 1.13.0 (the exact version
 * that requires format_version 2), the PBR minimum engine version 1.21.120,
 * dependency version 1.0.0 (== the minimum, still rejected), slider
 * default == max (accepted) vs beyond max, step == max-min (accepted) vs
 * above, and dropdowns at the two-option minimum.
 */

import { InfoItemType } from "../../info/IInfoItemData";
import { ProjectInfoSuite } from "../../info/IProjectInfoData";
import { ValidationRuleCoveragePair } from "../ValidationRuleHarness";
import {
  BpManifestPath,
  BpRoot,
  RpManifestPath,
  RpRoot,
  WtManifestPath,
  bpManifest,
  coveragePairFromBase,
  fixtureUuid,
  json,
  minimalBpFiles,
  minimalRpFiles,
  rpManifest,
  worldTemplateFiles,
  worldTemplateManifest,
  ICoveragePairSpec,
} from "./PairFixtureBuilders";

const Suite = ProjectInfoSuite.currentPlatformVersions;

const chkmanifPair = (
  slug: string,
  spec: Omit<ICoveragePairSpec, "category" | "suite" | "accepting" | "rejecting"> & {
    acceptingDescription: string;
    rejectingDescription: string;
    acceptingFiles?: ICoveragePairSpec["accepting"]["files"];
    rejectingFiles?: ICoveragePairSpec["rejecting"]["files"];
  }
): ValidationRuleCoveragePair =>
  coveragePairFromBase({
    ruleKey: spec.ruleKey,
    category: "project",
    suite: Suite,
    baseFiles: spec.baseFiles,
    accepting: {
      id: `harness-chkmanif-${slug}-accept`,
      description: spec.acceptingDescription,
      files: spec.acceptingFiles,
    },
    rejecting: {
      id: `harness-chkmanif-${slug}-reject`,
      description: spec.rejectingDescription,
      files: spec.rejectingFiles,
    },
    rejectingExpectation: spec.rejectingExpectation,
  });

// CHKMANIF:102 — schema-invalid manifest (header.name missing).
const schemaInvalidManifest = bpManifest();
delete schemaInvalidManifest.header.name;

// CHKMANIF:104 — header description missing.
const noDescriptionManifest = bpManifest();
delete noDescriptionManifest.header.description;

const texturSetPath = `${RpRoot}/textures/blocks/harness_stone.texture_set.json`;
const textureSetJson = json({
  format_version: "1.16.100",
  "minecraft:texture_set": {
    color: "harness_stone",
    metalness_emissive_roughness: "harness_stone_mer",
  },
});

export const ManifestRulePairs: readonly ValidationRuleCoveragePair[] = [
  chkmanifPair("manifest-schema", {
    ruleKey: "CHKMANIF:102",
    baseFiles: {},
    acceptingDescription: "Schema-valid behavior pack manifest; CHKMANIF:102 must stay quiet.",
    acceptingFiles: minimalBpFiles(),
    rejectingDescription: "Manifest missing the required header.name; CHKMANIF:102 must flag the schema error.",
    rejectingFiles: { [BpManifestPath]: json(schemaInvalidManifest) },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "header/name",
    },
  }),

  chkmanifPair("manifest-count", {
    ruleKey: "CHKMANIF:103",
    baseFiles: minimalBpFiles(),
    acceptingDescription: "Behavior pack with exactly one manifest; CHKMANIF:103 must stay quiet.",
    rejectingDescription:
      "A second manifest.json nested inside the same behavior pack; CHKMANIF:103 must flag the outer pack.",
    rejectingFiles: {
      [`${BpRoot}/nested/manifest.json`]: json(bpManifest({ headerUuid: fixtureUuid(0x61), moduleUuid: fixtureUuid(0x62) })),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      message: "Packs must have exactly one manifest",
    },
  }),

  chkmanifPair("missing-description", {
    ruleKey: "CHKMANIF:104",
    baseFiles: {},
    acceptingDescription: "Manifest with a header description; CHKMANIF:104 must stay quiet.",
    acceptingFiles: minimalBpFiles(),
    rejectingDescription: "Manifest without a header description; CHKMANIF:104 must flag it.",
    rejectingFiles: { [BpManifestPath]: json(noDescriptionManifest) },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "description",
    },
  }),

  chkmanifPair("header-property-required", {
    ruleKey: "CHKMANIF:105",
    baseFiles: {},
    acceptingDescription: "Resource pack manifest with min_engine_version; CHKMANIF:105 must stay quiet.",
    acceptingFiles: minimalRpFiles(),
    rejectingDescription:
      "Format version 2 resource pack without min_engine_version; CHKMANIF:105 must require the property.",
    rejectingFiles: { [RpManifestPath]: json(rpManifest({ minEngineVersion: undefined })) },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "Header property is required for format version 2",
      data: "min_engine_version",
    },
  }),

  chkmanifPair("mev-too-high-for-v1", {
    ruleKey: "CHKMANIF:106",
    baseFiles: {},
    acceptingDescription: "Format version 2 resource pack with a current min_engine_version; CHKMANIF:106 must stay quiet.",
    acceptingFiles: minimalRpFiles(),
    rejectingDescription:
      "Format version 1 resource pack with min_engine_version 1.13.0 (the exact boundary that requires v2); CHKMANIF:106 must flag it.",
    rejectingFiles: { [RpManifestPath]: json(rpManifest({ formatVersion: 1, minEngineVersion: [1, 13, 0] })) },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: [1, 13, 0],
    },
  }),

  chkmanifPair("pack-scope", {
    ruleKey: "CHKMANIF:107",
    baseFiles: {},
    acceptingDescription: "Manifest declaring the allowed pack_scope 'world'; CHKMANIF:107 must stay quiet.",
    acceptingFiles: minimalBpFiles(bpManifest({ headerExtras: { pack_scope: "world" } })),
    rejectingDescription: "Manifest declaring the unknown pack_scope 'world2'; CHKMANIF:107 must flag it.",
    rejectingFiles: { [BpManifestPath]: json(bpManifest({ headerExtras: { pack_scope: "world2" } })) },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "world2",
    },
  }),

  chkmanifPair("world-template-count", {
    ruleKey: "CHKMANIF:108",
    baseFiles: worldTemplateFiles(),
    acceptingDescription: "World template with a single world_template module; CHKMANIF:108 must stay quiet.",
    rejectingDescription: "World template declaring two world_template modules; CHKMANIF:108 must flag it.",
    rejectingFiles: {
      [WtManifestPath]: json(
        worldTemplateManifest({
          modules: [
            { type: "world_template", uuid: fixtureUuid(0x41), version: [1, 0, 0] },
            { type: "world_template", uuid: fixtureUuid(0x42), version: [1, 0, 0] },
          ],
        })
      ),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "manifest.modules can have only 1 world_template module",
    },
  }),

  chkmanifPair("module-type", {
    ruleKey: "CHKMANIF:109",
    baseFiles: {},
    acceptingDescription: "Manifest with a known 'data' module type; CHKMANIF:109 must stay quiet.",
    acceptingFiles: minimalBpFiles(),
    rejectingDescription: "Manifest with an unknown module type; CHKMANIF:109 must flag it.",
    rejectingFiles: {
      [BpManifestPath]: json(
        bpManifest({
          modules: [
            { type: "data", uuid: fixtureUuid(0x11), version: [1, 0, 0] },
            { type: "strange_module", uuid: fixtureUuid(0x12), version: [1, 0, 0] },
          ],
        })
      ),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "strange_module",
    },
  }),

  chkmanifPair("duplicate-uuid", {
    ruleKey: "CHKMANIF:110",
    baseFiles: {},
    acceptingDescription: "Manifest whose header and module UUIDs are distinct; CHKMANIF:110 must stay quiet.",
    acceptingFiles: minimalBpFiles(),
    rejectingDescription: "Manifest whose module reuses the header UUID; CHKMANIF:110 must flag the duplicate.",
    rejectingFiles: {
      [BpManifestPath]: json(bpManifest({ headerUuid: fixtureUuid(0x13), moduleUuid: fixtureUuid(0x13) })),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "Duplicate UUID found",
      data: fixtureUuid(0x13),
    },
  }),

  chkmanifPair("invalid-uuid", {
    ruleKey: "CHKMANIF:111",
    baseFiles: {},
    acceptingDescription: "Manifest with well-formed UUIDs; CHKMANIF:111 must stay quiet.",
    acceptingFiles: minimalBpFiles(),
    rejectingDescription: "Manifest whose header UUID is not a UUID; CHKMANIF:111 must flag it.",
    rejectingFiles: { [BpManifestPath]: json(bpManifest({ headerUuid: "not-a-uuid" })) },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "not-a-uuid",
    },
  }),

  chkmanifPair("dependency-identifier", {
    ruleKey: "CHKMANIF:112",
    baseFiles: {},
    acceptingDescription: "Dependency identified by uuid; CHKMANIF:112 must stay quiet.",
    acceptingFiles: minimalBpFiles(bpManifest({ dependencies: [{ uuid: fixtureUuid(0x50), version: [1, 0, 0] }] })),
    rejectingDescription: "Dependency with neither uuid nor module_name; CHKMANIF:112 must flag it.",
    rejectingFiles: { [BpManifestPath]: json(bpManifest({ dependencies: [{ version: [1, 0, 0] }] })) },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "no 'module_name' or 'uuid' identifier found",
    },
  }),

  chkmanifPair("dependency-both-identifiers", {
    ruleKey: "CHKMANIF:113",
    baseFiles: {},
    acceptingDescription: "Dependency identified by module_name only; CHKMANIF:113 must stay quiet.",
    acceptingFiles: minimalBpFiles(
      bpManifest({ dependencies: [{ module_name: "@minecraft/server", version: "1.12.0" }] })
    ),
    rejectingDescription: "Dependency declaring both uuid and module_name; CHKMANIF:113 must flag it.",
    rejectingFiles: {
      [BpManifestPath]: json(
        bpManifest({
          dependencies: [{ uuid: fixtureUuid(0x51), module_name: "@minecraft/server", version: "1.12.0" }],
        })
      ),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "'module_name' or UUID, not both",
    },
  }),

  chkmanifPair("module-name-allowed", {
    ruleKey: "CHKMANIF:114",
    baseFiles: {},
    acceptingDescription: "Dependency on the allowed @minecraft/server-ui module; CHKMANIF:114 must stay quiet.",
    acceptingFiles: minimalBpFiles(
      bpManifest({ dependencies: [{ module_name: "@minecraft/server-ui", version: "1.2.0" }] })
    ),
    rejectingDescription: "Dependency on the disallowed @minecraft/server-net module; CHKMANIF:114 must flag it.",
    rejectingFiles: {
      [BpManifestPath]: json(bpManifest({ dependencies: [{ module_name: "@minecraft/server-net", version: "1.2.0" }] })),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "@minecraft/server-net",
    },
  }),

  chkmanifPair("dependency-version-parse", {
    ruleKey: "CHKMANIF:115",
    baseFiles: {},
    acceptingDescription: "Dependency with a parsable version; CHKMANIF:115 must stay quiet.",
    acceptingFiles: minimalBpFiles(
      bpManifest({ dependencies: [{ module_name: "@minecraft/server", version: "1.12.0" }] })
    ),
    rejectingDescription: "Dependency version that cannot be parsed; CHKMANIF:115 must flag it.",
    rejectingFiles: {
      [BpManifestPath]: json(bpManifest({ dependencies: [{ module_name: "@minecraft/server", version: "banana" }] })),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "banana",
    },
  }),

  chkmanifPair("dependency-below-min", {
    ruleKey: "CHKMANIF:116",
    baseFiles: {},
    acceptingDescription:
      "Dependency on @minecraft/server 1.0.1 (just above the 1.0.0 minimum); CHKMANIF:116 must stay quiet.",
    acceptingFiles: minimalBpFiles(
      bpManifest({ dependencies: [{ module_name: "@minecraft/server", version: "1.0.1" }] })
    ),
    rejectingDescription:
      "Dependency on @minecraft/server 1.0.0 (== the minimum, which is still rejected); CHKMANIF:116 must flag it.",
    rejectingFiles: {
      [BpManifestPath]: json(bpManifest({ dependencies: [{ module_name: "@minecraft/server", version: "1.0.0" }] })),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "1.0.0",
    },
  }),

  chkmanifPair("capability", {
    ruleKey: "CHKMANIF:117",
    baseFiles: {},
    acceptingDescription: "Manifest declaring the allowed 'pbr' capability; CHKMANIF:117 must stay quiet.",
    acceptingFiles: minimalBpFiles(bpManifest({ capabilities: ["pbr"] })),
    rejectingDescription: "Manifest declaring an unknown capability; CHKMANIF:117 must flag it.",
    rejectingFiles: { [BpManifestPath]: json(bpManifest({ capabilities: ["pbr", "chemistry"] })) },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "chemistry",
    },
  }),

  chkmanifPair("subpack-folder", {
    ruleKey: "CHKMANIF:118",
    baseFiles: {},
    acceptingDescription: "Subpacks with distinct folder names; CHKMANIF:118 must stay quiet.",
    acceptingFiles: minimalRpFiles(
      rpManifest({
        subpacks: [
          { folder_name: "sub_a", name: "Low", memory_tier: 1 },
          { folder_name: "sub_b", name: "High", memory_tier: 2 },
        ],
      })
    ),
    rejectingDescription: "Two subpacks sharing one folder name; CHKMANIF:118 must flag the duplicate.",
    rejectingFiles: {
      [RpManifestPath]: json(
        rpManifest({
          subpacks: [
            { folder_name: "sub_a", name: "Low", memory_tier: 1 },
            { folder_name: "sub_a", name: "High", memory_tier: 2 },
          ],
        })
      ),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "sub_a",
    },
  }),

  chkmanifPair("subpack-name", {
    ruleKey: "CHKMANIF:119",
    baseFiles: {},
    acceptingDescription: "Subpacks with distinct display names; CHKMANIF:119 must stay quiet.",
    acceptingFiles: minimalRpFiles(
      rpManifest({
        subpacks: [
          { folder_name: "sub_a", name: "Low", memory_tier: 1 },
          { folder_name: "sub_b", name: "High", memory_tier: 2 },
        ],
      })
    ),
    rejectingDescription: "Two subpacks sharing one display name; CHKMANIF:119 must flag the duplicate.",
    rejectingFiles: {
      [RpManifestPath]: json(
        rpManifest({
          subpacks: [
            { folder_name: "sub_a", name: "Low", memory_tier: 1 },
            { folder_name: "sub_b", name: "Low", memory_tier: 2 },
          ],
        })
      ),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "Low",
    },
  }),

  chkmanifPair("settings-missing-property", {
    ruleKey: "CHKMANIF:122",
    baseFiles: {},
    acceptingDescription: "Slider setting with every required property; CHKMANIF:122 must stay quiet.",
    acceptingFiles: minimalBpFiles(
      bpManifest({
        settings: [{ type: "slider", text: "Speed", name: "test:speed", min: 1, max: 10, step: 1, default: 5 }],
      })
    ),
    rejectingDescription: "Slider setting missing its default; CHKMANIF:122 must flag the missing property.",
    rejectingFiles: {
      [BpManifestPath]: json(
        bpManifest({ settings: [{ type: "slider", text: "Speed", name: "test:speed", min: 1, max: 10, step: 1 }] })
      ),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "default",
    },
  }),

  chkmanifPair("settings-type", {
    ruleKey: "CHKMANIF:123",
    baseFiles: {},
    acceptingDescription: "Setting with the known 'label' type; CHKMANIF:123 must stay quiet.",
    acceptingFiles: minimalBpFiles(bpManifest({ settings: [{ type: "label", text: "About this pack" }] })),
    rejectingDescription: "Setting with an unknown type; CHKMANIF:123 must flag it.",
    rejectingFiles: {
      [BpManifestPath]: json(bpManifest({ settings: [{ type: "sliderz", text: "Speed", name: "test:speed" }] })),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "sliderz",
    },
  }),

  chkmanifPair("settings-min", {
    ruleKey: "CHKMANIF:124",
    baseFiles: {},
    acceptingDescription: "Slider with min below max; CHKMANIF:124 must stay quiet.",
    acceptingFiles: minimalBpFiles(
      bpManifest({
        settings: [{ type: "slider", text: "Speed", name: "test:speed", min: 4, max: 8, step: 1, default: 5 }],
      })
    ),
    rejectingDescription: "Slider with min above max; CHKMANIF:124 must flag it.",
    rejectingFiles: {
      [BpManifestPath]: json(
        bpManifest({
          settings: [{ type: "slider", text: "Speed", name: "test:speed", min: 8, max: 4, step: 1, default: 5 }],
        })
      ),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: 8,
    },
  }),

  chkmanifPair("slider-default", {
    ruleKey: "CHKMANIF:125",
    baseFiles: {},
    acceptingDescription: "Slider default equal to max (the inclusive boundary); CHKMANIF:125 must stay quiet.",
    acceptingFiles: minimalBpFiles(
      bpManifest({
        settings: [{ type: "slider", text: "Speed", name: "test:speed", min: 1, max: 10, step: 1, default: 10 }],
      })
    ),
    rejectingDescription: "Slider default above max; CHKMANIF:125 must flag it.",
    rejectingFiles: {
      [BpManifestPath]: json(
        bpManifest({
          settings: [{ type: "slider", text: "Speed", name: "test:speed", min: 1, max: 10, step: 1, default: 20 }],
        })
      ),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: 20,
    },
  }),

  chkmanifPair("dropdown-default", {
    ruleKey: "CHKMANIF:126",
    baseFiles: {},
    acceptingDescription: "Dropdown default that exists in the options list; CHKMANIF:126 must stay quiet.",
    acceptingFiles: minimalBpFiles(
      bpManifest({
        settings: [
          {
            type: "dropdown",
            text: "Mode",
            name: "test:mode",
            default: "opt_a",
            options: [
              { name: "opt_a", text: "A" },
              { name: "opt_b", text: "B" },
            ],
          },
        ],
      })
    ),
    rejectingDescription: "Dropdown default missing from the options list; CHKMANIF:126 must flag it.",
    rejectingFiles: {
      [BpManifestPath]: json(
        bpManifest({
          settings: [
            {
              type: "dropdown",
              text: "Mode",
              name: "test:mode",
              default: "opt_c",
              options: [
                { name: "opt_a", text: "A" },
                { name: "opt_b", text: "B" },
              ],
            },
          ],
        })
      ),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "opt_c",
    },
  }),

  chkmanifPair("settings-step", {
    ruleKey: "CHKMANIF:127",
    baseFiles: {},
    acceptingDescription: "Slider step equal to max-min (the inclusive boundary); CHKMANIF:127 must stay quiet.",
    acceptingFiles: minimalBpFiles(
      bpManifest({
        settings: [{ type: "slider", text: "Speed", name: "test:speed", min: 1, max: 10, step: 9, default: 5 }],
      })
    ),
    rejectingDescription: "Slider step above max-min; CHKMANIF:127 must flag it.",
    rejectingFiles: {
      [BpManifestPath]: json(
        bpManifest({
          settings: [{ type: "slider", text: "Speed", name: "test:speed", min: 1, max: 10, step: 10, default: 5 }],
        })
      ),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: 10,
    },
  }),

  chkmanifPair("settings-duplicate-name", {
    ruleKey: "CHKMANIF:128",
    baseFiles: {},
    acceptingDescription: "Two toggles with distinct names; CHKMANIF:128 must stay quiet.",
    acceptingFiles: minimalBpFiles(
      bpManifest({
        settings: [
          { type: "toggle", text: "One", name: "test:one", default: true },
          { type: "toggle", text: "Two", name: "test:two", default: false },
        ],
      })
    ),
    rejectingDescription: "Two toggles sharing a name; CHKMANIF:128 must flag the duplicate.",
    rejectingFiles: {
      [BpManifestPath]: json(
        bpManifest({
          settings: [
            { type: "toggle", text: "One", name: "test:same", default: true },
            { type: "toggle", text: "Two", name: "test:same", default: false },
          ],
        })
      ),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "test:same",
    },
  }),

  chkmanifPair("settings-namespace", {
    ruleKey: "CHKMANIF:129",
    baseFiles: {},
    acceptingDescription: "Setting name with a namespace; CHKMANIF:129 must stay quiet.",
    acceptingFiles: minimalBpFiles(
      bpManifest({ settings: [{ type: "toggle", text: "One", name: "test:one", default: true }] })
    ),
    rejectingDescription: "Setting name without a namespace; CHKMANIF:129 must flag it.",
    rejectingFiles: {
      [BpManifestPath]: json(bpManifest({ settings: [{ type: "toggle", text: "One", name: "plainname", default: true }] })),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "plainname",
    },
  }),

  chkmanifPair("dropdown-option-count", {
    ruleKey: "CHKMANIF:130",
    baseFiles: {},
    acceptingDescription: "Dropdown with the two-option minimum; CHKMANIF:130 must stay quiet.",
    acceptingFiles: minimalBpFiles(
      bpManifest({
        settings: [
          {
            type: "dropdown",
            text: "Mode",
            name: "test:mode",
            default: "opt_a",
            options: [
              { name: "opt_a", text: "A" },
              { name: "opt_b", text: "B" },
            ],
          },
        ],
      })
    ),
    rejectingDescription: "Dropdown with a single option (below the minimum of two); CHKMANIF:130 must flag it.",
    rejectingFiles: {
      [BpManifestPath]: json(
        bpManifest({
          settings: [
            { type: "dropdown", text: "Mode", name: "test:mode", default: "opt_a", options: [{ name: "opt_a", text: "A" }] },
          ],
        })
      ),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "must have at least 2 options",
    },
  }),

  chkmanifPair("dropdown-duplicate-options", {
    ruleKey: "CHKMANIF:131",
    baseFiles: {},
    acceptingDescription: "Dropdown options with distinct names; CHKMANIF:131 must stay quiet.",
    acceptingFiles: minimalBpFiles(
      bpManifest({
        settings: [
          {
            type: "dropdown",
            text: "Mode",
            name: "test:mode",
            default: "opt_b",
            options: [
              { name: "opt_a", text: "A" },
              { name: "opt_b", text: "B" },
            ],
          },
        ],
      })
    ),
    rejectingDescription: "Dropdown repeating an option name; CHKMANIF:131 must flag the duplicate.",
    rejectingFiles: {
      [BpManifestPath]: json(
        bpManifest({
          settings: [
            {
              type: "dropdown",
              text: "Mode",
              name: "test:mode",
              default: "opt_b",
              options: [
                { name: "opt_a", text: "A" },
                { name: "opt_a", text: "A again" },
                { name: "opt_b", text: "B" },
              ],
            },
          ],
        })
      ),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "opt_a",
    },
  }),

  chkmanifPair("base-game-version-v1", {
    ruleKey: "CHKMANIF:132",
    baseFiles: worldTemplateFiles(),
    acceptingDescription: "Format version 2 world template with base_game_version; CHKMANIF:132 must stay quiet.",
    rejectingDescription:
      "Format version 1 world template declaring base_game_version; CHKMANIF:132 must require format version 2.",
    rejectingFiles: {
      [WtManifestPath]: json(worldTemplateManifest({ formatVersion: 1 })),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: "requires [format_version] [2]",
    },
  }),

  chkmanifPair("wildcard-base-game-version", {
    ruleKey: "CHKMANIF:133",
    baseFiles: worldTemplateFiles(),
    acceptingDescription: "World template pinned to a concrete base_game_version; CHKMANIF:133 must stay quiet.",
    rejectingDescription: "World template with the '*' base_game_version wildcard; CHKMANIF:133 must warn.",
    rejectingFiles: {
      [WtManifestPath]: json(worldTemplateManifest({ baseGameVersion: "*" })),
    },
    rejectingExpectation: {
      severity: InfoItemType.warning,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "*",
    },
  }),

  chkmanifPair("pbr-min-engine-version", {
    ruleKey: "CHKMANIF:134",
    baseFiles: {},
    acceptingDescription:
      "PBR-capable resource pack at min_engine_version 1.21.120 (the exact minimum); CHKMANIF:134 must stay quiet.",
    acceptingFiles: minimalRpFiles(rpManifest({ capabilities: ["pbr"], minEngineVersion: [1, 21, 120] })),
    rejectingDescription:
      "PBR-capable resource pack at min_engine_version 1.21.110 (below the minimum); CHKMANIF:134 must flag it.",
    rejectingFiles: {
      [RpManifestPath]: json(rpManifest({ capabilities: ["pbr"], minEngineVersion: [1, 21, 110] })),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      data: "1.21.110",
    },
  }),

  chkmanifPair("pbr-capability-required", {
    ruleKey: "CHKMANIF:135",
    baseFiles: { [texturSetPath]: textureSetJson },
    acceptingDescription:
      "Resource pack with texture_set.json content and the 'pbr' capability declared; CHKMANIF:135 must stay quiet.",
    acceptingFiles: minimalRpFiles(rpManifest({ capabilities: ["pbr"] })),
    rejectingDescription:
      "Resource pack with texture_set.json content but no 'pbr' capability; CHKMANIF:135 must flag the manifest.",
    rejectingFiles: minimalRpFiles(),
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: `must declare the "pbr" capability`,
    },
  }),

  // Vibrant Visuals folders such as water/ are only recognized at the pack root. Creators often reuse the
  // same names for their own subfolders under entity/ or items/, which must not be treated as PBR content.
  chkmanifPair("pbr-capability-nested-vv-folder-names", {
    ruleKey: "CHKMANIF:135",
    baseFiles: {
      [`${RpRoot}/entity/abilities/water/water_projectile.ce.json`]: json({
        format_version: "1.10.0",
        "minecraft:client_entity": {
          description: {
            identifier: "harness:water_projectile",
            materials: { default: "entity_alphatest" },
            textures: { default: "textures/entity/water_projectile" },
            geometry: { default: "geometry.water_projectile" },
            render_controllers: ["controller.render.default"],
          },
        },
      }),
      [`${RpRoot}/items/techniques/water/water_orb.json`]: json({
        format_version: "1.10.0",
        "minecraft:item": {
          description: { identifier: "harness:water_orb", category: "Equipment" },
          components: { "minecraft:icon": "water_orb" },
        },
      }),
    },
    acceptingDescription:
      "Resource pack whose entity/ and items/ subfolders are named 'water' but has no Vibrant Visuals files; CHKMANIF:135 must stay quiet.",
    acceptingFiles: minimalRpFiles(),
    rejectingDescription:
      "Same resource pack plus a root-level water/ Vibrant Visuals file and no 'pbr' capability; CHKMANIF:135 must flag the manifest.",
    rejectingFiles: {
      ...minimalRpFiles(),
      [`${RpRoot}/water/water.json`]: json({
        format_version: "1.21.70",
        "minecraft:water_settings": {
          description: { identifier: "harness:default_water" },
          particle_concentrations: { chlorophyll: 0.5, suspended_sediment: 0.0, cdom: 0.0 },
        },
      }),
    },
    rejectingExpectation: {
      severity: InfoItemType.error,
      count: 1,
      projectPath: /manifest\.json$/,
      message: `must declare the "pbr" capability`,
    },
  }),
];

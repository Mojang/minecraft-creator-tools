// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { Packument } from "@npm/types";
import Database from "../minecraft/Database";
import NpmModule from "../devproject/NpmModule";
import { TEST_PINNED_MC_PREVIEW_VERSION } from "./TestVersionPin";

/**
 * TestScriptModulePin
 *
 * Companion to TestVersionPin for script module registry data:
 * ScriptModuleManager (SCRIPTMODULE) resolves @minecraft/* dependency
 * versions through Database.getModuleDescriptor, which consults the live
 * registry.npmjs.org. Live dist-tags drift with every module release, which
 * historically made SCRIPTMODULE results (notably the out-of-date-beta rule,
 * 114) volatile enough that report baselines had to exclude them.
 *
 * Seeding Database.moduleDescriptors before a pipeline run pins those
 * lookups: a seeded descriptor is returned as-is, and a key explicitly
 * seeded as undefined is a known-missing module that never reaches the
 * network (see Database.getModuleDescriptor). Seeding is per-process and
 * idempotent; spawned-CLI scenarios are unaffected and keep relying on
 * volatile-pattern normalization.
 */

/** Pinned latest stable dist-tag for @minecraft/server. */
export const TEST_PINNED_SERVER_LATEST_VERSION = "2.10.0";

/**
 * Pinned beta version stem for @minecraft/server. Matches the
 * "2.11.0-beta" dependency declared by samplecontent/comprehensive so the
 * out-of-date-beta rule (SCRIPTMODULE:114) deterministically stays quiet on
 * that content.
 */
export const TEST_PINNED_SERVER_BETA_VERSION = "2.11.0";

/** The preview triplet + build the pinned beta dist-tag advertises (e.g. "1.26.60-preview.28"). */
const pinnedBetaProductSuffix = (() => {
  const parts = TEST_PINNED_MC_PREVIEW_VERSION.split(".");

  return `${parts.slice(0, 3).join(".")}-preview.${parts[3] ?? "0"}`;
})();

/** Builds the full beta dist-tag NpmModule parses, e.g. "2.11.0-beta.1.26.60-preview.28". */
export function betaDistTagFor(betaVersion: string): string {
  return `${betaVersion}-beta.${pinnedBetaProductSuffix}`;
}

/**
 * Seeds one module descriptor with deterministic dist-tags. `beta`, when
 * provided, is the beta version stem (e.g. "2.11.0"); the full dist-tag is
 * derived so NpmModule's preview/retail parsing stays consistent with the
 * pinned test Minecraft version.
 */
export function pinModuleDescriptor(moduleName: string, distTags: { latest?: string; beta?: string }): void {
  const packument = {
    name: moduleName,
    "dist-tags": {
      latest: distTags.latest,
      beta: distTags.beta ? betaDistTagFor(distTags.beta) : undefined,
    },
  } as unknown as Packument;

  Database.moduleDescriptors[moduleName] = new NpmModule(packument);
}

/**
 * Seeds one module as known-missing: getModuleDescriptor returns undefined
 * for it without a registry fetch, so "module not registered on NPM" paths
 * are exercisable offline.
 */
export function pinMissingModuleDescriptor(moduleName: string): void {
  Database.moduleDescriptors[moduleName] = undefined;
}

/**
 * Pins @minecraft/server so in-process SCRIPTMODULE results over sample
 * content are deterministic. Applied at module load by TestPaths alongside
 * applyTestVersionPin. Honors an existing seeded descriptor (e.g. a one-off
 * local experiment) the same way applyTestVersionPin honors pre-set
 * environment variables.
 */
export function applyTestScriptModulePin(): void {
  if ("@minecraft/server" in Database.moduleDescriptors) {
    return;
  }

  pinModuleDescriptor("@minecraft/server", {
    latest: TEST_PINNED_SERVER_LATEST_VERSION,
    beta: TEST_PINNED_SERVER_BETA_VERSION,
  });
}

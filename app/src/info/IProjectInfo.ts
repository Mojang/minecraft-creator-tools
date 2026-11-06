// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IGeneratorSummary from "./IGeneratorSummary";

export default interface IProjectInfo {
  defaultBehaviorPackUuid?: string;
  defaultBehaviorPackMinEngineVersion?: string;
  defaultBehaviorPackName?: string;
  defaultBehaviorPackDescription?: string;
  defaultIcon?: string;
  behaviorPackManifestCount?: number;
  defaultResourcePackUuid?: string;
  defaultResourcePackMinEngineVersion?: string;
  defaultResourcePackName?: string;
  defaultResourcePackDescription?: string;
  errorCount?: number;
  internalProcessingErrorCount?: number;
  warningCount?: number;
  reds?: number;
  testSuccessCount?: number;
  infoGenerationTime?: number;
  endToEndGenerationTime?: number;
  testFailCount?: number;
  minimumSupportablePerformanceTier?: number;
  testNotApplicableCount?: number;
  errorSummary?: string;
  internalProcessingErrorSummary?: string;
  warningSummary?: string;
  testFailSummary?: string;
  resourcePackManifestCount?: number;
  unknownJsonCount?: number;
  entityTypeManifestCount?: number;
  blockTypeManifestCount?: number;
  itemTypeManifestCount?: number;
  worldCount?: number;
  summaryImageBase64?: number;
  entityTypeResourceCount?: number;
  behaviorPackAnimationCount?: number;
  behaviorPackAnimationControllerCount?: number;
  customDimensionCount?: number;
  customDimensionChunkCount?: number;
  capabilities?: string[];
  /**
   * Component ids used anywhere in the project, per definition type, as
   * JSON keys (`minecraft:replace_biomes` -> `minecraftReplaceBiomes`),
   * sorted and de-duplicated. Built by the JSONTAGS generator; downstream
   * consumers (Auger) index these as search facets, so the tokens are a
   * contract: never rename them.
   */
  entityTypeComponents?: string[];
  blockTypeComponents?: string[];
  itemTypeComponents?: string[];
  /**
   * Components used by behavior-pack biome definitions. Contains
   * `minecraftReplaceBiomes` exactly when some biome in the project
   * actually replaces a target biome through `minecraft:replace_biomes`.
   */
  biomeBehaviorTypeComponents?: string[];
  biomeClientTypeComponents?: string[];
  particleEmitterTypeComponents?: string[];
  particleTypeComponents?: string[];
  summary?: { [name: string]: { [index: number]: IGeneratorSummary | undefined } | undefined };
  featureSets?: { [setName: string]: { [measureName: string]: number | undefined } | undefined } | undefined;
}

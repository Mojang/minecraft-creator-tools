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
  testSuccessCount?: number;
  testFailCount?: number;
  testNotApplicableCount?: number;
  errorSummary?: string;
  internalProcessingErrorSummary?: string;
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
  summary?: { [name: string]: { [index: number]: IGeneratorSummary | undefined } | undefined };
  featureSets?: { [setName: string]: { [measureName: string]: number | undefined } | undefined } | undefined;
}

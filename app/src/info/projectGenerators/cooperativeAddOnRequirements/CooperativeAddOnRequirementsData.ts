// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum CooperativeAddOnRequirementsGeneratorTest {
  noLooseFileInTypeFolder = 101,
  noCommonNamesInCreatorFolderName = 102,
  noLooseFileInCreatorFolder = 104,
  moreThanOneFolderInCreatorFolderBesidesMaybeCommon = 108,
  noUnsupportedFolderNameInTypeFolder = 109,
  moreThanOneFolderInTypeFolder = 110,
  noLooseFilesInTypeFolder = 111,
  noDimensionElements = 131,
  noUiElements = 133,
  notOneBehaviorPackManifest = 160,
  notOneResourcePackManifest = 161,
  behaviorPackManifestNotValid = 163,
  resourcePackManifestNotValid = 164,
  notOneDependencyFromBehaviorPackToResourcePack = 165,
  dependencyFromBehaviorPackToResourcePackNotValid = 166,
  notOneDependencyFromResourcePackToBehaviorPack = 168,
  dependencyFromResourcePackToBehaviorPackNotValid = 169,
  foundBehaviorPack = 200,
  noVibrantVisualsForNow = 210,
}

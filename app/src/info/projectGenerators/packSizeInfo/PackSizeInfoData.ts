// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum PackSizeInfoGeneratorTest {
  overallSize = 101,
  fileCount = 102,
  folderCount = 103,
  contentSize = 104,
  contentFileCount = 105,
  contentFolderCount = 106,
  exceedsRecommendedAddonSize = 401,
  exceedsRecommendedPackageSize = 402,
  zipFileCouldNotBeProcessed = 410,
}

export interface IPackSizeInfoGeneratorResults {
  size: number;
  fileCounts: number;
  folderCounts: number;
  contentSize: number;
  contentFileCounts: number;
  contentFolderCounts: number;
}

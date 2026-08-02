// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum PackFileCountInfoGeneratorTest {
  fileCount = 101,
  exceedsRecommendedFileCount = 401,
  maxTraversalDepthExceeded = 402,
}

export interface IPackFileCountInfoGeneratorResults {
  fileCount: number;

  // Number of subfolders that were not traversed because MaxFolderTraversalDepth
  // was reached. When > 0, fileCount is a lower bound (undercount).
  skippedFolderCount: number;
}

export const RecommendedMaxFileCount = 10000;

// Maximum folder nesting depth we recursively descend into while counting files.
// Guards against pathological/cyclic structures. Real packs are bounded well below
// this by the OS maximum filepath length, so reaching it is a strong signal of a
// problem rather than legitimate content.
export const MaxFolderTraversalDepth = 15;

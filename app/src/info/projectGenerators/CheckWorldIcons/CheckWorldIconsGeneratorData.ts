// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../../../storage/IFile";
import IFolder from "../../../storage/IFolder";

export enum CheckWorldIconsGeneratorTest {
  NoIconFound = 101,
  MultipleIconsFound = 102,
  IconNotValidImage = 103,
  IconNotValidSize = 104,
}

/**
 * Creates a minimal IFolder stub whose allFiles async iterable yields the given files.
 */
export function createStubFolderWithFiles(files: IFile[]): IFolder {
  const allFilesIterable: AsyncIterable<IFile> = {
    [Symbol.asyncIterator]: async function* () {
      for (const file of files) {
        yield file;
      }
    },
  };

  return {
    allFiles: allFilesIterable,
    getFolderRelativePath: () => "test-world/",
  } as unknown as IFolder;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../../../../storage/IFile";

export interface StubFileOptions {
  name: string;
  content?: string | Uint8Array | null;
  /** Overrides the computed extendedPath (used by CheckProjectIntegrityGenerator). */
  extendedPath?: string;
  /**
   * Whether the file content is a string. Defaults to true when content is a string,
   * false otherwise. Override for generators that branch on file.isString.
   */
  isString?: boolean;
}

// Minimal no-op IEvent stub — satisfies the subscribe/unsubscribe contract used by
// EntityTypeDefinition.behaviorPackFile and similar setters.
const noOpEvent = { subscribe: () => {}, unsubscribe: () => {} };

/**
 * Creates a minimal IFile stub for unit testing.
 * Only populates properties that generators typically access.
 * All unsafe casts are contained here so test files stay clean.
 */
export function createStubFile(options: StubFileOptions): IFile {
  return {
    name: options.name,
    fullPath: `/stubs/${options.name}`,
    storageRelativePath: options.name,
    extendedPath: options.extendedPath ?? `/stubs/${options.name}`,
    content: options.content !== undefined ? options.content : null,
    isContentLoaded: options.content != null,
    isString: options.isString ?? typeof options.content === "string",
    coreContentLength: typeof options.content === "string" ? options.content.length : 0,
    loadContent: async () => {},
    onFileContentUpdated: noOpEvent,
  } as unknown as IFile;
}

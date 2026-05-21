// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ContentIndex from "../../../core/ContentIndex";
import { HashCatalog } from "../../../core/HashUtilities";

export const VANILLA_TEST_FILE_HASH = "abc123def456abc123def456abc12345";
export const VANILLA_TEST_FILE_PATH = "RP/textures/creeper.png";
export const VANILLA_TEST_FILE_NAME = "creeper.png";

/**
 * Creates a ContentIndex stub pre-populated with the given hash catalog entries.
 * The hashCatalog getter returns the internal reference, so entries are added directly.
 */
export function createStubContentIndex(entries: HashCatalog = {}): ContentIndex {
  const index = new ContentIndex();
  const catalog = index.hashCatalog;
  for (const [key, value] of Object.entries(entries)) {
    catalog[key] = value;
  }
  return index;
}

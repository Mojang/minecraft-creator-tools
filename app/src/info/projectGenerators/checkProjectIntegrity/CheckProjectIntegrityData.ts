// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { TestDefinition } from "../../tests/TestDefinition";

export enum CheckIntegrityTest {
  OrphanedFile = "OrphanedFile",
  UnexpectedManifest = "UnexpectedManifest",
}

export const CheckIntegrityTests: Record<CheckIntegrityTest, TestDefinition> = {
  OrphanedFile: {
    id: 101,
    title: "Extraneous Files Or Folder",
    defaultMessage: "Project contains extraneous file or folder",
  },
  UnexpectedManifest: {
    id: 102,
    title: "Unexpected Manifest Structure",
    defaultMessage: "Pack has an unexpected structure, multiple manifests detected. Nested manifests are not allowed.",
  },
};

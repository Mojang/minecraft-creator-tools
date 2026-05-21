// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// This file is loaded by mocha before any spec files via --file.
// It resolves a circular dependency in the production module graph:
//   FileBase → Log → CreatorToolsHost → ... → GitHubFile extends FileBase
// Loading CreatorToolsHost here ensures that by the time any spec file
// triggers the StorageUtilities → ... → FileBase chain, everything in
// the circular path is already cached and fully resolved.
import "../app/CreatorToolsHost";

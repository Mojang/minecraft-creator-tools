// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { TestDefinition } from "../../tests/TestDefinition";
import { ProjectItemType } from "../../../app/IProjectItemData";

export enum CheckBetaTest {
  UsingBetaFeatures = "UsingBetaFeatures",
  FailedToParseJson = "FailedToParseJson",
  FailedToReadFile = "FailedToReadFile",
}

export const CheckBetaTests: Record<CheckBetaTest, TestDefinition> = {
  FailedToReadFile: { id: 101, title: "Failed to read file" },
  FailedToParseJson: { id: 102, title: "Failed to parse Json", defaultMessage: "Failed to parse json in file" },
  UsingBetaFeatures: { id: 103, title: "Using beta features flag in custom definitions is not allowed" },
};

export const JsonTypesToRead = new Set([
  ProjectItemType.behaviorPackManifestJson,
  ProjectItemType.entityTypeBehavior,
  ProjectItemType.blockTypeBehavior,
  ProjectItemType.itemTypeBehavior,
]);

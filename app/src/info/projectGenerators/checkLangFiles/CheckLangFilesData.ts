// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { TestDefinition } from "../../tests/TestDefinition";

export const CheckLangFilesTests: Record<string, TestDefinition> = {
  MissingLanguagesJson: { id: 101, title: "languages.json Not Found" },
  PrimaryLangMissing: { id: 102, title: "en_US lang code is required." },
  FailedToParseFile: { id: 103, title: "Failed To Parse File" },
  LangFileMissing: {
    id: 104,
    title: "Lang File Missing",
    defaultMessage: "All entries in languages.json must have corresponding .lang file.",
  },
  ExtraLangFile: {
    id: 105,
    title: "Lang File Without Catalog Entry",
    defaultMessage: ".lang file exists in pack but its lang code is not referenced in languages.json",
  },
};

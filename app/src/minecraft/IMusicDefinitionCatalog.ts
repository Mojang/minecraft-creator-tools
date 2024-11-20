// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface IMusicDefinitionCatalog {
  [name: string]: IMusicDefinition;
}

export interface IMusicDefinition {
  max_delay?: number;
  min_delay?: number;
  event_name?: string;
}

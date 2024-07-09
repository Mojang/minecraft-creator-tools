// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IEntityTypeDescription {
  identifier: string;
  runtime_identifier?: string;
  is_spawnable: boolean;
  is_summonable: boolean;
  is_experimental: boolean;
  properties?: { [propertyName: string]: object };
  aliases?: { [aliasName: string]: object };
}

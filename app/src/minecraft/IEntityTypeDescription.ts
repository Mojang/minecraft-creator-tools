// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IEntityTypeDescription {
  identifier: string;
  runtime_identifier?: string;
  is_spawnable: boolean;
  is_summonable: boolean;
  is_experimental: boolean;
  properties?: { [propertyName: string]: IEntityTypeDescriptionProperty | undefined };
  aliases?: { [aliasName: string]: object };
}

export interface IEntityTypeDescriptionProperty {
  type: "enum" | "bool" | "int" | "float" | string;
  values?: string[] | number[];
  default: string | boolean | number;
  range?: [number, number];
  client_sync?: boolean;
}

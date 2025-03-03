// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IField from "./IField";

export interface IFormSample {
  path: string;
  content: object | string | number | boolean;
}

export interface IFormDependency {
  id: string;
  type?: string;
  description?: string;
}

export default interface IFormDefinition {
  id?: string;
  title?: string;
  description?: string;
  dataVersion?: string;
  fields: IField[];
  source?: IFormDefinition;
  note?: string;
  note2?: string;
  note3?: string;
  requires?: IFormDependency[];
  tags?: string[];
  restrictions?: IFormDependency[];
  isDeprecated?: boolean;
  scalarFieldUpgradeName?: string;
  samples?: { [path: string]: IFormSample[] };
  customField?: IField;
  scalarField?: IField;
}

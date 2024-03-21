// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IWorldTemplateManifest {
  __comment__?: string;
  format_version?: number;
  header: IWorldTemplateManifestHeader;
  modules: IWorldTemplateModule[];
}

export interface IWorldTemplateManifestHeader {
  description: string;
  name: string;
  uuid: string;
  lock_template_options?: boolean;
  version: number[];
  base_game_version: number[];
}

export interface IWorldTemplateModule {
  description?: string;
  type: string;
  language?: string;
  uuid: string;
  version: number[];
  entry?: string;
}

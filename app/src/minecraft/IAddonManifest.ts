// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IAddonManifest {
  format_version: number;
  __comment__?: string;
  header: IAddonManifestHeader;
  modules: IAddonModule[];
  dependencies: IAddonDependency[];
  metadata?: IAddonMetadata;
  capabilities?: string[];
}

export interface IResourcePackManifest {
  format_version: number;
  __comment__?: string;
  header: IResourceAddonManifestHeader;
  modules: IAddonModule[];
  dependencies: IAddonDependency[];
  subpacks?: IAddonSubpack[];
  metadata?: IAddonMetadata;
  capabilities?: string[];
}

export interface IAddonSubpack {
  folder_name?: string;
  name: string;
  memory_tier: number;
}

export interface IPersonaManifest {
  format_version: number;
  __comment__?: string;
  header: IResourceAddonManifestHeader;
  modules: IAddonModule[];
  dependencies: IAddonDependency[];
  metadata?: IAddonMetadata;
  capabilities?: string[];
}

export interface ISkinPackManifest {
  format_version: number;
  __comment__?: string;
  header: IResourceAddonManifestHeader;
  modules: IAddonModule[];
  dependencies: IAddonDependency[];
  metadata?: IAddonMetadata;
  capabilities?: string[];
}

export interface IAddonManifestHeader {
  description: string;
  name: string;
  uuid: string;
  version: number[];
  min_engine_version: number[];
}

export interface IResourceAddonManifestHeader extends IAddonManifestHeader {
  pack_scope?: "world" | "global" | "any";
}

export interface IAddonModule {
  description: string;
  type: string;
  language?: string;
  uuid: string;
  version: number[];
  entry?: string;
}

export interface IAddonDependency {
  uuid?: string;
  module_name?: string;
  version: number[] | string;
}

export interface IAddonMetadata {
  license?: string;
  authors?: string[];
  url?: string;
  product_type?: "" | "addon";
  generated_with?: { [toolName: string]: string[] };
}

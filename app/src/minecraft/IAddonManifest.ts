export default interface IAddonManifest {
  format_version: number;
  __comment__?: string;
  header: IAddonManifestHeader;
  modules: IAddonModule[];
  dependencies: IAddonDependency[];
}

export interface IAddonManifestHeader {
  description: string;
  name: string;
  uuid: string;
  version: number[];
  min_engine_version: number[];
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

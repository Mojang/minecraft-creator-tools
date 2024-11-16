// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IRenderControllerSetDefinition {
  format_version: string;
  __comment__?: string;
  render_controllers: IRenderControllerSet;
}

export interface IRenderControllerSet {
  [identifier: string]: IRenderController;
}

export interface IRenderController {
  geometry: string;
  materials: IRenderControllerMaterial[];
  textures: string[];
  arrays: RenderControllerArrayLists;
}

export interface RenderControllerArrayLists {
  textures?: { [name: string]: string[] };
  geometries?: { [name: string]: string[] };
  materials?: { [name: string]: string[] };
}

export interface IRenderControllerMaterial {
  [identifier: string]: string;
}

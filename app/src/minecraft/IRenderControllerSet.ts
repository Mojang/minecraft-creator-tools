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
  textures?: { [name: string]: string[] | undefined };
  geometries?: { [name: string]: string[] | undefined };
  materials?: { [name: string]: string[] | undefined };
}

export interface IRenderControllerMaterial {
  [identifier: string]: string;
}

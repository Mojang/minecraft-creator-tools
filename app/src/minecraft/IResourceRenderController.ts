export default interface IResourceRenderControllerDefinition {
  format_version: string;
  __comment__?: string;
  render_controllers: IResourceRenderControllerSet;
}

export interface IResourceRenderControllerSet {
  [identifier: string]: IResourceRenderController;
}

export interface IResourceRenderController {
  geometry: string;
  materials: IResourceRenderControllerMaterial[];
  textures: string[];
}

export interface IResourceRenderControllerMaterial {
  [identifier: string]: string;
}

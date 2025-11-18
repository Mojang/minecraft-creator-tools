// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Visuals Documentation - minecraft:render_controller.v1.8.0
 */

import * as jsoncommon from './../../jsoncommon';

/**
 */
export default interface RenderController {

  format_version: string | number[];

  render_controllers: { [key: string]: any };

}


/**
 */
export interface RenderControllerRenderControllers {

  arrays?: RenderControllerRenderControllersArrays;

  color?: RenderControllerRenderControllersColor;

  filter_lighting?: boolean;

  geometry: string;

  ignore_lighting?: boolean;

  is_hurt_color?: RenderControllerRenderControllersIsHurtColor;

  light_color_multiplier?: string;

  materials?: RenderControllerRenderControllersMaterials[];

  on_fire_color?: RenderControllerRenderControllersOnFireColor;

  overlay_color?: RenderControllerRenderControllersOverlayColor;

  part_visibility?: RenderControllerRenderControllersPartVisibility[];

  rebuild_animation_matrices?: boolean;

  textures?: string[];

  uv_anim?: RenderControllerRenderControllersUvAnim;

}


/**
 */
export interface RenderControllerRenderControllersArrays {

  geometries?: { [key: string]: any };

  materials?: { [key: string]: any };

  textures?: { [key: string]: any };

}


/**
 */
export interface RenderControllerRenderControllersArraysGeometries {

  arrayLessThanscope_identifierGreaterThan: string[];

}


/**
 */
export interface RenderControllerRenderControllersArraysMaterials {

  arrayLessThanscope_identifierGreaterThan: string[];

}


/**
 */
export interface RenderControllerRenderControllersArraysTextures {

  arrayLessThanscope_identifierGreaterThan: string[];

}


/**
 */
export interface RenderControllerRenderControllersColor {

  a?: string;

  b?: string;

  g?: string;

  r?: string;

}


/**
 */
export interface RenderControllerRenderControllersIsHurtColor {

  a?: string;

  b?: string;

  g?: string;

  r?: string;

}


/**
 */
export interface RenderControllerRenderControllersMaterials {

  "azAZ09_:": string;

}


/**
 */
export interface RenderControllerRenderControllersOnFireColor {

  a?: string;

  b?: string;

  g?: string;

  r?: string;

}


/**
 */
export interface RenderControllerRenderControllersOverlayColor {

  a?: string;

  b?: string;

  g?: string;

  r?: string;

}


/**
 */
export interface RenderControllerRenderControllersPartVisibility {

  "azAZ09_:": string;

}


/**
 */
export interface RenderControllerRenderControllersUvAnim {

  offset: string[];

  scale: string[];

}
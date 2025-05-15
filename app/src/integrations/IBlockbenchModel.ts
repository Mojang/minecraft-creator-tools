export default interface IBlockbenchModel {
  meta: IBlockbenchModelMetadata;
  name: string;
  model_identifier: string;
  elements?: IBlockbenchElement[];
  outliner?: IBlockbenchOutlineItem[];
  textures?: IBlockbenchTexture[];
  animations?: IBlockbenchAnimation[];
  visible_box: number[];
  variable_placeholders: string;
  variable_placeholder_buttons: string[];
  bedrock_animation_mode: string;
  timeline_setups: string[];
  unhandled_root_fields: {};
  resolution: IBlockbench2DSize;
}

export interface IBlockbenchModelMetadata {
  format_version: string;
  model_format: string;
  box_uv: boolean;
}

export interface IBlockbench2DSize {
  width: number;
  height: number;
}

export interface IBlockbenchAnimation {
  uuid: string;
  name: string;
  loop: string;
  override: boolean;
  length: number;
  snapping: number;
  selected: boolean;
  saved: boolean;
  path: string;
  anim_time_update: string;
  blend_weight: string;
  loop_delay: string;
  animators: { [name: string]: IBlockbenchAnimationAnimator };
}

export interface IBlockbenchAnimationAnimator {
  name: string;
  type: string;
  keyframes: IBlockbenchAnimationKeyframe[];
}

export interface IBlockbenchAnimationKeyframe {
  channel: string;
  data_points: {
    x: string;
    y: string;
    z: string;
  }[];
  uuid: string;
  time: number;
  color: number;
  interpolation: string;
}

export interface IBlockbenchOutlineItem {
  name: string;
  origin: number[];
  bedrock_binding?: string;
  color: number;
  uuid: string;
  rotation?: number[];
  export: boolean;
  mirror_uv: boolean;
  isOpen: boolean;
  locked: boolean;
  visibility: boolean;
  autouv: number;
  children: (string | IBlockbenchOutlineItem)[];
}

export interface IBlockbenchTexture {
  path: string;
  name: string;
  folder: string;
  namespace: string;
  id: string;
  group: string;
  width: number;
  height: number;
  uv_width: number;
  uv_height: number;
  particle: boolean;
  use_as_default: boolean;
  layers_enabled: boolean;
  sync_to_project: string;
  render_mode: string;
  render_sides: string;
  frame_time: number;
  frame_order_type: string;
  frame_order: string;
  frame_interpolate: boolean;
  visible: boolean;
  internal: boolean;
  saved: boolean;
  uuid: string;
  relative_path: string;
  source: string;
}

export interface IBlockbenchElement {
  name: string;
  box_uv?: boolean;
  rescale?: boolean;
  locked: boolean;
  render_order?: string;
  allow_mirror_modeling?: boolean;
  inflate?: number;
  from?: number[];
  to?: number[];
  position?: number[];
  ignore_inherited_scale?: boolean;
  autouv?: number;
  color?: number;
  origin?: number[];
  uv_offset?: number[];
  rotation: number[];
  light_emission?: number;
  faces?: IBlockbenchFaceSet;
  type: string;
  uuid: string;
}

export interface IBlockbenchFaceSet {
  north: IBlockbenchFace;
  east: IBlockbenchFace;
  south: IBlockbenchFace;
  west: IBlockbenchFace;
  up: IBlockbenchFace;
  down: IBlockbenchFace;
}

export interface IBlockbenchFace {
  uv: number[];
  texture: number;
}

export interface IBlockbenchTexture {
  path: string;
  name: string;
  folder: string;
  namespace: string;
  id: string;
  width: number;
  height: number;
  uv_width: number;
  uv_height: number;
  particle: boolean;
  use_as_default: boolean;
  layers_enabled: boolean;
  sync_to_project: string;
  render_mode: string;
  render_sides: string;
  frame_time: number;
  frame_order_type: string;
  frame_order: string;
  frame_interpolate: boolean;
  visible: boolean;
  internal: boolean;
  saved: boolean;
  uuid: string;
  relative_path: string;
  source: string;
}

export interface IBlockbenchOutliner {
  name: string;
  origin: number[];
  rotation: number[];
  bedrock_binding: string;
  color: number;
  uuid: string;
  export: boolean;
  mirror_uv: boolean;
  isOpen: boolean;
  locked: boolean;
  visibility: boolean;
  autouv: number;
  children: string[];
}

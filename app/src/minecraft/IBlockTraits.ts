export default interface IBlockTraits {
  "minecraft:placement_direction"?: IPlacementDirectionBlockTrait;
  "minecraft:placement_position"?: IPlacementPositionBlockTrait;
}

export interface IPlacementDirectionBlockTrait {
  enabled_states: string[];
  y_rotation_offset?: number;
}

export interface IPlacementPositionBlockTrait {
  enabled_states: string[];
}

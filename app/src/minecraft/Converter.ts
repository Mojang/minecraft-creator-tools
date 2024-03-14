// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Block, { BlockFacingDirection } from "./Block";
import BlockCube from "./BlockCube";
import Log from "../core/Log";

export default class Converter {
  static cubeEnsureBedrockProperties(cube: BlockCube) {
    for (let x = 0; x < cube.maxX; x++) {
      for (let y = 0; y < cube.maxY; y++) {
        for (let z = 0; z < cube.maxZ; z++) {
          const block = cube.x(x).y(y).z(z);

          if (!block.isEmpty) {
            this.blockEnsureBedrockProperties(block);
          }
        }
      }
    }
  }

  static blockEnsureBedrockProperties(block: Block) {
    for (const propName in block.properties) {
      const prop = block.getProperty(propName);

      switch (propName) {
        case "facing":
          if (prop.value === "east") {
            block.ensureProperty("facing_direction").value = BlockFacingDirection.east;
          } else if (prop.value === "west") {
            block.ensureProperty("facing_direction").value = BlockFacingDirection.west;
          } else if (prop.value === "north") {
            block.ensureProperty("facing_direction").value = BlockFacingDirection.north;
          } else if (prop.value === "south") {
            block.ensureProperty("facing_direction").value = BlockFacingDirection.south;
          }
          break;

        // age should map to age
        case "age":
          break;

        case "attached":
          block.ensureProperty("attached_bit").value = prop.asBoolean(false);
          break;

        case "attachment":
          const sourceVal = prop.asString("ceiling").toLowerCase();
          let targetVal = "hanging";

          switch (sourceVal) {
            case "ceiling":
              targetVal = "hanging";
              break;

            case "single_wall":
            case "double_wall":
              targetVal = "side";
              break;

            case "floor":
              targetVal = "floor";
              break;
          }

          block.ensureProperty("attachment").value = targetVal;

          // java values:
          // ceiling
          // double_wall
          // floor
          // single_wall

          // bedrock values
          // standing,
          // hanging,
          // side,
          // multiple

          break;

        // Bedrock doesn't have an equivalent of attaching buttons/levers to things other than face?
        case "face":
          /*   const sourceFaceVal = prop.asString("wall").toLowerCase();
                    let targetFaceVal = "wall";

                    switch (sourceFaceVal)
                    {
                        case "ceiling":
                            targetVal = "hanging";
                            break;
                        
                        case "floor":
                            targetVal = "side";
                            break; 

                    }*/
          break;

        case "axis":
          const sourceAxisVal = prop.asString("x");

          if (block.shortTypeName && block.shortTypeName.indexOf("nether") >= 0) {
            if (sourceAxisVal === "x") {
              block.ensureProperty("portal_axis").value = "x";
            } else if (sourceAxisVal === "z") {
              block.ensureProperty("portal_axis").value = "z";
            }
          } else {
            if (sourceAxisVal === "x") {
              block.ensureProperty("facing_direction").value = BlockFacingDirection.north;
            } else if (sourceAxisVal === "y") {
              block.ensureProperty("facing_direction").value = BlockFacingDirection.up;
            } else if (sourceAxisVal === "z") {
              block.ensureProperty("facing_direction").value = BlockFacingDirection.east;
            }
          }
          break;

        case "bites":
          block.ensureProperty("bite_counter").value = prop.asNumber(0);
          break;

        // whether scaffolding has a bottom?  doesn't seem to have an equiv.
        case "bottom":
          break;

        // respawn anchor charges.
        case "charges":
          break;

        case "conditional":
          block.ensureProperty("conditional_bit").value = prop.asBoolean(false);
          break;

        // Java is 1 to 4
        // Bedrock is 0 to 3
        case "delay":
          block.ensureProperty("repeater_delay").value = prop.asNumber(1) - 1;
          break;

        case "disarmed":
          block.ensureProperty("disarmed_bit").value = prop.asBoolean(false);
          break;

        case "distance":
          let distanceVal = prop.asNumber(1);

          if (distanceVal > 5) {
            distanceVal = 5;
          }

          block.ensureProperty("stability").value = distanceVal;
          break;

        case "drag":
          block.ensureProperty("drag_down").value = prop.asBoolean(false);
          break;

        case "eggs":
          const val = prop.asNumber(1);
          let sVal = "one_egg";

          if (val === 2) {
            sVal = "two_egg";
          } else if (val === 3) {
            sVal = "three_egg";
          } else if (val === 4) {
            sVal = "four_egg";
          }

          block.ensureProperty("turtle_egg_count").value = sVal;
          break;

        case "enabled":
          block.ensureProperty("toggle_bit").value = prop.asBoolean(true);
          break;

        // Bedrock doesn't have an equivalent to extended pistons
        case "extended":
          break;

        case "eye":
          block.ensureProperty("end_portal_eye_bit").value = prop.asBoolean(true);
          break;

        case "half":
          const halfVal = prop.asString("lower").toLowerCase();

          switch (halfVal) {
            case "lower":
            case "bottom":
              block.ensureProperty("upper_block_bit").value = false;
              break;
            default:
              block.ensureProperty("upper_block_bit").value = true;
              break;
          }
          break;

        case "hanging":
          block.ensureProperty("hanging").value = prop.asBoolean(true);
          break;

        // Bedrock doesn't have a flag for books?
        case "has_book":
          break;

        case "has_bottle_0":
          block.ensureProperty("brewing_stand_slot_a_bit").value = prop.asBoolean(false);
          break;

        case "has_bottle_1":
          block.ensureProperty("brewing_stand_slot_b_bit").value = prop.asBoolean(false);
          break;

        case "has_bottle_2":
          block.ensureProperty("brewing_stand_slot_c_bit").value = prop.asBoolean(false);
          break;

        // Bedrock doesn't have a flag for records?
        case "has_record":
          break;

        case "hatch":
          const crackVal = prop.asNumber(0);

          if (crackVal === 0) {
            block.ensureProperty("cracked").value = "no_cracks";
          } else if (crackVal === 1) {
            block.ensureProperty("cracked").value = "no_cracks";
          } else if (crackVal === 2) {
            block.ensureProperty("cracked").value = "max_cracked";
          }

          break;

        case "hinge":
          const hingeVal = prop.asString("hinge");

          if (hingeVal === "left") {
            block.ensureProperty("door_hinge_bit").value = false;
          } else {
            block.ensureProperty("door_hinge_bit").value = true;
          }
          break;

        case "in_wall":
          block.ensureProperty("in_wall_bit").value = prop.asBoolean(true);
          break;

        // No equivalent of instrument in Bedrock?
        case "instrument":
          break;

        // No block state, but is this a block type?
        case "inverted":
          break;

        case "layers":
          block.ensureProperty("height").value = prop.asNumber(1) - 1;
          break;

        case "leaves":
          const leafVal = prop.asString("small");

          switch (leafVal) {
            case "large":
              block.ensureProperty("bamboo_leaf_size").value = "large_leaves";
              break;

            case "none":
              block.ensureProperty("bamboo_leaf_size").value = "no_leaves";
              break;

            default:
              block.ensureProperty("bamboo_leaf_size").value = "small_leaves";
              break;
          }
          break;

        case "level":
          const level = prop.asNumber(0);

          if (block.shortTypeName === "cauldron") {
            block.ensureProperty("fill_level").value = level * 2;
          } else if (block.shortTypeName === "water" || block.shortTypeName === "lava") {
            block.ensureProperty("liquid_depth").value = level;
          }
          break;

        // Bedrock doesn't really track this.
        case "lit":
          break;

        // Bedrock doesn't have whether a repeater can change its locked state
        case "locked":
          break;

        case "mode":
          const modeVal = prop.asString("compare");

          if (block.shortTypeName === "structure") {
            block.ensureProperty("structure_block_type").value = modeVal;
          } else {
            block.ensureProperty("output_subtract_bit").value = modeVal === "subtract";
          }
          break;

        case "moisture":
          block.ensureProperty("moisturized_amount").value = prop.asNumber(0);
          break;

        case "occupied":
          block.ensureProperty("occupied_bit").value = prop.asBoolean(false);
          break;

        case "open":
          block.ensureProperty("open_bit").value = prop.asBoolean(false);
          break;

        case "part":
          if (prop.asString("head") === "head") {
            block.ensureProperty("head_piece_bit").value = true;
          } else {
            block.ensureProperty("head_piece_bit").value = false;
          }
          break;

        case "persistent":
          block.ensureProperty("persistent_bit").value = prop.asBoolean(false);
          break;

        case "pickles":
          block.ensureProperty("cluster_count").value = prop.asNumber(1) - 1;
          break;

        case "power":
          block.ensureProperty("redstone_signal").value = prop.asNumber(0);
          break;

        case "powered":
          if (block.shortTypeName === "rail" || block.shortTypeName === "activator_rail") {
            block.ensureProperty("rail_data_bit").value = prop.asBoolean(false);
          } else {
            block.ensureProperty("powered_bit").value = prop.asBoolean(false);
          }
          break;

        case "orientation":
          block.ensureProperty("ground_sign_direction").value = prop.asNumber(0);
          break;

        case "shape":
          break;

        case "short":
          break;

        case "signal_fire":
          break;

        case "snowy":
          break;

        case "stage":
          block.ensureProperty("age_bit").value = prop.asBoolean(true);
          break;

        case "triggered":
          block.ensureProperty("triggered_bit").value = prop.asBoolean(true);
          break;

        case "type":
          const typeVal = block.ensureProperty("type").asString("normal");

          if (typeVal === "top") {
            block.ensureProperty("top_slot_bit").value = true;
          } else if (typeVal === "bottom") {
            block.ensureProperty("top_slot_bit").value = false;
          }
          break;

        case "waterlogged":
          if (prop.asBoolean(false) === true) {
            block.extraLiquidDepth = Block.MAX_WATER_LEVEL;
          } else {
            block.extraLiquidDepth = 0;
          }
          break;

        case "unstable":
          block.ensureProperty("explode_bit").value = prop.asBoolean(false);
          break;

        // State on "what is on what side" is not tracked in Bedrock.
        case "down":
          break;
        case "up":
          break;
        case "east":
          break;
        case "west":
          break;
        case "north":
          break;
        case "south":
          break;

        default:
          Log.debugAlert(
            "Unsupported property found: " +
              propName +
              " with value '" +
              prop.value +
              "' at block " +
              block.x +
              " " +
              block.y +
              " " +
              block.z
          );
          break;
      }
    }
  }
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.guardian_attack
 * 
 * minecraft:behavior.guardian_attack Samples

Elder Guardian - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/elder_guardian.json

"minecraft:behavior.guardian_attack": {
  "priority": 4
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Guardian Attack Behavior 
 * (minecraft:behavior.guardian_attack)
 * Allows this entity to use a laser beam attack. Can only be used
 * by Guardians and Elder Guardians.
 */
export default interface MinecraftBehaviorGuardianAttack {

  /**
   * @remarks
   * Amount of additional damage dealt from an elder guardian's magic
   * attack.
   */
  elder_extra_magic_damage?: number;

  /**
   * @remarks
   * In hard difficulty, amount of additional damage dealt from a
   * guardian's magic attack.
   */
  hard_mode_extra_magic_damage?: number;

  /**
   * @remarks
   * Amount of damage dealt from a guardian's magic attack. Magic
   * attack damage is added to the guardian's base attack damage.
   */
  magic_damage?: number;

  /**
   * @remarks
   * Guardian attack behavior stops if the target is closer than this
   * distance (doesn't apply to elders).
   */
  min_distance?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Elder Guardian: 4
   *
   */
  priority?: number;

  /**
   * @remarks
   * Time (in seconds) to wait after starting an attack before playing
   * the guardian attack sound.
   */
  sound_delay_time?: number;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the X-axis, this entity can
   * rotate while trying to look at the target.
   */
  x_max_rotation?: number;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the Y-axis, this entity can
   * rotate its head while trying to look at the target.
   */
  y_max_head_rotation?: number;

}
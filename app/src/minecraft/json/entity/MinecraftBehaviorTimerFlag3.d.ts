// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.timer_flag_3
 * 
 * minecraft:behavior.timer_flag_3 Samples

Sniffer - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/sniffer.json

"minecraft:behavior.timer_flag_3": {
  "priority": 5,
  "cooldown_range": 0,
  "duration_range": [
    2,
    5
  ],
  "on_end": {
    "event": "on_feeling_happy_end",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Timer Flag 3 Behavior (minecraft:behavior.timer_flag_3)
 * Fires an event when this behavior starts, then waits for a
 * duration before stopping. When stopping due to that timeout or
 * due to being interrupted by another behavior, fires another event.
 * query.timer_flag_3 will return 1.0 on both the client and server
 * when this behavior is running, and 0.0 otherwise.
 */
export default interface MinecraftBehaviorTimerFlag3 {

  /**
   * @remarks
   * Goal cooldown range in seconds. If specified, the cooldown will
   * have to elapse even before the goal can be selected for the
   * first time.
   */
  cooldown_range: number[];

  /**
   * @remarks
   * Goal duration range in seconds.
   * 
   * Sample Values:
   * Sniffer: [2,5]
   *
   */
  duration_range: number[];

  /**
   * @remarks
   * Event(s) to run when the goal end.
   * 
   * Sample Values:
   * Sniffer: {"event":"on_feeling_happy_end","target":"self"}
   *
   */
  on_end: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event(s) to run when the goal starts.
   */
  on_start: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Sniffer: 5
   *
   */
  priority: number;

}
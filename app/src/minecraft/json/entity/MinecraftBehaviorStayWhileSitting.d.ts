// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.stay_while_sitting
 * 
 * minecraft:behavior.stay_while_sitting Samples

Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.stay_while_sitting": {
  "priority": 3
}


Parrot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/parrot.json

"minecraft:behavior.stay_while_sitting": {
  "priority": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Stay While Sitting Behavior 
 * (minecraft:behavior.stay_while_sitting)
 * Allows the mob to stay put while it is in a sitting state instead of
 * doing something else.
 */
export default interface MinecraftBehaviorStayWhileSitting {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Cat: 3
   *
   *
   * Parrot: 2
   *
   */
  priority: number;

}
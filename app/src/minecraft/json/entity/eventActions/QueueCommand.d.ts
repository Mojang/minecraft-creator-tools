// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Actions Documentation - minecraft:queue_command
 * 
 * minecraft:queue_command Samples
""queue_command": {
			"command": "say I have died!"
		}
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Queue Command (queue_command)
 * Will queue a slash command or a series of slash commands set in
 * an array to trigger at the end of the tick. Due to being queued as
 * opposed to triggering instantly, any immediate side-effects of
 * the command may not be observable by other molang queries, commands,
 * or scripts until later in the tick. Note that commands executed via
 * queue_command are guaranteed to run in order with respect to
 * other queued commands. Additionally, if an entity is removed before
 * a queued command has the chance to execute, for example removed on
 * the same tick that the command was queued, the command will not
 * execute.
 */
export default interface QueueCommand {

  /**
   * @remarks
   * Slash command to run.
   */
  command?: string;

  /**
   * @remarks
   * The target context to execute against.
   */
  target?: string;

}


export enum QueueCommandTarget {
  Self = `self`
}
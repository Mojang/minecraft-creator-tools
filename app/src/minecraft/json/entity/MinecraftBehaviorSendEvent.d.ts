// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.send_event
 * 
 * minecraft:behavior.send_event Samples

Evocation Illager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/evocation_illager.json

"minecraft:behavior.send_event": {
  "priority": 3,
  "event_choices": [
    {
      "min_activation_range": 0,
      "max_activation_range": 16,
      "cooldown_time": 5,
      "cast_duration": 3,
      "particle_color": "#FFB38033",
      "weight": 3,
      "filters": {
        "all_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "sheep"
          },
          {
            "test": "is_color",
            "subject": "other",
            "value": "blue"
          }
        ]
      },
      "start_sound_event": "cast.spell",
      "sequence": [
        {
          "base_delay": 2,
          "event": "wololo",
          "sound_event": "prepare.wololo"
        }
      ]
    }
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Send Event Behavior (minecraft:behavior.send_event)
 * Allows the mob to send an event to another mob.
 */
export default interface MinecraftBehaviorSendEvent {

  /**
   * @remarks
   * Time in seconds for the entire event sending process
   */
  cast_duration?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Evocation Illager: [{"min_activation_range":0,"max_activation_range":16,"cooldown_time":5,"cast_duration":3,"particle_color":"#FFB38033","weight":3,"filters":{"all_of":[{"test":"is_family","subject":"other","value":"sheep"},{"test":"is_color","subject":"other","value":"blue"}]},"start_sound_event":"cast.spell","sequence":[{"base_delay":2,"event":"wololo","sound_event":"prepare.wololo"}]}]
   *
   */
  event_choices?: MinecraftBehaviorSendEventEventChoices[];

  /**
   * @remarks
   * If true, the mob will face the entity it sends an event to
   */
  look_at_target?: boolean;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Evocation Illager: 3
   *
   */
  priority?: number;

  /**
   * @remarks
   * List of events to send
   */
  sequence?: MinecraftBehaviorSendEventSequence[];

}


/**
 * Event choices (event_choices)
 */
export interface MinecraftBehaviorSendEventEventChoices {

  /**
   * @remarks
   * 
   * Sample Values:
   * Evocation Illager: 3
   *
   */
  cast_duration?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Evocation Illager: 5
   *
   */
  cooldown_time?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Evocation Illager: {"all_of":[{"test":"is_family","subject":"other","value":"sheep"},{"test":"is_color","subject":"other","value":"blue"}]}
   *
   */
  filters?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Evocation Illager: 16
   *
   */
  max_activation_range?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Evocation Illager: 0
   *
   */
  min_activation_range?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Evocation Illager: "#FFB38033"
   *
   */
  particle_color?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Evocation Illager: [{"base_delay":2,"event":"wololo","sound_event":"prepare.wololo"}]
   *
   */
  sequence?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Evocation Illager: "cast.spell"
   *
   */
  start_sound_event?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Evocation Illager: 3
   *
   */
  weight?: number;

}


/**
 * List of events to send.
 */
export interface MinecraftBehaviorSendEventSequence {

  /**
   * @remarks
   * Amount of time in seconds before starting this step
   */
  base_delay?: number;

  /**
   * @remarks
   * The event to send to the entity
   */
  event?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * The sound event to play when this step happens
   */
  sound_event?: jsoncommon.MinecraftEventTrigger;

}
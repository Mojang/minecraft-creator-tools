// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IEntityTrigger } from "./IEntityTrigger";
import { MinecraftFilterClauseSet } from "./jsoncommon/MinecraftFilterClauseSet";

export interface IPlaySound {
  sound: string;
}

export interface IQueueCommand {
  command: string;
}

export interface IEmitVibration {
  vibration: string;
}

export interface IEmitParticle {
  particle: string;
}

export default interface IEntityAction {
  add?: { component_groups: string[] } | undefined;
  remove?: { component_groups: string[] } | undefined;
  filters?: MinecraftFilterClauseSet | undefined;
  set_property?: { [propertyName: string]: string | number | boolean | undefined };
  reset_target?: object;
  play_sound?: IPlaySound;
  emit_vibration?: IEmitVibration;
  emit_particle?: IEmitParticle;
  queue_command?: IQueueCommand;
  weight?: number;
  trigger?: string | IEntityTrigger | undefined;
}

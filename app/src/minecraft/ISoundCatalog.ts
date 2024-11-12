// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface ISoundCatalog {
  block_sounds: ISoundEventSet;
  entity_sounds: IEntitySounds;
  individual_event_sounds: IEntitySoundIndividualsInterior;
}

export interface IEntitySounds {
  defaults?: ISoundEvent;
  entities: ISoundEventSet;
}

export interface ISoundEventSet {
  [name: string]: ISoundEvent;
}

export interface ISoundEvent {
  volume: number;
  pitch: number | number[];
  events: { [name: string]: string | ISoundEventIndividual };
}

export interface IEntitySoundIndividualsInterior {
  events: { [name: string]: ISoundEventIndividual | string };
}

export interface ISoundEventIndividual {
  volume?: number;
  sound: string;
  pitch?: number | number[];
}
